import { useRef, useEffect, useState, memo } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, Circle, AnimatedRegion, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { MAPS_KEY } from '../constants';
import { C } from '../styles';

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

// ── Quadratic Bezier arch between two map coords ─────────────────────────────
function generateArcPoints(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  steps = 60,
): { latitude: number; longitude: number }[] {
  const mx = (lat1 + lat2) / 2;
  const my = (lng1 + lng2) / 2;
  const dx = lat2 - lat1;
  const dy = lng2 - lng1;
  // Control point lifted perpendicular to route — arch height = 45% of distance
  const cx = mx - dy * 0.45;
  const cy = my + dx * 0.45;
  const pts: { latitude: number; longitude: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({
      latitude:  (1 - t) ** 2 * lat1 + 2 * (1 - t) * t * cx + t ** 2 * lat2,
      longitude: (1 - t) ** 2 * lng1 + 2 * (1 - t) * t * cy + t ** 2 * lng2,
    });
  }
  return pts;
}

// ── Vehicle icons ─────────────────────────────────────────────────────────────
const VEHICLE_ICONS: Record<string, string> = {
  bike: '🏍️', green_bike: '⚡', auto: '🛺', electric_auto: '🌿',
  eriksha: '🛵', car: '🚕', luxury: '🚙',
};

// ── Assigned driver marker (large, branded, with bearing arrow) ───────────────
function DriverMarker({ vehicleType, heading }: { vehicleType: string; heading: number }) {
  const icon = VEHICLE_ICONS[vehicleType] || '🚕';
  return (
    <View style={styles.driverOuter}>
      {/* Direction arrow ring */}
      <View style={[styles.bearingArrow, { transform: [{ rotate: `${heading}deg` }] }]}>
        <View style={styles.bearingTip} />
      </View>
      <View style={styles.driverInner}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
    </View>
  );
}

// ── Nearby ghost driver (smaller, semi-transparent) ───────────────────────────
function NearbyDriverMarker({ vehicleType }: { vehicleType: string }) {
  const icon = VEHICLE_ICONS[vehicleType] || '🚕';
  return (
    <View style={styles.nearbyOuter}>
      <View style={styles.nearbyPing} />
      <View style={styles.nearbyInner}>
        <Text style={{ fontSize: 13 }}>{icon}</Text>
      </View>
    </View>
  );
}

// ── Pickup pin — green circle with white center ───────────────────────────────
function PickupMarker({ dragging }: { dragging?: boolean }) {
  return (
    <View style={[styles.pickupRing, dragging && { borderColor: C.green, borderWidth: 3 }]}>
      <View style={styles.pickupDot} />
    </View>
  );
}

