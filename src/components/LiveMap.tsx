import { useRef, useEffect, useState, memo } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, Circle, AnimatedRegion, PROVIDER_GOOGLE } from 'react-native-maps';
import Svg, { Path, Rect, Ellipse, Circle as SvgCircle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { MAPS_KEY } from '../constants';
import { C } from '../styles';

// A single Google Directions route option, surfaced to the parent so the
// customer can choose between (e.g.) fastest and shortest.
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

// ── Top-down vehicle silhouettes — drawn nose-up (0° = north), rotated to
// heading at render time. No badge/circle frame — just the vehicle + a soft
// grounding shadow, like a real overhead view. Detailed enough to actually
// read as "car" / "bike" / "auto" at a glance (glossy gradient body, lights,
// mirrors) — a flat silhouette alone was too abstract to recognize. ─────────
function CarShape({ bodyLight, bodyDark, roof }: { bodyLight: string; bodyDark: string; roof: string }) {
  const gid = 'car' + bodyDark.replace('#', '');
  return (
    <Svg width={38} height={66} viewBox="0 0 38 66">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={bodyLight} />
          <Stop offset="1" stopColor={bodyDark} />
        </LinearGradient>
      </Defs>
      {/* Wheel-arch shadows — drawn first so the body covers their inner
          half and only a dark sliver peeks past each corner, hinting at
          tires under the bodywork instead of a perfectly smooth silhouette. */}
      <Ellipse cx="4"  cy="18" rx="2.6" ry="4.2" fill="#111827" opacity={0.35} />
      <Ellipse cx="34" cy="18" rx="2.6" ry="4.2" fill="#111827" opacity={0.35} />
      <Ellipse cx="4"  cy="48" rx="2.6" ry="4.2" fill="#111827" opacity={0.35} />
      <Ellipse cx="34" cy="48" rx="2.6" ry="4.2" fill="#111827" opacity={0.35} />
      {/* Body — rounded, tapered hood */}
      <Path d="M19,2 C9,2 4,7 4,15 L4,51 C4,59 9,64 19,64 C29,64 34,59 34,51 L34,15 C34,7 29,2 19,2 Z" fill={`url(#${gid})`} stroke="#fff" strokeWidth="1.5" />
      {/* Hood gloss highlight */}
      <Path d="M19,4 C11,4 7,7.5 6,14 L32,14 C31,7.5 27,4 19,4 Z" fill="rgba(255,255,255,0.28)" />
      {/* Front windshield — trapezoid, wide at hood */}
      <Path d="M8,16 L30,16 L26,26 L12,26 Z" fill="#BFE3FF" opacity={0.92} />
      <Path d="M8,16 L30,16 L26,26 L12,26 Z" fill="none" stroke="#8FC7F2" strokeWidth="0.6" opacity={0.5} />
      {/* Wiper hint */}
      <Path d="M13,24.5 L25,24.5" stroke="#6B93B8" strokeWidth="0.6" opacity={0.5} />
      {/* Roof — thin brand pink trim along the edge, a subtle "ours" touch
          instead of a plain border (cars don't get a full livery stripe
          like the 3-wheelers — that would look pasted-on, not premium). */}
      <Rect x="8" y="27" width="22" height="18" rx="5" fill={roof} opacity={0.96} />
      <Rect x="8" y="27" width="22" height="18" rx="5" fill="none" stroke={C.pink} strokeWidth="0.9" opacity={0.55} />
      <Rect x="16" y="30" width="6" height="12" rx="3" fill="rgba(255,255,255,0.10)" />
      {/* Door-line creases */}
      <Path d="M6,30 L6,42"   stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
      <Path d="M32,30 L32,42" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" />
      {/* Rear windshield */}
      <Path d="M12,46 L26,46 L30,55 L8,55 Z" fill="#BFE3FF" opacity={0.75} />
      {/* Headlights */}
      <Ellipse cx="9"  cy="7" rx="2.2" ry="2.8" fill="#FEF9C3" stroke="#F5D90A" strokeWidth="0.5" />
      <Ellipse cx="29" cy="7" rx="2.2" ry="2.8" fill="#FEF9C3" stroke="#F5D90A" strokeWidth="0.5" />
      {/* Taillights */}
      <Ellipse cx="9"  cy="61" rx="2" ry="2.4" fill="#FCA5A5" stroke="#EF4444" strokeWidth="0.5" />
      <Ellipse cx="29" cy="61" rx="2" ry="2.4" fill="#FCA5A5" stroke="#EF4444" strokeWidth="0.5" />
      {/* Side mirrors */}
      <Path d="M1,21 L5,20 L5,26 L1,25 Z" fill={roof} />
      <Path d="M37,21 L33,20 L33,26 L37,25 Z" fill={roof} />
      {/* Slight side-angle shading — shadow sliver down the roof/rear right
          edge, matching the depth treatment on the other vehicle icons. */}
      <Path d="M33,28 C34.3,36 34.3,43 33,50 L31,49.3 C32.2,43 32.2,36 31,28.6 Z" fill="rgba(0,0,0,0.14)" />
    </Svg>
  );
}
function BikeShape({ tankLight, tankDark, frame }: { tankLight: string; tankDark: string; frame: string }) {
  const gid = 'bk' + tankDark.replace('#', '');
  return (
    <Svg width={28} height={58} viewBox="0 0 28 58">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tankLight} />
          <Stop offset="1" stopColor={tankDark} />
        </LinearGradient>
      </Defs>
      {/* Front wheel */}
      <Ellipse cx="14" cy="8"  rx="4.4" ry="6.6" fill="#111827" />
      <Ellipse cx="14" cy="8"  rx="2"   ry="3.2" fill="#4B5563" />
      {/* Handlebar — wide, the unmistakable two-wheeler cue — brand dark pink */}
      <Rect x="0.5" y="11" width="27" height="3" rx="1.5" fill={C.pinkDark} />
      {/* Mirrors on the bar ends */}
      <SvgCircle cx="2"  cy="9.4" r="2.1" fill={C.pinkDark} />
      <SvgCircle cx="26" cy="9.4" r="2.1" fill={C.pinkDark} />
      {/* Headlight, mounted just behind the bar */}
      <Ellipse cx="14" cy="17.5" rx="3.2" ry="2.8" fill={frame} />
      <Ellipse cx="14" cy="17"   rx="1.5" ry="1.3" fill="#FEF9C3" />
      {/* Fuel tank — glossy teardrop */}
      <Path d="M14,21 C21,21 22,27 19.5,32 C17.7,36.5 10.3,36.5 8.5,32 C6,27 7,21 14,21 Z" fill={`url(#${gid})`} stroke="#fff" strokeWidth="1" />
      <Path d="M10.5,24.5 C9.3,27.5 9.3,30 10.5,32" stroke="rgba(255,255,255,0.5)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* Slight side-angle shading — a shadow sliver down the right edge of
          the tank/seat so the icon reads with a touch of 3D tilt instead of
          a flat cutout, like it's lit from the left. */}
      <Path d="M18,23 C19.4,27 19,30.8 17.6,34 L16,33.4 C17.2,30.2 17.5,26.8 16.3,23.6 Z" fill="rgba(0,0,0,0.16)" />
      {/* Seat — longer two-up seat, brand plum */}
      <Rect x="10" y="33" width="8" height="16" rx="3.4" fill={C.plum} />
      <Rect x="15.4" y="34" width="2" height="14" rx="1" fill="rgba(0,0,0,0.16)" />
      {/* Rear fender */}
      <Path d="M8,48 Q14,45 20,48" stroke={frame} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* Rear wheel */}
      <Ellipse cx="14" cy="50" rx="4.8" ry="7.2" fill="#111827" />
      <Ellipse cx="14" cy="50" rx="2.2" ry="3.4" fill="#4B5563" />
    </Svg>
  );
}
function AutoShape({ bodyLight, bodyDark, roof, electric }: { bodyLight: string; bodyDark: string; roof: string; electric?: boolean }) {
  const gid = 'at' + bodyDark.replace('#', '');
  return (
    <Svg width={36} height={50} viewBox="0 0 36 50">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={bodyLight} />
          <Stop offset="1" stopColor={bodyDark} />
        </LinearGradient>
      </Defs>
      {/* Rear wheels — with rim highlight like the two-wheelers, instead of
          a flat solid disc */}
      <Ellipse cx="5"  cy="40" rx="3.8" ry="5.6" fill="#111827" />
      <Ellipse cx="5"  cy="40" rx="1.7" ry="2.6" fill="#4B5563" />
      <Ellipse cx="31" cy="40" rx="3.8" ry="5.6" fill="#111827" />
      <Ellipse cx="31" cy="40" rx="1.7" ry="2.6" fill="#4B5563" />
      {/* Mudguard arcs over the rear wheels */}
      <Path d="M2,36 Q5,33 8,36"  stroke="#1F2937" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity={0.7} />
      <Path d="M28,36 Q31,33 34,36" stroke="#1F2937" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity={0.7} />
      {/* Cabin — wide rear tapering to a single front wheel, the classic
          3-wheeler silhouette that's unmistakable even simplified. */}
      <Path d="M6,44 L30,44 L26,13 Q18,4 10,13 Z" fill={`url(#${gid})`} stroke="#1F2937" strokeWidth="1.2" />
      <Path d="M10,14 Q18,6 26,14" stroke="rgba(255,255,255,0.4)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* Roof canopy */}
      <Path d="M9.5,15 Q18,7 26.5,15 L25,24 L11,24 Z" fill={roof} opacity={0.96} />
      <Path d="M12,14.2 Q18,9.5 24,14.2" stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none" />
      {/* Side pillars */}
      <Rect x="8.5"  y="15" width="1.8" height="9.5" fill="#111827" opacity={0.55} />
      <Rect x="25.7" y="15" width="1.8" height="9.5" fill="#111827" opacity={0.55} />
      {/* Front wheel — with rim highlight */}
      <Ellipse cx="18" cy="7.5" rx="3.4" ry="4.8" fill="#111827" />
      <Ellipse cx="18" cy="7.5" rx="1.5" ry="2.2" fill="#4B5563" />
      {/* Headlight */}
      <Ellipse cx="18" cy="4" rx="2" ry="1.6" fill="#FEF9C3" stroke="#F5D90A" strokeWidth="0.5" />
      {/* Slight side-angle shading down the cabin's right edge — applies to
          both petrol and electric, unlike the badge/stripe below. */}
      <Rect x="24.5" y="16" width="2" height="15" fill="rgba(0,0,0,0.15)" />
      {/* Exhaust pipe — petrol-only detail, doubles as a quiet visual cue
          telling it apart from the electric version even without the badge.
          Sits under the rear of the cabin, clear of both rear wheels. */}
      {!electric && (
        <Rect x="21.5" y="43" width="2.4" height="5" rx="1.2" fill="#374151" opacity={0.85} />
      )}
      {/* Electric badge — auto-rickshaws look the same whether petrol or
          electric in real life, so a lightning bolt is the honest way to
          tell an e-auto apart on the map instead of inventing a fake shape. */}
      {electric && (
        <>
          <Path d="M19.5,29 L16,35.5 L18.4,35.5 L17.5,41 L21.5,33.7 L19,33.7 Z" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.4" />
          {/* Brand pink livery stripe across the cabin */}
          <Rect x="7.5" y="26" width="21" height="2.1" rx="1" fill={C.pink} opacity={0.88} />
        </>
      )}
    </Svg>
  );
}
function ScooterShape({ bodyLight, bodyDark, frame }: { bodyLight: string; bodyDark: string; frame: string }) {
  // Electric scooters (Ather/Ola S1/TVS iQube-style) — no exposed fuel tank
  // or engine block, so this is a genuinely different silhouette from
  // BikeShape, not just a recolor: rounded cowl + flat step-through floor.
  const gid = 'sc' + bodyDark.replace('#', '');
  return (
    <Svg width={28} height={58} viewBox="0 0 28 58">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={bodyLight} />
          <Stop offset="1" stopColor={bodyDark} />
        </LinearGradient>
      </Defs>
      {/* Front wheel */}
      <Ellipse cx="14" cy="8" rx="4.2" ry="6.2" fill="#111827" />
      <Ellipse cx="14" cy="8" rx="1.9" ry="3"   fill="#4B5563" />
      {/* Handlebar + mirrors */}
      <Rect x="1" y="10.5" width="26" height="2.8" rx="1.4" fill="#1F2937" />
      <SvgCircle cx="2.4"  cy="9" r="1.9" fill="#1F2937" />
      <SvgCircle cx="25.6" cy="9" r="1.9" fill="#1F2937" />
      {/* Sleek rounded front cowl (LED headlight look, not a fork+headlamp) */}
      <Ellipse cx="14" cy="18" rx="5" ry="5.4" fill={`url(#${gid})`} stroke="#fff" strokeWidth="1" />
      <Ellipse cx="14" cy="16.6" rx="2.2" ry="1.8" fill="#E0F2FE" />
      {/* Flat step-through floor panel — the signature "no engine bulge"
          scooter cue, replacing the petrol bike's teardrop tank. */}
      <Rect x="10.5" y="24" width="7" height="14" rx="3" fill={`url(#${gid})`} opacity={0.92} />
      {/* Lightning bolt — electric badge */}
      <Path d="M14.5,26.5 L11.5,32 L13.6,32 L12.8,36.5 L16.3,30.2 L14.1,30.2 Z" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.4" />
      {/* Seat */}
      <Rect x="9.5" y="39" width="9" height="10" rx="3.4" fill={frame} />
      {/* Rear fender */}
      <Path d="M8,45 Q14,42 20,45" stroke={frame} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* Rear wheel */}
      <Ellipse cx="14" cy="50" rx="4.6" ry="6.8" fill="#111827" />
      <Ellipse cx="14" cy="50" rx="2.1" ry="3.2" fill="#4B5563" />
    </Svg>
  );
}
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

