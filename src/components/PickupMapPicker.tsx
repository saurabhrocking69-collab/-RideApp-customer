import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, SP, SHADOW } from '../styles';
import { SkeletonBox } from './ui';
import { MAPS_KEY } from '../constants';
import { externalGet } from '../../api';

const { width: W } = Dimensions.get('window');

interface Props {
  visible: boolean;
  initialCoords: { lat: number; lng: number };
  onConfirm: (address: string, coords: { lat: number; lng: number }, saveLabel: 'Home' | 'Work' | null) => void;
  onClose: () => void;
}

export function PickupMapPicker({ visible, initialCoords, onConfirm, onClose }: Props) {
  const { top, bottom } = useSafeAreaInsets();
  const [address, setAddress]     = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [saveLabel, setSaveLabel] = useState<'Home' | 'Work' | null>(null);
  const currentCoords = useRef(initialCoords);
  const geocodeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!visible) return;
    currentCoords.current = initialCoords;
    setAddress('');
    setSaveLabel(null);
    doGeocode(initialCoords.lat, initialCoords.lng);
  }, [visible]);

  const onRegionChangeComplete = useCallback((region: Region) => {
    const lat = region.latitude;
    const lng = region.longitude;
    currentCoords.current = { lat, lng };
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => doGeocode(lat, lng), 650);
  }, []);

  const handleConfirm = () => {
    if (geocoding || !address) return;
    onConfirm(address, currentCoords.current, saveLabel);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>

        {/* ─── Map fills the top flex area ─── */}
        <View style={{ flex: 1 }}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFillObject}
            initialRegion={{
              latitude: initialCoords.lat,
              longitude: initialCoords.lng,
              latitudeDelta: 0.006,
              longitudeDelta: 0.006,
            }}
            onRegionChangeComplete={onRegionChangeComplete}
            showsUserLocation
            showsMyLocationButton={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
          />

          {/* Fixed pin at center of map view — pointerEvents none so map pans beneath */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {/* translateY: -30 shifts pin up so its tip (bottom of stem) rests at center */}
              <View style={{ alignItems: 'center', transform: [{ translateY: -30 }] }}>
                <View style={{
                  backgroundColor: C.green,
                  borderRadius: 22, padding: 9,
                  ...SHADOW.md,
                }}>
                  <Ionicons name="location-sharp" size={22} color="#FFFFFF" />
                </View>
                <View style={{ width: 3, height: 16, backgroundColor: C.green, borderRadius: 2 }} />
                {/* Ground shadow dot */}
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
              SET PICKUP POINT
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
          {/* Address row */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <View style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: C.greenGlass,
              alignItems: 'center', justifyContent: 'center',
              marginTop: 2, flexShrink: 0,
            }}>
              <Ionicons name="location-sharp" size={16} color={C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 5 }}>
                PICKUP POINT
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

          {/* Save as: Home / Work chips */}
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

          {/* Confirm button */}
          <TouchableOpacity
            disabled={geocoding || !address}
            onPress={handleConfirm}
            activeOpacity={0.85}
            style={{
              backgroundColor: geocoding || !address ? '#94A3B8' : C.green,
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
              Confirm Pickup
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </Modal>
  );
}
