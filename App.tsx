import { useState, useEffect, useRef } from 'react';
import RazorpayCheckout from 'react-native-razorpay';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Switch, Platform,
  Animated, Dimensions
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';

const MAPS_KEY = 'AIzaSyAK3HFrZsahMLNVUFgxGAQMw_6OATDD8q4';
const API = 'https://rideapp-backend-production-5e1c.up.railway.app';

type Screen = 'login' | 'otp' | 'home' | 'booking' | 'matching' | 'inride' | 'payment' | 'postride';

// ── Animations ─────────────────────────────────────
const PulseView = ({ children, style }: any) => {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[style, { transform: [{ scale: anim }] }]}>{children}</Animated.View>;
};

const FadeIn = ({ children, style, delay = 0 }: any) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 400, delay, useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={[style, { opacity: anim }]}>{children}</Animated.View>;
};

const RadarView = () => {
  const rings = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  useEffect(() => {
    rings.forEach((r, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(r, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);
  return (
    <View style={{ width: 130, height: 130, alignItems: 'center', justifyContent: 'center' }}>
      {rings.map((r, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', width: 130, height: 130, borderRadius: 65,
          borderWidth: 2, borderColor: '#e94560',
          opacity: r.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 0.4, 0] }),
          transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.2] }) }],
        }} />
      ))}
      <View style={{ width: 65, height: 65, borderRadius: 32, backgroundColor: '#e94560',
        alignItems: 'center', justifyContent: 'center', elevation: 8 }}>
        <Text style={{ fontSize: 30 }}>🚖</Text>
      </View>
    </View>
  );
};

