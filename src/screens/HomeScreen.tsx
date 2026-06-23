import { ScrollView, View, Text, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { apiPost } from '../../api';
import { useRideStore } from '../../store';
import { useApp } from '../context/AppContext';
import { Bouncy, PulseView, CityMapView, MapOverlay, SlideUp, CountUp, EmptyAnim } from '../components/ui';
import { s } from '../styles';
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
        const col = active ? '#e94560' : '#bbb';
        return (
          <TouchableOpacity key={t} style={s.navItem} onPress={() => { setScreen('home'); setTab(t as any); if (t === 'history') loadHistory(phone); }} activeOpacity={0.65}>
            <View style={{ position: 'relative', alignItems: 'center' }}>
              <Ionicons name={(active ? ion : `${ion}-outline`) as any} size={24} color={col} />
              {t === 'live' && hasLive && !active && (
                <View style={{ position: 'absolute', top: -2, right: -6, width: 9, height: 9, borderRadius: 5, backgroundColor: '#e94560', borderWidth: 1.5, borderColor: '#fff' }} />
              )}
            </View>
            <Text style={[s.navLbl, active && s.navActive]}>{lbl}</Text>
            {active && <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: '#e94560', marginTop: 4 }} />}
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
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 6, paddingHorizontal: 20, paddingBottom: 30, maxHeight: '88%', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, elevation: 24 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 14 }} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#e94560', alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' }}>
                {favouriteBuddy.face_photo
                  ? <Image source={{ uri: favouriteBuddy.face_photo }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                  : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>{(favouriteBuddy.driver_name || 'D')[0].toUpperCase()}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, marginRight: 3 }}>⭐</Text>
                  <Text style={{ fontWeight: '800', fontSize: 16, color: '#1a1a2e' }}>{favouriteBuddy.driver_name}</Text>
                </View>
                <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                  {rideIcon(favouriteBuddy.vehicle_type)} {(favouriteBuddy.vehicle_type || '').replace('_', ' ').toUpperCase()}
                  {favouriteBuddy.rating ? ` · ★ ${parseFloat(favouriteBuddy.rating).toFixed(1)}` : ''}
                </Text>
                <Text style={{ fontSize: 11, marginTop: 2 }}>
                  {favouriteBuddy.is_online
                    ? <Text style={{ color: '#2e7d32', fontWeight: '700' }}>🟢 Online — request bhej sakte ho</Text>
                    : <Text style={{ color: '#c62828', fontWeight: '700' }}>⛔ Offline — abhi unavailable</Text>}
                </Text>
              </View>
              {!buddyWaiting && (
                <TouchableOpacity onPress={closeModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={{ fontSize: 22, color: '#bbb' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {isOffline && !buddyWaiting && (
              <View style={{ backgroundColor: '#ffebee', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1.5, borderColor: '#ef9a9a', flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 20, marginRight: 10 }}>⛔</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#b71c1c', fontSize: 13, fontWeight: '800' }}>{favouriteBuddy.driver_name} abhi offline hai</Text>
                  <Text style={{ color: '#c62828', fontSize: 11, marginTop: 2 }}>Request nahi bhejI jayegi. Baad mein try karo ya kisi aur driver se book karo.</Text>
                </View>
              </View>
            )}

            {buddyWaiting ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>⏳</Text>
                <Text style={{ fontWeight: '800', fontSize: 17, color: '#1a1a2e', textAlign: 'center' }}>Request Bheji Gayi!</Text>
                <Text style={{ color: '#666', fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
                  {favouriteBuddy.driver_name} ke accept karne ka intezaar kar rahe hain...{'\n'}25 seconds ka time diya gaya hai.
                </Text>
                {buddyBookMsg.startsWith('⚠️') || buddyBookMsg.startsWith('⛔') ? (
                  <>
                    <View style={{ backgroundColor: '#fff3e0', borderRadius: 12, padding: 12, marginTop: 14, borderWidth: 1, borderColor: '#ffb74d', width: '100%' }}>
                      <Text style={{ color: '#e65100', fontSize: 13, textAlign: 'center', fontWeight: '700' }}>{buddyBookMsg}</Text>
                    </View>
                    <TouchableOpacity onPress={goToMatching} style={{ marginTop: 14, backgroundColor: '#1a1a2e', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, width: '100%', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Kisi bhi driver se book karo →</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity onPress={goToMatching} style={{ marginTop: 14, backgroundColor: '#e94560', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, width: '100%', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Live Track Karo →</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                <Text style={{ fontWeight: '700', fontSize: 13, color: '#1a1a2e', marginBottom: 6 }}>📍 Pickup Location</Text>
                <TouchableOpacity onPress={useMyLoc}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#e3f2fd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8, borderWidth: 1, borderColor: '#90caf9' }}>
                  <Text style={{ fontSize: 15, marginRight: 8 }}>🎯</Text>
                  <Text style={{ color: '#1565c0', fontSize: 13, fontWeight: '700' }}>Meri current location use karo</Text>
                </TouchableOpacity>
                <TextInput
                  style={{ borderWidth: 1.5, borderColor: buddyBookPU ? '#4CAF50' : '#e0e0e0', borderRadius: 12, padding: 12, fontSize: 14, color: '#1a1a2e', backgroundColor: '#fafafa' }}
                  placeholder="Pickup location likhao ya search karo..."
                  placeholderTextColor="#bbb"
                  value={buddyBookPU}
                  onChangeText={(t) => { setBuddyBookPU(t); searchBuddyPlaces(t, 'pickup'); }}
                  returnKeyType="next"
                />
                {buddyPUSugg.length > 0 && (
                  <View style={{ backgroundColor: '#fff', borderRadius: 12, marginTop: 4, marginBottom: 4, borderWidth: 1, borderColor: '#e8e8e8', elevation: 8 }}>
                    {buddyPUSugg.slice(0, 5).map((sg: any, i: number) => (
                      <TouchableOpacity key={i}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: i < Math.min(buddyPUSugg.length, 5) - 1 ? 1 : 0, borderBottomColor: '#f5f5f5' }}
                        onPress={() => { setBuddyBookPU(sg.text); setBuddyPUSugg([]); geocodeBuddyPlace(sg.text, 'pickup'); }}>
                        <Text style={{ fontSize: 14, marginRight: 10 }}>📍</Text>
                        <Text style={{ fontSize: 13, color: '#1a1a2e', flex: 1, fontWeight: '500' }} numberOfLines={2}>{sg.text}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={{ fontWeight: '700', fontSize: 13, color: '#1a1a2e', marginBottom: 6, marginTop: 12 }}>🎯 Drop Location</Text>
                <TextInput
                  style={{ borderWidth: 1.5, borderColor: buddyBookDR ? '#e94560' : '#e0e0e0', borderRadius: 12, padding: 12, fontSize: 14, color: '#1a1a2e', backgroundColor: '#fafafa' }}
                  placeholder="Drop location likhao ya search karo..."
                  placeholderTextColor="#bbb"
                  value={buddyBookDR}
                  onChangeText={(t) => { setBuddyBookDR(t); searchBuddyPlaces(t, 'drop'); }}
                  returnKeyType="done"
                />
                {buddyDRSugg.length > 0 && (
                  <View style={{ backgroundColor: '#fff', borderRadius: 12, marginTop: 4, marginBottom: 4, borderWidth: 1, borderColor: '#e8e8e8', elevation: 8 }}>
                    {buddyDRSugg.slice(0, 5).map((sg: any, i: number) => (
                      <TouchableOpacity key={i}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: i < Math.min(buddyDRSugg.length, 5) - 1 ? 1 : 0, borderBottomColor: '#f5f5f5' }}
                        onPress={() => { setBuddyBookDR(sg.text); setBuddyDRSugg([]); geocodeBuddyPlace(sg.text, 'drop'); }}>
                        <Text style={{ fontSize: 14, marginRight: 10 }}>🎯</Text>
                        <Text style={{ fontSize: 13, color: '#1a1a2e', flex: 1, fontWeight: '500' }} numberOfLines={2}>{sg.text}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {!!buddyBookMsg && (
                  <View style={{ borderRadius: 10, padding: 10, marginTop: 10,
                    backgroundColor: buddyBookMsg.startsWith('✅') ? '#e8f5e9' : buddyBookMsg.startsWith('📍') ? '#e3f2fd' : '#ffebee',
                    borderWidth: 1, borderColor: buddyBookMsg.startsWith('✅') ? '#a5d6a7' : buddyBookMsg.startsWith('📍') ? '#90caf9' : '#ef9a9a' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', textAlign: 'center',
                      color: buddyBookMsg.startsWith('✅') ? '#2e7d32' : buddyBookMsg.startsWith('📍') ? '#1565c0' : '#b71c1c' }}>
                      {buddyBookMsg}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={bookWithBuddy}
                  disabled={buddyBookLoading || isOffline}
                  style={{ backgroundColor: isOffline ? '#bdbdbd' : '#e94560', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 14, elevation: isOffline ? 0 : 5, shadowColor: '#e94560', shadowOpacity: isOffline ? 0 : 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
                    {buddyBookLoading ? '⏳ Request bhej rahe hain...' : isOffline ? '⛔ Driver Offline — Unavailable' : `⭐ ${favouriteBuddy.driver_name} ko Request Bhejo`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { closeModal(); setScreen('booking'); }} style={{ alignItems: 'center', marginTop: 12, paddingVertical: 6 }}>
                  <Text style={{ color: '#999', fontSize: 13 }}>Kisi bhi driver se book karo →</Text>
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
    pickup, drop, pickupCoords, dropCoords,
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
    rideIcon,
  } = useApp();

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>Namaste 👋 {userName || 'Rider'}</Text>
          <Text style={s.subTxt}>📍 Lucknow, UP</Text>
        </View>
        <TouchableOpacity style={s.avatar} onPress={() => { setTab('profile'); loadWallet(phone); }}>
          <Text style={s.avatarTxt}>{(userName || 'R')[0].toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
      <View style={s.mapFit}>
        <CityMapView height={260} />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} />
      </View>
      <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, paddingTop: 16, paddingHorizontal: 16 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
          <SlideUp delay={0}>
            <Bouncy onPress={() => setScreen('booking')} style={s.searchBox}>
              <Ionicons name="search" size={18} color="#aaa" style={{ marginRight: 10 }} />
              <Text style={s.searchPh}>Kahan jaana hai?</Text>
              <View style={{ marginLeft: 'auto', backgroundColor: '#e94560', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Book</Text>
              </View>
            </Bouncy>
          </SlideUp>

          <SlideUp delay={60}>
            <View style={s.quickRow}>
              {[
                { icon: '🏠', label: 'Home',   bg: '#e3f2fd', fn: () => setScreen('booking') },
                { icon: '💼', label: 'Office',  bg: '#f3e5f5', fn: () => setScreen('booking') },
                { icon: '🎁', label: 'Refer',   bg: '#e8f5e9', fn: () => { loadReferral(); setScreen('referral'); } },
                { icon: '📍', label: 'Saved',   bg: '#fff3e0', fn: () => { loadSaved(); setScreen('saved'); } },
              ].map(({ icon, label, bg, fn }, i) => (
                <Bouncy key={i} onPress={fn} style={[s.quickBtn, { backgroundColor: bg, borderColor: 'transparent' }]}>
                  <Text style={s.quickIcon}>{icon}</Text>
                  <Text style={[s.quickLbl, { color: '#1a1a2e', fontWeight: '600' }]}>{label}</Text>
                </Bouncy>
              ))}
            </View>
          </SlideUp>

          {favouriteBuddy && (
            <SlideUp delay={70}>
              <View style={{ backgroundColor: '#fff', borderRadius: 16, marginBottom: 10, borderWidth: 2, borderColor: '#f0a500', overflow: 'hidden', elevation: 3, shadowColor: '#f0a500', shadowOpacity: 0.15, shadowRadius: 6 }}>
                <View style={{ backgroundColor: '#fff8e1', paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16 }}>⭐</Text>
                    <Text style={{ marginLeft: 6, fontWeight: '800', fontSize: 13, color: '#b8860b' }}>Mera Sppero Buddy</Text>
                  </View>
                  <TouchableOpacity onPress={removeFavouriteBuddy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 12, color: '#bbb', fontWeight: '700' }}>✕ Remove</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#e94560', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    {favouriteBuddy.face_photo
                      ? <Image source={{ uri: favouriteBuddy.face_photo }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                      : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20 }}>{(favouriteBuddy.driver_name || 'D')[0].toUpperCase()}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', fontSize: 16, color: '#1a1a2e' }}>{favouriteBuddy.driver_name}</Text>
                    <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                      {rideIcon(favouriteBuddy.vehicle_type)} {(favouriteBuddy.vehicle_type || '').replace('_', ' ').toUpperCase()}
                      {favouriteBuddy.vehicle_no ? ` · ${favouriteBuddy.vehicle_no}` : ''}
                      {favouriteBuddy.rating ? ` · ★ ${parseFloat(favouriteBuddy.rating).toFixed(1)}` : ''}
                    </Text>
                    <Text style={{ color: '#4CAF50', fontSize: 11, marginTop: 3, fontWeight: '600' }}>
                      ✅ {favouriteBuddy.rides_together || 0} rides saath kiye
                      {favouriteBuddy.is_online ? ' · 🟢 Online' : ' · ⚫ Offline'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => { setBuddyBookMsg(''); setBuddyWaiting(false); setShowBuddyBook(true); }}
                    style={{ backgroundColor: '#1a1a2e', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 18 }}>🚗</Text>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 2 }}>Book</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </SlideUp>
          )}

          {activeOffers.filter(o => !offerDismissed.has(o.id)).map((offer: any) => (
            <SlideUp key={offer.id} delay={80}>
              <View style={{ borderRadius: 14, marginBottom: 10, backgroundColor: offer.type === 'promo' ? '#fff3e0' : offer.type === 'incentive' ? '#e8f5e9' : '#e8eaf6', borderWidth: 1.5, borderColor: offer.type === 'promo' ? '#e65100' : offer.type === 'incentive' ? '#2e7d32' : '#5c6bc0', overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{offer.type === 'promo' ? '🎫' : offer.type === 'incentive' ? '💰' : '📢'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', fontSize: 14, color: '#1a1a2e' }}>{offer.title}</Text>
                    {offer.body ? <Text style={{ fontSize: 12, color: '#555', marginTop: 3 }}>{offer.body}</Text> : null}
                    {offer.promo_code ? (
                      <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ backgroundColor: '#e94560', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 }}>
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>{offer.promo_code}</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#666' }}>Booking mein apply karo</Text>
                      </View>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={() => setOfferDismissed(prev => new Set([...prev, offer.id]))} style={{ padding: 6 }}>
                    <Text style={{ fontSize: 16, color: '#aaa' }}>✕</Text>
                  </TouchableOpacity>
                </View>
                {offer.cta_label ? (
                  <TouchableOpacity onPress={() => setScreen('booking')} style={{ backgroundColor: '#e94560', padding: 10, alignItems: 'center' }}>
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
                <Text style={{ color: '#e94560', marginLeft: 8, fontWeight: 'bold', fontSize: 12 }}>→</Text>
              </View>
            </TouchableOpacity>
          </SlideUp>

          {rideData?.ride_id && (
            <SlideUp delay={125}>
              <TouchableOpacity onPress={() => setScreen('matching')} style={{ backgroundColor: '#1565C0', borderRadius: 14, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 5, shadowColor: '#1565C0', shadowOpacity: 0.35, shadowRadius: 8 }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 22 }}>🚗</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Active Ride In Progress!</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>{drop ? `→ ${drop}` : 'Tap karo ride screen pe jao'}</Text>
                </View>
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: '300' }}>›</Text>
              </TouchableOpacity>
            </SlideUp>
          )}

          {hourlyBooking && ['pending','matched','active'].includes(hourlyBooking.status) && (
            <SlideUp delay={130}>
              <TouchableOpacity onPress={() => setScreen('hourly')} style={{ backgroundColor: '#e94560', borderRadius: 14, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 4 }}>
                <Text style={{ fontSize: 22, marginRight: 10 }}>⏱️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Active Hourly Ride</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>Tap to resume your ongoing ride</Text>
                </View>
                <Text style={{ color: '#fff', fontSize: 22 }}>→</Text>
              </TouchableOpacity>
            </SlideUp>
          )}

          <SlideUp delay={150}>
            <Bouncy onPress={() => {
              if (hourlyBooking && ['pending','matched','active'].includes(hourlyBooking.status)) { setScreen('hourly'); return; }
              setHourlyStep('book'); setHPickup(''); setHDrop(''); setHPickupCoords(null); setHDropCoords(null);
              setHPickupSugg([]); setHDropSugg([]); setHRoundTrip(false); setHStayHours(1);
              setHourlyBooking(null); setScreen('hourly');
            }} style={{ borderRadius: 16, marginBottom: 14, overflow: 'hidden', elevation: 4 }}>
              <View style={{ backgroundColor: '#1a1a2e', padding: 16, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#e94560', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>NEW FEATURE</Text>
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 2 }}>⏱️ Book by Hour</Text>
                  <Text style={{ color: '#aaa', fontSize: 12 }}>2h · 4h · 6h · Full Day • KM included</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#e94560', fontSize: 24, fontWeight: 'bold' }}>₹120</Text>
                  <Text style={{ color: '#aaa', fontSize: 10 }}>Bike se shuru</Text>
                </View>
              </View>
              <View style={{ backgroundColor: '#16213e', flexDirection: 'row' }}>
                {[{e:'🛺',l:'Auto',p:'₹180'},{e:'🏍️',l:'Bike',p:'₹120'},{e:'🚕',l:'Car',p:'₹260'},{e:'🛵',l:'E-Riksha',p:'₹150'}].map((v, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRightWidth: i < 3 ? 1 : 0, borderColor: '#2a2a4e' }}>
                    <Text style={{ fontSize: 16 }}>{v.e}</Text>
                    <Text style={{ color: '#fff', fontSize: 9, marginTop: 2 }}>{v.l}</Text>
                    <Text style={{ color: '#e94560', fontSize: 10, fontWeight: 'bold' }}>{v.p}</Text>
                  </View>
                ))}
              </View>
            </Bouncy>
          </SlideUp>

          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' }} onPress={() => setScreen('hourly-info')}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>⏱️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a2e' }}>Book by Hour — Kaise Kaam Karta Hai?</Text>
              <Text style={{ fontSize: 11, color: '#999' }}>Rules, fares, packages — sab jaano</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#f0f0f0' }} onPress={() => setScreen('policy')}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a2e' }}>Cancellation Policy</Text>
              <Text style={{ fontSize: 11, color: '#999' }}>Cancel rules aur fees jaano</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
          </TouchableOpacity>

          {historyRides.length > 0 && (
            <>
              <Text style={s.secTitle}>🕐 Recent Trips</Text>
              {historyRides.slice(0, 3).map((h, i) => (
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
        </ScrollView>
      </View>
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
    requested: { label: 'Driver dhoondh rahe hain...', color: '#f57c00', icon: '🔍' },
    matched:   { label: 'Driver aa raha hai',          color: '#1565C0', icon: '🚗' },
    arrived:   { label: 'Driver pahunch gaya!',        color: '#388e3c', icon: '📍' },
    started:   { label: 'Trip chal rahi hai',          color: '#7b1fa2', icon: '🛣️' },
    completed: { label: 'Trip complete — Payment pending', color: '#e94560', icon: '✅' },
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
      <View style={s.topBar}>
        <View style={{ flex: 1 }}><Text style={s.topTitle}>🔴 Live Ride</Text></View>
        {(hasStd || hasHourly) && (
          <PulseView><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#e94560', marginRight: 4 }} /></PulseView>
        )}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {hasStd && (
          <View style={{ backgroundColor: '#fff', borderRadius: 18, elevation: 5, marginBottom: 18, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 }}>
            <View style={{ backgroundColor: si.color, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, marginRight: 10 }}>{si.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Standard Ride</Text>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 }}>{si.label}</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{rideData?.fare}</Text>
              </View>
            </View>
            <View style={{ padding: 14 }}>
              {(pickup || drop) ? (
                <View style={{ backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  {pickup ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: drop ? 8 : 0 }}><Text style={{ fontSize: 14, marginRight: 8, marginTop: 1 }}>📍</Text><Text style={{ color: '#333', fontSize: 13, flex: 1 }} numberOfLines={2}>{pickup}</Text></View> : null}
                  {drop ? <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}><Text style={{ fontSize: 14, marginRight: 8, marginTop: 1 }}>🎯</Text><Text style={{ color: '#333', fontSize: 13, flex: 1 }} numberOfLines={2}>{drop}</Text></View> : null}
                </View>
              ) : null}
              {driverInfo ? (
                <View style={{ backgroundColor: '#f0f4ff', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>{(driverInfo.name||'D')[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={{ color: '#1a1a2e', fontWeight: '700', fontSize: 14 }}>{driverInfo.name}</Text>
                      {driverInfo.verified && <View style={{ backgroundColor: '#e8f5e9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 9, color: '#2e7d32', fontWeight: '800' }}>✓ VERIFIED</Text></View>}
                    </View>
                    <Text style={{ color: '#666', fontSize: 12, marginTop: 1 }}>
                      {[driverInfo.vehicle_brand, driverInfo.vehicle_model].filter(Boolean).join(' ')}
                      {driverInfo.vehicle_no ? ` · ${driverInfo.vehicle_no}` : ''}
                    </Text>
                  </View>
                  {driverInfo?.name ? (
                    <TouchableOpacity onPress={callDriver} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="call" size={18} color="#2e7d32" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
              {(stdStatus === 'matched' || stdStatus === 'arrived') && startOtp ? (
                <View style={{ backgroundColor: '#e8f5e9', borderRadius: 12, padding: 14, marginBottom: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: '#2e7d32', fontWeight: '600', marginBottom: 4 }}>Ride Start OTP — Driver ko dikhao</Text>
                  <Text style={{ fontSize: 32, fontWeight: '800', color: '#1b5e20', letterSpacing: 8 }}>{startOtp}</Text>
                </View>
              ) : null}
              <Bouncy
                onPress={() => {
                  if (stdStatus === 'completed') setScreen('payment');
                  else if (stdStatus === 'started') setScreen('inride');
                  else setScreen('matching');
                }}
                style={{ backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {stdStatus === 'completed' ? '💳 Payment Screen' : stdStatus === 'started' ? '🛣️ Ride Screen' : '🗺️ Full Tracking Screen'} →
                </Text>
              </Bouncy>
            </View>
          </View>
        )}

        {hasHourly && (
          <View style={{ backgroundColor: '#fff', borderRadius: 18, elevation: 5, marginBottom: 18, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 }}>
            <View style={{ backgroundColor: hColor, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, marginRight: 10 }}>⏱️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                  Hourly Ride · {hourlyBooking?.package_hours}h · {vEmoji[hourlyBooking?.vehicle_type] || '🚗'}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 }}>{hStatus}</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>₹{hourlyBooking?.fare || hourlyBooking?.package_fare}</Text>
              </View>
            </View>
            <View style={{ padding: 14 }}>
              {hourlyStep === 'active' && (
                <View style={{ backgroundColor: '#f3e5f5', borderRadius: 12, padding: 14, marginBottom: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: '#7b1fa2', fontWeight: '600', marginBottom: 4 }}>Time Elapsed</Text>
                  <Text style={{ fontSize: 30, fontWeight: '800', color: '#6a1b9a', letterSpacing: 4 }}>{hTimerStr}</Text>
                  <Text style={{ fontSize: 11, color: '#9c27b0', marginTop: 4 }}>Package: {hourlyBooking?.package_hours} hours · {hourlyBooking?.km_included} km included</Text>
                </View>
              )}
              {hourlyBooking?.driver ? (
                <View style={{ backgroundColor: '#f0f4ff', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#7b1fa2', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>{(hourlyBooking.driver.name||'D')[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1a1a2e', fontWeight: '700', fontSize: 14 }}>{hourlyBooking.driver.name}</Text>
                    <Text style={{ color: '#666', fontSize: 12, marginTop: 1 }}>{[hourlyBooking.driver.vehicle_brand, hourlyBooking.driver.vehicle_model].filter(Boolean).join(' ')}</Text>
                  </View>
                  {hourlyBooking?.driver?.name ? (
                    <TouchableOpacity onPress={() => initiateCall(null, hourlyBooking.id)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#f3e5f5', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="call" size={18} color="#7b1fa2" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <View style={{ backgroundColor: '#fff8e1', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, marginRight: 10 }}>🔍</Text>
                  <Text style={{ color: '#f57c00', fontSize: 13, fontWeight: '600' }}>Driver dhoondha ja raha hai...</Text>
                </View>
              )}
              <Bouncy onPress={() => setScreen('hourly')} style={{ backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>⏱️ Full Hourly Ride Screen →</Text>
              </Bouncy>
            </View>
          </View>
        )}

        {!hasStd && !hasHourly && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 56, marginBottom: 16 }}>🚗</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#1a1a2e', marginBottom: 8 }}>Koi Active Ride Nahi</Text>
            <Text style={{ fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 28, paddingHorizontal: 30 }}>Jab ride book karoge yahan live status milega — chahe app band ho jaye</Text>
            <Bouncy onPress={() => setTab('home')} style={[s.btn, { paddingHorizontal: 32 }]}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Book a Ride →</Text>
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
      <View style={s.topBar}><Text style={s.topTitle}>🕐 My Trips</Text></View>
      <ScrollView style={{ flex: 1, padding: 14 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {historyRides.length === 0
          ? <EmptyAnim icon="🚖" title="Abhi koi trip nahi" sub="Pehli ride book karo aur yahan apni history dekho!" />
          : historyRides.map((h, i) => (
            <View key={i} style={s.histCard}>
              <View style={s.row}>
                <View style={s.histIcon}><Text style={{ fontSize: 20 }}>{rideIcon(h.ride_type)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.recentRoute} numberOfLines={1}>{h.pickup} → {h.drop_location}</Text>
                  <Text style={s.recentDate}>{new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · <Text style={{ color: h.status === 'completed' ? '#4CAF50' : h.status === 'cancelled' ? '#e94560' : '#f0a500' }}>{h.status}</Text></Text>
                  {h.driver_name && <Text style={{ fontSize: 11, color: '#999', marginTop: 1 }}>Driver: {h.driver_name}</Text>}
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
                      style={{ marginTop: 5, backgroundColor: favouriteBuddy?.driver_phone === h.driver_phone ? '#e8f5e9' : '#fff8e1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: favouriteBuddy?.driver_phone === h.driver_phone ? '#4CAF50' : '#f0a500' }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: favouriteBuddy?.driver_phone === h.driver_phone ? '#2e7d32' : '#b8860b' }}>
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
      <View style={s.topBar}><Text style={s.topTitle}>👤 Profile</Text></View>
      <ScrollView style={{ flex: 1, padding: 14 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        <View style={s.profileHero}>
          <View style={s.profileAvatar}><Text style={{ color: '#fff', fontSize: 34, fontWeight: 'bold' }}>{(userName||'R')[0].toUpperCase()}</Text></View>
          <Text style={s.profileName}>{userName || 'Rider'}</Text>
          <Text style={s.profilePhone}>+91 {phone}</Text>
          <View style={s.badge}><Text style={{ color: '#fff', fontWeight: 'bold' }}>⭐ {customerRating?.rating ? parseFloat(customerRating.rating).toFixed(1) : '5.0'} Rating{customerRating?.count > 0 ? ` · ${customerRating.count} rides` : ''}</Text></View>
        </View>
        <TouchableOpacity style={s.walletCard} onPress={() => { loadWalletDetail(phone); loadLoyalty(phone); setScreen('wallet'); }}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>💰 Wallet Balance</Text>
              <CountUp to={walletBalance} prefix="₹" style={{ color: '#fff', fontSize: 30, fontWeight: 'bold', marginTop: 2 }} />
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Manage ›</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 14, gap: 8 }}>
            {[100, 200, 500].map(amt => (
              <TouchableOpacity key={amt} onPress={(e) => { e.stopPropagation?.(); openRazorpayTopup(amt); }}
                style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8, paddingVertical: 7, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+₹{amt}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); openRazorpayTopup(1000); }}
              style={{ flex: 1, backgroundColor: '#e94560', borderRadius: 8, paddingVertical: 7, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+₹1000</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        <Bouncy style={s.menuItem} onPress={() => { loadReferral(); setScreen('referral'); }}>
          <View style={s.menuIconBox}><Ionicons name="gift" size={18} color="#e94560" /></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Refer & Earn</Text><Text style={{ fontSize: 11, color: '#999' }}>Dost ko bulao, ₹50 pao</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </Bouncy>
        <Bouncy style={s.menuItem} onPress={() => setScreen('rewards')}>
          <View style={[s.menuIconBox, { backgroundColor: '#E8F5E9' }]}><Ionicons name="cash" size={18} color="#2E7D32" /></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Cashback Rewards</Text><Text style={{ fontSize: 11, color: '#999' }}>Rides pe cashback earn karo</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </Bouncy>
        <Bouncy style={s.menuItem} onPress={() => { loadSaved(); setScreen('saved'); }}>
          <View style={s.menuIconBox}><Ionicons name="bookmark" size={18} color="#e94560" /></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Saved Places</Text><Text style={{ fontSize: 11, color: '#999' }}>Home, Office save karo</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </Bouncy>
        <Bouncy style={s.menuItem} onPress={() => setScreen('policy')}>
          <View style={s.menuIconBox}><Ionicons name="receipt" size={18} color="#e94560" /></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Cancellation Policy</Text><Text style={{ fontSize: 11, color: '#999' }}>Cancel rules aur fees</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </Bouncy>
        <Bouncy style={s.menuItem} onPress={() => { setPromoScreenCode(''); setPromoScreenMsg(''); setScreen('promo'); }}>
          <View style={s.menuIconBox}><Ionicons name="pricetag" size={18} color="#e94560" /></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Promo Codes</Text><Text style={{ fontSize: 11, color: '#999' }}>Discount codes apply karo</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </Bouncy>
        <Bouncy style={s.menuItem} onPress={() => Alert.alert('🔔 Notifications', 'Aapki sabhi ride notifications, wallet alerts aur offers automatically enable hain.\n\nNew rides, driver updates aur promo alerts aapko push notification ke through milenge.')}>
          <View style={s.menuIconBox}><Ionicons name="notifications" size={18} color="#e94560" /></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Notifications</Text><Text style={{ fontSize: 11, color: '#999' }}>Alerts — Enabled ✓</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </Bouncy>
        <Bouncy style={s.menuItem} onPress={() => setScreen('safety')}>
          <View style={s.menuIconBox}><Ionicons name="shield" size={18} color="#e94560" /></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Safety</Text><Text style={{ fontSize: 11, color: '#999' }}>Emergency contacts & SOS</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </Bouncy>
        <Bouncy style={s.menuItem} onPress={() => setScreen('support')}>
          <View style={s.menuIconBox}><Ionicons name="call" size={18} color="#e94560" /></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Support</Text><Text style={{ fontSize: 11, color: '#999' }}>24x7 help</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </Bouncy>
        <Bouncy style={s.logoutBtn} onPress={async () => {
          await AsyncStorage.removeItem('userPhone'); await AsyncStorage.removeItem('userName');
          setScreen('login'); setTab('home'); setPhone(''); setOtp(''); setOtpDigits(['','','','','','']);
          setUserName(''); setGender(''); setWalletBalance(0);
        }}>
          <Text style={{ color: '#e94560', fontWeight: 'bold', fontSize: 14 }}>🚪 Logout</Text>
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
