import { useRef, useEffect, useState, memo } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, AnimatedRegion, PROVIDER_GOOGLE } from 'react-native-maps';
import { MAPS_KEY } from '../constants';
import { C } from '../styles';

// ── Polyline decoder (Google encoded format) ──────────────────────────────────
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

// ── Vehicle marker icons ──────────────────────────────────────────────────────
const VEHICLE_ICONS: Record<string, string> = {
  bike: '🏍️', green_bike: '⚡', auto: '🛺', electric_auto: '🌿',
  eriksha: '🛵', car: '🚕', luxury: '🚙',
};

function DriverMarker({ vehicleType }: { vehicleType: string }) {
  const icon = VEHICLE_ICONS[vehicleType] || '🚕';
  return (
    <View style={styles.driverMarker}>
      <View style={styles.driverMarkerInner}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <View style={styles.driverMarkerTail} />
    </View>
  );
}

function PickupMarker() {
  return (
    <View style={styles.pickupMarker}>
      <View style={styles.pickupDot} />
    </View>
  );
}

function DropMarker() {
  return (
    <View style={styles.dropMarker}>
      <Text style={{ fontSize: 20 }}>📍</Text>
    </View>
  );
}

// ── ETA card overlay ──────────────────────────────────────────────────────────
function EtaCard({ eta, distance }: { eta: string; distance: string }) {
  if (!eta) return null;
  return (
    <View style={styles.etaCard}>
      <Text style={styles.etaTime}>{eta}</Text>
      <Text style={styles.etaDist}>{distance}</Text>
    </View>
  );
}

// ── Main LiveMap ──────────────────────────────────────────────────────────────
interface LiveMapProps {
  pickupCoords?: { lat: number; lng: number } | null;
  dropCoords?: { lat: number; lng: number } | null;
  driverLat?: number | null;
  driverLng?: number | null;
  vehicleType?: string;
  userLat?: number | null;
  userLng?: number | null;
  height?: number;
  mode?: 'booking' | 'matching' | 'inride';
  showRoute?: boolean;
}

export const LiveMap = memo(function LiveMap({
  pickupCoords, dropCoords,
  driverLat, driverLng,
  vehicleType = 'auto',
  userLat, userLng,
  height = 240,
  mode = 'booking',
  showRoute = true,
}: LiveMapProps) {
  const mapRef = useRef<MapView>(null);
  const driverRegion = useRef(
    new AnimatedRegion({
      latitude: driverLat || pickupCoords?.lat || userLat || 26.8467,
      longitude: driverLng || pickupCoords?.lng || userLng || 80.9462,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    })
  ).current;

  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [etaText, setEtaText]         = useState('');
  const [distText, setDistText]       = useState('');

  // Animate driver marker on position change
  useEffect(() => {
    if (driverLat == null || driverLng == null) return;
    driverRegion.timing({
      latitude: driverLat,
      longitude: driverLng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
      duration: 1500,
      useNativeDriver: false,
    } as any).start();
  }, [driverLat, driverLng]);

  // Fetch route — driver→pickup in matching mode, pickup→drop in booking/inride
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
        const pts = decodePolyline(route.overview_polyline?.points || '');
        setRouteCoords(pts);
        const leg = route.legs?.[0];
        if (leg) { setEtaText(leg.duration?.text || ''); setDistText(leg.distance?.text || ''); }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng, showRoute, mode,
      // Re-fetch route only when driver moves >~500m (lat/lng rounded to 3dp ≈ 111m precision)
      driverLat != null ? Math.round(driverLat * 200) / 200 : null,
      driverLng != null ? Math.round(driverLng * 200) / 200 : null]);

  // Fit map to show all relevant markers
  useEffect(() => {
    if (!mapRef.current) return;
    const coords: { latitude: number; longitude: number }[] = [];
    if (pickupCoords) coords.push({ latitude: pickupCoords.lat, longitude: pickupCoords.lng });
    if (dropCoords)   coords.push({ latitude: dropCoords.lat,   longitude: dropCoords.lng   });
    if (driverLat != null && driverLng != null) coords.push({ latitude: driverLat, longitude: driverLng });
    if (!coords.length && userLat != null) coords.push({ latitude: userLat, longitude: userLng! });
    if (coords.length > 0) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  }, [pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng, driverLat, driverLng]);

  const centerLat = pickupCoords?.lat || userLat || 26.8467;
  const centerLng = pickupCoords?.lng || userLng || 80.9462;

  return (
    <View style={{ height, width: '100%', overflow: 'hidden', borderRadius: 0 }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={{ latitude: centerLat, longitude: centerLng, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        customMapStyle={MAP_STYLE}
      >
        {/* Route polyline — dotted in booking mode, solid in inride */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={C.pink}
            strokeWidth={mode === 'booking' ? 3 : 4}
            lineDashPattern={mode === 'booking' ? [8, 6] : undefined}
            lineCap="round"
          />
        )}

        {/* Pickup marker */}
        {pickupCoords && (
          <Marker coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <PickupMarker />
          </Marker>
        )}

        {/* Drop marker */}
        {dropCoords && (
          <Marker coordinate={{ latitude: dropCoords.lat, longitude: dropCoords.lng }} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <DropMarker />
          </Marker>
        )}

        {/* Animated driver marker */}
        {driverLat != null && driverLng != null && (
          <Marker.Animated
            ref={(_ref: any) => {}}
            coordinate={driverRegion as any}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <DriverMarker vehicleType={vehicleType} />
          </Marker.Animated>
        )}
      </MapView>

      {/* ETA overlay */}
      {etaText ? <EtaCard eta={etaText} distance={distText} /> : null}
    </View>
  );
});

// ── Clean minimal Google Maps style ──────────────────────────────────────────
const MAP_STYLE = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  driverMarker: { alignItems: 'center' },
  driverMarkerInner: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: C.pink, shadowOpacity: 0.5, shadowRadius: 8,
    borderWidth: 2.5, borderColor: '#fff',
  },
  driverMarkerTail: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: C.pink, marginTop: -1,
  },
  pickupMarker: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4,
    borderWidth: 2, borderColor: '#10B981',
  },
  pickupDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981',
  },
  dropMarker: { alignItems: 'center', justifyContent: 'center' },
  etaCard: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  etaTime: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  etaDist: { fontSize: 12, color: '#64748B', fontWeight: '600' },
});
