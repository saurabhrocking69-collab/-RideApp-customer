import { useState, useEffect, useRef } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, Alert, Image, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { apiPost } from '../../api';
import { useRideStore } from '../../store';
import { useApp } from '../context/AppContext';
import { Bouncy, PulseView, LucknowCityCard, SlideUp, CountUp, EmptyAnim, DotBG, GlowPulse, ShineCard } from '../components/ui';
import { s, C } from '../styles';
import { MAPS_KEY } from '../constants';

function NavBar() {
  const { tab, screen, setScreen, setTab, loadHistory, phone, rideData, storeStatus, hourlyBooking } = useApp();
  const hasLive = (!!rideData?.ride_id && storeStatus !== 'cancelled') ||
                  (!!hourlyBooking && ['pending','matched','active'].includes(hourlyBooking?.status));
  const navTabs: { t: string; ion: string; lbl: string }[] = [
    { t: 'home',    ion: 'home',     lbl: 'Home'    },
    { t: 'live',    ion: 'navigate', lbl: 'Live'    },
    { t: 'history', ion: 'time',     lbl: 'Trips'   },
    { t: 'profile', ion: 'person',   lbl: 'Profile' },
  ];
  return (
    <View style={s.nav}>
      {navTabs.map(({ t, ion, lbl }) => {
        const active = tab === t && screen === 'home';
        const col = active ? C.pink : C.textDim;
        return (
          <TouchableOpacity key={t} style={s.navItem} onPress={() => { setScreen('home'); setTab(t as any); if (t === 'history') loadHistory(phone); }} activeOpacity={0.65}>
            <View style={{ position: 'relative', alignItems: 'center' }}>
              <Ionicons name={(active ? ion : `${ion}-outline`) as any} size={24} color={col} />
              {t === 'live' && hasLive && !active && (
                <View style={{ position: 'absolute', top: -2, right: -6, width: 9, height: 9, borderRadius: 5, backgroundColor: C.pink, borderWidth: 1.5, borderColor: C.bg }} />
              )}
            </View>
            <Text style={[s.navLbl, active && s.navActive]}>{lbl}</Text>
            {active && <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: C.pink, marginTop: 4 }} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function BuddyBookModal() {
  const {
    showBuddyBook, setShowBuddyBook,
    favouriteBuddy,
    buddyBookPU, setBuddyBookPU,
    buddyBookDR, setBuddyBookDR,
    buddyBookPUCoords, setBuddyBookPUCoords,
    buddyBookDRCoords, setBuddyBookDRCoords,
    buddyBookLoading, setBuddyBookLoading,
    buddyBookMsg, setBuddyBookMsg,
    buddyWaiting, setBuddyWaiting,
    buddyWaitingRef,
    buddyPUSugg, setBuddyPUSugg,
    buddyDRSugg, setBuddyDRSugg,
    buddyPUDebRef, buddyDRDebRef,
    phone, userCoords,
    setRideData, setPickup, setDrop, setPickupCoords, setDropCoords,
    joinRideSocket, setScreen,
    rideIcon,
  } = useApp();

  if (!showBuddyBook || !favouriteBuddy) return null;
  const isOffline = !favouriteBuddy.is_online;

  const searchBuddyPlaces = (text: string, type: 'pickup' | 'drop') => {
    if (text.length < 3) { type === 'pickup' ? setBuddyPUSugg([]) : setBuddyDRSugg([]); return; }
    const ref = type === 'pickup' ? buddyPUDebRef : buddyDRDebRef;
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${MAPS_KEY}&components=country:in&location=26.8467,80.9462&radius=50000`);
        const data = await res.json();
        const sugg = data.predictions?.map((p: any) => ({ id: p.place_id, text: p.description })) || [];
        type === 'pickup' ? setBuddyPUSugg(sugg) : setBuddyDRSugg(sugg);
      } catch (_e) {}
    }, 380);
  };

  const geocodeBuddyPlace = async (address: string, type: 'pickup' | 'drop') => {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`);
      const data = await res.json();
      const loc = data.results?.[0]?.geometry?.location;
      if (loc) type === 'pickup' ? setBuddyBookPUCoords({ lat: loc.lat, lng: loc.lng }) : setBuddyBookDRCoords({ lat: loc.lat, lng: loc.lng });
    } catch (_e) {}
  };

  const useMyLoc = async () => {
    if (!userCoords) { setBuddyBookMsg('📍 Location unavailable — manually enter pickup'); return; }
    setBuddyBookMsg('📍 Detect kar rahe hain...');
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${userCoords.latitude},${userCoords.longitude}&key=${MAPS_KEY}`);
      const data = await res.json();
      const addr = data.results?.[0]?.formatted_address || '';
      if (addr) { setBuddyBookPU(addr); setBuddyBookPUCoords({ lat: userCoords.latitude, lng: userCoords.longitude }); setBuddyPUSugg([]); setBuddyBookMsg(''); }
      else setBuddyBookMsg('📍 Address nahi mila — manually likhao');
    } catch (_e) { setBuddyBookMsg('❌ Location fetch failed'); }
  };

  const bookWithBuddy = async () => {
    if (isOffline) { setBuddyBookMsg('⛔ Driver offline hai — request nahi bhej sakte'); return; }
    if (!buddyBookPU.trim()) { setBuddyBookMsg('⚠️ Pickup location daalo'); return; }
    if (!buddyBookDR.trim()) { setBuddyBookMsg('⚠️ Drop location daalo'); return; }
    setBuddyBookLoading(true); setBuddyBookMsg('');
    try {
      const res = await apiPost('/api/favourites/book', {
        customer_phone: phone, pickup: buddyBookPU, drop_location: buddyBookDR,
        pickup_lat: buddyBookPUCoords?.lat, pickup_lng: buddyBookPUCoords?.lng,
        drop_lat: buddyBookDRCoords?.lat, drop_lng: buddyBookDRCoords?.lng,
      });
      if (res.success) {
        setRideData({ ride_id: res.ride_id, fare: res.fare, startOtp: '', driver: null });
        setPickup(buddyBookPU); setDrop(buddyBookDR);
        if (buddyBookPUCoords) setPickupCoords(buddyBookPUCoords);
        if (buddyBookDRCoords) setDropCoords(buddyBookDRCoords);
        joinRideSocket(res.ride_id);
        AsyncStorage.setItem('activeStdRideId', String(res.ride_id)).catch(() => {});
        buddyWaitingRef.current = true;
        setBuddyWaiting(true); setBuddyBookMsg('');
      } else if (res.reason === 'offline') {
        setBuddyBookMsg(`⛔ ${res.driver_name || favouriteBuddy.driver_name} abhi offline hai — request cancel. Baad mein try karo.`);
      } else if (res.reason === 'busy') {
        setBuddyBookMsg(`🚗 ${res.driver_name || favouriteBuddy.driver_name} abhi kisi aur ride mein busy hai — request cancel. Thodi der mein dobara try karo.`);
      } else {
        setBuddyBookMsg('❌ ' + (res.error || 'Kuch galat hua — dobara try karo'));
      }
    } catch (_e) { setBuddyBookMsg('❌ Network error — dobara try karo'); }
    setBuddyBookLoading(false);
  };

  const closeModal = () => {
    if (buddyWaiting) return;
    setShowBuddyBook(false); setBuddyBookMsg('');
    setBuddyPUSugg([]); setBuddyDRSugg([]);
  };

  const goToMatching = () => {
    buddyWaitingRef.current = false;
    setShowBuddyBook(false); setBuddyWaiting(false); setBuddyBookMsg('');
    setBuddyBookPU(''); setBuddyBookDR('');
    setBuddyPUSugg([]); setBuddyDRSugg([]);
    setScreen('matching');
  };

  return (
    <Modal visible={showBuddyBook} animationType="slide" transparent statusBarTranslucent onRequestClose={closeModal}>
      <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={closeModal} />
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 6, paddingHorizontal: 20, paddingBottom: 34, maxHeight: '90%', borderTopWidth: 1, borderColor: C.glassBorder, elevation: 30 }}>
          <View style={s.sheetHandle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden', borderWidth: 2, borderColor: C.pinkBorder }}>
                {favouriteBuddy.face_photo
                  ? <Image source={{ uri: favouriteBuddy.face_photo }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                  : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 20 }}>{(favouriteBuddy.driver_name || 'D')[0].toUpperCase()}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, marginRight: 4 }}>⭐</Text>
                  <Text style={{ fontWeight: '800', fontSize: 16, color: C.text }}>{favouriteBuddy.driver_name}</Text>
                </View>
                <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>
                  {rideIcon(favouriteBuddy.vehicle_type)} {(favouriteBuddy.vehicle_type || '').replace('_', ' ').toUpperCase()}
                  {favouriteBuddy.rating ? ` · ★ ${parseFloat(favouriteBuddy.rating).toFixed(1)}` : ''}
                </Text>
                <Text style={{ fontSize: 12, marginTop: 2, fontWeight: '700', color: favouriteBuddy.is_online ? C.green : C.textDim }}>
                  {favouriteBuddy.is_online ? '🟢 Online' : '⛔ Offline'}
                </Text>
              </View>
              {!buddyWaiting && (
                <TouchableOpacity onPress={closeModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={{ fontSize: 22, color: C.textDim }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {isOffline && !buddyWaiting && (
              <View style={{ backgroundColor: C.redGlass, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1.5, borderColor: C.redBorder, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 20, marginRight: 10 }}>⛔</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.red, fontSize: 13, fontWeight: '800' }}>{favouriteBuddy.driver_name} abhi offline hai</Text>
                  <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>Request nahi bheji jayegi. Baad mein try karo.</Text>
                </View>
              </View>
            )}

            {buddyWaiting ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>⏳</Text>
                <Text style={{ fontWeight: '800', fontSize: 17, color: C.text, textAlign: 'center' }}>Request Bheji Gayi!</Text>
                <Text style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
                  {favouriteBuddy.driver_name} ke accept karne ka intezaar kar rahe hain...{'\n'}25 seconds ka time diya gaya hai.
                </Text>
                {buddyBookMsg.startsWith('⚠️') || buddyBookMsg.startsWith('⛔') ? (
                  <>
                    <View style={{ backgroundColor: C.yellowGlass, borderRadius: 12, padding: 12, marginTop: 14, borderWidth: 1, borderColor: C.yellowBorder, width: '100%' }}>
                      <Text style={{ color: C.yellow, fontSize: 13, textAlign: 'center', fontWeight: '700' }}>{buddyBookMsg}</Text>
                    </View>
                    <TouchableOpacity onPress={goToMatching} style={{ marginTop: 14, backgroundColor: C.glass, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder }}>
                      <Text style={{ color: C.text, fontWeight: '800', fontSize: 14 }}>Kisi bhi driver se book karo →</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity onPress={goToMatching} style={{ marginTop: 14, backgroundColor: C.pink, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, width: '100%', alignItems: 'center', elevation: 8, shadowColor: C.pink, shadowOpacity: 0.5, shadowRadius: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Live Track Karo →</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                <Text style={{ fontWeight: '700', fontSize: 13, color: C.textMuted, marginBottom: 8 }}>📍 Pickup Location</Text>
                <TouchableOpacity onPress={useMyLoc}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.greenGlass, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: C.greenBorder }}>
                  <Text style={{ fontSize: 15, marginRight: 8 }}>🎯</Text>
                  <Text style={{ color: C.green, fontSize: 13, fontWeight: '700' }}>Meri current location use karo</Text>
                </TouchableOpacity>
                <TextInput
                  style={{ borderWidth: 1.5, borderColor: buddyBookPU ? C.green : C.glassBorder, borderRadius: 12, padding: 12, fontSize: 14, color: C.text, backgroundColor: C.glass, marginBottom: 4 }}
                  placeholder="Pickup location likhao ya search karo..."
                  placeholderTextColor={C.textDim}
                  value={buddyBookPU}
                  onChangeText={(t) => { setBuddyBookPU(t); searchBuddyPlaces(t, 'pickup'); }}
                  returnKeyType="next"
                />
                {buddyPUSugg.length > 0 && (
                  <View style={{ backgroundColor: C.bgCard, borderRadius: 12, marginBottom: 4, borderWidth: 1, borderColor: C.glassBorder, elevation: 8 }}>
                    {buddyPUSugg.slice(0, 5).map((sg: any, i: number) => (
                      <TouchableOpacity key={i}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: i < Math.min(buddyPUSugg.length, 5) - 1 ? 1 : 0, borderBottomColor: C.glass }}
                        onPress={() => { setBuddyBookPU(sg.text); setBuddyPUSugg([]); geocodeBuddyPlace(sg.text, 'pickup'); }}>
                        <Text style={{ fontSize: 14, marginRight: 10 }}>📍</Text>
                        <Text style={{ fontSize: 13, color: C.text, flex: 1, fontWeight: '500' }} numberOfLines={2}>{sg.text}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={{ fontWeight: '700', fontSize: 13, color: C.textMuted, marginBottom: 8, marginTop: 12 }}>🎯 Drop Location</Text>
                <TextInput
                  style={{ borderWidth: 1.5, borderColor: buddyBookDR ? C.pink : C.glassBorder, borderRadius: 12, padding: 12, fontSize: 14, color: C.text, backgroundColor: C.glass, marginBottom: 4 }}
                  placeholder="Drop location likhao ya search karo..."
                  placeholderTextColor={C.textDim}
                  value={buddyBookDR}
                  onChangeText={(t) => { setBuddyBookDR(t); searchBuddyPlaces(t, 'drop'); }}
                  returnKeyType="done"
                />
                {buddyDRSugg.length > 0 && (
                  <View style={{ backgroundColor: C.bgCard, borderRadius: 12, marginBottom: 4, borderWidth: 1, borderColor: C.glassBorder, elevation: 8 }}>
                    {buddyDRSugg.slice(0, 5).map((sg: any, i: number) => (
                      <TouchableOpacity key={i}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: i < Math.min(buddyDRSugg.length, 5) - 1 ? 1 : 0, borderBottomColor: C.glass }}
                        onPress={() => { setBuddyBookDR(sg.text); setBuddyDRSugg([]); geocodeBuddyPlace(sg.text, 'drop'); }}>
                        <Text style={{ fontSize: 14, marginRight: 10 }}>🎯</Text>
                        <Text style={{ fontSize: 13, color: C.text, flex: 1, fontWeight: '500' }} numberOfLines={2}>{sg.text}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {!!buddyBookMsg && (
                  <View style={{ borderRadius: 12, padding: 12, marginTop: 10,
                    backgroundColor: buddyBookMsg.startsWith('✅') ? C.greenGlass : buddyBookMsg.startsWith('📍') ? C.glass : C.redGlass,
                    borderWidth: 1, borderColor: buddyBookMsg.startsWith('✅') ? C.greenBorder : buddyBookMsg.startsWith('📍') ? C.glassBorder : C.redBorder }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', textAlign: 'center',
                      color: buddyBookMsg.startsWith('✅') ? C.green : buddyBookMsg.startsWith('📍') ? C.textMuted : C.red }}>
                      {buddyBookMsg}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={bookWithBuddy}
                  disabled={buddyBookLoading || isOffline}
                  style={{ backgroundColor: isOffline ? C.glass : C.pink, borderRadius: 16, padding: 17, alignItems: 'center', marginTop: 16, elevation: isOffline ? 0 : 10, shadowColor: C.pink, shadowOpacity: isOffline ? 0 : 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, borderWidth: isOffline ? 1 : 0, borderColor: C.glassBorder }}>
                  <Text style={{ color: isOffline ? C.textDim : '#fff', fontWeight: '900', fontSize: 15 }}>
                    {buddyBookLoading ? '⏳ Request bhej rahe hain...' : isOffline ? '⛔ Driver Offline — Unavailable' : `⭐ ${favouriteBuddy.driver_name} ko Request Bhejo`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { closeModal(); setScreen('booking'); }} style={{ alignItems: 'center', marginTop: 12, paddingVertical: 6 }}>
                  <Text style={{ color: C.textMuted, fontSize: 13 }}>Kisi bhi driver se book karo →</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function HomeTab() {
  const {
    userName, phone,
    pickup, drop,
    favouriteBuddy, removeFavouriteBuddy,
    activeOffers, offerDismissed, setOfferDismissed,
    rideData, hourlyBooking,
    historyRides,
    setScreen, setTab,
    setShowBuddyBook, setBuddyBookMsg, setBuddyWaiting,
    loadReferral, loadSaved, loadWallet,
    setPickup, setDrop,
    setHourlyStep, setHPickup, setHDrop, setHPickupCoords, setHDropCoords,
    setHPickupSugg, setHDropSugg, setHRoundTrip, setHStayHours, setHourlyBooking,
    rideIcon, customerRating, walletBalance,
  } = useApp();

  const GREETINGS = ['Namaste! 🙏', 'Good Morning! ☀️', 'Safe Travels! 🛺', 'Apni City, Apni Ride 🌟'];
  const [greetIdx, setGreetIdx] = useState(0);
  const greetFade  = useRef(new Animated.Value(1)).current;
  const greetSlide = useRef(new Animated.Value(0)).current;
  const scrollY    = useRef(new Animated.Value(0)).current;

  const FULL_H = Platform.OS === 'android' ? 130 : 146;
  const MINI_H = Platform.OS === 'android' ? 72 : 84;

  const headerH   = scrollY.interpolate({ inputRange: [0, 90], outputRange: [FULL_H, MINI_H], extrapolate: 'clamp' });
  const fullAlpha = scrollY.interpolate({ inputRange: [0, 65], outputRange: [1, 0], extrapolate: 'clamp' });
  const miniAlpha = scrollY.interpolate({ inputRange: [50, 85], outputRange: [0, 1], extrapolate: 'clamp' });

  useEffect(() => {
    const iv = setInterval(() => {
      Animated.parallel([
        Animated.timing(greetFade,  { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(greetSlide, { toValue: -8, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        setGreetIdx(i => (i + 1) % GREETINGS.length);
        greetSlide.setValue(8);
        Animated.parallel([
          Animated.timing(greetFade,  { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(greetSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
      });
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  return (
    <View style={s.screen}>
      {/* ── Animated collapsing header ────────────────────────────── */}
      <Animated.View style={{ height: headerH, backgroundColor: C.pink, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.10)', top: -80, right: -60 }} />
        <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)', top: 16, left: -50 }} />
        <View style={{ position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(245,158,11,0.25)', bottom: -20, right: 90 }} />
        {/* Full header — fades out on scroll */}
        <Animated.View style={{ paddingTop: Platform.OS === 'android' ? 38 : 50, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', opacity: fullAlpha }}>
          <View style={{ flex: 1 }}>
            <Animated.Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '600', opacity: greetFade, transform: [{ translateY: greetSlide }] }}>
              {GREETINGS[greetIdx]}
            </Animated.Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginTop: 3 }}>{userName || 'Rider'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.60)', fontSize: 10, marginTop: 3 }}>📍 India</Text>
          </View>
          <TouchableOpacity onPress={() => { setTab('profile'); loadWallet(phone); }}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)' }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 19 }}>{(userName || 'R')[0].toUpperCase()}</Text>
          </TouchableOpacity>
        </Animated.View>
        {/* Mini pill — fades in when scrolled */}
        <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 14, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: miniAlpha }}>
          <TouchableOpacity onPress={() => setScreen('booking')}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9, gap: 8 }}>
            <Ionicons name="search" size={13} color="#fff" />
            <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '600' }}>Kahan jaana hai?</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setTab('profile'); loadWallet(phone); }}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.40)' }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>{(userName || 'R')[0].toUpperCase()}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* ── Main scrollable content ────────────────────────────────── */}
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={8}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 90 }}
      >
        {/* Lucknow city illustration */}
        <LucknowCityCard />

        {/* White content sheet */}
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -20, paddingTop: 14, paddingHorizontal: 16, borderTopWidth: 1, borderColor: C.glassBorder, elevation: 6, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, minHeight: 600 }}>

          {/* Ride stats strip */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            <View style={{ flex: 1, backgroundColor: C.pinkGlass, borderRadius: 14, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: C.pinkBorder }}>
              <Text style={{ color: C.pink, fontSize: 22, fontWeight: '900' }}>{historyRides.length || 0}</Text>
              <Text style={{ color: C.textDim, fontSize: 9, marginTop: 1, fontWeight: '700', letterSpacing: 0.5 }}>RIDES</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: C.yellowGlass, borderRadius: 14, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: C.yellowBorder }}>
              <Text style={{ color: C.yellow, fontSize: 18, fontWeight: '900' }}>⭐ {customerRating?.rating ? parseFloat(customerRating.rating).toFixed(1) : '5.0'}</Text>
              <Text style={{ color: C.textDim, fontSize: 9, marginTop: 1, fontWeight: '700', letterSpacing: 0.5 }}>RATING</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: C.greenGlass, borderRadius: 14, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: C.greenBorder }}>
              <CountUp to={walletBalance} prefix="₹" style={{ color: C.green, fontSize: 18, fontWeight: '900' }} />
              <Text style={{ color: C.textDim, fontSize: 9, marginTop: 1, fontWeight: '700', letterSpacing: 0.5 }}>WALLET</Text>
            </View>
          </View>

          <SlideUp delay={0}>
            <Bouncy onPress={() => setScreen('booking')} style={s.searchBox}>
              <Ionicons name="search" size={18} color={C.textMuted} style={{ marginRight: 10 }} />
              <Text style={s.searchPh}>Kahan jaana hai?</Text>
              <View style={{ marginLeft: 'auto', backgroundColor: C.pink, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, elevation: 4, shadowColor: C.pink, shadowOpacity: 0.5, shadowRadius: 6 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Book</Text>
              </View>
            </Bouncy>
          </SlideUp>

          <SlideUp delay={60}>
            <View style={s.quickRow}>
              {[
                { icon: '🏠', label: 'Home',   color: C.greenGlass,  border: C.greenBorder,  fn: () => setScreen('booking') },
                { icon: '💼', label: 'Office',  color: C.yellowGlass, border: C.yellowBorder, fn: () => setScreen('booking') },
                { icon: '🎁', label: 'Refer',   color: C.pinkGlass,   border: C.pinkBorder,   fn: () => { loadReferral(); setScreen('referral'); } },
                { icon: '📍', label: 'Saved',   color: C.glass,       border: C.glassBorder,  fn: () => { loadSaved(); setScreen('saved'); } },
              ].map(({ icon, label, color, border, fn }, i) => (
                <Bouncy key={i} onPress={fn} style={[s.quickBtn, { backgroundColor: color, borderColor: border }]}>
                  <Text style={s.quickIcon}>{icon}</Text>
                  <Text style={[s.quickLbl, { color: C.text }]}>{label}</Text>
                </Bouncy>
              ))}
            </View>
          </SlideUp>

          {favouriteBuddy && (
            <SlideUp delay={70}>
              <ShineCard style={{ backgroundColor: C.glass, borderRadius: 18, marginBottom: 10, borderWidth: 1.5, borderColor: C.yellowBorder }}>
                <View style={{ backgroundColor: C.yellowGlass, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopLeftRadius: 17, borderTopRightRadius: 17 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16 }}>⭐</Text>
                    <Text style={{ marginLeft: 6, fontWeight: '800', fontSize: 13, color: C.yellow }}>Mera Sppero Buddy</Text>
                  </View>
                  <TouchableOpacity onPress={removeFavouriteBuddy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 12, color: C.textDim, fontWeight: '700' }}>✕ Remove</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center', marginRight: 14, borderWidth: 2, borderColor: C.pinkBorder }}>
                    {favouriteBuddy.face_photo
                      ? <Image source={{ uri: favouriteBuddy.face_photo }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                      : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 20 }}>{(favouriteBuddy.driver_name || 'D')[0].toUpperCase()}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', fontSize: 16, color: C.text }}>{favouriteBuddy.driver_name}</Text>
                    <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>
                      {rideIcon(favouriteBuddy.vehicle_type)} {(favouriteBuddy.vehicle_type || '').replace('_', ' ').toUpperCase()}
                      {favouriteBuddy.vehicle_no ? ` · ${favouriteBuddy.vehicle_no}` : ''}
                      {favouriteBuddy.rating ? ` · ★ ${parseFloat(favouriteBuddy.rating).toFixed(1)}` : ''}
                    </Text>
                    <Text style={{ fontSize: 11, marginTop: 3, fontWeight: '700', color: C.green }}>
                      ✅ {favouriteBuddy.rides_together || 0} rides saath kiye
                      {favouriteBuddy.is_online ? ' · 🟢 Online' : ' · ⚫ Offline'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => { setBuddyBookMsg(''); setBuddyWaiting(false); setShowBuddyBook(true); }}
                    style={{ backgroundColor: C.pink, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', elevation: 6, shadowColor: C.pink, shadowOpacity: 0.5, shadowRadius: 8 }}>
                    <Text style={{ fontSize: 18 }}>🚗</Text>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', marginTop: 2 }}>Book</Text>
                  </TouchableOpacity>
                </View>
              </ShineCard>
            </SlideUp>
          )}

          {activeOffers.filter((o: any) => !offerDismissed.has(o.id)).map((offer: any) => (
            <SlideUp key={offer.id} delay={80}>
              <View style={{ borderRadius: 16, marginBottom: 10,
                backgroundColor: offer.type === 'promo' ? C.yellowGlass : offer.type === 'incentive' ? C.greenGlass : C.glass,
                borderWidth: 1.5,
                borderColor: offer.type === 'promo' ? C.yellowBorder : offer.type === 'incentive' ? C.greenBorder : C.glassBorder,
                overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{offer.type === 'promo' ? '🎫' : offer.type === 'incentive' ? '💰' : '📢'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', fontSize: 14, color: C.text }}>{offer.title}</Text>
                    {offer.body ? <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{offer.body}</Text> : null}
                    {offer.promo_code ? (
                      <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ backgroundColor: C.pink, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 }}>
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>{offer.promo_code}</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: C.textMuted }}>Booking mein apply karo</Text>
                      </View>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={() => setOfferDismissed((prev: any) => new Set([...prev, offer.id]))} style={{ padding: 6 }}>
                    <Text style={{ fontSize: 16, color: C.textDim }}>✕</Text>
                  </TouchableOpacity>
                </View>
                {offer.cta_label ? (
                  <TouchableOpacity onPress={() => setScreen('booking')} style={{ backgroundColor: C.pink, padding: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{offer.cta_label} →</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </SlideUp>
          ))}

          <SlideUp delay={120}>
            <TouchableOpacity style={s.promoBanner} onPress={() => { loadReferral(); setScreen('referral'); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <PulseView><Text style={{ fontSize: 18, marginRight: 8 }}>🎁</Text></PulseView>
                <Text style={s.promoTxt}>Dost ko refer karo, dono ko ₹50 milega!</Text>
                <Text style={{ color: C.yellow, marginLeft: 8, fontWeight: '800', fontSize: 14 }}>→</Text>
              </View>
            </TouchableOpacity>
          </SlideUp>

          {rideData?.ride_id && (
            <SlideUp delay={125}>
              <TouchableOpacity onPress={() => setScreen('matching')} style={{ backgroundColor: C.pinkGlass, borderRadius: 16, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 5, borderWidth: 1.5, borderColor: C.pinkBorder }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center', marginRight: 12, elevation: 4, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 6 }}>
                  <Text style={{ fontSize: 22 }}>🚗</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>Active Ride In Progress!</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{drop ? `→ ${drop}` : 'Tap karo ride screen pe jao'}</Text>
                </View>
                <Text style={{ color: C.pink, fontSize: 24, fontWeight: '300' }}>›</Text>
              </TouchableOpacity>
            </SlideUp>
          )}

          {hourlyBooking && ['pending','matched','active'].includes(hourlyBooking.status) && (
            <SlideUp delay={130}>
              <TouchableOpacity onPress={() => setScreen('hourly')} style={{ backgroundColor: C.pinkGlass, borderRadius: 16, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 4, borderWidth: 1.5, borderColor: C.pinkBorder }}>
                <Text style={{ fontSize: 22, marginRight: 10 }}>⏱️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>Active Hourly Ride</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>Tap to resume your ongoing ride</Text>
                </View>
                <Text style={{ color: C.pink, fontSize: 22 }}>→</Text>
              </TouchableOpacity>
            </SlideUp>
          )}

          <SlideUp delay={150}>
            <Bouncy onPress={() => {
              if (hourlyBooking && ['pending','matched','active'].includes(hourlyBooking.status)) { setScreen('hourly'); return; }
              setHourlyStep('book'); setHPickup(''); setHDrop(''); setHPickupCoords(null); setHDropCoords(null);
              setHPickupSugg([]); setHDropSugg([]); setHRoundTrip(false); setHStayHours(1);
              setHourlyBooking(null); setScreen('hourly');
            }} style={{ borderRadius: 18, marginBottom: 14, overflow: 'hidden', elevation: 8, borderWidth: 1, borderColor: C.glassBorder }}>
              <View style={{ backgroundColor: C.bgCard, padding: 16, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <View style={{ backgroundColor: C.pinkGlass, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.pinkBorder }}>
                      <Text style={{ color: C.pink, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>NEW FEATURE</Text>
                    </View>
                  </View>
                  <Text style={{ color: C.text, fontSize: 17, fontWeight: '800', marginBottom: 2 }}>⏱️ Book by Hour</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>2h · 4h · 6h · Full Day • KM included</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: C.yellow, fontSize: 26, fontWeight: '800' }}>₹120</Text>
                  <Text style={{ color: C.textMuted, fontSize: 10 }}>Bike se shuru</Text>
                </View>
              </View>
              <View style={{ backgroundColor: C.glass, flexDirection: 'row', borderTopWidth: 1, borderColor: C.glassBorder }}>
                {[{e:'🛺',l:'Auto',p:'₹180'},{e:'🏍️',l:'Bike',p:'₹120'},{e:'🚕',l:'Car',p:'₹260'},{e:'🛵',l:'E-Riksha',p:'₹150'}].map((v, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRightWidth: i < 3 ? 1 : 0, borderColor: C.glassBorder }}>
                    <Text style={{ fontSize: 16 }}>{v.e}</Text>
                    <Text style={{ color: C.text, fontSize: 9, marginTop: 2 }}>{v.l}</Text>
                    <Text style={{ color: C.pink, fontSize: 10, fontWeight: '800' }}>{v.p}</Text>
                  </View>
                ))}
              </View>
            </Bouncy>
          </SlideUp>

          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.glassBorder }} onPress={() => setScreen('hourly-info')}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>⏱️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>Book by Hour — Kaise Kaam Karta Hai?</Text>
              <Text style={{ fontSize: 11, color: C.textMuted }}>Rules, fares, packages — sab jaano</Text>
            </View>
            <Text style={{ fontSize: 18, color: C.textDim }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.glassBorder }} onPress={() => setScreen('policy')}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>Cancellation Policy</Text>
              <Text style={{ fontSize: 11, color: C.textMuted }}>Cancel rules aur fees jaano</Text>
            </View>
            <Text style={{ fontSize: 18, color: C.textDim }}>›</Text>
          </TouchableOpacity>

          {historyRides.length > 0 && (
            <>
              <Text style={s.secTitle}>🕐 Recent Trips</Text>
              {historyRides.slice(0, 3).map((h: any, i: number) => (
                <TouchableOpacity key={i} style={s.recentItem} onPress={() => { setPickup(h.pickup); setDrop(h.drop_location); setScreen('booking'); }}>
                  <Text style={{ fontSize: 22, marginRight: 10 }}>{rideIcon(h.ride_type)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.recentRoute} numberOfLines={1}>{h.pickup} → {h.drop_location}</Text>
                    <Text style={s.recentDate}>{new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                  </View>
                  <Text style={s.recentFare}>₹{h.fare}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      </Animated.ScrollView>
      <View style={s.navFloat}><NavBar /></View>
      <BuddyBookModal />
    </View>
  );
}

function LiveTab() {
  const {
    rideData, storeStatus, hourlyBooking,
    hourlyStep, hourlyTimerSec,
    pickup, drop,
    setScreen, setTab,
    callDriver, initiateCall,
    rideIcon,
  } = useApp();
  const ride = useRideStore();

  const hasStd    = !!rideData?.ride_id && storeStatus !== 'cancelled';
  const hasHourly = !!hourlyBooking && ['pending','matched','active'].includes(hourlyBooking?.status);
  const stdStatus = storeStatus !== 'idle' ? storeStatus : (rideData?.ride_id ? 'requested' : 'idle');
  const stdStatusMap: any = {
    requested: { label: 'Driver dhoondh rahe hain...', color: '#f57c00', glassColor: C.yellowGlass, border: C.yellowBorder, icon: '🔍' },
    matched:   { label: 'Driver aa raha hai',          color: C.purple,  glassColor: C.glassMid,            border: C.glassBorder,          icon: '🚗' },
    arrived:   { label: 'Driver pahunch gaya!',        color: C.green,   glassColor: C.greenGlass,  border: C.greenBorder,  icon: '📍' },
    started:   { label: 'Trip chal rahi hai',          color: C.purple,  glassColor: 'rgba(124,58,237,0.10)', border: 'rgba(124,58,237,0.30)', icon: '🛣️' },
    completed: { label: 'Trip complete — Payment pending', color: C.pink, glassColor: C.pinkGlass, border: C.pinkBorder, icon: '✅' },
  };
  const si = stdStatusMap[stdStatus] || stdStatusMap.requested;
  const driverInfo = ride.driverInfo || rideData?.driver;
  const startOtp   = ride.startOtp   || rideData?.startOtp;

  const hElapsed  = hourlyTimerSec;
  const hh2 = Math.floor(hElapsed / 3600);
  const mm2 = Math.floor((hElapsed % 3600) / 60);
  const ss2 = hElapsed % 60;
  const hTimerStr = hh2 > 0 ? `${hh2}h ${mm2}m ${ss2}s` : `${mm2}m ${ss2}s`;
  const hStatus   = hourlyStep === 'active' ? 'Ride chal rahi hai' : hourlyBooking?.status === 'matched' ? 'Driver aa raha hai' : 'Driver dhoondh rahe hain...';
  const hColor    = hourlyStep === 'active' ? '#7b1fa2' : hourlyBooking?.status === 'matched' ? '#1565C0' : '#f57c00';
  const vEmoji: any = { auto:'🛺', bike:'🏍️', car:'🚕', eriksha:'🛵', ultra_luxury:'🚙', green_bike:'⚡', electric_auto:'🌿' };

  return (
    <View style={s.screen}>
      <View style={{ backgroundColor: C.pink, overflow: 'hidden', paddingTop: Platform.OS === 'android' ? 46 : 56, paddingBottom: 28, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.10)', top: -60, right: -40 }} />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', flex: 1 }}>🔴 Live Ride</Text>
        {(hasStd || hasHourly) && (
          <PulseView><GlowPulse color="#fff" size={12} /></PulseView>
        )}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {hasStd && (
          <View style={{ backgroundColor: C.glass, borderRadius: 20, elevation: 6, marginBottom: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder }}>
            <View style={{ backgroundColor: si.glassColor, padding: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: si.border }}>
              <Text style={{ fontSize: 24, marginRight: 10 }}>{si.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>Standard Ride</Text>
                <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{si.label}</Text>
              </View>
              <View style={{ backgroundColor: si.glassColor, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: si.border }}>
                <Text style={{ color: C.text, fontWeight: '800', fontSize: 17 }}>₹{rideData?.fare}</Text>
              </View>
            </View>
            <View style={{ padding: 14 }}>
              {(pickup || drop) ? (
                <View style={{ backgroundColor: C.glass, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.glassBorder }}>
                  {pickup ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: drop ? 8 : 0 }}><Text style={{ fontSize: 14, marginRight: 8, marginTop: 1 }}>📍</Text><Text style={{ color: C.textMuted, fontSize: 13, flex: 1 }} numberOfLines={2}>{pickup}</Text></View> : null}
                  {drop ? <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}><Text style={{ fontSize: 14, marginRight: 8, marginTop: 1 }}>🎯</Text><Text style={{ color: C.textMuted, fontSize: 13, flex: 1 }} numberOfLines={2}>{drop}</Text></View> : null}
                </View>
              ) : null}
              {driverInfo ? (
                <View style={{ backgroundColor: C.glass, borderRadius: 14, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 2, borderColor: C.pink }}>
                    <Text style={{ color: C.text, fontWeight: '800', fontSize: 18 }}>{(driverInfo.name||'D')[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{driverInfo.name}</Text>
                      {driverInfo.verified && <View style={{ backgroundColor: C.greenGlass, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C.greenBorder }}><Text style={{ fontSize: 9, color: C.green, fontWeight: '800' }}>✓ VERIFIED</Text></View>}
                    </View>
                    <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 1 }}>
                      {[driverInfo.vehicle_brand, driverInfo.vehicle_model].filter(Boolean).join(' ')}
                      {driverInfo.vehicle_no ? ` · ${driverInfo.vehicle_no}` : ''}
                    </Text>
                  </View>
                  {driverInfo?.name ? (
                    <TouchableOpacity onPress={callDriver} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.greenGlass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.greenBorder }}>
                      <Ionicons name="call" size={18} color={C.green} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
              {(stdStatus === 'matched' || stdStatus === 'arrived') && startOtp ? (
                <View style={{ backgroundColor: C.greenGlass, borderRadius: 14, padding: 14, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: C.greenBorder }}>
                  <Text style={{ fontSize: 12, color: C.green, fontWeight: '600', marginBottom: 4 }}>Ride Start OTP — Driver ko dikhao</Text>
                  <Text style={{ fontSize: 32, fontWeight: '800', color: C.green, letterSpacing: 8 }}>{startOtp}</Text>
                </View>
              ) : null}
              <Bouncy
                onPress={() => {
                  if (stdStatus === 'completed') setScreen('payment');
                  else if (stdStatus === 'started') setScreen('inride');
                  else setScreen('matching');
                }}
                style={{ backgroundColor: C.pink, borderRadius: 14, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', elevation: 8, shadowColor: C.pink, shadowOpacity: 0.5, shadowRadius: 10 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                  {stdStatus === 'completed' ? '💳 Payment Screen' : stdStatus === 'started' ? '🛣️ Ride Screen' : '🗺️ Full Tracking Screen'} →
                </Text>
              </Bouncy>
            </View>
          </View>
        )}

        {hasHourly && (
          <View style={{ backgroundColor: C.glass, borderRadius: 20, elevation: 6, marginBottom: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder }}>
            <View style={{ backgroundColor: 'rgba(123,31,162,0.18)', padding: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(123,31,162,0.35)' }}>
              <Text style={{ fontSize: 24, marginRight: 10 }}>⏱️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>
                  Hourly Ride · {hourlyBooking?.package_hours}h · {vEmoji[hourlyBooking?.vehicle_type] || '🚗'}
                </Text>
                <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{hStatus}</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(123,31,162,0.25)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: C.text, fontWeight: '800', fontSize: 17 }}>₹{hourlyBooking?.fare || hourlyBooking?.package_fare}</Text>
              </View>
            </View>
            <View style={{ padding: 14 }}>
              {hourlyStep === 'active' && (
                <View style={{ backgroundColor: 'rgba(123,31,162,0.12)', borderRadius: 14, padding: 14, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(123,31,162,0.35)' }}>
                  <Text style={{ fontSize: 12, color: '#ce93d8', fontWeight: '600', marginBottom: 4 }}>Time Elapsed</Text>
                  <Text style={{ fontSize: 30, fontWeight: '800', color: '#e1bee7', letterSpacing: 4 }}>{hTimerStr}</Text>
                  <Text style={{ fontSize: 11, color: '#ce93d8', marginTop: 4 }}>Package: {hourlyBooking?.package_hours} hours · {hourlyBooking?.km_included} km included</Text>
                </View>
              )}
              {hourlyBooking?.driver ? (
                <View style={{ backgroundColor: C.glass, borderRadius: 14, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(123,31,162,0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 2, borderColor: 'rgba(123,31,162,0.5)' }}>
                    <Text style={{ color: C.text, fontWeight: '800', fontSize: 18 }}>{(hourlyBooking.driver.name||'D')[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{hourlyBooking.driver.name}</Text>
                    <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 1 }}>{[hourlyBooking.driver.vehicle_brand, hourlyBooking.driver.vehicle_model].filter(Boolean).join(' ')}</Text>
                  </View>
                  {hourlyBooking?.driver?.name ? (
                    <TouchableOpacity onPress={() => initiateCall(null, hourlyBooking.id)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(123,31,162,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(123,31,162,0.4)' }}>
                      <Ionicons name="call" size={18} color="#ce93d8" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <View style={{ backgroundColor: C.yellowGlass, borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.yellowBorder }}>
                  <Text style={{ fontSize: 20, marginRight: 10 }}>🔍</Text>
                  <Text style={{ color: C.yellow, fontSize: 13, fontWeight: '700' }}>Driver dhoondha ja raha hai...</Text>
                </View>
              )}
              <Bouncy onPress={() => setScreen('hourly')} style={{ backgroundColor: C.pink, borderRadius: 14, padding: 14, alignItems: 'center', elevation: 8, shadowColor: C.pink, shadowOpacity: 0.5, shadowRadius: 10 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>⏱️ Full Hourly Ride Screen →</Text>
              </Bouncy>
            </View>
          </View>
        )}

        {!hasStd && !hasHourly && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 56, marginBottom: 16 }}>🚗</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 8 }}>Koi Active Ride Nahi</Text>
            <Text style={{ fontSize: 14, color: C.textMuted, textAlign: 'center', marginBottom: 28, paddingHorizontal: 30, lineHeight: 22 }}>Jab ride book karoge yahan live status milega — chahe app band ho jaye</Text>
            <Bouncy onPress={() => setTab('home')} style={[s.btn, { paddingHorizontal: 32 }]}>
              <Text style={s.btnTxt}>Book a Ride →</Text>
            </Bouncy>
          </View>
        )}
      </ScrollView>
      <View style={s.navFloat}><NavBar /></View>
    </View>
  );
}

function HistoryTab() {
  const {
    historyRides,
    favouriteBuddy,
    addFavouriteBuddy,
    rideIcon, setScreen,
  } = useApp();

  return (
    <View style={s.screen}>
      <View style={{ backgroundColor: C.pink, overflow: 'hidden', paddingTop: Platform.OS === 'android' ? 46 : 56, paddingBottom: 28, paddingHorizontal: 20 }}>
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.10)', top: -60, right: -40 }} />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>🕐 My Trips</Text>
      </View>
      <ScrollView style={{ flex: 1, padding: 14 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {historyRides.length === 0
          ? <EmptyAnim icon="🚖" title="Abhi koi trip nahi" sub="Pehli ride book karo aur yahan apni history dekho!" />
          : historyRides.map((h: any, i: number) => (
            <View key={i} style={s.histCard}>
              <View style={s.row}>
                <View style={s.histIcon}><Text style={{ fontSize: 20 }}>{rideIcon(h.ride_type)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.recentRoute} numberOfLines={1}>{h.pickup} → {h.drop_location}</Text>
                  <Text style={s.recentDate}>{new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · <Text style={{ color: h.status === 'completed' ? C.green : h.status === 'cancelled' ? C.pink : C.yellow }}>{h.status}</Text></Text>
                  {h.driver_name && <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Driver: {h.driver_name}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.recentFare}>₹{h.fare}</Text>
                  {h.status === 'completed' && h.driver_phone && (
                    <TouchableOpacity
                      onPress={async () => {
                        const alreadyBuddy = favouriteBuddy?.driver_phone === h.driver_phone;
                        if (alreadyBuddy) { alert('⭐ Yeh aapka Sppero Buddy pehle se hai!'); return; }
                        const res = await addFavouriteBuddy(h.driver_phone);
                        if (res?.success) alert(`⭐ ${h.driver_name} ab aapka Sppero Buddy hai!`);
                        else alert('⚠️ ' + (res?.error || 'Error'));
                      }}
                      style={{ marginTop: 5, backgroundColor: favouriteBuddy?.driver_phone === h.driver_phone ? C.greenGlass : C.yellowGlass, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: favouriteBuddy?.driver_phone === h.driver_phone ? C.greenBorder : C.yellowBorder }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: favouriteBuddy?.driver_phone === h.driver_phone ? C.green : C.yellow }}>
                        {favouriteBuddy?.driver_phone === h.driver_phone ? '✅ Buddy' : '⭐ Buddy?'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))
        }
      </ScrollView>
      <View style={s.navFloat}><NavBar /></View>
    </View>
  );
}

function ProfileTab() {
  const {
    userName, phone,
    walletBalance, customerRating,
    setScreen, setTab,
    setPhone, setOtp, setOtpDigits, setUserName, setGender, setWalletBalance,
    setPromoScreenCode, setPromoScreenMsg,
    loadWalletDetail, loadLoyalty, loadReferral, loadSaved,
    openRazorpayTopup,
  } = useApp();

  return (
    <View style={s.screen}>
      <View style={{ backgroundColor: C.pink, overflow: 'hidden', paddingTop: Platform.OS === 'android' ? 46 : 56, paddingBottom: 28, paddingHorizontal: 20 }}>
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.10)', top: -60, right: -40 }} />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>👤 Profile</Text>
      </View>
      <ScrollView style={{ flex: 1, padding: 14 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        <View style={s.profileHero}>
          <View style={s.profileAvatar}><Text style={{ color: '#fff', fontSize: 34, fontWeight: '800' }}>{(userName||'R')[0].toUpperCase()}</Text></View>
          <Text style={s.profileName}>{userName || 'Rider'}</Text>
          <Text style={s.profilePhone}>+91 {phone}</Text>
          <View style={s.badge}><Text style={{ color: C.yellow, fontWeight: '800' }}>⭐ {customerRating?.rating ? parseFloat(customerRating.rating).toFixed(1) : '5.0'} Rating{customerRating?.count > 0 ? ` · ${customerRating.count} rides` : ''}</Text></View>
        </View>

        <ShineCard style={[s.walletCard, { marginBottom: 14 }]}>
          <TouchableOpacity onPress={() => { loadWalletDetail(phone); loadLoyalty(phone); setScreen('wallet'); }} activeOpacity={0.85}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>💰 Wallet Balance</Text>
                <CountUp to={walletBalance} prefix="₹" style={{ color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 2 }} />
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Manage ›</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 14, gap: 8 }}>
              {[100, 200, 500].map(amt => (
                <TouchableOpacity key={amt} onPress={(e) => { e.stopPropagation?.(); openRazorpayTopup(amt); }}
                  style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)' }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+₹{amt}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); openRazorpayTopup(1000); }}
                style={{ flex: 1, backgroundColor: C.pink, borderRadius: 10, paddingVertical: 8, alignItems: 'center', elevation: 4, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 6 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>+₹1000</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </ShineCard>

        {[
          { label: 'Refer & Earn',       sub: 'Dost ko bulao, ₹50 pao',          icon: 'gift',          onPress: () => { loadReferral(); setScreen('referral'); }, iconColor: C.pink },
          { label: 'Cashback Rewards',   sub: 'Rides pe cashback earn karo',      icon: 'cash',          onPress: () => setScreen('rewards'),                     iconColor: C.green, iconBg: C.greenGlass, iconBorder: C.greenBorder },
          { label: 'Saved Places',       sub: 'Home, Office save karo',           icon: 'bookmark',      onPress: () => { loadSaved(); setScreen('saved'); },      iconColor: C.yellow },
          { label: 'Cancellation Policy',sub: 'Cancel rules aur fees',            icon: 'receipt',       onPress: () => setScreen('policy'),                       iconColor: C.pink },
          { label: 'Promo Codes',        sub: 'Discount codes apply karo',        icon: 'pricetag',      onPress: () => { setPromoScreenCode(''); setPromoScreenMsg(''); setScreen('promo'); }, iconColor: C.yellow },
          { label: 'Notifications',      sub: 'Alerts — Enabled ✓',              icon: 'notifications', onPress: () => Alert.alert('🔔 Notifications', 'Aapki sabhi ride notifications, wallet alerts aur offers automatically enable hain.'), iconColor: C.pink },
          { label: 'Safety',             sub: 'Emergency contacts & SOS',         icon: 'shield',        onPress: () => setScreen('safety'),                       iconColor: C.red },
          { label: 'Support',            sub: '24x7 help',                        icon: 'call',          onPress: () => setScreen('support'),                      iconColor: C.green },
        ].map((item, i) => (
          <Bouncy key={i} style={s.menuItem} onPress={item.onPress}>
            <View style={[s.menuIconBox, item.iconBg ? { backgroundColor: item.iconBg, borderColor: item.iconBorder } : {}]}>
              <Ionicons name={item.icon as any} size={18} color={item.iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: C.text, fontWeight: '700' }}>{item.label}</Text>
              <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{item.sub}</Text>
            </View>
            <Text style={{ fontSize: 18, color: C.textDim }}>›</Text>
          </Bouncy>
        ))}

        <Bouncy style={s.logoutBtn} onPress={async () => {
          await AsyncStorage.removeItem('userPhone'); await AsyncStorage.removeItem('userName');
          setScreen('login'); setTab('home'); setPhone(''); setOtp(''); setOtpDigits(['','','','','','']);
          setUserName(''); setGender(''); setWalletBalance(0);
        }}>
          <Text style={{ color: C.pink, fontWeight: '800', fontSize: 14 }}>🚪 Logout</Text>
        </Bouncy>
      </ScrollView>
      <View style={s.navFloat}><NavBar /></View>
    </View>
  );
}

export function HomeScreen() {
  const { tab } = useApp();
  if (tab === 'live')    return <LiveTab />;
  if (tab === 'history') return <HistoryTab />;
  if (tab === 'profile') return <ProfileTab />;
  return <HomeTab />;
}
