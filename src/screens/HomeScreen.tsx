import { useState, useEffect, useRef } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, Alert, Animated, Easing, Share, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Storage as AsyncStorage } from '../storage';
import { Ionicons } from '@expo/vector-icons';
import { apiPost, apiGet } from '../../api';
import { useRideStore } from '../../store';
import { useApp } from '../context/AppContext';
import { Bouncy, GlassPanel, PulseView, SlideUp, CountUp, EmptyAnim, GlowPulse, ShineCard, FadeIn } from '../components/ui';
import { FluidGradient, GRADIENT } from '../components/FluidGradient';
import { s, C, T, SP, R, SHADOW } from '../styles';
import { MAPS_KEY, API } from '../constants';
import { useNearbyDrivers } from '../offline';
import { NotifBell, NotificationCenter, getUnreadCount } from '../components/NotificationCenter';


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
  // Spring-scale icons when active tab changes
  const iconScales = useRef([0,1,2,3].map(() => new Animated.Value(1))).current;
  useEffect(() => {
    navTabs.forEach(({ t }, i) => {
      Animated.spring(iconScales[i], {
        toValue: (t === tab && screen === 'home') ? 1.22 : 1,
        friction: 5, tension: 200, useNativeDriver: true,
      }).start();
    });
  }, [tab, screen]);

  return (
    <GlassPanel intensity={16} style={[s.nav, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.6)' }]}>
      {navTabs.map(({ t, ion, lbl }, i) => {
        const active = tab === t && screen === 'home';
        const col = active ? C.pink : C.textDim;
        return (
          <TouchableOpacity key={t} style={s.navItem} onPress={() => {
            setScreen('home'); setTab(t as any);
            if (t === 'history') loadHistory(phone);
          }} activeOpacity={1}>
            <Animated.View style={{ position: 'relative', alignItems: 'center', transform: [{ scale: iconScales[i] }] }}>
              <Ionicons name={(active ? ion : `${ion}-outline`) as any} size={24} color={col} />
              {t === 'live' && hasLive && !active && (
                <View style={{ position: 'absolute', top: -2, right: -6, width: 9, height: 9, borderRadius: 5, backgroundColor: C.pink, borderWidth: 1.5, borderColor: C.bg }} />
              )}
            </Animated.View>
            <Text style={[s.navLbl, active && s.navActive]}>{lbl}</Text>
            {active && <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: C.pink, marginTop: 4 }} />}
          </TouchableOpacity>
        );
      })}
    </GlassPanel>
  );
}

