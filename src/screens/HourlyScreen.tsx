import { useEffect } from 'react';
import { Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, DotBG, FloatingDots, PulseView, RideVehicleIcon, ScreenIn } from '../components/ui';
import { s, C } from '../styles';
import { MAPS_KEY } from '../constants';
import { apiGet, apiPost } from '../../api';

const hVehicleIcons: any = { auto: '🛺', bike: '🏍️', car: '🚕', eriksha: '🛵', ultra_luxury: '💎', green_bike: '⚡', electric_auto: '🌿' };
const hHourLabel = (h: number) => h >= 24 ? `${h/24} Day${h > 24 ? 's' : ''}` : h === 8 ? 'Full Day (8h)' : `${h} Hours`;
const hHourEmoji = (h: number) => h >= 72 ? '🗓️' : h >= 48 ? '📅' : h >= 24 ? '🌙' : h === 2 ? '⏱️' : h === 4 ? '🕐' : h === 6 ? '🕕' : '☀️';
const fmtTime = (sec: number) => `${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor((sec%3600)/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;

export function HourlyScreen() {
  const {
    phone,
    screen, setScreen,
    hourlyStep, setHourlyStep,
    hourlyBooking, setHourlyBooking,
    hourlyPackages,
    hVehicle, setHVehicle,
    hPackageHours, setHPackageHours,
    hPickup, setHPickup, hDrop, setHDrop,
    hPickupCoords, setHPickupCoords, hDropCoords, setHDropCoords,
    hPickupSugg, setHPickupSugg, hDropSugg, setHDropSugg,
    hPickupDebounceRef, hDropDebounceRef,
    hRoundTrip, setHRoundTrip, hStayHours, setHStayHours,
    hourlyTimerSec,
    hApproachLimit, setHApproachLimit,
    hExtendStep, setHExtendStep, hExtendStepRef,
    hExtendHours, setHExtendHours,
    hExtendMin, setHExtendMin,
    hExtendResult,
    hExtendPrevHoursRef,
    hChatOpen, setHChatOpen,
    hChatUnread, setHChatUnread,
    hChatMsgs, setHChatMsgs,
    hChatInput, setHChatInput,
    chatToast, setChatToast,
    walletBalance,
    initiateCall, joinHourlySocket, loadWallet, loadWalletDetail, loadLoyalty,
  } = useApp();

  const pkg = hourlyPackages[hVehicle]?.[hPackageHours];

  useEffect(() => {
    if (hourlyStep !== 'waiting' || !hourlyBooking?.id) return;
    if (hourlyBooking?.status === 'active') { setHourlyStep('active'); return; }
    const poll = async () => {
      try {
        const d = await apiGet(`/api/hourly/status/${hourlyBooking.id}`);
        if (d.booking?.status === 'active') {
          setHourlyBooking((p: any) => ({ ...p, status: 'active', started_at: d.booking.started_at, driver_phone: d.booking.driver_phone }));
          setHourlyStep('active');
        } else if (d.booking?.status === 'matched') {
          setHourlyBooking((p: any) => ({ ...p, ...d.booking, driver: d.driver }));
          setHourlyStep('active');
        }
      } catch (_e) {}
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, [hourlyStep, hourlyBooking?.id, hourlyBooking?.status]);

  const useCurrentLocationPickup = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { alert('Location permission chahiye'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      setHPickupCoords({ lat, lng });
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}&language=en`);
      const d = await r.json();
      const addr = d.results?.[0]?.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setHPickup(addr);
      setHPickupSugg([]);
    } catch (e) { alert('Location nahi mili — manually daalo'); }
  };

  const searchHourly = (text: string, which: 'pickup'|'drop') => {
    if (text.length < 3) { which === 'pickup' ? setHPickupSugg([]) : setHDropSugg([]); return; }
    const ref = which === 'pickup' ? hPickupDebounceRef : hDropDebounceRef;
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${MAPS_KEY}&components=country:in&location=26.8467,80.9462&radius=100000`);
        const d = await r.json();
        const list = (d.predictions || []).map((p: any) => ({ id: p.place_id, text: p.description }));
        which === 'pickup' ? setHPickupSugg(list) : setHDropSugg(list);
      } catch (_e) {}
    }, 400);
  };

  const selectHourlyPlace = async (placeId: string, text: string, which: 'pickup'|'drop') => {
    try {
      const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${MAPS_KEY}&fields=geometry`);
      const d = await r.json();
      const loc = d.result?.geometry?.location;
      if (which === 'pickup') {
        setHPickup(text); setHPickupCoords(loc || null); setHPickupSugg([]);
      } else {
        setHDrop(text); setHDropCoords(loc || null); setHDropSugg([]);
      }
    } catch (_e) {}
  };

  const bookHourly = async () => {
    if (!hPickup) { alert('Pickup location daalo'); return; }
    if (!phone) return;
    try {
      const body: any = { phone, vehicle_type: hVehicle, package_hours: hPackageHours, pickup: hPickup, pickup_lat: hPickupCoords?.lat, pickup_lng: hPickupCoords?.lng, is_roundtrip: hRoundTrip, stay_hours: hStayHours };
      if (hDrop) { body.drop_location = hDrop; body.drop_lat = hDropCoords?.lat; body.drop_lng = hDropCoords?.lng; }
      const data = await apiPost('/api/hourly/book', body);
      if (data.success) {
        setHourlyBooking({ id: data.booking_id, fare: data.fare, km_included: data.km_included, status: 'pending', vehicle_type: hVehicle, package_hours: hPackageHours, pickup: hPickup, drop_location: hDrop, is_roundtrip: hRoundTrip, stay_hours: hStayHours });
        require('@react-native-async-storage/async-storage').default.setItem('activeHourlyId', String(data.booking_id)).catch(() => {});
        joinHourlySocket(data.booking_id);
        setHourlyStep('waiting');
        loadWallet(phone);
      } else {
        alert(data.error || 'Booking nahi hui');
      }
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  const requestEarlyEnd = () => {
    if (!hourlyBooking?.id) return;
    require('react-native').Alert.alert(
      '✅ Trip Khatam Karo',
      'Kya aap trip abhi complete karna chahte hain?\n\nDriver ko FULL package payment milegi — aap koi refund nahi le sakte.',
      [
        { text: 'Wapas Jao', style: 'cancel' },
        {
          text: '✅ Haan, Complete Karo',
          onPress: async () => {
            try {
              const data = await apiPost('/api/hourly/customer-early-complete', { booking_id: hourlyBooking.id });
              if (data.success) {
                setHourlyBooking((p: any) => ({ ...p, status: 'completed', driver_earning: data.driver_earning }));
                setHourlyStep('done');
              } else {
                require('react-native').Alert.alert('Error', data.error || 'Kuch galat ho gaya — dobara try karo');
              }
            } catch (e: any) {
              require('react-native').Alert.alert('Network Error', 'Server se connect nahi hua');
            }
          }
        }
      ]
    );
  };

  const confirmEarlyEnd = async () => {
    if (!hourlyBooking?.id) return;
    const data = await apiPost('/api/hourly/early-end-confirm', { booking_id: hourlyBooking.id });
    if (data.success) { setHourlyBooking((p: any) => ({ ...p, status: 'completed', driver_earning: data.driver_earning, refund_amount: data.refund })); setHourlyStep('done'); loadWallet(phone); }
  };

  const rejectEarlyEnd = async () => {
    if (!hourlyBooking?.id) return;
    await apiPost('/api/hourly/early-end-reject', { booking_id: hourlyBooking.id });
    setHourlyBooking((p: any) => ({ ...p, early_end_requested_by: null }));
  };

  const cancelHourlyBooking = async () => {
    if (!hourlyBooking?.id) return;
    const data = await apiPost('/api/hourly/cancel', { booking_id: hourlyBooking.id, phone });
    if (data.success) { alert(`Booking cancel hui! ₹${data.refunded} wapas aayenge.`); setHourlyStep('book'); setHourlyBooking(null); setScreen('home'); loadWallet(phone); }
    else alert(data.message || 'Cancel nahi ho saka');
  };

  // ── DONE SUMMARY ──
  if (hourlyStep === 'done') {
    const b = hourlyBooking || {};
    const actualHrsFull = parseFloat(b.actual_hours || b.package_hours || hPackageHours);
    const actualHrs = Math.floor(actualHrsFull);
    const actualMins = Math.round((actualHrsFull - actualHrs) * 60);
    const extMinutes = parseInt(b.extend_total_minutes || 0);
    const extFare = parseFloat(b.extend_total_fare || 0);
    const basePkgFare = parseFloat(b.base_fare || pkg?.fare || 0) - extFare;
    const extraKmChg = parseFloat(b.extra_km_charge || 0);
    const totalPaid = parseFloat(b.total_fare || b.base_fare || pkg?.fare || 0);
    const refund = parseFloat(b.refund_amount || 0);
    return (
      <ScreenIn style={s.screen}>
        <DotBG />
        <View style={{ backgroundColor: C.pink, overflow: 'hidden', paddingTop: Platform.OS === 'android' ? 46 : 52, paddingBottom: 20, paddingHorizontal: 16, alignItems: 'center' }}>
          <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.10)', top: -60, right: -40 }} />
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>⏱️ Trip Complete!</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 60 }}>🎉</Text>
            <Text style={{ fontSize: 20, fontWeight: '900', color: C.text, marginTop: 8 }}>Trip Khatam!</Text>
            <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
              {actualHrs}h {actualMins}m chali · {b.actual_km || 0} km
            </Text>
          </View>
          <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 18, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: C.pinkBorder, elevation: 6, shadowColor: C.pink, shadowOpacity: 0.3, shadowRadius: 12 }}>
            <Text style={{ color: C.textDim, fontSize: 12, letterSpacing: 1.5 }}>TOTAL PAID</Text>
            <Text style={{ color: C.yellow, fontSize: 44, fontWeight: '900', marginTop: 4, textShadowColor: C.yellow, textShadowRadius: 10 }}>₹{totalPaid.toFixed(0)}</Text>
            <Text style={{ color: C.textDim, fontSize: 11, marginTop: 4 }}>Wallet se deducted (escrow release)</Text>
          </View>
          <View style={{ backgroundColor: C.glass, borderRadius: 18, padding: 18, elevation: 3, marginBottom: 16, borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ fontSize: 12, color: C.textDim, marginBottom: 14, fontWeight: '800', letterSpacing: 1 }}>PAYMENT BREAKDOWN</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: C.glassBorder }}>
              <View>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>Base Package</Text>
                <Text style={{ color: C.textDim, fontSize: 11 }}>{hHourLabel(b.package_hours || hPackageHours)} · {b.km_included || 0} km</Text>
              </View>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>₹{basePkgFare > 0 ? basePkgFare.toFixed(0) : (parseFloat(b.base_fare || 0) - extFare).toFixed(0)}</Text>
            </View>
            {extFare > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: C.glassBorder }}>
                <View>
                  <Text style={{ color: C.purple, fontSize: 13, fontWeight: '600' }}>⏱️ Extension</Text>
                  <Text style={{ color: C.textDim, fontSize: 11 }}>{extMinutes >= 60 ? `${Math.floor(extMinutes/60)}h ${extMinutes%60}m` : `${extMinutes} min`} extra</Text>
                </View>
                <Text style={{ color: C.purple, fontWeight: '700', fontSize: 14 }}>₹{extFare.toFixed(0)}</Text>
              </View>
            )}
            {extraKmChg > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: C.glassBorder }}>
                <View>
                  <Text style={{ color: C.yellow, fontSize: 13, fontWeight: '600' }}>Extra KM Charge</Text>
                  <Text style={{ color: C.textDim, fontSize: 11 }}>{b.extra_km || 0} km × ₹{hourlyPackages[b.vehicle_type || hVehicle]?.extra || 8}/km</Text>
                </View>
                <Text style={{ color: C.yellow, fontWeight: '700', fontSize: 14 }}>₹{extraKmChg.toFixed(0)}</Text>
              </View>
            )}
            {[
              ['Vehicle', `${hVehicleIcons[b.vehicle_type || hVehicle]} ${(b.vehicle_type || hVehicle)?.toUpperCase()}`],
              ['Actual Duration', `${actualHrs}h ${actualMins}m`],
              ['Total KM', `${b.actual_km || 0} km`],
            ].map(([k, v], i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i < 2 ? 1 : 0, borderColor: C.glassBorder }}>
                <Text style={{ color: C.textMuted, fontSize: 13 }}>{k}</Text>
                <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>{v}</Text>
              </View>
            ))}
          </View>
          {refund > 0 && (
            <View style={{ backgroundColor: C.greenGlass, borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.greenBorder }}>
              <Text style={{ fontSize: 22, marginRight: 10 }}>💰</Text>
              <Text style={{ color: C.green, fontSize: 13, flex: 1, fontWeight: '700' }}>₹{refund.toFixed(0)} aapke wallet mein wapas aa gaye!</Text>
            </View>
          )}
          <Bouncy style={s.btn} onPress={() => { setHourlyStep('book'); setHourlyBooking(null); hExtendStepRef.current = 'idle'; setHExtendStep('idle'); setHApproachLimit(null); setScreen('home'); }}>
            <Text style={s.btnTxt}>🏠 Ghar Wapas</Text>
          </Bouncy>
        </ScrollView>
      </ScreenIn>
    );
  }

  // ── ACTIVE TRIP ──
  if (hourlyStep === 'active') return (
    <ScreenIn style={s.screen}>
      <View style={{ backgroundColor: C.pink, overflow: 'hidden', paddingTop: Platform.OS === 'android' ? 46 : 52, paddingBottom: 20, paddingHorizontal: 16, alignItems: 'center' }}>
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.10)', top: -60, right: -40 }} />
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>⏱️ Hourly Trip</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {(() => {
          const minLeft = hApproachLimit?.min_left ?? null;
          const isCritical = hApproachLimit?.critical;
          const isWarn = hApproachLimit?.warn;
          const timerColor = isCritical ? C.red : isWarn ? C.yellow : C.pink;
          const remainLabel = minLeft !== null ? (minLeft >= 60 ? `${Math.floor(minLeft/60)}h ${minLeft%60}m remaining` : `${minLeft} min remaining`) : `${hHourLabel(hourlyBooking?.package_hours || hPackageHours)} package`;
          return (
            <View style={{ backgroundColor: C.bgCard, borderRadius: 22, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.glassBorder, elevation: 6 }}>
              <Text style={{ color: C.textDim, fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>ELAPSED TIME</Text>
              <Text style={{ color: timerColor, fontSize: 52, fontWeight: '900', fontVariant: ['tabular-nums'], textShadowColor: timerColor, textShadowRadius: 10 }}>{fmtTime(hourlyTimerSec)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                <Text style={{ fontSize: 12, color: isCritical ? C.red : isWarn ? C.yellow : C.green, fontWeight: '700' }}>
                  {isCritical ? '🚨' : isWarn ? '⚠️' : '⏳'} {remainLabel}
                </Text>
              </View>
            </View>
          );
        })()}

        {hourlyBooking?.status === 'matched' && (() => {
          const farAway = hourlyBooking?.scheduled_at &&
            (new Date(hourlyBooking.scheduled_at).getTime() - Date.now() > 20 * 60 * 1000);
          if (farAway) return null;
          return (
            <View style={{ backgroundColor: C.yellowGlass, borderRadius: 14, padding: 16, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: C.yellowBorder }}>
              <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 6 }}>Driver ko yeh OTP do — trip start hogi</Text>
              <Text style={{ fontSize: 38, fontWeight: '900', color: C.yellow, letterSpacing: 8, textShadowColor: C.yellow, textShadowRadius: 8 }}>{hourlyBooking?.otp}</Text>
            </View>
          );
        })()}

        <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 11, color: C.textDim, marginBottom: 8, letterSpacing: 1 }}>DRIVER</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{hourlyBooking?.driver?.name || '...'}</Text>
              {(hourlyBooking?.driver?.vehicle_brand || hourlyBooking?.driver?.vehicle_model) ? (
                <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: '600', marginTop: 1 }}>
                  {[hourlyBooking.driver.vehicle_brand, hourlyBooking.driver.vehicle_model].filter(Boolean).join(' ')}
                </Text>
              ) : null}
              <Text style={{ color: C.textDim, fontSize: 12, marginTop: 1 }}>🚗 {hourlyBooking?.driver?.vehicle_no || '...'}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Bouncy style={{ backgroundColor: C.greenGlass, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: C.greenBorder }}
                onPress={() => initiateCall(null, hourlyBooking?.id)}>
                <Ionicons name="call" size={18} color={C.green} />
                <Text style={{ fontSize: 9, color: C.green, fontWeight: '700', marginTop: 2 }}>Call</Text>
              </Bouncy>
              <Bouncy style={{ backgroundColor: hChatOpen ? C.bgCard : C.glassMid, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: hChatOpen ? C.pink : C.glassBorder }}
                onPress={() => { setHChatOpen((o: boolean) => !o); setHChatUnread(0); setChatToast(null); }}>
                {hChatUnread > 0 && !hChatOpen && (
                  <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: C.pink, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{hChatUnread}</Text>
                  </View>
                )}
                <Ionicons name="chatbubble" size={18} color={hChatOpen ? C.pink : C.textMuted} />
                <Text style={{ fontSize: 9, color: hChatOpen ? C.pink : C.textMuted, fontWeight: '700', marginTop: 2 }}>Chat</Text>
              </Bouncy>
            </View>
          </View>
        </View>

        {chatToast && !hChatOpen && (
          <TouchableOpacity
            style={{ backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(233,69,96,0.45)', elevation: 8 }}
            onPress={() => { setChatToast(null); setHChatOpen(true); setHChatUnread(0); }}>
            <Ionicons name="chatbubble" size={16} color={C.pink} />
            <Text style={{ color: '#fff', fontSize: 13, flex: 1, fontWeight: '600' }} numberOfLines={1}>{chatToast}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>Tap to reply</Text>
          </TouchableOpacity>
        )}

        {hChatOpen && (
          <View style={{ backgroundColor: C.glass, borderRadius: 16, marginBottom: 16, elevation: 3, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder }}>
            <View style={{ backgroundColor: C.bgCard, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: C.glassBorder }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>💬 Driver se Chat</Text>
              <TouchableOpacity onPress={() => setHChatOpen(false)}><Text style={{ color: C.textMuted, fontSize: 18 }}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 200, padding: 10 }} keyboardShouldPersistTaps="handled">
              {hChatMsgs.length === 0 && (
                <Text style={{ color: C.textDim, fontSize: 12, textAlign: 'center', marginTop: 20, marginBottom: 20 }}>Koi message nahi — pehla message bhejo</Text>
              )}
              {hChatMsgs.map((m: any, i: number) => (
                <View key={i} style={{ alignItems: m.sender === 'customer' ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
                  <View style={{ backgroundColor: m.sender === 'customer' ? C.pink : C.glassMid, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '80%' }}>
                    <Text style={{ color: m.sender === 'customer' ? '#fff' : C.text, fontSize: 13 }}>{m.message}</Text>
                  </View>
                  <Text style={{ color: C.textDim, fontSize: 9, marginTop: 2 }}>{m.sender === 'customer' ? 'Aap' : 'Driver'}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', padding: 8, borderTopWidth: 1, borderColor: C.glassBorder, gap: 8 }}>
              <TextInput
                style={{ flex: 1, backgroundColor: C.glassMid, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13, color: C.text, borderWidth: 1, borderColor: C.glassBorder }}
                placeholder="Message likhein..." placeholderTextColor={C.textDim}
                value={hChatInput} onChangeText={setHChatInput}
                returnKeyType="send"
                onSubmitEditing={async () => {
                  const msg = hChatInput.trim();
                  if (!msg || !hourlyBooking?.id) return;
                  setHChatInput('');
                  await apiPost('/api/hourly/chat/send', { booking_id: hourlyBooking.id, sender: 'customer', message: msg });
                  const d = await apiGet(`/api/hourly/chat/${hourlyBooking.id}`);
                  setHChatMsgs(d.messages || []);
                }}
              />
              <Bouncy style={{ backgroundColor: C.pink, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center', elevation: 4, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 6 }}
                onPress={async () => {
                  const msg = hChatInput.trim();
                  if (!msg || !hourlyBooking?.id) return;
                  setHChatInput('');
                  await apiPost('/api/hourly/chat/send', { booking_id: hourlyBooking.id, sender: 'customer', message: msg });
                  const d = await apiGet(`/api/hourly/chat/${hourlyBooking.id}`);
                  setHChatMsgs(d.messages || []);
                }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Send</Text>
              </Bouncy>
            </View>
          </View>
        )}

        <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
          {[
            ['Pickup', hourlyBooking?.pickup || hPickup],
            ['Pehla Stop', hourlyBooking?.drop_location || hDrop || 'Flexible — driver ke sath jaao'],
            ['Round Trip', (hourlyBooking?.is_roundtrip || hRoundTrip) ? '✅ Haan' : 'Nahi'],
            ['KM Included', `${hourlyBooking?.km_included} km`],
            ['Extra KM Rate', `₹${hourlyPackages[hourlyBooking?.vehicle_type || hVehicle]?.extra}/km`],
          ].map(([k, v], i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: i < 4 ? 1 : 0, borderColor: C.glassBorder }}>
              <Text style={{ color: C.textMuted, fontSize: 13 }}>{k}</Text>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' }} numberOfLines={1}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: C.greenGlass, borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.greenBorder }}>
          <Text style={{ fontSize: 18, marginRight: 8 }}>✅</Text>
          <Text style={{ color: C.green, fontSize: 12, flex: 1, fontWeight: '600' }}>₹{hourlyBooking?.base_fare} paid & held safely. Trip khatam hone par driver ko milega.</Text>
        </View>

        {hourlyBooking?.status === 'active' && hApproachLimit && (() => {
          const traveled = parseFloat(hourlyBooking.actual_km || 0);
          const included = parseFloat(hourlyBooking.km_included || 0);
          const extraKm = Math.max(0, traveled - included);
          const extraRate = hourlyPackages[hourlyBooking.vehicle_type || hVehicle]?.extra || 8;
          const extraCharge = Math.round(extraKm * extraRate);
          return (
            <View style={{ backgroundColor: extraKm > 0 ? C.redGlass : C.greenGlass, borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: extraKm > 0 ? C.redBorder : C.greenBorder }}>
              <Text style={{ fontSize: 18, marginRight: 10 }}>🛣️</Text>
              <View style={{ flex: 1 }}>
                {extraKm > 0 ? (
                  <>
                    <Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>+{extraKm.toFixed(1)} km extra — ₹{extraCharge} trip end pe pay karein</Text>
                    <Text style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{included} km package mein | ab tak: {traveled.toFixed(1)} km</Text>
                  </>
                ) : (
                  <Text style={{ color: C.green, fontSize: 12, fontWeight: '600' }}>
                    {traveled.toFixed(1)} / {included} km — Package limit safe hai ✓
                  </Text>
                )}
              </View>
              <Text style={{ fontSize: 11, color: C.textDim }}>⏰ {hApproachLimit.min_left}m left</Text>
            </View>
          );
        })()}

        {hApproachLimit?.warn && hourlyBooking?.status === 'active' && (
          <View style={{ backgroundColor: hApproachLimit.critical ? C.redGlass : C.yellowGlass, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 2, borderColor: hApproachLimit.critical ? C.redBorder : C.yellowBorder, flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 20, marginRight: 10 }}>{hApproachLimit.critical ? '🚨' : '⚠️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: hApproachLimit.critical ? C.red : C.yellow, fontSize: 14, marginBottom: 4 }}>
                {hApproachLimit.critical ? 'Sirf ~' + hApproachLimit.min_left + ' min bacha!' : '⏰ ~' + hApproachLimit.min_left + ' minute bacha hai'}
              </Text>
              {hApproachLimit.is_roundtrip ? (
                <Text style={{ color: hApproachLimit.critical ? C.red : C.yellow, fontSize: 12, fontWeight: '700' }}>
                  🔄 Round Trip — Abhi wapas pickup ke liye chalo!
                </Text>
              ) : (
                <Text style={{ color: hApproachLimit.critical ? C.red : C.textMuted, fontSize: 12 }}>
                  Trip extend karo ya driver se wrap up karo
                </Text>
              )}
              {hExtendStep === 'idle' && (
                <TouchableOpacity onPress={() => { hExtendStepRef.current = 'choose'; setHExtendStep('choose'); }}
                  style={{ marginTop: 8, backgroundColor: hApproachLimit.is_roundtrip ? C.glassMid : C.yellowGlass, borderRadius: 8, padding: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: hApproachLimit.is_roundtrip ? C.glassBorder : C.yellowBorder }}>
                  <Text style={{ color: hApproachLimit.is_roundtrip ? C.purple : C.yellow, fontSize: 12, fontWeight: '800' }}>
                    {hApproachLimit.is_roundtrip ? '⏱️ Extension Chahiye?' : '⏱️ Extend Karo'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {hExtendStep === 'choose' && (
          <View style={{ backgroundColor: C.glass, borderRadius: 18, padding: 16, marginBottom: 16, elevation: 3, borderWidth: 2, borderColor: C.pinkBorder }}>
            <Text style={{ fontWeight: '900', color: C.text, fontSize: 15, marginBottom: 12 }}>⏱️ Trip Extend Karo</Text>
            <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 8 }}>Extra Hours:</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {[0, 1, 2, 3, 4].map(h => (
                <Bouncy key={h} onPress={() => { setHExtendHours(h); if (h > 0) setHExtendMin(0); }} style={{ flex: 1, backgroundColor: hExtendHours === h ? C.bgCard : C.glassMid, borderRadius: 10, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: hExtendHours === h ? C.pinkBorder : C.glassBorder }}>
                  <Text style={{ color: hExtendHours === h ? C.pink : C.textMuted, fontWeight: '800', fontSize: 11 }}>{h === 0 ? 'Min' : `+${h}h`}</Text>
                </Bouncy>
              ))}
            </View>
            <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 8 }}>
              {hExtendHours === 0 ? 'Extra Minutes (minimum 15):' : 'Extra Minutes (optional):'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(hExtendHours === 0 ? [15, 30, 45, 60] : [0, 15, 30, 45]).map(m => (
                <Bouncy key={m} onPress={() => setHExtendMin(m)} style={{ flex: 1, backgroundColor: hExtendMin === m ? C.bgCard : C.glassMid, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: hExtendMin === m ? C.pinkBorder : C.glassBorder }}>
                  <Text style={{ color: hExtendMin === m ? C.pink : C.textMuted, fontWeight: '800', fontSize: 12 }}>
                    {hExtendHours === 0 ? `${m}m` : m === 0 ? 'None' : `+${m}m`}
                  </Text>
                </Bouncy>
              ))}
            </View>
            {(hExtendHours > 0 || hExtendMin >= 15) && (
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
                Extension: {hExtendHours > 0 && hExtendMin > 0 ? `${hExtendHours}h ${hExtendMin}m` : hExtendHours > 0 ? `${hExtendHours} hour${hExtendHours > 1 ? 's' : ''}` : `${hExtendMin} minutes`}
              </Text>
            )}
            {(hExtendHours > 0 || hExtendMin >= 15) && (() => {
              const pkgData = hourlyPackages[hourlyBooking?.vehicle_type || hVehicle];
              const totalDecimal = hExtendHours + hExtendMin / 60;
              let cost = 0;
              if (hExtendMin === 0 && hExtendHours >= 1 && pkgData?.[hExtendHours]) {
                cost = pkgData[hExtendHours].fare;
              } else {
                const perHr = (hourlyBooking?.base_fare || 0) / (hourlyBooking?.package_hours || 1);
                cost = Math.round(perHr * totalDecimal);
              }
              const extraKm = hExtendMin === 0 && hExtendHours >= 1 && pkgData?.[hExtendHours]
                ? pkgData[hExtendHours].km
                : Math.round((hourlyBooking?.km_included || 0) / (hourlyBooking?.package_hours || 1) * totalDecimal);
              return (
                <View style={{ backgroundColor: C.glassMid, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.glassBorder }}>
                  <Text style={{ fontWeight: '800', color: C.yellow, fontSize: 15 }}>Estimated Cost: ₹{cost}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>+{extraKm} km included · extra ₹{pkgData?.extra || 8}/km</Text>
                  <Text style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>Wallet se deduct hoga — driver ke accept karne par</Text>
                </View>
              );
            })()}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Bouncy style={{ flex: 1, backgroundColor: C.glassMid, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder }} onPress={() => { hExtendStepRef.current = 'idle'; setHExtendStep('idle'); setHExtendHours(1); setHExtendMin(0); }}>
                <Text style={{ color: C.textMuted, fontWeight: '700' }}>Cancel</Text>
              </Bouncy>
              <Bouncy
                style={{ flex: 2, backgroundColor: (hExtendHours > 0 || hExtendMin >= 15) ? C.pink : C.glassMid, borderRadius: 12, padding: 12, alignItems: 'center', elevation: 4, shadowColor: C.pink, shadowOpacity: 0.35, shadowRadius: 8 }}
                onPress={async () => {
                  if (hExtendHours === 0 && hExtendMin < 15) { alert('Minimum 15 minute extension'); return; }
                  try {
                    const data = await apiPost('/api/hourly/request-extend-v2', { booking_id: hourlyBooking.id, extra_hours: hExtendHours, extra_minutes: hExtendMin, customer_phone: phone });
                    if (data.success) {
                      hExtendPrevHoursRef.current = parseFloat(hourlyBooking?.package_hours || 0);
                      hExtendStepRef.current = 'pending';
                      setHExtendStep('pending');
                      setHourlyBooking((p: any) => ({ ...p, extend_requested_hours: hExtendHours + hExtendMin / 60 }));
                      loadWallet(phone);
                      alert(`✅ Request bheji! ₹${data.extra_fare} hold ho gaye — driver ka intezaar karo`);
                    } else {
                      alert(data.message || 'Request nahi bheji ja saki');
                    }
                  } catch (_e) { alert('Error — dobara try karo'); }
                }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>📤 Driver ko Request Bhejo</Text>
              </Bouncy>
            </View>
          </View>
        )}

        {hExtendResult === 'accepted' && (
          <View style={{ backgroundColor: C.greenGlass, borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: C.green, borderWidth: 1, borderColor: C.greenBorder }}>
            <Text style={{ fontSize: 22, marginRight: 10 }}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: C.green, fontSize: 14 }}>Extension Approve Ho Gaya!</Text>
              <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>Trip aur {parseFloat(hourlyBooking?.package_hours || 0) > hExtendPrevHoursRef.current ? `${Math.round((parseFloat(hourlyBooking?.package_hours || 0) - hExtendPrevHoursRef.current) * 60)} minute` : ''} extend ho gayi</Text>
            </View>
          </View>
        )}
        {hExtendResult === 'rejected' && (
          <View style={{ backgroundColor: C.redGlass, borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: C.red, borderWidth: 1, borderColor: C.redBorder }}>
            <Text style={{ fontSize: 22, marginRight: 10 }}>❌</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: C.red, fontSize: 14 }}>Extension Reject Ho Gaya</Text>
              <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>Driver ne reject kiya — paise wapas wallet mein aa gaye</Text>
            </View>
          </View>
        )}

        {hExtendStep === 'pending' && (
          <View style={{ backgroundColor: C.glassMid, borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ fontSize: 20, marginRight: 10 }}>⏳</Text>
            <View>
              <Text style={{ fontWeight: '800', color: C.purple, fontSize: 13 }}>Extension Request Pending</Text>
              <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>Driver ke response ka intezaar... ₹{Math.round(hourlyBooking?.extend_escrow || 0)} hold mein</Text>
            </View>
          </View>
        )}

        {!hApproachLimit?.warn && hExtendStep === 'idle' && hourlyBooking?.status === 'active' && !hourlyBooking?.extend_requested_hours && (
          <Bouncy style={{ backgroundColor: C.glassMid, borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.glassBorder }} onPress={() => { hExtendStepRef.current = 'choose'; setHExtendStep('choose'); }}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>⏱️</Text>
            <Text style={{ color: C.purple, fontWeight: '800' }}>Trip Extend Karo</Text>
          </Bouncy>
        )}

        {hourlyBooking?.pending_customer_confirm && (
          <View style={{ backgroundColor: C.yellowGlass, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: C.yellowBorder }}>
            <Text style={{ fontWeight: '900', color: C.yellow, marginBottom: 4, fontSize: 16 }}>⚠️ Driver ne Trip Complete Kiya!</Text>
            <Text style={{ color: C.textMuted, fontSize: 13, marginBottom: 4 }}>Kya trip actually complete hui? Confirm karo ya dispute karo.</Text>
            <Text style={{ color: C.textDim, fontSize: 11, marginBottom: 14 }}>10 min mein auto-confirm ho jayega</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Bouncy style={{ flex: 1, backgroundColor: C.green, borderRadius: 12, padding: 14, alignItems: 'center', elevation: 4, shadowColor: C.green, shadowOpacity: 0.35, shadowRadius: 8 }}
                onPress={async () => {
                  try {
                    await apiPost('/api/hourly/customer-confirm-complete', { booking_id: hourlyBooking.id });
                    setHourlyStep('done'); loadWallet(phone);
                  } catch (_e) {}
                }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>✅ Confirm</Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>Trip khatam hui</Text>
              </Bouncy>
              <Bouncy style={{ flex: 1, backgroundColor: C.redGlass, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.redBorder }}
                onPress={async () => {
                  try {
                    await apiPost('/api/hourly/customer-dispute-complete', { booking_id: hourlyBooking.id, reason: 'Driver abandoned customer' });
                    setHourlyBooking((p: any) => ({ ...p, pending_customer_confirm: false, dispute_raised: true }));
                  } catch (_e) {}
                }}>
                <Text style={{ color: C.red, fontWeight: '900', fontSize: 15 }}>⚠️ Dispute</Text>
                <Text style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>Driver chhod gaya</Text>
              </Bouncy>
            </View>
          </View>
        )}

        {hourlyBooking?.dispute_raised && (
          <View style={{ backgroundColor: C.redGlass, borderRadius: 14, padding: 14, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: C.redBorder }}>
            <Text style={{ fontWeight: '900', color: C.red, marginBottom: 4 }}>🛡️ Dispute Raised — Admin Review Mein</Text>
            <Text style={{ color: C.textMuted, fontSize: 12 }}>24h mein resolve hoga — paise escrow mein safe hain</Text>
          </View>
        )}

        {hourlyBooking?.early_end_requested_by === 'driver' && (
          <View style={{ backgroundColor: C.yellowGlass, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.yellowBorder }}>
            <Text style={{ fontWeight: '900', color: C.yellow, marginBottom: 6 }}>⚠️ Driver Trip Khatam Karna Chahta Hai</Text>
            <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 12 }}>Confirm karne par proportional payment hogi (min 70% driver ko).</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Bouncy style={{ flex: 1, backgroundColor: C.green, borderRadius: 12, padding: 12, alignItems: 'center', elevation: 3, shadowColor: C.green, shadowOpacity: 0.3, shadowRadius: 6 }} onPress={confirmEarlyEnd}><Text style={{ color: '#fff', fontWeight: '800' }}>✅ Confirm</Text></Bouncy>
              <Bouncy style={{ flex: 1, backgroundColor: C.glassMid, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder }} onPress={rejectEarlyEnd}><Text style={{ color: C.textMuted, fontWeight: '700' }}>✗ Reject</Text></Bouncy>
            </View>
          </View>
        )}

        {!hourlyBooking?.early_end_requested_by && (
          <TouchableOpacity
            style={{ backgroundColor: C.pink, borderRadius: 16, padding: 18, alignItems: 'center', elevation: 6, shadowColor: C.pink, shadowOpacity: 0.45, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10 }}
            onPress={requestEarlyEnd}>
            <Text style={{ fontSize: 26, marginBottom: 4 }}>⏹️</Text>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Trip Complete Karo</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4, textAlign: 'center' }}>Driver ko full payment milegi — turant complete hoga</Text>
          </TouchableOpacity>
        )}
        {hourlyBooking?.early_end_requested_by === 'customer' && (
          <View style={{ backgroundColor: C.yellowGlass, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.yellowBorder }}>
            <Text style={{ fontSize: 22, marginBottom: 4 }}>⏳</Text>
            <Text style={{ color: C.yellow, fontWeight: '800', fontSize: 14 }}>Driver ke Confirm ka Intezaar...</Text>
            <Text style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>Driver ne abhi confirm nahi kiya</Text>
          </View>
        )}
      </ScrollView>
    </ScreenIn>
  );

  // ── WAITING FOR DRIVER ──
  if (hourlyStep === 'waiting') {
    const driverAccepted = hourlyBooking?.status === 'matched';
    return (
      <ScreenIn style={s.screen}>
        <View style={{ backgroundColor: C.pink, overflow: 'hidden', paddingTop: Platform.OS === 'android' ? 46 : 52, paddingBottom: 20, paddingHorizontal: 16, alignItems: 'center' }}>
          <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.10)', top: -60, right: -40 }} />
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>⏱️ Driver Dhundh Rahe Hain</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <PulseView><Text style={{ fontSize: 72, marginBottom: 16 }}>⏱️</Text></PulseView>
          <Text style={{ fontSize: 18, fontWeight: '900', color: C.text, marginBottom: 10 }}>
            {driverAccepted ? 'Driver Mil Gaya!' : 'Booking Confirmed!'}
          </Text>
          <View style={{ backgroundColor: C.greenGlass, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 16, width: '100%', borderWidth: 1, borderColor: C.greenBorder }}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>✅</Text>
            <Text style={{ color: C.green, fontWeight: '700' }}>₹{hourlyBooking?.fare} Payment Paid — Escrow Mein</Text>
          </View>
          {!driverAccepted && <FloatingDots />}
          <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 12, marginBottom: 20, textAlign: 'center' }}>
            {driverAccepted
              ? 'Driver aa raha hai — OTP ready rakho'
              : `Aapke area mein ${hVehicleIcons[hVehicle]} driver dhundh rahe hain...`}
          </Text>
          <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 16, width: '100%', elevation: 2, marginBottom: 20, borderWidth: 1, borderColor: C.glassBorder }}>
            {[
              ['Package', `${hHourEmoji(hourlyBooking?.package_hours || hPackageHours)} ${hHourLabel(hourlyBooking?.package_hours || hPackageHours)}`],
              ['Vehicle', `${hVehicleIcons[hourlyBooking?.vehicle_type || hVehicle]} ${(hourlyBooking?.vehicle_type || hVehicle).charAt(0).toUpperCase() + (hourlyBooking?.vehicle_type || hVehicle).slice(1)}`],
              ['Pickup', hourlyBooking?.pickup || hPickup],
              ['KM Included', `${hourlyBooking?.km_included} km`],
              ['Fare (Held)', `₹${hourlyBooking?.fare}`],
            ].map(([k, v], i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: i < 4 ? 1 : 0, borderColor: C.glassBorder }}>
                <Text style={{ color: C.textMuted, fontSize: 13 }}>{k}</Text>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{v}</Text>
              </View>
            ))}
          </View>
          {!driverAccepted && (
            <Bouncy style={{ borderRadius: 14, borderWidth: 2, borderColor: C.pinkBorder, padding: 12, width: '100%', alignItems: 'center', backgroundColor: C.pinkGlass }} onPress={cancelHourlyBooking}>
              <Text style={{ color: C.pink, fontWeight: '700' }}>✗ Booking Cancel (Full Refund)</Text>
            </Bouncy>
          )}
        </View>
      </ScreenIn>
    );
  }

  // ── BOOKING FORM ──
  return (
    <ScreenIn style={s.screen}>
      <View style={{ backgroundColor: C.pink, overflow: 'hidden', paddingTop: Platform.OS === 'android' ? 46 : 52, paddingBottom: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.10)', top: -60, right: -40 }} />
        <TouchableOpacity onPress={() => setScreen('home')} style={{ marginRight: 14, padding: 8, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 10 }}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900', flex: 1 }}>⏱️ Book by Hour</Text>
        <TouchableOpacity onPress={() => setScreen('hourly-info')} style={{ padding: 8 }}><Text style={{ fontSize: 20 }}>ℹ️</Text></TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
        <Text style={[s.secTitle, { color: C.textMuted, letterSpacing: 1 }]}>VEHICLE TYPE</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {[{id:'auto',label:'Auto'},{id:'bike',label:'Bike'},{id:'car',label:'Car'},{id:'eriksha',label:'E-Riksha'}].map(v => (
            <Bouncy key={v.id} style={{ flex: 1, backgroundColor: hVehicle === v.id ? C.bgCard : C.glassMid, borderRadius: 14, padding: 10, alignItems: 'center', borderWidth: 2, borderColor: hVehicle === v.id ? C.pinkBorder : C.glassBorder, elevation: hVehicle === v.id ? 4 : 0 }} onPress={() => setHVehicle(v.id)}>
              <RideVehicleIcon id={v.id} size={22} color={hVehicle === v.id ? C.pink : C.textMuted} />
              <Text style={{ fontSize: 10, fontWeight: '700', marginTop: 3, color: hVehicle === v.id ? C.text : C.textMuted }}>{v.label}</Text>
            </Bouncy>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {[{id:'green_bike',label:'Green Bike'},{id:'electric_auto',label:'Elec. Auto'}].map(v => (
            <Bouncy key={v.id} style={{ flex: 1, backgroundColor: hVehicle === v.id ? C.greenGlass : C.glass, borderRadius: 14, padding: 10, alignItems: 'center', borderWidth: 2, borderColor: hVehicle === v.id ? C.green : C.greenBorder }} onPress={() => setHVehicle(v.id)}>
              <RideVehicleIcon id={v.id} size={22} color={hVehicle === v.id ? C.green : C.textDim} />
              <Text style={{ fontSize: 10, fontWeight: '700', marginTop: 3, color: hVehicle === v.id ? C.green : C.textDim }}>{v.label}</Text>
              <Text style={{ fontSize: 9, color: C.green, marginTop: 1 }}>ECO</Text>
            </Bouncy>
          ))}
        </View>
        <Bouncy
          onPress={() => setHVehicle('ultra_luxury')}
          style={{ backgroundColor: hVehicle === 'ultra_luxury' ? C.bgCard : C.yellowGlass, borderRadius: 14, padding: 14, marginBottom: 18, borderWidth: 2, borderColor: hVehicle === 'ultra_luxury' ? C.yellow : C.yellowBorder, flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="diamond" size={26} color={hVehicle === 'ultra_luxury' ? C.yellow : C.textDim} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: hVehicle === 'ultra_luxury' ? C.yellow : C.textMuted }}>Ultra Luxury</Text>
            <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>BMW · Mercedes · Audi · Land Rover · Lexus</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '900', color: C.pink }}>₹{hourlyPackages.ultra_luxury?.[hPackageHours]?.fare || 800}</Text>
        </Bouncy>

        <Text style={[s.secTitle, { color: C.textMuted, letterSpacing: 1 }]}>SELECT PACKAGE</Text>
        <View style={{ flexDirection: 'row', backgroundColor: C.glassMid, borderRadius: 14, padding: 4, marginBottom: 12, borderWidth: 1, borderColor: C.glassBorder }}>
          {[['standard','⏱️ Same Day'],[' multi','📅 Multi-Day']].map(([key, label]) => {
            const isMulti = key.trim() === 'multi';
            const isMultiSelected = [24,48,72].includes(hPackageHours);
            const active = isMulti ? isMultiSelected : !isMultiSelected;
            return (
              <Bouncy key={key} onPress={() => { if (isMulti) setHPackageHours(24); else setHPackageHours(4); }} style={{ flex: 1, backgroundColor: active ? C.bgCard : 'transparent', borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: active ? 1 : 0, borderColor: C.pinkBorder }}>
                <Text style={{ fontWeight: '800', color: active ? C.text : C.textMuted, fontSize: 13 }}>{label}</Text>
              </Bouncy>
            );
          })}
        </View>
        {([24,48,72].includes(hPackageHours) ? [24,48,72] : [2,4,6,8]).map(h => {
          const p = hourlyPackages[hVehicle]?.[h];
          const sel = hPackageHours === h;
          return (
            <Bouncy key={h} onPress={() => setHPackageHours(h)} style={{ backgroundColor: sel ? C.bgCard : C.glass, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 2, borderColor: sel ? C.pinkBorder : C.glassBorder, flexDirection: 'row', alignItems: 'center', elevation: sel ? 6 : 1, shadowColor: sel ? C.pink : '#000', shadowOpacity: sel ? 0.35 : 0, shadowRadius: 10 }}>
              <Text style={{ fontSize: 28, marginRight: 14 }}>{hHourEmoji(h)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: sel ? C.text : C.textMuted }}>{hHourLabel(h)}</Text>
                <Text style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{p?.km} km included · extra ₹{hourlyPackages[hVehicle]?.extra}/km</Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: '900', color: C.pink }}>₹{p?.fare}</Text>
            </Bouncy>
          );
        })}

        <Text style={[s.secTitle, { marginTop: 8, color: C.textMuted, letterSpacing: 1 }]}>PICKUP LOCATION *</Text>
        <View style={{ backgroundColor: C.glass, borderRadius: 14, elevation: 1, borderWidth: 1, borderColor: C.glassBorder, marginBottom: 4 }}>
          <TextInput style={{ fontSize: 14, color: C.text, padding: 12 }} placeholder="📍 Pickup kahaan se?" placeholderTextColor={C.textDim} value={hPickup}
            onChangeText={t => { setHPickup(t); searchHourly(t, 'pickup'); }} />
          <TouchableOpacity onPress={useCurrentLocationPickup} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: C.glassBorder, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: C.pinkGlass, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}>
            <Text style={{ fontSize: 14, marginRight: 6 }}>🎯</Text>
            <Text style={{ fontSize: 12, color: C.pink, fontWeight: '700' }}>Current Location Use Karo</Text>
          </TouchableOpacity>
        </View>
        {hPickupSugg.length > 0 && (
          <View style={{ backgroundColor: C.glass, borderRadius: 12, elevation: 4, marginBottom: 8, borderWidth: 1, borderColor: C.glassBorder }}>
            {hPickupSugg.slice(0, 4).map((sg: any) => (
              <TouchableOpacity key={sg.id} onPress={() => selectHourlyPlace(sg.id, sg.text, 'pickup')} style={{ padding: 12, borderBottomWidth: 1, borderColor: C.glassBorder }}>
                <Text style={{ fontSize: 13, color: C.text }} numberOfLines={1}>📍 {sg.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={[s.secTitle, { marginTop: 4, color: C.textMuted, letterSpacing: 1 }]}>FIRST STOP / AREA (OPTIONAL)</Text>
        <View style={{ backgroundColor: C.glass, borderRadius: 14, padding: 12, marginBottom: 4, elevation: 1, borderWidth: 1, borderColor: C.glassBorder }}>
          <TextInput style={{ fontSize: 14, color: C.text }} placeholder="🗺️ Pehla stop ya area? (optional)" placeholderTextColor={C.textDim} value={hDrop}
            onChangeText={t => { setHDrop(t); searchHourly(t, 'drop'); }} />
        </View>
        {hDropSugg.length > 0 && (
          <View style={{ backgroundColor: C.glass, borderRadius: 12, elevation: 4, marginBottom: 8, borderWidth: 1, borderColor: C.glassBorder }}>
            {hDropSugg.slice(0, 4).map((sg: any) => (
              <TouchableOpacity key={sg.id} onPress={() => selectHourlyPlace(sg.id, sg.text, 'drop')} style={{ padding: 12, borderBottomWidth: 1, borderColor: C.glassBorder }}>
                <Text style={{ fontSize: 13, color: C.text }} numberOfLines={1}>📍 {sg.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ backgroundColor: C.glassMid, borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 15, marginRight: 8 }}>ℹ️</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.purple, fontWeight: '800', fontSize: 12 }}>Package mein {hourlyPackages[hVehicle]?.[hPackageHours]?.km} km included</Text>
            <Text style={{ color: C.purple, fontSize: 11, marginTop: 3, opacity: 0.8 }}>
              Aap kahi bhi ja sakte hain {hPackageHours} hour mein. Agar package km exceed hua to extra ₹{hourlyPackages[hVehicle]?.extra}/km trip end pe pay hoga.
            </Text>
          </View>
        </View>

        <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 14, marginTop: 8, marginBottom: 12, elevation: 1, borderWidth: 1, borderColor: C.glassBorder }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>🔄 Round Trip</Text>
              <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Driver aapko wapas pickup pe drop karega — package time ke andar</Text>
            </View>
            <Switch value={hRoundTrip} onValueChange={setHRoundTrip} trackColor={{ true: C.pink }} />
          </View>
          {hRoundTrip && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>Drop pe rukna (hours):</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[1, 2, 3].map(h => (
                  <Bouncy key={h} onPress={() => setHStayHours(h)} style={{ flex: 1, backgroundColor: hStayHours === h ? C.bgCard : C.glassMid, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: hStayHours === h ? C.pinkBorder : C.glassBorder }}>
                    <Text style={{ color: hStayHours === h ? C.pink : C.textMuted, fontWeight: '800' }}>{h}h</Text>
                  </Bouncy>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ color: C.textDim, fontSize: 12, marginBottom: 10, letterSpacing: 1 }}>FARE SUMMARY</Text>
          {[
            [`${hHourLabel(hPackageHours)} (${hVehicleIcons[hVehicle]})`, `₹${pkg?.fare}`],
            [`KM Included`, `${pkg?.km} km`],
            [`Extra KM Rate`, `₹${hourlyPackages[hVehicle]?.extra}/km`],
            [`Wallet Balance`, `₹${walletBalance.toFixed(0)}`],
          ].map(([k, v], i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: i < 3 ? 1 : 0, borderColor: C.glassBorder }}>
              <Text style={{ color: C.textMuted, fontSize: 13 }}>{k}</Text>
              <Text style={{ color: i === 0 ? C.yellow : C.text, fontWeight: i === 0 ? '900' : '500', fontSize: i === 0 ? 15 : 13 }}>{v}</Text>
            </View>
          ))}
          {walletBalance < (pkg?.fare || 0) && (
            <View style={{ marginTop: 10, backgroundColor: C.pink, borderRadius: 10, padding: 8, elevation: 3 }}>
              <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center', fontWeight: '700' }}>⚠️ Wallet mein ₹{(pkg?.fare || 0) - walletBalance} aur chahiye — pehle add karo</Text>
            </View>
          )}
        </View>

        <Bouncy style={[s.btn, { opacity: walletBalance >= (pkg?.fare || 0) ? 1 : 0.5 }]} onPress={walletBalance >= (pkg?.fare || 0) ? bookHourly : () => { loadWalletDetail(phone); loadLoyalty(phone); setScreen('wallet'); }}>
          <Text style={s.btnTxt}>{walletBalance >= (pkg?.fare || 0) ? `✅ Book — ₹${pkg?.fare} Wallet Se` : `💳 Wallet Mein ₹${pkg?.fare} Add Karo`}</Text>
        </Bouncy>
      </ScrollView>
    </ScreenIn>
  );
}