// Per-vehicle-type color + shape pairing — real-world liveries where they
// exist (yellow/black auto, green e-auto) so the type reads at a glance.
const VEHICLE_VISUALS: Record<string, { Shape: typeof CarShape | typeof BikeShape | typeof AutoShape | typeof ScooterShape | typeof ERikshaShape; props: any }> = {
  bike:          { Shape: BikeShape,    props: { tankLight: '#F87171', tankDark: '#DC2626', frame: '#1F2937' } },
  green_bike:    { Shape: ScooterShape, props: { bodyLight: '#4ADE80', bodyDark: '#15803D', frame: '#14532D' } },
  auto:          { Shape: AutoShape,    props: { bodyLight: '#FDE68A', bodyDark: '#D97706', roof: '#1F2937' } },
  electric_auto: { Shape: AutoShape,    props: { bodyLight: '#86EFAC', bodyDark: '#16A34A', roof: '#14532D', electric: true } },
  eriksha:       { Shape: ERikshaShape, props: { bodyLight: '#67E8F9', bodyDark: '#0891B2', roof: '#164E63' } },
  car:           { Shape: CarShape,     props: { bodyLight: '#8DA2D0', bodyDark: '#2C3E6B', roof: '#1E293B' } },
  luxury:        { Shape: CarShape,     props: { bodyLight: '#6B7280', bodyDark: '#111827', roof: '#000000' } },
};
function vehicleVisual(vehicleType: string) {
  return VEHICLE_VISUALS[vehicleType] || VEHICLE_VISUALS.car;
}