function BuddyBookModal() {
  const { bottom: bottomInset } = useSafeAreaInsets();
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
    setBuddyBookMsg('📍 Detecting location...');
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${userCoords.latitude},${userCoords.longitude}&key=${MAPS_KEY}`);
      const data = await res.json();
      const addr = data.results?.[0]?.formatted_address || '';
      if (addr) { setBuddyBookPU(addr); setBuddyBookPUCoords({ lat: userCoords.latitude, lng: userCoords.longitude }); setBuddyPUSugg([]); setBuddyBookMsg(''); }
      else setBuddyBookMsg('📍 Location not found — enter manually');
    } catch (_e) { setBuddyBookMsg('❌ Location fetch failed'); }
  };

  const bookWithBuddy = async () => {
    if (isOffline) { setBuddyBookMsg('⛔ Driver is offline — cannot send request'); return; }
    if (!buddyBookPU.trim()) { setBuddyBookMsg('⚠️ Enter pickup location'); return; }
    if (!buddyBookDR.trim()) { setBuddyBookMsg('⚠️ Enter drop location'); return; }
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
        setBuddyBookMsg(`⛔ ${res.driver_name || favouriteBuddy.driver_name} is offline — request cancelled. Try again later.`);
      } else if (res.reason === 'busy') {
        setBuddyBookMsg(`🚗 ${res.driver_name || favouriteBuddy.driver_name} is on another ride — request cancelled. Try again shortly.`);
      } else {
        setBuddyBookMsg('❌ ' + (res.error || 'Something went wrong — please try again'));
      }
    } catch (_e) { setBuddyBookMsg('❌ Network error — please try again'); }
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
        <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 6, paddingHorizontal: 20, paddingBottom: 14 + bottomInset, maxHeight: '90%', borderTopWidth: 1, borderColor: C.glassBorder, elevation: 30 }}>
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
                  <Text style={{ color: C.red, fontSize: 13, fontWeight: '800' }}>{favouriteBuddy.driver_name} is currently offline</Text>
                  <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>Request won't be sent. Try again later.</Text>
                </View>
              </View>
            )}

            {buddyWaiting ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>⏳</Text>
                <Text style={{ fontWeight: '800', fontSize: 17, color: C.text, textAlign: 'center' }}>Request Sent!</Text>
                <Text style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
                  Waiting for {favouriteBuddy.driver_name} to accept...{'\n'}They have 25 seconds to respond.
                </Text>
                {buddyBookMsg.startsWith('⚠️') || buddyBookMsg.startsWith('⛔') ? (
                  <>
                    <View style={{ backgroundColor: C.yellowGlass, borderRadius: 12, padding: 12, marginTop: 14, borderWidth: 1, borderColor: C.yellowBorder, width: '100%' }}>
                      <Text style={{ color: C.yellow, fontSize: 13, textAlign: 'center', fontWeight: '700' }}>{buddyBookMsg}</Text>
                    </View>
                    <TouchableOpacity onPress={goToMatching} style={{ marginTop: 14, backgroundColor: C.glass, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder }}>
                      <Text style={{ color: C.text, fontWeight: '800', fontSize: 14 }}>Book any available driver →</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity onPress={goToMatching} style={{ marginTop: 14, backgroundColor: C.pink, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, width: '100%', alignItems: 'center', elevation: 4, shadowColor: C.pink, shadowOpacity: 0.2, shadowRadius: 6 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Live Track →</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                <Text style={{ fontWeight: '700', fontSize: 13, color: C.textMuted, marginBottom: 8 }}>📍 Pickup Location</Text>
                <TouchableOpacity onPress={useMyLoc}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.greenGlass, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: C.greenBorder }}>
                  <Text style={{ fontSize: 15, marginRight: 8 }}>🎯</Text>
                  <Text style={{ color: C.green, fontSize: 13, fontWeight: '700' }}>Use my current location</Text>
                </TouchableOpacity>
                <TextInput
                  style={{ borderWidth: 1.5, borderColor: buddyBookPU ? C.green : C.glassBorder, borderRadius: 12, padding: 12, fontSize: 14, color: C.text, backgroundColor: C.glass, marginBottom: 4 }}
                  placeholder="Pickup location..."
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
                  placeholder="Where to?"
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
                    {buddyBookLoading ? '⏳ Sending request...' : isOffline ? '⛔ Driver Offline — Unavailable' : `⭐ Request ${favouriteBuddy.driver_name}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { closeModal(); setScreen('booking'); }} style={{ alignItems: 'center', marginTop: 12, paddingVertical: 6 }}>
                  <Text style={{ color: C.textMuted, fontSize: 13 }}>Book any available driver →</Text>
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
    sub: 'Airport, office, doctor — book in advance',
    cta: '📅 Book Now →',
    emoji: '📅',
    screen: 'scheduled' as const,
  },
  {
    id: 'referral',
    bg: [C.pink, '#c2185b'],
    badge: '🎁 REFER & EARN',
    title: '₹50 + ₹50 Reward',
    sub: 'Invite a friend, both get cash!',
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
    screen,
    userCoords,
    setRideType,
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

  // Search box micro-animation: pulsing pink border glow (native driver, smooth)
  const searchGlowOpacity = useRef(new Animated.Value(0.18)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(searchGlowOpacity, { toValue: 0.92, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(searchGlowOpacity, { toValue: 0.18, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadNotif, setUnreadNotif] = useState(() => getUnreadCount());
  // Refresh unread count when screen comes into view
  useEffect(() => { setUnreadNotif(getUnreadCount()); }, [screen]);

  // Pulse animation for live driver badge
  useEffect(() => {
    const pulse = () =>
      Animated.sequence([
        Animated.timing(nearbyAnim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
        Animated.timing(nearbyAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ]).start(() => pulse());
    pulse();
  }, []);

  const GREETINGS = ['Good to see you! 👋', 'Where are you headed? 🗺️', 'Safe Travels! 🛺', 'Ready to ride? 🚀', 'Let\'s go! 🇮🇳'];
  const [greetIdx, setGreetIdx] = useState(0);
  const greetFade  = useRef(new Animated.Value(1)).current;
  const greetSlide = useRef(new Animated.Value(0)).current;
  const scrollY    = useRef(new Animated.Value(0)).current;
  const tickerAnim = useRef(new Animated.Value(0)).current;
  const TICKER_W   = 1400;

  useEffect(() => {
    Animated.loop(
      Animated.timing(tickerAnim, {
        toValue: -TICKER_W,
        duration: 26000,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    ).start();
  }, []);

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
    <View style={[s.screen, { backgroundColor: C.bg }]}>
      {/* ── Golden yellow header ── */}
      <Animated.View style={{ height: headerH, backgroundColor: '#FFFBE6', overflow: 'hidden' }}>
        {/* Decorative amber circles */}
        <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(245,158,11,0.10)', top: -90, right: -60 }} />
        <View style={{ position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(245,158,11,0.07)', bottom: -40, left: 20 }} />
        <View style={{ position: 'absolute', width: 70,  height: 70,  borderRadius: 35, backgroundColor: 'rgba(245,158,11,0.05)', top: 10, left: '42%' }} />

        {/* Full header */}
        <Animated.View style={{ paddingTop: Platform.OS === 'android' ? 38 : 50, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', opacity: fullAlpha }}>
          <View style={{ flex: 1 }}>
            <Animated.Text style={{ color: '#92650A', fontSize: 12, fontWeight: '600', opacity: greetFade, transform: [{ translateY: greetSlide }] }}>
              {GREETINGS[greetIdx]}
            </Animated.Text>
            <Text style={{ color: '#1A1200', fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginTop: 3 }}>{userName || 'Rider'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <Ionicons name="location-outline" size={11} color="#A87B0A" />
              <Text style={{ color: '#A87B0A', fontSize: 10, fontWeight: '600' }}>India</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <NotifBell onPress={() => { setNotifOpen(true); setUnreadNotif(0); }} unread={unreadNotif} />
            <TouchableOpacity onPress={() => { setTab('profile'); loadWallet(phone); }}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: C.yellow, shadowOpacity: 0.45, shadowRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{(userName || 'R')[0].toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Mini row — compact when scrolled */}
        <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: miniAlpha }}>
          <Text style={{ color: '#1A1200', fontSize: 15, fontWeight: '900', letterSpacing: -0.3 }}>{userName || 'Rider'}</Text>
          <TouchableOpacity onPress={() => { setTab('profile'); loadWallet(phone); }}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: C.yellow, shadowOpacity: 0.45, shadowRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>{(userName || 'R')[0].toUpperCase()}</Text>
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
        {/* 1. ── Vehicle quick-select chips — FIRST ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {([
            { id: 'auto',   icon: 'car-outline' as const,        label: 'Auto',    hourly: false },
            { id: 'bike',   icon: 'bicycle-outline' as const,    label: 'Bike',    hourly: false },
            { id: 'car',    icon: 'car-sport-outline' as const,  label: 'Car',     hourly: false },
            { id: 'luxury', icon: 'diamond-outline' as const,    label: 'Luxury',  hourly: false },
            { id: 'hourly', icon: 'time-outline' as const,       label: 'By Hour', hourly: true  },
          ]).map(v => (
            <TouchableOpacity key={v.id}
              onPress={() => {
                if (v.hourly) {
                  setHourlyStep('book'); setHPickup(''); setHDrop(''); setHPickupCoords(null); setHDropCoords(null);
                  setHPickupSugg([]); setHDropSugg([]); setHRoundTrip(false); setHStayHours(1);
                  setHourlyBooking(null); setScreen('hourly');
                } else {
                  setRideType(v.id); setScreen('booking');
                }
              }}
              style={{
                alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12,
                backgroundColor: C.bgCard, borderRadius: 16,
                borderWidth: 1.5, borderColor: v.hourly ? C.purpleBorder : C.glassBorder,
                ...SHADOW.sm,
              }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: v.hourly ? C.purpleGlass : C.plumGlass, alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 1, borderColor: v.hourly ? C.purpleBorder : C.plumBorder }}>
                <Ionicons name={v.icon} size={20} color={v.hourly ? C.purple : C.plum} />
              </View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: v.hourly ? C.purple : C.plum }}>{v.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 2. ── Search bar with micro-animation — BELOW CHIPS ── */}
        <View style={{ marginHorizontal: 16, marginTop: 12, position: 'relative' }}>
          {/* Animated glowing border ring (native driver, opacity only) */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: -2, left: -2, right: -2, bottom: -2,
            borderRadius: 22, borderWidth: 2.5, borderColor: C.pink,
            opacity: searchGlowOpacity,
          }} />
          <TouchableOpacity onPress={() => setScreen('booking')} activeOpacity={0.88} style={{
            backgroundColor: C.bgCard,
            borderRadius: 20, paddingVertical: 15, paddingHorizontal: 18,
            flexDirection: 'row', alignItems: 'center', gap: 12,
            ...SHADOW.lg,
            borderWidth: 1.5, borderColor: 'rgba(233,69,96,0.18)',
            zIndex: 10,
          }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.pinkGlass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.pinkBorder }}>
              <Ionicons name="search" size={16} color={C.pink} />
            </View>
            <Text style={{ flex: 1, fontSize: 15, color: C.textMuted, fontWeight: '500' }}>Where are you going?</Text>
            <View style={{ backgroundColor: C.pink, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, ...SHADOW.pink }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>Go</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 2b. ── Live city pulse ticker ── */}
        <View style={{
          marginHorizontal: 16, marginTop: 10,
          height: 30, borderRadius: 10, overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
          justifyContent: 'center',
        }}>
          <Animated.View style={{ flexDirection: 'row', alignItems: 'center', transform: [{ translateX: tickerAnim }] }}>
            {([
              { dot: '#059669', text: `${nearbyCount > 0 ? nearbyCount + ' drivers near you' : 'Drivers active near you'}` },
              { dot: C.pink,    text: 'Avg 4 min pickup time' },
              { dot: C.yellow,  text: '4.8 avg driver rating' },
              { dot: C.mint,    text: '2,500+ drivers earning daily' },
              { dot: C.purple,  text: "India's only Buddy system" },
              { dot: C.pink,    text: 'Made in India 🇮🇳' },
              { dot: '#059669', text: 'Every ride tracked & safe' },
              { dot: C.yellow,  text: 'Cash · UPI · Wallet accepted' },
            ].concat([
              { dot: '#059669', text: `${nearbyCount > 0 ? nearbyCount + ' drivers near you' : 'Drivers active near you'}` },
              { dot: C.pink,    text: 'Avg 4 min pickup time' },
              { dot: C.yellow,  text: '4.8 avg driver rating' },
              { dot: C.mint,    text: '2,500+ drivers earning daily' },
              { dot: C.purple,  text: "India's only Buddy system" },
              { dot: C.pink,    text: 'Made in India 🇮🇳' },
              { dot: '#059669', text: 'Every ride tracked & safe' },
              { dot: C.yellow,  text: 'Cash · UPI · Wallet accepted' },
            ])).map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: item.dot, marginRight: 7 }} />
                <Text style={{ color: C.textMuted, fontSize: 11.5, fontWeight: '600', letterSpacing: 0.2 }}>{item.text}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        {/* 3. ── Smart "Drivers nearby" CTA ── */}
        {nearbyCount > 0 && (
          <TouchableOpacity onPress={() => setScreen('booking')} activeOpacity={0.9}
            style={{ marginHorizontal: 16, marginTop: 10 }}>
            <View style={{ backgroundColor: 'rgba(5,150,105,0.15)', borderWidth: 1.5, borderColor: 'rgba(5,150,105,0.35)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(5,150,105,0.20)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(5,150,105,0.4)' }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.green }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.green, fontSize: 13, fontWeight: '900' }}>
                  {nearbyCount} driver{nearbyCount > 1 ? 's' : ''} near you · ~{nearbyCount >= 6 ? 3 : nearbyCount >= 3 ? 5 : 8} min ETA
                </Text>
                <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>Tap to book now while they're close</Text>
              </View>
              <View style={{ backgroundColor: C.green, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>Book →</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Content area ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>

          {/* 5. ── Service cards 2×2 ── */}
          <SlideUp delay={0}>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <Bouncy onPress={() => setScreen('scheduled')}
                style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.sm }}>
                <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: C.plumGlass, alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 1, borderColor: C.plumBorder }}>
                  <Ionicons name="calendar-outline" size={21} color={C.plum} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '900', color: C.text }}>Schedule</Text>
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3, lineHeight: 14 }}>Book a ride in advance</Text>
                {scheduledRides.length > 0 && (
                  <View style={{ backgroundColor: C.plum, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginTop: 8, alignSelf: 'flex-start' }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{scheduledRides.length} upcoming</Text>
                  </View>
                )}
              </Bouncy>
              <Bouncy onPress={() => {
                setHourlyStep('book'); setHPickup(''); setHDrop(''); setHPickupCoords(null); setHDropCoords(null);
                setHPickupSugg([]); setHDropSugg([]); setHRoundTrip(false); setHStayHours(1);
                setHourlyBooking(null); setScreen('hourly');
              }} style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.sm }}>
                <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: C.purpleGlass, alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 1, borderColor: C.purpleBorder }}>
                  <Ionicons name="time-outline" size={21} color={C.purple} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '900', color: C.text }}>By Hour</Text>
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3, lineHeight: 14 }}>2h · 4h · Full Day</Text>
              </Bouncy>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <Bouncy onPress={() => setTab('history')}
                style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.sm }}>
                <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: C.pinkGlass, alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 1, borderColor: C.pinkBorder }}>
                  <Ionicons name="person-circle-outline" size={21} color={C.pink} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '900', color: C.text }}>Sppero Buddy</Text>
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3, lineHeight: 14 }}>
                  {favouriteBuddy ? `${favouriteBuddy.driver_name} · ${favouriteBuddy.is_online ? 'Online' : 'Offline'}` : 'Your trusted driver'}
                </Text>
              </Bouncy>
              <Bouncy onPress={() => { loadReferral(); setScreen('referral'); }}
                style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.sm }}>
                <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: C.pinkGlass, alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 1, borderColor: C.pinkBorder }}>
                  <Ionicons name="gift-outline" size={21} color={C.pink} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '900', color: C.text }}>Refer & Earn</Text>
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3, lineHeight: 14 }}>₹50 for you + friend</Text>
              </Bouncy>
            </View>
          </SlideUp>

          {/* 6. ── Sppero Buddy card (if has buddy) ── */}
          {favouriteBuddy && (
            <SlideUp delay={60}>
              <ShineCard style={{ backgroundColor: C.bgCard, borderRadius: 20, marginBottom: 14, borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.md }}>
                <View style={{ backgroundColor: C.plumGlass, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopLeftRadius: 19, borderTopRightRadius: 19, borderBottomWidth: 1, borderBottomColor: C.plumBorder }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="star" size={15} color={C.plum} />
                    <Text style={{ marginLeft: 6, fontWeight: '800', fontSize: 13, color: C.plum }}>My Sppero Buddy</Text>
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
                      ✅ {favouriteBuddy.rides_together || 0} rides together
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

          {/* 7. ── Recent routes — 2 trips, above footer, pickup→dotted→drop design ── */}
          {historyRides.length > 0 && (() => {
            const seen = new Set<string>();
            const uniqueRoutes = (historyRides as any[]).filter((h: any) => {
              if (!h.pickup?.trim() || !h.drop_location?.trim()) return false;
              const key = `${h.pickup.trim()}||${h.drop_location.trim()}`;
              if (seen.has(key)) return false;
              seen.add(key); return true;
            }).slice(0, 2);
            if (!uniqueRoutes.length) return null;
            return (
              <SlideUp delay={80}>
                <View style={{ marginBottom: 6, marginTop: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: C.textDim, letterSpacing: 1.2, marginBottom: 10 }}>RECENT ROUTES</Text>
                  {uniqueRoutes.map((h: any, i: number) => {
                    const shortPick = h.pickup.split(',')[0].trim();
                    const shortDrop = h.drop_location.split(',')[0].trim();
                    return (
                      <TouchableOpacity key={i}
                        onPress={() => { setPickup(h.pickup); setDrop(h.drop_location); setRideType(h.ride_type || 'auto'); setScreen('booking'); }}
                        activeOpacity={0.88}
                        style={{ backgroundColor: C.bgCard, borderRadius: 18, marginBottom: 9, borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.sm, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingLeft: 14, paddingRight: 14 }}>
                        {/* Route line indicator: circle → dots → square */}
                        <View style={{ width: 16, alignItems: 'center', marginRight: 12 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.green, borderWidth: 2, borderColor: C.bgCard }} />
                          <View style={{ width: 2, height: 4, backgroundColor: 'transparent', borderLeftWidth: 1.5, borderLeftColor: C.textDim, borderStyle: 'dashed', marginVertical: 1 }} />
                          <View style={{ width: 2, height: 4, backgroundColor: 'transparent', borderLeftWidth: 1.5, borderLeftColor: C.textDim, borderStyle: 'dashed', marginVertical: 1 }} />
                          <View style={{ width: 2, height: 4, backgroundColor: 'transparent', borderLeftWidth: 1.5, borderLeftColor: C.textDim, borderStyle: 'dashed', marginVertical: 1 }} />
                          <View style={{ width: 9, height: 9, borderRadius: 2.5, backgroundColor: C.pink, borderWidth: 2, borderColor: C.bgCard }} />
                        </View>
                        {/* Route text */}
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 10 }}>{shortPick}</Text>
                          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '500', color: C.textMuted }}>{shortDrop}</Text>
                        </View>
                        {/* Book chip */}
                        <View style={{ backgroundColor: C.pinkGlass, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 7, borderWidth: 1, borderColor: C.pinkBorder, marginLeft: 10 }}>
                          <Text style={{ color: C.pink, fontSize: 12, fontWeight: '900' }}>Book →</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </SlideUp>
            );
          })()}

          {/* 8. ── Active offers ── */}
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
                        <Text style={{ fontSize: 11, color: C.textMuted }}>Apply at booking</Text>
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

          {/* 9. ── Active ride banners ── */}
          {rideData?.ride_id && !paymentDone && storeStatus !== 'completed' && (
            <SlideUp delay={0}>
              <TouchableOpacity
                onPress={() => {
                  if (storeStatus === 'started') setScreen('inride');
                  else setScreen('matching');
                }}
                style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.pinkBorder, ...SHADOW.md }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.pinkGlass, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: C.pinkBorder }}>
                  <Ionicons name={storeStatus === 'started' ? 'navigate-outline' : 'car-outline'} size={22} color={C.pink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>
                    {storeStatus === 'started' ? 'Ride In Progress' : 'Looking for Driver'}
                  </Text>
                  <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{drop ? `To ${drop}` : 'Tap to view ride status'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={C.pink} />
              </TouchableOpacity>
            </SlideUp>
          )}

          {hourlyBooking && ['pending','matched','active'].includes(hourlyBooking.status) && (
            <SlideUp delay={0}>
              <TouchableOpacity onPress={() => setScreen('hourly')} style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.purpleBorder, ...SHADOW.md }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.purpleGlass, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: C.purpleBorder }}>
                  <Ionicons name="time-outline" size={22} color={C.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>Active Hourly Ride</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>Tap to resume your hourly ride</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={C.purple} />
              </TouchableOpacity>
            </SlideUp>
          )}

          {/* 10. ── Sppero Buddy intro (if no buddy set) ── */}
          {!favouriteBuddy && (
            <SlideUp delay={120}>
              <TouchableOpacity activeOpacity={0.93} onPress={() => setTab('history')}
                style={{ borderRadius: 20, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.md }}>
                <View style={{ backgroundColor: C.bgCard, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: C.plumGlass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.plumBorder }}>
                    <Ionicons name="person-circle-outline" size={28} color={C.plum} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ backgroundColor: C.pinkGlass, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 5, borderWidth: 1, borderColor: C.pinkBorder }}>
                      <Text style={{ color: C.pink, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>SPPERO EXCLUSIVE</Text>
                    </View>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '900' }}>Set Your Sppero Buddy</Text>
                    <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 3 }}>Same trusted driver every time</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
                </View>
                <View style={{ backgroundColor: C.plum, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: 12 }}>Set from your Trips tab after any ride</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>View</Text>
                    <Ionicons name="arrow-forward" size={13} color="#fff" />
                  </View>
                </View>
              </TouchableOpacity>
            </SlideUp>
          )}

          {/* ── Made in India footer ── */}
          <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 10 }}>
            <View style={{ width: 40, height: 1, backgroundColor: C.glassBorder, marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <Ionicons name="heart" size={13} color={C.pink} />
              <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>MADE IN INDIA</Text>
            </View>
            <Text style={{ color: C.textDim, fontSize: 10, letterSpacing: 0.8 }}>Sppero Inc. · India</Text>
          </View>
        </View>
      </Animated.ScrollView>
      <View style={s.navFloat}><NavBar /></View>
      <BuddyBookModal />
      <NotificationCenter
        visible={notifOpen}
        onClose={() => setNotifOpen(false)}
        phone={phone}
      />
    </View>
  );
}