// ── Google Maps WebView ─────────────────────────────
const MapWebView = ({ pickup, drop, driverLat, driverLng, height = 200 }: any) => {
  const hasDriver = driverLat && driverLng;
  const hasRoute  = pickup && drop;

  let mapUrl = '';
  if (hasDriver && hasRoute) {
    mapUrl = `https://www.google.com/maps/embed/v1/directions?key=${MAPS_KEY}&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(drop)}&mode=driving`;
  } else if (hasRoute) {
    mapUrl = `https://www.google.com/maps/embed/v1/directions?key=${MAPS_KEY}&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(drop)}&mode=driving`;
  } else if (pickup) {
    mapUrl = `https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${encodeURIComponent(pickup)}`;
  } else {
    mapUrl = `https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=Lucknow,India`;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>* { margin: 0; padding: 0; } body { background: #dbeafe; }</style>
    </head>
    <body>
      <iframe
        width="100%"
        height="${height}"
        frameborder="0"
        style="border:0"
        src="${mapUrl}"
        allowfullscreen>
      </iframe>
      ${hasDriver ? `
      <div style="position:absolute;top:10px;right:10px;background:#1a1a2e;color:white;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:bold;">
        🚗 Driver Live
      </div>` : ''}
    </body>
    </html>
  `;

  if (Platform.OS === 'web') {
    return (
      <View style={{ height, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 36 }}>🗺️</Text>
        <Text style={{ color: '#1e40af', fontWeight: 'bold', marginTop: 8 }}>{pickup || 'Map'}</Text>
      </View>
    );
  }

  return (
    <WebView
      source={{ html }}
      style={{ height, width: '100%' }}
      scrollEnabled={false}
      javaScriptEnabled={true}
    />
  );
};

export default function App() {
  const [screen, setScreen]         = useState<Screen>('login');
  const [phone, setPhone]           = useState('');
  const [otp, setOtp]               = useState('');
  const [otpSent, setOtpSent]       = useState('');
  const [userName, setUserName]     = useState('');
  const [pickup, setPickup]         = useState('');
  const [drop, setDrop]             = useState('');
  const [rideType, setRideType]     = useState('auto');
  const [result, setResult]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [rideData, setRideData]     = useState<any>(null);
  const [rating, setRating]         = useState(0);
  const [sosActive, setSosActive]   = useState(false);
  const [shareOn, setShareOn]       = useState(false);
  const [tab, setTab]               = useState('home');
  const [scheduleOn, setScheduleOn] = useState(false);
  const [promoCode, setPromoCode]   = useState('');
  const [tip, setTip]               = useState(0);
  const [review, setReview]         = useState('');
  const [paymentDone, setPaymentDone] = useState(false);
  const [historyRides, setHistoryRides] = useState<any[]>([]);
  const [driverLoc, setDriverLoc]   = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [showWallet, setShowWallet] = useState(false);
  const [scratchCard, setScratchCard] = useState<any>(null);
  const [scratched, setScratched]   = useState(false);
  const [eta, setEta]               = useState('');
  const [fareCount, setFareCount]   = useState(0);
  const [pickupSuggestions, setPickupSuggestions] = useState<any[]>([]);
  const [dropSuggestions, setDropSuggestions]     = useState<any[]>([]);
  const scratchAnim = useRef(new Animated.Value(1)).current;
  const starAnims   = useRef([1,2,3,4,5].map(() => new Animated.Value(1))).current;

  // ── Auto login ──────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const savedPhone = await AsyncStorage.getItem('userPhone');
        const savedName  = await AsyncStorage.getItem('userName');
        if (savedPhone) {
          setPhone(savedPhone);
          setUserName(savedName || 'Rider');
          setScreen('home');
          loadHistoryFn(savedPhone);
          loadWalletFn(savedPhone);
        }
      } catch (_e) {}
    })();
  }, []);

  // ── Ride polling ────────────────────────────────
  useEffect(() => {
    if (!['matching', 'inride'].includes(screen) || !rideData?.ride_id) return;
    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`${API}/api/rides/status/${rideData.ride_id}`);
        const data = await res.json();
        const st   = data.ride?.status;
        try {
          const lr  = await fetch(`${API}/api/rides/driver-location/${rideData.ride_id}`);
          const ld  = await lr.json();
          if (ld.location) setDriverLoc(ld.location);
        } catch (_e) {}
        if (st === 'matched' || st === 'arrived') {
          setRideData((prev: any) => ({
            ...prev,
            startOtp: data.ride.start_otp,
            driver: { name: data.ride.driver_name, phone: data.ride.driver_phone, vehicle_no: data.ride.vehicle_no }
          }));
        }
        if (st === 'started') setScreen('inride');
        if (st === 'completed') { setScreen('payment'); loadWalletFn(phone); clearInterval(interval); }
      } catch (_e) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [screen, rideData?.ride_id]);

  // ── Scratch card bounce ─────────────────────────
  useEffect(() => {
    if (!scratchCard || scratched) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scratchAnim, { toValue: 1.06, duration: 600, useNativeDriver: true }),
        Animated.timing(scratchAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scratchCard, scratched]);

  // ── Fare counter ────────────────────────────────
  useEffect(() => {
    if (screen !== 'payment' || !rideData?.fare) return;
    const target = parseInt(String(rideData.fare).replace(/[^0-9]/g, '')) || 0;
    let current  = 0;
    const step   = Math.ceil(target / 30);
    const timer  = setInterval(() => {
      current = Math.min(current + step, target);
      setFareCount(current);
      if (current >= target) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  }, [screen]);

  // ── API Helpers ─────────────────────────────────
  const loadHistoryFn = async (ph: string) => {
    try {
      const res  = await fetch(`${API}/api/rides/history?phone=${ph}`);
      const data = await res.json();
      setHistoryRides(data.rides || []);
    } catch (_e) {}
  };

  const loadWalletFn = async (ph: string) => {
    try {
      const res  = await fetch(`${API}/api/wallet/balance?phone=${ph}`);
      const data = await res.json();
      setWalletBalance(data.balance || 0);
    } catch (_e) {}
  };

  // ── Places Autocomplete ─────────────────────────
  const searchPlaces = async (text: string, type: 'pickup' | 'drop') => {
    if (text.length < 3) {
      type === 'pickup' ? setPickupSuggestions([]) : setDropSuggestions([]);
      return;
    }
    try {
      const res  = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${MAPS_KEY}&components=country:in&location=26.8467,80.9462&radius=50000`
      );
      const data = await res.json();
      const suggestions = data.predictions?.map((p: any) => ({
        id: p.place_id,
        text: p.description
      })) || [];
      type === 'pickup' ? setPickupSuggestions(suggestions) : setDropSuggestions(suggestions);
    } catch (_e) {}
  };

  // ── ETA fetch ───────────────────────────────────
  const fetchEta = async (origin: string, dest: string) => {
    try {
      const res  = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(dest)}&key=${MAPS_KEY}`
      );
      const data = await res.json();
      const el   = data.rows?.[0]?.elements?.[0];
      if (el?.status === 'OK') {
        setEta(el.duration.text + ' · ' + el.distance.text);
        return el.distance.value / 1000;
      }
    } catch (_e) {}
    return 5;
  };

  const createScratchCard = async () => {
    try {
      const res  = await fetch(`${API}/api/scratch-card/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone || '9999999999', ride_id: rideData?.ride_id })
      });
      const data = await res.json();
      if (data.success) { setScratchCard(data); setScratched(false); }
    } catch (_e) {}
  };

  const scratchNow = async () => {
    if (!scratchCard || scratched) return;
    scratchAnim.stopAnimation();
    setScratched(true);
    try {
      await fetch(`${API}/api/scratch-card/scratch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: scratchCard.card_id, phone: phone || '9999999999' })
      });
      loadWalletFn(phone);
    } catch (_e) {}
  };

  const addMoney = async (amt: number) => {
    try {
      const res  = await fetch(`${API}/api/wallet/add`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone || '9999999999', amount: amt })
      });
      const data = await res.json();
      if (data.success) { setWalletBalance(data.balance); setResult(`✅ ₹${amt} wallet mein add ho gaya!`); }
    } catch (_e) { setResult('❌ Error'); }
  };

  const payWithWallet = async () => {
    const fareNum = parseInt(String(rideData?.fare).replace(/[^0-9]/g, '')) || 0;
    if (walletBalance < fareNum) { setResult(`❌ Wallet balance kam hai! ₹${walletBalance} hai`); return; }
    try {
      const res  = await fetch(`${API}/api/wallet/pay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone || '9999999999', amount: fareNum, ride_id: rideData.ride_id })
      });
      const data = await res.json();
      if (data.success) { setWalletBalance(data.balance); setPaymentDone(true); setScreen('postride'); createScratchCard(); }
      else setResult('❌ ' + (data.message || 'Payment fail'));
    } catch (_e) { setResult('❌ Server error'); }
  };

  const handlePayment = async () => {
    try {
      const fareNum  = parseInt(String(rideData?.fare).replace(/[^0-9]/g, '')) || 0;
      const orderRes = await fetch(`${API}/api/payment/create-order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: fareNum, ride_id: rideData.ride_id })
      });
      const order = await orderRes.json();
      if (!order.success) { setResult('❌ Order error'); return; }
      RazorpayCheckout.open({
        description: 'RideApp Trip', currency: 'INR', key: order.key_id,
        amount: order.amount, order_id: order.order_id, name: 'RideApp',
        prefill: { contact: phone, name: userName || 'User' }, theme: { color: '#e94560' }
      }).then(async (data: any) => {
        await fetch(`${API}/api/payment/verify`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ride_id: rideData.ride_id, payment_id: data.razorpay_payment_id, amount: fareNum, method: 'online' })
        });
        setPaymentDone(true); setScreen('postride'); createScratchCard();
      }).catch((_e: any) => setResult('❌ Payment cancel ya fail hua'));
    } catch (e: any) { setResult('❌ ' + (e?.message || 'Payment error')); }
  };

  const useMyLocation = async () => {
    setResult('📍 Location le rahe hain...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setResult('❌ Location permission do'); return; }
      const loc = await Location.getCurrentPositionAsync({});
      const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo[0]) {
        const a   = geo[0];
        const addr = [a.name, a.street, a.city].filter(Boolean).join(', ');
        setPickup(addr);
        setResult('✅ Location mil gayi!');
      }
    } catch (_e) { setResult('❌ Location error'); }
  };

  const bookRide = async () => {
    if (!pickup || !drop) { setResult('❌ Pickup aur Drop likho!'); return; }
    setLoading(true); setPaymentDone(false);
    try {
      const distanceKm = await fetchEta(pickup, drop);
      const res  = await fetch(`${API}/api/rides/book`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passenger_phone: phone || '9999999999', pickup, drop_location: drop, ride_type: rideType, distance: distanceKm })
      });
      const data = await res.json();
      setRideData(data); setScreen('matching'); setResult('');
    } catch { setResult('❌ Server connect nahi hua!'); }
    setLoading(false);
  };

  const sendOtp = async () => {
    if (!phone || phone.length < 10) { setResult('❌ Sahi phone number likho'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/auth/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      setOtpSent(data.otp || ''); setScreen('otp'); setResult('');
    } catch { setResult('❌ Server connect nahi hua'); }
    setLoading(false);
  };

  const verifyOtp = async () => {
    if (!otp) { setResult('❌ OTP likho'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/auth/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, name: userName || 'Rider' })
      });
      const data = await res.json();
      if (data.token) {
        await AsyncStorage.setItem('userPhone', phone);
        await AsyncStorage.setItem('userName', userName || 'Rider');
        setScreen('home'); setResult(''); loadHistoryFn(phone); loadWalletFn(phone);
      } else setResult('❌ ' + (data.error || 'OTP galat hai'));
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
    { id: 'auto',    icon: '🛺', label: 'Auto',    base: 25, rate: 12, eta: '3 min' },
    { id: 'moto',    icon: '🏍️', label: 'Moto',    base: 20, rate: 8,  eta: '2 min' },
    { id: 'economy', icon: '🚕', label: 'Economy', base: 40, rate: 15, eta: '5 min' },
    { id: 'premium', icon: '🚗', label: 'Premium', base: 80, rate: 22, eta: '7 min' },
    { id: 'xl',      icon: '🚙', label: 'XL',      base: 90, rate: 25, eta: '8 min' },
    { id: 'ev',      icon: '⚡', label: 'EV',      base: 35, rate: 14, eta: '6 min' },
  ];

  // ══════════════════════════════════════════════
  //  LOGIN
  // ══════════════════════════════════════════════
  if (screen === 'login') return (
    <ScrollView style={s.screen} contentContainerStyle={{ flexGrow: 1 }}>
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
          <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="10 digit number"
            keyboardType="numeric" value={phone} onChangeText={setPhone} maxLength={10} />
        </View>
        {result ? <Text style={s.err}>{result}</Text> : null}
        <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={sendOtp} disabled={loading}>
          <Text style={s.btnTxt}>{loading ? '⏳ Bhej raha hai...' : 'OTP Bhejo 📱'}</Text>
        </TouchableOpacity>
        <Text style={s.terms}>Continue karke aap Terms & Privacy se agree karte hain</Text>
      </View>
    </ScrollView>
  );

  // ══════════════════════════════════════════════
  //  OTP
  // ══════════════════════════════════════════════
  if (screen === 'otp') return (
    <ScrollView style={s.screen} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={s.hero}>
        <Text style={s.heroIcon}>🔐</Text>
        <Text style={s.heroTitle}>OTP Verify</Text>
        <Text style={s.heroSub}>+91 {phone} pe bheja gaya</Text>
      </View>
      <View style={s.card}>
        <Text style={s.label}>6-digit OTP</Text>
        <TextInput style={[s.input, s.otpInput]} placeholder="------" keyboardType="numeric"
          value={otp} onChangeText={setOtp} maxLength={6} />
        {otpSent ? <Text style={s.hint}>💡 Test OTP: {otpSent}</Text> : null}
        {result ? <Text style={s.err}>{result}</Text> : null}
        <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={verifyOtp} disabled={loading}>
          <Text style={s.btnTxt}>{loading ? '⏳ Verify ho raha hai...' : 'Verify Karo ✅'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setScreen('login')}>
          <Text style={s.back}>← Wapas jao</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
        <TouchableOpacity style={s.avatar} onPress={() => { setTab('profile'); loadWalletFn(phone); }}>
          <Text style={s.avatarTxt}>{(userName || 'R')[0].toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
      <MapWebView pickup="Lucknow,India" drop="" height={180} />
      <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
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
          : historyRides.slice(0, 2).map((h, i) => (
            <FadeIn key={i} delay={i * 80}>
              <TouchableOpacity style={s.recentItem}
                onPress={() => { setPickup(h.pickup); setDrop(h.drop_location); setScreen('booking'); }}>
                <Text style={{ fontSize: 26, marginRight: 12 }}>{rideIcon(h.ride_type)}</Text>
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
      <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
        {historyRides.length === 0
          ? <View style={{ alignItems: 'center', marginTop: 80 }}>
              <Text style={{ fontSize: 60 }}>🚗</Text>
              <Text style={{ fontSize: 18, color: '#333', marginTop: 16, fontWeight: '600' }}>Abhi koi trip nahi</Text>
              <Text style={{ fontSize: 14, color: '#999', marginTop: 6 }}>Pehli ride book karo!</Text>
            </View>
          : historyRides.map((h, i) => (
            <FadeIn key={i} delay={i * 60}>
              <View style={s.histCard}>
                <View style={s.row}>
                  <View style={s.histIcon}><Text style={{ fontSize: 22 }}>{rideIcon(h.ride_type)}</Text></View>
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
          <TouchableOpacity key={t} style={s.navItem} onPress={() => { setTab(t); if(t==='history') loadHistoryFn(phone); }}>
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
      <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
        <FadeIn>
          <View style={s.profileHero}>
            <View style={s.profileAvatar}>
              <Text style={{ color: '#fff', fontSize: 36, fontWeight: 'bold' }}>{(userName||'R')[0].toUpperCase()}</Text>
            </View>
            <Text style={s.profileName}>{userName || 'Rider'}</Text>
            <Text style={s.profilePhone}>+91 {phone}</Text>
            <View style={s.badge}><Text style={{ color: '#fff', fontWeight: 'bold' }}>⭐ 4.9 Rating</Text></View>
          </View>
        </FadeIn>
        <TouchableOpacity style={s.walletCard} onPress={() => { setShowWallet(!showWallet); loadWalletFn(phone); }}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>💰 Wallet Balance</Text>
              <Text style={{ color: '#fff', fontSize: 32, fontWeight: 'bold', marginTop: 2 }}>₹{walletBalance}</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 12 }}>
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
                    <Text style={{ color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 }}>₹{amt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {result ? <Text style={{ color: '#4CAF50', textAlign: 'center', fontWeight: '600' }}>{result}</Text> : null}
            </View>
          </FadeIn>
        )}
        {[['💳','Payment Methods','Cards & UPI'],['🎫','Promo Codes','Discounts & offers'],
          ['🔔','Notifications','Alerts & updates'],['🛡️','Safety','Emergency contacts'],
          ['📞','Support','24x7 help'],['📜','Terms & Privacy','Legal']].map(([icon,title,sub],i) => (
          <FadeIn key={i} delay={i * 40}>
            <TouchableOpacity style={s.menuItem}>
              <View style={s.menuIconBox}><Text style={{ fontSize: 20 }}>{icon}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: '#1a1a2e', fontWeight: '600' }}>{title}</Text>
                <Text style={{ fontSize: 12, color: '#999', marginTop: 1 }}>{sub}</Text>
              </View>
              <Text style={{ fontSize: 20, color: '#ddd' }}>›</Text>
            </TouchableOpacity>
          </FadeIn>
        ))}
        <TouchableOpacity style={s.logoutBtn} onPress={async () => {
          await AsyncStorage.removeItem('userPhone');
          await AsyncStorage.removeItem('userName');
          setScreen('login'); setTab('home'); setPhone(''); setOtp(''); setWalletBalance(0);
        }}>
          <Text style={{ color: '#e94560', fontWeight: 'bold', fontSize: 15 }}>🚪 Logout</Text>
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
  //  BOOKING — with autocomplete suggestions
  // ══════════════════════════════════════════════
  if (screen === 'booking') return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}>
          <Text style={{ color: '#fff', fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>Ride Book Karo</Text>
        <View style={{ width: 40 }} />
      </View>
      <MapWebView pickup={pickup} drop={drop} height={160}/>
      <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.locBox}>
          <View style={s.row}>
            <View style={s.dotGreen} />
            <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="📍 Pickup location..."
              value={pickup} onChangeText={(t) => { setPickup(t); searchPlaces(t, 'pickup'); }} />
          </View>
          {pickupSuggestions.length > 0 && (
            <View style={s.suggBox}>
              {pickupSuggestions.slice(0,4).map((s2, i) => (
                <TouchableOpacity key={i} style={s.suggItem}
                  onPress={() => { setPickup(s2.text); setPickupSuggestions([]); if(drop) fetchEta(s2.text, drop); }}>
                  <Text style={{ fontSize: 13 }}>📍 </Text>
                  <Text style={{ fontSize: 13, color: '#333', flex: 1 }} numberOfLines={1}>{s2.text}</Text>
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
          {dropSuggestions.length > 0 && (
            <View style={s.suggBox}>
              {dropSuggestions.slice(0,4).map((s2, i) => (
                <TouchableOpacity key={i} style={s.suggItem}
                  onPress={() => { setDrop(s2.text); setDropSuggestions([]); if(pickup) fetchEta(pickup, s2.text); }}>
                  <Text style={{ fontSize: 13 }}>🎯 </Text>
                  <Text style={{ fontSize: 13, color: '#333', flex: 1 }} numberOfLines={1}>{s2.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {eta ? (
          <View style={{ backgroundColor: '#e8f5e9', borderRadius: 10, padding: 10, marginBottom: 12, alignItems: 'center' }}>
            <Text style={{ color: '#2e7d32', fontWeight: '600' }}>🕐 {eta}</Text>
          </View>
        ) : null}
        <TouchableOpacity style={s.locationBtn} onPress={useMyLocation}>
          <Text style={{ color: '#2e7d32', fontWeight: '600', fontSize: 14 }}>📍 Meri Current Location Use Karo</Text>
        </TouchableOpacity>
        <View style={[s.row, { marginBottom: 14, backgroundColor: '#fff', borderRadius: 12, padding: 14 }]}>
          <Text style={[s.label, { flex: 1, marginBottom: 0 }]}>📅 Schedule karo?</Text>
          <Switch value={scheduleOn} onValueChange={setScheduleOn} trackColor={{ true: '#e94560', false: '#e0e0e0' }} />
        </View>
        {scheduleOn && <TextInput style={s.input} placeholder="Date & Time: e.g. 30 May, 9:00 AM" />}
        <Text style={s.secTitle}>Ride Type Choose Karo</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {RIDES.map(r => (
            <TouchableOpacity key={r.id} style={[s.rideCard, rideType===r.id && s.rideCardActive]}
              onPress={() => setRideType(r.id)}>
              <Text style={{ fontSize: 26 }}>{r.icon}</Text>
              <Text style={[{ fontSize: 13, fontWeight: '700', marginTop: 4 }, rideType===r.id ? { color: '#fff' } : { color: '#333' }]}>{r.label}</Text>
              <Text style={[{ fontSize: 11 }, rideType===r.id ? { color: '#ddd' } : { color: '#999' }]}>{r.eta}</Text>
              <Text style={[{ fontSize: 13, fontWeight: 'bold', marginTop: 2 }, rideType===r.id ? { color: '#fff' } : { color: '#e94560' }]}>₹{r.base}+</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={[s.row, { marginBottom: 14 }]}>
          <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="🎫 Promo code"
            value={promoCode} onChangeText={setPromoCode} />
          <TouchableOpacity style={s.applyBtn}>
            <Text style={{ color: '#e94560', fontWeight: 'bold' }}>Apply</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.secTitle}>Special Requests</Text>
        <View style={[s.row, { flexWrap: 'wrap', gap: 8, marginBottom: 16 }]}>
          {['🧳 Luggage','👶 Child Seat','♿ Accessible','🤫 Quiet'].map((sp,i) => (
            <TouchableOpacity key={i} style={s.specBtn}><Text style={{ fontSize: 13, color: '#555' }}>{sp}</Text></TouchableOpacity>
          ))}
        </View>
        {result ? <Text style={s.err}>{result}</Text> : null}
        <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={bookRide} disabled={loading}>
          <Text style={s.btnTxt}>{loading ? '🔍 Driver dhundh raha hai...' : 'Ride Book Karo 🚀'}</Text>
        </TouchableOpacity>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );

  // ══════════════════════════════════════════════
  //  MATCHING
  // ══════════════════════════════════════════════
  if (screen === 'matching') return (
    <View style={s.screen}>
      <MapWebView pickup={pickup} drop={drop}
        driverLat={driverLoc?.lat} driverLng={driverLoc?.lng} height={200} />
      <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
        {rideData?.driver ? (
          <FadeIn>
            <View style={s.driverCard}>
              <View style={s.driverAvatar}>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>{(rideData.driver.name||'D')[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.driverName}>{rideData.driver.name}</Text>
                <Text style={{ fontSize: 13, color: '#666', marginTop: 2 }}>🚗 {rideData.driver.vehicle_no}</Text>
                <Text style={{ fontSize: 13, color: '#f0a500', marginTop: 2 }}>⭐ 4.8 · 1,243 trips</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <PulseView><Text style={{ fontSize: 18, fontWeight: 'bold', color: '#e94560' }}>{eta ? eta.split('·')[0].trim() : '3 min'}</Text></PulseView>
                <Text style={{ fontSize: 11, color: '#666' }}>arriving</Text>
              </View>
            </View>
            {driverLoc && (
              <View style={s.liveLocCard}>
                <Text style={{ fontSize: 22, marginRight: 10 }}>📡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: '#1565c0', fontWeight: '600' }}>Driver Live Location</Text>
                  <Text style={{ fontSize: 12, color: '#1976d2', marginTop: 2 }}>📍 {driverLoc.lat.toFixed(4)}, {driverLoc.lng.toFixed(4)}</Text>
                  <Text style={{ fontSize: 11, color: '#90a4ae', marginTop: 2 }}>Updated {Math.round((Date.now() - driverLoc.updated) / 1000)}s ago</Text>
                </View>
              </View>
            )}
            {rideData?.startOtp && (
              <View style={s.otpCard}>
                <Text style={{ color: '#aaa', fontSize: 13, marginBottom: 8 }}>🔐 Driver ko yeh OTP batao</Text>
                <Text style={{ color: '#fff', fontSize: 36, fontWeight: 'bold', letterSpacing: 10 }}>{rideData.startOtp}</Text>
                <Text style={{ color: '#888', fontSize: 11, marginTop: 8 }}>Trip OTP daalne par hi shuru hogi</Text>
              </View>
            )}
            <View style={s.fareCard}>
              {[['Base fare','₹25'],['Distance',rideData.distance],['Total',rideData.fare]].map(([lbl,val],i) => (
                <View key={i} style={[s.row, { justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i<2 ? 1 : 0, borderBottomColor: '#f5f5f5' }]}>
                  <Text style={{ fontSize: 14, color: '#666' }}>{lbl}</Text>
                  <Text style={[{ fontSize: 14 }, i===2 && { fontWeight: 'bold', color: '#1a1a2e', fontSize: 16 }]}>{val}</Text>
                </View>
              ))}
            </View>
            <View style={s.actionRow}>
              {[['💬','Chat'],['📞','Call'],['📤','Share'],['🆘','SOS']].map(([icon,lbl],i) => (
                <TouchableOpacity key={i} style={s.actionBtn}
                  onPress={() => { if(lbl==='SOS') setSosActive(!sosActive); if(lbl==='Share') setShareOn(!shareOn); }}>
                  <Text style={{ fontSize: 24 }}>{icon}</Text>
                  <Text style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {sosActive && (
              <View style={[s.infoBox, { backgroundColor: '#ffeeee' }]}>
                <Text style={{ fontSize: 14, color: '#c62828', fontWeight: 'bold' }}>🆘 Emergency alert bheja ja raha hai!</Text>
                <Text style={{ fontSize: 13, color: '#c62828', marginTop: 4 }}>Police: 100 · Ambulance: 108</Text>
              </View>
            )}
            <Text style={{ textAlign: 'center', color: '#bbb', fontSize: 13, marginBottom: 20 }}>⏳ Driver OTP daalkar trip shuru karega...</Text>
          </FadeIn>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <RadarView />
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', marginTop: 24 }}>Driver dhundh rahe hain...</Text>
            <Text style={{ fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center' }}>{pickup} → {drop}</Text>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#e94560', marginTop: 12 }}>{rideData?.fare}</Text>
            {eta ? <Text style={{ fontSize: 14, color: '#4CAF50', marginTop: 6 }}>🕐 {eta}</Text> : null}
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
      <MapWebView pickup={pickup} drop={drop}
        driverLat={driverLoc?.lat} driverLng={driverLoc?.lng} height={240} />
      <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: '#1a1a2e', borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 12 }}>
          <PulseView><Text style={{ color: '#4CAF50', fontSize: 16, fontWeight: 'bold' }}>🚗 Ride Chal Rahi Hai</Text></PulseView>
          <Text style={{ color: '#aaa', fontSize: 13, marginTop: 6 }}>{rideData?.distance} · {rideData?.fare}</Text>
          {eta ? <Text style={{ color: '#4CAF50', fontSize: 13, marginTop: 4 }}>🕐 {eta}</Text> : null}
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 }}>
          <Text style={{ fontSize: 14, color: '#4CAF50', fontWeight: '600' }}>📍 {pickup}</Text>
          <Text style={{ fontSize: 18, textAlign: 'center', color: '#ddd', marginVertical: 8 }}>↓</Text>
          <Text style={{ fontSize: 14, color: '#e94560', fontWeight: '600' }}>🎯 {drop}</Text>
        </View>
        <View style={s.actionRow}>
          {[['💬','Chat'],['📞','Call'],['📤','Share'],['🆘','SOS']].map(([icon,lbl],i) => (
            <TouchableOpacity key={i} style={s.actionBtn} onPress={() => { if(lbl==='SOS') setSosActive(!sosActive); }}>
              <Text style={{ fontSize: 24 }}>{icon}</Text>
              <Text style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{lbl}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {sosActive && (
          <View style={[s.infoBox, { backgroundColor: '#ffeeee' }]}>
            <Text style={{ fontSize: 14, color: '#c62828', fontWeight: 'bold' }}>🆘 Emergency alert bheja ja raha hai!</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  // ══════════════════════════════════════════════
  //  PAYMENT
  // ══════════════════════════════════════════════
  if (screen === 'payment') return (
    <ScrollView style={s.screen} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={[s.hero, { paddingTop: 60 }]}>
        <Text style={{ fontSize: 60 }}>🎉</Text>
        <Text style={s.heroTitle}>Trip Complete!</Text>
        <Text style={s.heroSub}>{pickup} → {drop}</Text>
        <Animated.Text style={{ color: '#e94560', fontSize: 44, fontWeight: 'bold', marginTop: 8 }}>₹{fareCount}</Animated.Text>
      </View>
      <View style={s.card}>
        <Text style={[s.secTitle, { textAlign: 'center' }]}>Payment Method Choose Karo</Text>
        <TouchableOpacity style={[s.payBtn, { backgroundColor: '#e94560' }]} onPress={payWithWallet}>
          <Text style={{ fontSize: 20 }}>💰</Text>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Wallet se Pay</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>Balance: ₹{walletBalance}</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 18 }}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.payBtn, { backgroundColor: '#1a1a2e' }]} onPress={handlePayment}>
          <Text style={{ fontSize: 20 }}>💳</Text>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Online Pay</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>UPI / Card / Net Banking</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 18 }}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.payBtn, { backgroundColor: '#4CAF50' }]}
          onPress={() => { setPaymentDone(true); setScreen('postride'); createScratchCard(); }}>
          <Text style={{ fontSize: 20 }}>💵</Text>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Cash Pay</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>Driver ko cash do</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 18 }}>→</Text>
        </TouchableOpacity>
        {result ? <Text style={s.err}>{result}</Text> : null}
      </View>
    </ScrollView>
  );

  // ══════════════════════════════════════════════
  //  POST-RIDE
  // ══════════════════════════════════════════════
  if (screen === 'postride') return (
    <ScrollView style={s.screen} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View style={[s.hero, { paddingTop: 50 }]}>
        <Text style={{ fontSize: 55 }}>{paymentDone ? '✅' : '🎉'}</Text>
        <Text style={s.heroTitle}>{paymentDone ? 'Payment Done!' : 'Pahunch Gaye!'}</Text>
        <Text style={s.heroSub}>{pickup} → {drop}</Text>
        <Text style={{ color: '#e94560', fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>{rideData?.fare}</Text>
      </View>
      {scratchCard && (
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Animated.View style={{ transform: [{ scale: scratched ? 1 : scratchAnim }] }}>
            <TouchableOpacity activeOpacity={0.85} onPress={scratchNow}
              style={[s.scratchCard, { backgroundColor: scratched ? '#fff' : '#f0a500' }]}>
              {scratched ? (
                <FadeIn style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 44 }}>🎉</Text>
                  <Text style={{ fontSize: 15, color: '#888', marginTop: 8 }}>Aapko mila reward!</Text>
                  <Text style={{ fontSize: 44, fontWeight: 'bold', color: '#4CAF50', marginTop: 4 }}>₹{scratchCard.reward}</Text>
                  <Text style={{ fontSize: 13, color: '#4CAF50', marginTop: 6, fontWeight: '600' }}>✅ Wallet mein add ho gaya!</Text>
                </FadeIn>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 44 }}>🎟️</Text>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 8 }}>Scratch Card Jeeta!</Text>
                  <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 6 }}>👆 Tap karke scratch karo</Text>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6, marginTop: 10 }}>
                    <Text style={{ color: '#fff', fontSize: 12 }}>₹1 se ₹100 tak jeeto!</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
      <View style={[s.card, { marginTop: 16 }]}>
        <Text style={[s.secTitle, { textAlign: 'center' }]}>Driver ko Rate Karo</Text>
        <View style={[s.row, { justifyContent: 'center', marginBottom: 16 }]}>
          {[1,2,3,4,5].map(star => (
            <TouchableOpacity key={star} onPress={() => { setRating(star); animateStar(star-1); }} style={{ padding: 4 }}>
              <Animated.Text style={{ fontSize: 38, color: star<=rating ? '#f0a500' : '#e0e0e0', transform: [{ scale: starAnims[star-1] }] }}>★</Animated.Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={[s.row, { flexWrap: 'wrap', gap: 8, marginBottom: 14, justifyContent: 'center' }]}>
          {['✅ Sahi route','😊 Friendly','🚗 Clean','⏰ On time'].map((t,i) => (
            <TouchableOpacity key={i} style={s.specBtn}><Text style={{ fontSize: 13, color: '#555' }}>{t}</Text></TouchableOpacity>
          ))}
        </View>
        <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]}
          placeholder="Comment (optional)..." multiline value={review} onChangeText={setReview} />
        <Text style={s.secTitle}>💰 Tip do (optional)</Text>
        <View style={[s.row, { gap: 8, marginBottom: 16 }]}>
          {[0,10,20,50].map(t => (
            <TouchableOpacity key={t} style={[s.tipBtn, tip===t && { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' }]}
              onPress={() => setTip(t)}>
              <Text style={[{ fontSize: 14, fontWeight: '600', color: '#555' }, tip===t && { color: '#fff' }]}>{t===0 ? 'Skip' : '₹'+t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.btn} onPress={async () => {
          // Save rating
          if (rating > 0 && rideData?.ride_id) {
            try {
              await fetch(`${API}/api/rides/rate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ride_id: rideData.ride_id, rating, review, tip })
              });
            } catch (_e) {}
          }
          setScreen('home'); setPickup(''); setDrop(''); setRating(0); setTab('home');
          setRideData(null); setPaymentDone(false); setResult('');
          setScratchCard(null); setScratched(false); setEta('');
          loadHistoryFn(phone); loadWalletFn(phone);
        }}>
          <Text style={s.btnTxt}>Done 🏠 Home Jao</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 30 }} />
    </ScrollView>
  );

  return <View />;
}

