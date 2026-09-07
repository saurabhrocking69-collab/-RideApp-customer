import { useRef, useEffect, useState, memo } from 'react';
import { Animated, View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, Circle, AnimatedRegion, PROVIDER_GOOGLE } from 'react-native-maps';
import Svg, { Path, Rect, Ellipse, Circle as SvgCircle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { MAPS_KEY, isNimble} from '../constants';

/* Booking route colour, in one place.

   It was four separate literals before — the animating line, the casing, the
   core, and the km badge — so changing the route meant finding all four and
   the badge kept its old hue when the line changed.

   Three tokens rather than one because they do different jobs: CORE is the
   line, CASING is the dark edge underneath it (a single flat stroke gets lost
   wherever it crosses a white road), and INK is the badge text, which sits on
   white and so cannot be the light blue — that reads at about 1.9:1 and is
   effectively invisible. */
const ROUTE_CORE   = '#38BDF8';   // light blue
const ROUTE_CASING = '#082F49';   // same hue, far darker
const ROUTE_INK    = '#0369A1';   // readable on white
import { C } from '../styles';

// A single Google Directions route option, surfaced to the parent so the
// customer can choose between (e.g.) fastest and shortest.
/* Vehicles that can use lanes a car cannot. Google routes these far better as
   TWO_WHEELER than as a car — the same list that gets the fastest/shortest
   choice in BookingScreen, because it is the same physical fact behind both. */

export interface RouteOption {
  polyline: string;      // encoded overview_polyline — stored on the ride so the driver draws the same path
  distanceKm: number;
  durationMin: number;
  distText: string;      // "13 km"
  etaText: string;       // "49 min"
}

// ── Polyline decoder ──────────────────────────────────────────────────────────
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const pts: { latitude: number; longitude: number }[] = [];
  let idx = 0, lat = 0, lng = 0;
  while (idx < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    pts.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return pts;
}

// ── Haversine distance (metres) ───────────────────────────────────────────────
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Walk distance + time chip (on the dotted line midpoint) ──────────────────
function WalkChip({ distM }: { distM: number }) {
  const dist  = distM < 1000 ? `${Math.round(distM)}m` : `${(distM / 1000).toFixed(1)}km`;
  const mins  = Math.max(1, Math.ceil(distM / 83)); // 5 km/h ≈ 83 m/min
  return (
    <View style={{
      backgroundColor: '#FFFFFF',
      borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4,
      borderWidth: 1.5, borderColor: '#60A5FA',
      flexDirection: 'row', alignItems: 'center', gap: 4,
      elevation: 5,
      shadowColor: '#3B82F6', shadowOpacity: 0.22, shadowRadius: 6,
    }}>
      <Text style={{ fontSize: 11 }}>🚶</Text>
      <Text style={{ fontSize: 11, fontWeight: '800', color: '#1D4ED8' }}>
        {dist} · {mins} min
      </Text>
    </View>
  );
}

// ── Compass bearing between two coords ───────────────────────────────────────
function computeBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toR = (d: number) => d * Math.PI / 180;
  const dL = toR(lng2 - lng1);
  const l1 = toR(lat1), l2 = toR(lat2);
  const y = Math.sin(dL) * Math.cos(l2);
  const x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dL);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/* CarShape / AutoShape / ScooterShape yahan se hata diye gaye.

   Wo haath se bane SVG the jinki jagah ab asli tasveerein hain (VEHICLE_ART).
   Unhe "kaam aa sakte hain" soch kar chhod dena ek jaal banata: koi unme rang
   badalta aur map par kuch na hota, kyoki unhe ab koi bulata hi nahi. Git me
   wo maujood hain - jis commit ne tasveerein lagai, usse pehle.

   ERikshaShape abhi bhi zinda hai aur istemal me hai: e-rickshaw ki uper se
   li gayi tasveer nahi mili. */
// ── Minimum camera span ──────────────────────────────────────────────────────
// fitToCoordinates has no minimum-zoom option, so when the points it is given
// sit close together — the pickup pin and the rider standing a street away
// from it, which is the normal case on the booking editor — it slams the
// camera all the way in and the map reads as a blank plate with no landmarks
// around it. Padding the bounding box out to a floor gives the pins some
// surroundings. Longer trips already exceed the floor, so their framing is
// untouched.
const MIN_FIT_SPAN = 0.018;   // degrees ≈ 2 km
function ERikshaShape({ bodyLight, bodyDark, roof }: { bodyLight: string; bodyDark: string; roof: string }) {
  // E-rickshaws ("toto") are visibly boxier than a put-put auto-rickshaw —
  // flat roof instead of a curved canopy, wider flat-sided cabin, a bench
  // visible at the back. Its own shape, not an AutoShape recolor.
  const gid = 'er' + bodyDark.replace('#', '');
  return (
    <Svg width={34} height={46} viewBox="0 0 34 46">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={bodyLight} />
          <Stop offset="1" stopColor={bodyDark} />
        </LinearGradient>
      </Defs>
      {/* Rear wheels — wide stance */}
      <Ellipse cx="4"  cy="36" rx="3.6" ry="5.4" fill="#111827" />
      <Ellipse cx="30" cy="36" rx="3.6" ry="5.4" fill="#111827" />
      {/* Boxy cabin — flat sides, minimal taper (vs. auto's curved/tapered
          shape) */}
      <Path d="M5,40 L29,40 L28,12 Q28,8 24,8 L10,8 Q6,8 6,12 Z" fill={`url(#${gid})`} stroke="#1F2937" strokeWidth="1.2" />
      {/* Flat roof — the key visual cue that reads "e-rickshaw" not "auto" */}
      <Rect x="7" y="9" width="20" height="4" rx="1.5" fill={roof} opacity={0.95} />
      {/* Windscreen */}
      <Path d="M9,14 L25,14 L24,20 L10,20 Z" fill="#BFE3FF" opacity={0.85} />
      {/* Brand pink livery stripe across the cabin */}
      <Rect x="6.5" y="24" width="21" height="2.2" rx="1" fill={C.pink} opacity={0.88} />
      {/* Passenger bench hint (wide open back, e-rickshaws seat 3+ side by side) */}
      <Rect x="8" y="30" width="18" height="4" rx="2" fill="rgba(0,0,0,0.12)" />
      {/* Slight side-angle shading down the cabin's right edge */}
      <Rect x="26" y="20" width="2.1" height="18" fill="rgba(0,0,0,0.14)" />
      {/* Front wheel */}
      <Ellipse cx="17" cy="7" rx="3" ry="4" fill="#111827" />
      {/* Headlight */}
      <Ellipse cx="17" cy="4" rx="1.8" ry="1.4" fill="#FEF9C3" stroke="#F5D90A" strokeWidth="0.5" />
      {/* Electric badge — sits in the gap between the brand stripe and the
          passenger bench so it doesn't collide with either. */}
      <Path d="M18,27 L15,31.5 L17.1,31.5 L16.4,35.5 L19.6,30 L17.5,30 Z" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.4" />
    </Svg>
  );
}

/* Ye do neeche ke kaam ke liye zaroori hain aur galti se kat gaye the -
   purane SVG hatate waqt meri kataai zyada chal gayi thi. Git se hu-ba-hu
   wapas laaye gaye, badle bina. */
function withMinSpan(pts: { latitude: number; longitude: number }[]) {
  if (!pts.length) return pts;
  let minLat =  90, maxLat =  -90, minLng =  180, maxLng = -180;
  for (const p of pts) {
    if (p.latitude  < minLat) minLat = p.latitude;
    if (p.latitude  > maxLat) maxLat = p.latitude;
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
  }
  if (maxLat - minLat >= MIN_FIT_SPAN && maxLng - minLng >= MIN_FIT_SPAN) return pts;
  const cLat = (minLat + maxLat) / 2, cLng = (minLng + maxLng) / 2;
  const hLat = Math.max(maxLat - minLat, MIN_FIT_SPAN) / 2;
  const hLng = Math.max(maxLng - minLng, MIN_FIT_SPAN) / 2;
  // Two opposite corners are enough to widen the box fitToCoordinates computes.
  return [
    ...pts,
    { latitude: cLat - hLat, longitude: cLng - hLng },
    { latitude: cLat + hLat, longitude: cLng + hLng },
  ];
}

