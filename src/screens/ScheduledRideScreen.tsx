import { useState, useEffect, useRef } from 'react';
import {
  Animated, KeyboardAvoidingView, Modal, Platform, ScrollView,
  Text, TextInput, TouchableOpacity, View, Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { GlassPanel, DotBG, SlideUp } from '../components/ui';
import { s, C, T, R, SP, SHADOW } from '../styles';
import { apiGet, apiPost, API } from '../../api';
import { MAPS_KEY, RIDES } from '../constants';
import { externalGet } from '../../api';

const VEHICLE_OPTIONS = [
  { id: 'bike',         emoji: '🏍️', label: 'Bike',     price: '₹15+', base: 15, perKm: 8  },
  { id: 'auto',         emoji: '🛺', label: 'Auto',     price: '₹25+', base: 25, perKm: 12 },
  { id: 'eriksha',      emoji: '🛵', label: 'E-Riksha', price: '₹20+', base: 20, perKm: 10 },
  { id: 'car',          emoji: '🚕', label: 'Car',      price: '₹40+', base: 40, perKm: 15 },
  { id: 'green_bike',   emoji: '⚡', label: 'E-Bike',   price: '₹12+', base: 12, perKm: 6  },
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function TimePicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const now = new Date();
  const minDate = new Date(now.getTime() + 30 * 60 * 1000); // at least 30 min ahead

  // Build next-7-days options
  const dayOptions = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    return d;
  });

  const [selDay, setSelDay] = useState(0);
  const [selHour, setSelHour] = useState(value.getHours() % 12 || 12);
  const [selMin, setSelMin] = useState(Math.ceil(value.getMinutes() / 15) * 15 % 60);
  const [selAmPm, setSelAmPm] = useState<'AM' | 'PM'>(value.getHours() >= 12 ? 'PM' : 'AM');

  const hours = [1,2,3,4,5,6,7,8,9,10,11,12];
  const mins  = [0, 15, 30, 45];

  const [timeError, setTimeError] = useState('');

  useEffect(() => {
    const d = new Date(dayOptions[selDay]);
    let h = selHour % 12;
    if (selAmPm === 'PM') h += 12;
    d.setHours(h, selMin, 0, 0);
    if (d > minDate) {
      setTimeError('');
      onChange(d);
    } else {
      setTimeError('⚠️ Kam se kam 30 min aage ka time chuno');
    }
  }, [selDay, selHour, selMin, selAmPm]);

  return (
    <View>
      {/* Day selector */}
      <Text style={{ fontSize: 11, fontWeight: '800', color: C.textDim, marginBottom: 8, letterSpacing: 0.8, textTransform: 'uppercase' }}>Date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
        {dayOptions.map((d, i) => (
          <TouchableOpacity key={i} onPress={() => setSelDay(i)}
            style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 2,
              borderColor: selDay === i ? C.pink : C.glassBorder,
              backgroundColor: selDay === i ? C.pinkGlass : C.glass, alignItems: 'center', minWidth: 70 }}>
            <Text style={{ fontSize: 10, color: selDay === i ? C.pink : C.textDim, fontWeight: '800' }}>
              {i === 0 ? 'TODAY' : i === 1 ? 'TOMORROW' : d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: selDay === i ? C.pink : C.text, marginTop: 2 }}>
              {d.getDate()}
            </Text>
            <Text style={{ fontSize: 9, color: C.textDim }}>
              {d.toLocaleDateString('en-IN', { month: 'short' })}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Time selector */}
      <Text style={{ fontSize: 11, fontWeight: '800', color: C.textDim, marginBottom: 8, letterSpacing: 0.8, textTransform: 'uppercase' }}>Time</Text>

      {/* AM / PM toggle */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {(['AM','PM'] as const).map(ap => (
          <TouchableOpacity key={ap} onPress={() => setSelAmPm(ap)}
            style={{ flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center',
              backgroundColor: selAmPm === ap ? C.pink : C.glass,
              borderWidth: 1.5, borderColor: selAmPm === ap ? C.pink : C.glassBorder }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: selAmPm === ap ? '#fff' : C.textMuted }}>{ap}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Hours — 3×4 grid, no scroll */}
      <Text style={{ fontSize: 10, fontWeight: '700', color: C.textDim, marginBottom: 6 }}>Hour</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {hours.map(h => (
          <TouchableOpacity key={h} onPress={() => setSelHour(h)}
            style={{ width: '30%', paddingVertical: 10, borderRadius: 10, alignItems: 'center',
              backgroundColor: selHour === h ? C.pink : C.glass,
              borderWidth: 1.5, borderColor: selHour === h ? C.pink : C.glassBorder }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: selHour === h ? '#fff' : C.text }}>
              {String(h).padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Minutes — 4 buttons in a row */}
      <Text style={{ fontSize: 10, fontWeight: '700', color: C.textDim, marginBottom: 6 }}>Minute</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {mins.map(m => (
          <TouchableOpacity key={m} onPress={() => setSelMin(m)}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
              backgroundColor: selMin === m ? C.pink : C.glass,
              borderWidth: 1.5, borderColor: selMin === m ? C.pink : C.glassBorder }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: selMin === m ? '#fff' : C.text }}>
              :{String(m).padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {!!timeError && (
        <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}>
          <Text style={{ color: C.red, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{timeError}</Text>
        </View>
      )}
    </View>
  );
}

export function ScheduledRideScreen() {
  const { setScreen, phone, userCoords, appConfig } = useApp();

  // Form state
  const defaultTime = new Date(Date.now() + 60 * 60 * 1000); // 1hr from now
  const [pickup, setPickup]       = useState('');
  const [drop, setDrop]           = useState('');
  const [pickupCoords, setPickupCoords] = useState<any>(null);
  const [dropCoords, setDropCoords]     = useState<any>(null);
  const [vehicle, setVehicle]     = useState('auto');
  const [schedTime, setSchedTime] = useState(defaultTime);
  const [notes, setNotes]         = useState('');
  const [pickupSugg, setPickupSugg] = useState<any[]>([]);
  const [dropSugg, setDropSugg]     = useState<any[]>([]);
  const puDebRef = useRef<any>(null);
  const drDebRef = useRef<any>(null);

  // UI state
  const [step, setStep]           = useState<'form' | 'list'>('list');
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState('');
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [fareEst, setFareEst]         = useState<number | null>(null);
  const [fareBreakdown, setFareBreakdown] = useState<any>(null);
  const [fareLoading, setFareLoading] = useState(false);

  // Real fare from server whenever coords or vehicle change
  useEffect(() => {
    if (!pickupCoords || !dropCoords) { setFareEst(null); setFareBreakdown(null); return; }
    setFareLoading(true);
    fetch(`${API}/api/fare-estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickup_lat: pickupCoords.lat, pickup_lng: pickupCoords.lng, drop_lat: dropCoords.lat, drop_lng: dropCoords.lng, ride_type: vehicle }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.fare) { setFareEst(d.fare); setFareBreakdown(d); }
        else { setFareEst(null); setFareBreakdown(null); }
      })
      .catch(() => { setFareEst(null); setFareBreakdown(null); })
      .finally(() => setFareLoading(false));
  }, [pickupCoords, dropCoords, vehicle]);

  const useCurrentLocationPickup = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission', 'Location permission chahiye'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      setPickupCoords({ lat, lng });
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}&language=en`);
      const d = await r.json();
      const addr = d.results?.[0]?.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setPickup(addr);
      setPickupSugg([]);
    } catch { Alert.alert('Error', 'Location nahi mili — manually daalo'); }
  };

  useEffect(() => { loadScheduled(); }, []);

  const loadScheduled = async () => {
    setListLoading(true);
    try {
      const d = await apiGet(`/api/rides/scheduled/${phone}`);
      if (!d._error) setScheduled(d.rides || []);
    } catch (_e) {}
    setListLoading(false);
  };

  const searchPlaces = (text: string, type: 'pickup' | 'drop') => {
    if (text.length < 3) { type === 'pickup' ? setPickupSugg([]) : setDropSugg([]); return; }
    const ref = type === 'pickup' ? puDebRef : drDebRef;
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(async () => {
      try {
        const d = await externalGet(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${MAPS_KEY}&components=country:in`);
        const sugg = (d?.predictions || []).map((p: any) => ({ id: p.place_id, text: p.description }));
        type === 'pickup' ? setPickupSugg(sugg) : setDropSugg(sugg);
      } catch (_e) {}
    }, 380);
  };

  const geocode = async (address: string, type: 'pickup' | 'drop') => {
    try {
      const d = await externalGet(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`);
      const loc = d?.results?.[0]?.geometry?.location;
      if (loc) type === 'pickup' ? setPickupCoords({ lat: loc.lat, lng: loc.lng }) : setDropCoords({ lat: loc.lat, lng: loc.lng });
    } catch (_e) {}
  };

  const bookScheduled = async () => {
    if (!pickup.trim()) { setMsg('⚠️ Pickup location daalo'); return; }
    if (!drop.trim())   { setMsg('⚠️ Drop location daalo'); return; }
    if (schedTime <= new Date(Date.now() + 29 * 60 * 1000)) { setMsg('⚠️ Kam se kam 30 min aage schedule karo'); return; }
    setLoading(true); setMsg('');
    try {
      const d = await apiPost('/api/rides/schedule', {
        customer_phone: phone,
        pickup, drop_location: drop,
        pickup_lat: pickupCoords?.lat, pickup_lng: pickupCoords?.lng,
        drop_lat: dropCoords?.lat, drop_lng: dropCoords?.lng,
        vehicle_type: vehicle,
        scheduled_at: schedTime.toISOString(),
        fare_estimate: fareEst || 0,
        notes: notes.trim() || null,
      });
      if (d.success) {
        setMsg('');
        Alert.alert('✅ Ride Scheduled!', `Aapki ride ${schedTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ko ${schedTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ke liye book ho gayi.`, [{ text: 'OK', onPress: () => { setStep('list'); setPickup(''); setDrop(''); loadScheduled(); } }]);
      } else {
        setMsg('❌ ' + (d.error || 'Kuch galat hua'));
      }
    } catch (_e) { setMsg('❌ Server se connect nahi ho saka'); }
    setLoading(false);
  };

  const cancelScheduled = (id: number) => {
    Alert.alert('Ride Cancel Karein?', 'Yeh scheduled ride cancel ho jayegi.', [
      { text: 'Nahi', style: 'cancel' },
      { text: 'Haan, Cancel Karo', style: 'destructive', onPress: async () => {
        try {
          const { API } = await import('../../api');
          const res = await fetch(`${API}/api/rides/scheduled/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
          });
          const data = await res.json();
          if (data.success) loadScheduled();
        } catch (_e) {}
      }},
    ]);
  };

  const fmt = (d: any) => {
    const dt = new Date(d);
    return `${dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })} · ${dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const vEmoji: any = { bike:'🏍️', auto:'🛺', eriksha:'🛵', car:'🚕', green_bike:'⚡', electric_auto:'🌿' };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DotBG />

      {/* Top bar */}
      <View style={{ backgroundColor: C.plum, paddingTop: Platform.OS === 'android' ? 44 : 52, paddingBottom: SP.md, paddingHorizontal: SP.md, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,45,120,0.09)', top: -80, right: -60 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SP.md }}>
          <TouchableOpacity onPress={() => setScreen('home')} style={{ marginRight: 14, padding: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: R.sm, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)' }}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ ...T.title, color: '#fff' }}>Scheduled Rides</Text>
            <Text style={{ ...T.caption, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Pehle se book karo, tension-free!</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['list', 'form'] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setStep(t)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: R.sm, alignItems: 'center',
                backgroundColor: step === t ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.07)',
                borderWidth: 1.5, borderColor: step === t ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)' }}>
              <Text style={{ ...T.caption, color: '#fff', fontWeight: step === t ? '900' as const : '600' as const }}>
                {t === 'list' ? '📋 Meri Rides' : '➕ Naya Schedule'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {step === 'list' && (
          <>
            {listLoading ? (
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Text style={{ fontSize: 13, color: C.textMuted }}>⏳ Dhundh rahe hain...</Text>
              </View>
            ) : scheduled.length === 0 ? (
              <SlideUp>
                <View style={{ alignItems: 'center', paddingTop: 50, paddingBottom: 20 }}>
                  <Text style={{ fontSize: 56, marginBottom: 16 }}>📅</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 8 }}>Koi Scheduled Ride Nahi</Text>
                  <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingHorizontal: 30, lineHeight: 20, marginBottom: 28 }}>
                    Airport, doctor appointment, morning office — pehle se book karo aur tension-free raho!
                  </Text>
                  <TouchableOpacity onPress={() => setStep('form')}
                    style={{ backgroundColor: C.pink, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 14, elevation: 8, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>➕ Pehli Ride Schedule Karo</Text>
                  </TouchableOpacity>
                </View>
              </SlideUp>
            ) : (
              <>
                {scheduled.map((r, i) => (
                  <SlideUp key={r.id} delay={i * 60}>
                    <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 16, marginBottom: 12, elevation: 5, borderWidth: 1.5, borderColor: C.glassBorder, shadowColor: C.pink, shadowOpacity: 0.08, shadowRadius: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.pinkGlass, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1.5, borderColor: C.pinkBorder }}>
                          <Text style={{ fontSize: 22 }}>{vEmoji[r.vehicle_type] || '🚗'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '900', color: C.pink }}>{fmt(r.scheduled_at)}</Text>
                          <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                            {(r.vehicle_type || '').replace('_', ' ').toUpperCase()}
                            {r.fare_estimate > 0 ? ` · ~₹${r.fare_estimate}` : ''}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: C.greenGlass, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.greenBorder }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: C.green }}>SCHEDULED</Text>
                        </View>
                      </View>
                      <View style={{ backgroundColor: C.glass, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.glassBorder }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                          <Text style={{ fontSize: 14, marginRight: 8 }}>📍</Text>
                          <Text style={{ color: C.text, fontSize: 13, flex: 1, fontWeight: '600' }} numberOfLines={2}>{r.pickup}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                          <Text style={{ fontSize: 14, marginRight: 8 }}>🎯</Text>
                          <Text style={{ color: C.textMuted, fontSize: 13, flex: 1 }} numberOfLines={2}>{r.drop_location}</Text>
                        </View>
                      </View>
                      {r.notes ? (
                        <Text style={{ fontSize: 11, color: C.textDim, marginBottom: 10, fontStyle: 'italic' }}>📝 {r.notes}</Text>
                      ) : null}
                      <TouchableOpacity onPress={() => cancelScheduled(r.id)}
                        style={{ backgroundColor: C.redGlass, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: C.redBorder }}>
                        <Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>✕ Cancel This Ride</Text>
                      </TouchableOpacity>
                    </View>
                  </SlideUp>
                ))}
                <TouchableOpacity onPress={() => setStep('form')}
                  style={{ backgroundColor: C.pink, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 8, elevation: 6, shadowColor: C.pink, shadowOpacity: 0.35, shadowRadius: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>➕ Naya Ride Schedule Karo</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {step === 'form' && (
          <SlideUp>
            {/* Pickup */}
            <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 16, marginBottom: 12, elevation: 4, borderWidth: 1, borderColor: C.glassBorder }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, marginBottom: 10 }}>📍 Pickup Location</Text>
              <View style={{ backgroundColor: C.glass, borderRadius: 12, borderWidth: 1.5, borderColor: pickup ? C.green : C.glassBorder, overflow: 'hidden' }}>
                <TextInput
                  style={{ fontSize: 14, color: C.text, padding: 12 }}
                  placeholder="Kahan se pickup?"
                  placeholderTextColor={C.textDim}
                  value={pickup}
                  onChangeText={t => { setPickup(t); setPickupCoords(null); searchPlaces(t, 'pickup'); }}
                />
                <TouchableOpacity onPress={useCurrentLocationPickup} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: C.glassBorder, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: C.pinkGlass }}>
                  <Text style={{ fontSize: 14, marginRight: 6 }}>🎯</Text>
                  <Text style={{ fontSize: 12, color: C.pink, fontWeight: '700' }}>Current Location Use Karo</Text>
                </TouchableOpacity>
              </View>
              {pickupSugg.length > 0 && (
                <View style={{ backgroundColor: C.bgCard, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: C.glassBorder, elevation: 8 }}>
                  {pickupSugg.slice(0, 5).map((sg, i) => (
                    <TouchableOpacity key={i} style={{ padding: 12, borderBottomWidth: i < Math.min(pickupSugg.length,5)-1 ? 1 : 0, borderBottomColor: C.glass }}
                      onPress={() => { setPickup(sg.text); setPickupSugg([]); geocode(sg.text, 'pickup'); }}>
                      <Text style={{ fontSize: 13, color: C.text }} numberOfLines={2}>📍 {sg.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, marginTop: 14, marginBottom: 10 }}>🎯 Drop Location</Text>
              <TextInput
                style={{ borderWidth: 1.5, borderColor: drop ? C.pink : C.glassBorder, borderRadius: 12, padding: 12, fontSize: 14, color: C.text, backgroundColor: C.glass }}
                placeholder="Kahan tak jaana hai?"
                placeholderTextColor={C.textDim}
                value={drop}
                onChangeText={t => { setDrop(t); setDropCoords(null); searchPlaces(t, 'drop'); }}
              />
              {dropSugg.length > 0 && (
                <View style={{ backgroundColor: C.bgCard, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: C.glassBorder, elevation: 8 }}>
                  {dropSugg.slice(0, 5).map((sg, i) => (
                    <TouchableOpacity key={i} style={{ padding: 12, borderBottomWidth: i < Math.min(dropSugg.length,5)-1 ? 1 : 0, borderBottomColor: C.glass }}
                      onPress={() => { setDrop(sg.text); setDropSugg([]); geocode(sg.text, 'drop'); }}>
                      <Text style={{ fontSize: 13, color: C.text }} numberOfLines={2}>🎯 {sg.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Vehicle */}
            <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 16, marginBottom: 12, elevation: 4, borderWidth: 1, borderColor: C.glassBorder }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, marginBottom: 10 }}>🚗 Vehicle Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {VEHICLE_OPTIONS.map(v => (
                  <TouchableOpacity key={v.id} onPress={() => setVehicle(v.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 2,
                      borderColor: vehicle === v.id ? C.pink : C.glassBorder,
                      backgroundColor: vehicle === v.id ? C.pinkGlass : C.glass }}>
                    <Text style={{ fontSize: 18 }}>{v.emoji}</Text>
                    <View>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: vehicle === v.id ? C.pink : C.text }}>{v.label}</Text>
                      <Text style={{ fontSize: 9, color: C.textDim }}>{v.price}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Time picker */}
            <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 16, marginBottom: 12, elevation: 4, borderWidth: 1, borderColor: C.glassBorder }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, marginBottom: 14 }}>⏰ Date & Time</Text>
              <TimePicker value={schedTime} onChange={setSchedTime} />
              <View style={{ backgroundColor: C.greenGlass, borderRadius: 12, padding: 10, marginTop: 14, borderWidth: 1, borderColor: C.greenBorder }}>
                <Text style={{ color: C.green, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
                  📅 {fmt(schedTime)}
                </Text>
              </View>
              {(() => {
                const h = schedTime.getHours();
                const isPeak = (h >= 7 && h < 10) || (h >= 17 && h < 21);
                const isNight = h >= 22 || h < 6;
                if (isPeak) return (
                  <View style={{ backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 10, padding: 10, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' }}>
                    <Text style={{ fontSize: 16 }}>🚦</Text>
                    <Text style={{ color: C.yellow, fontSize: 12, flex: 1 }}>Peak traffic hours — surge pricing lag sakti hai. Thoda pehle ya baad schedule karo.</Text>
                  </View>
                );
                if (isNight) return (
                  <View style={{ backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: 10, padding: 10, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' }}>
                    <Text style={{ fontSize: 16 }}>🌙</Text>
                    <Text style={{ color: '#818CF8', fontSize: 12, flex: 1 }}>Raat ka time — 1.2x night surcharge apply hogi. Driver dhundhne mein thoda zyada waqt lag sakta hai.</Text>
                  </View>
                );
                return null;
              })()}
            </View>

            {/* Notes */}
            <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 16, marginBottom: 16, elevation: 4, borderWidth: 1, borderColor: C.glassBorder }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, marginBottom: 10 }}>📝 Notes (optional)</Text>
              <TextInput
                style={{ borderWidth: 1.5, borderColor: C.glassBorder, borderRadius: 12, padding: 12, fontSize: 14, color: C.text, backgroundColor: C.glass, minHeight: 60, textAlignVertical: 'top' }}
                placeholder="Koi special instruction? (jaise floor number, gate, etc.)"
                placeholderTextColor={C.textDim}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>

            {/* Fare Estimate */}
            {fareLoading && (
              <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.glassBorder, alignItems: 'center' }}>
                <Text style={{ color: C.textMuted, fontSize: 13 }}>⏳ Fare calculate ho raha hai...</Text>
              </View>
            )}
            {!fareLoading && fareEst !== null && fareBreakdown && (
              <View style={{ backgroundColor: C.greenGlass, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1.5, borderColor: C.greenBorder }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: C.green, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>💰 Fare Breakdown</Text>
                {[
                  ['Base Fare',                           `₹${fareBreakdown.base_fare}`],
                  [`Distance (${fareBreakdown.distance_km} km × ₹${fareBreakdown.per_km_rate}/km)`, `₹${Math.round(fareBreakdown.distance_km * fareBreakdown.per_km_rate)}`],
                  ...(fareBreakdown.is_night ? [[`🌙 Night Surcharge (${fareBreakdown.night_multiplier}x)`, 'Applied']] : []),
                ].map(([k, v], i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.greenBorder }}>
                    <Text style={{ color: C.textMuted, fontSize: 12 }}>{k}</Text>
                    <Text style={{ color: C.text, fontSize: 12, fontWeight: '600' }}>{v}</Text>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.green }}>Estimated Total</Text>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: C.green }}>₹{fareEst}</Text>
                </View>
                <Text style={{ fontSize: 10, color: C.textDim, marginTop: 4, textAlign: 'center' }}>Final fare may vary slightly based on actual route</Text>
              </View>
            )}

            {!!msg && (
              <View style={{ borderRadius: 12, padding: 12, marginBottom: 14,
                backgroundColor: msg.startsWith('✅') ? C.greenGlass : C.redGlass,
                borderWidth: 1, borderColor: msg.startsWith('✅') ? C.greenBorder : C.redBorder }}>
                <Text style={{ color: msg.startsWith('✅') ? C.green : C.red, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{msg}</Text>
              </View>
            )}

            <TouchableOpacity onPress={bookScheduled} disabled={loading}
              style={{ backgroundColor: loading ? C.glass : C.pink, borderRadius: 18, padding: 18, alignItems: 'center', elevation: loading ? 0 : 10, shadowColor: C.pink, shadowOpacity: loading ? 0 : 0.5, shadowRadius: 14, borderWidth: loading ? 1 : 0, borderColor: C.glassBorder }}>
              <Text style={{ color: loading ? C.textDim : '#fff', fontWeight: '900', fontSize: 16 }}>
                {loading ? '⏳ Scheduling...' : '📅 Ride Schedule Karo'}
              </Text>
            </TouchableOpacity>
          </SlideUp>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