// ── Assigned driver marker — real top-down vehicle, rotated to heading,
// no circle frame. Ground shadow gives it depth like it's sitting on the map. ──
function DriverMarker({ vehicleType, heading }: { vehicleType: string; heading: number }) {
  const { Shape, props } = vehicleVisual(vehicleType);
  // Smooth the rotation itself (not just position) — a hard snap to the new
  // heading every GPS tick reads as jumpy; tween it so the vehicle visibly
  // "turns" like it would on a real road.
  const rotate = useRef(new Animated.Value(heading)).current;
  const prevHeading = useRef(heading);
  useEffect(() => {
    // Take the shorter turning direction across the 0/360 wrap instead of
    // always spinning forward (e.g. 350°→10° should turn +20°, not -340°).
    let delta = heading - prevHeading.current;
    delta = ((delta + 180) % 360 + 360) % 360 - 180;
    const target = prevHeading.current + delta;
    prevHeading.current = target;
    Animated.timing(rotate, { toValue: target, duration: 500, useNativeDriver: true }).start();
  }, [heading]);
  return (
    <View style={styles.driverOuter}>
      <View style={styles.driverShadow} />
      <Animated.View style={{ transform: [{ rotate: rotate.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) }] }}>
        <Shape {...props} />
      </Animated.View>
    </View>
  );
}