// ── Interpolate a lat/lng point at progress t (0→1) along a polyline ─────────
function interpolateRoute(
  coords: { latitude: number; longitude: number }[],
  t: number,
): { latitude: number; longitude: number } {
  if (coords.length === 0) return { latitude: 0, longitude: 0 };
  if (t <= 0 || coords.length === 1) return coords[0];
  if (t >= 1) return coords[coords.length - 1];
  // Accumulate segment lengths (degree-space — fine for city-scale routes)
  const dists: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const dlat = coords[i].latitude  - coords[i - 1].latitude;
    const dlng = coords[i].longitude - coords[i - 1].longitude;
    dists.push(dists[i - 1] + Math.sqrt(dlat * dlat + dlng * dlng));
  }
  const total  = dists[dists.length - 1];
  const target = t * total;
  for (let i = 1; i < dists.length; i++) {
    if (dists[i] >= target) {
      const seg = (target - dists[i - 1]) / (dists[i] - dists[i - 1]);
      return {
        latitude:  coords[i - 1].latitude  + seg * (coords[i].latitude  - coords[i - 1].latitude),
        longitude: coords[i - 1].longitude + seg * (coords[i].longitude - coords[i - 1].longitude),
      };
    }
  }
  return coords[coords.length - 1];
}

/* Asli gaadi ki tasveerein - car, auto, bike.

   Pehle ye haath se bane SVG the. Tasveerein isliye ki wo asli lagti hain aur
   ek hi nazar me pehchani jaati hain; SVG achha tha par khinchi hui aakriti
   hi rehta tha.

   Teeno pehle se ghumai hui hain taaki NAAK UPER ho - marker 0 degree ko
   uttar maanta hai aur usi hisaab se ghumata hai. Auto ki asli tasveer me
   naak NEECHE thi (chhat uper, headlight neeche); wo dekh kar pakda gaya, aur
   na pakadta to har auto ulta chalta.

   Naap bhi asli anupaat me kaate gaye hain - car chaudi, auto manjhli, bike
   patli - kyoki wo map par ek saath dikhte hain. */
const VEHICLE_ART: Record<string, any> = {
  car:  require('../../assets/vehicles/car.png'),
  auto: require('../../assets/vehicles/auto.png'),
  bike: require('../../assets/vehicles/bike.png'),
};

/* Screen par kitne bade - tasveer ke apne anupaat me.
   Ye wahi anupaat hai jo file me hai; yahan dohraya isliye gaya hai ki Image
   ko naap chahiye hi (bina uske wo 0x0 par render hoti hai). */
const ART_SIZE: Record<string, { w: number; h: number }> = {
  car:  { w: 34, h: 72 },
  auto: { w: 30, h: 49 },
  bike: { w: 22, h: 40 },
};

/* Ek hi tasveer, do kaam - isliye ek chhota nishaan.

   SVG me ek hi aakar rang badal kar do-do gaadiyan chalata tha (bike/green_bike,
   auto/electric_auto, car/luxury). Tasveer ka rang badla nahi ja sakta, to wo
   farq yahan se aata hai: electric par hara bijli ka nishaan, luxury par
   sunehra kinara. Alag tasveerein banwane se ye sasta bhi hai aur badalna bhi
   aasan. */
function VehiclePhoto({ art, size, electric, luxury, onReady }: {
  art: string; size: { w: number; h: number };
  electric?: boolean; luxury?: boolean;
  /* Tasveer ban jaane par khabar. Marker ka bitmap ginti ke mauko par hi
     khincha jaata hai; agar wo tasveer aane se PEHLE khich gaya to marker
     khali reh jaata. Isliye tasveer aate hi ek baar aur khichwaya jaata hai. */
  onReady?: () => void;
}) {
  return (
    <View style={{ width: size.w, height: size.h }}>
      <Image
        source={VEHICLE_ART[art]}
        style={{ width: size.w, height: size.h }}
        resizeMode="contain"
        onLoad={onReady}
      />
      {electric ? (
        <View style={{
          position: 'absolute', right: -3, top: -3,
          width: 13, height: 13, borderRadius: 7,
          backgroundColor: '#16A34A', borderWidth: 1.2, borderColor: '#DCFCE7',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 8, color: '#fff', fontWeight: '900', lineHeight: 10 }}>⚡</Text>
        </View>
      ) : null}
      {luxury ? (
        <View style={{
          position: 'absolute', left: -2, right: -2, top: -2, bottom: -2,
          borderRadius: 8, borderWidth: 1.4, borderColor: 'rgba(245,197,24,0.85)',
        }} />
      ) : null}
    </View>
  );
}

// Per-vehicle-type color + shape pairing — real-world liveries where they
// exist (yellow/black auto, green e-auto) so the type reads at a glance.
const VEHICLE_VISUALS: Record<string, { Shape: any; props: any }> = {
  bike:          { Shape: VehiclePhoto, props: { art: 'bike', size: ART_SIZE.bike } },
  green_bike:    { Shape: VehiclePhoto, props: { art: 'bike', size: ART_SIZE.bike, electric: true } },
  auto:          { Shape: VehiclePhoto, props: { art: 'auto', size: ART_SIZE.auto } },
  electric_auto: { Shape: VehiclePhoto, props: { art: 'auto', size: ART_SIZE.auto, electric: true } },
  car:           { Shape: VehiclePhoto, props: { art: 'car',  size: ART_SIZE.car } },
  car_7:         { Shape: VehiclePhoto, props: { art: 'car',  size: ART_SIZE.car } },
  luxury:        { Shape: VehiclePhoto, props: { art: 'car',  size: ART_SIZE.car, luxury: true } },
  /* eriksha apne SVG par hi hai. Uski uper se li gayi tasveer nahi hai, aur jo
     mili wo peechhe se tirchi thi - ghumane par wo leta hua dabba lagti aur ye
     bata hi nahi paati ki gaadi kis taraf ja rahi hai, jo marker ka poora kaam
     hai. Jis din uper se li hui mil jaye, sirf ye ek line badlegi. */
  eriksha:       { Shape: ERikshaShape, props: { bodyLight: '#67E8F9', bodyDark: '#0891B2', roof: '#164E63' } },
};
// Exported so other screens (matching, driver cards, "switch vehicle"
// pickers) can render the same real vehicle models instead of emoji —
// one source of truth for what each vehicle type looks like.
export function vehicleVisual(vehicleType: string) {
  return VEHICLE_VISUALS[vehicleType] || VEHICLE_VISUALS.car;
}

/* Is gaadi ka sabse bada naap - use box me bithane ke liye.

   Map par sab ASLI anupaat me dikhte hain (car chaudi, bike patli) kyoki wahan
   wo ek saath hote hain aur aapas me tulte hain. Par jahan ek hi gaadi akele
   dikhti hai - matching screen ka hero, ya vikalp wali chhoti chip - wahan
   asli anupaat ulta padta hai: sabko ek hi 70 se baant do to bike box ke 57%
   par reh jaati, aur 20px ki chip me sirf 11px ki.

   Isliye har ek ko uske APNE naap se baanta jaata hai, taaki wo box bhar de.
   eriksha abhi SVG par hai, jiska baseline 70 tha - wahi rehta hai. */
/* eriksha abhi bhi apne SVG par hai, jo 34x46 ka hai. Uske props me `size`
   nahi hai (wo rang leta hai, naap nahi), isliye uska naap yahan likha hai. */
const ERIKSHA_SIZE = { w: 34, h: 46 };

/* Gaadi ka asli naap - dabba naapne ke liye. */
export function vehicleArtSize(vehicleType: string): { w: number; h: number } {
  const v = VEHICLE_VISUALS[vehicleType] || VEHICLE_VISUALS.car;
  return (v.props && v.props.size) || ERIKSHA_SIZE;
}

/* Ghoomne ke baad bhi na kate, itna bada chakor dabba.

   Marker apne bachche ke dabbe jitna hi bitmap banata hai - jo bahar nikla wo
   KAT jaata hai. Ghoomti hui cheez ka sabse bada naap uska VIKARN hota hai
   (car: 34x72 -> 80), to utna chakor dabba lene par kisi bhi heading par kuchh
   bahar nikal hi nahi sakta.

   Pehle sabke liye ek hi 44x70 tha. Car 90 degree par 72 chaudi ho jaati thi
   aur 44 me se 28px kat jaata tha - wahi "kabhi-kabhi kat jaati hai" wala. */
export function vehicleArtBox(vehicleType: string): number {
  const { w, h } = vehicleArtSize(vehicleType);
  return Math.ceil(Math.sqrt(w * w + h * h));
}

export function vehicleArtMax(vehicleType: string): number {
  const v = VEHICLE_VISUALS[vehicleType] || VEHICLE_VISUALS.car;
  const sz = v.props && v.props.size;
  return sz ? Math.max(sz.w, sz.h) : 70;
}

