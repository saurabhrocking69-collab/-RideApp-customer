import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator, Alert, Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { MAPS_KEY } from '../constants';
import { C } from '../styles';
import { ParcelGuideModal } from './ParcelIntroScreen';
import { PickupMapPicker } from '../components/PickupMapPicker';
import { apiGet } from '../../api';

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
// One line per size explaining which delivery vehicles show and why — the
// vehicle list below is filtered server-side by package_size (never trust
// the client), this just sets the customer's expectation before they see it.
const SIZE_VEHICLE_HINT: Record<PackageSize, string> = {
  small:  '🏍️ Bike & Green Bike only — fastest and cheapest for something bag-sized.',
  medium: '🛺 Auto, E-Rickshaw, E-Auto or Car — needs a proper boot for a box.',
  large:  '🚗 Car only — too big and heavy for a bike or 3-wheeler.',
};

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
    dropPrecision, setDropPrecision,
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
  const [showGuide, setShowGuide] = useState(false);
  const [packageNote, setPackageNote] = useState('');
  // ── Structured delivery address ──────────────────────────────────────────
  // A ride can be redirected mid-trip by the passenger sitting in the vehicle.
  // A parcel cannot: the sender is elsewhere and the receiver may not pick up.
  // So for a parcel the address has to be complete BEFORE the driver leaves,
  // and an incomplete one does not become a phone call — it becomes a return.
  const [dropBuilding, setDropBuilding] = useState('');
  const [dropFloor,    setDropFloor]    = useState('');
  const [dropLandmark, setDropLandmark] = useState('');
  const [dropPickerOpen, setDropPickerOpen] = useState(false);
  const [autofilled, setAutofilled] = useState(false);

  // Repeat parcels are the norm — the same shop, the same relative, the same
  // office. Re-typing building/floor/landmark each time is where the details
  // get dropped, and a missing floor is what turns a delivery into a phone
  // call and then into a return. When the receiver's number matches a previous
  // parcel THIS sender sent, pull that address forward.
  // Only fills blanks, so it can never overwrite something just typed.
  useEffect(() => {
    if (riderPhone.length !== 10) { setAutofilled(false); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const d = await apiGet(`/api/parcel/receiver-address?receiver=${riderPhone}`);
        const a = d?.address;
        if (cancelled || !a) return;
        setDropBuilding(prev => prev || a.building || '');
        setDropFloor(prev    => prev || a.floor    || '');
        setDropLandmark(prev => prev || a.landmark || '');
        if (!riderName.trim() && a.receiver_name) setRiderName(a.receiver_name);
        if (!drop && a.drop_location) {
          setDrop(a.drop_location);
          if (a.lat != null && a.lng != null) setDropCoords({ lat: a.lat, lng: a.lng });
        }
        setAutofilled(true);
      } catch { /* convenience only */ }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [riderPhone]);

  // Same exact-pin confirmation the ride flow uses, and it matters more here:
  // a ride can be redirected by the passenger on board, a parcel cannot.
  const promptedRef = useRef<string>('');
  useEffect(() => {
    if (!dropCoords || dropPrecision.precise) return;
    const key = `${dropCoords.lat.toFixed(5)},${dropCoords.lng.toFixed(5)}`;
    if (promptedRef.current === key) return;
    promptedRef.current = key;
    const t = setTimeout(() => setDropPickerOpen(true), 260);
    return () => clearTimeout(t);
  }, [dropCoords?.lat, dropCoords?.lng, dropPrecision.precise]);
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
    if (!dropBuilding.trim()) {
      // Deliberately blocking, unlike the ride flow's optional note. Without a
      // building or shop name the agent has a coordinate and nothing else, and
      // for a parcel there is nobody on board to ask.
      Alert.alert('Building or shop name needed', "Add the building, shop or house name so the delivery agent can find the exact door.");
      return;
    }
    if (!riderName.trim()) { Alert.alert("Receiver's name needed", "Enter who's receiving the package"); return; }
    if (riderPhone.length !== 10) { Alert.alert("Receiver's phone needed", "Enter a valid 10-digit phone number"); return; }
    if (!selVehicle || !distanceKm || !selOpt) { Alert.alert('Almost there', 'Pick a delivery vehicle'); return; }

    await bookParcel({
      vehicleType: selVehicle,
      packageSize,
      distanceKm,
      fare: selOpt.fare,
      packageNote: packageNote.trim(),
      dropBuilding: dropBuilding.trim().slice(0, 80),
      dropFloor:    dropFloor.trim().slice(0, 40),
      dropLandmark: dropLandmark.trim().slice(0, 80),
      dropNote:     packageNote.trim().slice(0, 140),
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
        {/* Re-open the walkthrough. It auto-shows only on a sender's first
            visit, so this is how anyone gets back to the rules/how-it-works
            later — same affordance Book by Hour uses for its guide. */}
        <TouchableOpacity
          onPress={() => setShowGuide(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ backgroundColor: PLUM_BG, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: PLUM_BD, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="information-circle-outline" size={13} color={PLUM} />
          <Text style={{ fontSize: 11, fontWeight: '800', color: PLUM }}>Guide</Text>
        </TouchableOpacity>
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

        {/* ── Exact delivery address ─────────────────────────────────────
               A coordinate puts the agent on the right street. These put them
               at the right door — and for a parcel that gap is not a phone
               call, it is a failed delivery and a paid return trip. Split into
               fields rather than one blob so the agent's screen can show them
               as a checklist and so a repeat parcel can auto-fill them. */}
        {!!dropCoords && (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.glassBorder, padding: 14, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: C.text, flex: 1 }}>Exact delivery address</Text>
              <TouchableOpacity onPress={() => setDropPickerOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="map-outline" size={13} color={PLUM} />
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: PLUM }}>Adjust pin</Text>
              </TouchableOpacity>
            </View>

            {autofilled && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(34,197,94,0.10)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8 }}>
                <Ionicons name="sparkles-outline" size={13} color={C.green} />
                <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: C.green }}>
                  Filled from your last parcel to this number — check it's still right
                </Text>
              </View>
            )}

            <TextInput
              style={{ backgroundColor: C.glassMid, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: C.text, borderWidth: 1, borderColor: C.glassBorder }}
              placeholder="Building / shop / house name *"
              placeholderTextColor={C.textDim}
              value={dropBuilding}
              maxLength={80}
              onChangeText={setDropBuilding}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TextInput
                style={{ flex: 1, backgroundColor: C.glassMid, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: C.text, borderWidth: 1, borderColor: C.glassBorder }}
                placeholder="Floor / flat"
                placeholderTextColor={C.textDim}
                value={dropFloor}
                maxLength={40}
                onChangeText={setDropFloor}
              />
              <TextInput
                style={{ flex: 1.4, backgroundColor: C.glassMid, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: C.text, borderWidth: 1, borderColor: C.glassBorder }}
                placeholder="Nearby landmark"
                placeholderTextColor={C.textDim}
                value={dropLandmark}
                maxLength={80}
                onChangeText={setDropLandmark}
              />
            </View>
            <Text style={{ fontSize: 10.5, color: C.textMuted, marginTop: 7, lineHeight: 14 }}>
              Nobody rides with the package, so the agent cannot ask for directions on the way. The more exact this is, the fewer calls the receiver gets.
            </Text>
          </View>
        )}

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
        <Text style={{ fontSize: 12, fontWeight: '900', color: C.text, marginBottom: 4, marginLeft: 2 }}>Choose a delivery vehicle</Text>
        <Text style={{ fontSize: 10.5, color: C.textMuted, marginBottom: 8, marginLeft: 2, lineHeight: 14 }}>{SIZE_VEHICLE_HINT[packageSize]}</Text>
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

        {/* Payment note + driver instructions */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.glassBorder, padding: 14, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
            <Ionicons name="shield-checkmark" size={13} color={PLUM} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 10.5, color: C.textMuted, lineHeight: 14 }}>
              Paid now — released to your delivery partner the moment the package is delivered.
            </Text>
          </View>
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
              {selOpt ? `Pay & Book — ₹${selOpt.fare}` : 'Book Pickup'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ParcelGuideModal visible={showGuide} onClose={() => setShowGuide(false)} />

      {/* Exact drop pin. Raised automatically for area-level or big-venue
          destinations, and reachable any time via "Adjust pin". */}
      <PickupMapPicker
        visible={dropPickerOpen}
        mode="drop"
        initialCoords={dropCoords ?? pickupCoords ?? { lat: 26.8467, lng: 80.9462 }}
        originCoords={pickupCoords}
        reason={dropPrecision.precise ? null : `${dropPrecision.areaName || 'This'} is a large area`}
        onConfirm={(address, coords) => {
          setDrop(address);
          setDropCoords(coords);
          setDropSugg([]);
          setDropPickerOpen(false);
          setDropPrecision({ precise: true, areaName: null });
        }}
        onClose={() => setDropPickerOpen(false)}
      />
    </View>
  );
}
