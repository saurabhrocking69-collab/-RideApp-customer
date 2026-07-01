import { useState, useEffect, useRef } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, Alert, Animated, Share, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Storage as AsyncStorage } from '../storage';
import { Ionicons } from '@expo/vector-icons';
import { apiPost, apiGet } from '../../api';
import { useRideStore } from '../../store';
import { useApp } from '../context/AppContext';
import { Bouncy, GlassPanel, PulseView, LucknowCityCard, SlideUp, CountUp, EmptyAnim, DotBG, GlowPulse, ShineCard } from '../components/ui';
import { s, C } from '../styles';
import { MAPS_KEY } from '../constants';
import { useNearbyDrivers } from '../offline';

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
    <GlassPanel intensity={16} style={[s.nav, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.6)' }]}>
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
    </GlassPanel>
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
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior="padding">
        <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 6, paddingHorizontal: 20, paddingBottom: 34, maxHeight: '90%', borderTopWidth: 1, borderColor: C.glassBorder, elevation: 30 }}>
          <View style={s.sheetHandle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.pinkGlass, alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden', borderWidth: 2, borderColor: C.pinkBorder }}>
                {favouriteBuddy.face_photo
                  ? <Image source={{ uri: favouriteBuddy.face_photo }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                  : <Text style={{ color: C.pink, fontWeight: '800', fontSize: 20 }}>{(favouriteBuddy.driver_name || 'D')[0].toUpperCase()}</Text>}
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
                  <TouchableOpacity onPress={goToMatching} style={{ marginTop: 14, backgroundColor: C.pink, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, width: '100%', alignItems: 'center', elevation: 4, shadowColor: C.pink, shadowOpacity: 0.2, shadowRadius: 6 }}>
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

const SCREEN_W = Dimensions.get('window').width;
const BANNER_CARDS = [
  {
    id: 'schedule',
    bg: ['#1a237e', '#283593'],
    badge: '⏰ NEW',
    title: 'Schedule a Ride',
    sub: 'Airport, office, doctor — pehle se book karo',
    cta: '📅 Book Now →',
    emoji: '📅',
    screen: 'scheduled' as const,
  },
  {
    id: 'referral',
    bg: ['#E91E63', '#c2185b'],
    badge: '🎁 REFER & EARN',
    title: '₹50 + ₹50 Reward',
    sub: 'Dost ko invite karo, dono ko cash!',
    cta: '🔗 Invite Friends →',
    emoji: '🤝',
    screen: 'referral' as const,
  },
  {
    id: 'hourly',
    bg: ['#7B1FA2', '#6A1B9A'],
    badge: '⏱️ HOURLY',
    title: 'Book by the Hour',
    sub: '2h · 4h · 6h · Full Day package',
    cta: '⏱️ Book Hourly →',
    emoji: '🕐',
    screen: 'hourly' as const,
  },
];

function PromoBanner({ setScreen, loadReferral }: { setScreen: (s: any) => void; loadReferral: () => void }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const CARD_W = SCREEN_W - 32; // 16px padding each side

  useEffect(() => {
    const iv = setInterval(() => {
      setActiveIdx(prev => {
        const next = (prev + 1) % BANNER_CARDS.length;
        scrollRef.current?.scrollTo({ x: next * CARD_W, animated: true });
        return next;
      });
    }, 3800);
    return () => clearInterval(iv);
  }, []);

  const dotAnim = useRef(BANNER_CARDS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    BANNER_CARDS.forEach((_, i) => {
      Animated.timing(dotAnim[i], { toValue: i === activeIdx ? 1 : 0, duration: 220, useNativeDriver: false }).start();
    });
  }, [activeIdx]);

  return (
    <View style={{ marginBottom: 14 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={e => setActiveIdx(Math.round(e.nativeEvent.contentOffset.x / CARD_W))}
        contentContainerStyle={{ paddingHorizontal: 0 }}
        style={{ width: CARD_W }}
      >
        {BANNER_CARDS.map((card, i) => (
          <TouchableOpacity
            key={card.id}
            activeOpacity={0.93}
            onPress={() => { if (card.id === 'referral') loadReferral(); setScreen(card.screen); }}
            style={{ width: CARD_W, borderRadius: 22, overflow: 'hidden', elevation: 8, shadowColor: card.bg[0], shadowOpacity: 0.35, shadowRadius: 14 }}>
            {/* Background */}
            <View style={{ backgroundColor: card.bg[0], padding: 20, paddingBottom: 0, minHeight: 130 }}>
              {/* Decorative circles */}
              <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -50 }} />
              <View style={{ position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -20, left: 20 }} />
              {/* Badge */}
              <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' }}>
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }}>{card.badge}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 0.3 }}>{card.title}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4, lineHeight: 17 }}>{card.sub}</Text>
                </View>
                <Text style={{ fontSize: 48, marginLeft: 12 }}>{card.emoji}</Text>
              </View>
            </View>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.22)', paddingVertical: 10, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '800' }}>{card.cta}</Text>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>TAP</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {/* Dot indicators */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {BANNER_CARDS.map((_, i) => (
          <Animated.View key={i} style={{
            height: 6, borderRadius: 3,
            width: dotAnim[i].interpolate({ inputRange: [0, 1], outputRange: [6, 20] }),
            backgroundColor: i === activeIdx ? C.pink : C.glassBorder,
          }} />
        ))}
      </View>
    </View>
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
    storeStatus, paymentDone,
    referralData,
  } = useApp();

  const [scheduledRides, setScheduledRides] = useState<any[]>([]);
  useEffect(() => {
    if (!phone) return;
    apiGet(`/api/rides/scheduled/${phone}`).then(d => { if (!d._error) setScheduledRides(d.rides || []); }).catch(() => {});
  }, [phone]);

  const nearbyAnim = useRef(new Animated.Value(1)).current;
  const userLat = (userCoords as any)?.latitude || (userCoords as any)?.lat;
  const userLng = (userCoords as any)?.longitude || (userCoords as any)?.lng;
  const { data: nearbyDriversData } = useNearbyDrivers(userLat, userLng);
  const nearbyCount = Array.isArray(nearbyDriversData) ? nearbyDriversData.length : 0;

  // Pulse animation for live driver badge
  useEffect(() => {
    const pulse = () =>
      Animated.sequence([
        Animated.timing(nearbyAnim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
        Animated.timing(nearbyAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ]).start(() => pulse());
    pulse();
  }, []);

  const GREETINGS = ['Namaste! 🙏', 'Chalein India ki sair? 🗺️', 'Safe Travels! 🛺', 'Sppero ke saath chalein! 🚀', 'Ride karo, India dekho! 🇮🇳'];
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <Text style={{ color: 'rgba(255,255,255,0.60)', fontSize: 10 }}>📍 India</Text>
              {nearbyCount > 0 && (
                <Animated.View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10,
                  paddingHorizontal: 7, paddingVertical: 2,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
                  transform: [{ scale: nearbyAnim }],
                }}>
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#4ade80' }} />
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{nearbyCount} drivers nearby</Text>
                </Animated.View>
              )}
            </View>
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
        {/* India city illustration */}
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

          {/* ── Animated Promo Banner ────────────────────────── */}
          <SlideUp delay={0}>
            <PromoBanner setScreen={setScreen} loadReferral={loadReferral} />
          </SlideUp>

          <SlideUp delay={10}>
            <Bouncy onPress={() => setScreen('booking')} style={s.searchBox}>
              <Ionicons name="search" size={18} color={C.textMuted} style={{ marginRight: 10 }} />
              <Text style={s.searchPh}>Kahan jaana hai?</Text>
              <View style={{ marginLeft: 'auto', backgroundColor: C.pink, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, elevation: 2, shadowColor: C.pink, shadowOpacity: 0.25, shadowRadius: 4 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Book</Text>
              </View>
            </Bouncy>
          </SlideUp>

          {/* ── Quick action row: Schedule + Hourly ─────────── */}
          <SlideUp delay={20}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <TouchableOpacity onPress={() => setScreen('scheduled')}
                style={{ flex: 1, backgroundColor: 'rgba(26,35,126,0.08)', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(26,35,126,0.2)', elevation: 3 }}>
                <Text style={{ fontSize: 24, marginBottom: 4 }}>📅</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#1a237e' }}>Schedule</Text>
                <Text style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>Pehle se book karo</Text>
                {scheduledRides.length > 0 && (
                  <View style={{ backgroundColor: '#1a237e', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{scheduledRides.length} upcoming</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                setHourlyStep('book'); setHPickup(''); setHDrop(''); setHPickupCoords(null); setHDropCoords(null);
                setHPickupSugg([]); setHDropSugg([]); setHRoundTrip(false); setHStayHours(1);
                setHourlyBooking(null); setScreen('hourly');
              }} style={{ flex: 1, backgroundColor: 'rgba(123,31,162,0.08)', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(123,31,162,0.2)', elevation: 3 }}>
                <Text style={{ fontSize: 24, marginBottom: 4 }}>⏱️</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#7B1FA2' }}>By Hour</Text>
                <Text style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>2h · 4h · 6h · Full Day</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { loadReferral(); setScreen('referral'); }}
                style={{ flex: 1, backgroundColor: C.pinkGlass, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: C.pinkBorder, elevation: 3 }}>
                <Text style={{ fontSize: 24, marginBottom: 4 }}>🎁</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: C.pink }}>Refer</Text>
                <Text style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>₹50 + ₹50</Text>
              </TouchableOpacity>
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
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.pinkGlass, alignItems: 'center', justifyContent: 'center', marginRight: 14, borderWidth: 2, borderColor: C.pinkBorder }}>
                    {favouriteBuddy.face_photo
                      ? <Image source={{ uri: favouriteBuddy.face_photo }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                      : <Text style={{ color: C.pink, fontWeight: '800', fontSize: 20 }}>{(favouriteBuddy.driver_name || 'D')[0].toUpperCase()}</Text>}
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
                    style={{ backgroundColor: C.pink, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', elevation: 3, shadowColor: C.pink, shadowOpacity: 0.2, shadowRadius: 5 }}>
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
            <TouchableOpacity activeOpacity={0.92} onPress={() => { loadReferral(); setScreen('referral'); }}
              style={{ borderRadius: 22, marginBottom: 14, overflow: 'hidden', elevation: 10, shadowColor: '#E91E63', shadowOpacity: 0.35, shadowRadius: 18 }}>

              {/* Main body */}
              <View style={{ backgroundColor: '#E91E63', padding: 18 }}>
                {/* Decorative bubbles */}
                <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)', top: -50, right: -40 }} />
                <View style={{ position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,215,0,0.10)', bottom: -30, left: 10 }} />

                {/* Top badge */}
                <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }}>🎁 REFER & EARN</Text>
                </View>

                {/* Headline + avatars row */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Dost ko invite karo</Text>
                    <Text style={{ color: '#FFD700', fontSize: 30, fontWeight: '900', lineHeight: 36 }}>₹50 + ₹50</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 }}>Dono ke wallet mein credited hoga</Text>
                  </View>
                  <View style={{ alignItems: 'center', gap: 10, marginLeft: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFD700' }}>
                        <Text style={{ fontSize: 20 }}>👤</Text>
                      </View>
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFD700', alignItems: 'center', justifyContent: 'center', marginHorizontal: -5, zIndex: 1, elevation: 3 }}>
                        <Text style={{ fontSize: 12, fontWeight: '900', color: '#222' }}>+</Text>
                      </View>
                      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)' }}>
                        <Text style={{ fontSize: 20 }}>🙋</Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: '#FFD700', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4 }}>
                      <Text style={{ color: '#111', fontSize: 12, fontWeight: '900' }}>Invite →</Text>
                    </View>
                  </View>
                </View>

                {/* Your code pill */}
                {referralData?.code && (
                  <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.20)', borderRadius: 16, padding: 14, gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 }}>YOUR CODE</Text>
                      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 3 }}>{referralData.code}</Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Share 🔗</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Footer strip */}
              <View style={{ backgroundColor: 'rgba(0,0,0,0.22)', paddingVertical: 9, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <PulseView><Text style={{ fontSize: 12 }}>✨</Text></PulseView>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700' }}>Instantly credited — no minimum required</Text>
              </View>
            </TouchableOpacity>
          </SlideUp>

          {rideData?.ride_id && !paymentDone && storeStatus !== 'completed' && (
            <SlideUp delay={125}>
              <TouchableOpacity
                onPress={() => {
                  if (storeStatus === 'started') setScreen('inride');
                  else setScreen('matching');
                }}
                style={{ backgroundColor: C.pinkGlass, borderRadius: 16, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 5, borderWidth: 1.5, borderColor: C.pinkBorder }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1.5, borderColor: C.pinkBorder }}>
                  <Text style={{ fontSize: 22 }}>{storeStatus === 'started' ? '🛣️' : '🚗'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>
                    {storeStatus === 'started' ? 'Ride Chal Rahi Hai!' : 'Active Ride In Progress!'}
                  </Text>
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

          {/* ── Sppero Buddy Feature Banner ── */}
          {!favouriteBuddy && (
            <SlideUp delay={160}>
              <TouchableOpacity activeOpacity={0.93} onPress={() => setTab('history')}
                style={{ borderRadius: 22, marginBottom: 14, overflow: 'hidden', elevation: 8, shadowColor: '#E91E63', shadowOpacity: 0.18, shadowRadius: 14 }}>

                {/* Main banner body */}
                <View style={{ backgroundColor: '#100818', padding: 18, paddingBottom: 0 }}>

                  {/* Top badge row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <View style={{ backgroundColor: 'rgba(233,30,99,0.18)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(233,30,99,0.4)', marginRight: 10 }}>
                      <Text style={{ color: '#E91E63', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }}>✨ SPPERO EXCLUSIVE</Text>
                    </View>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
                    <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginLeft: 10 }}>Free</Text>
                  </View>

                  {/* Headline */}
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 0.3, marginBottom: 4 }}>
                    ⭐ Apna{' '}
                    <Text style={{ color: '#FFD700' }}>Sppero Buddy</Text>
                    {'\n'}Banao
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 18, lineHeight: 18 }}>
                    Favourite driver save karo — har baar wahi trusted face!
                  </Text>

                  {/* 3 Steps */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    {[
                      { icon: '🚗', num: '1', title: 'Ride Lo', sub: 'Kisi bhi driver ke saath' },
                      { icon: '⭐', num: '2', title: 'Buddy Banao', sub: 'Trip baad mark karo' },
                      { icon: '📲', num: '3', title: 'Direct Book', sub: 'Sirf usse request' },
                    ].map(({ icon, num, title, sub }, i) => (
                      <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 6 }}>
                          <Text style={{ fontSize: 22 }}>{icon}</Text>
                        </View>
                        <View style={{ backgroundColor: '#E91E63', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, marginBottom: 4 }}>
                          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>STEP {num}</Text>
                        </View>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, textAlign: 'center', marginTop: 2, lineHeight: 13 }}>{sub}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Connector arrows between steps */}
                  <View pointerEvents="none" style={{ flexDirection: 'row', position: 'absolute', top: 114, left: 84, right: 84, justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16 }}>›</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16 }}>›</Text>
                  </View>

                  {/* Benefits row */}
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      '✅ Same trusted driver',
                      '✅ Queue skip — direct request',
                      '✅ Driver pehle se ready',
                    ].map((t, i) => (
                      <View key={i} style={{ backgroundColor: 'rgba(255,215,0,0.08)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,215,0,0.18)' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' }}>{t}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* CTA strip */}
                <View style={{ backgroundColor: '#E91E63', paddingHorizontal: 18, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>🕐 Trips tab mein Buddy banao</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>Ride ke baad driver ko mark karo</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>Dekho →</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </SlideUp>
          )}

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

          {/* ── Made in India footer ── */}
          <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 10 }}>
            <View style={{ width: 40, height: 1, backgroundColor: C.glassBorder, marginBottom: 16 }} />
            <Text style={{ fontSize: 22, marginBottom: 6 }}>🇮🇳</Text>
            <Text style={{ color: C.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>MADE IN INDIA</Text>
            <Text style={{ color: C.textDim, fontSize: 10, marginTop: 5, letterSpacing: 0.8 }}>Sppero Inc.</Text>
          </View>
        </View>
      </Animated.ScrollView>
      <View style={s.navFloat}><NavBar /></View>
      <BuddyBookModal />
    </View>
  );
}

function LiveTab() {
  const {
    rideData, storeStatus, paymentDone, hourlyBooking,
    hourlyStep, hourlyTimerSec,
    pickup, drop,
    setScreen, setTab,
    callDriver, initiateCall,
    rideIcon,
  } = useApp();
  const ride = useRideStore();

  const hasStd    = !!rideData?.ride_id && storeStatus !== 'cancelled' && !(paymentDone && storeStatus === 'completed');
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

  const [showBill, setShowBill] = useState(false);
  const [billRide, setBillRide] = useState<any>(null);
  const [billData, setBillData] = useState<any>(null);
  const [billLoading, setBillLoading] = useState(false);

  const openBill = async (h: any) => {
    setBillRide(h);
    setBillLoading(true);
    setShowBill(true);
    try {
      const d = await apiGet(`/api/rides/status/${h.id}`);
      setBillData(d.ride);
    } catch (_e) {
      setBillData(null);
    }
    setBillLoading(false);
  };

  const closeBill = () => { setShowBill(false); setBillRide(null); setBillData(null); };

  const billFareNum = Math.round(parseFloat(String(billRide?.fare ?? 0).replace(/[^0-9.]/g, '')) || 0);
  const billGst = Math.round((billFareNum * 5 / 105) * 100) / 100;
  const billBase = Math.round((billFareNum - billGst) * 100) / 100;
  const billId = '#SP' + String(billRide?.id || '').slice(-8).toUpperCase();
  const billDateStr = billRide ? new Date(billRide.created_at).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  }) : '';
  const billVehicle = (billRide?.ride_type || billData?.ride_type || 'Auto').replace(/\b\w/g, (c: string) => c.toUpperCase());
  const billPayLabel = () => {
    const m = billData?.payment_method || billRide?.payment_method || '';
    if (m === 'cash') return 'Cash 💵';
    if (m === 'wallet') return 'Sppero Wallet 👛';
    if (m === 'upi_qr') return 'UPI QR 📱';
    if (m === 'online' || m === 'upi' || m === 'razorpay') return 'Online / UPI 📱';
    return '—';
  };

  const shareBill = () => {
    const dist = billData?.distance ? `\n📏 Distance: ${billData.distance} km` : '';
    const text =
`🚖 *SPPERO — RIDE RECEIPT*
━━━━━━━━━━━━━━━━━━━

📋 *Booking ID:* ${billId}
📅 *Date:* ${billDateStr}

📍 *Pickup:*  ${billRide?.pickup || ''}
🏁 *Drop:*    ${billRide?.drop_location || ''}
${dist}
🚗 *Vehicle:* ${billVehicle}
👤 *Driver:*  ${billRide?.driver_name || billData?.driver_name || 'N/A'}

━━━━━━━━━━━━━━━━━━━
       *FARE BREAKDOWN*
━━━━━━━━━━━━━━━━━━━
Base Fare:       ₹${billBase.toFixed(2)}
GST (5%):        ₹${billGst.toFixed(2)}
━━━━━━━━━━━━━━━━━━━
*TOTAL PAID:  ₹${billFareNum}*
💳 *Payment:* ${billPayLabel()}
━━━━━━━━━━━━━━━━━━━

_GST fare mein included hai — alag se charge nahi hota._

🙏 *Sppero* mein safar karne ka shukriya!`;
    Share.share({ message: text });
  };

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
              {h.status === 'completed' && (
                <TouchableOpacity onPress={() => openBill(h)}
                  style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.glassMid, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.glassBorder }}>
                  <Text style={{ fontSize: 14 }}>🧾</Text>
                  <Text style={{ color: C.textMuted, fontWeight: '700', fontSize: 12 }}>Bill & Share</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        }
      </ScrollView>
      <View style={s.navFloat}><NavBar /></View>

      {/* Bill Modal */}
      <Modal visible={showBill} transparent animationType="slide" onRequestClose={closeBill}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#0d0d1a', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 32 }}>
            <View style={{ width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>

              <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                <Text style={{ fontSize: 28 }}>🧾</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 6, letterSpacing: 1 }}>SPPERO</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', letterSpacing: 2, marginTop: 2 }}>RIDE RECEIPT</Text>
              </View>

              <View style={{ borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 16 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Booking ID</Text>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{billId}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Date & Time</Text>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{billDateStr}</Text>
              </View>

              <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                  <Text style={{ fontSize: 16, marginRight: 10, marginTop: 1 }}>📍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginBottom: 2 }}>PICKUP</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{billRide?.pickup}</Text>
                  </View>
                </View>
                <View style={{ width: 2, height: 16, backgroundColor: 'rgba(255,255,255,0.15)', marginLeft: 17, marginBottom: 10 }} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 16, marginRight: 10, marginTop: 1 }}>🏁</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginBottom: 2 }}>DROP</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{billRide?.drop_location}</Text>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginBottom: 4 }}>VEHICLE</Text>
                  <Text style={{ fontSize: 18, marginBottom: 2 }}>🚗</Text>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{billVehicle}</Text>
                  {billData?.vehicle_no ? <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{billData.vehicle_no}</Text> : null}
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginBottom: 4 }}>DRIVER</Text>
                  <Text style={{ fontSize: 18, marginBottom: 2 }}>👤</Text>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{billRide?.driver_name || billData?.driver_name || 'N/A'}</Text>
                  {billLoading
                    ? <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>Loading...</Text>
                    : billData?.distance ? <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{billData.distance} km</Text> : null}
                </View>
              </View>

              <View style={{ borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 14 }} />
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textAlign: 'center', marginBottom: 14 }}>FARE BREAKDOWN</Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>Base Fare</Text>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>₹{billBase.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, alignItems: 'flex-end' }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>GST (5%)</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>Fare mein included hai</Text>
                </View>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>₹{billGst.toFixed(2)}</Text>
              </View>

              <View style={{ borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 14 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>TOTAL PAID</Text>
                <Text style={{ color: C.pink, fontSize: 28, fontWeight: '900' }}>₹{billFareNum}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>Payment Mode</Text>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{billPayLabel()}</Text>
              </View>

              <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 10, marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14 }}>ℹ️</Text>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 16, flex: 1 }}>
                  GST fare mein already included hai.{'\n'}Yeh amount alag se charge nahi hota.
                </Text>
              </View>

              <TouchableOpacity onPress={shareBill}
                style={{ backgroundColor: '#25D366', borderRadius: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 6, shadowColor: '#25D366', shadowOpacity: 0.4, shadowRadius: 10 }}>
                <Text style={{ fontSize: 20 }}>📤</Text>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>WhatsApp par Share Karo</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={closeBill} style={{ marginTop: 12, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>Dismiss</Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      </Modal>
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
    setComplaints, setCmpLoading,
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
          { label: 'Ride Budget',        sub: 'Monthly kharch track karo',        icon: 'bar-chart',     onPress: () => setScreen('budget'),                       iconColor: C.purple, iconBg: C.purpleGlass, iconBorder: C.purpleBorder },
          { label: 'Saved Places',       sub: 'Home, Office save karo',           icon: 'bookmark',      onPress: () => { loadSaved(); setScreen('saved'); },      iconColor: C.yellow },
          { label: 'Cancellation Policy',sub: 'Cancel rules aur fees',            icon: 'receipt',       onPress: () => setScreen('policy'),                       iconColor: C.pink },
          { label: 'Promo Codes',        sub: 'Discount codes apply karo',        icon: 'pricetag',      onPress: () => { setPromoScreenCode(''); setPromoScreenMsg(''); setScreen('promo'); }, iconColor: C.yellow },
          { label: 'Notifications',      sub: 'Alerts — Enabled ✓',              icon: 'notifications', onPress: () => Alert.alert('🔔 Notifications', 'Aapki sabhi ride notifications, wallet alerts aur offers automatically enable hain.'), iconColor: C.pink },
          { label: 'Safety',             sub: 'Emergency contacts & SOS',         icon: 'shield',        onPress: () => setScreen('safety'),                       iconColor: C.red },
          { label: 'My Complaints',      sub: 'File & track ride complaints',     icon: 'alert-circle',  onPress: async () => { setCmpLoading(true); try { const r = await apiGet(`/api/complaints?phone=${encodeURIComponent(phone)}`); setComplaints(r.complaints||[]); } catch {} setCmpLoading(false); setScreen('complaints'); }, iconColor: '#DC2626', iconBg: 'rgba(220,38,38,0.08)', iconBorder: 'rgba(220,38,38,0.25)' },
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