// ── Assigned driver marker — real top-down vehicle, rotated to heading,
// no circle frame. Ground shadow gives it depth like it's sitting on the map. ──
function DriverMarker({ vehicleType, heading, turnMs = 1400, onReady }: {
  vehicleType: string; heading: number; turnMs?: number; onReady?: () => void;
}) {
  const { Shape, props } = vehicleVisual(vehicleType);
  const size = vehicleArtSize(vehicleType);
  const box  = vehicleArtBox(vehicleType);

  // Smooth the rotation itself (not just position) — a hard snap to the new
  // heading every GPS tick reads as jumpy; tween it so the vehicle visibly
  // "turns" like it would on a real road.
  const rotate = useRef(new Animated.Value(heading)).current;
  const prevHeading = useRef(heading);
  /* Mudne me utna hi samay jitna chalne me - dono ek saath khatam hon.
     Pehle mudna 500ms ka tha aur chalna 1400ms ka: gaadi mudkar seedhi ho
     jaati thi aur uske baad bhi khiskti rehti thi - do alag harkatein
     dikhti thi, ek nahi. */
  const turnRef = useRef(turnMs);
  turnRef.current = turnMs;
  useEffect(() => {
    // Take the shorter turning direction across the 0/360 wrap instead of
    // always spinning forward (e.g. 350°→10° should turn +20°, not -340°).
    let delta = heading - prevHeading.current;
    delta = ((delta + 180) % 360 + 360) % 360 - 180;
    const target = prevHeading.current + delta;
    prevHeading.current = target;
    Animated.timing(rotate, { toValue: target, duration: turnRef.current, useNativeDriver: true }).start();
  }, [heading]);

  /* Zameen ki chhaya - gaadi ke BEECH ke neeche, kinare par nahi.

     Pehle wo dabbe ki tali se chipki thi. Wo tab tak theek tha jab gaadi
     hamesha seedhi khadi rehti; ab gaadi apne beech ke chaaro taraf ghoomti
     hai, to tali wali chhaya 90 degree par gaadi se alag hokar kahin neeche
     tairti dikhti. Beech ke neeche rakhi chhaya har kon par sahi baithti
     hai - uper se dekhne par saaya waise bhi gaadi ke neeche hi hota hai. */
  const shW = Math.round(size.w * 1.12);
  const shH = Math.max(8, Math.round(shW * 0.42));
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute', width: shW, height: shH, borderRadius: shW,
        left: (box - shW) / 2, top: (box - shH) / 2 + 3,
        backgroundColor: 'rgba(0,0,0,0.22)',
      }} />
      <Animated.View style={{ transform: [{ rotate: rotate.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) }] }}>
        <Shape {...props} onReady={onReady} />
      </Animated.View>
    </View>
  );
}

// ── Nearby ghost driver — same top-down shape, smaller + faded, no rotation
// tracking (ambient "drivers are around here" markers, not en route to you). ──
const NEARBY_SCALE = 0.52;
function NearbyDriverMarker({ vehicleType }: { vehicleType: string }) {
  const { Shape, props } = vehicleVisual(vehicleType);
  /* Dabba gaadi ke apne naap se, ek hi 24x38 se nahi.

     Ye ghoomti nahi, isliye vikarn ki zaroorat nahi - par chhoti karne se
     LAYOUT chhota nahi hota, sirf dikhne wala naap chhota hota hai. Purane
     24x38 me chhoti ki hui car 37.4 ki thi: sirf 0.6px bachta tha. Naap thoda
     bhi badla aur ye bhi katne lagti. */
  const { w, h } = vehicleArtSize(vehicleType);
  return (
    <View style={{
      width:  Math.ceil(w * NEARBY_SCALE) + 4,
      height: Math.ceil(h * NEARBY_SCALE) + 4,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <View style={{ transform: [{ scale: NEARBY_SCALE }], opacity: 0.82 }}>
        <Shape {...props} />
      </View>
    </View>
  );
}

// ── Address tag — floats above a pin without shifting its anchor point.
// Deliberately NORMAL FLOW, not position:absolute — react-native-maps turns
// a Marker's children into a native bitmap by measuring/snapshotting the
// child view's own layout bounds, and content positioned outside that via
// position:absolute (particularly on Android) gets clipped out of the
// snapshot instead of floating over it like it would in plain RN. Stacking
// the label in-flow above the pin keeps it inside the measured bounds, and
// the Marker's `anchor` prop (set at each call site below) is adjusted to
// compensate so the pin itself still points at the exact coordinate. ──
function PinLabel({ text, accent }: { text: string; accent: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      {/* Frosted-glass area-name tag — short locality name, not the full address */}
      {/* maxWidth was 130, which sounds generous but is not: the dot, the gap,
          18px of horizontal padding and the border eat ~31px, leaving ~90px of
          text. That clipped even short locality names — "Kalyanpur" rendered as
          "Kalyanpu…", losing one character to an ellipsis, which just reads as
          broken. Wider pill, tighter padding, and the label text itself is now
          cut at a word boundary upstream so it never ends mid-word. */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderRadius: 11,
        paddingHorizontal: 8, paddingVertical: 5,
        maxWidth: 176,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)',
        elevation: 6, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
      }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
        <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '800', color: '#1a1a1a', flexShrink: 1 }}>{text}</Text>
      </View>
      {/* Connector "rope" down to the pin */}
      <View style={{ width: 1.5, height: 9, backgroundColor: accent, opacity: 0.8 }} />
    </View>
  );
}

// ── Pickup pin — beacon-style ring with a soft glow halo and a subtle
// highlight on the center dot for a bit of depth, rather than a flat bullseye ──
function PickupMarker({ dragging, label }: { dragging?: boolean; label?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      {!!label && <PinLabel text={label} accent={C.green} />}
      <View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}>
        <View style={styles.pickupGlow} />
        <View style={[styles.pickupRing, dragging && { borderColor: C.green, borderWidth: 3.5 }]}>
          <View style={styles.pickupDot}>
            <View style={styles.pickupDotShine} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Drop pin — pink teardrop ──────────────────────────────────────────────────
function DropMarker({ dragging, label }: { dragging?: boolean; label?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      {!!label && <PinLabel text={label} accent={C.pink} />}
      <View style={styles.dropOuter}>
        <View style={[styles.dropPin, dragging && { backgroundColor: C.pink }]}>
          <View style={styles.dropHole} />
        </View>
        <View style={styles.dropTail} />
      </View>
    </View>
  );
}

// ── ETA chip ──────────────────────────────────────────────────────────────────
function EtaChip({ eta, distance }: { eta: string; distance: string }) {
  if (!eta) return null;
  return (
    <View style={styles.etaChip}>
      <View style={styles.etaDot} />
      <Text style={styles.etaTime}>{eta}</Text>
      <View style={styles.etaSep} />
      <Text style={styles.etaDist}>{distance}</Text>
    </View>
  );
}

// ── "Drag to set drop" label hint ────────────────────────────────────────────
function DragHint({ visible, isAdjust }: { visible: boolean; isAdjust?: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 280, useNativeDriver: true }).start();
  }, [visible]);
  return (
    <Animated.View style={[styles.tapHint, { opacity, bottom: 56 }]} pointerEvents="none">
      <Ionicons name="move" size={13} color="#fff" />
      <Text style={styles.tapHintTxt}>
        {isAdjust ? 'Drag to fine-tune — stay inside green circle' : 'Drag map to set drop location'}
      </Text>
    </Animated.View>
  );
}

// ── "Currently here" GPS marker — frosted-glass label (semi-transparent +
// border + shadow, this codebase's no-native-blur "glass" technique, same
// as GlassPanel in ui.tsx) instead of the old solid-white pill ────────────
function YouMarker() {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(255,255,255,0.62)',
        borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5,
        marginBottom: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)',
        elevation: 5,
        shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
      }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6' }} />
        <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#1a1a1a', letterSpacing: 0.2 }}>It's me</Text>
      </View>
      <View style={{
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: '#3B82F6', borderWidth: 2.5, borderColor: '#fff',
        elevation: 6, shadowColor: '#3B82F6', shadowOpacity: 0.55, shadowRadius: 6,
      }} />
    </View>
  );
}

