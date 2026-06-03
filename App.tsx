import { useState, useEffect, useRef } from 'react';
import RazorpayCheckout from 'react-native-razorpay';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Switch, Animated, KeyboardAvoidingView, Platform
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';

const MAPS_KEY = 'AIzaSyAD-A9qcLSXbgrz4CI4PYLFOZ';
const API = 'https://rideapp-backend-production-5e1c.up.railway.app';

type Screen = 'login' | 'otp' | 'home' | 'booking' | 'matching' | 'inride' | 'payment' | 'postride';

// ── Pulse animation ────────────────────────────────
const PulseView = ({ children, style }: any) => {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={[style, { transform: [{ scale: anim }] }]}>{children}</Animated.View>;
};

// ── Fade-in animation ──────────────────────────────
const FadeIn = ({ children, style, delay = 0 }: any) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 400, delay, useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={[style, { opacity: anim }]}>{children}</Animated.View>;
};

// ── Radar animation ────────────────────────────────
const RadarView = () => {
  const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    rings.forEach((r, i) => {
      Animated.loop(Animated.sequence([
        Animated.delay(i * 600),
        Animated.timing(r, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])).start();
    });
  }, []);
  return (
    <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
      {rings.map((r, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', width: 120, height: 120, borderRadius: 60,
          borderWidth: 2, borderColor: '#e94560',
          opacity: r.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 0.4, 0] }),
          transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2] }) }],
        }} />
      ))}
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#e94560', alignItems: 'center', justifyContent: 'center', elevation: 6 }}>
        <Text style={{ fontSize: 28 }}>🚖</Text>
      </View>
    </View>
  );
};

// ── Google Maps WebView ────────────────────────────
const MapWebView = ({ pickup, drop, driverLat, driverLng, userLat, userLng, height = 180 }: any) => {
  let mapUrl = '';
  if (pickup && drop) {
    mapUrl = `https://www.google.com/maps/embed/v1/directions?key=${MAPS_KEY}&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(drop)}&mode=driving`;
  } else if (pickup && pickup !== 'Lucknow,India') {
    mapUrl = `https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${encodeURIComponent(pickup)}`;
  } else if (userLat && userLng) {
    mapUrl = `https://www.google.com/maps/embed/v1/view?key=${MAPS_KEY}&center=${userLat},${userLng}&zoom=15`;
  } else {
    mapUrl = `https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=Lucknow,Uttar+Pradesh,India`;
  }
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;}body{background:#dbeafe;}</style></head><body><iframe width="100%" height="${height}" frameborder="0" style="border:0" src="${mapUrl}" allowfullscreen></iframe></body></html>`;
  return <WebView source={{ html }} style={{ height, width: '100%' }} scrollEnabled={false} javaScriptEnabled />;
};