// ── Nearby ghost driver — same top-down shape, smaller + faded, no rotation
// tracking (ambient "drivers are around here" markers, not en route to you). ──
function NearbyDriverMarker({ vehicleType }: { vehicleType: string }) {
  const { Shape, props } = vehicleVisual(vehicleType);
  return (
    <View style={styles.nearbyOuter}>
      <View style={{ transform: [{ scale: 0.52 }], opacity: 0.82 }}>
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
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(255,255,255,0.65)',
        borderRadius: 10,
        paddingHorizontal: 9, paddingVertical: 5,
        maxWidth: 130,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
        elevation: 6, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
      }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '800', color: '#1a1a1a', flexShrink: 1 }}>{text}</Text>
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
        <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#1a1a1a', letterSpacing: 0.2 }}>Currently You at</Text>
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
    driverRegion.timing({
      latitude: driverLat, longitude: driverLng,
      latitudeDelta: 0.01, longitudeDelta: 0.01,
      duration: 1400, useNativeDriver: false,
    } as any).start();
  }, [driverLat, driverLng]);

  // Camera follow driver in matching mode — fit driver + pickup so user sees driver approaching
  useEffect(() => {
    if (!followDriver || driverLat == null || driverLng == null || !mapRef.current) return;
    if (mode === 'matching' && pickupCoords) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: driverLat, longitude: driverLng },
          { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
        ],
        { edgePadding: { top: 70, right: 60, bottom: 70, left: 60 }, animated: true }
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
    fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving${wantAlternatives ? '&alternatives=true' : ''}&key=${MAPS_KEY}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const routes = data.routes || [];
        if (!routes.length) return;

        const toOption = (route: any): RouteOption => {
          const leg = route.legs?.[0];
          return {
            polyline:   route.overview_polyline?.points || '',
            distanceKm: (leg?.distance?.value ?? 0) / 1000,
            durationMin: (leg?.duration?.value ?? 0) / 60,
            distText:   leg?.distance?.text || '',
            etaText:    leg?.duration?.text || '',
          };
        };

        // Google returns routes sorted by duration → [0] is fastest.
        const fastest = toOption(routes[0]);
        // Shortest = least distance among alternatives.
        let shortest: RouteOption | null = null;
        if (wantAlternatives && routes.length > 1) {
          const cand = routes.map(toOption).reduce((a: RouteOption, b: RouteOption) => b.distanceKm < a.distanceKm ? b : a);
          // Only offer it if it's meaningfully shorter AND not absurdly slower —
          // otherwise the "choice" is noise.
          const shorterEnough = cand.distanceKm <= fastest.distanceKm - 0.8 && cand.distanceKm <= fastest.distanceKm * 0.92;
          const notTooSlow     = cand.durationMin <= fastest.durationMin * 1.2;
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
    showRoute, mode, selectedRouteType,
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
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 96, right: 60, bottom: 130, left: 60 },
        animated: true,
      });
    }
  }, [pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng, driverLat, driverLng, followDriver, fitKey, userLat, userLng, mode]);

  const recenter = () => {
    if (!mapRef.current) return;
    // Route visible → fit the full polyline
    if (remainingRef.current.length > 1) {
      const pts = remainingRef.current;
      const stride = Math.max(1, Math.floor(pts.length / 25));
      const sampled = pts.filter((_, i) => i % stride === 0);
      if (sampled[sampled.length - 1] !== pts[pts.length - 1]) sampled.push(pts[pts.length - 1]);
      mapRef.current.fitToCoordinates(sampled, {
        edgePadding: { top: 96, right: 60, bottom: 130, left: 60 }, animated: true,
      });
      return;
    }
    // Markers only → fit to them
    if (pickupCoords && dropCoords) {
      mapRef.current.fitToCoordinates([
        { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
        { latitude: dropCoords.lat,   longitude: dropCoords.lng   },
      ], { edgePadding: { top: 96, right: 60, bottom: 130, left: 60 }, animated: true });
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
    <View style={fill ? { flex: 1, width: '100%', overflow: 'hidden' } : { height, width: '100%', overflow: 'hidden' }}>
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
          <Polyline coordinates={bookingAhead} strokeColor={C.plum} strokeWidth={5} lineCap="round" />
        )}
        {/* Booking: once the arrow animation finishes, the route stays on the
             map as a plain plum line (previously nothing replaced the arrow
             trail, so the route visually disappeared) with a small km tag
             at the midpoint. */}
        {mode === 'booking' && animDone && routeCoords.length > 1 && (
          <>
            <Polyline coordinates={routeCoords} strokeColor={C.plum} strokeWidth={4} lineCap="round" />
            {(() => {
              const mid = routeCoords[Math.floor(routeCoords.length / 2)];
              if (!mid || !distText) return null;
              return (
                <Marker coordinate={mid} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={5}>
                  <View style={{
                    backgroundColor: '#fff', borderRadius: 10,
                    paddingHorizontal: 8, paddingVertical: 4,
                    borderWidth: 1.5, borderColor: C.plum,
                    elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
                  }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '900', color: C.plum }}>{distText}</Text>
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
            // first render (or changes later), it silently never appears.
            // Keeping it tied to `label` too (not just drag state) fixes that;
            // only 2 markers on screen, so the perf cost is negligible.
            tracksViewChanges={draggingPickup || !!pickupLabel}
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
            tracksViewChanges={draggingDrop || !!dropLabel}
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
            tracksViewChanges={true}
          >
            <DriverMarker vehicleType={vehicleType} heading={heading} />
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

  // Other POI — hide to keep clean
  { featureType: 'poi',           elementType: 'geometry',        stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business',                                   stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',                                        stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel',                     stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Driver marker — real top-down vehicle shape, no circle frame, just a
  // grounding shadow so it reads as sitting on the map surface.
  driverOuter: { alignItems: 'center', justifyContent: 'center', width: 44, height: 70 },
  driverShadow: {
    position: 'absolute', bottom: 2, width: 30, height: 11, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },

  // Nearby driver — same shapes, smaller + faded (ambient, not en route)
  nearbyOuter: { alignItems: 'center', justifyContent: 'center', width: 24, height: 38 },

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
