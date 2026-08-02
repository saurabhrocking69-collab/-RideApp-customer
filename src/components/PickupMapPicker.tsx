import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, SP, SHADOW } from '../styles';
import { SkeletonBox } from './ui';
import { MAPS_KEY } from '../constants';
import { externalGet } from '../../api';

const { width: W } = Dimensions.get('window');

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Props {
  visible: boolean;
  /** 'pickup' (default) — user sets their pickup. 'drop' — user sets their destination. */
  mode?: 'pickup' | 'drop';
  initialCoords: { lat: number; lng: number };
  /** Drop mode only: the confirmed pickup coords — used to draw the route line origin. */
  originCoords?: { lat: number; lng: number } | null;
  /** Why the picker opened by itself, e.g. "Aminabad is a large area". Shown
   *  above Confirm so an automatic prompt never feels like a random modal. */
  reason?: string | null;
  onConfirm: (address: string, coords: { lat: number; lng: number }, saveLabel: 'Home' | 'Work' | null) => void;
  onClose: () => void;
}

export function PickupMapPicker({
  visible,
  mode = 'pickup',
  initialCoords,
  reason = null,
  originCoords,
  onConfirm,
  onClose,
}: Props) {
  const { top, bottom } = useSafeAreaInsets();
  const [address, setAddress]     = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [saveLabel, setSaveLabel] = useState<'Home' | 'Work' | null>(null);
  const [mapCenter, setMapCenter] = useState(initialCoords);
  const currentCoords = useRef(initialCoords);
  const geocodeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDrop = mode === 'drop';

  // ── Map skeleton ──────────────────────────────────────────────────────────
  const [mapReady, setMapReady] = useState(false);
  const skeletonOpacity = useRef(new Animated.Value(1)).current;
  const skeletonScale   = useRef(new Animated.Value(1)).current;

  const onMapReadyCb = useCallback(() => {
    setMapReady(true);
    Animated.parallel([
      Animated.timing(skeletonOpacity, { toValue: 0, duration: 420, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      Animated.timing(skeletonScale,   { toValue: 1.04, duration: 420, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
    ]).start();
  }, []);

  const doGeocode = async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const res = await externalGet(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}&language=en`
      );
      const r = res?.results?.[0];
      setAddress(r?.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
    setGeocoding(false);
  };

  useEffect(() => {
    if (!visible) {
      // Reset skeleton so next open starts with loading state
      setMapReady(false);
      skeletonOpacity.setValue(1);
      skeletonScale.setValue(1);
      return;
    }
    currentCoords.current = initialCoords;
    setMapCenter(initialCoords);
    setAddress('');
    setSaveLabel(null);
    doGeocode(initialCoords.lat, initialCoords.lng);
  }, [visible]);

  const onRegionChangeComplete = useCallback((region: Region) => {
    const lat = region.latitude;
    const lng = region.longitude;
    currentCoords.current = { lat, lng };
    setMapCenter({ lat, lng });
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => doGeocode(lat, lng), 650);
  }, []);

  const handleConfirm = () => {
    if (geocoding || !address) return;
    onConfirm(address, currentCoords.current, isDrop ? null : saveLabel);
  };

  // ── Line geometry ────────────────────────────────────────────────────────
  // Pickup mode: line from GPS origin (initialCoords) → map center (how far you moved from where you stand)
  // Drop mode:   line from pickup coords (originCoords) → map center (the route you'll travel)
  const lineOrigin = isDrop ? (originCoords ?? null) : initialCoords;
  const lineDistM  = lineOrigin
    ? haversineM(lineOrigin.lat, lineOrigin.lng, mapCenter.lat, mapCenter.lng)
    : 0;
  const lineDistLabel = lineDistM < 1000
    ? `${Math.round(lineDistM)}m`
    : `${(lineDistM / 1000).toFixed(1)}km`;
  const lineMins = isDrop
    ? Math.max(1, Math.ceil(lineDistM / 667))  // ~40 km/h city drive = 667 m/min
    : Math.max(1, Math.ceil(lineDistM / 83));  // ~5 km/h walk        = 83 m/min
  const showLine = !!lineOrigin && lineDistM > 50;

  // ── Per-mode theming ─────────────────────────────────────────────────────
  const lineColor   = isDrop ? '#A855F7' : '#3B82F6';
  const chipBorder  = isDrop ? '#C084FC' : '#60A5FA';
  const chipTextCol = isDrop ? '#7E22CE' : '#1D4ED8';
  const chipBg      = isDrop ? 'rgba(168,85,247,0.09)' : '#FFFFFF';
  const hintBg      = isDrop ? 'rgba(168,85,247,0.07)' : 'rgba(59,130,246,0.07)';
  const hintBorder  = isDrop ? 'rgba(192,132,252,0.35)' : 'rgba(96,165,250,0.35)';
  const hintTitle   = isDrop ? '#6B21A8' : '#1D4ED8';
  const hintSub     = isDrop ? '#9333EA' : '#3B82F6';
  const pinColor    = isDrop ? C.pink : C.green;
  const iconBg      = isDrop ? C.pinkGlass : C.greenGlass;
  const iconColor   = isDrop ? C.pink : C.green;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>

        {/* ─── Map ─── */}
        <View style={{ flex: 1 }}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFillObject}
            initialRegion={{
              latitude:      initialCoords.lat,
              longitude:     initialCoords.lng,
              latitudeDelta:  isDrop ? 0.012 : 0.003,
              longitudeDelta: isDrop ? 0.012 : 0.003,
            }}
            onRegionChangeComplete={onRegionChangeComplete}
            onMapReady={onMapReadyCb}
            showsUserLocation
            showsMyLocationButton={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
          >
            {showLine && lineOrigin && (
              <>
                {/* Dashed route / walk line */}
                <Polyline
                  coordinates={[
                    { latitude: lineOrigin.lat, longitude: lineOrigin.lng },
                    { latitude: mapCenter.lat,  longitude: mapCenter.lng  },
                  ]}
                  strokeColor={lineColor}
                  strokeWidth={2.5}
                  lineDashPattern={[9, 7]}
                  lineCap="butt"
                />

                {/* Fixed origin dot in drop mode (marks the pickup point on the map) */}
                {isDrop && (
                  <Marker
                    coordinate={{ latitude: lineOrigin.lat, longitude: lineOrigin.lng }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={false}
                  >
                    <View style={{
                      width: 14, height: 14, borderRadius: 7,
                      backgroundColor: C.green,
                      borderWidth: 2.5, borderColor: '#fff',
                      elevation: 4,
                      shadowColor: C.green, shadowOpacity: 0.4, shadowRadius: 4,
                    }} />
                  </Marker>
                )}

                {/* Midpoint distance chip */}
                <Marker
                  coordinate={{
                    latitude:  (lineOrigin.lat + mapCenter.lat) / 2,
                    longitude: (lineOrigin.lng + mapCenter.lng) / 2,
                  }}
                  anchor={{ x: 0.5, y: 1.4 }}
                  tracksViewChanges={false}
                >
                  <View style={{
                    backgroundColor: chipBg,
                    borderRadius: 11, paddingHorizontal: 9, paddingVertical: 4,
                    borderWidth: 1.5, borderColor: chipBorder,
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    elevation: 5,
                    shadowColor: lineColor, shadowOpacity: 0.22, shadowRadius: 6,
                  }}>
                    <Text style={{ fontSize: 11 }}>{isDrop ? '🚗' : '🚶'}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: chipTextCol }}>
                      {lineDistLabel}
                    </Text>
                  </View>
                </Marker>
              </>
            )}
          </MapView>

          {/* ─── Map skeleton — fades out when map tiles finish loading ─── */}
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              { opacity: skeletonOpacity, transform: [{ scale: skeletonScale }], zIndex: 20, backgroundColor: '#f0ebe0' },
            ]}
            pointerEvents={mapReady ? 'none' : 'box-only'}
          >
            {/* Road-like skeleton bars */}
            <View style={{ position: 'absolute', top: '28%', left: 0, right: 0, height: 16, backgroundColor: '#fde68a' }} />
            <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 12, backgroundColor: '#fde68a' }} />
            <View style={{ position: 'absolute', top: '70%', left: 0, right: 0, height: 10, backgroundColor: '#fde68a' }} />
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: '38%', width: 16, backgroundColor: '#fde68a' }} />
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: '62%', width: 22, backgroundColor: '#fbbf24' }} />
            {/* Center loading pin */}
            <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', marginBottom: 60 }}>
              <View style={{
                backgroundColor: pinColor, borderRadius: 24, padding: 11,
                elevation: 8, shadowColor: pinColor, shadowOpacity: 0.45, shadowRadius: 12,
                borderWidth: 2.5, borderColor: '#fff',
              }}>
                <Ionicons name="location-sharp" size={24} color="#fff" />
              </View>
              <View style={{ width: 3, height: 14, backgroundColor: pinColor, borderRadius: 2 }} />
              <View style={{ marginTop: 14, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 4 }}>
                <ActivityIndicator size="small" color={pinColor} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: isDrop ? '#7E22CE' : '#1D4ED8' }}>
                  Loading map…
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Fixed pin — tip rests at the map center */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ alignItems: 'center', transform: [{ translateY: -30 }] }}>
                <View style={{ backgroundColor: pinColor, borderRadius: 22, padding: 9, ...SHADOW.md }}>
                  <Ionicons name="location-sharp" size={22} color="#FFFFFF" />
                </View>
                <View style={{ width: 3, height: 16, backgroundColor: pinColor, borderRadius: 2 }} />
                <View style={{ width: 14, height: 5, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.13)', marginTop: 1 }} />
              </View>
            </View>
          </View>

          {/* Back button */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              position: 'absolute',
              top: (top || (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44)) + 8,
              left: 14,
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: '#FFFFFF',
              alignItems: 'center', justifyContent: 'center',
              ...SHADOW.md,
            }}
          >
            <Ionicons name="arrow-back" size={19} color={C.text} />
          </TouchableOpacity>

          {/* Header pill */}
          <View style={{
            position: 'absolute',
            top: (top || (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44)) + 12,
            alignSelf: 'center',
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 16, paddingVertical: 7,
            borderRadius: R.full,
            ...SHADOW.sm,
          }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: C.text, letterSpacing: 0.5 }}>
              {isDrop ? 'SET DROP POINT' : 'SET PICKUP POINT'}
            </Text>
          </View>
        </View>

        {/* ─── Bottom sheet ─── */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg,
          paddingHorizontal: SP.lg,
          paddingTop: 22,
          paddingBottom: Math.max((bottom || 0), 12) + SP.lg,
          ...SHADOW.lg,
        }}>

          {/* Address label + text */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <View style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: iconBg,
              alignItems: 'center', justifyContent: 'center',
              marginTop: 2, flexShrink: 0,
            }}>
              <Ionicons name="location-sharp" size={16} color={iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 5 }}>
                {isDrop ? 'DROP POINT' : 'PICKUP POINT'}
              </Text>
              {geocoding ? (
                <View style={{ gap: 8 }}>
                  <SkeletonBox height={14} radius={5} />
                  <SkeletonBox width={W - 130} height={14} radius={5} />
                </View>
              ) : (
                <Text style={{ fontSize: 13, color: C.text, fontWeight: '600', lineHeight: 19 }} numberOfLines={3}>
                  {address}
                </Text>
              )}
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: C.glassBorder, marginBottom: 14 }} />

          {/* Distance / time hint — shown when line is visible */}
          {showLine && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: hintBg,
              borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
              borderWidth: 1, borderColor: hintBorder,
              marginBottom: 14,
            }}>
              <Text style={{ fontSize: 20 }}>{isDrop ? '🚗' : '🚶'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: hintTitle, marginBottom: 1 }}>
                  {isDrop ? 'Drive from pickup' : 'Walk to your pickup point'}
                </Text>
                <Text style={{ fontSize: 11, color: hintSub, fontWeight: '600' }}>
                  {lineDistLabel} away · about {lineMins} min {isDrop ? 'by car' : 'on foot'}
                </Text>
              </View>
            </View>
          )}

          {/* Save as chips — pickup mode only */}
          {!isDrop && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <Text style={{ fontSize: 12, color: C.textMuted, fontWeight: '600', marginRight: 2 }}>
                Save as:
              </Text>
              {(['Home', 'Work'] as const).map(lbl => {
                const active = saveLabel === lbl;
                return (
                  <TouchableOpacity
                    key={lbl}
                    onPress={() => setSaveLabel(active ? null : lbl)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                      paddingHorizontal: 13, paddingVertical: 7,
                      borderRadius: R.full,
                      backgroundColor: active ? C.greenGlass : C.glassMid,
                      borderWidth: 1.5,
                      borderColor: active ? C.greenBorder : C.glassBorder,
                    }}
                  >
                    <Ionicons
                      name={lbl === 'Home' ? 'home-outline' : 'business-outline'}
                      size={12}
                      color={active ? C.green : C.textMuted}
                    />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: active ? C.green : C.textMuted }}>
                      {lbl}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Why this opened. Only set when the picker was raised
              automatically, so the driver-facing consequence is stated where
              the customer is about to act on it. */}
          {!!reason && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 12,
              borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.45)',
              paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
            }}>
              <Text style={{ fontSize: 15 }}>⚠️</Text>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#92400E', lineHeight: 16 }}>
                {reason} — set the exact spot. Your fare and route are calculated to this pin.
              </Text>
            </View>
          )}

          {/* Confirm button */}
          <TouchableOpacity
            disabled={geocoding || !address}
            onPress={handleConfirm}
            activeOpacity={0.85}
            style={{
              backgroundColor: geocoding || !address ? '#94A3B8' : pinColor,
              borderRadius: R.md,
              paddingVertical: 16,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
              ...(geocoding || !address ? {} : SHADOW.md),
            }}
          >
            {geocoding
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            }
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
              {isDrop ? 'Confirm Drop' : 'Confirm Pickup'}
            </Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}