// ── Re-center button ──────────────────────────────────────────────────────────
function RecenterBtn({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.recenterBtn} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name="locate" size={18} color={C.pink} />
    </TouchableOpacity>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface NearbyDriver {
  lat: number;
  lng: number;
  vehicleType: string;
}

export interface LiveMapProps {
  pickupCoords?: { lat: number; lng: number } | null;
  dropCoords?: { lat: number; lng: number } | null;
  driverLat?: number | null;
  driverLng?: number | null;
  vehicleType?: string;
  userLat?: number | null;
  userLng?: number | null;
  userAccuracy?: number | null;
  height?: number;
  mode?: 'booking' | 'matching' | 'inride';
  showRoute?: boolean;
  showTraffic?: boolean;
  followDriver?: boolean;
  nearbyDrivers?: NearbyDriver[];
  onMapPress?: (coords: { lat: number; lng: number }) => void;
  draggablePickup?: boolean;
  onPickupDragEnd?: (coords: { lat: number; lng: number }) => void;
  draggableDrop?: boolean;
  onDropDragEnd?: (coords: { lat: number; lng: number }) => void;
  showTapHint?: boolean;
  dropDragMode?: boolean;
  onRegionChange?: (coords: { lat: number; lng: number }) => void;
  skipAutoFit?: boolean;
  onRouteInfo?: (eta: string, dist: string) => void;
  onRoutes?: (routes: { fastest: RouteOption; shortest: RouteOption | null }) => void;
  selectedRouteType?: 'fastest' | 'shortest';
  rideType?: string;        // decides which road network to route on (see below)
  fitKey?: number;
  adjustOrigin?: { lat: number; lng: number } | null;
  fill?: boolean;           // flex:1 to fill parent instead of fixed height
  cameraTarget?: { lat: number; lng: number } | null; // fly camera here when set
  walkOrigin?: { lat: number; lng: number } | null;   // user GPS — draws dotted walk line to pickup
  pulsePickup?: boolean;    // pulsing sonar rings at pickup pin (matching mode)
  pulseSearching?: boolean; // expanding yellow sonar rings at pickup while searching for a driver
  pickupLabel?: string;     // address tag floated above the pickup pin
  dropLabel?: string;       // address tag floated above the drop pin
}

// ── Main component ────────────────────────────────────────────────────────────
export const LiveMap = memo(function LiveMap({
  pickupCoords, dropCoords,
  driverLat, driverLng,
  vehicleType = 'auto',
  userLat, userLng, userAccuracy,
  height = 240,
  mode = 'booking',
  showRoute = true,
  showTraffic = false,
  followDriver = false,
  nearbyDrivers = [],
  onMapPress,
  draggablePickup = false,
  onPickupDragEnd,
  draggableDrop = false,
  onDropDragEnd,
  showTapHint = false,
  dropDragMode = false,
  onRegionChange,
  skipAutoFit = false,
  onRouteInfo,
  onRoutes,
  selectedRouteType = 'fastest',
  rideType,
  fitKey = 0,
  adjustOrigin = null,
  fill = false,
  cameraTarget = null,
  walkOrigin = null,
  pulsePickup = false,
  pulseSearching = false,
  pickupLabel,
  dropLabel,
}: LiveMapProps) {
  const mapRef = useRef<MapView>(null);
  const prevPos = useRef<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState(0);
  const [draggingPickup, setDraggingPickup] = useState(false);
  const [draggingDrop, setDraggingDrop] = useState(false);

  // ── Measured viewport, and padding that can actually fit inside it ─────────
  // Every fitToCoordinates call used to pass a FIXED edgePadding of
  // {top:96, bottom:130} = 226dp. That is fine while the map is tall, but this
  // component is mounted at flex:1 ABOVE an in-flow drawer whose height is a
  // fraction of the window (0.40 / 0.72 / 0.80 / 0.94 in BookingScreen). On an
  // 800dp phone the browse state leaves the map only ~224dp — less than the
  // padding itself — so the fit had a negative content box and Google resolved
  // it by framing neither pin: the user saw a mid-route fragment with the
  // pickup and drop both off-screen.
  //
  // So the padding is now scaled down only when it would not fit, keeping at
  // least 40% of the viewport for actual content. When there IS room (compact
  // drawer and every other screen using this component) the numbers are
  // untouched, so existing framing is preserved exactly.
  const [viewSize, setViewSize] = useState({ h: 0, w: 0 });
  const fitPad = () => {
    const h = viewSize.h || (fill ? 320 : height);
    const w = viewSize.w || 360;
    let top = 96, bottom = 130, side = 60;
    const maxV = h * 0.6;
    if (top + bottom > maxV) {
      const k = maxV / (top + bottom);
      top = Math.round(top * k);
      bottom = Math.round(bottom * k);
    }
    if (side * 2 > w * 0.6) side = Math.round((w * 0.6) / 2);
    return { top, right: side, bottom, left: side };
  };

  // A settled height, updated only once layout has stopped changing for 250ms
  // and only when it moved meaningfully. The drawer animates open with a
  // spring, so onLayout fires continuously; re-fitting on every frame would
  // fight the animation and jitter the camera. Debouncing means exactly one
  // re-fit after the drawer comes to rest, which is what makes the pins come
  // back into frame when the sheet expands.
  const [settledH, setSettledH] = useState(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMapLayout = (e: any) => {
    const { height: h, width: w } = e.nativeEvent.layout;
    setViewSize(prev => (Math.abs(prev.h - h) > 4 || Math.abs(prev.w - w) > 4) ? { h, w } : prev);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      setSettledH(prev => (Math.abs(prev - h) > 40 ? h : prev));
    }, 250);
  };
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  // ── Marker snapshot refresh ───────────────────────────────────────────────
  // tracksViewChanges was `dragging || !!label`, which is permanently TRUE for
  // the whole session once a label exists — Android then re-snapshots the
  // marker view into a bitmap every frame, forever. An earlier comment here
  // called that cost negligible; it is not, it keeps the UI thread busy and
  // drains battery for as long as the booking screen is open.
  //
  // Both markers are fully static views (no Animated children), so their
  // snapshot only needs refreshing when their CONTENT changes: the label text,
  // or the drag state that restyles the ring/pin. Pulsing true for 700ms after
  // either changes gives the snapshot time to repaint, then goes false. The
  // drag dependency matters on its own — without it, ending a drag would leave
  // the dragging-styled bitmap cached.
  const [pickupTracking, setPickupTracking] = useState(true);
  const [dropTracking, setDropTracking] = useState(true);
  useEffect(() => {
    setPickupTracking(true);
    const id = setTimeout(() => setPickupTracking(false), 700);
    return () => clearTimeout(id);
  }, [pickupLabel, draggingPickup]);
  useEffect(() => {
    setDropTracking(true);
    const id = setTimeout(() => setDropTracking(false), 700);
    return () => clearTimeout(id);
  }, [dropLabel, draggingDrop]);

  const PULSE_STEPS = 20;
  const [pulsePhase, setPulsePhase] = useState(0);
  useEffect(() => {
    if (!pulsePickup || !pickupCoords) return;
    const id = setInterval(() => setPulsePhase(p => (p + 1) % PULSE_STEPS), 80);
    return () => clearInterval(id);
  }, [pulsePickup, pickupCoords?.lat, pickupCoords?.lng]);

  // Yellow sonar rings expanding from pickup during driver search
  const SEARCH_STEPS = 36;
  const [searchPhase, setSearchPhase] = useState(0);
  useEffect(() => {
    if (!pulseSearching || !pickupCoords) return;
    const id = setInterval(() => setSearchPhase(p => (p + 1) % SEARCH_STEPS), 90);
    return () => clearInterval(id);
  }, [pulseSearching, pickupCoords?.lat, pickupCoords?.lng]);

  // ── Drag-pin lift animation ───────────────────────────────────────────────
  const [isMapDragging, setIsMapDragging] = useState(false);
  const pinLift    = useRef(new Animated.Value(0)).current;
  const shadowScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!dropDragMode) { pinLift.setValue(0); shadowScale.setValue(1); return; }
    Animated.parallel([
      Animated.spring(pinLift,    { toValue: isMapDragging ? -20 : 0,   friction: 5, tension: 220, useNativeDriver: true }),
      Animated.spring(shadowScale,{ toValue: isMapDragging ?  0.6 : 1,  friction: 5, tension: 220, useNativeDriver: true }),
    ]).start();
  }, [isMapDragging, dropDragMode]);

  const driverRegion = useRef(
    new AnimatedRegion({
      latitude:  driverLat || pickupCoords?.lat || userLat || 26.8467,
      longitude: driverLng || pickupCoords?.lng || userLng || 80.9462,
      latitudeDelta: 0.01, longitudeDelta: 0.01,
    })
  ).current;

  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [etaText, setEtaText] = useState('');
  const [distText, setDistText] = useState('');

  // ── Travelling dot along booking route ───────────────────────────────────
  const dotProgressRef    = useRef(0);
  const remainingRef      = useRef<{ latitude: number; longitude: number }[]>([]);
  const [dotPos, setDotPos]   = useState<{ latitude: number; longitude: number } | null>(null);
  const [animDone, setAnimDone] = useState(false);
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!routeCoords.length || mode !== 'booking') {
      setDotPos(null); setAnimDone(false); dotProgressRef.current = 0; return;
    }
    setAnimDone(false);
    dotProgressRef.current = 0;
    const DURATION = 6000; // ms — slow, one-shot pickup→drop sweep
    const TICK     = 40;   // ms — ~25 fps
    const STEP     = TICK / DURATION;
    animTimerRef.current = setInterval(() => {
      dotProgressRef.current = Math.min(dotProgressRef.current + STEP, 1);
      if (dotProgressRef.current >= 1) {
        if (animTimerRef.current) clearInterval(animTimerRef.current);
        setDotPos(null);
        setAnimDone(true);
        return;
      }
      setDotPos(interpolateRoute(remainingRef.current, dotProgressRef.current));
    }, TICK);
    return () => {
      if (animTimerRef.current) clearInterval(animTimerRef.current);
      setDotPos(null);
    };
  }, [routeCoords.length, mode]);

  /* Chalne ka samay - GPS ki apni chaal ke hisaab se, tay 1400ms se nahi.

     Khabar har 3-4 second me aati hai, par gaadi 1.4 second me pahunch kar
     ruk jaati thi aur agli khabar tak khadi rehti - chal, ruk, chal, ruk.
     Do khabaron ka asli antar naap kar wahi samay diya jaata hai, to gaadi
     bina ruke chalti rehti hai.

     Hadd dono taraf hai: 700ms se kam par chaal jhatka lagti hai, aur 4s se
     zyada tab hota hai jab app peechhe padi thi - us lambe antar ko jyon ka
     tyon maan lene par gaadi minton tak rengti. */
  const lastMoveAt = useRef(0);
  const glideRef = useRef(1400);
  const [glideMs, setGlideMs] = useState(1400);

  // Smooth driver position + compute bearing
  useEffect(() => {
    if (driverLat == null || driverLng == null) return;
    if (prevPos.current) {
      const { lat: pl, lng: pg } = prevPos.current;
      if (Math.abs(driverLat - pl) > 0.00001 || Math.abs(driverLng - pg) > 0.00001) {
        setHeading(computeBearing(pl, pg, driverLat, driverLng));
      }
    }
    prevPos.current = { lat: driverLat, lng: driverLng };
    const now = Date.now();
    if (lastMoveAt.current) {
      const ms = Math.min(4000, Math.max(700, now - lastMoveAt.current));
      glideRef.current = ms;
      setGlideMs(ms);
    }
    lastMoveAt.current = now;
    driverRegion.timing({
      latitude: driverLat, longitude: driverLng,
      latitudeDelta: 0.01, longitudeDelta: 0.01,
      duration: glideRef.current, useNativeDriver: false,
    } as any).start();
  }, [driverLat, driverLng]);

  /* Marker ka bitmap kab dobara khiche.

     Ye hamesha `true` tha - yaani Android har frame par marker ki tasveer
     dobara banata rehta tha, tab bhi jab gaadi khadi ho. Wahi kharcha is file
     me pickup/drop marker ke liye pehle hi hata chuke hain.

     Bachcha sirf MUDNE par badalta hai, to sirf utni der khichwao. Uske baad
     bitmap wahi mudi hui tasveer pakde rehta hai. Khadi gaadi par - yaani jab
     user sabse zyada is screen ko dekhta hai - ab kuchh nahi khichta. */
  const [driverTracking, setDriverTracking] = useState(true);
  useEffect(() => {
    setDriverTracking(true);
    const id = setTimeout(() => setDriverTracking(false), glideMs + 400);
    return () => clearTimeout(id);
  }, [heading, vehicleType, glideMs]);

  // Camera follow driver in matching mode — fit driver + pickup so user sees driver approaching
  useEffect(() => {
    if (!followDriver || driverLat == null || driverLng == null || !mapRef.current) return;
    if (mode === 'matching' && pickupCoords) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: driverLat, longitude: driverLng },
          { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
        ],
        // Tighter than fitPad()'s base on purpose (driver+pickup is a short
        // hop and wants a closer camera), but still clamped to the viewport.
        { edgePadding: (() => { const p = fitPad(); return { ...p, top: Math.min(70, p.top), bottom: Math.min(70, p.bottom) }; })(), animated: true }
      );
    } else {
      mapRef.current.animateToRegion(
        { latitude: driverLat, longitude: driverLng, latitudeDelta: 0.006, longitudeDelta: 0.006 },
        900
      );
    }
  }, [followDriver, driverLat, driverLng, mode, pickupCoords?.lat, pickupCoords?.lng]);

  // Fetch route
  useEffect(() => {
    if (!showRoute) { setRouteCoords([]); setEtaText(''); setDistText(''); return; }
    let origin: string | null = null;
    let destination: string | null = null;

    if (mode === 'matching' && driverLat != null && driverLng != null && pickupCoords) {
      origin      = `${driverLat},${driverLng}`;
      destination = `${pickupCoords.lat},${pickupCoords.lng}`;
    } else if (pickupCoords && dropCoords) {
      origin      = `${pickupCoords.lat},${pickupCoords.lng}`;
      destination = `${dropCoords.lat},${dropCoords.lng}`;
    }
    if (!origin || !destination) { setRouteCoords([]); setEtaText(''); setDistText(''); return; }

    // Only the pickup→drop booking route needs alternatives (for the customer's
    // fastest/shortest choice). The driver-approach route (matching mode) stays
    // single — no choice to make there.
    const wantAlternatives = mode === 'booking';
    let cancelled = false;

    /* ── Which road network to route on ────────────────────────────────────
       Every route used to be requested as mode=driving — a CAR route — no
       matter what the customer had chosen. On a real Lucknow booking that made
       a 1.9 km trip come back as 4.2 km, because the car route is forced out
       onto Kursi Rd while the lanes an auto actually uses are excluded from
       Google's car graph. Google's own two-wheeler routing for the same pair
       returns 2.8 km.

       That was not only a wrong ETA. Fare is base + per-km × distance, so
       every bike and auto ride through a lane network was being quoted, and
       charged, on a car's detour. */
    const twoWheeler = mode === 'booking' && isNimble(rideType);

    const fmtKm  = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
    const fmtMin = (s: number) => {
      const min = Math.round(s / 60);
      return min >= 60 ? `${Math.floor(min / 60)} hr ${min % 60} min` : `${min} min${min === 1 ? '' : 's'}`;
    };

    /* Two shapes, one RouteOption. The Routes API returns metres and "534s" and
       has no formatted text at all, so the labels are built here rather than
       letting two code paths disagree about how a distance reads. */
    const fromRoutesApi = (r: any): RouteOption => ({
      polyline:    r.polyline?.encodedPolyline || '',
      distanceKm:  (r.distanceMeters ?? 0) / 1000,
      durationMin: parseFloat(String(r.duration || '0')) / 60,
      distText:    fmtKm(r.distanceMeters ?? 0),
      etaText:     fmtMin(parseFloat(String(r.duration || '0'))),
    });
    const fromDirections = (route: any): RouteOption => {
      const leg = route.legs?.[0];
      return {
        polyline:    route.overview_polyline?.points || '',
        distanceKm:  (leg?.distance?.value ?? 0) / 1000,
        durationMin: (leg?.duration?.value ?? 0) / 60,
        distText:    leg?.distance?.text || '',
        etaText:     leg?.duration?.text || '',
      };
    };

    const legacy = (): Promise<RouteOption[]> =>
      fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving${wantAlternatives ? '&alternatives=true' : ''}&key=${MAPS_KEY}`)
        .then(r => r.json())
        .then(d => (d.routes || []).map(fromDirections));

    const twoWheelerRoutes = (): Promise<RouteOption[]> =>
      fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': MAPS_KEY,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
        },
        body: JSON.stringify({
          origin:      { location: { latLng: { latitude: +origin!.split(',')[0],      longitude: +origin!.split(',')[1] } } },
          destination: { location: { latLng: { latitude: +destination!.split(',')[0], longitude: +destination!.split(',')[1] } } },
          travelMode: 'TWO_WHEELER',
          computeAlternativeRoutes: wantAlternatives,
        }),
      })
        .then(r => r.json())
        .then(d => (d.routes || []).map(fromRoutesApi))
        // Never leave the customer without a route: if two-wheeler routing is
        // unavailable — quota, billing, an API not enabled — fall back to the
        // car route rather than showing nothing.
        .then(list => list.length ? list : legacy())
        .catch(() => legacy());

    (twoWheeler ? twoWheelerRoutes() : legacy())
      .then((options: RouteOption[]) => {
        if (cancelled) return;
        if (!options.length) return;

        // Both APIs return their routes fastest-first.
        const fastest = options[0];
        let shortest: RouteOption | null = null;
        if (wantAlternatives && options.length > 1) {
          const cand = options.reduce((a, b) => b.distanceKm < a.distanceKm ? b : a);
          // Only offer it if it's meaningfully shorter AND not absurdly slower —
          // otherwise the "choice" is noise.
          const shorterEnough = cand.distanceKm <= fastest.distanceKm - 0.8 && cand.distanceKm <= fastest.distanceKm * 0.92;
          const notTooSlow    = cand.durationMin <= fastest.durationMin * 1.2;
          if (shorterEnough && notTooSlow && cand.polyline !== fastest.polyline) shortest = cand;
        }
        onRoutes?.({ fastest, shortest });

        // Draw whichever the parent has selected (defaults to fastest).
        const drawn = (selectedRouteType === 'shortest' && shortest) ? shortest : fastest;
        setRouteCoords(decodePolyline(drawn.polyline));
        setEtaText(drawn.etaText); setDistText(drawn.distText);
        onRouteInfo?.(drawn.etaText, drawn.distText);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [
    pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng,
    showRoute, mode, selectedRouteType, rideType,   // switching bike↔car changes the road network
    driverLat != null ? Math.round(driverLat * 200) / 200 : null,
    driverLng != null ? Math.round(driverLng * 200) / 200 : null,
  ]);

  // Zoom tight to pickup while searching — sonar animation is at pickup, needs close view
  useEffect(() => {
    if (!pulseSearching || !pickupCoords || !mapRef.current) return;
    const t = setTimeout(() => {
      mapRef.current?.animateToRegion({
        latitude:      pickupCoords.lat,
        longitude:     pickupCoords.lng,
        latitudeDelta:  0.005,
        longitudeDelta: 0.005,
      }, 900);
    }, 400);
    return () => clearTimeout(t);
  }, [pulseSearching, pickupCoords?.lat, pickupCoords?.lng]);

  // Fit map — uses sampled route polyline when available for tighter framing
  useEffect(() => {
    if (followDriver || skipAutoFit || pulseSearching || !mapRef.current) return;
    let coords: { latitude: number; longitude: number }[] = [];
    const routePts = remainingRef.current;
    if (routePts.length > 1) {
      // Sample up to 30 points from the polyline so curves are fully visible
      const stride = Math.max(1, Math.floor(routePts.length / 30));
      coords = routePts.filter((_, i) => i % stride === 0);
      const last = routePts[routePts.length - 1];
      if (coords[coords.length - 1] !== last) coords.push(last);
    } else {
      if (pickupCoords) coords.push({ latitude: pickupCoords.lat, longitude: pickupCoords.lng });
      if (dropCoords)   coords.push({ latitude: dropCoords.lat,   longitude: dropCoords.lng   });
      if (driverLat != null && driverLng != null) coords.push({ latitude: driverLat, longitude: driverLng });
      // On the editor page (pickup chosen, drop not yet) keep the user's
      // actual GPS position in frame alongside the selected pickup pin —
      // without this, the camera jumped to frame ONLY the pickup pin the
      // moment it was chosen, and "where am I" vs "where am I pickup up
      // from" were never visible together.
      if (mode === 'booking' && pickupCoords && !dropCoords && userLat != null) {
        coords.push({ latitude: userLat, longitude: userLng! });
      }
      if (!coords.length && userLat != null) coords.push({ latitude: userLat!, longitude: userLng! });
    }
    if (coords.length > 0) {
      mapRef.current.fitToCoordinates(withMinSpan(coords), {
        edgePadding: fitPad(),
        animated: true,
      });
    }
    // settledH: re-run once the drawer has finished resizing the map, so the
    // framing is recomputed against the viewport that actually exists now.
  }, [pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng, driverLat, driverLng, followDriver, fitKey, userLat, userLng, mode, settledH]);

  const recenter = () => {
    if (!mapRef.current) return;
    // Route visible → fit the full polyline
    if (remainingRef.current.length > 1) {
      const pts = remainingRef.current;
      const stride = Math.max(1, Math.floor(pts.length / 25));
      const sampled = pts.filter((_, i) => i % stride === 0);
      if (sampled[sampled.length - 1] !== pts[pts.length - 1]) sampled.push(pts[pts.length - 1]);
      mapRef.current.fitToCoordinates(withMinSpan(sampled), {
        edgePadding: fitPad(), animated: true,
      });
      return;
    }
    // Markers only → fit to them
    if (pickupCoords && dropCoords) {
      mapRef.current.fitToCoordinates(withMinSpan([
        { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
        { latitude: dropCoords.lat,   longitude: dropCoords.lng   },
      ]), { edgePadding: fitPad(), animated: true });
      return;
    }
    // Fallback → center on user/driver
    const lat = driverLat ?? userLat ?? pickupCoords?.lat ?? 26.8467;
    const lng = driverLng ?? userLng ?? pickupCoords?.lng ?? 80.9462;
    mapRef.current.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.018, longitudeDelta: 0.018 },
      700
    );
  };

  // Fly camera to cameraTarget (e.g. entering adjust mode — center on original drop)
  useEffect(() => {
    if (!cameraTarget || !mapRef.current) return;
    const t = setTimeout(() => {
      mapRef.current?.animateToRegion({
        latitude: cameraTarget.lat,
        longitude: cameraTarget.lng,
        latitudeDelta: 0.036,   // ~4km view so 2km green circle is visible
        longitudeDelta: 0.036,
      }, 650);
    }, 180);
    return () => clearTimeout(t);
  }, [cameraTarget?.lat, cameraTarget?.lng]);

  const centerLat = pickupCoords?.lat || userLat || 26.8467;
  const centerLng = pickupCoords?.lng || userLng || 80.9462;

  // Inride route: split into completed (green) + remaining (pink) based on driver proximity
  let completedCoords: { latitude: number; longitude: number }[] = [];
  let remainingCoords = routeCoords;
  // Keep remainingRef in sync so the dot interval closure always has fresh coords
  remainingRef.current = remainingCoords;
  if (mode === 'inride' && routeCoords.length > 1 && driverLat != null && driverLng != null) {
    let closestIdx = 0;
    let minDist = Infinity;
    routeCoords.forEach((pt, i) => {
      const d = Math.hypot(pt.latitude - driverLat, pt.longitude - driverLng);
      if (d < minDist) { minDist = d; closestIdx = i; }
    });
    completedCoords = routeCoords.slice(0, closestIdx + 1);
    remainingCoords = routeCoords.slice(closestIdx);
  }

  // Booking route split — green (ahead of arrow) + pink (behind arrow)
  let bookingBehind: { latitude: number; longitude: number }[] = [];
  let bookingAhead:  { latitude: number; longitude: number }[] = routeCoords;
  let arrowBearing = 0;
  if (mode === 'booking' && dotPos && routeCoords.length > 1) {
    const splitIdx = Math.max(0, Math.floor(dotProgressRef.current * (routeCoords.length - 1)));
    bookingBehind  = routeCoords.slice(0, splitIdx + 1);
    bookingAhead   = routeCoords.slice(splitIdx);
    const nextT    = Math.min(dotProgressRef.current + 0.025, 1);
    const nextPt   = interpolateRoute(routeCoords, nextT);
    arrowBearing   = computeBearing(dotPos.latitude, dotPos.longitude, nextPt.latitude, nextPt.longitude);
  }

  return (
    <View
      onLayout={onMapLayout}
      style={fill ? { flex: 1, width: '100%', overflow: 'hidden' } : { height, width: '100%', overflow: 'hidden' }}
    >
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={{ latitude: centerLat, longitude: centerLng, latitudeDelta: 0.036, longitudeDelta: 0.036 }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsTraffic={showTraffic}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        // 3D building extrusions and indoor floor plans add depth and texture
        // that fight the route for attention at street zoom. The customMapStyle
        // above cannot switch either of them off — they are MapView props.
        // showsPointsOfInterest is the iOS equivalent of the poi label rules in
        // MAP_STYLE, which Apple Maps ignores.
        showsBuildings={false}
        showsIndoors={false}
        showsPointsOfInterest={false}
        customMapStyle={MAP_STYLE}
        onPress={onMapPress
          ? (e) => onMapPress({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })
          : undefined}
        onRegionChange={(region) => {
          if (dropDragMode) setIsMapDragging(true);
          onRegionChange?.({ lat: region.latitude, lng: region.longitude });
        }}
        onRegionChangeComplete={(region) => {
          if (dropDragMode) {
            setIsMapDragging(false);
            onRegionChange?.({ lat: region.latitude, lng: region.longitude });
          }
        }}
      >
        {/* Completed route segment (inride only) */}
        {completedCoords.length > 1 && (
          <Polyline coordinates={completedCoords} strokeColor="rgba(5,150,105,0.5)" strokeWidth={5} lineCap="round" />
        )}

        {/* Booking: black trail behind arrow — hidden once animation finishes */}
        {mode === 'booking' && !animDone && bookingBehind.length > 1 && (
          <Polyline coordinates={bookingBehind} strokeColor="#1A1A1A" strokeWidth={5} lineCap="round" />
        )}
        {/* Booking: plum route ahead of arrow — hidden once animation finishes */}
        {mode === 'booking' && !animDone && bookingAhead.length > 1 && (
          <Polyline coordinates={bookingAhead} strokeColor={ROUTE_CORE} strokeWidth={5} lineCap="round" />
        )}
        {/* Booking: once the arrow animation finishes, the route stays on the
             map as a plain plum line (previously nothing replaced the arrow
             trail, so the route visually disappeared) with a small km tag
             at the midpoint. */}
        {mode === 'booking' && animDone && routeCoords.length > 1 && (
          <>
            {/* Two lines, not one: a wider dark CASING underneath and a
                brighter core on top. This is how every real nav map draws a
                route, and the reason is practical — a single flat stroke gets
                visually lost wherever it crosses a white road or a pale block,
                because it has no edge to separate it from what's beneath. The
                casing gives it that edge, so the route reads as one continuous
                ribbon the whole way instead of breaking up at junctions. */}
            <Polyline coordinates={routeCoords} strokeColor={ROUTE_CASING} strokeWidth={8} lineCap="round" lineJoin="round" />
            <Polyline coordinates={routeCoords} strokeColor={ROUTE_CORE} strokeWidth={4.5} lineCap="round" lineJoin="round" />
            {(() => {
              const mid = routeCoords[Math.floor(routeCoords.length / 2)];
              if (!mid || !distText) return null;
              return (
                <Marker coordinate={mid} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={5}>
                  <View style={{
                    backgroundColor: '#fff', borderRadius: 10,
                    paddingHorizontal: 8, paddingVertical: 4,
                    borderWidth: 1.5, borderColor: ROUTE_CORE,
                    elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
                  }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '900', color: ROUTE_INK }}>{distText}</Text>
                  </View>
                </Marker>
              );
            })()}
          </>
        )}

        {/* Non-booking route */}
        {mode !== 'booking' && remainingCoords.length > 1 && (
          <Polyline
            coordinates={remainingCoords}
            strokeColor={mode === 'matching' ? C.pink : C.green}
            strokeWidth={4}
            lineCap="round"
          />
        )}

        {/* 800m destination zone around drop-off */}
        {dropCoords && mode === 'booking' && (
          <Circle
            center={{ latitude: dropCoords.lat, longitude: dropCoords.lng }}
            radius={800}
            strokeColor="rgba(34,197,94,0.55)"
            fillColor="rgba(34,197,94,0.07)"
            strokeWidth={1.5}
          />
        )}

        {/* Travelling arrow — green circle with directional arrow, rotates to face route direction */}
        {dotPos && !animDone && mode === 'booking' && routeCoords.length > 1 && (
          <Marker
            coordinate={dotPos}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={arrowBearing}
            flat
            tracksViewChanges={false}
            zIndex={25}
          >
            <View style={{
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: C.green,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2.5, borderColor: '#fff',
              elevation: 8,
            }}>
              <Ionicons name="arrow-up" size={14} color="#fff" />
            </View>
          </Marker>
        )}

        {/* ── Walk-to-pickup dotted line (user GPS → pickup point) ─────────── */}
        {walkOrigin && pickupCoords && (() => {
          const distM = haversineM(walkOrigin.lat, walkOrigin.lng, pickupCoords.lat, pickupCoords.lng);
          if (distM < 25) return null;
          const midLat = (walkOrigin.lat + pickupCoords.lat) / 2;
          const midLng = (walkOrigin.lng + pickupCoords.lng) / 2;
          // key forces Marker remount when midpoint shifts ~50m so chip re-renders on Android
          const chipKey = `wc-${Math.round(midLat * 2000)}-${Math.round(midLng * 2000)}`;
          return (
            <>
              <Polyline
                coordinates={[
                  { latitude: walkOrigin.lat,   longitude: walkOrigin.lng   },
                  { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
                ]}
                strokeColor="#3B82F6"
                strokeWidth={2.5}
                lineDashPattern={[9, 7]}
                lineCap="butt"
              />
              <Marker
                key={chipKey}
                coordinate={{ latitude: midLat, longitude: midLng }}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={false}
              >
                <WalkChip distM={distM} />
              </Marker>
            </>
          );
        })()}

        {/* User accuracy ring */}
        {userLat != null && userLng != null && userAccuracy != null && userAccuracy > 5 && (
          <Circle
            center={{ latitude: userLat, longitude: userLng }}
            radius={userAccuracy}
            fillColor="rgba(255,45,120,0.06)"
            strokeColor="rgba(255,45,120,0.25)"
            strokeWidth={1.5}
          />
        )}

        {/* "You" GPS marker — blue dot with label */}
        {userLat != null && userLng != null && (
          <Marker
            coordinate={{ latitude: userLat, longitude: userLng }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
            zIndex={5}
          >
            <YouMarker />
          </Marker>
        )}

        {/* Nearby unbooked drivers (booking mode only, max 20) */}
        {mode === 'booking' && nearbyDrivers.slice(0, 20).map((nd, i) => (
          <Marker
            key={`nd-${i}`}
            coordinate={{ latitude: nd.lat, longitude: nd.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <NearbyDriverMarker vehicleType={nd.vehicleType} />
          </Marker>
        ))}

        {/* Yellow expanding sonar rings — searching for driver */}
        {pickupCoords && pulseSearching && (() => {
          const t  = (phase: number) => phase / SEARCH_STEPS;
          const t1 = t(searchPhase);
          const t2 = t((searchPhase + Math.floor(SEARCH_STEPS / 3)) % SEARCH_STEPS);
          const t3 = t((searchPhase + Math.floor((SEARCH_STEPS * 2) / 3)) % SEARCH_STEPS);
          const r  = (tv: number) => Math.max(8, 8 + 280 * tv);
          const o  = (tv: number) => parseFloat((0.85 * (1 - tv)).toFixed(2));
          const fo = (tv: number) => parseFloat((0.07 * (1 - tv)).toFixed(3));
          return (
            <>
              <Circle center={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }} radius={r(t1)} strokeColor={`rgba(255,210,0,${o(t1)})`} fillColor={`rgba(255,210,0,${fo(t1)})`} strokeWidth={2.5} zIndex={1} />
              <Circle center={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }} radius={r(t2)} strokeColor={`rgba(255,210,0,${o(t2)})`} fillColor={`rgba(255,210,0,${fo(t2)})`} strokeWidth={2.5} zIndex={1} />
              <Circle center={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }} radius={r(t3)} strokeColor={`rgba(255,210,0,${o(t3)})`} fillColor={`rgba(255,210,0,${fo(t3)})`} strokeWidth={2.5} zIndex={1} />
            </>
          );
        })()}

        {/* Pulsing sonar rings at pickup — matching mode only */}
        {mode === 'matching' && pickupCoords && pulsePickup && (() => {
          const t1 = pulsePhase / PULSE_STEPS;
          const t2 = ((pulsePhase + PULSE_STEPS / 2) % PULSE_STEPS) / PULSE_STEPS;
          const r  = (t: number) => Math.max(4, 4 + 38 * t);
          const o  = (t: number) => parseFloat((0.75 * (1 - t)).toFixed(2));
          return (
            <>
              <Circle center={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }} radius={r(t1)} strokeColor={`rgba(5,150,105,${o(t1)})`} fillColor="transparent" strokeWidth={3} zIndex={2} />
              <Circle center={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }} radius={r(t2)} strokeColor={`rgba(5,150,105,${o(t2)})`} fillColor="transparent" strokeWidth={3} zIndex={2} />
            </>
          );
        })()}

        {/* Pickup marker */}
        {pickupCoords && (
          <Marker
            coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }}
            // With a label stacked in-flow above the pin, the true circle is no
            // longer at the vertical center of the whole rendered view — it's
            // at the very bottom of it. Anchor at the bottom in that case so
            // the pin (not empty space where the old absolute-positioned label
            // used to float) still points at the exact coordinate; falls back
            // to true center when there's no label to stack above it.
            anchor={{ x: 0.5, y: pickupLabel ? 1 : 0.5 }}
            // tracksViewChanges=false caches the marker's native snapshot after
            // its first paint — if the label text wasn't ready on that very
            // first render (or changes later), it silently never appears. The
            // 700ms pulse above covers that without leaving tracking on for the
            // whole session (see the pickupTracking comment).
            tracksViewChanges={draggingPickup || pickupTracking}
            draggable={draggablePickup}
            onDragStart={() => setDraggingPickup(true)}
            onDragEnd={e => {
              setDraggingPickup(false);
              onPickupDragEnd?.({
                lat: e.nativeEvent.coordinate.latitude,
                lng: e.nativeEvent.coordinate.longitude,
              });
            }}
          >
            <PickupMarker dragging={draggingPickup} label={pickupLabel} />
          </Marker>
        )}

        {/* Drop marker */}
        {dropCoords && (
          <Marker
            coordinate={{ latitude: dropCoords.lat, longitude: dropCoords.lng }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={draggingDrop || dropTracking}
            draggable={draggableDrop}
            onDragStart={() => setDraggingDrop(true)}
            onDragEnd={e => {
              setDraggingDrop(false);
              onDropDragEnd?.({
                lat: e.nativeEvent.coordinate.latitude,
                lng: e.nativeEvent.coordinate.longitude,
              });
            }}
          >
            <DropMarker dragging={draggingDrop} label={dropLabel} />
          </Marker>
        )}

        {/* Animated driver marker — tracksViewChanges MUST stay true here: this
            marker's vehicle icon rotates continuously (heading changes every
            GPS tick), and react-native-maps snapshots a marker's children into
            a static native bitmap once tracksViewChanges is false, so the
            rotation would silently stop updating on Android. Safe to leave on
            since there's only ever one assigned-driver marker on screen. */}
        {driverLat != null && driverLng != null && (
          <Marker.Animated
            coordinate={driverRegion as any}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={driverTracking}
          >
            <DriverMarker
              vehicleType={vehicleType}
              heading={heading}
              turnMs={glideMs}
              onReady={() => {
                setDriverTracking(true);
                setTimeout(() => setDriverTracking(false), 600);
              }}
            />
          </Marker.Animated>
        )}
      </MapView>

      {/* Animated drop pin — lifts on map drag, tip stays at map center */}
      {dropDragMode && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          {/* Pin — marginBottom: 58 puts the tail tip at exact map center */}
          <Animated.View style={{ alignItems: 'center', marginBottom: 58, transform: [{ translateY: pinLift }] }}>
            <View style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: isMapDragging ? '#FF4D96' : C.pink,
              alignItems: 'center', justifyContent: 'center',
              elevation: isMapDragging ? 18 : 9,
              shadowColor: C.pink,
              shadowOpacity: isMapDragging ? 0.85 : 0.50,
              shadowRadius: isMapDragging ? 20 : 10,
              borderWidth: 3, borderColor: '#fff',
            }}>
              <View style={{ width: 11, height: 11, borderRadius: 5.5, backgroundColor: '#fff' }} />
            </View>
            {/* Tail — 12px visual, 0 layout height */}
            <View style={{
              width: 0, height: 0,
              borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 12,
              borderLeftColor: 'transparent', borderRightColor: 'transparent',
              borderTopColor: isMapDragging ? '#FF4D96' : C.pink,
              marginTop: -1,
            }} />
          </Animated.View>
          {/* Ground shadow — stays at map center, shrinks when pin is lifted */}
          <Animated.View style={{
            position: 'absolute',
            width: 24, height: 10, borderRadius: 12,
            backgroundColor: 'rgba(0,0,0,0.22)',
            transform: [{ scale: shadowScale }],
          }} />
        </View>
      )}

      {/* ETA chip — top-left. Hidden in booking (shown in bottom sheet instead) and
          in matching (overlapped the back button; the "Arriving NOW" card below
          already covers driver ETA there, making the chip redundant clutter). */}
      {etaText && mode === 'inride' ? <EtaChip eta={etaText} distance={distText} /> : null}

      {/* Drag hint */}
      <DragHint visible={dropDragMode} isAdjust={!!adjustOrigin} />

      {/* Walk-to-pickup hint pill */}
      {walkOrigin && pickupCoords && mode !== 'inride' && (() => {
        const distM = haversineM(walkOrigin.lat, walkOrigin.lng, pickupCoords.lat, pickupCoords.lng);
        if (distM < 25) return null;
        const dist = distM < 1000 ? `${Math.round(distM)}m` : `${(distM / 1000).toFixed(1)}km`;
        const mins = Math.max(1, Math.ceil(distM / 83));
        return (
          <View
            style={{ position: 'absolute', bottom: 54, left: 16, right: 16, alignItems: 'center' }}
            pointerEvents="none"
          >
            <View style={{
              backgroundColor: 'rgba(29,78,216,0.92)',
              borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8,
              flexDirection: 'row', alignItems: 'center', gap: 7,
              elevation: 6,
              shadowColor: '#1D4ED8', shadowOpacity: 0.35, shadowRadius: 10,
            }}>
              <Text style={{ fontSize: 15 }}>🚶</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                Walk {dist} to your pickup · {mins} min
              </Text>
            </View>
          </View>
        );
      })()}

      {/* Re-center button — bottom right */}
      <RecenterBtn onPress={recenter} />
    </View>
  );
});

// ── Sppero brand map style — clean light, minimal clutter ────────────────────
const MAP_STYLE = [
  { elementType: 'geometry',                              stylers: [{ color: '#F7F8FA' }] },
  { elementType: 'labels.text.stroke',                    stylers: [{ color: '#F7F8FA' }, { weight: 3 }] },
  { elementType: 'labels.text.fill',                      stylers: [{ color: '#374151' }] },

  // Roads — clean white/light grey
  { featureType: 'road',          elementType: 'geometry',        stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road',          elementType: 'geometry.stroke',  stylers: [{ color: '#DDE1EA' }, { weight: 0.8 }] },
  { featureType: 'road.highway',  elementType: 'geometry',        stylers: [{ color: '#EFF3FB' }] },
  { featureType: 'road.highway',  elementType: 'geometry.stroke',  stylers: [{ color: '#C8D3E8' }, { weight: 1.2 }] },
  { featureType: 'road',          elementType: 'labels.icon',     stylers: [{ visibility: 'off' }] },

  // Water — soft blue
  { featureType: 'water',         elementType: 'geometry',        stylers: [{ color: '#CAE0F5' }] },
  { featureType: 'water',         elementType: 'labels.text.fill', stylers: [{ color: '#5A9FD4' }] },

  // Landscape base — very light cool grey
  { featureType: 'landscape',     elementType: 'geometry',        stylers: [{ color: '#EDEEF2' }] },

  // Parks & green spaces — visible, neutral grey instead of green
  { featureType: 'poi.park',      elementType: 'geometry',        stylers: [{ color: '#DDDFE3' }] },
  { featureType: 'poi.park',      elementType: 'labels.text.fill', stylers: [{ color: '#6B7280' }] },
  { featureType: 'poi.park',                                       stylers: [{ visibility: 'on' }] },
  { featureType: 'landscape.natural', elementType: 'geometry',    stylers: [{ color: '#E3E5E9' }] },

  // Other POI — hidden entirely, LABELS INCLUDED.
  //
  // This previously only switched off `poi` GEOMETRY, which does nothing about
  // the label text or its coloured icon — so attractions, temples, hospitals
  // and schools kept printing their names and pins right across the route
  // ("Regional Science City", "The Residency", "Balaji Mandir", a red H).
  // Those are Google's POIs, not ours: they compete with the pickup and drop
  // pins, which are the only two places on this screen the rider cares about.
  { featureType: 'poi',           elementType: 'labels',           stylers: [{ visibility: 'off' }] },
  { featureType: 'poi',           elementType: 'geometry',         stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business',                                   stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',                                        stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel',                     stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  // Parks stay as soft grey SHAPES with no label — they give the map a sense
  // of place without adding another word to read.
  { featureType: 'poi.park',      elementType: 'labels',           stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park',      elementType: 'geometry',         stylers: [{ visibility: 'on' }, { color: '#DFE6E0' }] },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Driver marker — real top-down vehicle shape, no circle frame, just a
  // grounding shadow so it reads as sitting on the map surface.
  /* driverOuter / driverShadow / nearbyOuter yahan se hata diye gaye.
     Ek hi tay naap sab gaadiyon par chipka tha (44x70), aur ghoomti hui car
     us dabbe se bahar nikal kar KAT jaati thi. Ab har gaadi apna dabba khud
     naapti hai - dekho vehicleArtBox(). */


  // Pickup — green ring + white center dot
  pickupGlow: {
    position: 'absolute', width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(5,150,105,0.16)',
  },
  pickupRing: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: C.green, shadowOpacity: 0.35, shadowRadius: 7,
    borderWidth: 3, borderColor: C.green,
  },
  pickupDot: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center',
  },
  pickupDotShine: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.75)',
    marginBottom: 2.5, marginLeft: -1.5,
  },

  // Drop — pink teardrop pin
  dropOuter: { alignItems: 'center' },
  dropPin: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: C.pink, shadowOpacity: 0.45, shadowRadius: 8,
    borderWidth: 2, borderColor: '#fff',
  },
  dropHole: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  dropTail: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: C.pink, marginTop: -1,
  },

  // ETA chip
  etaChip: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', gap: 6,
  },
  etaDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.green },
  etaTime: { fontSize: 13, fontWeight: '900', color: C.text },
  etaSep: { width: 1, height: 12, backgroundColor: C.glassBorder },
  etaDist: { fontSize: 12, color: C.textMuted, fontWeight: '600' },

  // Tap hint
  tapHint: {
    position: 'absolute', bottom: 46, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(15,23,42,0.72)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  tapHintTxt: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Re-center button
  recenterBtn: {
    position: 'absolute', bottom: 10, right: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: C.pink, shadowOpacity: 0.18, shadowRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,45,120,0.15)',
  },
});
