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

// ── Compass bearing between two coords ───────────────────────────────────────
function computeBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toR = (d: number) => d * Math.PI / 180;
  const dL = toR(lng2 - lng1);
  const l1 = toR(lat1), l2 = toR(lat2);
  const y = Math.sin(dL) * Math.cos(l2);
  const x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dL);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
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

// ── "Tap to set drop" floating hint ──────────────────────────────────────────
function TapHint({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 280, useNativeDriver: true }).start();
  }, [visible]);
  return (
    <Animated.View style={[styles.tapHint, { opacity }]} pointerEvents="none">
      <Ionicons name="finger-print" size={13} color="#fff" />
      <Text style={styles.tapHintTxt}>Tap on map to set drop location</Text>
    </Animated.View>
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
}: LiveMapProps) {
  const mapRef = useRef<MapView>(null);
  const prevPos = useRef<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState(0);
  const [draggingPickup, setDraggingPickup] = useState(false);
  const [draggingDrop, setDraggingDrop] = useState(false);

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
        if (leg) { setEtaText(leg.duration?.text || ''); setDistText(leg.distance?.text || ''); }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [
    pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng,
    showRoute, mode,
    driverLat != null ? Math.round(driverLat * 200) / 200 : null,
    driverLng != null ? Math.round(driverLng * 200) / 200 : null,
  ]);

  // Fit map to markers (skip when following driver)
  useEffect(() => {
    if (followDriver || !mapRef.current) return;
    const coords: { latitude: number; longitude: number }[] = [];
    if (pickupCoords) coords.push({ latitude: pickupCoords.lat, longitude: pickupCoords.lng });
    if (dropCoords)   coords.push({ latitude: dropCoords.lat,   longitude: dropCoords.lng   });
    if (driverLat != null && driverLng != null) coords.push({ latitude: driverLat, longitude: driverLng });
    if (!coords.length && userLat != null) coords.push({ latitude: userLat!, longitude: userLng! });
    if (coords.length > 0) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 70, right: 60, bottom: 80, left: 60 },
        animated: true,
      });
    }
  }, [pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng, driverLat, driverLng, followDriver]);

  const recenter = () => {
    if (!mapRef.current) return;
    const lat = driverLat ?? userLat ?? pickupCoords?.lat ?? 26.8467;
    const lng = driverLng ?? userLng ?? pickupCoords?.lng ?? 80.9462;
    mapRef.current.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.018, longitudeDelta: 0.018 },
      700
    );
  };

  const centerLat = pickupCoords?.lat || userLat || 26.8467;
  const centerLng = pickupCoords?.lng || userLng || 80.9462;

  // Inride route: split into completed (green) + remaining (pink) based on driver proximity
  let completedCoords: { latitude: number; longitude: number }[] = [];
  let remainingCoords = routeCoords;
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

  return (
    <View style={{ height, width: '100%', overflow: 'hidden' }}>
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
      >
        {/* Completed route segment (green) */}
        {completedCoords.length > 1 && (
          <Polyline
            coordinates={completedCoords}
            strokeColor="rgba(5,150,105,0.5)"
            strokeWidth={4}
            lineCap="round"
          />
        )}

        {/* Remaining / booking route (pink) */}
        {remainingCoords.length > 1 && (
          <Polyline
            coordinates={remainingCoords}
            strokeColor={mode === 'matching' ? C.pink : mode === 'booking' ? C.pink : C.green}
            strokeWidth={mode === 'booking' ? 3 : 4}
            lineDashPattern={mode === 'booking' ? [10, 6] : undefined}
            lineCap="round"
          />
        )}

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

      {/* ETA chip — top-left */}
      {etaText ? <EtaChip eta={etaText} distance={distText} /> : null}

      {/* "Tap to set drop" hint — bottom center */}
      <TapHint visible={showTapHint} />

      {/* Re-center button — bottom right */}
      <RecenterBtn onPress={recenter} />
    </View>
  );
});

// ── Sppero brand map style — clean light, minimal clutter ────────────────────
const MAP_STYLE = [
  { elementType: 'geometry',                              stylers: [{ color: '#f4f5f7' }] },
  { elementType: 'labels.text.stroke',                    stylers: [{ color: '#f4f5f7' }, { weight: 3 }] },
  { elementType: 'labels.text.fill',                      stylers: [{ color: '#374151' }] },

  { featureType: 'road',          elementType: 'geometry',        stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',          elementType: 'geometry.stroke',  stylers: [{ color: '#e5e7eb' }, { weight: 0.6 }] },
  { featureType: 'road.highway',  elementType: 'geometry',        stylers: [{ color: '#fef3c7' }] },
  { featureType: 'road.highway',  elementType: 'geometry.stroke',  stylers: [{ color: '#fde68a' }, { weight: 0.8 }] },
  { featureType: 'road',          elementType: 'labels.icon',     stylers: [{ visibility: 'off' }] },

  { featureType: 'water',         elementType: 'geometry',        stylers: [{ color: '#dbeafe' }] },
  { featureType: 'water',         elementType: 'labels.text.fill', stylers: [{ color: '#93c5fd' }] },

  { featureType: 'landscape',     elementType: 'geometry',        stylers: [{ color: '#eff0f4' }] },

  { featureType: 'poi',                                           stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',                                       stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel',                    stylers: [{ visibility: 'off' }] },
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
