import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator, Alert, Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { MAPS_KEY } from '../constants';
import { C } from '../styles';

const PLUM    = '#2E1461';
const PLUM_BG = '#F1EBFA';
const PLUM_BD = '#D9CCF0';

const VEHICLE_EMOJI: Record<string, string> = {
  bike: '🏍️', green_bike: '⚡', auto: '🛺', eriksha: '🛵', electric_auto: '🌿', car: '🚗',
};
const VEHICLE_LABEL: Record<string, string> = {
  bike: 'Bike', green_bike: 'Green Bike', auto: 'Auto', eriksha: 'E-Rickshaw', electric_auto: 'E-Auto', car: 'Car',
};

type PackageSize = 'small' | 'medium' | 'large';
const SIZE_INFO: { key: PackageSize; label: string; desc: string; icon: string }[] = [
  { key: 'small',  label: 'Small',  desc: 'Fits in a bag · up to 2 kg',        icon: '👜' },
  { key: 'medium', label: 'Medium', desc: 'A box · up to 10 kg',               icon: '📦' },
  { key: 'large',  label: 'Large',  desc: "Won't fit on a bike · up to 25 kg", icon: '🗄️' },
];

type EstOption = { vehicle_type: string; fare: number; base_fare: number; dist_fare: number; per_km_rate: number; surcharge: number };