export default function App() {
  const [screen, setScreen]           = useState<Screen>('login');
  const [phone, setPhone]             = useState('');
  const [otp, setOtp]                 = useState('');
  const [otpSent, setOtpSent]         = useState('');
  const [userName, setUserName]       = useState('');
  const [pickup, setPickup]           = useState('');
  const [drop, setDrop]               = useState('');
  const [rideType, setRideType]       = useState('auto');
  const [result, setResult]           = useState('');
  const [loading, setLoading]         = useState(false);
  const [rideData, setRideData]       = useState<any>(null);
  const [rating, setRating]           = useState(0);
  const [sosActive, setSosActive]     = useState(false);
  const [tab, setTab]                 = useState('home');
  const [scheduleOn, setScheduleOn]   = useState(false);
  const [promoCode, setPromoCode]     = useState('');
  const [tip, setTip]                 = useState(0);
  const [review, setReview]           = useState('');
  const [paymentDone, setPaymentDone] = useState(false);
  const [historyRides, setHistoryRides] = useState<any[]>([]);
  const [driverLoc, setDriverLoc]     = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [showWallet, setShowWallet]   = useState(false);
  const [scratchCard, setScratchCard] = useState<any>(null);
  const [scratched, setScratched]     = useState(false);
  const [eta, setEta]                 = useState('');
  const [fareCount, setFareCount]     = useState(0);
  const [userCoords, setUserCoords]   = useState<any>(null);
  const [pickupSugg, setPickupSugg]   = useState<any[]>([]);
  const [dropSugg, setDropSugg]       = useState<any[]>([]);
  const scratchAnim = useRef(new Animated.Value(1)).current;
  const starAnims   = useRef([0,1,2,3,4].map(() => new Animated.Value(1))).current;

  // ── Auto login ────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const sp = await AsyncStorage.getItem('userPhone');
        const sn = await AsyncStorage.getItem('userName');
        if (sp) { setPhone(sp); setUserName(sn || 'Rider'); setScreen('home'); loadHistory(sp); loadWallet(sp); }
      } catch (_e) {}
    })();
  }, []);

  // ── Ride polling ──────────────────────────────
  useEffect(() => {
    if (!['matching','inride'].includes(screen) || !rideData?.ride_id) return;
    const iv = setInterval(async () => {
      try {
        const res  = await fetch(`${API}/api/rides/status/${rideData.ride_id}`);
        const data = await res.json();
        const st   = data.ride?.status;
        try {
          const lr = await fetch(`${API}/api/rides/driver-location/${rideData.ride_id}`);
          const ld = await lr.json();
          if (ld.location) setDriverLoc(ld.location);
        } catch (_e) {}
        if (st === 'matched' || st === 'arrived') {
          setRideData((p: any) => ({ ...p, startOtp: data.ride.start_otp, driver: { name: data.ride.driver_name, phone: data.ride.driver_phone, vehicle_no: data.ride.vehicle_no } }));
        }
        if (st === 'started') setScreen('inride');
        if (st === 'completed') { setScreen('payment'); loadWallet(phone); clearInterval(iv); }
      } catch (_e) {}
    }, 3000);
    return () => clearInterval(iv);
  }, [screen, rideData?.ride_id]);

  // ── Scratch card bounce ───────────────────────
  useEffect(() => {
    if (!scratchCard || scratched) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(scratchAnim, { toValue: 1.06, duration: 600, useNativeDriver: true }),
      Animated.timing(scratchAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [scratchCard, scratched]);

  // ── Fare counter ──────────────────────────────
  useEffect(() => {
    if (screen !== 'payment' || !rideData?.fare) return;
    const target = parseInt(String(rideData.fare).replace(/[^0-9]/g, '')) || 0;
    let cur = 0;
    const step = Math.ceil(target / 30);
    const t = setInterval(() => { cur = Math.min(cur + step, target); setFareCount(cur); if (cur >= target) clearInterval(t); }, 40);
    return () => clearInterval(t);
  }, [screen]);

  // ── Helpers ───────────────────────────────────
  const loadHistory = async (ph: string) => {
    try { const r = await fetch(`${API}/api/rides/history?phone=${ph}`); const d = await r.json(); setHistoryRides(d.rides || []); } catch (_e) {}
  };
  const loadWallet = async (ph: string) => {
    try { const r = await fetch(`${API}/api/wallet/balance?phone=${ph}`); const d = await r.json(); setWalletBalance(d.balance || 0); } catch (_e) {}
  };

  // ── Places autocomplete ───────────────────────
  const searchPlaces = async (text: string, type: 'pickup' | 'drop') => {
    if (text.length < 3) { type === 'pickup' ? setPickupSugg([]) : setDropSugg([]); return; }
    try {
      const res  = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${MAPS_KEY}&components=country:in&location=26.8467,80.9462&radius=50000`);
      const data = await res.json();
      const sugg = data.predictions?.map((p: any) => ({ id: p.place_id, text: p.description })) || [];
      type === 'pickup' ? setPickupSugg(sugg) : setDropSugg(sugg);
    } catch (_e) {}
  };

  // ── ETA ───────────────────────────────────────
  const fetchEta = async (origin: string, dest: string) => {
    try {
      const res  = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(dest)}&key=${MAPS_KEY}`);
      const data = await res.json();
      const el   = data.rows?.[0]?.elements?.[0];
      if (el?.status === 'OK') { setEta(el.duration.text + ' · ' + el.distance.text); return el.distance.value / 1000; }
    } catch (_e) {}
    return 5;
  };

  // ── Scratch card ──────────────────────────────
  const createScratchCard = async () => {
    try {
      const res  = await fetch(`${API}/api/scratch-card/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone || '9999999999', ride_id: rideData?.ride_id }) });
      const data = await res.json();
      if (data.success) { setScratchCard(data); setScratched(false); }
    } catch (_e) {}
  };

  const scratchNow = async () => {
    if (!scratchCard || scratched) return;
    scratchAnim.stopAnimation(); setScratched(true);
    try { await fetch(`${API}/api/scratch-card/scratch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ card_id: scratchCard.card_id, phone: phone || '9999999999' }) }); loadWallet(phone); } catch (_e) {}
  };

  // ── Wallet ────────────────────────────────────
  const addMoney = async (amt: number) => {
    try {
      const res  = await fetch(`${API}/api/wallet/add`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone || '9999999999', amount: amt }) });
      const data = await res.json();
      if (data.success) { setWalletBalance(data.balance); setResult(`✅ ₹${amt} add ho gaya!`); }
    } catch (_e) { setResult('❌ Error'); }
  };

  const payWithWallet = async () => {
    const fareNum = parseInt(String(rideData?.fare).replace(/[^0-9]/g, '')) || 0;
    if (walletBalance < fareNum) { setResult(`❌ Balance kam hai! ₹${walletBalance} hai`); return; }
    try {
      const res  = await fetch(`${API}/api/wallet/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone || '9999999999', amount: fareNum, ride_id: rideData.ride_id }) });
      const data = await res.json();
      if (data.success) { setWalletBalance(data.balance); setPaymentDone(true); setScreen('postride'); createScratchCard(); }
      else setResult('❌ ' + (data.message || 'Payment fail'));
    } catch (_e) { setResult('❌ Server error'); }
  };

  const handlePayment = async () => {
    try {
      const fareNum  = parseInt(String(rideData?.fare).replace(/[^0-9]/g, '')) || 0;
      const orderRes = await fetch(`${API}/api/payment/create-order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: fareNum, ride_id: rideData.ride_id }) });
      const order    = await orderRes.json();
      if (!order.success) { setResult('❌ Order error'); return; }
      RazorpayCheckout.open({ description: 'RideApp Trip', currency: 'INR', key: order.key_id, amount: order.amount, order_id: order.order_id, name: 'RideApp', prefill: { contact: phone, name: userName || 'User' }, theme: { color: '#e94560' } })
        .then(async (data: any) => {
          await fetch(`${API}/api/payment/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, payment_id: data.razorpay_payment_id, amount: fareNum, method: 'online' }) });
          setPaymentDone(true); setScreen('postride'); createScratchCard();
        }).catch((_e: any) => setResult('❌ Payment cancel ya fail hua'));
    } catch (e: any) { setResult('❌ ' + (e?.message || 'Payment error')); }
  };

  // ── Location ──────────────────────────────────
  const useMyLocation = async () => {
    setResult('📍 Location le rahe hain...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setResult('❌ Location permission do'); return; }
      const loc = await Location.getCurrentPositionAsync({});
      setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo[0]) { const a = geo[0]; setPickup([a.name, a.street, a.city].filter(Boolean).join(', ')); setResult('✅ Location mil gayi!'); }
    } catch (_e) { setResult('❌ Location error'); }
  };

  // ── Book ride ─────────────────────────────────
  const bookRide = async () => {
    if (!pickup || !drop) { setResult('❌ Pickup aur Drop likho!'); return; }
    setLoading(true); setPaymentDone(false);
    try {
      const distanceKm = await fetchEta(pickup, drop);
      const res  = await fetch(`${API}/api/rides/book`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passenger_phone: phone || '9999999999', pickup, drop_location: drop, ride_type: rideType, distance: distanceKm }) });
      const data = await res.json();
      setRideData(data); setScreen('matching'); setResult('');
    } catch { setResult('❌ Server connect nahi hua!'); }
    setLoading(false);
  };

  // ── OTP ───────────────────────────────────────
  const sendOtp = async () => {
    if (!phone || phone.length < 10) { setResult('❌ Sahi phone number likho'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/auth/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      const data = await res.json();
      setOtpSent(data.otp || ''); setScreen('otp'); setResult('');
    } catch { setResult('❌ Server connect nahi hua'); }
    setLoading(false);
  };

  const verifyOtp = async () => {
    if (!otp) { setResult('❌ OTP likho'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, otp, name: userName || 'Rider' }) });
      const data = await res.json();
      if (data.token) { await AsyncStorage.setItem('userPhone', phone); await AsyncStorage.setItem('userName', userName || 'Rider'); setScreen('home'); setResult(''); loadHistory(phone); loadWallet(phone); }
      else setResult('❌ ' + (data.error || 'OTP galat hai'));
    } catch { setResult('❌ Server connect nahi hua'); }
    setLoading(false);
  };

  const animateStar = (i: number) => {
    Animated.sequence([
      Animated.timing(starAnims[i], { toValue: 1.5, duration: 120, useNativeDriver: true }),
      Animated.timing(starAnims[i], { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const rideIcon = (type: string) => type === 'auto' ? '🛺' : (type === 'bike' || type === 'moto') ? '🏍️' : '🚕';

  const RIDES = [
    { id: 'auto', icon: '🛺', label: 'Auto', base: 25, eta: '3 min' },
    { id: 'moto', icon: '🏍️', label: 'Moto', base: 20, eta: '2 min' },
    { id: 'economy', icon: '🚕', label: 'Economy', base: 40, eta: '5 min' },
    { id: 'premium', icon: '🚗', label: 'Premium', base: 80, eta: '7 min' },
    { id: 'xl', icon: '🚙', label: 'XL', base: 90, eta: '8 min' },
    { id: 'ev', icon: '⚡', label: 'EV', base: 35, eta: '6 min' },
  ];

  // ══════════════════════════════════════════════
  //  LOGIN
  // ══════════════════════════════════════════════
  if (screen === 'login') return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={s.hero}>
          <Text style={s.heroIcon}>🚖</Text>
          <Text style={s.heroTitle}>RideApp</Text>
          <Text style={s.heroSub}>Lucknow ka sabse fast ride</Text>
        </View>
        <View style={s.card}>
          <Text style={s.label}>Aapka naam</Text>
          <TextInput style={s.input} placeholder="Naam likho..." value={userName} onChangeText={setUserName} />
          <Text style={s.label}>Phone number</Text>
          <View style={s.row}>
            <Text style={s.flag}>🇮🇳 +91</Text>
            <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="10 digit number" keyboardType="numeric" value={phone} onChangeText={setPhone} maxLength={10} />
          </View>
          {result ? <Text style={s.err}>{result}</Text> : null}
          <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={sendOtp} disabled={loading}>
            <Text style={s.btnTxt}>{loading ? '⏳ Bhej raha hai...' : 'OTP Bhejo 📱'}</Text>
          </TouchableOpacity>
          <Text style={s.terms}>Continue karke aap Terms & Privacy se agree karte hain</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ══════════════════════════════════════════════
  //  OTP
  // ══════════════════════════════════════════════
  if (screen === 'otp') return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={s.hero}>
          <Text style={s.heroIcon}>🔐</Text>
          <Text style={s.heroTitle}>OTP Verify</Text>
          <Text style={s.heroSub}>+91 {phone} pe bheja gaya</Text>
        </View>
        <View style={s.card}>
          <Text style={s.label}>6-digit OTP</Text>
          <TextInput style={[s.input, s.otpInput]} placeholder="------" keyboardType="numeric" value={otp} onChangeText={setOtp} maxLength={6} />
          {otpSent ? <Text style={s.hint}>💡 Test OTP: {otpSent}</Text> : null}
          {result ? <Text style={s.err}>{result}</Text> : null}
          <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={verifyOtp} disabled={loading}>
            <Text style={s.btnTxt}>{loading ? '⏳ Verify ho raha hai...' : 'Verify Karo ✅'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('login')}><Text style={s.back}>← Wapas jao</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ══════════════════════════════════════════════
  //  HOME
  // ══════════════════════════════════════════════
  if (screen === 'home' && tab === 'home') return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <View>
          <Text style={s.greeting}>Namaste 👋 {userName || 'Rider'}</Text>
          <Text style={s.subTxt}>📍 Lucknow, UP</Text>
        </View>
        <TouchableOpacity style={s.avatar} onPress={() => { setTab('profile'); loadWallet(phone); }}>
          <Text style={s.avatarTxt}>{(userName || 'R')[0].toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
      <MapWebView pickup={pickup || 'Lucknow,India'} drop="" userLat={userCoords?.latitude} userLng={userCoords?.longitude} height={160} />
      <ScrollView style={{ flex: 1, padding: 14 }} showsVerticalScrollIndicator={false}>
        <FadeIn>
          <TouchableOpacity style={s.searchBox} onPress={() => setScreen('booking')}>
            <Text style={s.searchIcon}>🔍</Text>
            <Text style={s.searchPh}>Kahan jaana hai?</Text>
          </TouchableOpacity>
        </FadeIn>
        <FadeIn delay={80}>
          <View style={s.quickRow}>
            {[['🏠','Home'],['💼','Office'],['🚉','Station'],['✈️','Airport']].map(([icon,label],i) => (
              <TouchableOpacity key={i} style={s.quickBtn} onPress={() => setScreen('booking')}>
                <Text style={s.quickIcon}>{icon}</Text>
                <Text style={s.quickLbl}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </FadeIn>
        <FadeIn delay={160}>
          <View style={s.promoBanner}>
            <Text style={s.promoTxt}>🎉 Pehli ride pe 50% off! Code: RIDE50</Text>
          </View>
        </FadeIn>
        <Text style={s.secTitle}>🕐 Recent Trips</Text>
        {historyRides.length === 0
          ? <Text style={{ color: '#999', fontSize: 13, marginBottom: 12 }}>Abhi koi trip nahi — pehli ride book karo!</Text>
          : historyRides.slice(0, 3).map((h, i) => (
            <FadeIn key={i} delay={i * 80}>
              <TouchableOpacity style={s.recentItem} onPress={() => { setPickup(h.pickup); setDrop(h.drop_location); setScreen('booking'); }}>
                <Text style={{ fontSize: 24, marginRight: 10 }}>{rideIcon(h.ride_type)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.recentRoute} numberOfLines={1}>{h.pickup} → {h.drop_location}</Text>
                  <Text style={s.recentDate}>{new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                </View>
                <Text style={s.recentFare}>₹{h.fare}</Text>
              </TouchableOpacity>
            </FadeIn>
          ))
        }
      </ScrollView>
      <View style={s.nav}>
        {[['home','🏠','Home'],['history','🕐','Trips'],['profile','👤','Profile']].map(([t,icon,lbl]) => (
          <TouchableOpacity key={t} style={s.navItem} onPress={() => setTab(t)}>
            <Text style={s.navIcon}>{icon}</Text>
            <Text style={[s.navLbl, tab===t && s.navActive]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ══════════════════════════════════════════════
  //  HISTORY
  // ══════════════════════════════════════════════
  if (screen === 'home' && tab === 'history') return (
    <View style={s.screen}>
      <View style={s.topBar}><Text style={s.topTitle}>🕐 My Trips</Text></View>
      <ScrollView style={{ flex: 1, padding: 14 }} showsVerticalScrollIndicator={false}>
        {historyRides.length === 0
          ? <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 56 }}>🚗</Text>
              <Text style={{ fontSize: 17, color: '#333', marginTop: 14, fontWeight: '600' }}>Abhi koi trip nahi</Text>
              <Text style={{ fontSize: 13, color: '#999', marginTop: 6 }}>Pehli ride book karo!</Text>
            </View>
          : historyRides.map((h, i) => (
            <FadeIn key={i} delay={i * 60}>
              <View style={s.histCard}>
                <View style={s.row}>
                  <View style={s.histIcon}><Text style={{ fontSize: 20 }}>{rideIcon(h.ride_type)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.recentRoute} numberOfLines={1}>{h.pickup} → {h.drop_location}</Text>
                    <Text style={s.recentDate}>
                      {new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {' · '}<Text style={{ color: h.status === 'completed' ? '#4CAF50' : h.status === 'cancelled' ? '#e94560' : '#f0a500' }}>{h.status}</Text>
                    </Text>
                  </View>
                  <Text style={s.recentFare}>₹{h.fare}</Text>
                </View>
              </View>
            </FadeIn>
          ))
        }
      </ScrollView>
      <View style={s.nav}>
        {[['home','🏠','Home'],['history','🕐','Trips'],['profile','👤','Profile']].map(([t,icon,lbl]) => (
          <TouchableOpacity key={t} style={s.navItem} onPress={() => { setTab(t); if(t==='history') loadHistory(phone); }}>
            <Text style={s.navIcon}>{icon}</Text>
            <Text style={[s.navLbl, tab===t && s.navActive]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ══════════════════════════════════════════════
  //  PROFILE
  // ══════════════════════════════════════════════
  if (screen === 'home' && tab === 'profile') return (
    <View style={s.screen}>
      <View style={s.topBar}><Text style={s.topTitle}>👤 Profile</Text></View>
      <ScrollView style={{ flex: 1, padding: 14 }} showsVerticalScrollIndicator={false}>
        <FadeIn>
          <View style={s.profileHero}>
            <View style={s.profileAvatar}><Text style={{ color: '#fff', fontSize: 34, fontWeight: 'bold' }}>{(userName||'R')[0].toUpperCase()}</Text></View>
            <Text style={s.profileName}>{userName || 'Rider'}</Text>
            <Text style={s.profilePhone}>+91 {phone}</Text>
            <View style={s.badge}><Text style={{ color: '#fff', fontWeight: 'bold' }}>⭐ 4.9 Rating</Text></View>
          </View>
        </FadeIn>
        <TouchableOpacity style={s.walletCard} onPress={() => { setShowWallet(!showWallet); loadWallet(phone); }}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>💰 Wallet Balance</Text>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: 'bold', marginTop: 2 }}>₹{walletBalance}</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{showWallet ? '✕ Close' : '+ Add'}</Text>
            </View>
          </View>
        </TouchableOpacity>
        {showWallet && (
          <FadeIn>
            <View style={s.walletBox}>
              <Text style={s.secTitle}>💰 Paisa Add Karo</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                {[100, 200, 500, 1000].map(amt => (
                  <TouchableOpacity key={amt} style={s.amtBtn} onPress={() => addMoney(amt)}>
                    <Text style={{ color: '#1a1a2e', fontWeight: 'bold', fontSize: 15 }}>₹{amt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {result ? <Text style={{ color: '#4CAF50', textAlign: 'center', fontWeight: '600' }}>{result}</Text> : null}
            </View>
          </FadeIn>
        )}
        {[['💳','Payment Methods','Cards & UPI'],['🎫','Promo Codes','Discounts & offers'],['🔔','Notifications','Alerts & updates'],['🛡️','Safety','Emergency contacts'],['📞','Support','24x7 help'],['📜','Terms & Privacy','Legal']].map(([icon,title,sub],i) => (
          <FadeIn key={i} delay={i * 40}>
            <TouchableOpacity style={s.menuItem}>
              <View style={s.menuIconBox}><Text style={{ fontSize: 18 }}>{icon}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>{title}</Text>
                <Text style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{sub}</Text>
              </View>
              <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
            </TouchableOpacity>
          </FadeIn>
        ))}
        <TouchableOpacity style={s.logoutBtn} onPress={async () => {
          await AsyncStorage.removeItem('userPhone'); await AsyncStorage.removeItem('userName');
          setScreen('login'); setTab('home'); setPhone(''); setOtp(''); setWalletBalance(0);
        }}>
          <Text style={{ color: '#e94560', fontWeight: 'bold', fontSize: 14 }}>🚪 Logout</Text>
        </TouchableOpacity>
      </ScrollView>
      <View style={s.nav}>
        {[['home','🏠','Home'],['history','🕐','Trips'],['profile','👤','Profile']].map(([t,icon,lbl]) => (
          <TouchableOpacity key={t} style={s.navItem} onPress={() => setTab(t)}>
            <Text style={s.navIcon}>{icon}</Text>
            <Text style={[s.navLbl, tab===t && s.navActive]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ══════════════════════════════════════════════
  //  BOOKING — KeyboardAvoidingView + scroll up
  // ══════════════════════════════════════════════
  if (screen === 'booking') return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}>
          <Text style={{ color: '#fff', fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>Ride Book Karo</Text>
        <View style={{ width: 40 }} />
      </View>
      <MapWebView pickup={pickup} drop={drop} height={155} />
      <ScrollView style={{ flex: 1, padding: 14 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Location inputs */}
        <View style={s.locBox}>
          <View style={s.row}>
            <View style={s.dotGreen} />
            <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="📍 Pickup location..."
              value={pickup} onChangeText={(t) => { setPickup(t); searchPlaces(t, 'pickup'); }} />
          </View>
          {pickupSugg.length > 0 && (
            <View style={s.suggBox}>
              {pickupSugg.slice(0, 4).map((sg, i) => (
                <TouchableOpacity key={i} style={s.suggItem}
                  onPress={() => { setPickup(sg.text); setPickupSugg([]); if(drop) fetchEta(sg.text, drop); }}>
                  <Text style={{ fontSize: 12 }}>📍 </Text>
                  <Text style={{ fontSize: 12, color: '#333', flex: 1 }} numberOfLines={1}>{sg.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={s.locDivider} />
          <View style={s.row}>
            <View style={s.dotRed} />
            <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="🎯 Drop location..."
              value={drop} onChangeText={(t) => { setDrop(t); searchPlaces(t, 'drop'); }} />
          </View>
          {dropSugg.length > 0 && (
            <View style={s.suggBox}>
              {dropSugg.slice(0, 4).map((sg, i) => (
                <TouchableOpacity key={i} style={s.suggItem}
                  onPress={() => { setDrop(sg.text); setDropSugg([]); if(pickup) fetchEta(pickup, sg.text); }}>
                  <Text style={{ fontSize: 12 }}>🎯 </Text>
                  <Text style={{ fontSize: 12, color: '#333', flex: 1 }} numberOfLines={1}>{sg.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {eta ? <View style={{ backgroundColor: '#e8f5e9', borderRadius: 10, padding: 10, marginBottom: 10, alignItems: 'center' }}><Text style={{ color: '#2e7d32', fontWeight: '600', fontSize: 13 }}>🕐 {eta}</Text></View> : null}
        <TouchableOpacity style={s.locationBtn} onPress={useMyLocation}>
          <Text style={{ color: '#2e7d32', fontWeight: '600', fontSize: 13 }}>📍 Meri Current Location Use Karo</Text>
        </TouchableOpacity>
        <View style={[s.row, { marginBottom: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12 }]}>
          <Text style={[s.label, { flex: 1, marginBottom: 0, fontSize: 13 }]}>📅 Schedule karo?</Text>
          <Switch value={scheduleOn} onValueChange={setScheduleOn} trackColor={{ true: '#e94560', false: '#e0e0e0' }} />
        </View>
        {scheduleOn && <TextInput style={s.input} placeholder="Date & Time: e.g. 30 May, 9:00 AM" />}
        <Text style={s.secTitle}>Ride Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {RIDES.map(r => (
            <TouchableOpacity key={r.id} style={[s.rideCard, rideType===r.id && s.rideCardActive]} onPress={() => setRideType(r.id)}>
              <Text style={{ fontSize: 24 }}>{r.icon}</Text>
              <Text style={[{ fontSize: 12, fontWeight: '700', marginTop: 4 }, rideType===r.id ? { color: '#fff' } : { color: '#333' }]}>{r.label}</Text>
              <Text style={[{ fontSize: 10 }, rideType===r.id ? { color: '#ddd' } : { color: '#999' }]}>{r.eta}</Text>
              <Text style={[{ fontSize: 12, fontWeight: 'bold', marginTop: 2 }, rideType===r.id ? { color: '#fff' } : { color: '#e94560' }]}>₹{r.base}+</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={[s.row, { marginBottom: 12 }]}>
          <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="🎫 Promo code" value={promoCode} onChangeText={setPromoCode} />
          <TouchableOpacity style={s.applyBtn}><Text style={{ color: '#e94560', fontWeight: 'bold' }}>Apply</Text></TouchableOpacity>
        </View>
        {result ? <Text style={s.err}>{result}</Text> : null}
        <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={bookRide} disabled={loading}>
          <Text style={s.btnTxt}>{loading ? '🔍 Driver dhundh raha hai...' : 'Ride Book Karo 🚀'}</Text>
        </TouchableOpacity>
        <View style={{ height: 16 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ══════════════════════════════════════════════
  //  MATCHING
  // ══════════════════════════════════════════════
  if (screen === 'matching') return (
    <View style={s.screen}>
      <MapWebView pickup={pickup} drop={drop} driverLat={driverLoc?.lat} driverLng={driverLoc?.lng} height={180} />
      <ScrollView style={{ flex: 1, padding: 14 }} showsVerticalScrollIndicator={false}>
        {rideData?.driver ? (
          <FadeIn>
            <View style={s.driverCard}>
              <View style={s.driverAvatar}><Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>{(rideData.driver.name||'D')[0].toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.driverName}>{rideData.driver.name}</Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>🚗 {rideData.driver.vehicle_no}</Text>
                <Text style={{ fontSize: 12, color: '#f0a500', marginTop: 2 }}>⭐ 4.8 · 1,243 trips</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <PulseView><Text style={{ fontSize: 16, fontWeight: 'bold', color: '#e94560' }}>{eta ? eta.split('·')[0].trim() : '3 min'}</Text></PulseView>
                <Text style={{ fontSize: 10, color: '#666' }}>arriving</Text>
              </View>
            </View>
            {driverLoc && (
              <View style={s.liveLocCard}>
                <Text style={{ fontSize: 20, marginRight: 8 }}>📡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: '#1565c0', fontWeight: '600' }}>Driver Live Location</Text>
                  <Text style={{ fontSize: 11, color: '#1976d2', marginTop: 2 }}>📍 {driverLoc.lat.toFixed(4)}, {driverLoc.lng.toFixed(4)}</Text>
                </View>
              </View>
            )}
            {rideData?.startOtp && (
              <View style={s.otpCard}>
                <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 6 }}>🔐 Driver ko yeh OTP batao</Text>
                <Text style={{ color: '#fff', fontSize: 34, fontWeight: 'bold', letterSpacing: 10 }}>{rideData.startOtp}</Text>
                <Text style={{ color: '#888', fontSize: 11, marginTop: 6 }}>Trip OTP daalne par hi shuru hogi</Text>
              </View>
            )}
            <View style={s.fareCard}>
              {[['Base fare','₹25'],['Distance',rideData.distance],['Total',rideData.fare]].map(([lbl,val],i) => (
                <View key={i} style={[s.row, { justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i<2 ? 1 : 0, borderBottomColor: '#f5f5f5' }]}>
                  <Text style={{ fontSize: 13, color: '#666' }}>{lbl}</Text>
                  <Text style={[{ fontSize: 13 }, i===2 && { fontWeight: 'bold', color: '#1a1a2e', fontSize: 15 }]}>{val}</Text>
                </View>
              ))}
            </View>
            <View style={s.actionRow}>
              {[['💬','Chat'],['📞','Call'],['📤','Share'],['🆘','SOS']].map(([icon,lbl],i) => (
                <TouchableOpacity key={i} style={s.actionBtn} onPress={() => { if(lbl==='SOS') setSosActive(!sosActive); }}>
                  <Text style={{ fontSize: 22 }}>{icon}</Text>
                  <Text style={{ fontSize: 10, color: '#555', marginTop: 3 }}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {sosActive && <View style={[s.infoBox, { backgroundColor: '#ffeeee' }]}><Text style={{ fontSize: 13, color: '#c62828', fontWeight: 'bold' }}>🆘 Emergency! Police: 100 · Ambulance: 108</Text></View>}
            <Text style={{ textAlign: 'center', color: '#bbb', fontSize: 12, marginBottom: 16 }}>⏳ Driver OTP daalkar trip shuru karega...</Text>
          </FadeIn>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <RadarView />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginTop: 20 }}>Driver dhundh rahe hain...</Text>
            <Text style={{ fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center' }}>{pickup} → {drop}</Text>
            <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#e94560', marginTop: 10 }}>{rideData?.fare}</Text>
            {eta ? <Text style={{ fontSize: 13, color: '#4CAF50', marginTop: 4 }}>🕐 {eta}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20, width: '100%', paddingHorizontal: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' }}
                onPress={async () => {
                  if (rideData?.ride_id) {
                    try { await fetch(`${API}/api/rides/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, reason: 'Customer cancelled' }) }); } catch (_e) {}
                  }
                  setScreen('home'); setRideData(null); setPickup(''); setDrop(''); setEta('');
                }}>
                <Text style={{ color: '#e94560', fontWeight: 'bold', fontSize: 14 }}>← Wapas Jao</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, alignItems: 'center' }} onPress={() => { setRideData(null); bookRide(); }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>🔄 Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );

  // ══════════════════════════════════════════════
  //  IN-RIDE
  // ══════════════════════════════════════════════
  if (screen === 'inride') return (
    <View style={s.screen}>
      <MapWebView pickup={pickup} drop={drop} driverLat={driverLoc?.lat} driverLng={driverLoc?.lng} height={200} />
      <ScrollView style={{ flex: 1, padding: 14 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 }}>
          <PulseView><Text style={{ color: '#4CAF50', fontSize: 15, fontWeight: 'bold' }}>🚗 Ride Chal Rahi Hai</Text></PulseView>
          <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>{rideData?.distance} · {rideData?.fare}</Text>
          {eta ? <Text style={{ color: '#4CAF50', fontSize: 12, marginTop: 3 }}>🕐 {eta}</Text> : null}
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2 }}>
          <Text style={{ fontSize: 13, color: '#4CAF50', fontWeight: '600' }}>📍 {pickup}</Text>
          <Text style={{ fontSize: 16, textAlign: 'center', color: '#ddd', marginVertical: 6 }}>↓</Text>
          <Text style={{ fontSize: 13, color: '#e94560', fontWeight: '600' }}>🎯 {drop}</Text>
        </View>
        <View style={s.actionRow}>
          {[['💬','Chat'],['📞','Call'],['📤','Share'],['🆘','SOS']].map(([icon,lbl],i) => (
            <TouchableOpacity key={i} style={s.actionBtn} onPress={() => { if(lbl==='SOS') setSosActive(!sosActive); }}>
              <Text style={{ fontSize: 22 }}>{icon}</Text>
              <Text style={{ fontSize: 10, color: '#555', marginTop: 3 }}>{lbl}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {sosActive && <View style={[s.infoBox, { backgroundColor: '#ffeeee' }]}><Text style={{ fontSize: 13, color: '#c62828', fontWeight: 'bold' }}>🆘 Emergency! Police: 100 · Ambulance: 108</Text></View>}
      </ScrollView>
    </View>
  );

  // ══════════════════════════════════════════════
  //  PAYMENT
  // ══════════════════════════════════════════════
  if (screen === 'payment') return (
    <ScrollView style={s.screen} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={[s.hero, { paddingTop: 50 }]}>
        <Text style={{ fontSize: 55 }}>🎉</Text>
        <Text style={s.heroTitle}>Trip Complete!</Text>
        <Text style={s.heroSub}>{pickup} → {drop}</Text>
        <Animated.Text style={{ color: '#e94560', fontSize: 42, fontWeight: 'bold', marginTop: 6 }}>₹{fareCount}</Animated.Text>
      </View>
      <View style={s.card}>
        <Text style={[s.secTitle, { textAlign: 'center' }]}>Payment Method Choose Karo</Text>
        {[
          { color: '#e94560', icon: '💰', title: 'Wallet se Pay', sub: `Balance: ₹${walletBalance}`, fn: payWithWallet },
          { color: '#1a1a2e', icon: '💳', title: 'Online Pay', sub: 'UPI / Card / Net Banking', fn: handlePayment },
          { color: '#4CAF50', icon: '💵', title: 'Cash Pay', sub: 'Driver ko cash do', fn: () => { setPaymentDone(true); setScreen('postride'); createScratchCard(); } },
        ].map((p, i) => (
          <TouchableOpacity key={i} style={[s.payBtn, { backgroundColor: p.color }]} onPress={p.fn}>
            <Text style={{ fontSize: 20 }}>{p.icon}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{p.title}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 }}>{p.sub}</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 18 }}>→</Text>
          </TouchableOpacity>
        ))}
        {result ? <Text style={s.err}>{result}</Text> : null}
      </View>
    </ScrollView>
  );

  // ══════════════════════════════════════════════
  //  POST-RIDE
  // ══════════════════════════════════════════════
  if (screen === 'postride') return (
    <ScrollView style={s.screen} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View style={[s.hero, { paddingTop: 44 }]}>
        <Text style={{ fontSize: 50 }}>{paymentDone ? '✅' : '🎉'}</Text>
        <Text style={s.heroTitle}>{paymentDone ? 'Payment Done!' : 'Pahunch Gaye!'}</Text>
        <Text style={s.heroSub}>{pickup} → {drop}</Text>
        <Text style={{ color: '#e94560', fontSize: 26, fontWeight: 'bold', marginTop: 6 }}>{rideData?.fare}</Text>
      </View>
      {scratchCard && (
        <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
          <Animated.View style={{ transform: [{ scale: scratched ? 1 : scratchAnim }] }}>
            <TouchableOpacity activeOpacity={0.85} onPress={scratchNow}
              style={[s.scratchCard, { backgroundColor: scratched ? '#fff' : '#f0a500' }]}>
              {scratched ? (
                <FadeIn style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 40 }}>🎉</Text>
                  <Text style={{ fontSize: 14, color: '#888', marginTop: 6 }}>Aapko mila reward!</Text>
                  <Text style={{ fontSize: 40, fontWeight: 'bold', color: '#4CAF50', marginTop: 4 }}>₹{scratchCard.reward}</Text>
                  <Text style={{ fontSize: 12, color: '#4CAF50', marginTop: 4, fontWeight: '600' }}>✅ Wallet mein add ho gaya!</Text>
                </FadeIn>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 40 }}>🎟️</Text>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 6 }}>Scratch Card Jeeta!</Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>👆 Tap karke scratch karo</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
      <View style={[s.card, { marginTop: 14 }]}>
        <Text style={[s.secTitle, { textAlign: 'center' }]}>Driver ko Rate Karo</Text>
        <View style={[s.row, { justifyContent: 'center', marginBottom: 14 }]}>
          {[1,2,3,4,5].map(star => (
            <TouchableOpacity key={star} onPress={() => { setRating(star); animateStar(star-1); }} style={{ padding: 3 }}>
              <Animated.Text style={{ fontSize: 36, color: star<=rating ? '#f0a500' : '#e0e0e0', transform: [{ scale: starAnims[star-1] }] }}>★</Animated.Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={[s.row, { flexWrap: 'wrap', gap: 8, marginBottom: 12, justifyContent: 'center' }]}>
          {['✅ Sahi route','😊 Friendly','🚗 Clean','⏰ On time'].map((t,i) => (
            <TouchableOpacity key={i} style={s.specBtn}><Text style={{ fontSize: 12, color: '#555' }}>{t}</Text></TouchableOpacity>
          ))}
        </View>
        <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} placeholder="Comment (optional)..." multiline value={review} onChangeText={setReview} />
        <Text style={s.secTitle}>💰 Tip do (optional)</Text>
        <View style={[s.row, { gap: 8, marginBottom: 14 }]}>
          {[0,10,20,50].map(t => (
            <TouchableOpacity key={t} style={[s.tipBtn, tip===t && { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' }]} onPress={() => setTip(t)}>
              <Text style={[{ fontSize: 13, fontWeight: '600', color: '#555' }, tip===t && { color: '#fff' }]}>{t===0 ? 'Skip' : '₹'+t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.btn} onPress={async () => {
          if (rating > 0 && rideData?.ride_id) {
            try { await fetch(`${API}/api/rides/rate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, rating, review, tip }) }); } catch (_e) {}
          }
          setScreen('home'); setPickup(''); setDrop(''); setRating(0); setTab('home');
          setRideData(null); setPaymentDone(false); setResult('');
          setScratchCard(null); setScratched(false); setEta('');
          loadHistory(phone); loadWallet(phone);
        }}>
          <Text style={s.btnTxt}>Done 🏠 Home Jao</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );

  return <View />;
}

const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: '#f5f5f5' },
  hero:          { backgroundColor: '#1a1a2e', alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  heroIcon:      { fontSize: 52 },
  heroTitle:     { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  heroSub:       { color: '#aaa', fontSize: 13, marginTop: 5, textAlign: 'center' },
  card:          { margin: 14, backgroundColor: '#fff', borderRadius: 18, padding: 20, elevation: 4 },
  input:         { borderWidth: 1.5, borderColor: '#efefef', borderRadius: 12, padding: 12, fontSize: 14, backgroundColor: '#fafafa', marginBottom: 10 },
  label:         { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  btn:           { backgroundColor: '#e94560', borderRadius: 13, padding: 16, alignItems: 'center', marginTop: 6, marginBottom: 10, elevation: 3 },
  btnTxt:        { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  err:           { textAlign: 'center', color: '#e94560', fontWeight: '600', marginBottom: 8 },
  hint:          { color: '#888', fontSize: 12, textAlign: 'center', marginBottom: 10 },
  back:          { textAlign: 'center', color: '#e94560', marginTop: 14, fontSize: 13 },
  terms:         { textAlign: 'center', color: '#bbb', fontSize: 11, marginTop: 10 },
  otpInput:      { fontSize: 24, letterSpacing: 10, textAlign: 'center', fontWeight: 'bold' },
  row:           { flexDirection: 'row', alignItems: 'center' },
  flag:          { fontSize: 13, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 10, borderWidth: 1.5, borderColor: '#efefef', marginRight: 8 },
  topBar:        { backgroundColor: '#1a1a2e', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingTop: 46 },
  topTitle:      { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  backBtn:       { width: 36, alignItems: 'flex-start' },
  greeting:      { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  subTxt:        { color: '#aaa', fontSize: 11, marginTop: 2 },
  avatar:        { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e94560', alignItems: 'center', justifyContent: 'center' },
  avatarTxt:     { color: '#fff', fontWeight: 'bold', fontSize: 17 },
  searchBox:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, elevation: 4, marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  searchIcon:    { fontSize: 16, marginRight: 8 },
  searchPh:      { color: '#bbb', fontSize: 14 },
  quickRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickBtn:      { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2 },
  quickIcon:     { fontSize: 22 },
  quickLbl:      { fontSize: 10, color: '#666', marginTop: 3, fontWeight: '500' },
  secTitle:      { fontSize: 14, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 10, marginTop: 4 },
  recentItem:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, elevation: 2 },
  recentRoute:   { fontSize: 13, fontWeight: '600', color: '#1a1a2e' },
  recentDate:    { fontSize: 11, color: '#999', marginTop: 2 },
  recentFare:    { fontSize: 14, fontWeight: 'bold', color: '#e94560' },
  promoBanner:   { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginBottom: 14 },
  promoTxt:      { color: '#fff', fontSize: 12, textAlign: 'center' },
  nav:           { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingBottom: 10, paddingTop: 4 },
  navItem:       { flex: 1, alignItems: 'center', paddingTop: 7 },
  navIcon:       { fontSize: 20 },
  navLbl:        { fontSize: 10, color: '#bbb', marginTop: 2 },
  navActive:     { color: '#e94560', fontWeight: 'bold' },
  histCard:      { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 2 },
  histIcon:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  profileHero:   { backgroundColor: '#1a1a2e', borderRadius: 18, padding: 24, alignItems: 'center', marginBottom: 14, elevation: 4 },
  profileAvatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#e94560', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  profileName:   { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  profilePhone:  { color: '#aaa', fontSize: 13, marginTop: 3 },
  badge:         { backgroundColor: '#f0a500', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 12, marginTop: 8 },
  walletCard:    { backgroundColor: '#e94560', borderRadius: 16, padding: 20, marginBottom: 12, elevation: 4 },
  walletBox:     { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 12, elevation: 2 },
  amtBtn:        { flex: 1, minWidth: 68, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#e94560', alignItems: 'center', backgroundColor: '#fff8f8' },
  menuItem:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 7, elevation: 1 },
  menuIconBox:   { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  logoutBtn:     { borderWidth: 1.5, borderColor: '#e94560', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 6, marginBottom: 24 },
  locBox:        { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 4, elevation: 3 },
  dotGreen:      { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF50', marginRight: 10 },
  dotRed:        { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e94560', marginRight: 10 },
  locDivider:    { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8, marginLeft: 20 },
  locationBtn:   { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#c8e6c9', marginTop: 6 },
  suggBox:       { backgroundColor: '#fff', borderRadius: 10, marginTop: 4, elevation: 8, borderWidth: 1, borderColor: '#f0f0f0', zIndex: 999 },
  suggItem:      { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  rideCard:      { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginRight: 8, alignItems: 'center', minWidth: 82, elevation: 2, borderWidth: 2, borderColor: 'transparent' },
  rideCardActive:{ backgroundColor: '#1a1a2e', borderColor: '#e94560' },
  applyBtn:      { padding: 12, borderWidth: 1.5, borderColor: '#e94560', borderRadius: 10, justifyContent: 'center', marginLeft: 8 },
  specBtn:       { backgroundColor: '#fff', borderRadius: 18, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e8e8e8' },
  driverCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10, elevation: 4 },
  driverAvatar:  { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  driverName:    { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
  liveLocCard:   { backgroundColor: '#e3f2fd', borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  otpCard:       { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12 },
  fareCard:      { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2 },
  actionRow:     { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2 },
  actionBtn:     { alignItems: 'center', padding: 4 },
  infoBox:       { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, marginBottom: 10 },
  payBtn:        { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 3 },
  scratchCard:   { borderRadius: 18, padding: 24, alignItems: 'center', marginBottom: 4, elevation: 6 },
  tipBtn:        { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#e0e0e0', alignItems: 'center', backgroundColor: '#fafafa' },
});