// ── Drop pin — pink teardrop ──────────────────────────────────────────────────
function DropMarker({ dragging }: { dragging?: boolean }) {
  return (
    <View style={styles.dropOuter}>
      <View style={[styles.dropPin, dragging && { backgroundColor: C.pink }]}>
        <View style={styles.dropHole} />
      </View>
      <View style={styles.dropTail} />
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

// ── "You are here" GPS marker ─────────────────────────────────────────────────
function YouMarker() {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{
        backgroundColor: 'rgba(255,255,255,0.97)',
        borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
        marginBottom: 4, borderWidth: 1.5, borderColor: C.pink,
        elevation: 4,
        shadowColor: C.pink, shadowOpacity: 0.22, shadowRadius: 4,
      }}>
        <Text style={{ fontSize: 10, fontWeight: '900', color: C.pink, letterSpacing: 0.4 }}>You</Text>
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
  fitKey?: number;
  adjustOrigin?: { lat: number; lng: number } | null;
  fill?: boolean;           // flex:1 to fill parent instead of fixed height
  cameraTarget?: { lat: number; lng: number } | null; // fly camera here when set
  walkOrigin?: { lat: number; lng: number } | null;   // user GPS — draws dotted walk line to pickup
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
  fitKey = 0,
  adjustOrigin = null,
  fill = false,
  cameraTarget = null,
  walkOrigin = null,
}: LiveMapProps) {
  const mapRef = useRef<MapView>(null);
  const prevPos = useRef<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState(0);
  const [draggingPickup, setDraggingPickup] = useState(false);
  const [draggingDrop, setDraggingDrop] = useState(false);

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

  // Camera follow driver in inride mode
  useEffect(() => {
    if (!followDriver || driverLat == null || driverLng == null || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { latitude: driverLat, longitude: driverLng, latitudeDelta: 0.012, longitudeDelta: 0.012 },
      900
    );
  }, [followDriver, driverLat, driverLng]);

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

    let cancelled = false;
    fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${MAPS_KEY}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const route = data.routes?.[0];
        if (!route) return;
        setRouteCoords(decodePolyline(route.overview_polyline?.points || ''));
        const leg = route.legs?.[0];
        if (leg) {
          const et = leg.duration?.text || '';
          const dt = leg.distance?.text || '';
          setEtaText(et); setDistText(dt);
          onRouteInfo?.(et, dt);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [
    pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng,
    showRoute, mode,
    driverLat != null ? Math.round(driverLat * 200) / 200 : null,
    driverLng != null ? Math.round(driverLng * 200) / 200 : null,
  ]);

  // Fit map — uses sampled route polyline when available for tighter framing
  useEffect(() => {
    if (followDriver || skipAutoFit || !mapRef.current) return;
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
      if (!coords.length && userLat != null) coords.push({ latitude: userLat!, longitude: userLng! });
    }
    if (coords.length > 0) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 96, right: 60, bottom: 130, left: 60 },
        animated: true,
      });
    }
  }, [pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng, driverLat, driverLng, followDriver, fitKey]);

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

        {/* Booking: pink trail behind arrow — hidden once animation finishes */}
        {mode === 'booking' && !animDone && bookingBehind.length > 1 && (
          <Polyline coordinates={bookingBehind} strokeColor={C.pink} strokeWidth={5} lineCap="round" />
        )}
        {/* Booking: green route ahead of arrow — hidden once animation finishes */}
        {mode === 'booking' && !animDone && bookingAhead.length > 1 && (
          <Polyline coordinates={bookingAhead} strokeColor={C.green} strokeWidth={5} lineCap="round" />
        )}
        {/* Dotted arch — appears after animation completes */}
        {mode === 'booking' && animDone && pickupCoords && dropCoords && (() => {
          const archPts = generateArcPoints(
            pickupCoords.lat, pickupCoords.lng,
            dropCoords.lat,   dropCoords.lng,
          );
          return (
            <Polyline
              coordinates={archPts}
              strokeColor="rgba(160,90,255,0.82)"
              strokeWidth={3}
              lineDashPattern={[9, 7]}
              lineCap="round"
            />
          );
        })()}

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

        {/* Pickup marker */}
        {pickupCoords && (
          <Marker
            coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={draggingPickup}
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
            <PickupMarker dragging={draggingPickup} />
          </Marker>
        )}

        {/* Drop marker */}
        {dropCoords && (
          <Marker
            coordinate={{ latitude: dropCoords.lat, longitude: dropCoords.lng }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={draggingDrop}
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
            <DropMarker dragging={draggingDrop} />
          </Marker>
        )}

        {/* Animated driver marker */}
        {driverLat != null && driverLng != null && (
          <Marker.Animated
            coordinate={driverRegion as any}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
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

      {/* ETA chip — top-left, not shown in booking (displayed in bottom sheet instead) */}
      {etaText && mode !== 'booking' ? <EtaChip eta={etaText} distance={distText} /> : null}

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

  // Parks & green spaces — visible and green
  { featureType: 'poi.park',      elementType: 'geometry',        stylers: [{ color: '#bbf7d0' }] },
  { featureType: 'poi.park',      elementType: 'labels.text.fill', stylers: [{ color: '#059669' }] },
  { featureType: 'poi.park',                                       stylers: [{ visibility: 'on' }] },
  { featureType: 'landscape.natural', elementType: 'geometry',    stylers: [{ color: '#d1fae5' }] },

  // Other POI — hide to keep clean
  { featureType: 'poi',           elementType: 'geometry',        stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business',                                   stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',                                        stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel',                     stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Driver marker — large circle with bearing ring
  driverOuter: { alignItems: 'center', justifyContent: 'center', width: 54, height: 54 },
  bearingArrow: {
    position: 'absolute', width: 54, height: 54, alignItems: 'center',
  },
  bearingTip: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: C.pink,
    marginTop: 0,
  },
  driverInner: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center',
    elevation: 8, shadowColor: C.pink, shadowOpacity: 0.55, shadowRadius: 10,
    borderWidth: 2.5, borderColor: '#fff',
  },

  // Nearby driver — ghost style
  nearbyOuter: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36 },
  nearbyPing: {
    position: 'absolute', width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,45,120,0.12)', borderWidth: 1.5, borderColor: 'rgba(255,45,120,0.30)',
  },
  nearbyInner: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    elevation: 3, borderWidth: 1.5, borderColor: 'rgba(255,45,120,0.35)',
  },

  // Pickup — green ring + white center dot
  pickupRing: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    elevation: 5, shadowColor: C.green, shadowOpacity: 0.30, shadowRadius: 6,
    borderWidth: 2.5, borderColor: C.green,
  },
  pickupDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: C.green },

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