export function ParcelScreen() {
  const insets = useSafeAreaInsets();
  const {
    setScreen, loading, bookParcel, parcelEstimate,
    pickup, setPickup, drop, setDrop,
    pickupCoords, setPickupCoords, dropCoords, setDropCoords,
    pickupSugg, setPickupSugg, dropSugg, setDropSugg,
    searchPlaces, geocodePlace,
    riderName, setRiderName, riderPhone, setRiderPhone,
    userCoords,
  } = useApp() as any;

  // Parcel shares the same pickup/drop/rider* context state as normal
  // booking and Intercity — reset it on entry so nothing from a previous
  // screen carries over silently.
  useEffect(() => {
    setPickup(''); setDrop(''); setPickupCoords(null); setDropCoords(null);
    setPickupSugg([]); setDropSugg([]);
    setRiderName(''); setRiderPhone('');
  }, []);

  const [packageSize, setPackageSize] = useState<PackageSize>('small');
  const [packageNote, setPackageNote] = useState('');
  const [hasCod, setHasCod] = useState(false);
  const [codAmount, setCodAmount] = useState('');
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [etaText, setEtaText] = useState('');
  const [options, setOptions] = useState<EstOption[]>([]);
  const [estLoading, setEstLoading] = useState(false);
  const [selVehicle, setSelVehicle] = useState<string | null>(null);

  // Real driving distance (not straight-line) — same Distance Matrix call
  // AppContext's fetchEtaByCoords uses for a normal ride, so parcel fares
  // are priced on the actual road distance a driver has to cover.
  const fetchDistance = useCallback(async () => {
    if (!pickupCoords?.lat || !dropCoords?.lat) return;
    setEtaText('⏳ Calculating…');
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${pickupCoords.lat},${pickupCoords.lng}&destinations=${dropCoords.lat},${dropCoords.lng}&key=${MAPS_KEY}&mode=driving&departure_time=now`, { cache: 'no-store' } as any);
      const data = await res.json();
      const el = data.rows?.[0]?.elements?.[0];
      if (el?.status === 'OK') {
        setDistanceKm(el.distance.value / 1000);
        setEtaText(`🕐 ${el.duration_in_traffic?.text || el.duration.text} · 📍 ${el.distance.text}`);
      } else { setDistanceKm(null); setEtaText(''); }
    } catch { setDistanceKm(null); setEtaText(''); }
  }, [pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng]);

  useEffect(() => { fetchDistance(); }, [fetchDistance]);

  const loadEstimates = useCallback(async () => {
    if (!distanceKm) { setOptions([]); return; }
    setEstLoading(true);
    try {
      const r = await parcelEstimate(distanceKm, packageSize);
      const opts: EstOption[] = r?.options || [];
      setOptions(opts);
      setSelVehicle(prev => opts.some(o => o.vehicle_type === prev) ? prev : (opts[0]?.vehicle_type || null));
    } catch { setOptions([]); }
    setEstLoading(false);
  }, [distanceKm, packageSize]);

  useEffect(() => { loadEstimates(); }, [loadEstimates]);

  const useCurrentLocationAsPickup = () => {
    if (!userCoords) { Alert.alert('Location unavailable', "We don't have your current location yet — try typing the pickup address instead."); return; }
    setPickup('Current Location');
    setPickupCoords({ lat: userCoords.latitude ?? userCoords.lat, lng: userCoords.longitude ?? userCoords.lng });
    setPickupSugg([]);
  };

  const selOpt = options.find(o => o.vehicle_type === selVehicle);

  const handleBook = async () => {
    if (loading) return;
    if (!pickup || !pickupCoords) { Alert.alert('Pickup needed', 'Enter or select a pickup address'); return; }
    if (!drop || !dropCoords) { Alert.alert('Drop needed', "Enter or select the receiver's address"); return; }
    if (!riderName.trim()) { Alert.alert("Receiver's name needed", "Enter who's receiving the package"); return; }
    if (riderPhone.length !== 10) { Alert.alert("Receiver's phone needed", "Enter a valid 10-digit phone number"); return; }
    if (!selVehicle || !distanceKm) { Alert.alert('Almost there', 'Pick a delivery vehicle'); return; }
    if (hasCod && (!codAmount || parseFloat(codAmount) <= 0)) { Alert.alert('COD amount', 'Enter the amount to collect, or turn off Cash on Delivery'); return; }

    await bookParcel({
      vehicleType: selVehicle,
      packageSize,
      distanceKm,
      fare: selOpt?.fare,
      codAmount: hasCod ? parseFloat(codAmount) : null,
      packageNote: packageNote.trim(),
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#fff',
        paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20,
        borderBottomWidth: 1, borderBottomColor: C.glassBorder,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        elevation: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
      }}>
        <TouchableOpacity onPress={() => setScreen('home')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>Send a Parcel</Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>{etaText || 'Enter pickup & drop to see fares'}</Text>
        </View>
        <View style={{ backgroundColor: PLUM_BG, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: PLUM_BD }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: PLUM }}>📦 Parcel</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Pickup / drop addresses */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.glassBorder, padding: 14, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.green }} />
            <TextInput
              style={{ flex: 1, fontSize: 14.5, color: C.text, fontWeight: '700', paddingVertical: 8 }}
              placeholder="Pickup address (sender)"
              placeholderTextColor={C.textDim}
              value={pickup}
              onChangeText={(t: string) => { setPickup(t); searchPlaces(t, 'pickup'); if (pickupCoords || !t) setPickupCoords(null); }}
            />
            {pickup ? (
              <TouchableOpacity onPress={() => { setPickup(''); setPickupCoords(null); setPickupSugg([]); }} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color={C.textDim} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={useCurrentLocationAsPickup} style={{ padding: 6, borderRadius: 18, backgroundColor: C.pinkGlass, borderWidth: 1, borderColor: C.pinkBorder }}>
                <Ionicons name="navigate" size={14} color={C.pink} />
              </TouchableOpacity>
            )}
          </View>
          {pickupSugg.length > 0 && (
            <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: C.glassBorder, paddingTop: 6 }}>
              {pickupSugg.slice(0, 4).map((sg: any, i: number) => (
                <TouchableOpacity key={i} style={{ paddingVertical: 9 }}
                  onPress={() => { Keyboard.dismiss(); setPickup(sg.text); setPickupSugg([]); geocodePlace(sg.text, 'pickup'); }}>
                  <Text style={{ fontSize: 13.5, color: C.text, fontWeight: '600' }} numberOfLines={1}>{sg.main || sg.text}</Text>
                  {!!sg.secondary && <Text style={{ fontSize: 11.5, color: C.textMuted }} numberOfLines={1}>{sg.secondary}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ height: 1, backgroundColor: C.glassBorder, marginVertical: 10 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: C.pink }} />
            <TextInput
              style={{ flex: 1, fontSize: 14.5, color: C.text, fontWeight: '700', paddingVertical: 8 }}
              placeholder="Drop address (receiver)"
              placeholderTextColor={C.textDim}
              value={drop}
              onChangeText={(t: string) => { setDrop(t); searchPlaces(t, 'drop'); if (dropCoords || !t) setDropCoords(null); }}
            />
            {drop ? (
              <TouchableOpacity onPress={() => { setDrop(''); setDropCoords(null); setDropSugg([]); }} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color={C.textDim} />
              </TouchableOpacity>
            ) : null}
          </View>
          {dropSugg.length > 0 && (
            <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: C.glassBorder, paddingTop: 6 }}>
              {dropSugg.slice(0, 4).map((sg: any, i: number) => (
                <TouchableOpacity key={i} style={{ paddingVertical: 9 }}
                  onPress={() => { Keyboard.dismiss(); setDrop(sg.text); setDropSugg([]); geocodePlace(sg.text, 'drop'); }}>
                  <Text style={{ fontSize: 13.5, color: C.text, fontWeight: '600' }} numberOfLines={1}>{sg.main || sg.text}</Text>
                  {!!sg.secondary && <Text style={{ fontSize: 11.5, color: C.textMuted }} numberOfLines={1}>{sg.secondary}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Receiver details */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.glassBorder, padding: 14, marginBottom: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '900', color: C.text, marginBottom: 8 }}>Who's receiving it?</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={{ flex: 1, backgroundColor: C.glassMid, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: C.text, borderWidth: 1, borderColor: C.glassBorder }}
              placeholder="Receiver's name"
              placeholderTextColor={C.textDim}
              value={riderName}
              onChangeText={setRiderName}
            />
            <TextInput
              style={{ flex: 1, backgroundColor: C.glassMid, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: C.text, borderWidth: 1, borderColor: C.glassBorder }}
              placeholder="Their 10-digit phone"
              placeholderTextColor={C.textDim}
              keyboardType="number-pad"
              maxLength={10}
              value={riderPhone}
              onChangeText={(v: string) => setRiderPhone(v.replace(/[^0-9]/g, ''))}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 }}>
            <Ionicons name="information-circle" size={13} color={C.textMuted} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 10.5, color: C.textMuted, lineHeight: 14 }}>
Once your driver is matched, you'll get a delivery OTP — share it with them yourself, and they hand it to the driver to confirm the package reached the right person.
            </Text>
          </View>
        </View>

        {/* Package size */}
        <Text style={{ fontSize: 12, fontWeight: '900', color: C.text, marginBottom: 8, marginLeft: 2 }}>Package size</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {SIZE_INFO.map(s => {
            const active = packageSize === s.key;
            return (
              <TouchableOpacity key={s.key} activeOpacity={0.85}
                onPress={() => { setPackageSize(s.key); setSelVehicle(null); }}
                style={{
                  flex: 1, backgroundColor: active ? PLUM_BG : '#fff', borderRadius: 14,
                  borderWidth: active ? 2 : 1, borderColor: active ? PLUM : C.glassBorder,
                  padding: 12, alignItems: 'center',
                }}>
                <Text style={{ fontSize: 22 }}>{s.icon}</Text>
                <Text style={{ fontSize: 12.5, fontWeight: '900', color: active ? PLUM : C.text, marginTop: 4 }}>{s.label}</Text>
                <Text style={{ fontSize: 9.5, color: C.textMuted, marginTop: 2, textAlign: 'center' }}>{s.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Vehicle options */}
        <Text style={{ fontSize: 12, fontWeight: '900', color: C.text, marginBottom: 8, marginLeft: 2 }}>Choose a delivery vehicle</Text>
        {estLoading ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={PLUM} />
          </View>
        ) : !distanceKm ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.glassBorder, padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: C.textMuted, textAlign: 'center' }}>Enter both addresses to see delivery options</Text>
          </View>
        ) : options.map(o => {
          const active = selVehicle === o.vehicle_type;
          return (
            <TouchableOpacity key={o.vehicle_type} activeOpacity={0.85} onPress={() => setSelVehicle(o.vehicle_type)}
              style={{
                backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
                borderWidth: active ? 2 : 1, borderColor: active ? PLUM : C.glassBorder,
                flexDirection: 'row', alignItems: 'center',
              }}>
              <Text style={{ fontSize: 28, marginRight: 12 }}>{VEHICLE_EMOJI[o.vehicle_type] || '🚗'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: C.text }}>{VEHICLE_LABEL[o.vehicle_type] || o.vehicle_type}</Text>
                <Text style={{ fontSize: 10.5, color: C.textDim, marginTop: 2 }}>₹{o.base_fare} base + ₹{o.per_km_rate}/km{o.surcharge > 0 ? ` + ₹${o.surcharge} handling` : ''}</Text>
              </View>
              <Text style={{ fontSize: 17, fontWeight: '900', color: C.text }}>₹{o.fare}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Cash on delivery */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.glassBorder, padding: 14, marginTop: 4 }}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setHasCod(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{
              width: 20, height: 20, borderRadius: 6, borderWidth: 2,
              borderColor: hasCod ? PLUM : C.glassBorder, backgroundColor: hasCod ? PLUM : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {hasCod && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: C.text, flex: 1 }}>Collect cash on delivery</Text>
          </TouchableOpacity>
          {hasCod && (
            <View style={{ marginTop: 10 }}>
              <TextInput
                style={{ backgroundColor: C.glassMid, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: C.text, borderWidth: 1, borderColor: C.glassBorder }}
                placeholder="Amount to collect from receiver (₹)"
                placeholderTextColor={C.textDim}
                keyboardType="number-pad"
                value={codAmount}
                onChangeText={(v: string) => setCodAmount(v.replace(/[^0-9]/g, ''))}
              />
              <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 6, lineHeight: 14 }}>
                This is separate from the delivery fee — the driver collects it from the receiver on your behalf and settles it with you directly.
              </Text>
            </View>
          )}
          <TextInput
            style={{ marginTop: 12, backgroundColor: C.glassMid, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: C.text, borderWidth: 1, borderColor: C.glassBorder }}
            placeholder="Instructions for the driver (optional) — fragile, handle with care, etc."
            placeholderTextColor={C.textDim}
            value={packageNote}
            onChangeText={setPackageNote}
          />
        </View>
      </ScrollView>

      {/* Book CTA */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff', padding: 16, paddingBottom: Math.max(insets.bottom, 16),
        borderTopWidth: 1, borderTopColor: C.glassBorder,
      }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleBook}
          disabled={loading || estLoading || !selOpt}
          style={{
            backgroundColor: loading || estLoading || !selOpt ? '#9CA3AF' : C.pink,
            borderRadius: 16, paddingVertical: 16, alignItems: 'center',
            elevation: 6, shadowColor: C.pink, shadowOpacity: 0.35, shadowRadius: 12,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>
              {selOpt ? `Book Pickup — ₹${selOpt.fare}` : 'Book Pickup'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