function LiveTab() {
  const {
    rideData, storeStatus, paymentDone, hourlyBooking, setHourlyBooking,
    hourlyStep, setHourlyStep, hourlyTimerSec,
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
    requested: { label: 'Looking for a driver...', color: C.saffron, glassColor: C.saffGlass, border: C.saffBorder, icon: '🔍' },
    matched:   { label: 'Driver is on the way',    color: C.purple,  glassColor: C.glassMid,   border: C.glassBorder, icon: '🚗' },
    arrived:   { label: 'Driver has arrived!',     color: C.green,   glassColor: C.greenGlass, border: C.greenBorder, icon: '📍' },
    started:   { label: 'Trip is ongoing',         color: C.purple,  glassColor: 'rgba(124,58,237,0.10)', border: 'rgba(124,58,237,0.30)', icon: '🛣️' },
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
  const hStatus   = hourlyStep === 'active' ? 'Trip is ongoing' : hourlyBooking?.status === 'matched' ? 'Driver is on the way' : 'Looking for a driver...';
  const hColor    = hourlyStep === 'active' ? '#7b1fa2' : hourlyBooking?.status === 'matched' ? '#1565C0' : '#f57c00';
  const vEmoji: any = { auto:'🛺', bike:'🏍️', car:'🚕', eriksha:'🛵', ultra_luxury:'🚙', green_bike:'⚡', electric_auto:'🌿' };

  return (
    <View style={s.screen}>
      <View style={{ backgroundColor: C.plum, overflow: 'hidden', paddingTop: Platform.OS === 'android' ? 46 : 56, paddingBottom: 28, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,45,120,0.07)', top: -60, right: -40 }} />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', flex: 1 }}>Live Ride</Text>
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
                  <Text style={{ color: C.yellow, fontSize: 13, fontWeight: '700', flex: 1 }}>Looking for a driver...</Text>
                  {hourlyBooking?.status === 'pending' && (
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          await apiPost('/api/hourly/cancel', { booking_id: hourlyBooking.id });
                        } catch (_) {}
                        setHourlyBooking(null);
                        setHourlyStep('book');
                      }}
                      style={{ backgroundColor: 'rgba(255,59,48,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,59,48,0.35)', marginLeft: 10 }}>
                      <Text style={{ color: '#ff3b30', fontSize: 12, fontWeight: '800' }}>Cancel</Text>
                    </TouchableOpacity>
                  )}
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
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 8 }}>No Active Ride</Text>
            <Text style={{ fontSize: 14, color: C.textMuted, textAlign: 'center', marginBottom: 28, paddingHorizontal: 30, lineHeight: 22 }}>When you book a ride, live status will appear here — even if you close the app</Text>
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
  const { bottom: bottomInset } = useSafeAreaInsets();
  const {
    historyRides,
    favouriteBuddy,
    addFavouriteBuddy,
    rideIcon, setScreen, setTab,
    setPickup, setDrop,
    setPickupCoords, setDropCoords,
    scratchCard, setScratchCard,
    scratched, setScratched,
    scratchAnim, scratchNow,
  } = useApp();

  const [showDetail, setShowDetail] = useState(false);
  const [detailRide, setDetailRide] = useState<any>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (h: any) => {
    setDetailRide(h);
    setDetailLoading(true);
    setShowDetail(true);
    try {
      const d = await apiGet(`/api/rides/status/${h.id}`);
      setDetailData(d.ride);
    } catch (_e) {
      setDetailData(null);
    }
    setDetailLoading(false);
  };

  const closeDetail = () => { setShowDetail(false); setDetailRide(null); setDetailData(null); };

  // ── computed detail values ────────────────────────────────────────────────
  const ride = detailRide;
  const rideDetail = detailData;
  const fareNum   = Math.round(parseFloat(String(ride?.fare ?? 0).replace(/[^0-9.]/g, '')) || 0);
  const gst       = Math.round((fareNum * 5 / 105) * 100) / 100;
  const base      = Math.round((fareNum - gst) * 100) / 100;
  const rideId    = '#SP' + String(ride?.id || '').slice(-8).toUpperCase();
  const dateStr   = ride ? new Date(ride.created_at).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  }) : '';
  const vehicleType = (ride?.ride_type || rideDetail?.ride_type || 'Auto').replace(/\b\w/g, (c: string) => c.toUpperCase());
  const vehicleLabel = [rideDetail?.vehicle_brand, rideDetail?.vehicle_model].filter(Boolean).join(' ') || vehicleType;
  const payLabel = () => {
    const m = rideDetail?.payment_method || ride?.payment_method || '';
    if (m === 'cash') return 'Cash 💵';
    if (m === 'wallet') return 'Sppero Wallet 👛';
    if (m === 'upi_qr') return 'UPI QR 📱';
    if (m === 'online' || m === 'upi' || m === 'razorpay') return 'Online / UPI 📱';
    return '—';
  };
  const driverRating = rideDetail?.driver_rating ? parseFloat(rideDetail.driver_rating).toFixed(1) : null;
  const customerRatingGiven = rideDetail?.customer_rating || rideDetail?.rating;
  const distanceKm = rideDetail?.distance ? String(rideDetail.distance).replace(' km', '') : null;

  const shareReceipt = () => {
    const distLine = distanceKm ? `\n📏 Distance: ${distanceKm} km` : '';
    const text =
`🚖 *SPPERO — RIDE RECEIPT*
━━━━━━━━━━━━━━━━━━━

📋 *Booking ID:* ${rideId}
📅 *Date:* ${dateStr}

📍 *Pickup:*  ${ride?.pickup || ''}
🏁 *Drop:*    ${ride?.drop_location || ''}
${distLine}
🚗 *Vehicle:* ${vehicleLabel}${rideDetail?.vehicle_no ? ' · ' + rideDetail.vehicle_no : ''}
👤 *Driver:*  ${ride?.driver_name || rideDetail?.driver_name || 'N/A'}

━━━━━━━━━━━━━━━━━━━
       *FARE BREAKDOWN*
━━━━━━━━━━━━━━━━━━━
Base Fare:       ₹${base.toFixed(2)}
GST (5%):        ₹${gst.toFixed(2)}
━━━━━━━━━━━━━━━━━━━
*TOTAL PAID:  ₹${fareNum}*
💳 *Payment:* ${payLabel()}
━━━━━━━━━━━━━━━━━━━

_GST is included in the fare._
🙏 Thank you for riding with *Sppero*!`;
    Share.share({ message: text });
  };

  const rebookRide = () => {
    if (!ride) return;
    setPickup(ride.pickup || '');
    setDrop(ride.drop_location || '');
    setPickupCoords(null);
    setDropCoords(null);
    closeDetail();
    setTab('home');
    setScreen('booking');
  };

  const statusColor = (st: string) => {
    if (st === 'completed') return C.green;
    if (st === 'cancelled') return C.pink;
    return C.yellow;
  };
  const statusBg = (st: string) => {
    if (st === 'completed') return 'rgba(5,150,105,0.15)';
    if (st === 'cancelled') return 'rgba(255,45,120,0.15)';
    return 'rgba(251,191,36,0.15)';
  };

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={{ backgroundColor: C.plum, overflow: 'hidden', paddingTop: Platform.OS === 'android' ? 46 : 56, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,45,120,0.18)', top: -80, right: -50 }} />
        <View style={{ position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,45,120,0.10)', bottom: -40, left: 40 }} />
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0.3 }}>My Trips</Text>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 4 }}>
          {historyRides.length > 0 ? `${historyRides.length} trips · tap for full details` : 'Your ride history will appear here'}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, paddingBottom: 100 }}>
        {/* Scratch card — shown in Trips tab after a completed ride */}
        {scratchCard && (
          <Animated.View style={{ transform: [{ scale: scratched ? 1 : scratchAnim }], marginBottom: 14 }}>
            <TouchableOpacity activeOpacity={0.85} onPress={scratchNow}
              style={[s.scratchCard, { backgroundColor: scratched ? C.greenGlass : C.yellow, borderWidth: 2, borderColor: scratched ? C.greenBorder : C.yellow, borderRadius: 20 }]}>
              {scratched ? (
                <FadeIn style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 40 }}>🎉</Text>
                  <Text style={{ fontSize: 14, color: C.textMuted, marginTop: 6 }}>You got a reward!</Text>
                  <Text style={{ fontSize: 42, fontWeight: '900', color: C.green, marginTop: 4 }}>₹{scratchCard.reward}</Text>
                  <Text style={{ fontSize: 12, color: C.green, marginTop: 4, fontWeight: '700' }}>✅ Added to your wallet!</Text>
                </FadeIn>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 40 }}>🎟️</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: C.text, marginTop: 6 }}>Scratch Card Won!</Text>
                  <Text style={{ fontSize: 13, color: 'rgba(0,0,0,0.7)', marginTop: 4 }}>👆 Tap to scratch & reveal your reward</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {historyRides.length === 0
          ? <EmptyAnim icon="🚖" title="No trips yet" sub="Book your first ride and see your history here!" />
          : historyRides.map((h: any, i: number) => {
            const pickup    = h.pickup?.trim()        || null;
            const drop      = h.drop_location?.trim() || null;
            const shortPick = pickup ? pickup.split(',')[0] : null;
            const shortDrop = drop   ? drop.split(',')[0]  : null;
            const isCompleted = h.status === 'completed';
            const isCancelled = h.status === 'cancelled';
            const sc = statusColor(h.status);
            const isBuddy = favouriteBuddy?.driver_phone === h.driver_phone;
            const dt = new Date(h.created_at);
            const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            const dateStr = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            return (
              <TouchableOpacity key={i} activeOpacity={0.80} onPress={() => openDetail(h)}
                style={{ backgroundColor: C.bgCard, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: C.glassBorder, overflow: 'hidden', elevation: 3, shadowColor: sc, shadowOpacity: 0.12, shadowRadius: 8 }}>

                {/* Top accent bar */}
                <View style={{ height: 3.5, backgroundColor: sc }} />

                <View style={{ padding: 16 }}>
                  {/* Row 1: vehicle chip + date/time + status badge */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    {/* Vehicle pill */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.plumGlass, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.plumBorder }}>
                      <Ionicons name={h.ride_type === 'bike' ? 'bicycle-outline' : h.ride_type === 'luxury' ? 'diamond-outline' : 'car-outline'} size={13} color={C.plum} />
                      <Text style={{ color: C.plum, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
                        {(h.ride_type || 'ride').replace('_', ' ')}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }} />
                    {/* Date + time */}
                    <Text style={{ color: C.textMuted, fontSize: 11, marginRight: 8 }}>{dateStr} · {timeStr}</Text>
                    {/* Status badge */}
                    <View style={{ backgroundColor: statusBg(h.status), borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: sc + '44' }}>
                      <Text style={{ color: sc, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>
                        {isCompleted ? 'COMPLETED' : isCancelled ? 'CANCELLED' : (h.status || '').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Row 2: Route timeline + Fare */}
                  <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                    {/* Route visual */}
                    <View style={{ flex: 1, marginRight: 14 }}>
                      {/* Pickup */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.green, borderWidth: 2, borderColor: C.greenBorder }} />
                        <Text style={{ color: pickup ? C.text : C.textDim, fontSize: 13, fontWeight: pickup ? '700' : '400', flex: 1, fontStyle: pickup ? 'normal' : 'italic' }} numberOfLines={1}>
                          {shortPick || 'Pickup not recorded'}
                        </Text>
                      </View>
                      {/* Connector line */}
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginLeft: 4.5, paddingVertical: 3 }}>
                        <View style={{ width: 1, height: 18, backgroundColor: C.glassBorder, marginRight: 14 }} />
                        {h.driver_name ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                            <Ionicons name="person-outline" size={10} color={C.textDim} />
                            <Text style={{ color: C.textMuted, fontSize: 10.5, flex: 1 }} numberOfLines={1}>{h.driver_name}</Text>
                          </View>
                        ) : h.payment_method ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="card-outline" size={10} color={C.textDim} />
                            <Text style={{ color: C.textMuted, fontSize: 10.5 }}>
                              {h.payment_method === 'cash' ? 'Cash' : h.payment_method === 'wallet' ? 'Wallet' : 'UPI'}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {/* Drop */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: C.pink, borderWidth: 2, borderColor: C.pinkBorder }} />
                        <Text style={{ color: drop ? C.textMuted : C.textDim, fontSize: 12, fontWeight: drop ? '500' : '400', flex: 1, fontStyle: drop ? 'normal' : 'italic' }} numberOfLines={1}>
                          {isCancelled ? (shortDrop || 'Cancelled before drop') : (shortDrop || 'Drop not recorded')}
                        </Text>
                      </View>
                    </View>

                    {/* Fare + Buddy */}
                    <View style={{ alignItems: 'flex-end', justifyContent: 'center', minWidth: 58 }}>
                      <Text style={{ color: isCompleted ? C.text : C.textMuted, fontSize: 20, fontWeight: '900', lineHeight: 24 }}>
                        {isCompleted ? `₹${parseFloat(h.fare || 0).toFixed(0)}` : '—'}
                      </Text>
                      {isCompleted && h.payment_method && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                          <Ionicons name={h.payment_method === 'cash' ? 'cash-outline' : h.payment_method === 'wallet' ? 'wallet-outline' : 'phone-portrait-outline'} size={10} color={C.textDim} />
                          <Text style={{ color: C.textDim, fontSize: 10 }}>
                            {h.payment_method === 'cash' ? 'Cash' : h.payment_method === 'wallet' ? 'Wallet' : 'UPI'}
                          </Text>
                        </View>
                      )}
                      {isCompleted && h.driver_phone && (
                        <TouchableOpacity
                          onPress={async (e) => {
                            e.stopPropagation?.();
                            if (isBuddy) { alert('Already your Sppero Buddy!'); return; }
                            const res = await addFavouriteBuddy(h.driver_phone);
                            if (res?.success) alert(`${h.driver_name} is now your Sppero Buddy!`);
                            else alert(res?.error || 'Error');
                          }}
                          style={{ marginTop: 8, backgroundColor: isBuddy ? C.greenGlass : C.plumGlass, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: isBuddy ? C.greenBorder : C.plumBorder, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name={isBuddy ? 'checkmark-circle' : 'star-outline'} size={11} color={isBuddy ? C.green : C.plum} />
                          <Text style={{ fontSize: 10, fontWeight: '900', color: isBuddy ? C.green : C.plum }}>
                            {isBuddy ? 'Buddy' : 'Buddy'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        }
      </ScrollView>
      <View style={s.navFloat}><NavBar /></View>

      {/* ── Rich Trip Detail Modal ──────────────────────────────────────── */}
      <Modal visible={showDetail} transparent animationType="slide" onRequestClose={closeDetail}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgDark, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '93%', borderTopWidth: 1.5, borderTopColor: 'rgba(255,45,120,0.20)' }}>
            {/* Drag handle */}
            <View style={{ width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2, alignSelf: 'center', marginTop: 12 }} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 + bottomInset }}>

              {/* ── Section 1: Status + IDs ── */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 24 }}>{rideIcon(ride?.ride_type)}</Text>
                  <View>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>{vehicleType} Ride</Text>
                    <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 1 }}>{rideId}</Text>
                  </View>
                </View>
                {ride?.status && (
                  <View style={{ backgroundColor: statusBg(ride.status), borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: statusColor(ride.status) + '44' }}>
                    <Text style={{ color: statusColor(ride.status), fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 }}>{ride.status}</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 20 }}>{dateStr}</Text>

              {/* ── Section 2: Route visual ── */}
              <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.glassBorder }}>
                {/* Pickup */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ width: 28, alignItems: 'center' }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: C.mint, marginTop: 3 }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(0,212,168,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 3 }}>PICKUP</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 18 }}>{ride?.pickup || '—'}</Text>
                  </View>
                </View>
                {/* Connecting line */}
                <View style={{ flexDirection: 'row', marginVertical: 6 }}>
                  <View style={{ width: 28, alignItems: 'center' }}>
                    <View style={{ width: 2, height: 28, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 1 }} />
                  </View>
                  {distanceKm && (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                      <Text style={{ color: C.textMuted, fontSize: 11 }}>📏 {distanceKm} km</Text>
                    </View>
                  )}
                </View>
                {/* Drop */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ width: 28, alignItems: 'center' }}>
                    <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: C.pink, marginTop: 3 }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,45,120,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 3 }}>DROP</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 18 }}>{ride?.drop_location || '—'}</Text>
                  </View>
                </View>
              </View>

              {/* ── Section 3: Driver card ── */}
              {(ride?.driver_name || rideDetail?.driver_name) && (
                <View style={{ backgroundColor: 'rgba(255,45,120,0.07)', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,45,120,0.18)', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  {/* Avatar */}
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,45,120,0.15)', borderWidth: 2, borderColor: 'rgba(255,45,120,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 26 }}>👤</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>{ride?.driver_name || rideDetail?.driver_name}</Text>
                      {rideDetail?.driver_verification_status === 'verified' && (
                        <View style={{ backgroundColor: 'rgba(5,150,105,0.2)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: C.green, fontSize: 9, fontWeight: '800' }}>✓ VERIFIED</Text>
                        </View>
                      )}
                    </View>
                    {driverRating && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        <Text style={{ color: C.yellow, fontSize: 13 }}>★</Text>
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{driverRating}</Text>
                        <Text style={{ color: C.textMuted, fontSize: 11 }}>driver rating</Text>
                      </View>
                    )}
                    {detailLoading
                      ? <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 3 }}>Loading vehicle info...</Text>
                      : (
                        <View style={{ marginTop: 4 }}>
                          {vehicleLabel && <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{vehicleLabel}</Text>}
                          {rideDetail?.vehicle_no && (
                            <View style={{ marginTop: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>{rideDetail.vehicle_no}</Text>
                            </View>
                          )}
                        </View>
                      )
                    }
                  </View>
                </View>
              )}

              {/* ── Section 4: Fare breakdown ── */}
              <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.glassBorder }}>
                <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 14 }}>FARE BREAKDOWN</Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>Base Fare</Text>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>₹{base.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
                  <View>
                    <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>GST (5%)</Text>
                    <Text style={{ color: C.textMuted, fontSize: 10, marginTop: 2 }}>Included in fare</Text>
                  </View>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>₹{gst.toFixed(2)}</Text>
                </View>

                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 14 }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>Total Paid</Text>
                  <Text style={{ color: C.pink, fontSize: 28, fontWeight: '900' }}>₹{fareNum}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>Payment</Text>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{payLabel()}</Text>
                </View>
              </View>

              {/* ── Section 5: Rating given ── */}
              {customerRatingGiven != null && (
                <View style={{ backgroundColor: 'rgba(251,191,36,0.07)', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(251,191,36,0.18)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 20 }}>⭐</Text>
                  <View>
                    <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>YOUR RATING</Text>
                    <View style={{ flexDirection: 'row', marginTop: 4 }}>
                      {[1,2,3,4,5].map(s => (
                        <Text key={s} style={{ fontSize: 18, color: s <= customerRatingGiven ? C.yellow : 'rgba(255,255,255,0.15)' }}>★</Text>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* ── Section 6: Actions ── */}
              <View style={{ gap: 10 }}>
                {/* Rebook */}
                {ride?.status === 'completed' && (
                  <TouchableOpacity onPress={rebookRide}
                    style={{ backgroundColor: C.pink, borderRadius: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 6, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 12 }}>
                    <Text style={{ fontSize: 18 }}>🔄</Text>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Rebook This Route</Text>
                  </TouchableOpacity>
                )}

                {/* Share receipt */}
                <TouchableOpacity onPress={shareReceipt}
                  style={{ backgroundColor: '#25D366', borderRadius: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 4, shadowColor: '#25D366', shadowOpacity: 0.35, shadowRadius: 10 }}>
                  <Text style={{ fontSize: 18 }}>📤</Text>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Share Receipt</Text>
                </TouchableOpacity>

                {/* Report issue */}
                <TouchableOpacity onPress={() => { closeDetail(); setScreen('complaint-new'); }}
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.glassBorder }}>
                  <Text style={{ fontSize: 16 }}>🚨</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 14 }}>Report an Issue</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={closeDetail} style={{ paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: C.textMuted, fontSize: 14 }}>Dismiss</Text>
                </TouchableOpacity>
              </View>

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

  const ratingVal = customerRating?.rating ? parseFloat(customerRating.rating).toFixed(1) : '5.0';
  const rideCount = customerRating?.count || 0;

  return (
    <View style={s.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Plum hero ─────────────────────────────────────────── */}
        <View style={{ backgroundColor: C.plum, overflow: 'hidden', paddingTop: Platform.OS === 'android' ? 46 : 56, paddingBottom: 52, paddingHorizontal: SP.lg }}>
          <View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,45,120,0.18)', top: -80, right: -60 }} />
          <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,45,120,0.10)', bottom: -40, left: 30 }} />
          <Text style={{ ...T.title, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.5, marginBottom: SP.lg }}>PROFILE</Text>
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 3, borderColor: C.pink, alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: C.pink, shadowOpacity: 0.5, shadowRadius: 16 }}>
              <Text style={{ color: '#fff', fontSize: 38, fontWeight: '900' }}>{(userName||'R')[0].toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* ── Name card — overlaps hero ──────────────────────────── */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: R.xl, paddingHorizontal: SP.lg, paddingTop: SP.xl, paddingBottom: SP.md, marginHorizontal: SP.md, marginTop: -36, alignItems: 'center', borderWidth: 1.5, borderColor: C.glassBorder, ...SHADOW.md, marginBottom: SP.md }}>
          <Text style={{ ...T.headline, color: C.text }}>{userName || 'Rider'}</Text>
          <Text style={{ ...T.caption, color: C.textMuted, marginTop: 4 }}>+91 {phone}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ backgroundColor: C.yellowGlass, borderRadius: R.sm, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1.5, borderColor: C.yellowBorder, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 13 }}>⭐</Text>
              <Text style={{ ...T.caption, color: C.yellow }}>{ratingVal} Rating</Text>
            </View>
            {rideCount > 0 && (
              <View style={{ backgroundColor: C.pinkGlass, borderRadius: R.sm, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1.5, borderColor: C.pinkBorder, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={{ fontSize: 13 }}>🛺</Text>
                <Text style={{ ...T.caption, color: C.pink }}>{rideCount} rides</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: SP.md }}>
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
          { label: 'Refer & Earn',       sub: 'Invite friends, earn ₹50 each',    icon: 'gift',          onPress: () => { loadReferral(); setScreen('referral'); }, iconColor: C.pink },
          { label: 'Cashback Rewards',   sub: 'Earn cashback on every ride',      icon: 'cash',          onPress: () => setScreen('rewards'),                     iconColor: C.green, iconBg: C.greenGlass, iconBorder: C.greenBorder },
          { label: 'Ride Budget',        sub: 'Track your monthly spend',         icon: 'bar-chart',     onPress: () => setScreen('budget'),                       iconColor: C.purple, iconBg: C.purpleGlass, iconBorder: C.purpleBorder },
          { label: 'Saved Places',       sub: 'Save Home, Office & more',         icon: 'bookmark',      onPress: () => { loadSaved(); setScreen('saved'); },      iconColor: C.yellow },
          { label: 'Cancellation Policy',sub: 'Cancel rules and fees',            icon: 'receipt',       onPress: () => setScreen('policy'),                       iconColor: C.pink },
          { label: 'Promo Codes',        sub: 'Apply discount codes',             icon: 'pricetag',      onPress: () => { setPromoScreenCode(''); setPromoScreenMsg(''); setScreen('promo'); }, iconColor: C.yellow },
          { label: 'Notifications',      sub: 'Alerts — Enabled ✓',              icon: 'notifications', onPress: () => Alert.alert('🔔 Notifications', 'All ride notifications, wallet alerts and offers are automatically enabled.'), iconColor: C.pink },
          { label: 'Safety',             sub: 'Emergency contacts & SOS',         icon: 'shield',        onPress: () => setScreen('safety'),                       iconColor: C.red },
          { label: 'My Complaints',      sub: 'File & track ride complaints',     icon: 'alert-circle',  onPress: async () => { setCmpLoading(true); try { const r = await apiGet(`/api/complaints?phone=${encodeURIComponent(phone)}`); setComplaints(r.complaints||[]); } catch {} setCmpLoading(false); setScreen('complaints'); }, iconColor: C.red, iconBg: C.redGlass, iconBorder: C.redBorder },
          { label: 'Support',            sub: '24/7 help',                        icon: 'call',          onPress: () => setScreen('support'),                      iconColor: C.green },
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
        </View>
      </ScrollView>
      <View style={s.navFloat}><NavBar /></View>
    </View>
  );
}