const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: '#f5f5f5' },
  hero:          { backgroundColor: '#1a1a2e', alignItems: 'center', padding: 50, paddingBottom: 36 },
  heroIcon:      { fontSize: 56 },
  heroTitle:     { color: '#fff', fontSize: 26, fontWeight: 'bold', marginTop: 10 },
  heroSub:       { color: '#aaa', fontSize: 14, marginTop: 6, textAlign: 'center' },
  card:          { margin: 16, backgroundColor: '#fff', borderRadius: 20, padding: 22, elevation: 4 },
  input:         { borderWidth: 1.5, borderColor: '#efefef', borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: '#fafafa', marginBottom: 12 },
  label:         { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  btn:           { backgroundColor: '#e94560', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 6, marginBottom: 12, elevation: 3 },
  btnTxt:        { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  err:           { textAlign: 'center', color: '#e94560', fontWeight: '600', marginBottom: 10 },
  hint:          { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  back:          { textAlign: 'center', color: '#e94560', marginTop: 16, fontSize: 14 },
  terms:         { textAlign: 'center', color: '#bbb', fontSize: 11, marginTop: 12 },
  otpInput:      { fontSize: 26, letterSpacing: 12, textAlign: 'center', fontWeight: 'bold' },
  row:           { flexDirection: 'row', alignItems: 'center' },
  flag:          { fontSize: 14, padding: 14, backgroundColor: '#f5f5f5', borderRadius: 12, borderWidth: 1.5, borderColor: '#efefef', marginRight: 8 },
  topBar:        { backgroundColor: '#1a1a2e', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 48 },
  topTitle:      { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  backBtn:       { width: 40, alignItems: 'flex-start' },
  greeting:      { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  subTxt:        { color: '#aaa', fontSize: 12, marginTop: 2 },
  avatar:        { width: 42, height: 42, borderRadius: 21, backgroundColor: '#e94560', alignItems: 'center', justifyContent: 'center' },
  avatarTxt:     { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  searchBox:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 4, marginBottom: 14, borderWidth: 1, borderColor: '#f0f0f0' },
  searchIcon:    { fontSize: 18, marginRight: 10 },
  searchPh:      { color: '#bbb', fontSize: 15 },
  quickRow:      { flexDirection: 'row', gap: 10, marginBottom: 16 },
  quickBtn:      { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 2 },
  quickIcon:     { fontSize: 24 },
  quickLbl:      { fontSize: 11, color: '#666', marginTop: 4, fontWeight: '500' },
  secTitle:      { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 12, marginTop: 4 },
  recentItem:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2 },
  recentRoute:   { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  recentDate:    { fontSize: 12, color: '#999', marginTop: 2 },
  recentFare:    { fontSize: 15, fontWeight: 'bold', color: '#e94560' },
  promoBanner:   { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, marginBottom: 16 },
  promoTxt:      { color: '#fff', fontSize: 13, textAlign: 'center' },
  nav:           { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingBottom: 12, paddingTop: 4 },
  navItem:       { flex: 1, alignItems: 'center', paddingTop: 8 },
  navIcon:       { fontSize: 22 },
  navLbl:        { fontSize: 11, color: '#bbb', marginTop: 2 },
  navActive:     { color: '#e94560', fontWeight: 'bold' },
  histCard:      { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2 },
  histIcon:      { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  profileHero:   { backgroundColor: '#1a1a2e', borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 16, elevation: 4 },
  profileAvatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#e94560', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  profileName:   { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  profilePhone:  { color: '#aaa', fontSize: 14, marginTop: 4 },
  badge:         { backgroundColor: '#f0a500', borderRadius: 12, paddingVertical: 5, paddingHorizontal: 14, marginTop: 10 },
  walletCard:    { backgroundColor: '#e94560', borderRadius: 18, padding: 22, marginBottom: 14, elevation: 4 },
  walletBox:     { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 14, elevation: 2 },
  amtBtn:        { flex: 1, minWidth: 70, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#e94560', alignItems: 'center', backgroundColor: '#fff8f8' },
  menuItem:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, elevation: 1 },
  menuIconBox:   { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  logoutBtn:     { borderWidth: 1.5, borderColor: '#e94560', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 30 },
  locBox:        { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 4, elevation: 3 },
  dotGreen:      { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4CAF50', marginRight: 12 },
  dotRed:        { width: 12, height: 12, borderRadius: 6, backgroundColor: '#e94560', marginRight: 12 },
  locDivider:    { height: 1, backgroundColor: '#f0f0f0', marginVertical: 10, marginLeft: 24 },
  locationBtn:   { backgroundColor: '#e8f5e9', borderRadius: 12, padding: 14, marginBottom: 14, alignItems: 'center', borderWidth: 1, borderColor: '#c8e6c9', marginTop: 8 },
  suggBox:       { backgroundColor: '#fff', borderRadius: 12, marginTop: 4, marginBottom: 4, elevation: 6, borderWidth: 1, borderColor: '#f0f0f0' },
  suggItem:      { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  rideCard:      { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginRight: 10, alignItems: 'center', minWidth: 90, elevation: 2, borderWidth: 2, borderColor: 'transparent' },
  rideCardActive:{ backgroundColor: '#1a1a2e', borderColor: '#e94560' },
  applyBtn:      { padding: 14, borderWidth: 1.5, borderColor: '#e94560', borderRadius: 12, justifyContent: 'center', marginLeft: 8 },
  specBtn:       { backgroundColor: '#fff', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e8e8e8' },
  driverCard:    { backgroundColor: '#fff', borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 12, elevation: 4 },
  driverAvatar:  { width: 54, height: 54, borderRadius: 27, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  driverName:    { fontSize: 17, fontWeight: 'bold', color: '#1a1a2e' },
  liveLocCard:   { backgroundColor: '#e3f2fd', borderRadius: 14, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  otpCard:       { backgroundColor: '#1a1a2e', borderRadius: 18, padding: 22, alignItems: 'center', marginBottom: 14 },
  fareCard:      { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 12, elevation: 2 },
  actionRow:     { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  actionBtn:     { alignItems: 'center', padding: 4 },
  infoBox:       { backgroundColor: '#e8f5e9', borderRadius: 12, padding: 14, marginBottom: 12 },
  payBtn:        { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 18, marginBottom: 12, elevation: 3 },
  scratchCard:   { borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 4, elevation: 6 },
  tipBtn:        { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#e0e0e0', alignItems: 'center', backgroundColor: '#fafafa' },
});
