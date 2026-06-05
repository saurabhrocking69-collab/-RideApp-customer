import { useState, useEffect, useRef } from 'react';
import RazorpayCheckout from 'react-native-razorpay';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Switch, Animated, KeyboardAvoidingView, Platform, Linking, Share
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';

const MAPS_KEY = 'AIzaSyAK3HFrZsahMLNVUFgxGAQMw_6OATDD8q4';
const API = 'https://rideapp-backend-production-5e1c.up.railway.app';

type Screen = 'login' | 'otp' | 'home' | 'booking' | 'matching' | 'inride' | 'payment' | 'postride' | 'chat' | 'referral' | 'saved';

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

const FadeIn = ({ children, style, delay = 0 }: any) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(anim, { toValue: 1, duration: 400, delay, useNativeDriver: true }).start(); }, []);
  return <Animated.View style={[style, { opacity: anim }]}>{children}</Animated.View>;
};

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
          position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: '#e94560',
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

const MapWebView = ({ pickup, drop, userLat, userLng, height = 200 }: any) => {
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
  const [pickupCoords, setPickupCoords] = useState<any>(null);
  const [dropCoords, setDropCoords]   = useState<any>(null);
  const [rideType, setRideType]       = useState('auto');
  const [result, setResult]           = useState('');
  const [loading, setLoading]         = useState(false);
  const [rideData, setRideData]       = useState<any>(null);
  const [rating, setRating]           = useState(0);
  const [sosActive, setSosActive]     = useState(false);
  const [tab, setTab]                 = useState('home');
  const [promoCode, setPromoCode]     = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
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
  const [chatMsgs, setChatMsgs]       = useState<any[]>([]);
  const [chatInput, setChatInput]     = useState('');
  const [unreadChat, setUnreadChat]   = useState(0);
  const lastChatCount = useRef(0);
  const [referralData, setReferralData] = useState<any>(null);
  const [referralInput, setReferralInput] = useState('');
  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const scratchAnim = useRef(new Animated.Value(1)).current;
  const starAnims   = useRef([0,1,2,3,4].map(() => new Animated.Value(1))).current;

  useEffect(() => {
    (async () => {
      try {
        const sp = await AsyncStorage.getItem('userPhone');
        const sn = await AsyncStorage.getItem('userName');
        if (sp) { setPhone(sp); setUserName(sn || 'Rider'); setScreen('home'); loadHistory(sp); loadWallet(sp); }
      } catch (_e) {}
    })();
  }, []);

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

  useEffect(() => {
    if (screen !== 'chat' || !rideData?.ride_id) return;
    const load = async () => {
      try { const r = await fetch(`${API}/api/chat/${rideData.ride_id}`); const d = await r.json(); setChatMsgs(d.messages || []); lastChatCount.current = (d.messages || []).length; setUnreadChat(0); } catch (_e) {}
    };
    load();
    const iv = setInterval(load, 2500);
    return () => clearInterval(iv);
  }, [screen, rideData?.ride_id]);

  // Background chat — unread badge during ride
  useEffect(() => {
    if (!['matching','inride'].includes(screen) || !rideData?.ride_id) return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/chat/${rideData.ride_id}`);
        const d = await r.json();
        const msgs = d.messages || [];
        if (msgs.length > lastChatCount.current) setUnreadChat(msgs.length - lastChatCount.current);
      } catch (_e) {}
    }, 3000);
    return () => clearInterval(iv);
  }, [screen, rideData?.ride_id]);

  useEffect(() => {
    if (!scratchCard || scratched) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(scratchAnim, { toValue: 1.06, duration: 600, useNativeDriver: true }),
      Animated.timing(scratchAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [scratchCard, scratched]);

  useEffect(() => {
    if (screen !== 'payment' || !rideData?.fare) return;
    const target = parseInt(String(rideData.fare).replace(/[^0-9]/g, '')) || 0;
    let cur = 0; const step = Math.ceil(target / 30);
    const t = setInterval(() => { cur = Math.min(cur + step, target); setFareCount(cur); if (cur >= target) clearInterval(t); }, 40);
    return () => clearInterval(t);
  }, [screen]);

  const loadHistory = async (ph: string) => {
    try { const r = await fetch(`${API}/api/rides/history?phone=${ph}`); const d = await r.json(); setHistoryRides(d.rides || []); } catch (_e) {}
  };
  const loadWallet = async (ph: string) => {
    try { const r = await fetch(`${API}/api/wallet/balance?phone=${ph}`); const d = await r.json(); setWalletBalance(d.balance || 0); } catch (_e) {}
  };
  const loadReferral = async () => {
    try { const r = await fetch(`${API}/api/referral/my-code?phone=${phone}`); const d = await r.json(); setReferralData(d); } catch (_e) {}
  };
  const loadSaved = async () => {
    try { const r = await fetch(`${API}/api/places/saved?phone=${phone}`); const d = await r.json(); setSavedPlaces(d.places || []); } catch (_e) {}
  };

  const searchPlaces = async (text: string, type: 'pickup' | 'drop') => {
    if (text.length < 3) { type === 'pickup' ? setPickupSugg([]) : setDropSugg([]); return; }
    try {
      const res  = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${MAPS_KEY}&components=country:in&location=26.8467,80.9462&radius=50000`);
      const data = await res.json();
      const sugg = data.predictions?.map((p: any) => ({ id: p.place_id, text: p.description })) || [];
      type === 'pickup' ? setPickupSugg(sugg) : setDropSugg(sugg);
    } catch (_e) {}
  };

  const geocodePlace = async (address: string, type: 'pickup' | 'drop') => {
    try {
      const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`);
      const data = await res.json();
      const loc  = data.results?.[0]?.geometry?.location;
      if (loc) { type === 'pickup' ? setPickupCoords({ lat: loc.lat, lng: loc.lng }) : setDropCoords({ lat: loc.lat, lng: loc.lng }); }
    } catch (_e) {}
  };

  const fetchEta = async (origin: string, dest: string) => {
    try {
      const res  = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(dest)}&key=${MAPS_KEY}`);
      const data = await res.json();
      const el   = data.rows?.[0]?.elements?.[0];
      if (el?.status === 'OK') { setEta(el.duration.text + ' · ' + el.distance.text); return el.distance.value / 1000; }
    } catch (_e) {}
    return 5;
  };

  const applyPromo = async () => {
    if (!promoCode) return;
    try {
      const res  = await fetch(`${API}/api/promo/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: promoCode, fare: 100, phone }) });
      const data = await res.json();
      if (data.valid) { setPromoDiscount(data.discount); setResult(`✅ ${data.message}`); }
      else { setPromoDiscount(0); setResult('❌ ' + data.message); }
    } catch (_e) { setResult('❌ Error'); }
  };

  const createScratchCard = async () => {
    try { const res = await fetch(`${API}/api/scratch-card/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone || '9999999999', ride_id: rideData?.ride_id }) }); const data = await res.json(); if (data.success) { setScratchCard(data); setScratched(false); } } catch (_e) {}
  };
  const scratchNow = async () => {
    if (!scratchCard || scratched) return;
    scratchAnim.stopAnimation(); setScratched(true);
    try { await fetch(`${API}/api/scratch-card/scratch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ card_id: scratchCard.card_id, phone: phone || '9999999999' }) }); loadWallet(phone); } catch (_e) {}
  };

  const addMoney = async (amt: number) => {
    try { const res = await fetch(`${API}/api/wallet/add`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone || '9999999999', amount: amt }) }); const data = await res.json(); if (data.success) { setWalletBalance(data.balance); setResult(`✅ ₹${amt} add ho gaya!`); } } catch (_e) { setResult('❌ Error'); }
  };
  const payWithWallet = async () => {
    const fareNum = parseInt(String(rideData?.fare).replace(/[^0-9]/g, '')) || 0;
    if (walletBalance < fareNum) { setResult(`❌ Balance kam hai! ₹${walletBalance} hai`); return; }
    try { const res = await fetch(`${API}/api/wallet/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone || '9999999999', amount: fareNum, ride_id: rideData.ride_id }) }); const data = await res.json(); if (data.success) { setWalletBalance(data.balance); setPaymentDone(true); setScreen('postride'); createScratchCard(); } else setResult('❌ ' + (data.message || 'Payment fail')); } catch (_e) { setResult('❌ Server error'); }
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

  const useMyLocation = async () => {
    setResult('📍 Location le rahe hain...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setResult('❌ Location permission do'); return; }
      const loc = await Location.getCurrentPositionAsync({});
      setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setPickupCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo[0]) { const a = geo[0]; setPickup([a.name, a.street, a.city].filter(Boolean).join(', ')); setResult('✅ Location mil gayi!'); }
    } catch (_e) { setResult('❌ Location error'); }
  };

  const bookRide = async () => {
    if (!pickup || !drop) { setResult('❌ Pickup aur Drop likho!'); return; }
    setLoading(true); setPaymentDone(false);
    try {
      const distanceKm = await fetchEta(pickup, drop);
      if (!dropCoords) await geocodePlace(drop, 'drop');
      const res  = await fetch(`${API}/api/rides/book`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passenger_phone: phone || '9999999999', pickup, drop_location: drop, ride_type: rideType, distance: distanceKm,
          pickup_lat: pickupCoords?.lat, pickup_lng: pickupCoords?.lng, drop_lat: dropCoords?.lat, drop_lng: dropCoords?.lng,
          discount: promoDiscount, promo_code: promoDiscount > 0 ? promoCode : null
        })
      });
      const data = await res.json();
      if (promoDiscount > 0 && data.ride_id) {
        try { await fetch(`${API}/api/promo/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: promoCode, phone, ride_id: data.ride_id, discount: promoDiscount }) }); } catch (_e) {}
      }
      setRideData(data); setScreen('matching'); setResult('');
    } catch { setResult('❌ Server connect nahi hua!'); }
    setLoading(false);
  };

  const sendOtp = async () => {
    if (!phone || phone.length < 10) { setResult('❌ Sahi phone number likho'); return; }
    setLoading(true);
    try { const res = await fetch(`${API}/api/auth/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) }); const data = await res.json(); setOtpSent(data.otp || ''); setScreen('otp'); setResult(''); } catch { setResult('❌ Server connect nahi hua'); }
    setLoading(false);
  };
  const verifyOtp = async () => {
    if (!otp) { setResult('❌ OTP likho'); return; }
    setLoading(true);
    try { const res = await fetch(`${API}/api/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, otp, name: userName || 'Rider' }) }); const data = await res.json(); if (data.token) { await AsyncStorage.setItem('userPhone', phone); await AsyncStorage.setItem('userName', userName || 'Rider'); setScreen('home'); setResult(''); loadHistory(phone); loadWallet(phone); } else setResult('❌ ' + (data.error || 'OTP galat hai')); } catch { setResult('❌ Server connect nahi hua'); }
    setLoading(false);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !rideData?.ride_id) return;
    const msg = chatInput; setChatInput('');
    try { await fetch(`${API}/api/chat/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, sender: 'customer', message: msg }) }); const r = await fetch(`${API}/api/chat/${rideData.ride_id}`); const d = await r.json(); setChatMsgs(d.messages || []); } catch (_e) {}
  };

  const callDriver = () => { if (rideData?.driver?.phone) Linking.openURL(`tel:${rideData.driver.phone}`); };

  const triggerSOS = async () => {
    setSosActive(true);
    try { await fetch(`${API}/api/sos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, ride_id: rideData?.ride_id, lat: userCoords?.latitude, lng: userCoords?.longitude, type: 'emergency' }) }); } catch (_e) {}
  };

  const applyReferral = async () => {
    if (!referralInput.trim()) return;
    try { const res = await fetch(`${API}/api/referral/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, referral_code: referralInput }) }); const data = await res.json(); setResult(data.success ? '✅ ' + data.message : '❌ ' + data.message); if (data.success) { loadWallet(phone); loadReferral(); setReferralInput(''); } } catch (_e) { setResult('❌ Error'); }
  };
  const shareReferral = async () => {
    if (!referralData?.code) return;
    try { await Share.share({ message: `🚖 RideApp join karo aur ₹50 pao! Mera referral code: ${referralData.code}` }); } catch (_e) {}
  };

  const savePlace = async (label: string) => {
    if (!pickup) { setResult('❌ Pehle location set karo'); return; }
    try { await fetch(`${API}/api/places/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, label, address: pickup, lat: pickupCoords?.lat, lng: pickupCoords?.lng }) }); loadSaved(); setResult(`✅ ${label} save ho gaya!`); } catch (_e) {}
  };
  const deletePlace = async (id: number) => {
    try { await fetch(`${API}/api/places/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); loadSaved(); } catch (_e) {}
  };

  const animateStar = (i: number) => {
    Animated.sequence([
      Animated.timing(starAnims[i], { toValue: 1.5, duration: 120, useNativeDriver: true }),
      Animated.timing(starAnims[i], { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const rideIcon = (type: string) => type === 'auto' ? '🛺' : type === 'bike' ? '🏍️' : type === 'eriksha' ? '🛵' : '🚕';

  const RIDES = [
    { id: 'auto',    icon: '🛺', label: 'Auto',    base: 25, rate: 12, eta: '3-5 min' },
    { id: 'bike',    icon: '🏍️', label: 'Bike',    base: 15, rate: 8,  eta: '2-3 min', tag: 'FASTER' },
    { id: 'car',     icon: '🚕', label: 'Car',      base: 40, rate: 15, eta: '5-7 min' },
    { id: 'eriksha', icon: '🛵', label: 'E-Riksha', base: 20, rate: 10, eta: '4-6 min' },
  ];


  // ═══ LOGIN ═══
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

  // ═══ OTP ═══
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

  // ═══ HOME — Map full background, content bottom sheet ═══
  if (screen === 'home' && tab === 'home') return (
    <View style={s.screen}>
      {/* Full screen map background */}
      <View style={s.mapFull}>
        <MapWebView pickup={pickup || 'Lucknow,India'} drop="" userLat={userCoords?.latitude} userLng={userCoords?.longitude} height={900} />
      </View>
      {/* Top transparent bar */}
      <View style={s.topOverlay}>
        <View style={s.topGlass}>
          <View style={{ flex: 1 }}>
            <Text style={s.greetingDark}>Namaste 👋 {userName || 'Rider'}</Text>
            <Text style={s.subTxtDark}>📍 Lucknow, UP</Text>
          </View>
          <TouchableOpacity style={s.avatar} onPress={() => { setTab('profile'); loadWallet(phone); }}>
            <Text style={s.avatarTxt}>{(userName || 'R')[0].toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Bottom sheet */}
      <View style={s.bottomSheet}>
        <View style={s.sheetHandle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
          <TouchableOpacity style={s.searchBox} onPress={() => setScreen('booking')}>
            <Text style={s.searchIcon}>🔍</Text>
            <Text style={s.searchPh}>Kahan jaana hai?</Text>
          </TouchableOpacity>
          <View style={s.quickRow}>
            {[['🏠','Home'],['💼','Office'],['🎁','Refer'],['📍','Saved']].map(([icon,label],i) => (
              <TouchableOpacity key={i} style={s.quickBtn} onPress={() => {
                if (label === 'Refer') { loadReferral(); setScreen('referral'); }
                else if (label === 'Saved') { loadSaved(); setScreen('saved'); }
                else setScreen('booking');
              }}>
                <Text style={s.quickIcon}>{icon}</Text>
                <Text style={s.quickLbl}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={s.promoBanner} onPress={() => { loadReferral(); setScreen('referral'); }}>
            <Text style={s.promoTxt}>🎁 Dost ko refer karo, dono ko ₹50 milega!</Text>
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
      <View style={s.navFloat}><NavBarInner /></View>
    </View>
  );

  // ═══ HISTORY ═══
  if (screen === 'home' && tab === 'history') return (
    <View style={s.screen}>
      <View style={s.topBar}><Text style={s.topTitle}>🕐 My Trips</Text></View>
      <ScrollView style={{ flex: 1, padding: 14 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {historyRides.length === 0
          ? <View style={{ alignItems: 'center', marginTop: 60 }}><Text style={{ fontSize: 56 }}>🚗</Text><Text style={{ fontSize: 17, color: '#333', marginTop: 14, fontWeight: '600' }}>Abhi koi trip nahi</Text></View>
          : historyRides.map((h, i) => (
            <View key={i} style={s.histCard}>
              <View style={s.row}>
                <View style={s.histIcon}><Text style={{ fontSize: 20 }}>{rideIcon(h.ride_type)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.recentRoute} numberOfLines={1}>{h.pickup} → {h.drop_location}</Text>
                  <Text style={s.recentDate}>{new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · <Text style={{ color: h.status === 'completed' ? '#4CAF50' : h.status === 'cancelled' ? '#e94560' : '#f0a500' }}>{h.status}</Text></Text>
                </View>
                <Text style={s.recentFare}>₹{h.fare}</Text>
              </View>
            </View>
          ))
        }
      </ScrollView>
      <View style={s.navFloat}><NavBarInner /></View>
    </View>
  );

  // ═══ PROFILE ═══
  if (screen === 'home' && tab === 'profile') return (
    <View style={s.screen}>
      <View style={s.topBar}><Text style={s.topTitle}>👤 Profile</Text></View>
      <ScrollView style={{ flex: 1, padding: 14 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        <View style={s.profileHero}>
          <View style={s.profileAvatar}><Text style={{ color: '#fff', fontSize: 34, fontWeight: 'bold' }}>{(userName||'R')[0].toUpperCase()}</Text></View>
          <Text style={s.profileName}>{userName || 'Rider'}</Text>
          <Text style={s.profilePhone}>+91 {phone}</Text>
          <View style={s.badge}><Text style={{ color: '#fff', fontWeight: 'bold' }}>⭐ 4.9 Rating</Text></View>
        </View>
        <TouchableOpacity style={s.walletCard} onPress={() => { setShowWallet(!showWallet); loadWallet(phone); }}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>💰 Wallet Balance</Text>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: 'bold', marginTop: 2 }}>₹{walletBalance}</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 10 }}><Text style={{ color: '#fff', fontWeight: '700' }}>{showWallet ? '✕' : '+ Add'}</Text></View>
          </View>
        </TouchableOpacity>
        {showWallet && (
          <View style={s.walletBox}>
            <Text style={s.secTitle}>💰 Paisa Add Karo</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[100, 200, 500, 1000].map(amt => (
                <TouchableOpacity key={amt} style={s.amtBtn} onPress={() => addMoney(amt)}><Text style={{ color: '#1a1a2e', fontWeight: 'bold', fontSize: 15 }}>₹{amt}</Text></TouchableOpacity>
              ))}
            </View>
            {result ? <Text style={{ color: '#4CAF50', textAlign: 'center', fontWeight: '600', marginTop: 8 }}>{result}</Text> : null}
          </View>
        )}
        <TouchableOpacity style={s.menuItem} onPress={() => { loadReferral(); setScreen('referral'); }}>
          <View style={s.menuIconBox}><Text style={{ fontSize: 18 }}>🎁</Text></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Refer & Earn</Text><Text style={{ fontSize: 11, color: '#999' }}>Dost ko bulao, ₹50 pao</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.menuItem} onPress={() => { loadSaved(); setScreen('saved'); }}>
          <View style={s.menuIconBox}><Text style={{ fontSize: 18 }}>📍</Text></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Saved Places</Text><Text style={{ fontSize: 11, color: '#999' }}>Home, Office save karo</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </TouchableOpacity>
        {[['🎫','Promo Codes','RIDE50, FLAT20'],['🔔','Notifications','Alerts'],['🛡️','Safety','Emergency'],['📞','Support','24x7 help']].map(([icon,title,sub],i) => (
          <TouchableOpacity key={i} style={s.menuItem}>
            <View style={s.menuIconBox}><Text style={{ fontSize: 18 }}>{icon}</Text></View>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>{title}</Text><Text style={{ fontSize: 11, color: '#999' }}>{sub}</Text></View>
            <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.logoutBtn} onPress={async () => { await AsyncStorage.removeItem('userPhone'); await AsyncStorage.removeItem('userName'); setScreen('login'); setTab('home'); setPhone(''); setOtp(''); setWalletBalance(0); }}>
          <Text style={{ color: '#e94560', fontWeight: 'bold', fontSize: 14 }}>🚪 Logout</Text>
        </TouchableOpacity>
      </ScrollView>
      <View style={s.navFloat}><NavBarInner /></View>
    </View>
  );

  // ═══ REFERRAL ═══
  if (screen === 'referral') return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></TouchableOpacity>
        <Text style={s.topTitle}>🎁 Refer & Earn</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ backgroundColor: '#1a1a2e', borderRadius: 18, padding: 24, alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 50 }}>🎁</Text>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 8 }}>Dono ko ₹50 milega!</Text>
          <Text style={{ color: '#aaa', fontSize: 13, marginTop: 6, textAlign: 'center' }}>Apna code share karo. Jab dost first ride karega, dono ko ₹50 wallet mein!</Text>
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center', elevation: 2 }}>
          <Text style={{ fontSize: 13, color: '#888' }}>Aapka Referral Code</Text>
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#e94560', letterSpacing: 3, marginVertical: 10 }}>{referralData?.code || '...'}</Text>
          <TouchableOpacity style={[s.btn, { marginTop: 0, marginBottom: 0, width: '100%' }]} onPress={shareReferral}>
            <Text style={s.btnTxt}>📤 Share Karo</Text>
          </TouchableOpacity>
        </View>
        <View style={s.row}>
          <View style={[s.statBox, { marginRight: 8 }]}><Text style={s.statNum}>{referralData?.total_referrals || 0}</Text><Text style={s.statLbl}>Total Referrals</Text></View>
          <View style={[s.statBox, { marginLeft: 8 }]}><Text style={s.statNum}>₹{referralData?.total_earned || 0}</Text><Text style={s.statLbl}>Total Earned</Text></View>
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, marginTop: 16, elevation: 2 }}>
          <Text style={s.secTitle}>Kisi ka code hai? Yahan daalo</Text>
          <View style={s.row}>
            <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Referral code" autoCapitalize="characters" value={referralInput} onChangeText={setReferralInput} />
            <TouchableOpacity style={s.applyBtn} onPress={applyReferral}><Text style={{ color: '#e94560', fontWeight: 'bold' }}>Apply</Text></TouchableOpacity>
          </View>
          {result ? <Text style={[s.err, { marginTop: 10, color: result.includes('✅') ? '#4CAF50' : '#e94560' }]}>{result}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );

  // ═══ SAVED PLACES ═══
  if (screen === 'saved') return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></TouchableOpacity>
        <Text style={s.topTitle}>📍 Saved Places</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ backgroundColor: '#e3f2fd', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, color: '#1565c0' }}>💡 Booking screen se pickup set karke yahan aao, phir save karo.</Text>
        </View>
        {pickup ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, elevation: 2 }}>
            <Text style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Current location:</Text>
            <Text style={{ fontSize: 14, color: '#1a1a2e', marginBottom: 12 }}>{pickup}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {['🏠 Home','💼 Office','📍 Other'].map((lbl, i) => (
                <TouchableOpacity key={i} style={{ flex: 1, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 10, alignItems: 'center' }} onPress={() => savePlace(lbl.split(' ')[1])}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <Text style={{ color: '#999', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>Pehle booking screen se pickup location set karo</Text>
        )}
        {result ? <Text style={{ color: '#4CAF50', textAlign: 'center', marginBottom: 12 }}>{result}</Text> : null}
        <Text style={s.secTitle}>Saved Locations</Text>
        {savedPlaces.length === 0
          ? <Text style={{ color: '#999', fontSize: 13 }}>Koi saved place nahi</Text>
          : savedPlaces.map((p, i) => (
            <View key={i} style={s.menuItem}>
              <View style={s.menuIconBox}><Text style={{ fontSize: 18 }}>{p.label === 'Home' ? '🏠' : p.label === 'Office' ? '💼' : '📍'}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>{p.label}</Text><Text style={{ fontSize: 11, color: '#999' }} numberOfLines={1}>{p.address}</Text></View>
              <TouchableOpacity onPress={() => deletePlace(p.id)}><Text style={{ fontSize: 18 }}>🗑️</Text></TouchableOpacity>
            </View>
          ))
        }
      </ScrollView>
    </View>
  );

  // ═══ CHAT ═══
  if (screen === 'chat') return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('matching')} style={s.backBtn}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></TouchableOpacity>
        <Text style={s.topTitle}>💬 {rideData?.driver?.name || 'Driver'}</Text>
        <TouchableOpacity onPress={callDriver} style={{ width: 36, alignItems: 'flex-end' }}><Text style={{ fontSize: 20 }}>📞</Text></TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1, padding: 14 }} contentContainerStyle={{ paddingBottom: 10 }}>
        {chatMsgs.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 13 }}>Koi message nahi — pehla message bhejo!</Text>
        ) : chatMsgs.map((m, i) => (
          <View key={i} style={[s.chatBubble, m.sender === 'customer' ? s.chatMine : s.chatTheirs]}>
            <Text style={{ color: m.sender === 'customer' ? '#fff' : '#1a1a2e', fontSize: 14 }}>{m.message}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={s.chatInputRow}>
        <TextInput style={s.chatInput} placeholder="Message likho..." value={chatInput} onChangeText={setChatInput} onSubmitEditing={sendChat} />
        <TouchableOpacity style={s.chatSend} onPress={sendChat}><Text style={{ color: '#fff', fontWeight: 'bold' }}>➤</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  // ═══ BOOKING — Map full bg + bottom sheet ═══
  if (screen === 'booking') return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.mapFull}>
        <MapWebView pickup={pickup} drop={drop} height={900} />
      </View>
      <View style={s.topOverlay}>
        <View style={s.topGlass}>
          <TouchableOpacity onPress={() => setScreen('home')} style={s.backCircle}><Text style={{ color: '#1a1a2e', fontSize: 20 }}>←</Text></TouchableOpacity>
          <Text style={[s.topTitle, { color: '#1a1a2e', marginLeft: 12 }]}>Ride Book Karo</Text>
        </View>
      </View>
      <View style={[s.bottomSheet, { maxHeight: '72%' }]}>
        <View style={s.sheetHandle} />
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={s.locBox}>
            <View style={s.row}>
              <View style={s.dotGreen} />
              <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="📍 Pickup location..." value={pickup} onChangeText={(t) => { setPickup(t); searchPlaces(t, 'pickup'); }} />
            </View>
            {pickupSugg.length > 0 && (
              <View style={s.suggBox}>
                {pickupSugg.slice(0, 4).map((sg, i) => (
                  <TouchableOpacity key={i} style={s.suggItem} onPress={() => { setPickup(sg.text); setPickupSugg([]); geocodePlace(sg.text, 'pickup'); if(drop) fetchEta(sg.text, drop); }}>
                    <Text style={{ fontSize: 12 }}>📍 </Text><Text style={{ fontSize: 12, color: '#333', flex: 1 }} numberOfLines={1}>{sg.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={s.locDivider} />
            <View style={s.row}>
              <View style={s.dotRed} />
              <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="🎯 Drop location..." value={drop} onChangeText={(t) => { setDrop(t); searchPlaces(t, 'drop'); }} />
            </View>
            {dropSugg.length > 0 && (
              <View style={s.suggBox}>
                {dropSugg.slice(0, 4).map((sg, i) => (
                  <TouchableOpacity key={i} style={s.suggItem} onPress={() => { setDrop(sg.text); setDropSugg([]); geocodePlace(sg.text, 'drop'); if(pickup) fetchEta(pickup, sg.text); }}>
                    <Text style={{ fontSize: 12 }}>🎯 </Text><Text style={{ fontSize: 12, color: '#333', flex: 1 }} numberOfLines={1}>{sg.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          {eta ? <View style={{ backgroundColor: '#e8f5e9', borderRadius: 10, padding: 10, marginBottom: 10, alignItems: 'center' }}><Text style={{ color: '#2e7d32', fontWeight: '600', fontSize: 13 }}>🕐 {eta}</Text></View> : null}
          <TouchableOpacity style={s.locationBtn} onPress={useMyLocation}><Text style={{ color: '#2e7d32', fontWeight: '600', fontSize: 13 }}>📍 Meri Current Location Use Karo</Text></TouchableOpacity>
          <Text style={s.secTitle}>Ride Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {RIDES.map(r => (
              <TouchableOpacity key={r.id} style={[s.rideCard, rideType===r.id && s.rideCardActive]} onPress={() => setRideType(r.id)}>
                <Text style={{ fontSize: 24 }}>{r.icon}</Text>
                <Text style={[{ fontSize: 12, fontWeight: '700', marginTop: 4 }, rideType===r.id ? { color: '#fff' } : { color: '#333' }]}>{r.label}</Text>
                <Text style={[{ fontSize: 10 }, rideType===r.id ? { color: '#ddd' } : { color: '#999' }]}>{r.eta}</Text>
                {r.tag ? <View style={{ backgroundColor: '#4CAF50', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginTop: 2 }}><Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{r.tag}</Text></View> : null}
                <Text style={[{ fontSize: 12, fontWeight: 'bold', marginTop: 2 }, rideType===r.id ? { color: '#fff' } : { color: '#e94560' }]}>₹{r.base}-{r.base + r.rate * 5}+</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={[s.row, { marginBottom: 12 }]}>
            <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="🎫 Promo code (RIDE50)" autoCapitalize="characters" value={promoCode} onChangeText={setPromoCode} />
            <TouchableOpacity style={s.applyBtn} onPress={applyPromo}><Text style={{ color: '#e94560', fontWeight: 'bold' }}>Apply</Text></TouchableOpacity>
          </View>
          {promoDiscount > 0 ? <View style={{ backgroundColor: '#e8f5e9', borderRadius: 10, padding: 10, marginBottom: 10 }}><Text style={{ color: '#2e7d32', fontWeight: '600', fontSize: 13, textAlign: 'center' }}>✅ ₹{promoDiscount} discount applied!</Text></View> : null}
          {result ? <Text style={s.err}>{result}</Text> : null}
          <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={bookRide} disabled={loading}>
            <Text style={s.btnTxt}>{loading ? '🔍 Driver dhundh raha hai...' : 'Ride Book Karo 🚀'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );

  // ═══ MATCHING — Map full bg + bottom sheet ═══
  if (screen === 'matching') return (
    <View style={s.screen}>
      <View style={s.mapFull}>
        <MapWebView pickup={pickup} drop={drop} height={900} />
      </View>
      <View style={[s.bottomSheet, { maxHeight: '70%' }]}>
        <View style={s.sheetHandle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {rideData?.driver ? (
            <>
              <View style={s.driverCard}>
                <View style={s.driverAvatar}><Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>{(rideData.driver.name||'D')[0].toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.driverName}>{rideData.driver.name}</Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>🚗 {rideData.driver.vehicle_no}</Text>
                  <Text style={{ fontSize: 12, color: '#f0a500', marginTop: 2 }}>⭐ 4.8</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <PulseView><Text style={{ fontSize: 16, fontWeight: 'bold', color: '#e94560' }}>{eta ? eta.split('·')[0].trim() : '3 min'}</Text></PulseView>
                  <Text style={{ fontSize: 10, color: '#666' }}>arriving</Text>
                </View>
              </View>
              {rideData?.startOtp && (
                <View style={s.otpCard}>
                  <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 6 }}>🔐 Driver ko yeh OTP batao</Text>
                  <Text style={{ color: '#fff', fontSize: 34, fontWeight: 'bold', letterSpacing: 10 }}>{rideData.startOtp}</Text>
                </View>
              )}
              <View style={s.actionRow}>
                <TouchableOpacity style={s.actionBtn} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
                  <View>
                    <Text style={{ fontSize: 22 }}>💬</Text>
                    {unreadChat > 0 && <View style={s.chatBadge}><Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{unreadChat}</Text></View>}
                  </View>
                  <Text style={{ fontSize: 10, color: '#555', marginTop: 3 }}>Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} onPress={callDriver}><Text style={{ fontSize: 22 }}>📞</Text><Text style={{ fontSize: 10, color: '#555', marginTop: 3 }}>Call</Text></TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} onPress={triggerSOS}><Text style={{ fontSize: 22 }}>🆘</Text><Text style={{ fontSize: 10, color: '#555', marginTop: 3 }}>SOS</Text></TouchableOpacity>
              </View>
              {unreadChat > 0 && (
                <TouchableOpacity style={s.chatAlert} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>💬 Driver ne {unreadChat} message bheja — dekho</Text>
                </TouchableOpacity>
              )}
              {sosActive && <View style={[s.infoBox, { backgroundColor: '#ffeeee' }]}><Text style={{ fontSize: 13, color: '#c62828', fontWeight: 'bold' }}>🆘 Alert bheja! Police: 100 · Ambulance: 108</Text></View>}
              <View style={s.fareCard}>
                {[['Distance',rideData.distance],['Total Fare',rideData.fare]].map(([lbl,val],i) => (
                  <View key={i} style={[s.row, { justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i<1 ? 1 : 0, borderBottomColor: '#f5f5f5' }]}>
                    <Text style={{ fontSize: 13, color: '#666' }}>{lbl}</Text>
                    <Text style={[{ fontSize: 13 }, i===1 && { fontWeight: 'bold', color: '#1a1a2e', fontSize: 15 }]}>{val}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ textAlign: 'center', color: '#bbb', fontSize: 12, marginTop: 8 }}>⏳ Driver OTP daalkar trip shuru karega...</Text>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <RadarView />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginTop: 16 }}>Driver dhundh rahe hain...</Text>
              <Text style={{ fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center' }}>{pickup} → {drop}</Text>
              <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#e94560', marginTop: 10 }}>{rideData?.fare}</Text>
              {eta ? <Text style={{ fontSize: 13, color: '#4CAF50', marginTop: 4 }}>🕐 {eta}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 20, width: '100%' }}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' }}
                  onPress={async () => {
                    if (rideData?.ride_id) {
                      try {
                        const cr = await fetch(`${API}/api/rides/cancel-smart`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, cancelled_by: 'customer', reason: 'Customer cancelled', phone: phone || '9999999999' }) });
                        const cd = await cr.json();
                        if (cd.penalty > 0) setResult(`⚠️ ${cd.message}`);
                      } catch (_e) {}
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
    </View>
  );

  // ═══ IN-RIDE — Map full bg + bottom sheet ═══
  if (screen === 'inride') return (
    <View style={s.screen}>
      <View style={s.mapFull}>
        <MapWebView pickup={pickup} drop={drop} height={900} />
      </View>
      <View style={[s.bottomSheet, { maxHeight: '55%' }]}>
        <View style={s.sheetHandle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={{ backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 }}>
            <PulseView><Text style={{ color: '#4CAF50', fontSize: 15, fontWeight: 'bold' }}>🚗 Ride Chal Rahi Hai</Text></PulseView>
            <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>{rideData?.distance} · {rideData?.fare}</Text>
          </View>
          <View style={{ backgroundColor: '#f9f9f9', borderRadius: 14, padding: 14, marginBottom: 10 }}>
            <Text style={{ fontSize: 13, color: '#4CAF50', fontWeight: '600' }}>📍 {pickup}</Text>
            <Text style={{ fontSize: 16, textAlign: 'center', color: '#ddd', marginVertical: 6 }}>↓</Text>
            <Text style={{ fontSize: 13, color: '#e94560', fontWeight: '600' }}>🎯 {drop}</Text>
          </View>
          <View style={s.actionRow}>
            <TouchableOpacity style={s.actionBtn} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
              <View>
                <Text style={{ fontSize: 22 }}>💬</Text>
                {unreadChat > 0 && <View style={s.chatBadge}><Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{unreadChat}</Text></View>}
              </View>
              <Text style={{ fontSize: 10, color: '#555', marginTop: 3 }}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={callDriver}><Text style={{ fontSize: 22 }}>📞</Text><Text style={{ fontSize: 10, color: '#555', marginTop: 3 }}>Call</Text></TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={triggerSOS}><Text style={{ fontSize: 22 }}>🆘</Text><Text style={{ fontSize: 10, color: '#555', marginTop: 3 }}>SOS</Text></TouchableOpacity>
          </View>
          {unreadChat > 0 && (
            <TouchableOpacity style={s.chatAlert} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>💬 Driver ne {unreadChat} message bheja — dekho</Text>
            </TouchableOpacity>
          )}
          {sosActive && <View style={[s.infoBox, { backgroundColor: '#ffeeee' }]}><Text style={{ fontSize: 13, color: '#c62828', fontWeight: 'bold' }}>🆘 Alert bheja! Police: 100</Text></View>}
        </ScrollView>
      </View>
    </View>
  );

  // ═══ PAYMENT ═══
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
          { color: '#1a1a2e', icon: '💳', title: 'Online Pay', sub: 'UPI / Card', fn: handlePayment },
          { color: '#4CAF50', icon: '💵', title: 'Cash Pay', sub: 'Driver ko cash', fn: () => { setPaymentDone(true); setScreen('postride'); createScratchCard(); } },
        ].map((p, i) => (
          <TouchableOpacity key={i} style={[s.payBtn, { backgroundColor: p.color }]} onPress={p.fn}>
            <Text style={{ fontSize: 20 }}>{p.icon}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}><Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{p.title}</Text><Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 }}>{p.sub}</Text></View>
            <Text style={{ color: '#fff', fontSize: 18 }}>→</Text>
          </TouchableOpacity>
        ))}
        {result ? <Text style={s.err}>{result}</Text> : null}
      </View>
    </ScrollView>
  );

  // ═══ POST-RIDE ═══
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
            <TouchableOpacity activeOpacity={0.85} onPress={scratchNow} style={[s.scratchCard, { backgroundColor: scratched ? '#fff' : '#f0a500' }]}>
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
          setRideData(null); setPaymentDone(false); setResult(''); setScratchCard(null); setScratched(false); setEta(''); setPromoDiscount(0); setPromoCode(''); setUnreadChat(0);
          loadHistory(phone); loadWallet(phone);
        }}>
          <Text style={s.btnTxt}>Done 🏠 Home Jao</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );

  return <View />;

  function NavBarInner() {
    return (
      <View style={s.nav}>
        {[['home','🏠','Home'],['history','🕐','Trips'],['profile','👤','Profile']].map(([t,icon,lbl]) => (
          <TouchableOpacity key={t} style={s.navItem} onPress={() => { setScreen('home'); setTab(t); if(t==='history') loadHistory(phone); }}>
            <Text style={s.navIcon}>{icon}</Text>
            <Text style={[s.navLbl, tab===t && screen==='home' && s.navActive]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }
}

const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: '#f5f5f5' },
  mapFull:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  topOverlay:    { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 44, paddingHorizontal: 14 },
  topGlass:      { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 12, elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  greetingDark:  { color: '#1a1a2e', fontSize: 15, fontWeight: 'bold' },
  subTxtDark:    { color: '#666', fontSize: 11, marginTop: 2 },
  backCircle:    { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  bottomSheet:   { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingTop: 8, elevation: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, maxHeight: '60%' },
  sheetHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 12 },
  navFloat:      { position: 'absolute', bottom: 0, left: 0, right: 0 },
  hero:          { backgroundColor: '#1a1a2e', alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  heroIcon:      { fontSize: 52 },
  heroTitle:     { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  heroSub:       { color: '#aaa', fontSize: 13, marginTop: 5, textAlign: 'center' },
  card:          { margin: 14, backgroundColor: '#fff', borderRadius: 18, padding: 20, elevation: 4 },
  input:         { borderWidth: 1.5, borderColor: '#efefef', borderRadius: 12, padding: 12, fontSize: 14, backgroundColor: '#fafafa', marginBottom: 10 },
  label:         { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  btn:           { backgroundColor: '#e94560', borderRadius: 13, padding: 16, alignItems: 'center', marginTop: 6, marginBottom: 6, elevation: 3 },
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
  avatar:        { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e94560', alignItems: 'center', justifyContent: 'center' },
  avatarTxt:     { color: '#fff', fontWeight: 'bold', fontSize: 17 },
  searchBox:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 14, padding: 14, marginBottom: 12 },
  searchIcon:    { fontSize: 16, marginRight: 8 },
  searchPh:      { color: '#999', fontSize: 14 },
  quickRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickBtn:      { flex: 1, backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0' },
  quickIcon:     { fontSize: 22 },
  quickLbl:      { fontSize: 10, color: '#666', marginTop: 3, fontWeight: '500' },
  secTitle:      { fontSize: 14, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 10, marginTop: 4 },
  recentItem:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, marginBottom: 8 },
  recentRoute:   { fontSize: 13, fontWeight: '600', color: '#1a1a2e' },
  recentDate:    { fontSize: 11, color: '#999', marginTop: 2 },
  recentFare:    { fontSize: 14, fontWeight: 'bold', color: '#e94560' },
  promoBanner:   { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginBottom: 14 },
  promoTxt:      { color: '#fff', fontSize: 12, textAlign: 'center' },
  nav:           { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingBottom: 10, paddingTop: 4, elevation: 8 },
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
  walletBox:     { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 12, elevation: 2, borderWidth: 1, borderColor: '#f0f0f0' },
  amtBtn:        { flex: 1, minWidth: 68, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#e94560', alignItems: 'center', backgroundColor: '#fff8f8' },
  menuItem:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 7, elevation: 1 },
  menuIconBox:   { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  logoutBtn:     { borderWidth: 1.5, borderColor: '#e94560', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 6, marginBottom: 24 },
  locBox:        { backgroundColor: '#f9f9f9', borderRadius: 14, padding: 14, marginBottom: 10 },
  dotGreen:      { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF50', marginRight: 10 },
  dotRed:        { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e94560', marginRight: 10 },
  locDivider:    { height: 1, backgroundColor: '#e8e8e8', marginVertical: 8, marginLeft: 20 },
  locationBtn:   { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#c8e6c9' },
  suggBox:       { backgroundColor: '#fff', borderRadius: 10, marginTop: 4, elevation: 8, borderWidth: 1, borderColor: '#f0f0f0' },
  suggItem:      { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  rideCard:      { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, marginRight: 8, alignItems: 'center', minWidth: 82, borderWidth: 2, borderColor: 'transparent' },
  rideCardActive:{ backgroundColor: '#1a1a2e', borderColor: '#e94560' },
  applyBtn:      { padding: 12, borderWidth: 1.5, borderColor: '#e94560', borderRadius: 10, justifyContent: 'center', marginLeft: 8 },
  driverCard:    { backgroundColor: '#f9f9f9', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  driverAvatar:  { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  driverName:    { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
  otpCard:       { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12 },
  fareCard:      { backgroundColor: '#f9f9f9', borderRadius: 14, padding: 16, marginBottom: 10 },
  actionRow:     { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#f9f9f9', borderRadius: 14, padding: 14, marginBottom: 10 },
  actionBtn:     { alignItems: 'center', padding: 4, flex: 1 },
  chatBadge:     { position: 'absolute', top: -6, right: -10, backgroundColor: '#e94560', borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  chatAlert:     { backgroundColor: '#e94560', borderRadius: 10, padding: 12, marginBottom: 10, alignItems: 'center' },
  infoBox:       { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, marginBottom: 10 },
  payBtn:        { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 3 },
  scratchCard:   { borderRadius: 18, padding: 24, alignItems: 'center', marginBottom: 4, elevation: 6 },
  tipBtn:        { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#e0e0e0', alignItems: 'center', backgroundColor: '#fafafa' },
  statBox:       { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 18, alignItems: 'center', elevation: 2 },
  statNum:       { fontSize: 24, fontWeight: 'bold', color: '#e94560' },
  statLbl:       { fontSize: 11, color: '#999', marginTop: 4 },
  chatBubble:    { maxWidth: '75%', borderRadius: 14, padding: 12, marginBottom: 8 },
  chatMine:      { backgroundColor: '#e94560', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  chatTheirs:    { backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 4, elevation: 1 },
  chatInputRow:  { flexDirection: 'row', alignItems: 'center', padding: 10, paddingBottom: 28, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  chatInput:     { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, marginRight: 8 },
  chatSend:      { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e94560', alignItems: 'center', justifyContent: 'center' },
});