// ── Post-ride rating modal — appears on home after 3s auto-redirect ──────────
function RatingModal() {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const {
    showRatingModal, setShowRatingModal,
    rideData, setRideData,
    rating, setRating,
    review, setReview,
    tip, setTip,
    starAnims, animateStar,
    pickup, drop,
    setPickup, setDrop, setEta,
    setPromoDiscount, setPromoCode,
    setDriverLoc, setDriverEta, setDriverDist,
    setUnreadChat, setCashbackEarned,
    setScratchCard, setScratched,
    favouriteBuddy, addFavouriteBuddy,
    setCmpType, setCmpDesc, setScreen,
    phone, loadHistory, loadWallet,
  } = useApp();
  const { useRideStore } = require('../../store');
  const ride = useRideStore();

  const localStarAnims = useRef([0,1,2,3,4].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (showRatingModal) {
      setRating(0);
      Animated.stagger(120, localStarAnims.map(a =>
        Animated.spring(a, { toValue: 1, friction: 5, tension: 190, useNativeDriver: true })
      )).start();
    }
  }, [showRatingModal]);

  if (!showRatingModal) return null;

  const fareNum = Math.round(parseFloat(String(rideData?.fare ?? 0).replace(/[^0-9.]/g, '')) || 0);

  const dismiss = async (submitRating = false) => {
    if (submitRating && rating > 0 && rideData?.ride_id) {
      try {
        await fetch(`${API}/api/rides/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ride_id: rideData.ride_id, rating, review, tip }),
        });
      } catch (_e) {}
    }
    setShowRatingModal(false);
    setRideData(null);
    setRating(0); setReview(''); setTip(0);
    setPickup(''); setDrop(''); setEta('');
    setPromoDiscount(0); setPromoCode(''); setUnreadChat(0);
    setDriverLoc(null); setDriverEta(''); setDriverDist('');
    setCashbackEarned([]);
    ride.clearRide();
    loadHistory(phone); loadWallet(phone);
  };

  return (
    <Modal visible={showRatingModal} transparent animationType="slide" onRequestClose={() => dismiss(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 14 + bottomInset, maxHeight: '90%' }}>

          {/* Handle */}
          <View style={{ width: 40, height: 4, backgroundColor: C.glassBorder, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 }} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>

            {/* Trip preview — fluid gradient header */}
            <FluidGradient
              palette={GRADIENT.pinkGold}
              style={{ borderRadius: 18, marginBottom: 20 }}
            >
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: fareNum > 0 || pickup ? 10 : 0 }}>
                  {rideData?.driver?.photo ? (
                    <Image source={{ uri: rideData.driver.photo }} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' }} contentFit="cover" />
                  ) : (
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' }}>
                      <Text style={{ fontSize: 24 }}>👤</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>
                      {rideData?.driver?.name || 'Your Driver'}
                    </Text>
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.70)', marginTop: 2 }}>Trip completed ✓</Text>
                  </View>
                  {fareNum > 0 && (
                    <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFD580' }}>₹{fareNum}</Text>
                  )}
                </View>
                {(pickup || drop) ? (
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)', lineHeight: 16 }} numberOfLines={2}>
                    📍 {pickup}  →  🏁 {drop}
                  </Text>
                ) : null}
              </View>
            </FluidGradient>

            {/* Rate driver */}
            <Text style={{ fontSize: 17, fontWeight: '900', color: C.text, textAlign: 'center', marginBottom: 14 }}>
              How was your ride?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 14, gap: 4 }}>
              {[1,2,3,4,5].map(star => (
                <Animated.View key={star} style={{ opacity: localStarAnims[star-1], transform: [{ scale: localStarAnims[star-1].interpolate({ inputRange: [0, 0.6, 0.85, 1], outputRange: [0, 1.35, 0.88, 1] }) }] }}>
                  <TouchableOpacity onPress={() => { setRating(star); animateStar(star - 1); }} style={{ padding: 4 }}>
                    <Animated.Text style={{ fontSize: 40, color: star <= rating ? C.yellow : C.glassBorder, transform: [{ scale: starAnims[star - 1] }], textShadowColor: star <= rating ? C.yellow : 'transparent', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } }}>★</Animated.Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>

            <TextInput
              style={[s.input, { height: 68, textAlignVertical: 'top', backgroundColor: C.glassMid, color: C.text, borderColor: C.glassBorder, marginBottom: 14 }]}
              placeholder="Comment (optional)..." placeholderTextColor={C.textDim}
              multiline value={review} onChangeText={setReview} />

            {/* Sppero Buddy */}
            {rideData?.driver?.phone && (() => {
              const alreadyBuddy = favouriteBuddy?.driver_phone === rideData.driver.phone;
              return (
                <TouchableOpacity
                  onPress={async () => { if (!alreadyBuddy) { await addFavouriteBuddy(rideData.driver.phone); } }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: alreadyBuddy ? C.greenGlass : C.yellowGlass, borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1.5, borderColor: alreadyBuddy ? C.greenBorder : C.yellowBorder }}>
                  <Text style={{ fontSize: 18, marginRight: 8 }}>{alreadyBuddy ? '✅' : '⭐'}</Text>
                  <View>
                    <Text style={{ fontWeight: '800', fontSize: 13, color: alreadyBuddy ? C.green : C.yellow }}>
                      {alreadyBuddy ? 'This is your Sppero Buddy!' : `Make ${rideData.driver.name} your Sppero Buddy`}
                    </Text>
                    {!alreadyBuddy && <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Book them directly next time</Text>}
                  </View>
                </TouchableOpacity>
              );
            })()}

            {/* Tip */}
            <Text style={{ ...T.bodyBold, color: C.textMuted, marginBottom: 10 }}>💰 Add a tip (optional)</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {[0, 10, 20, 50].map(t => (
                <Bouncy key={t}
                  style={{ flex: 1, paddingVertical: 11, borderRadius: R.sm, borderWidth: 1.5, alignItems: 'center',
                    backgroundColor: tip === t ? C.pinkGlass : C.glassMid,
                    borderColor: tip === t ? C.pinkBorder : C.glassBorder }}
                  onPress={() => setTip(t)}>
                  <Text style={{ ...T.bodyBold, color: tip === t ? C.pink : C.textMuted }}>{t === 0 ? 'Skip' : '₹' + t}</Text>
                </Bouncy>
              ))}
            </View>

            {/* Complaint */}
            <TouchableOpacity onPress={() => { dismiss(false); setCmpType(''); setCmpDesc(''); setScreen('complaint-new'); }}
              style={{ backgroundColor: C.redGlass, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.redBorder, marginBottom: 14 }}>
              <Text style={{ fontSize: 16 }}>⚠️</Text>
              <Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>Ride Issue? File a Complaint</Text>
            </TouchableOpacity>

            {/* Submit */}
            <Bouncy style={[s.btn, { marginBottom: 4 }]} onPress={() => dismiss(true)}>
              <Text style={s.btnTxt}>{rating > 0 ? `Submit ${rating}★ Rating` : 'Skip Rating'}</Text>
            </Bouncy>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function HomeScreen() {
  const { tab } = useApp();
  return (
    <>
      {tab === 'live'    ? <LiveTab />    :
       tab === 'history' ? <HistoryTab /> :
       tab === 'profile' ? <ProfileTab /> :
       <HomeTab />}
      <RatingModal />
    </>
  );
}
