import { useState, useEffect, useRef } from 'react';
import RazorpayCheckout from 'react-native-razorpay';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Switch, Animated, KeyboardAvoidingView, Platform, Linking, Share, BackHandler
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { apiGet, apiPost } from './api';
import { useRideStore } from './store';
import { WebView } from 'react-native-webview';

const MAPS_KEY = 'AIzaSyAK3HFrZsahMLNVUFgxGAQMw_6OATDD8q4';
const API = 'https://rideapp-backend-production-5e1c.up.railway.app';

type Screen = 'login' | 'otp' | 'home' | 'booking' | 'matching' | 'inride' | 'payment' | 'postride' | 'chat' | 'referral' | 'saved' | 'policy' | 'hourly' | 'wallet';

const HOURLY_PACKAGES: any = {
  auto:    { 2:{fare:180,km:20}, 4:{fare:320,km:40}, 6:{fare:460,km:60}, 8:{fare:580,km:80}, extra:8  },
  bike:    { 2:{fare:120,km:20}, 4:{fare:210,km:40}, 6:{fare:300,km:60}, 8:{fare:380,km:80}, extra:5  },
  car:     { 2:{fare:260,km:20}, 4:{fare:460,km:40}, 6:{fare:660,km:60}, 8:{fare:840,km:80}, extra:12 },
  eriksha: { 2:{fare:150,km:20}, 4:{fare:270,km:40}, 6:{fare:390,km:60}, 8:{fare:490,km:80}, extra:7  },
};
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
// ─── Bouncy Button — press pe scale animation ───
const Bouncy = ({ children, onPress, style, disabled }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.95, friction: 5, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} style={style} disabled={disabled} activeOpacity={0.85}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};
// ─── Success Burst — driver milne pe celebration ───
const SuccessBurst = () => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const particles = useRef([0,1,2,3,4,5,6,7].map(() => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    o: new Animated.Value(1),
  }))).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }),
    ]).start();
    particles.forEach((p, i) => {
      const angle = (i / 8) * Math.PI * 2;
      Animated.parallel([
        Animated.timing(p.x, { toValue: Math.cos(angle) * 70, duration: 700, useNativeDriver: true }),
        Animated.timing(p.y, { toValue: Math.sin(angle) * 70, duration: 700, useNativeDriver: true }),
        Animated.timing(p.o, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: 90 }}>
      {particles.map((p, i) => (
        <Animated.Text key={i} style={{ position: 'absolute', fontSize: 18, opacity: p.o, transform: [{ translateX: p.x }, { translateY: p.y }] }}>
          {['🎉','✨','⭐','🎊'][i % 4]}
        </Animated.Text>
      ))}
      <Animated.View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center', transform: [{ scale }], elevation: 8 }}>
        <Text style={{ fontSize: 32, color: '#fff' }}>✓</Text>
      </Animated.View>
    </View>
  );
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

const MapWebView = ({ pickup, drop, pickupCoords, dropCoords, driverLat, driverLng, customerLat, customerLng, userLat, userLng, height = 280 }: any) => {
  const centerLat = pickupCoords?.lat || userLat || customerLat || 26.8467;
  const centerLng = pickupCoords?.lng || userLng || customerLng || 80.9462;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>* { margin: 0; padding: 0; } html, body, #map { height: 100%; width: 100%; } #map { background: #e8eaed; }</style>
</head>
<body>
<div id="map"></div>
<script>
  let map, pickupMarker, dropMarker, driverMarker, customerMarker;
  function initMap() {
    const center = { lat: ${centerLat}, lng: ${centerLng} };
    map = new google.maps.Map(document.getElementById('map'), {
      center: center, zoom: 14, disableDefaultUI: true, zoomControl: true,
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }, { featureType: 'transit', stylers: [{ visibility: 'off' }] }]
    });
    const bounds = new google.maps.LatLngBounds();
    let hasPoint = false;
    ${pickupCoords?.lat ? `
    const pickupPos = { lat: ${pickupCoords.lat}, lng: ${pickupCoords.lng} };
    pickupMarker = new google.maps.Marker({
      position: pickupPos, map: map,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#4CAF50', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 },
      title: 'Pickup', animation: google.maps.Animation.DROP
    });
    bounds.extend(pickupPos); hasPoint = true;
    ` : ''}
    ${dropCoords?.lat ? `
    const dropPos = { lat: ${dropCoords.lat}, lng: ${dropCoords.lng} };
    dropMarker = new google.maps.Marker({
      position: dropPos, map: map,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#e94560', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 },
      title: 'Drop', animation: google.maps.Animation.DROP
    });
    bounds.extend(dropPos); hasPoint = true;
    ` : ''}
    ${driverLat && driverLng ? `
    const driverPos = { lat: ${driverLat}, lng: ${driverLng} };
    driverMarker = new google.maps.Marker({
      position: driverPos, map: map,
      label: { text: '🚗', fontSize: '22px' },
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0, fillOpacity: 0, strokeOpacity: 0 },
      title: 'Driver'
    });
    bounds.extend(driverPos); hasPoint = true;
    ` : ''}
    ${customerLat && customerLng ? `
    const customerPos = { lat: ${customerLat}, lng: ${customerLng} };
    customerMarker = new google.maps.Marker({
      position: customerPos, map: map,
      label: { text: '🧑', fontSize: '22px' },
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0, fillOpacity: 0, strokeOpacity: 0 },
      title: 'Customer'
    });
    bounds.extend(customerPos); hasPoint = true;
    ` : ''}
    ${pickupCoords?.lat && dropCoords?.lat ? `
    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map: map, suppressMarkers: true,
      polylineOptions: { strokeColor: '#1a1a2e', strokeWeight: 4, strokeOpacity: 0.8 }
    });
    directionsService.route({
      origin: { lat: ${pickupCoords.lat}, lng: ${pickupCoords.lng} },
      destination: { lat: ${dropCoords.lat}, lng: ${dropCoords.lng} },
      travelMode: 'DRIVING'
    }, (result, status) => { if (status === 'OK') directionsRenderer.setDirections(result); });
    ` : ''}
    if (hasPoint) { map.fitBounds(bounds, 80); if (map.getZoom() > 16) map.setZoom(16); }
  }
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&callback=initMap"></script>
</body>
</html>`;

  return <WebView source={{ html }} style={{ height, width: '100%' }} scrollEnabled={false} javaScriptEnabled domStorageEnabled />;
};

// ─── SlideUp — bottom se slide in animation ───
const SlideUp = ({ children, style, delay = 0 }: any) => {
  const y = useRef(new Animated.Value(50)).current;
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, { toValue: 0, duration: 380, delay, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { transform: [{ translateY: y }], opacity: o }]}>{children}</Animated.View>;
};

// ─── FloatingDots — bouncing loading dots ───
const FloatingDots = ({ color = '#e94560' }: any) => {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    dots.forEach((d, i) => {
      Animated.loop(Animated.sequence([
        Animated.delay(i * 200),
        Animated.timing(d, { toValue: -9, duration: 280, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.delay(540),
      ])).start();
    });
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, transform: [{ translateY: d }] }} />
      ))}
    </View>
  );
};

// ─── EmptyAnim — khali screen ke liye bouncing graphic ───
const EmptyAnim = ({ icon, title, sub }: any) => {
  const bounce = useRef(new Animated.Value(0)).current;
  const fade   = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(bounce, { toValue: -14, duration: 650, useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 0, duration: 650, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 30, opacity: fade }}>
      <Animated.Text style={{ fontSize: 72, transform: [{ translateY: bounce }] }}>{icon}</Animated.Text>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginTop: 22 }}>{title}</Text>
      {sub ? <Text style={{ fontSize: 13, color: '#999', marginTop: 8, textAlign: 'center', lineHeight: 20 }}>{sub}</Text> : null}
    </Animated.View>
  );
};

// ─── MapOverlay — map ke uper LIVE badge + route bar ───
const MapOverlay = ({ hasRoute, pickup, drop, live = false }: any) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!live) return;
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.6, duration: 750, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
    ])).start();
  }, [live]);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {live && (
        <View style={{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(46,125,50,0.92)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, elevation: 4 }}>
          <Animated.View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff', marginRight: 5, transform: [{ scale: pulse }] }} />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>LIVE</Text>
        </View>
      )}
      {hasRoute && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(26,26,46,0.86)', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', marginRight: 6 }} />
          <Text style={{ color: '#fff', fontSize: 11, flex: 1 }} numberOfLines={1}>{pickup}</Text>
          <Text style={{ color: '#666', fontSize: 12, marginHorizontal: 5 }}>→</Text>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#e94560', marginRight: 6 }} />
          <Text style={{ color: '#fff', fontSize: 11, flex: 1 }} numberOfLines={1}>{drop}</Text>
        </View>
      )}
    </View>
  );
};

// ─── Confetti — trip complete pe falling celebration ───
const Confetti = () => {
  const COLORS = ['#e94560','#4CAF50','#f0a500','#2196F3','#9C27B0','#FF5722','#00BCD4'];
  const pieces = useRef([...Array(28)].map((_, i) => ({
    y:     new Animated.Value(-20),
    rot:   new Animated.Value(0),
    o:     new Animated.Value(1),
    left:  (i * 13 + (i % 4) * 9) % 360,
    dur:   1200 + (i % 6) * 180,
    delay: (i % 7) * 90,
    color: COLORS[i % COLORS.length],
    size:  i % 3 === 0 ? 10 : i % 2 === 0 ? 7 : 5,
    round: i % 4 === 0,
  }))).current;
  useEffect(() => {
    pieces.forEach(p => {
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          Animated.timing(p.y,   { toValue: 720, duration: p.dur, useNativeDriver: true }),
          Animated.timing(p.rot, { toValue: 8,   duration: p.dur, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(p.o, { toValue: 1, duration: p.dur * 0.65, useNativeDriver: true }),
            Animated.timing(p.o, { toValue: 0, duration: p.dur * 0.35, useNativeDriver: true }),
          ]),
        ]),
      ]).start();
    });
  }, []);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: p.left,
          width: p.size, height: p.round ? p.size : p.size * 1.6,
          backgroundColor: p.color, borderRadius: p.round ? p.size : 2,
          opacity: p.o,
          transform: [
            { translateY: p.y },
            { rotate: p.rot.interpolate({ inputRange: [0, 8], outputRange: ['0deg', '720deg'] }) },
          ],
        }} />
      ))}
    </View>
  );
};

// ─── ScreenIn — screen mount transition (slide from right + fade) ───
const ScreenIn = ({ children, style }: any) => {
  const x = useRef(new Animated.Value(45)).current;
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(x, { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 230, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[style, { transform: [{ translateX: x }], opacity: o }]}>
      {children}
    </Animated.View>
  );
};

// ─── TripSteps — animated ride progress stepper ───
const TripSteps = ({ step }: { step: 0 | 1 | 2 | 3 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: step, friction: 8, tension: 60, useNativeDriver: false }).start();
  }, [step]);
  const steps = [{ icon: '🔍', label: 'Booking' }, { icon: '🚗', label: 'Driver' }, { icon: '🛣️', label: 'Ride' }, { icon: '✅', label: 'Done' }];
  return (
    <View style={{ paddingHorizontal: 6, paddingBottom: 14, paddingTop: 4 }}>
      <View style={{ height: 4, backgroundColor: '#f0f0f0', borderRadius: 2, marginHorizontal: 14, marginBottom: 10, overflow: 'hidden' }}>
        <Animated.View style={{
          height: 4, backgroundColor: '#e94560', borderRadius: 2,
          width: anim.interpolate({ inputRange: [0, 3], outputRange: ['0%', '100%'] }),
        }} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {steps.map((s, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Animated.View style={{
              width: 30, height: 30, borderRadius: 15,
              backgroundColor: i <= step ? '#e94560' : '#efefef',
              alignItems: 'center', justifyContent: 'center',
              transform: [{ scale: i === step ? 1.2 : 1 }],
              elevation: i === step ? 4 : 0,
            }}>
              <Text style={{ fontSize: 13 }}>{i <= step ? s.icon : '·'}</Text>
            </Animated.View>
            <Text style={{ fontSize: 9, marginTop: 4, color: i <= step ? '#e94560' : '#bbb', fontWeight: i === step ? 'bold' : 'normal' }}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── CountUp — number animated counter (wallet, fare etc) ───
const CountUp = ({ to, prefix = '', style }: any) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    anim.setValue(prevRef.current);
    const id = anim.addListener(({ value }) => setDisplay(Math.floor(value)));
    Animated.timing(anim, { toValue: to, duration: 750, useNativeDriver: false }).start(() => {
      prevRef.current = to;
    });
    return () => anim.removeListener(id);
  }, [to]);
  return <Text style={style}>{prefix}{display}</Text>;
};

export default function App() {
  const [screen, setScreen]           = useState<Screen>('login');
  const ride = useRideStore();
  // Store watcher — guaranteed UI update jab store change ho
  const [storeStatus, setStoreStatus] = useState('idle');
  const [storeDriverLoc, setStoreDriverLoc] = useState<any>(null);
  useEffect(() => {
    const unsub = useRideStore.subscribe((state) => {
      setStoreStatus(state.rideStatus);
      setStoreDriverLoc(state.driverLoc);
    });
    return unsub;
  }, []);
  const [phone, setPhone]             = useState('');
  const [otp, setOtp]                 = useState('');
  const [otpSent, setOtpSent]         = useState('');
  const [otpDigits, setOtpDigits]     = useState(['','','','','','']);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend]     = useState(false);
  const otpRefs = useRef<any[]>([]);
  const otpShakeAnim = useRef(new Animated.Value(0)).current;
  const otpSuccessAnim = useRef(new Animated.Value(0)).current;
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
  const [walletTxns, setWalletTxns]   = useState<any[]>([]);
  const [walletStats, setWalletStats] = useState<any>({});
  const [walletTxnTab, setWalletTxnTab] = useState<'all'|'earn'|'spend'|'reward'>('all');
  const [walletWebView, setWalletWebView] = useState(false);
  const [walletWebViewUrl, setWalletWebViewUrl] = useState('');
  const [walletAddAmt, setWalletAddAmt] = useState(0);
  const [walletAddInput, setWalletAddInput] = useState('');
  const [walletPaymentId, setWalletPaymentId] = useState('');
  const [scratchCard, setScratchCard] = useState<any>(null);
  const [scratched, setScratched]     = useState(false);
  const [eta, setEta]                 = useState('');
  const [fareCount, setFareCount]     = useState(0);
  const [userCoords, setUserCoords]   = useState<any>(null);
  const [pickupSugg, setPickupSugg]   = useState<any[]>([]);
  const [dropSugg, setDropSugg]       = useState<any[]>([]);
  const [fareEstimates, setFareEstimates] = useState<any>({});
  const [estDistance, setEstDistance] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTimer, setCancelTimer] = useState(60);
  const [freeCancelsLeft, setFreeCancelsLeft] = useState(3);
  const [bookTime, setBookTime] = useState(0);
  const [chatMsgs, setChatMsgs]       = useState<any[]>([]);
  const [chatInput, setChatInput]     = useState('');
  const [unreadChat, setUnreadChat]   = useState(0);
  const [driverEta, setDriverEta]     = useState('');
  const [driverDist, setDriverDist]   = useState('');
  const lastChatCount = useRef(0);
  const [referralData, setReferralData] = useState<any>(null);
  const [referralInput, setReferralInput] = useState('');
  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const scratchAnim = useRef(new Animated.Value(1)).current;
  const starAnims   = useRef([0,1,2,3,4].map(() => new Animated.Value(1))).current;

  // ── Hourly Booking State ──────────────────────
  const [hourlyStep, setHourlyStep]     = useState<'book'|'waiting'|'active'|'done'>('book');
  const [hourlyBooking, setHourlyBooking] = useState<any>(null);
  const [hPackageHours, setHPackageHours] = useState(4);
  const [hVehicle, setHVehicle]         = useState('auto');
  const [hPickup, setHPickup]           = useState('');
  const [hPickupCoords, setHPickupCoords] = useState<any>(null);
  const [hDrop, setHDrop]               = useState('');
  const [hDropCoords, setHDropCoords]   = useState<any>(null);
  const [hRoundTrip, setHRoundTrip]     = useState(false);
  const [hStayHours, setHStayHours]     = useState(1);
  const [hPickupSugg, setHPickupSugg]   = useState<any[]>([]);
  const [hDropSugg, setHDropSugg]       = useState<any[]>([]);
  const [hourlyTimerSec, setHourlyTimerSec] = useState(0);
  const [hOtpInput, setHOtpInput]       = useState('');
  const hourlyTimerRef = useRef<any>(null);

  // ── Notification Handler ──────────────────────
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'RideApp Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#e94560',
      });
    }

    // Foreground notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Notification receive hone pe
    const sub1 = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Notification received:', notification);
    });

    // Notification tap karne pe
    const sub2 = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tapped:', response);
    });

    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);

// ── FCM Token Register ────────────────────────
  const registerFCM = async (userPhone: string) => {
    try {
      // if (!Device.isDevice) return;
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: '8f1a5733-b0fe-466b-ab3e-862983570572'
      })).data;
      // Backend mein save karo
      await apiPost('/api/auth/save-fcm-token', { phone: userPhone, token, role: 'customer' });
      console.log('✅ FCM token saved');
    } catch (e) {
      console.log('FCM error:', e);
    }
  };

  // ── Android Back Button ───────────────────────
  useEffect(() => {
    const backAction = () => {
      if (screen === 'home' && tab === 'home') return false;
      if (screen === 'home' && tab !== 'home') { setTab('home'); return true; }
      if (screen === 'otp') { setScreen('login'); return true; }
      if (screen === 'booking') { setScreen('home'); setPickupSugg([]); setDropSugg([]); setEta(''); setPromoCode(''); setPromoDiscount(0); return true; }
      if (screen === 'matching') { setShowCancelModal(true); return true; }
      if (screen === 'chat') { setScreen('matching'); return true; }
      if (screen === 'wallet') { setScreen('home'); setTab('profile'); return true; }
      if (screen === 'referral') { setScreen('home'); return true; }
      if (screen === 'saved') { setScreen('home'); return true; }
      if (screen === 'policy') { setScreen('home'); return true; }
      if (screen === 'hourly') {
        if (hourlyStep === 'book') { setHPickupSugg([]); setHDropSugg([]); setScreen('home'); return true; }
        return true;
      }
      if (screen === 'payment') return true;
      if (screen === 'postride') return true;
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [screen, tab]);

  useEffect(() => {
    (async () => {
      try {
        const sp = await AsyncStorage.getItem('userPhone');
        const sn = await AsyncStorage.getItem('userName');
        if (sp) { setPhone(sp); setUserName(sn || 'Rider'); setScreen('home'); loadHistory(sp); loadWallet(sp); registerFCM(sp); }
      } catch (_e) {}
    })();
  }, []);

  // ─── RIDE POLLING — direct & robust (timeout + retry + overlap guard) ───
  useEffect(() => {
    if (!['matching','inride'].includes(screen) || !rideData?.ride_id) return;
    let busy = false;
    let stopped = false;
    const rid = rideData.ride_id;
    const iv = setInterval(async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        const data = await apiGet(`/api/rides/status/${rid}`);
        if (!data._error && data.ride) {
          const st = data.ride.status;

          if (st === 'matched' || st === 'arrived') {
            setRideData((p: any) => p ? { ...p, startOtp: data.ride.start_otp, driver: { name: data.ride.driver_name, phone: data.ride.driver_phone, vehicle_no: data.ride.vehicle_no } } : p);
            const ld = await apiGet(`/api/rides/driver-location/${rid}`);
            if (!ld._error && ld.location) {
              setDriverLoc(ld.location);
              if (ld.location.lat && pickupCoords?.lat) calcDriverEta(ld.location.lat, ld.location.lng, pickupCoords.lat, pickupCoords.lng);
            }
          }

          if (st === 'started') setScreen('inride');

          if (st === 'completed') {
            stopped = true; clearInterval(iv);
            setScreen('payment'); loadWallet(phone);
          }

          if (st === 'cancelled') {
            stopped = true; clearInterval(iv);
            const nd = await apiGet(`/api/notifications/latest?phone=${phone}`);
            setResult('❌ ' + (nd?.notification?.body || 'Ride cancel ho gayi'));
            setScreen('home'); setTab('home'); setRideData(null); setPickup(''); setDrop(''); setEta('');
            setUnreadChat(0); setDriverLoc(null); setDriverEta(''); setDriverDist('');
            ride.clearRide();
          }
        }
      } catch (_e) {}
      busy = false;
    }, 3000);
    return () => { stopped = true; clearInterval(iv); };
  }, [screen, rideData?.ride_id]);

  // ── Hourly booking polling ──────────────────────
  useEffect(() => {
    if (screen !== 'hourly' || !hourlyBooking?.id) return;
    if (hourlyStep === 'done') return;
    let stopped = false;
    const iv = setInterval(async () => {
      if (stopped) return;
      try {
        const data = await apiGet(`/api/hourly/status/${hourlyBooking.id}`);
        if (!data._error && data.booking) {
          const b = data.booking;
          setHourlyBooking((p: any) => ({ ...p, ...b, driver: data.driver || p?.driver }));
          if (b.status === 'matched' && hourlyStep === 'waiting') setHourlyStep('active');
          if (b.status === 'active' && hourlyStep === 'waiting') setHourlyStep('active');
          if (b.status === 'completed') { setHourlyStep('done'); loadWallet(phone); }
        }
      } catch (_e) {}
    }, 3500);
    return () => { stopped = true; clearInterval(iv); };
  }, [screen, hourlyBooking?.id, hourlyStep]);

  // Hourly trip timer — counts up from 0 while active
  useEffect(() => {
    if (screen === 'hourly' && hourlyStep === 'active' && hourlyBooking?.status === 'active') {
      if (hourlyTimerRef.current) clearInterval(hourlyTimerRef.current);
      const startMs = hourlyBooking.started_at ? new Date(hourlyBooking.started_at).getTime() : Date.now();
      hourlyTimerRef.current = setInterval(() => {
        setHourlyTimerSec(Math.floor((Date.now() - startMs) / 1000));
      }, 1000);
      return () => { if (hourlyTimerRef.current) clearInterval(hourlyTimerRef.current); };
    }
  }, [screen, hourlyStep, hourlyBooking?.status]);

  useEffect(() => {
    if (screen !== 'chat' || !rideData?.ride_id) return;
    const load = async () => {
      try { const r = await fetch(`${API}/api/chat/${rideData.ride_id}`); const d = await r.json(); setChatMsgs(d.messages || []); lastChatCount.current = (d.messages || []).length; setUnreadChat(0); } catch (_e) {}
    };
    load();
    const iv = setInterval(load, 2500);
    return () => clearInterval(iv);
  }, [screen, rideData?.ride_id]);

  // Cancel countdown timer (60 sec free)
  useEffect(() => {
    if (screen !== 'matching' || !bookTime) return;
    const iv = setInterval(() => {
      const elapsed = Math.floor((Date.now() - bookTime) / 1000);
      const left = Math.max(0, 60 - elapsed);
      setCancelTimer(left);
      if (left === 0) clearInterval(iv);
    }, 1000);
    return () => clearInterval(iv);
  }, [screen, bookTime]);

  // Background chat — unread badge during ride (8s, overlap guard)
  useEffect(() => {
    if (!['matching','inride'].includes(screen) || !rideData?.ride_id) return;
    let busy = false;
    const iv = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const d = await apiGet(`/api/chat/${rideData.ride_id}`);
        if (!d._error) {
          const msgs = d.messages || [];
          if (msgs.length > lastChatCount.current) setUnreadChat(msgs.length - lastChatCount.current);
        }
      } catch (_e) {}
      busy = false;
    }, 8000);
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

  // Driver ne directly payment confirm kari toh auto-update
  useEffect(() => {
    if (screen !== 'payment' || !rideData?.ride_id) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/rides/payment-status/${rideData.ride_id}`);
        const data = await res.json();
        if (data.payment_status === 'completed') {
          clearInterval(iv);
          setPaymentDone(true);
          setScreen('postride');
          createScratchCard();
        }
      } catch (_e) {}
    }, 3000);
    return () => clearInterval(iv);
  }, [screen, rideData?.ride_id]);

  const loadHistory = async (ph: string) => {
    try { const r = await fetch(`${API}/api/rides/history?phone=${ph}`); const d = await r.json(); setHistoryRides(d.rides || []); } catch (_e) {}
  };
  const loadWallet = async (ph: string) => {
    try { const r = await fetch(`${API}/api/wallet/balance?phone=${ph}`); const d = await r.json(); setWalletBalance(d.balance || 0); } catch (_e) {}
  };
  const loadWalletDetail = async (ph: string) => {
    try {
      const r = await fetch(`${API}/api/wallet/customer/detail?phone=${ph}`);
      const d = await r.json();
      setWalletBalance(d.balance || 0);
      setWalletTxns(d.transactions || []);
      setWalletStats(d.stats || {});
    } catch (_e) {}
  };
  const openRazorpayTopup = (amt: number) => {
    const paise = Math.round(amt * 100);
    const url = `https://razorpay.me/@rajawat101?amount=${paise}`;
    setWalletAddAmt(amt);
    setWalletWebViewUrl(url);
    setWalletWebView(true);
  };
  const confirmTopup = async (paymentId: string) => {
    try {
      const res = await fetch(`${API}/api/wallet/topup/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount: walletAddAmt, payment_id: paymentId }),
      });
      const d = await res.json();
      if (d.success) { setWalletBalance(d.balance); await loadWalletDetail(phone); }
      setWalletWebView(false);
      setWalletPaymentId('');
    } catch (_e) { setWalletWebView(false); }
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
    if (!origin || !drop) return 5;
    setEta('⏳ Calculate ho raha hai...');
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(dest)}&key=${MAPS_KEY}&mode=driving&language=hi&units=metric&departure_time=now`
      );
      const data = await res.json();
      if (data.status !== 'OK') { setEta(''); return 5; }
      const el = data.rows?.[0]?.elements?.[0];
      if (el?.status === 'OK') {
        // duration_in_traffic agar available ho (more accurate)
        const duration = el.duration_in_traffic?.text || el.duration.text;
        const dist = el.distance.text;
        const km = el.distance.value / 1000;
        setEta(`🕐 ${duration} · 📍 ${dist}`);
        setEstDistance(km);
        loadFareEstimates(km);
        return km;
      } else {
        setEta(''); return 5;
      }
    } catch (_e) { setEta(''); return 5; }
  };
  const calcDriverEta = async (driverLat: number, driverLng: number, pickupLat: number, pickupLng: number) => {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${driverLat},${driverLng}&destinations=${pickupLat},${pickupLng}&key=${MAPS_KEY}&mode=driving&departure_time=now`
      );
      const data = await res.json();
      const el = data.rows?.[0]?.elements?.[0];
      if (el?.status === 'OK') {
        const duration = el.duration_in_traffic?.text || el.duration.text;
        const dist = el.distance.text;
        setDriverEta(duration);
        setDriverDist(dist);
      }
    } catch (_e) {}
  };

  const loadFareEstimates = async (km: number) => {
    const est: any = {};
    await Promise.all(RIDES.map(async (r) => {
      try {
        const res = await fetch(`${API}/api/fare-estimate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_type: r.id, distance: km }) });
        const d = await res.json();
        est[r.id] = d.fare;
      } catch (_e) {}
    }));
    setFareEstimates(est);
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

  const addMoney = async (amt: number) => { openRazorpayTopup(amt); };
 const payWithWallet = async () => {
    const fareNum = parseInt(String(rideData?.fare).replace(/[^0-9]/g, '')) || 0;
    if (walletBalance < fareNum) { setResult(`❌ Balance kam hai! ₹${walletBalance} hai`); return; }
    try {
      const res = await fetch(`${API}/api/wallet/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone || '9999999999', amount: fareNum, ride_id: rideData.ride_id }) });
      const data = await res.json();
      if (data.success) {
        setWalletBalance(data.balance);
        await fetch(`${API}/api/rides/payment-complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, payment_method: 'wallet', phone: phone || '9999999999' }) });
        setPaymentDone(true); setScreen('postride'); createScratchCard();
      } else setResult('❌ ' + (data.message || 'Payment fail'));
    } catch (_e) { setResult('❌ Server error'); }
  };
  // PAYMENT-COMPLETE API //
  const handlePayment = async () => {
    try {
      const fareNum = parseInt(String(rideData?.fare).replace(/[^0-9]/g, '')) || 0;
      const orderRes = await fetch(`${API}/api/payment/create-order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: fareNum, ride_id: rideData.ride_id }) });
      const order = await orderRes.json();
      if (!order.success) { setResult('❌ Order error'); return; }
      RazorpayCheckout.open({ description: 'RideApp Trip', currency: 'INR', key: order.key_id, amount: order.amount, order_id: order.order_id, name: 'RideApp', prefill: { contact: phone, name: userName || 'User' }, theme: { color: '#e94560' } })
        .then(async (data: any) => {
          await fetch(`${API}/api/payment/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, payment_id: data.razorpay_payment_id, amount: fareNum, method: 'online' }) });
          await fetch(`${API}/api/rides/payment-complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, payment_method: 'online', phone: phone || '9999999999' }) });
          setPaymentDone(true); setScreen('postride'); createScratchCard();
        }).catch((_e: any) => setResult('❌ Payment cancel ya fail hua'));
    } catch (e: any) { setResult('❌ ' + (e?.message || 'Payment error')); }
  };

  const useMyLocation = async () => {
    setResult('📍 Location le rahe hain...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setResult('❌ Location permission do'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setUserCoords({ latitude: lat, longitude: lng });
      setPickupCoords({ lat, lng });

      // Google Geocoding API se proper address lo
      try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}&language=en`);
        const data = await res.json();
        if (data.results?.[0]) {
          const address = data.results[0].formatted_address;
          setPickup(address);
          setResult('✅ Location mil gayi!');
          // Coords se directly ETA calculate karo (accurate)
          if (drop) {
            const etaRes = await fetch(
              `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${lat},${lng}&destinations=${encodeURIComponent(drop)}&key=${MAPS_KEY}&mode=driving&departure_time=now`
            );
            const etaData = await etaRes.json();
            const el = etaData.rows?.[0]?.elements?.[0];
            if (el?.status === 'OK') {
              const duration = el.duration_in_traffic?.text || el.duration.text;
              const dist = el.distance.text;
              const km = el.distance.value / 1000;
              setEta(`🕐 ${duration} · 📍 ${dist}`);
              setEstDistance(km);
              loadFareEstimates(km);
            }
          }
        } else {
          // Fallback — expo geocode
          const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          if (geo[0]) {
            const a = geo[0];
            const addr = [a.streetNumber, a.street, a.district, a.city].filter(Boolean).join(', ');
            setPickup(addr);
            setResult('✅ Location mil gayi!');
          }
        }
      } catch (_e) {
        const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geo[0]) {
          const a = geo[0];
          setPickup([a.streetNumber, a.street, a.city].filter(Boolean).join(', '));
        }
        setResult('✅ Location mil gayi!');
      }
    } catch (_e) { setResult('❌ Location error'); }
  };

  const bookRide = async () => {
    if (!pickup || !drop) { setResult('❌ Pickup aur Drop likho!'); return; }
    setLoading(true); setPaymentDone(false);
    try {
      const distanceKm = await fetchEta(pickup, drop);
      if (!dropCoords) await geocodePlace(drop, 'drop');
      const data = await apiPost('/api/rides/book', {
        passenger_phone: phone || '9999999999', pickup, drop_location: drop, ride_type: rideType, distance: distanceKm,
        pickup_lat: pickupCoords?.lat, pickup_lng: pickupCoords?.lng, drop_lat: dropCoords?.lat, drop_lng: dropCoords?.lng,
        discount: promoDiscount, promo_code: promoDiscount > 0 ? promoCode : null
      });
      if (data._error) { setResult('❌ ' + data.message); setLoading(false); return; }
      if (promoDiscount > 0 && data.ride_id) {
        try { await fetch(`${API}/api/promo/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: promoCode, phone, ride_id: data.ride_id, discount: promoDiscount }) }); } catch (_e) {}
      }
  setRideData(data); setScreen('matching'); setResult('');
      ride.setRide(data); // Store mein naya ride — purana stale data auto-clear
      setBookTime(Date.now()); setCancelTimer(60);
      // Free cancels load
      try { const cs = await fetch(`${API}/api/customer/cancel-status?phone=${phone || '9999999999'}`); const csd = await cs.json(); setFreeCancelsLeft(csd.free_cancels_left ?? 3); } catch (_e) {}
    } catch { setResult('❌ Server connect nahi hua!'); }
    setLoading(false);
  };
// OTP digit change handler
  const handleOtpChange = (text: string, index: number) => {
    const newDigits = [...otpDigits];
    newDigits[index] = text.replace(/[^0-9]/g, '').slice(-1);
    setOtpDigits(newDigits);
    setOtp(newDigits.join(''));
    // Auto focus next
    if (text && index < 5) otpRefs.current[index + 1]?.focus();
    // Auto verify when all 6 filled
    if (newDigits.filter(d => d !== '').length === 6) {
      setTimeout(() => verifyOtp(newDigits.join('')), 300);
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // Clipboard monitor — auto paste OTP
  const checkClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && /^\d{6}$/.test(text)) {
        const digits = text.split('');
        setOtpDigits(digits);
        setOtp(text);
        // Auto verify
        setTimeout(() => verifyOtp(text), 300);
      }
    } catch (_e) {}
  };

  // OTP shake animation (wrong OTP)
  const shakeOtp = () => {
    Animated.sequence([
      Animated.timing(otpShakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(otpShakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(otpShakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(otpShakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  // Resend timer
  useEffect(() => {
    if (screen !== 'otp') return;
    setResendTimer(60); setCanResend(false);
    const iv = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(iv); setCanResend(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [screen]);

  // Clipboard check every 2 sec when on OTP screen
  useEffect(() => {
    if (screen !== 'otp') return;
    const iv = setInterval(checkClipboard, 2000);
    return () => clearInterval(iv);
  }, [screen]);

  const sendOtp = async () => {
    if (!phone || phone.length < 10) { setResult('❌ Sahi phone number likho'); return; }
    setLoading(true);
    try { const res = await fetch(`${API}/api/auth/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) }); const data = await res.json(); setOtpSent(data.otp || ''); setScreen('otp'); setResult(''); } catch { setResult('❌ Server connect nahi hua'); }
    setLoading(false);
  };
  const verifyOtp = async (otpOverride?: string) => {
    const otpToUse = otpOverride || otp;
    if (!otpToUse) { setResult('❌ OTP likho'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: otpToUse, name: userName || 'Rider' })
      });
      const data = await res.json();
      if (data.token) {
        await AsyncStorage.setItem('userPhone', phone);
        await AsyncStorage.setItem('userName', userName || 'Rider');
        setScreen('home'); setResult(''); loadHistory(phone); loadWallet(phone);
        registerFCM(phone);
    
      } else {
        setResult('❌ ' + (data.error || 'OTP galat hai'));
        shakeOtp();
      }
    } catch { setResult('❌ Server connect nahi hua'); }
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
          <Bouncy style={[s.btn, loading && { opacity: 0.7 }]} onPress={sendOtp} disabled={loading}>
            <Text style={s.btnTxt}>{loading ? '⏳ Bhej raha hai...' : 'OTP Bhejo 📱'}</Text>
          </Bouncy>
          <Text style={s.terms}>Continue karke aap Terms & Privacy se agree karte hain</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ═══ OTP ═══
  if (screen === 'otp') return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.hero}>
          <Animated.Text style={{ fontSize: 52, transform: [{ scale: otpSuccessAnim.interpolate({ inputRange: [0,1], outputRange: [1, 1.3] }) }] }}>🔐</Animated.Text>
          <Text style={s.heroTitle}>OTP Verify Karo</Text>
          <Text style={s.heroSub}>6-digit code +91 {phone} pe bheja gaya</Text>
        </View>
        <View style={s.card}>
          {/* Hint */}
          <View style={{ backgroundColor: '#e3f2fd', borderRadius: 10, padding: 12, marginBottom: 18, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, marginRight: 8 }}>💡</Text>
            <Text style={{ fontSize: 12, color: '#1565c0', flex: 1, lineHeight: 18 }}>SMS aane par OTP copy karo — app automatically detect kar lega aur fill ho jaayega!</Text>
          </View>

          {/* 6 OTP Boxes */}
          <Animated.View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, transform: [{ translateX: otpShakeAnim }] }}>
            {otpDigits.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => { otpRefs.current[i] = ref; }}
                style={{
                  width: 44, height: 54, borderRadius: 12, textAlign: 'center', fontSize: 22, fontWeight: 'bold',
                  borderWidth: 2, borderColor: digit ? '#e94560' : '#e0e0e0',
                  backgroundColor: digit ? '#fff8f8' : '#fafafa', color: '#1a1a2e',
                }}
                keyboardType="number-pad" maxLength={1} value={digit}
                onChangeText={(t) => handleOtpChange(t, i)}
                onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
              />
            ))}
          </Animated.View>

          {/* Test OTP hint */}
          {otpSent ? (
            <View style={{ backgroundColor: '#fff3e0', borderRadius: 10, padding: 10, marginBottom: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#e65100' }}>🧪 Test OTP: <Text style={{ fontWeight: 'bold', letterSpacing: 4 }}>{otpSent}</Text></Text>
            </View>
          ) : null}

          {/* Clipboard detect hint */}
          <TouchableOpacity style={{ backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} onPress={checkClipboard}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>📋</Text>
            <Text style={{ fontSize: 13, color: '#666', fontWeight: '500' }}>Clipboard se OTP paste karo</Text>
          </TouchableOpacity>

          {result ? <Text style={s.err}>{result}</Text> : null}

          {/* Verify Button */}
          <Bouncy
            style={[s.btn, (loading || otpDigits.join('').length < 6) && { opacity: 0.6 }]}
            onPress={() => verifyOtp()} disabled={loading || otpDigits.join('').length < 6}>
            <Text style={s.btnTxt}>{loading ? '⏳ Verify ho raha hai...' : '✅ Verify Karo'}</Text>
          </Bouncy>

          {/* Resend */}
          <View style={{ alignItems: 'center', marginTop: 14 }}>
            {canResend ? (
              <TouchableOpacity onPress={async () => {
                setOtpDigits(['','','','','','']); setOtp(''); setResult('');
                setCanResend(false); setResendTimer(60);
                await sendOtp();
              }}>
                <Text style={{ color: '#e94560', fontWeight: 'bold', fontSize: 14 }}>🔄 OTP Dobara Bhejo</Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ color: '#999', fontSize: 13 }}>OTP dobara bhejne ke liye <Text style={{ color: '#e94560', fontWeight: 'bold' }}>{resendTimer}s</Text> wait karo</Text>
            )}
          </View>

          <TouchableOpacity onPress={() => setScreen('login')} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={s.back}>← Wapas jao</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ═══ HOME — Map fit on top, content below ═══
  if (screen === 'home' && tab === 'home') return (
    <View style={s.screen}>
      {/* Top bar */}
      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>Namaste 👋 {userName || 'Rider'}</Text>
          <Text style={s.subTxt}>📍 Lucknow, UP</Text>
        </View>
        <TouchableOpacity style={s.avatar} onPress={() => { setTab('profile'); loadWallet(phone); }}>
          <Text style={s.avatarTxt}>{(userName || 'R')[0].toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
      {/* Map fit */}
      <View style={s.mapFit}>
        <MapWebView pickupCoords={pickupCoords} dropCoords={dropCoords} userLat={userCoords?.latitude} userLng={userCoords?.longitude} height={260} />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} />
      </View>
      {/* Content */}
      <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, paddingTop: 16, paddingHorizontal: 16 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
          <SlideUp delay={0}>
            <Bouncy onPress={() => setScreen('booking')} style={s.searchBox}>
              <Text style={s.searchIcon}>🔍</Text>
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

          <SlideUp delay={120}>
            <TouchableOpacity style={s.promoBanner} onPress={() => { loadReferral(); setScreen('referral'); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <PulseView><Text style={{ fontSize: 18, marginRight: 8 }}>🎁</Text></PulseView>
                <Text style={s.promoTxt}>Dost ko refer karo, dono ko ₹50 milega!</Text>
                <Text style={{ color: '#e94560', marginLeft: 8, fontWeight: 'bold', fontSize: 12 }}>→</Text>
              </View>
            </TouchableOpacity>
          </SlideUp>
          <SlideUp delay={150}>
            <Bouncy onPress={() => { setHourlyStep('book'); setHPickup(''); setHDrop(''); setHPickupCoords(null); setHDropCoords(null); setHPickupSugg([]); setHDropSugg([]); setHRoundTrip(false); setHStayHours(1); setHourlyBooking(null); setScreen('hourly'); }} style={{ borderRadius: 16, marginBottom: 14, overflow: 'hidden', elevation: 4 }}>
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
      <View style={s.navFloat}><NavBarInner /></View>
    </View>
  );

  // ═══ HISTORY ═══
  if (screen === 'home' && tab === 'history') return (
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
        <TouchableOpacity style={s.walletCard} onPress={() => { loadWalletDetail(phone); setScreen('wallet'); }}>
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
          <View style={s.menuIconBox}><Text style={{ fontSize: 18 }}>🎁</Text></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Refer & Earn</Text><Text style={{ fontSize: 11, color: '#999' }}>Dost ko bulao, ₹50 pao</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </Bouncy>
        <Bouncy style={s.menuItem} onPress={() => { loadSaved(); setScreen('saved'); }}>
          <View style={s.menuIconBox}><Text style={{ fontSize: 18 }}>📍</Text></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Saved Places</Text><Text style={{ fontSize: 11, color: '#999' }}>Home, Office save karo</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </Bouncy>
        <Bouncy style={s.menuItem} onPress={() => setScreen('policy')}>
          <View style={s.menuIconBox}><Text style={{ fontSize: 18 }}>📋</Text></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Cancellation Policy</Text><Text style={{ fontSize: 11, color: '#999' }}>Cancel rules aur fees</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </Bouncy>
        {[['🎫','Promo Codes','RIDE50, FLAT20'],['🔔','Notifications','Alerts'],['🛡️','Safety','Emergency'],['📞','Support','24x7 help']].map(([icon,title,sub],i) => (
          <Bouncy key={i} style={s.menuItem} onPress={() => {}}>
            <View style={s.menuIconBox}><Text style={{ fontSize: 18 }}>{icon}</Text></View>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>{title}</Text><Text style={{ fontSize: 11, color: '#999' }}>{sub}</Text></View>
            <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
          </Bouncy>
        ))}
        <Bouncy style={s.logoutBtn} onPress={async () => { await AsyncStorage.removeItem('userPhone'); await AsyncStorage.removeItem('userName'); setScreen('login'); setTab('home'); setPhone(''); setOtp(''); setWalletBalance(0); }}>
          <Text style={{ color: '#e94560', fontWeight: 'bold', fontSize: 14 }}>🚪 Logout</Text>
        </Bouncy>
      </ScrollView>
      <View style={s.navFloat}><NavBarInner /></View>
    </View>
  );

  // ═══ WALLET SCREEN ═══
  if (screen === 'wallet') {
    const filteredTxns = walletTxns.filter(t => {
      if (walletTxnTab === 'all') return true;
      if (walletTxnTab === 'earn') return t.type === 'credit' && !(t.description || '').toLowerCase().includes('reward') && !(t.description || '').toLowerCase().includes('referral');
      if (walletTxnTab === 'spend') return t.type === 'debit';
      if (walletTxnTab === 'reward') return t.type === 'credit' && ((t.description || '').toLowerCase().includes('reward') || (t.description || '').toLowerCase().includes('referral') || (t.description || '').toLowerCase().includes('refund'));
      return true;
    });
    const fmtDate = (d: string) => { try { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return d; } };
    return (
      <ScreenIn style={s.screen}>
        {/* Header */}
        <View style={{ backgroundColor: '#1a1a2e', paddingTop: 52, paddingBottom: 20, paddingHorizontal: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }} style={{ marginRight: 14, padding: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10 }}>
              <Text style={{ color: '#fff', fontSize: 20 }}>←</Text>
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', flex: 1 }}>My Wallet</Text>
            <TouchableOpacity onPress={() => loadWalletDetail(phone)} style={{ padding: 8 }}>
              <Text style={{ fontSize: 18 }}>⟳</Text>
            </TouchableOpacity>
          </View>
          {/* Balance hero */}
          <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 20, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>Available Balance</Text>
            <CountUp to={walletBalance} prefix="₹" style={{ color: '#fff', fontSize: 48, fontWeight: '900', marginTop: 4 }} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              {[100, 200, 500, 1000, 2000].map(amt => (
                <TouchableOpacity key={amt} onPress={() => openRazorpayTopup(amt)}
                  style={{ backgroundColor: amt === 1000 ? '#e94560' : 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+₹{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: '#4CAF50', fontSize: 17, fontWeight: '800' }}>₹{parseFloat(walletStats?.total_credited || 0).toFixed(0)}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 }}>Total Added</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: '#e94560', fontSize: 17, fontWeight: '800' }}>₹{parseFloat(walletStats?.total_spent || 0).toFixed(0)}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 }}>Total Spent</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: '#FFD700', fontSize: 17, fontWeight: '800' }}>₹{parseFloat(walletStats?.total_rewards || 0).toFixed(0)}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 }}>Rewards</Text>
            </View>
          </View>
        </View>

        {/* Custom amount add */}
        <View style={{ backgroundColor: '#fff', margin: 14, borderRadius: 14, padding: 14, elevation: 2, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <TextInput
            style={{ flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: '#1a1a2e' }}
            placeholder="Enter custom amount (₹)"
            keyboardType="numeric"
            value={walletAddInput}
            onChangeText={setWalletAddInput}
            placeholderTextColor="#bbb"
          />
          <TouchableOpacity
            onPress={() => { const a = parseFloat(walletAddInput); if (a >= 1) { openRazorpayTopup(a); setWalletAddInput(''); } }}
            style={{ backgroundColor: '#e94560', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Add ›</Text>
          </TouchableOpacity>
        </View>

        {/* Transaction tabs */}
        <View style={{ flexDirection: 'row', marginHorizontal: 14, marginBottom: 8, gap: 8 }}>
          {(['all', 'earn', 'spend', 'reward'] as const).map(tab => (
            <TouchableOpacity key={tab} onPress={() => setWalletTxnTab(tab)}
              style={{ flex: 1, borderRadius: 20, paddingVertical: 7, alignItems: 'center', backgroundColor: walletTxnTab === tab ? '#1a1a2e' : '#f0f0f0' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: walletTxnTab === tab ? '#fff' : '#888', textTransform: 'capitalize' }}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transaction list */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
          {filteredTxns.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Text style={{ fontSize: 36 }}>💸</Text>
              <Text style={{ color: '#bbb', marginTop: 10, fontSize: 14 }}>Koi transaction nahi mili</Text>
            </View>
          ) : filteredTxns.map((t: any, i: number) => (
            <View key={t.id || i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, elevation: 1 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.type === 'credit' ? '#e8f5e9' : '#ffebee', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 18 }}>{t.type === 'credit' ? '↓' : '↑'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: '#1a1a2e', fontWeight: '600' }} numberOfLines={1}>{t.description || (t.type === 'credit' ? 'Credited' : 'Debited')}</Text>
                <Text style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{fmtDate(t.created_at)}</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: t.type === 'credit' ? '#2e7d32' : '#c62828' }}>
                {t.type === 'credit' ? '+' : '-'}₹{parseFloat(t.amount).toFixed(0)}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Razorpay.me WebView modal */}
        {walletWebView && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', zIndex: 999 }}>
            <View style={{ backgroundColor: '#1a1a2e', paddingTop: 50, paddingBottom: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => setWalletWebView(false)} style={{ marginRight: 14 }}>
                <Text style={{ color: '#fff', fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 }}>Pay ₹{walletAddAmt} via Razorpay</Text>
            </View>
            <WebView
              source={{ uri: walletWebViewUrl }}
              style={{ flex: 1 }}
              onNavigationStateChange={(navState) => {
                const url = navState.url || '';
                if (url.includes('razorpay.me') && (url.includes('success') || url.includes('payment_id') || url.includes('congratulations'))) {
                  const match = url.match(/payment_id=([^&]+)/);
                  const pid = match?.[1] || `manual_${Date.now()}`;
                  confirmTopup(pid);
                }
              }}
              injectedJavaScript={`
                (function() {
                  const observer = new MutationObserver(() => {
                    const body = document.body.innerText || '';
                    if (body.includes('Payment Successful') || body.includes('Payment successful') || body.includes('Thank you') || body.includes('success')) {
                      const pidMatch = body.match(/pay_[A-Za-z0-9]+/);
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_success', payment_id: pidMatch ? pidMatch[0] : 'manual_${Date.now()}' }));
                    }
                  });
                  observer.observe(document.body, { childList: true, subtree: true });
                })();
                true;
              `}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'payment_success') { confirmTopup(data.payment_id || `manual_${Date.now()}`); }
                } catch (_e) {}
              }}
              javaScriptEnabled
              domStorageEnabled
            />
            {/* Manual confirm button */}
            <View style={{ padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0' }}>
              <Text style={{ color: '#888', fontSize: 12, textAlign: 'center', marginBottom: 10 }}>Agar payment complete ho gayi ho:</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  style={{ flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#1a1a2e' }}
                  placeholder="Payment ID (optional)"
                  value={walletPaymentId}
                  onChangeText={setWalletPaymentId}
                  placeholderTextColor="#bbb"
                />
                <TouchableOpacity onPress={() => confirmTopup(walletPaymentId || `manual_${Date.now()}`)}
                  style={{ backgroundColor: '#4CAF50', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11, justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>✓ Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScreenIn>
    );
  }

  // ═══ REFERRAL ═══
  if (screen === 'referral') return (
    <ScreenIn style={s.screen}>
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
          <Bouncy style={[s.btn, { marginTop: 0, marginBottom: 0, width: '100%' }]} onPress={shareReferral}>
            <Text style={s.btnTxt}>📤 Share Karo</Text>
          </Bouncy>
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
    </ScreenIn>
  );
// ═══ CANCELLATION POLICY ═══
  if (screen === 'policy') return (
    <ScreenIn style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></TouchableOpacity>
        <Text style={s.topTitle}>📋 Cancellation Policy</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ backgroundColor: '#e8f5e9', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#2e7d32', marginBottom: 6 }}>✅ Free Cancellation</Text>
          <Text style={{ fontSize: 13, color: '#388e3c', lineHeight: 20 }}>Ride book karne ke <Text style={{ fontWeight: 'bold' }}>1 minute ke andar</Text> cancel karo — bilkul FREE! Koi charge nahi.</Text>
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 12 }}>💰 Cancel Fees (1 min ke baad)</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' }}>
            <Text style={{ fontSize: 13, color: '#666' }}>Driver assign hone ke baad</Text>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#e94560' }}>₹10</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ fontSize: 13, color: '#666' }}>Driver pahunchne ke baad</Text>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#e94560' }}>₹15</Text>
          </View>
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 8 }}>🎯 Daily Free Cancels</Text>
          <Text style={{ fontSize: 13, color: '#666', lineHeight: 20 }}>Har din <Text style={{ fontWeight: 'bold', color: '#1a1a2e' }}>3 free cancellations</Text> milti hain. Uske baad har cancel pe ₹10 fee lagti hai.</Text>
        </View>

        <View style={{ backgroundColor: '#fff3e0', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#e65100', marginBottom: 8 }}>⚠️ Trust Score</Text>
          <Text style={{ fontSize: 13, color: '#ef6c00', lineHeight: 20 }}>Bar-bar cancel karne se aapka trust score girta hai. Kam trust score wale customers ko booking mein dikkat ho sakti hai. Kripya zaruri hone par hi cancel karein.</Text>
        </View>

        <View style={{ backgroundColor: '#e3f2fd', borderRadius: 14, padding: 16 }}>
          <Text style={{ fontSize: 13, color: '#1565c0', lineHeight: 20 }}>💡 Cancel karte waqt aapko hamesha dikhega ki kitni fee lagegi aur kitne free cancels bache hain.</Text>
        </View>
      </ScrollView>
    </ScreenIn>
  );


  // ═══ SAVED PLACES ═══
  if (screen === 'saved') return (
    <ScreenIn style={s.screen}>
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
          ? <EmptyAnim icon="📍" title="Koi saved place nahi" sub="Home aur Office save karo — booking aur bhi fast ho jaayegi!" />
          : savedPlaces.map((p, i) => (
            <View key={i} style={s.menuItem}>
              <View style={s.menuIconBox}><Text style={{ fontSize: 18 }}>{p.label === 'Home' ? '🏠' : p.label === 'Office' ? '💼' : '📍'}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>{p.label}</Text><Text style={{ fontSize: 11, color: '#999' }} numberOfLines={1}>{p.address}</Text></View>
              <TouchableOpacity onPress={() => deletePlace(p.id)}><Text style={{ fontSize: 18 }}>🗑️</Text></TouchableOpacity>
            </View>
          ))
        }
      </ScrollView>
    </ScreenIn>
  );

  // ═══ HOURLY BOOKING ═══
  if (screen === 'hourly') {
    const pkg = HOURLY_PACKAGES[hVehicle]?.[hPackageHours];
    const hVehicleIcons: any = { auto: '🛺', bike: '🏍️', car: '🚕', eriksha: '🛵' };
    const hHourLabel = (h: number) => h === 8 ? 'Full Day' : `${h} Hours`;
    const hHourEmoji = (h: number) => h === 2 ? '⏱️' : h === 4 ? '🕐' : h === 6 ? '🕕' : '☀️';
    const fmtTime = (sec: number) => `${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor((sec%3600)/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;

    const searchHourly = async (text: string, which: 'pickup'|'drop') => {
      if (text.length < 3) { which === 'pickup' ? setHPickupSugg([]) : setHDropSugg([]); return; }
      try {
        const r = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${MAPS_KEY}&components=country:in&location=26.8467,80.9462&radius=100000`);
        const d = await r.json();
        const list = (d.predictions || []).map((p: any) => ({ id: p.place_id, text: p.description }));
        which === 'pickup' ? setHPickupSugg(list) : setHDropSugg(list);
      } catch (_e) {}
    };

    const selectHourlyPlace = async (placeId: string, text: string, which: 'pickup'|'drop') => {
      try {
        const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${MAPS_KEY}&fields=geometry`);
        const d = await r.json();
        const loc = d.result?.geometry?.location;
        if (which === 'pickup') { setHPickup(text); setHPickupCoords(loc || null); setHPickupSugg([]); }
        else { setHDrop(text); setHDropCoords(loc || null); setHDropSugg([]); }
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
          setHourlyStep('waiting');
          loadWallet(phone);
        } else {
          alert(data.error || 'Booking nahi hui');
        }
      } catch (e: any) { alert('Error: ' + e.message); }
    };

    const requestEarlyEnd = async () => {
      if (!hourlyBooking?.id) return;
      await apiPost('/api/hourly/early-end-request', { booking_id: hourlyBooking.id, requested_by: 'customer' });
      setHourlyBooking((p: any) => ({ ...p, early_end_requested_by: 'customer' }));
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
    if (hourlyStep === 'done') return (
      <ScreenIn style={s.screen}>
        <View style={[s.topBar, { justifyContent: 'center' }]}>
          <Text style={s.topTitle}>⏱️ Trip Complete!</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 60 }}>🎉</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', marginTop: 8 }}>Trip Khatam!</Text>
          </View>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, elevation: 3, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: '#888', marginBottom: 14, fontWeight: '600' }}>TRIP SUMMARY</Text>
            {[
              ['Vehicle', `${hVehicleIcons[hourlyBooking?.vehicle_type || hVehicle]} ${(hourlyBooking?.vehicle_type || hVehicle)?.toUpperCase()}`],
              ['Package', hHourLabel(hourlyBooking?.package_hours || hPackageHours)],
              ['Base Fare', `₹${hourlyBooking?.base_fare || pkg?.fare}`],
              ['Extra KM Charge', `₹${hourlyBooking?.extra_km_charge || 0}`],
              ['Total Paid', `₹${hourlyBooking?.total_fare || hourlyBooking?.base_fare || pkg?.fare}`],
              ['Refund to Wallet', `₹${hourlyBooking?.refund_amount || 0}`],
            ].map(([k, v], i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i < 5 ? 1 : 0, borderColor: '#f5f5f5' }}>
                <Text style={{ color: '#666', fontSize: 13 }}>{k}</Text>
                <Text style={{ color: '#1a1a2e', fontWeight: '600', fontSize: 13 }}>{v}</Text>
              </View>
            ))}
          </View>
          {(hourlyBooking?.refund_amount > 0) && (
            <View style={{ backgroundColor: '#e8f5e9', borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 22, marginRight: 10 }}>💰</Text>
              <Text style={{ color: '#2e7d32', fontSize: 13, flex: 1 }}>₹{hourlyBooking.refund_amount} aapke wallet mein wapas aa gaye!</Text>
            </View>
          )}
          <Bouncy style={s.btn} onPress={() => { setHourlyStep('book'); setHourlyBooking(null); setScreen('home'); }}>
            <Text style={s.btnTxt}>🏠 Ghar Wapas</Text>
          </Bouncy>
        </ScrollView>
      </ScreenIn>
    );

    // ── ACTIVE TRIP ──
    if (hourlyStep === 'active') return (
      <ScreenIn style={s.screen}>
        <View style={s.topBar}>
          <View style={{ width: 36 }} />
          <Text style={s.topTitle}>⏱️ Hourly Trip</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Timer */}
          <View style={{ backgroundColor: '#1a1a2e', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#aaa', fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>TRIP TIME</Text>
            <Text style={{ color: '#e94560', fontSize: 48, fontWeight: 'bold', fontVariant: ['tabular-nums'] }}>{fmtTime(hourlyTimerSec)}</Text>
            <Text style={{ color: '#aaa', fontSize: 12, marginTop: 6 }}>{hHourLabel(hourlyBooking?.package_hours || hPackageHours)} package</Text>
          </View>

          {/* OTP for driver if not started yet */}
          {hourlyBooking?.status === 'matched' && (
            <View style={{ backgroundColor: '#fff3e0', borderRadius: 14, padding: 16, marginBottom: 16, alignItems: 'center' }}>
              <Text style={{ color: '#e65100', fontSize: 12, marginBottom: 6 }}>Driver ko yeh OTP do — trip start hogi</Text>
              <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#1a1a2e', letterSpacing: 8 }}>{hourlyBooking?.otp}</Text>
            </View>
          )}

          {/* Driver info */}
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 }}>
            <Text style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>DRIVER</Text>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1a1a2e' }}>{hourlyBooking?.driver?.name || '...'}</Text>
            <Text style={{ color: '#666', fontSize: 13, marginTop: 2 }}>Vehicle: {hourlyBooking?.driver?.vehicle_no || '...'}</Text>
          </View>

          {/* Trip details */}
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 }}>
            {[
              ['Pickup', hourlyBooking?.pickup || hPickup],
              ['Drop', hourlyBooking?.drop_location || hDrop || 'Flexible'],
              ['Round Trip', (hourlyBooking?.is_roundtrip || hRoundTrip) ? 'Yes' : 'No'],
              ['KM Included', `${hourlyBooking?.km_included} km`],
              ['Extra KM Rate', `₹${HOURLY_PACKAGES[hVehicle]?.extra}/km`],
            ].map(([k, v], i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: i < 4 ? 1 : 0, borderColor: '#f5f5f5' }}>
                <Text style={{ color: '#888', fontSize: 13 }}>{k}</Text>
                <Text style={{ color: '#1a1a2e', fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' }} numberOfLines={1}>{v}</Text>
              </View>
            ))}
          </View>

          {/* Escrow badge */}
          <View style={{ backgroundColor: '#e8f5e9', borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, marginRight: 8 }}>✅</Text>
            <Text style={{ color: '#2e7d32', fontSize: 12, flex: 1 }}>₹{hourlyBooking?.base_fare} paid & held safely. Trip khatam hone par driver ko milega.</Text>
          </View>

          {/* Early end — driver requested, waiting for customer to confirm */}
          {hourlyBooking?.early_end_requested_by === 'driver' && (
            <View style={{ backgroundColor: '#fff3e0', borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <Text style={{ fontWeight: 'bold', color: '#e65100', marginBottom: 6 }}>⚠️ Driver Trip Khatam Karna Chahta Hai</Text>
              <Text style={{ color: '#666', fontSize: 12, marginBottom: 12 }}>Confirm karne par proportional payment hogi (min 70% driver ko).</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Bouncy style={{ flex: 1, backgroundColor: '#4CAF50', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={confirmEarlyEnd}><Text style={{ color: '#fff', fontWeight: 'bold' }}>✅ Confirm</Text></Bouncy>
                <Bouncy style={{ flex: 1, backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={rejectEarlyEnd}><Text style={{ color: '#333', fontWeight: 'bold' }}>✗ Reject</Text></Bouncy>
              </View>
            </View>
          )}

          {/* Customer wants to end early */}
          {!hourlyBooking?.early_end_requested_by && (
            <Bouncy style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 2, borderColor: '#e94560', alignItems: 'center' }} onPress={() => { if(confirm !== undefined) requestEarlyEnd(); else requestEarlyEnd(); }}>
              <Text style={{ color: '#e94560', fontWeight: 'bold' }}>⏹️ Trip Early End Request</Text>
              <Text style={{ color: '#999', fontSize: 11, marginTop: 4 }}>Driver se mutual agreement se trip khatam karein</Text>
            </Bouncy>
          )}
          {hourlyBooking?.early_end_requested_by === 'customer' && (
            <View style={{ backgroundColor: '#fff3e0', borderRadius: 12, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: '#e65100', fontWeight: '600' }}>⏳ Driver ke confirm ka intezaar...</Text>
              <Text style={{ color: '#999', fontSize: 11, marginTop: 4 }}>Driver ne abhi confirm nahi kiya</Text>
            </View>
          )}
        </ScrollView>
      </ScreenIn>
    );

    // ── WAITING FOR DRIVER ──
    if (hourlyStep === 'waiting') return (
      <ScreenIn style={s.screen}>
        <View style={s.topBar}>
          <View style={{ width: 36 }} />
          <Text style={s.topTitle}>⏱️ Driver Dhundh Rahe Hain</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <PulseView><Text style={{ fontSize: 72, marginBottom: 16 }}>⏱️</Text></PulseView>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 6 }}>Booking Confirmed!</Text>
          <View style={{ backgroundColor: '#e8f5e9', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>✅</Text>
            <Text style={{ color: '#2e7d32', fontWeight: '600' }}>₹{hourlyBooking?.fare} Payment Paid — Escrow Mein</Text>
          </View>
          <FloatingDots />
          <Text style={{ color: '#999', fontSize: 13, marginTop: 16, marginBottom: 24 }}>Aapke area mein {hVehicleIcons[hVehicle]} driver dhundh rahe hain...</Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, width: '100%', elevation: 2, marginBottom: 20 }}>
            {[
              ['Package', `${hHourEmoji(hPackageHours)} ${hHourLabel(hPackageHours)}`],
              ['Vehicle', `${hVehicleIcons[hVehicle]} ${hVehicle.charAt(0).toUpperCase() + hVehicle.slice(1)}`],
              ['Pickup', hPickup],
              ['KM Included', `${hourlyBooking?.km_included} km`],
              ['Fare (Held)', `₹${hourlyBooking?.fare}`],
            ].map(([k, v], i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: i < 4 ? 1 : 0, borderColor: '#f5f5f5' }}>
                <Text style={{ color: '#888', fontSize: 13 }}>{k}</Text>
                <Text style={{ color: '#1a1a2e', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{v}</Text>
              </View>
            ))}
          </View>
          <Bouncy style={{ borderRadius: 12, borderWidth: 2, borderColor: '#e94560', padding: 12, width: '100%', alignItems: 'center' }} onPress={cancelHourlyBooking}>
            <Text style={{ color: '#e94560', fontWeight: '600' }}>✗ Booking Cancel (Full Refund)</Text>
          </Bouncy>
        </View>
      </ScreenIn>
    );

    // ── BOOKING FORM ──
    return (
      <ScreenIn style={s.screen}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></TouchableOpacity>
          <Text style={s.topTitle}>⏱️ Book by Hour</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>

          {/* Vehicle Selector */}
          <Text style={s.secTitle}>Vehicle Type</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
            {[{id:'auto',icon:'🛺',label:'Auto'},{id:'bike',icon:'🏍️',label:'Bike'},{id:'car',icon:'🚕',label:'Car'},{id:'eriksha',icon:'🛵',label:'E-Riksha'}].map(v => (
              <Bouncy key={v.id} style={{ flex: 1, backgroundColor: hVehicle === v.id ? '#1a1a2e' : '#f5f5f5', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 2, borderColor: hVehicle === v.id ? '#e94560' : 'transparent' }} onPress={() => setHVehicle(v.id)}>
                <Text style={{ fontSize: 22 }}>{v.icon}</Text>
                <Text style={{ fontSize: 10, fontWeight: '600', marginTop: 3, color: hVehicle === v.id ? '#fff' : '#333' }}>{v.label}</Text>
              </Bouncy>
            ))}
          </View>

          {/* Package Cards */}
          <Text style={s.secTitle}>Package Select Karo</Text>
          {[2, 4, 6, 8].map(h => {
            const p = HOURLY_PACKAGES[hVehicle]?.[h];
            const sel = hPackageHours === h;
            return (
              <Bouncy key={h} onPress={() => setHPackageHours(h)} style={{ backgroundColor: sel ? '#1a1a2e' : '#fff', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 2, borderColor: sel ? '#e94560' : '#f0f0f0', flexDirection: 'row', alignItems: 'center', elevation: sel ? 4 : 1 }}>
                <Text style={{ fontSize: 28, marginRight: 14 }}>{hHourEmoji(h)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: sel ? '#fff' : '#1a1a2e' }}>{hHourLabel(h)}</Text>
                  <Text style={{ fontSize: 12, color: sel ? '#aaa' : '#999', marginTop: 2 }}>{p?.km} km included · extra ₹{HOURLY_PACKAGES[hVehicle]?.extra}/km</Text>
                </View>
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#e94560' }}>₹{p?.fare}</Text>
              </Bouncy>
            );
          })}

          {/* Location Inputs */}
          <Text style={[s.secTitle, { marginTop: 8 }]}>Pickup Location *</Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 4, elevation: 1, borderWidth: 1, borderColor: '#f0f0f0' }}>
            <TextInput style={{ fontSize: 14, color: '#1a1a2e' }} placeholder="📍 Pickup kahaan se?" placeholderTextColor="#bbb" value={hPickup}
              onChangeText={t => { setHPickup(t); searchHourly(t, 'pickup'); }} />
          </View>
          {hPickupSugg.length > 0 && (
            <View style={{ backgroundColor: '#fff', borderRadius: 10, elevation: 4, marginBottom: 8 }}>
              {hPickupSugg.slice(0, 4).map((s: any) => (
                <TouchableOpacity key={s.id} onPress={() => selectHourlyPlace(s.id, s.text, 'pickup')} style={{ padding: 12, borderBottomWidth: 1, borderColor: '#f5f5f5' }}>
                  <Text style={{ fontSize: 13, color: '#333' }} numberOfLines={1}>📍 {s.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[s.secTitle, { marginTop: 4 }]}>Drop Location (Optional)</Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 4, elevation: 1, borderWidth: 1, borderColor: '#f0f0f0' }}>
            <TextInput style={{ fontSize: 14, color: '#1a1a2e' }} placeholder="📍 Drop kahaan jaana hai? (agar pata ho)" placeholderTextColor="#bbb" value={hDrop}
              onChangeText={t => { setHDrop(t); searchHourly(t, 'drop'); }} />
          </View>
          {hDropSugg.length > 0 && (
            <View style={{ backgroundColor: '#fff', borderRadius: 10, elevation: 4, marginBottom: 8 }}>
              {hDropSugg.slice(0, 4).map((s: any) => (
                <TouchableOpacity key={s.id} onPress={() => selectHourlyPlace(s.id, s.text, 'drop')} style={{ padding: 12, borderBottomWidth: 1, borderColor: '#f5f5f5' }}>
                  <Text style={{ fontSize: 13, color: '#333' }} numberOfLines={1}>📍 {s.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Round Trip */}
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 8, marginBottom: 12, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a2e' }}>🔄 Round Trip</Text>
                <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Wapas pickup pe aana hai?</Text>
              </View>
              <Switch value={hRoundTrip} onValueChange={setHRoundTrip} trackColor={{ true: '#e94560' }} />
            </View>
            {hRoundTrip && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Drop pe rukna (hours):</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[1, 2, 3].map(h => (
                    <Bouncy key={h} onPress={() => setHStayHours(h)} style={{ flex: 1, backgroundColor: hStayHours === h ? '#1a1a2e' : '#f5f5f5', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ color: hStayHours === h ? '#fff' : '#333', fontWeight: 'bold' }}>{h}h</Text>
                    </Bouncy>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Fare Summary */}
          <View style={{ backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 10, letterSpacing: 1 }}>FARE SUMMARY</Text>
            {[
              [`${hHourLabel(hPackageHours)} (${hVehicleIcons[hVehicle]})`, `₹${pkg?.fare}`],
              [`KM Included`, `${pkg?.km} km`],
              [`Extra KM Rate`, `₹${HOURLY_PACKAGES[hVehicle]?.extra}/km`],
              [`Wallet Balance`, `₹${walletBalance.toFixed(0)}`],
            ].map(([k, v], i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: i < 3 ? 1 : 0, borderColor: '#2a2a4e' }}>
                <Text style={{ color: '#aaa', fontSize: 13 }}>{k}</Text>
                <Text style={{ color: i === 0 ? '#e94560' : '#fff', fontWeight: i === 0 ? 'bold' : '500', fontSize: 13 }}>{v}</Text>
              </View>
            ))}
            {walletBalance < (pkg?.fare || 0) && (
              <View style={{ marginTop: 10, backgroundColor: '#e94560', borderRadius: 8, padding: 8 }}>
                <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>⚠️ Wallet mein ₹{(pkg?.fare || 0) - walletBalance} aur chahiye — pehle add karo</Text>
              </View>
            )}
          </View>

          <Bouncy style={[s.btn, { opacity: walletBalance >= (pkg?.fare || 0) ? 1 : 0.5 }]} onPress={walletBalance >= (pkg?.fare || 0) ? bookHourly : () => setShowWallet(true)}>
            <Text style={s.btnTxt}>{walletBalance >= (pkg?.fare || 0) ? `✅ Book — ₹${pkg?.fare} Wallet Se` : `💳 Wallet Mein ₹${pkg?.fare} Add Karo`}</Text>
          </Bouncy>
        </ScrollView>
      </ScreenIn>
    );
  }

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

  // ═══ BOOKING — Map fit on top ═══
  if (screen === 'booking') return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setScreen('home'); setPickupSugg([]); setDropSugg([]); setEta(''); setPromoCode(''); setPromoDiscount(0); }} style={s.backBtn}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></TouchableOpacity>
        <Text style={s.topTitle}>Ride Book Karo</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={s.mapFit}>
        <MapWebView pickupCoords={pickupCoords} dropCoords={dropCoords} height={200} />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} />
      </View>
      <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, paddingTop: 16, paddingHorizontal: 16 }}>
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
          {eta ? (
            <Animated.View style={{ backgroundColor: eta.includes('Calculate') ? '#fff3e0' : '#e8f5e9', borderRadius: 10, padding: 10, marginBottom: 10, alignItems: 'center', opacity: eta.includes('Calculate') ? scratchAnim : 1 }}>
              <Text style={{ color: eta.includes('Calculate') ? '#e65100' : '#2e7d32', fontWeight: '600', fontSize: 13 }}>{eta}</Text>
            </Animated.View>
          ) : null}
          <TouchableOpacity style={s.locationBtn} onPress={useMyLocation}><Text style={{ color: '#2e7d32', fontWeight: '600', fontSize: 13 }}>📍 Meri Current Location Use Karo</Text></TouchableOpacity>
          <Text style={s.secTitle}>Ride Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {RIDES.map(r => (
              <TouchableOpacity key={r.id} style={[s.rideCard, rideType===r.id && s.rideCardActive]} onPress={() => setRideType(r.id)}>
                <Text style={{ fontSize: 24 }}>{r.icon}</Text>
                <Text style={[{ fontSize: 12, fontWeight: '700', marginTop: 4 }, rideType===r.id ? { color: '#fff' } : { color: '#333' }]}>{r.label}</Text>
                <Text style={[{ fontSize: 10 }, rideType===r.id ? { color: '#ddd' } : { color: '#999' }]}>{r.eta}</Text>
                {r.tag ? <View style={{ backgroundColor: '#4CAF50', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginTop: 2 }}><Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{r.tag}</Text></View> : null}
                <Text style={[{ fontSize: 12, fontWeight: 'bold', marginTop: 2 }, rideType===r.id ? { color: '#fff' } : { color: '#e94560' }]}>{fareEstimates[r.id] ? `₹${fareEstimates[r.id]}` : `₹${r.base}+`}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={[s.row, { marginBottom: 12 }]}>
            <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="🎫 Promo code (RIDE50)" autoCapitalize="characters" value={promoCode} onChangeText={setPromoCode} />
            <TouchableOpacity style={s.applyBtn} onPress={applyPromo}><Text style={{ color: '#e94560', fontWeight: 'bold' }}>Apply</Text></TouchableOpacity>
          </View>
          {promoDiscount > 0 ? <View style={{ backgroundColor: '#e8f5e9', borderRadius: 10, padding: 10, marginBottom: 10 }}><Text style={{ color: '#2e7d32', fontWeight: '600', fontSize: 13, textAlign: 'center' }}>✅ ₹{promoDiscount} discount applied!</Text></View> : null}
          {result ? <Text style={s.err}>{result}</Text> : null}
          <Bouncy style={[s.btn, loading && { opacity: 0.7 }]} onPress={bookRide} disabled={loading}>
            <Text style={s.btnTxt}>{loading ? '🔍 Driver dhundh raha hai...' : 'Ride Book Karo 🚀'}</Text>
          </Bouncy>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );

  // ═══ MATCHING — Map fit on top ═══
  if (screen === 'matching' && showCancelModal) return renderCancelModal();
  if (screen === 'matching') return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <Text style={s.topTitle}>{rideData?.driver ? '🚗 Driver mil gaya!' : '🔍 Driver dhundh rahe hain'}</Text>
      </View>
      <View style={s.mapFit}>
        <MapWebView pickupCoords={pickupCoords} dropCoords={dropCoords} driverLat={driverLoc?.lat} driverLng={driverLoc?.lng} customerLat={userCoords?.latitude} customerLng={userCoords?.longitude} height={220} />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} live={!!rideData?.driver} />
      </View>
      <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, paddingTop: 16, paddingHorizontal: 16 }}>
        <TripSteps step={rideData?.driver ? 1 : 0} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {rideData?.driver ? (
            <>
              <SuccessBurst />
              <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: '#4CAF50', marginBottom: 12 }}>Driver Mil Gaya! 🎉</Text>
              <View style={s.driverCard}>
                <View style={s.driverAvatar}><Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>{(rideData.driver.name||'D')[0].toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.driverName}>{rideData.driver.name}</Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>🚗 {rideData.driver.vehicle_no}</Text>
                  <Text style={{ fontSize: 12, color: '#f0a500', marginTop: 2 }}>⭐ 4.8</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <PulseView><Text style={{ fontSize: 18, fontWeight: 'bold', color: '#e94560' }}>{driverEta || (eta ? eta.split('·')[0].trim() : '...')}</Text></PulseView>
                  <Text style={{ fontSize: 10, color: '#666' }}>arriving</Text>
                  {driverDist ? <Text style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{driverDist} door</Text> : null}
                </View>
              </View>
              {/* Live ETA banner */}
              {driverEta ? (
                <View style={{ backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, marginRight: 10 }}>🚗</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>Aapka driver aa raha hai!</Text>
                    <Text style={{ color: '#4CAF50', fontSize: 13, marginTop: 2 }}>⏱️ {driverEta} mein pahunchega · {driverDist} door</Text>
                  </View>
                  <PulseView><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF50' }} /></PulseView>
                </View>
              ) : null}
              {rideData?.startOtp && (
                <View style={s.otpCard}>
                  <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 6 }}>🔐 Driver ko yeh OTP batao</Text>
                  <Text style={{ color: '#fff', fontSize: 34, fontWeight: 'bold', letterSpacing: 10 }}>{rideData.startOtp}</Text>
                </View>
              )}
              <View style={s.actionRow}>
                <Bouncy style={s.actionBtn} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
                  <View>
                    <Text style={{ fontSize: 22 }}>💬</Text>
                    {unreadChat > 0 && <View style={s.chatBadge}><Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{unreadChat}</Text></View>}
                  </View>
                  <Text style={{ fontSize: 10, color: '#555', marginTop: 3 }}>Chat</Text>
                </Bouncy>
                <Bouncy style={s.actionBtn} onPress={callDriver}><Text style={{ fontSize: 22 }}>📞</Text><Text style={{ fontSize: 10, color: '#555', marginTop: 3 }}>Call</Text></Bouncy>
                <Bouncy style={s.actionBtn} onPress={triggerSOS}><Text style={{ fontSize: 22 }}>🆘</Text><Text style={{ fontSize: 10, color: '#555', marginTop: 3 }}>SOS</Text></Bouncy>
              </View>
              {unreadChat > 0 && (
                <TouchableOpacity style={s.chatAlert} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>💬 Driver ne {unreadChat} message bheja — dekho</Text>
                </TouchableOpacity>
              )}
              {sosActive && <View style={[s.infoBox, { backgroundColor: '#ffeeee' }]}><Text style={{ fontSize: 13, color: '#c62828', fontWeight: 'bold' }}>🆘 Alert bheja! Police: 100 · Ambulance: 108</Text></View>}
              <TouchableOpacity style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e94560', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 }} onPress={() => setShowCancelModal(true)}>
                <Text style={{ color: '#e94560', fontWeight: 'bold', fontSize: 14 }}>✕ Ride Cancel karein {cancelTimer > 0 ? '(Free)' : '(₹15)'}</Text>
              </TouchableOpacity>
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
            <SlideUp>
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <RadarView />
                <FloatingDots />
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginTop: 14 }}>Driver dhundh rahe hain...</Text>
                <Text style={{ fontSize: 13, color: '#999', marginTop: 5, textAlign: 'center', paddingHorizontal: 20 }} numberOfLines={2}>{pickup} → {drop}</Text>

                {/* Fare badge */}
                <View style={{ backgroundColor: '#1a1a2e', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#e94560' }}>{rideData?.fare}</Text>
                  {eta ? <Text style={{ fontSize: 12, color: '#4CAF50' }}>{eta.replace('🕐 ', '')}</Text> : null}
                </View>

                {/* Cancel info */}
                <View style={{ backgroundColor: cancelTimer > 0 ? '#e8f5e9' : '#fff3e0', borderRadius: 14, padding: 14, marginTop: 16, width: '100%', borderWidth: 1, borderColor: cancelTimer > 0 ? '#c8e6c9' : '#ffe0b2' }}>
                  <Text style={{ fontSize: 13, color: cancelTimer > 0 ? '#2e7d32' : '#e65100', fontWeight: '700', textAlign: 'center' }}>
                    {cancelTimer > 0 ? `✅ ${cancelTimer}s tak FREE cancellation` : '⚠️ Ab cancel pe ₹10 fee lagega'}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 4 }}>Aaj {freeCancelsLeft} free cancels bache hain</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 14, width: '100%' }}>
                  <Bouncy onPress={() => setShowCancelModal(true)} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#e94560' }}>
                    <Text style={{ color: '#e94560', fontWeight: 'bold', fontSize: 14 }}>✕ Cancel {cancelTimer > 0 ? '(Free)' : '(₹10)'}</Text>
                  </Bouncy>
                  <Bouncy onPress={() => { setRideData(null); bookRide(); }} style={{ flex: 1, backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>🔄 Retry</Text>
                  </Bouncy>
                </View>
              </View>
            </SlideUp>
          )}
        </ScrollView>
      </View>
    </View>
  );
  // ═══ CANCEL MODAL (function) ═══
  function renderCancelModal() { return (
    <View style={s.screen}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30 }}>
          <View style={s.sheetHandle} />
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 6 }}>Ride Cancel karein?</Text>
          <View style={{ backgroundColor: cancelTimer > 0 ? '#e8f5e9' : '#fff3e0', borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: cancelTimer > 0 ? '#2e7d32' : '#e65100', fontWeight: '600' }}>
              {cancelTimer > 0 ? `✅ Abhi cancel FREE hai (${cancelTimer}s bache)` : '⚠️ Cancel fee ₹10 lagega'}
            </Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 10 }}>Cancel ka reason?</Text>
          {['Galti se book ho gaya', 'Bahut wait ho raha', 'Plan change ho gaya', 'Driver door hai', 'Koi aur reason'].map((reason, i) => (
            <TouchableOpacity key={i} style={{ backgroundColor: '#f5f5f5', borderRadius: 10, padding: 14, marginBottom: 8 }}
              onPress={async () => {
                if (rideData?.ride_id) {
                  const cd = await apiPost('/api/rides/cancel-smart', { ride_id: rideData.ride_id, cancelled_by: 'customer', reason, phone: phone || '9999999999' });
                  if (cd._error) setResult('❌ ' + cd.message);
                  else setResult(cd.penalty > 0 ? `⚠️ ${cd.message}` : `✅ ${cd.message}`);
                  ride.clearRide();
                }
                setShowCancelModal(false); setScreen('home'); setRideData(null); setPickup(''); setDrop(''); setEta('');
              }}>
              <Text style={{ fontSize: 14, color: '#333' }}>{reason}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={{ borderWidth: 1.5, borderColor: '#1a1a2e', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 }}
            onPress={() => setShowCancelModal(false)}>
            <Text style={{ color: '#1a1a2e', fontWeight: 'bold', fontSize: 14 }}>Nahi, ride rakhni hai</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );}


// ═══ IN-RIDE — Map fit on top ═══
  if (screen === 'inride') return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <Text style={s.topTitle}>🚗 Ride Chal Rahi Hai</Text>
      </View>
      <View style={s.mapFit}>
        <MapWebView pickupCoords={pickupCoords} dropCoords={dropCoords} driverLat={driverLoc?.lat} driverLng={driverLoc?.lng} customerLat={userCoords?.latitude} customerLng={userCoords?.longitude} height={220} />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} live={true} />
      </View>
      <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, paddingTop: 16, paddingHorizontal: 16 }}>
        <TripSteps step={2} />
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
    <ScreenIn style={s.screen}>
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
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
          { color: '#4CAF50', icon: '💵', title: 'Cash Pay', sub: 'Driver ko cash do', fn: async () => {
            try {
              await fetch(`${API}/api/rides/payment-complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, payment_method: 'cash', phone: phone || '9999999999' }) });
            } catch (_e) {}
            setPaymentDone(true); setScreen('postride'); createScratchCard();
          }},
        ].map((p, i) => (
          <Bouncy key={i} style={[s.payBtn, { backgroundColor: p.color }]} onPress={p.fn}>
            <Text style={{ fontSize: 20 }}>{p.icon}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}><Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{p.title}</Text><Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 }}>{p.sub}</Text></View>
            <Text style={{ color: '#fff', fontSize: 18 }}>→</Text>
          </Bouncy>
        ))}
        {result ? <Text style={s.err}>{result}</Text> : null}
      </View>
    </ScrollView>
    </ScreenIn>
  );

  // ═══ POST-RIDE ═══
  if (screen === 'postride') return (
    <ScreenIn style={s.screen}>
      <Confetti />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View style={[s.hero, { paddingTop: 44 }]}>
        <Text style={{ fontSize: 50 }}>{paymentDone ? '✅' : '🎉'}</Text>
        <Text style={s.heroTitle}>{paymentDone ? 'Payment Done!' : 'Pahunch Gaye!'}</Text>
        <Text style={s.heroSub}>{pickup} → {drop}</Text>
        <Text style={{ color: '#e94560', fontSize: 26, fontWeight: 'bold', marginTop: 6 }}>{rideData?.fare}</Text>
      </View>
      <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
        <TripSteps step={3} />
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
        <Bouncy style={s.btn} onPress={async () => {
          if (rating > 0 && rideData?.ride_id) {
            try { await fetch(`${API}/api/rides/rate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, rating, review, tip }) }); } catch (_e) {}
          }
          setScreen('home'); setPickup(''); setDrop(''); setRating(0); setTab('home');
          setRideData(null); setPaymentDone(false); setResult(''); setScratchCard(null); setScratched(false); setEta(''); setPromoDiscount(0); setPromoCode(''); setUnreadChat(0);
          setDriverLoc(null); setDriverEta(''); setDriverDist('');
          ride.clearRide();
          loadHistory(phone); loadWallet(phone);
        }}>
          <Text style={s.btnTxt}>Done 🏠 Home Jao</Text>
        </Bouncy>
      </View>
      <View style={{ height: 24 }} />
      </ScrollView>
    </ScreenIn>
  );

  return <View />;

  function NavBarInner() {
    const navTabs = [
      { t: 'home',    icon: '🏠', lbl: 'Home'    },
      { t: 'history', icon: '🕐', lbl: 'Trips'   },
      { t: 'profile', icon: '👤', lbl: 'Profile' },
    ];
    return (
      <View style={s.nav}>
        {navTabs.map(({ t, icon, lbl }) => {
          const active = tab === t && screen === 'home';
          return (
            <TouchableOpacity key={t} style={s.navItem} onPress={() => { setScreen('home'); setTab(t); if(t==='history') loadHistory(phone); }} activeOpacity={0.65}>
              <Text style={[s.navIcon, active && { color: '#e94560' }]}>{icon}</Text>
              <Text style={[s.navLbl, active && s.navActive]}>{lbl}</Text>
              {active && <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: '#e94560', marginTop: 4 }} />}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
}

const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: '#f5f5f5' },
  mapFull:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  mapFit:        { height: 260, width: '100%', backgroundColor: '#e8eaed' },
  topOverlay:    { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 44, paddingHorizontal: 14 },
  topGlass:      { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 12, elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  greetingDark:  { color: '#1a1a2e', fontSize: 15, fontWeight: 'bold' },
  subTxtDark:    { color: '#666', fontSize: 11, marginTop: 2 },
  greeting:      { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  subTxt:        { color: '#aaa', fontSize: 11, marginTop: 2 },
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
  btn:           { backgroundColor: '#e94560', borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 6, marginBottom: 6, elevation: 5, shadowColor: '#e94560', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
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
  searchBox:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, elevation: 6, shadowColor: '#1a1a2e', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, borderWidth: 1.5, borderColor: '#f0f0f0' },
  searchIcon:    { fontSize: 18, marginRight: 10 },
  searchPh:      { color: '#aaa', fontSize: 14, flex: 1 },
  quickRow:      { flexDirection: 'row', gap: 10, marginBottom: 14 },
  quickBtn:      { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 13, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 },
  quickIcon:     { fontSize: 22 },
  quickLbl:      { fontSize: 10, color: '#555', marginTop: 4, fontWeight: '600' },
  secTitle:      { fontSize: 14, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 10, marginTop: 4 },
  recentItem:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, marginBottom: 8 },
  recentRoute:   { fontSize: 13, fontWeight: '600', color: '#1a1a2e' },
  recentDate:    { fontSize: 11, color: '#999', marginTop: 2 },
  recentFare:    { fontSize: 14, fontWeight: 'bold', color: '#e94560' },
  promoBanner:   { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 14, marginBottom: 14, elevation: 4, shadowColor: '#1a1a2e', shadowOpacity: 0.25, shadowRadius: 8 },
  promoTxt:      { color: '#fff', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  nav:           { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingBottom: 16, paddingTop: 8, elevation: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12 },
  navItem:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon:       { fontSize: 22, color: '#ccc' },
  navLbl:        { fontSize: 10, color: '#bbb', marginTop: 3, letterSpacing: 0.3 },
  navActive:     { color: '#e94560', fontWeight: 'bold' },
  histCard:      { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6 },
  histIcon:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  profileHero:   { backgroundColor: '#1a1a2e', borderRadius: 18, padding: 24, alignItems: 'center', marginBottom: 14, elevation: 4 },
  profileAvatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#e94560', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  profileName:   { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  profilePhone:  { color: '#aaa', fontSize: 13, marginTop: 3 },
  badge:         { backgroundColor: '#f0a500', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 12, marginTop: 8 },
  walletCard:    { backgroundColor: '#e94560', borderRadius: 16, padding: 20, marginBottom: 12, elevation: 4 },
  walletBox:     { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 12, elevation: 2, borderWidth: 1, borderColor: '#f0f0f0' },
  amtBtn:        { flex: 1, minWidth: 68, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#e94560', alignItems: 'center', backgroundColor: '#fff8f8' },
  menuItem:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
  menuIconBox:   { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  logoutBtn:     { borderWidth: 1.5, borderColor: '#e94560', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 6, marginBottom: 24 },
  locBox:        { backgroundColor: '#f9f9f9', borderRadius: 14, padding: 14, marginBottom: 10 },
  dotGreen:      { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF50', marginRight: 10 },
  dotRed:        { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e94560', marginRight: 10 },
  locDivider:    { height: 1, backgroundColor: '#e8e8e8', marginVertical: 8, marginLeft: 20 },
  locationBtn:   { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#c8e6c9' },
  suggBox:       { backgroundColor: '#fff', borderRadius: 10, marginTop: 4, elevation: 20, borderWidth: 1, borderColor: '#f0f0f0', zIndex: 99 },
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
  payBtn:        { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 18, marginBottom: 12, elevation: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
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
