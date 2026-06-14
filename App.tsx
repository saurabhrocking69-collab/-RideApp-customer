import { useState, useEffect, useRef } from 'react';
import RazorpayCheckout from 'react-native-razorpay';
import {
  View, Text, TextInput, TouchableOpacity, Image,
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

type Screen = 'login' | 'otp' | 'home' | 'booking' | 'matching' | 'inride' | 'payment' | 'postride' | 'chat' | 'referral' | 'saved' | 'policy' | 'hourly' | 'wallet' | 'hourly-info';

const HOURLY_PACKAGES: any = {
  auto:         { 2:{fare:180,km:20}, 4:{fare:320,km:40}, 6:{fare:460,km:60}, 8:{fare:580,km:80},  24:{fare:1500,km:200}, 48:{fare:2800,km:400}, 72:{fare:4000,km:600}, extra:8  },
  bike:         { 2:{fare:120,km:20}, 4:{fare:210,km:40}, 6:{fare:300,km:60}, 8:{fare:380,km:80},  24:{fare:1000,km:200}, 48:{fare:1800,km:400}, 72:{fare:2600,km:600}, extra:5  },
  car:          { 2:{fare:260,km:20}, 4:{fare:460,km:40}, 6:{fare:660,km:60}, 8:{fare:840,km:80},  24:{fare:2200,km:200}, 48:{fare:4000,km:400}, 72:{fare:5800,km:600}, extra:12 },
  eriksha:      { 2:{fare:150,km:20}, 4:{fare:270,km:40}, 6:{fare:390,km:60}, 8:{fare:490,km:80},  24:{fare:1200,km:200}, 48:{fare:2200,km:400}, 72:{fare:3200,km:600}, extra:7  },
  ultra_luxury: { 2:{fare:800,km:20}, 4:{fare:1400,km:40}, 6:{fare:2000,km:60}, 8:{fare:2600,km:80}, 24:{fare:6000,km:200}, 48:{fare:10000,km:400}, 72:{fare:14000,km:600}, extra:25 },
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
  const [showUpiQr, setShowUpiQr] = useState(false);
  // Ride Extension (same driver, new drop)
  const [extReq, setExtReq]           = useState<any>(null);   // { id, driver_name, estimated_fare }
  const [extStep, setExtStep]         = useState<'idle'|'form'|'waiting'|'done'>('idle');
  const [extDrop, setExtDrop]         = useState('');
  const [extDropCoords, setExtDropCoords] = useState<any>(null);
  const [extDropSugg, setExtDropSugg] = useState<any[]>([]);
  const [extRespSec, setExtRespSec]   = useState(60);
  const [extWindowSec, setExtWindowSec] = useState(900); // 15-min window
  const [extMsg, setExtMsg]           = useState('');
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
  const [showExtInfo, setShowExtInfo] = useState(false);
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
  // Scheduling
  const [hScheduled, setHScheduled]     = useState(false);
  const [hScheduleDate, setHScheduleDate] = useState('');
  const [hScheduleHour, setHScheduleHour] = useState('');
  const [hScheduleMin, setHScheduleMin]   = useState('00');
  // Hourly chat
  const [hChatOpen, setHChatOpen]         = useState(false);
  const [hChatMsgs, setHChatMsgs]         = useState<any[]>([]);
  const [hChatInput, setHChatInput]       = useState('');
  const [hChatUnread, setHChatUnread]     = useState(0);
  // Extension request
  const [hExtendStep, setHExtendStep]   = useState<'idle'|'choose'|'pending'>('idle');
  const [hExtendHours, setHExtendHours] = useState(1);
  const [hExtendMin, setHExtendMin]     = useState(0);
  const [hExtendCost, setHExtendCost]   = useState<any>(null);
  // Approaching limit
  const [hApproachLimit, setHApproachLimit] = useState<any>(null);
  // Loyalty
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyCashback, setLoyaltyCashback] = useState(0);
  const [activeOffers, setActiveOffers]   = useState<any[]>([]);
  const [offerDismissed, setOfferDismissed] = useState<Set<number>>(new Set());

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
      if (screen === 'hourly-info') { setScreen('home'); return true; }
      if (screen === 'wallet') { setScreen('home'); setTab('profile'); return true; }
      if (screen === 'referral') { setScreen('home'); return true; }
      if (screen === 'saved') { setScreen('home'); return true; }
      if (screen === 'policy') { setScreen('home'); return true; }
      if (screen === 'hourly') {
        if (hourlyStep === 'book') { setHPickupSugg([]); setHDropSugg([]); setScreen('home'); return true; }
        // Block back during active/waiting — ride is in progress
        return true;
      }
      if (screen === 'payment') return true;
      if (screen === 'postride') return true;
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [screen, tab, hourlyStep]);

  useEffect(() => {
    (async () => {
      try {
        const sp = await AsyncStorage.getItem('userPhone');
        const sn = await AsyncStorage.getItem('userName');
        if (!sp) return;
        setPhone(sp); setUserName(sn || 'Rider'); loadHistory(sp); loadWallet(sp); registerFCM(sp); loadOffers();
        // Check for active hourly ride
        const savedHourlyId = await AsyncStorage.getItem('activeHourlyId');
        if (savedHourlyId) {
          try {
            const data = await apiGet('/api/hourly/active?phone=' + sp);
            if (data.booking && ['pending','matched','active'].includes(data.booking.status)) {
              setHourlyBooking({ ...data.booking, driver: data.driver || null });
              setHourlyStep(data.booking.status === 'active' ? 'active' : 'waiting');
              setScreen('hourly');
              return;
            } else {
              await AsyncStorage.removeItem('activeHourlyId');
            }
          } catch (_e) {}
        }
        setScreen('home');
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
            setRideData((p: any) => p ? { ...p, startOtp: data.ride.start_otp, driver: { name: data.ride.driver_name, phone: data.ride.driver_phone, vehicle_no: data.ride.vehicle_no, vehicle_brand: data.ride.vehicle_brand, vehicle_model: data.ride.vehicle_model, upi_id: data.ride.driver_upi_id } } : p);
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
          if (data.approaching_limit) setHApproachLimit(data.approaching_limit);
          if (b.status === 'matched' && hourlyStep === 'waiting') {
            // Scheduled rides: don't show OTP/active screen until within 20 min of scheduled time
            const scheduledFarAway = b.scheduled_at &&
              (new Date(b.scheduled_at).getTime() - Date.now() > 20 * 60 * 1000);
            if (!scheduledFarAway) setHourlyStep('active');
          }
          if (b.status === 'active' && hourlyStep === 'waiting') setHourlyStep('active');
          if (b.status === 'completed') { setHourlyStep('done'); loadWallet(phone); AsyncStorage.removeItem('activeHourlyId').catch(() => {}); }
          // Extension accepted by driver — reset UI
          if (!b.extend_requested_hours && hExtendStep === 'pending') setHExtendStep('idle');
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

  // Hourly chat polling — only while chat panel is open
  useEffect(() => {
    if (screen !== 'hourly' || !hChatOpen || !hourlyBooking?.id) return;
    const load = async () => {
      try {
        const d = await apiGet(`/api/hourly/chat/${hourlyBooking.id}`);
        setHChatMsgs(d.messages || []);
        setHChatUnread(0);
      } catch (_e) {}
    };
    load();
    const iv = setInterval(load, 2500);
    return () => clearInterval(iv);
  }, [screen, hChatOpen, hourlyBooking?.id]);

  // Hourly chat badge — count unread when panel is closed
  useEffect(() => {
    if (screen !== 'hourly' || hChatOpen || !hourlyBooking?.id || hourlyStep === 'book') return;
    let lastCount = hChatMsgs.length;
    const iv = setInterval(async () => {
      try {
        const d = await apiGet(`/api/hourly/chat/${hourlyBooking.id}`);
        const msgs = d.messages || [];
        if (msgs.length > lastCount) { setHChatUnread(n => n + (msgs.length - lastCount)); lastCount = msgs.length; setHChatMsgs(msgs); }
      } catch (_e) {}
    }, 5000);
    return () => clearInterval(iv);
  }, [screen, hChatOpen, hourlyStep, hourlyBooking?.id]);

  // Auto-fill GPS location when booking screen opens and pickup is empty
  useEffect(() => {
    if (screen === 'booking' && !pickup) useMyLocation();
  }, [screen]);

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

  // Extension polling — customer waits for driver to accept/reject
  useEffect(() => {
    if (screen !== 'postride' || extStep !== 'waiting' || !extReq?.id) return;
    const iv = setInterval(async () => {
      try {
        const d = await apiGet(`/api/rides/extension-status/${extReq.id}`);
        setExtRespSec(d.seconds_left ?? 0);
        if (d.status === 'accepted' && d.new_ride_id) {
          clearInterval(iv);
          const ride = await apiGet(`/api/rides/status/${d.new_ride_id}`);
          if (ride.ride) {
            setRideData({ ride_id: d.new_ride_id, fare: `₹${Math.round(extReq.estimated_fare)}`, driver: ride.ride.driver, vehicle_type: ride.ride.ride_type, payment_method: ride.ride.payment_method });
            setPickup(extReq.extPickup || drop); setDrop(extDrop);
            setPaymentDone(false); setExtStep('done'); setExtReq(null);
            setScreen('matching');
          }
        } else if (d.status === 'rejected') {
          clearInterval(iv); setExtStep('idle'); setExtMsg('Driver ne reject kiya — naya ride book karo ya koi aur driver try karo');
        } else if (d.status === 'expired' || (d.seconds_left !== undefined && d.seconds_left <= 0)) {
          clearInterval(iv); setExtStep('idle'); setExtMsg('Driver ne respond nahi kiya — naya ride book karo');
        }
      } catch (_e) {}
    }, 2000);
    return () => clearInterval(iv);
  }, [screen, extStep, extReq?.id]);

  // Extension 15-min window countdown on postride screen
  useEffect(() => {
    if (screen !== 'postride') return;
    setExtWindowSec(900); setExtMsg('');
    const iv = setInterval(() => setExtWindowSec(s => { if (s <= 1) { clearInterval(iv); return 0; } return s - 1; }), 1000);
    return () => clearInterval(iv);
  }, [screen]);

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
  const loadOffers = async () => {
    try { const r = await fetch(`${API}/api/offers/active?role=customer`); const d = await r.json(); setActiveOffers(d.offers || []); } catch (_e) {}
  };
  const loadLoyalty = async (ph: string) => {
    try { const r = await fetch(`${API}/api/loyalty/my-points?phone=${ph}`); const d = await r.json(); setLoyaltyPoints(d.points || 0); setLoyaltyCashback(d.cashback_available || 0); } catch (_e) {}
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

  const searchExtDrop = async (text: string) => {
    if (text.length < 3) { setExtDropSugg([]); return; }
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${MAPS_KEY}&components=country:in&location=26.8467,80.9462&radius=50000`);
      const data = await res.json();
      setExtDropSugg(data.predictions?.map((p: any) => ({ id: p.place_id, text: p.description })) || []);
    } catch (_e) {}
  };

  const geocodeExtDrop = async (address: string) => {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`);
      const data = await res.json();
      const loc = data.results?.[0]?.geometry?.location;
      if (loc) setExtDropCoords({ lat: loc.lat, lng: loc.lng });
    } catch (_e) {}
  };

  const sendExtensionRequest = async () => {
    if (!extDrop || !rideData?.ride_id) return;
    setLoading(true);
    try {
      const data = await apiPost('/api/rides/extension-request', {
        original_ride_id: rideData.ride_id,
        customer_phone: phone,
        new_drop: extDrop,
        new_drop_lat: extDropCoords?.lat || null,
        new_drop_lng: extDropCoords?.lng || null,
      });
      if (data.success) {
        setExtReq({ id: data.extension_id, driver_name: data.driver_name, driver_phone: data.driver_phone, estimated_fare: data.estimated_fare, extPickup: drop });
        setExtRespSec(60);
        setExtStep('waiting');
      } else {
        setExtMsg(data.error || 'Request nahi bheji ja saki');
        if (data.expired || data.busy) setExtStep('idle');
      }
    } catch (_e) { setExtMsg('Network error — retry karo'); }
    setLoading(false);
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
        registerFCM(phone); loadOffers();
    
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

  const rideIcon = (type: string) => type === 'auto' ? '🛺' : type === 'bike' ? '🏍️' : type === 'eriksha' ? '🛵' : type === 'luxury' ? '🚙' : '🚕';

  const RIDES = [
    { id: 'bike',    icon: '🏍️', label: 'Bike',        base: 15, rate: 8,  eta: '2-3 min', tag: 'FASTEST', tagColor: '#FF6B35', desc: 'Traffic cut karo fast' },
    { id: 'auto',    icon: '🛺', label: 'Auto',         base: 25, rate: 12, eta: '3-5 min', tag: null,      tagColor: '',        desc: 'Budget friendly ride' },
    { id: 'car',     icon: '🚕', label: 'Car',           base: 40, rate: 15, eta: '5-7 min', tag: 'POPULAR', tagColor: '#2196F3', desc: 'AC • Comfortable' },
    { id: 'eriksha', icon: '🛵', label: 'E-Riksha',      base: 20, rate: 10, eta: '4-6 min', tag: 'ECO',     tagColor: '#4CAF50', desc: 'Eco-friendly ride' },
    { id: 'luxury',  icon: '🚙', label: 'Ultra Luxury',  base: 80, rate: 25, eta: '7-10 min', tag: 'PREMIUM', tagColor: '#9C27B0', desc: 'Premium SUV experience' },
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

          {/* Active marketing campaign banners */}
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
                  <TouchableOpacity onPress={() => setOfferDismissed(s => new Set([...s, offer.id]))} style={{ padding: 6 }}>
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
              if (hourlyBooking && ['pending','matched','active'].includes(hourlyBooking.status)) {
                setScreen('hourly');
                return;
              }
              setHourlyStep('book'); setHPickup(''); setHDrop(''); setHPickupCoords(null); setHDropCoords(null); setHPickupSugg([]); setHDropSugg([]); setHRoundTrip(false); setHStayHours(1); setHourlyBooking(null); setScreen('hourly');
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
          {/* Loyalty points */}
          {loyaltyPoints > 0 && (
            <View style={{ marginTop: 10, backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, marginRight: 10 }}>⭐</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFD700', fontWeight: '800', fontSize: 15 }}>{loyaltyPoints} Loyalty Points</Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 }}>100 points = ₹10 cashback · Aapke paas: ₹{loyaltyCashback} cashback available</Text>
              </View>
            </View>
          )}
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
    const hVehicleIcons: any = { auto: '🛺', bike: '🏍️', car: '🚕', eriksha: '🛵', ultra_luxury: '💎' };
    const hHourLabel = (h: number) => h >= 24 ? `${h/24} Day${h > 24 ? 's' : ''}` : h === 8 ? 'Full Day (8h)' : `${h} Hours`;
    const hHourEmoji = (h: number) => h >= 72 ? '🗓️' : h >= 48 ? '📅' : h >= 24 ? '🌙' : h === 2 ? '⏱️' : h === 4 ? '🕐' : h === 6 ? '🕕' : '☀️';
    const fmtTime = (sec: number) => `${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor((sec%3600)/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;

    // Haversine kept for future use (round-trip ETA estimate)
    const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    const useCurrentLocationPickup = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { alert('Location permission chahiye'); return; }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude: lat, longitude: lng } = loc.coords;
        setHPickupCoords({ lat, lng });
        // Reverse geocode
        const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}&language=en`);
        const d = await r.json();
        const addr = d.results?.[0]?.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setHPickup(addr);
        setHPickupSugg([]);
      } catch (e) { alert('Location nahi mili — manually daalo'); }
    };

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
      if (hScheduled && (!hScheduleDate || !hScheduleHour)) { alert('Date aur time select karo'); return; }
      let scheduled_at: string | null = null;
      if (hScheduled && hScheduleDate && hScheduleHour) {
        const hh = hScheduleHour.padStart(2, '0');
        const mm = (hScheduleMin || '00').padStart(2, '0');
        const dt = new Date(`${hScheduleDate}T${hh}:${mm}:00`);
        if (dt <= new Date()) { alert('Future ka time select karo'); return; }
        scheduled_at = dt.toISOString();
      }
      try {
        const body: any = { phone, vehicle_type: hVehicle, package_hours: hPackageHours, pickup: hPickup, pickup_lat: hPickupCoords?.lat, pickup_lng: hPickupCoords?.lng, is_roundtrip: hRoundTrip, stay_hours: hStayHours };
        if (hDrop) { body.drop_location = hDrop; body.drop_lat = hDropCoords?.lat; body.drop_lng = hDropCoords?.lng; }
        if (scheduled_at) body.scheduled_at = scheduled_at;
        const data = await apiPost('/api/hourly/book', body);
        if (data.success) {
          setHourlyBooking({ id: data.booking_id, fare: data.fare, km_included: data.km_included, status: 'pending', vehicle_type: hVehicle, package_hours: hPackageHours, pickup: hPickup, drop_location: hDrop, is_roundtrip: hRoundTrip, stay_hours: hStayHours, scheduled_at });
          AsyncStorage.setItem('activeHourlyId', String(data.booking_id)).catch(() => {});
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
          <View style={[s.topBar, { justifyContent: 'center' }]}>
            <Text style={s.topTitle}>⏱️ Trip Complete!</Text>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 60 }}>🎉</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', marginTop: 8 }}>Trip Khatam!</Text>
              <Text style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
                {actualHrs}h {actualMins}m chali · {b.actual_km || 0} km
              </Text>
            </View>

            {/* Total fare highlight */}
            <View style={{ backgroundColor: '#1a1a2e', borderRadius: 16, padding: 18, marginBottom: 16, alignItems: 'center' }}>
              <Text style={{ color: '#aaa', fontSize: 12, letterSpacing: 1 }}>TOTAL PAID</Text>
              <Text style={{ color: '#e94560', fontSize: 42, fontWeight: 'bold', marginTop: 4 }}>₹{totalPaid.toFixed(0)}</Text>
              <Text style={{ color: '#aaa', fontSize: 11, marginTop: 4 }}>Wallet se deducted (escrow release)</Text>
            </View>

            {/* Detailed breakdown */}
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, elevation: 3, marginBottom: 16 }}>
              <Text style={{ fontSize: 13, color: '#888', marginBottom: 14, fontWeight: '700', letterSpacing: 0.5 }}>PAYMENT BREAKDOWN</Text>

              {/* Base package */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f5f5f5' }}>
                <View>
                  <Text style={{ color: '#333', fontSize: 13, fontWeight: '600' }}>Base Package</Text>
                  <Text style={{ color: '#999', fontSize: 11 }}>{hHourLabel(b.package_hours || hPackageHours)} · {b.km_included || 0} km</Text>
                </View>
                <Text style={{ color: '#1a1a2e', fontWeight: '700', fontSize: 14 }}>₹{basePkgFare > 0 ? basePkgFare.toFixed(0) : (parseFloat(b.base_fare || 0) - extFare).toFixed(0)}</Text>
              </View>

              {/* Extension if any */}
              {extFare > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f5f5f5' }}>
                  <View>
                    <Text style={{ color: '#1565c0', fontSize: 13, fontWeight: '600' }}>⏱️ Extension</Text>
                    <Text style={{ color: '#999', fontSize: 11 }}>{extMinutes >= 60 ? `${Math.floor(extMinutes/60)}h ${extMinutes%60}m` : `${extMinutes} min`} extra</Text>
                  </View>
                  <Text style={{ color: '#1565c0', fontWeight: '700', fontSize: 14 }}>₹{extFare.toFixed(0)}</Text>
                </View>
              )}

              {/* Extra km */}
              {extraKmChg > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f5f5f5' }}>
                  <View>
                    <Text style={{ color: '#e65100', fontSize: 13, fontWeight: '600' }}>Extra KM Charge</Text>
                    <Text style={{ color: '#999', fontSize: 11 }}>{b.extra_km || 0} km × ₹{HOURLY_PACKAGES[b.vehicle_type || hVehicle]?.extra || 8}/km</Text>
                  </View>
                  <Text style={{ color: '#e65100', fontWeight: '700', fontSize: 14 }}>₹{extraKmChg.toFixed(0)}</Text>
                </View>
              )}

              {/* Vehicle */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f5f5f5' }}>
                <Text style={{ color: '#666', fontSize: 13 }}>Vehicle</Text>
                <Text style={{ color: '#1a1a2e', fontWeight: '600', fontSize: 13 }}>{hVehicleIcons[b.vehicle_type || hVehicle]} {(b.vehicle_type || hVehicle)?.toUpperCase()}</Text>
              </View>

              {/* Actual time */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f5f5f5' }}>
                <Text style={{ color: '#666', fontSize: 13 }}>Actual Duration</Text>
                <Text style={{ color: '#1a1a2e', fontWeight: '600', fontSize: 13 }}>{actualHrs}h {actualMins}m</Text>
              </View>

              {/* KM used */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                <Text style={{ color: '#666', fontSize: 13 }}>Total KM</Text>
                <Text style={{ color: '#1a1a2e', fontWeight: '600', fontSize: 13 }}>{b.actual_km || 0} km</Text>
              </View>
            </View>

            {/* Refund badge */}
            {refund > 0 && (
              <View style={{ backgroundColor: '#e8f5e9', borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 22, marginRight: 10 }}>💰</Text>
                <Text style={{ color: '#2e7d32', fontSize: 13, flex: 1 }}>₹{refund.toFixed(0)} aapke wallet mein wapas aa gaye!</Text>
              </View>
            )}

            <Bouncy style={s.btn} onPress={() => { setHourlyStep('book'); setHourlyBooking(null); setHExtendStep('idle'); setHApproachLimit(null); setScreen('home'); }}>
              <Text style={s.btnTxt}>🏠 Ghar Wapas</Text>
            </Bouncy>
          </ScrollView>
        </ScreenIn>
      );
    }

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
          {(() => {
            const minLeft = hApproachLimit?.min_left ?? null;
            const isCritical = hApproachLimit?.critical;
            const isWarn = hApproachLimit?.warn;
            const timerColor = isCritical ? '#f44336' : isWarn ? '#ff9800' : '#e94560';
            const remainLabel = minLeft !== null ? (minLeft >= 60 ? `${Math.floor(minLeft/60)}h ${minLeft%60}m remaining` : `${minLeft} min remaining`) : `${hHourLabel(hourlyBooking?.package_hours || hPackageHours)} package`;
            return (
              <View style={{ backgroundColor: '#1a1a2e', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ color: '#aaa', fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>ELAPSED TIME</Text>
                <Text style={{ color: timerColor, fontSize: 48, fontWeight: 'bold', fontVariant: ['tabular-nums'] }}>{fmtTime(hourlyTimerSec)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                  <Text style={{ fontSize: 12, color: isCritical ? '#f44336' : isWarn ? '#ff9800' : '#4caf50', fontWeight: '700' }}>
                    {isCritical ? '🚨' : isWarn ? '⚠️' : '⏳'} {remainLabel}
                  </Text>
                </View>
              </View>
            );
          })()}

          {/* OTP — only when driver matched and scheduled time is near (or immediate ride) */}
          {hourlyBooking?.status === 'matched' && (() => {
            const farAway = hourlyBooking?.scheduled_at &&
              (new Date(hourlyBooking.scheduled_at).getTime() - Date.now() > 20 * 60 * 1000);
            if (farAway) return null;
            return (
              <View style={{ backgroundColor: '#fff3e0', borderRadius: 14, padding: 16, marginBottom: 16, alignItems: 'center' }}>
                <Text style={{ color: '#e65100', fontSize: 12, marginBottom: 6 }}>Driver ko yeh OTP do — trip start hogi</Text>
                <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#1a1a2e', letterSpacing: 8 }}>{hourlyBooking?.otp}</Text>
              </View>
            );
          })()}

          {/* Driver info */}
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 }}>
            <Text style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>DRIVER</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1a1a2e' }}>{hourlyBooking?.driver?.name || '...'}</Text>
                {(hourlyBooking?.driver?.vehicle_brand || hourlyBooking?.driver?.vehicle_model) ? (
                  <Text style={{ color: '#1a1a2e', fontSize: 12, fontWeight: '600', marginTop: 1 }}>
                    {[hourlyBooking.driver.vehicle_brand, hourlyBooking.driver.vehicle_model].filter(Boolean).join(' ')}
                  </Text>
                ) : null}
                <Text style={{ color: '#666', fontSize: 12, marginTop: 1 }}>🚗 {hourlyBooking?.driver?.vehicle_no || '...'}</Text>
                {hourlyBooking?.driver_phone && (
                  <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>📱 +91 {hourlyBooking.driver_phone}</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Bouncy style={{ backgroundColor: '#e8f5e9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' }}
                  onPress={() => hourlyBooking?.driver_phone && Linking.openURL(`tel:${hourlyBooking.driver_phone}`)}>
                  <Text style={{ fontSize: 18 }}>📞</Text>
                  <Text style={{ fontSize: 9, color: '#2e7d32', fontWeight: '600', marginTop: 2 }}>Call</Text>
                </Bouncy>
                <Bouncy style={{ backgroundColor: '#e3f2fd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' }}
                  onPress={() => hourlyBooking?.driver_phone && Linking.openURL(`https://wa.me/91${hourlyBooking.driver_phone}`)}>
                  <Text style={{ fontSize: 18 }}>💬</Text>
                  <Text style={{ fontSize: 9, color: '#1565c0', fontWeight: '600', marginTop: 2 }}>WA</Text>
                </Bouncy>
                <Bouncy style={{ backgroundColor: hChatOpen ? '#1a1a2e' : '#f3e5f5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' }}
                  onPress={() => { setHChatOpen(o => !o); setHChatUnread(0); }}>
                  {hChatUnread > 0 && !hChatOpen && (
                    <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#e94560', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{hChatUnread}</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 18 }}>💬</Text>
                  <Text style={{ fontSize: 9, color: hChatOpen ? '#fff' : '#7b1fa2', fontWeight: '600', marginTop: 2 }}>Chat</Text>
                </Bouncy>
              </View>
            </View>
          </View>

          {/* Hourly Chat Panel */}
          {hChatOpen && (
            <View style={{ backgroundColor: '#fff', borderRadius: 14, marginBottom: 16, elevation: 3, overflow: 'hidden' }}>
              <View style={{ backgroundColor: '#1a1a2e', padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>💬 Driver se Chat</Text>
                <TouchableOpacity onPress={() => setHChatOpen(false)}><Text style={{ color: '#aaa', fontSize: 18 }}>✕</Text></TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 200, padding: 10 }} ref={r => { if (r && hChatMsgs.length) r.scrollToEnd({ animated: false }); }}>
                {hChatMsgs.length === 0 && (
                  <Text style={{ color: '#bbb', fontSize: 12, textAlign: 'center', marginTop: 20, marginBottom: 20 }}>Koi message nahi — pehla message bhejo</Text>
                )}
                {hChatMsgs.map((m: any, i: number) => (
                  <View key={i} style={{ alignItems: m.sender === 'customer' ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
                    <View style={{ backgroundColor: m.sender === 'customer' ? '#e94560' : '#f0f0f0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '80%' }}>
                      <Text style={{ color: m.sender === 'customer' ? '#fff' : '#1a1a2e', fontSize: 13 }}>{m.message}</Text>
                    </View>
                    <Text style={{ color: '#bbb', fontSize: 9, marginTop: 2 }}>{m.sender === 'customer' ? 'Aap' : 'Driver'}</Text>
                  </View>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', padding: 8, borderTopWidth: 1, borderColor: '#f0f0f0', gap: 8 }}>
                <TextInput
                  style={{ flex: 1, backgroundColor: '#f9f9f9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13, color: '#1a1a2e' }}
                  placeholder="Message likhein..." placeholderTextColor="#bbb"
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
                <Bouncy style={{ backgroundColor: '#e94560', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center' }}
                  onPress={async () => {
                    const msg = hChatInput.trim();
                    if (!msg || !hourlyBooking?.id) return;
                    setHChatInput('');
                    await apiPost('/api/hourly/chat/send', { booking_id: hourlyBooking.id, sender: 'customer', message: msg });
                    const d = await apiGet(`/api/hourly/chat/${hourlyBooking.id}`);
                    setHChatMsgs(d.messages || []);
                  }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Send</Text>
                </Bouncy>
              </View>
            </View>
          )}

          {/* Trip details */}
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 }}>
            {[
              ['Pickup', hourlyBooking?.pickup || hPickup],
              ['Pehla Stop', hourlyBooking?.drop_location || hDrop || 'Flexible — driver ke sath jaao'],
              ['Round Trip', (hourlyBooking?.is_roundtrip || hRoundTrip) ? '✅ Haan' : 'Nahi'],
              ['KM Included', `${hourlyBooking?.km_included} km`],
              ['Extra KM Rate', `₹${HOURLY_PACKAGES[hourlyBooking?.vehicle_type || hVehicle]?.extra}/km`],
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

          {/* Live KM tracker — always visible during active trip */}
          {hourlyBooking?.status === 'active' && hApproachLimit && (() => {
            const traveled = parseFloat(hourlyBooking.actual_km || 0);
            const included = parseFloat(hourlyBooking.km_included || 0);
            const extraKm = Math.max(0, traveled - included);
            const extraRate = HOURLY_PACKAGES[hourlyBooking.vehicle_type || hVehicle]?.extra || 8;
            const extraCharge = Math.round(extraKm * extraRate);
            return (
              <View style={{ backgroundColor: extraKm > 0 ? '#fce4ec' : '#e8f5e9', borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: extraKm > 0 ? '#ef9a9a' : '#a5d6a7' }}>
                <Text style={{ fontSize: 18, marginRight: 10 }}>🛣️</Text>
                <View style={{ flex: 1 }}>
                  {extraKm > 0 ? (
                    <>
                      <Text style={{ color: '#c62828', fontWeight: '700', fontSize: 13 }}>+{extraKm.toFixed(1)} km extra — ₹{extraCharge} trip end pe pay karein</Text>
                      <Text style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{included} km package mein | ab tak: {traveled.toFixed(1)} km</Text>
                    </>
                  ) : (
                    <Text style={{ color: '#2e7d32', fontSize: 12, fontWeight: '600' }}>
                      {traveled.toFixed(1)} / {included} km — Package limit safe hai ✓
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 11, color: '#888' }}>⏰ {hApproachLimit.min_left}m left</Text>
              </View>
            );
          })()}

          {/* Time warning banner — primary constraint */}
          {hApproachLimit?.warn && hourlyBooking?.status === 'active' && (
            <View style={{ backgroundColor: hApproachLimit.critical ? '#ffebee' : '#fff3e0', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 2, borderColor: hApproachLimit.critical ? '#f44336' : '#ff9800', flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 20, marginRight: 10 }}>{hApproachLimit.critical ? '🚨' : '⚠️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', color: hApproachLimit.critical ? '#c62828' : '#e65100', fontSize: 14, marginBottom: 4 }}>
                  {hApproachLimit.critical ? 'Sirf ~' + hApproachLimit.min_left + ' min bacha!' : '⏰ ~' + hApproachLimit.min_left + ' minute bacha hai'}
                </Text>
                {hApproachLimit.is_roundtrip ? (
                  <Text style={{ color: hApproachLimit.critical ? '#c62828' : '#bf360c', fontSize: 12, fontWeight: '700' }}>
                    🔄 Round Trip — Abhi wapas pickup ke liye chalo!
                  </Text>
                ) : (
                  <Text style={{ color: hApproachLimit.critical ? '#c62828' : '#e65100', fontSize: 12 }}>
                    Trip extend karo ya driver se wrap up karo
                  </Text>
                )}
                {hExtendStep === 'idle' && (
                  <TouchableOpacity onPress={() => setHExtendStep('choose')}
                    style={{ marginTop: 8, backgroundColor: hApproachLimit.is_roundtrip ? '#1565c0' : '#ff9800', borderRadius: 8, padding: 8, alignSelf: 'flex-start' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                      {hApproachLimit.is_roundtrip ? '⏱️ Extension Chahiye?' : '⏱️ Extend Karo'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Extension choose UI */}
          {hExtendStep === 'choose' && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 3, borderWidth: 2, borderColor: '#1a1a2e' }}>
              <Text style={{ fontWeight: 'bold', color: '#1a1a2e', fontSize: 15, marginBottom: 12 }}>⏱️ Trip Extend Karo</Text>

              {/* Hours row */}
              <Text style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>Extra Hours:</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {[0, 1, 2, 3, 4].map(h => (
                  <Bouncy key={h} onPress={() => { setHExtendHours(h); if (h > 0) setHExtendMin(0); }} style={{ flex: 1, backgroundColor: hExtendHours === h ? '#1a1a2e' : '#f5f5f5', borderRadius: 10, padding: 8, alignItems: 'center' }}>
                    <Text style={{ color: hExtendHours === h ? '#fff' : '#333', fontWeight: 'bold', fontSize: 11 }}>{h === 0 ? 'Min' : `+${h}h`}</Text>
                  </Bouncy>
                ))}
              </View>

              {/* Minutes row — always visible, add extra mins to hours */}
              <Text style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>
                {hExtendHours === 0 ? 'Extra Minutes (minimum 15):' : 'Extra Minutes (optional):'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {(hExtendHours === 0 ? [15, 30, 45, 60] : [0, 15, 30, 45]).map(m => (
                  <Bouncy key={m} onPress={() => setHExtendMin(m)} style={{ flex: 1, backgroundColor: hExtendMin === m ? '#1a1a2e' : '#f5f5f5', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                    <Text style={{ color: hExtendMin === m ? '#fff' : '#333', fontWeight: 'bold', fontSize: 12 }}>
                      {hExtendHours === 0 ? `${m}m` : m === 0 ? 'None' : `+${m}m`}
                    </Text>
                  </Bouncy>
                ))}
              </View>

              {/* Summary label */}
              {(hExtendHours > 0 || hExtendMin >= 15) && (
                <Text style={{ color: '#1a1a2e', fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
                  Extension: {hExtendHours > 0 && hExtendMin > 0 ? `${hExtendHours}h ${hExtendMin}m` : hExtendHours > 0 ? `${hExtendHours} hour${hExtendHours > 1 ? 's' : ''}` : `${hExtendMin} minutes`}
                </Text>
              )}

              {/* Cost preview */}
              {(hExtendHours > 0 || hExtendMin >= 15) && (() => {
                const pkg = HOURLY_PACKAGES[hourlyBooking?.vehicle_type || hVehicle];
                const totalDecimal = hExtendHours + hExtendMin / 60;
                let cost = 0;
                if (hExtendMin === 0 && hExtendHours >= 1 && pkg?.[hExtendHours]) {
                  cost = pkg[hExtendHours].fare;
                } else {
                  const perHr = (hourlyBooking?.base_fare || 0) / (hourlyBooking?.package_hours || 1);
                  cost = Math.round(perHr * totalDecimal);
                }
                const extraKm = hExtendMin === 0 && hExtendHours >= 1 && pkg?.[hExtendHours]
                  ? pkg[hExtendHours].km
                  : Math.round((hourlyBooking?.km_included || 0) / (hourlyBooking?.package_hours || 1) * totalDecimal);
                return (
                  <View style={{ backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <Text style={{ fontWeight: 'bold', color: '#1a1a2e', fontSize: 14 }}>Estimated Cost: ₹{cost}</Text>
                    <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>+{extraKm} km included · extra ₹{pkg?.extra || 8}/km</Text>
                    <Text style={{ color: '#888', fontSize: 11, marginTop: 2 }}>Wallet se deduct hoga — driver ke accept karne par</Text>
                  </View>
                );
              })()}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Bouncy style={{ flex: 1, backgroundColor: '#e0e0e0', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={() => { setHExtendStep('idle'); setHExtendHours(1); setHExtendMin(0); }}>
                  <Text style={{ color: '#333', fontWeight: 'bold' }}>Cancel</Text>
                </Bouncy>
                <Bouncy
                  style={{ flex: 2, backgroundColor: (hExtendHours > 0 || hExtendMin >= 15) ? '#e94560' : '#ccc', borderRadius: 10, padding: 12, alignItems: 'center' }}
                  onPress={async () => {
                    if (hExtendHours === 0 && hExtendMin < 15) { alert('Minimum 15 minute extension'); return; }
                    try {
                      const data = await apiPost('/api/hourly/request-extend-v2', { booking_id: hourlyBooking.id, extra_hours: hExtendHours, extra_minutes: hExtendMin, customer_phone: phone });
                      if (data.success) {
                        setHExtendStep('pending');
                        setHourlyBooking((p: any) => ({ ...p, extend_requested_hours: hExtendHours + hExtendMin / 60 }));
                        loadWallet(phone);
                        alert(`✅ Request bheji! ₹${data.extra_fare} hold ho gaye — driver ka intezaar karo`);
                      } else {
                        alert(data.message || 'Request nahi bheji ja saki');
                      }
                    } catch (_e) { alert('Error — dobara try karo'); }
                  }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>📤 Driver ko Request Bhejo</Text>
                </Bouncy>
              </View>
            </View>
          )}

          {/* Extension pending */}
          {hExtendStep === 'pending' && (
            <View style={{ backgroundColor: '#e3f2fd', borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, marginRight: 10 }}>⏳</Text>
              <View>
                <Text style={{ fontWeight: 'bold', color: '#1565c0', fontSize: 13 }}>Extension Request Pending</Text>
                <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>Driver ke response ka intezaar... ₹{Math.round(hourlyBooking?.extend_escrow || 0)} hold mein</Text>
              </View>
            </View>
          )}

          {/* Extend button (not near limit) */}
          {!hApproachLimit?.warn && hExtendStep === 'idle' && hourlyBooking?.status === 'active' && !hourlyBooking?.extend_requested_hours && (
            <Bouncy style={{ backgroundColor: '#e3f2fd', borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} onPress={() => setHExtendStep('choose')}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>⏱️</Text>
              <Text style={{ color: '#1565c0', fontWeight: '700' }}>Trip Extend Karo</Text>
            </Bouncy>
          )}

          {/* Driver completed early — customer must confirm or dispute (FCM fallback: polling picks this up) */}
          {hourlyBooking?.pending_customer_confirm && (
            <View style={{ backgroundColor: '#fff3e0', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: '#ff9800' }}>
              <Text style={{ fontWeight: 'bold', color: '#e65100', marginBottom: 4, fontSize: 16 }}>⚠️ Driver ne Trip Complete Kiya!</Text>
              <Text style={{ color: '#666', fontSize: 13, marginBottom: 4 }}>Kya trip actually complete hui? Confirm karo ya dispute karo.</Text>
              <Text style={{ color: '#999', fontSize: 11, marginBottom: 14 }}>10 min mein auto-confirm ho jayega</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Bouncy style={{ flex: 1, backgroundColor: '#4CAF50', borderRadius: 10, padding: 14, alignItems: 'center' }}
                  onPress={async () => {
                    try {
                      await apiPost('/api/hourly/customer-confirm-complete', { booking_id: hourlyBooking.id });
                      setHourlyStep('done'); loadWallet(phone);
                    } catch (_e) {}
                  }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>✅ Confirm</Text>
                  <Text style={{ color: '#c8e6c9', fontSize: 11, marginTop: 2 }}>Trip khatam hui</Text>
                </Bouncy>
                <Bouncy style={{ flex: 1, backgroundColor: '#ffebee', borderRadius: 10, padding: 14, alignItems: 'center' }}
                  onPress={async () => {
                    try {
                      await apiPost('/api/hourly/customer-dispute-complete', { booking_id: hourlyBooking.id, reason: 'Driver abandoned customer' });
                      setHourlyBooking((p: any) => ({ ...p, pending_customer_confirm: false, dispute_raised: true }));
                    } catch (_e) {}
                  }}>
                  <Text style={{ color: '#c62828', fontWeight: 'bold', fontSize: 15 }}>⚠️ Dispute</Text>
                  <Text style={{ color: '#ef9a9a', fontSize: 11, marginTop: 2 }}>Driver chhod gaya</Text>
                </Bouncy>
              </View>
            </View>
          )}

          {hourlyBooking?.dispute_raised && (
            <View style={{ backgroundColor: '#fce4ec', borderRadius: 14, padding: 14, marginBottom: 16, alignItems: 'center' }}>
              <Text style={{ fontWeight: 'bold', color: '#880e4f', marginBottom: 4 }}>🛡️ Dispute Raised — Admin Review Mein</Text>
              <Text style={{ color: '#666', fontSize: 12 }}>24h mein resolve hoga — paise escrow mein safe hain</Text>
            </View>
          )}

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
    if (hourlyStep === 'waiting') {
      const isScheduledFarAway = hourlyBooking?.scheduled_at &&
        (new Date(hourlyBooking.scheduled_at).getTime() - Date.now() > 20 * 60 * 1000);
      const driverAccepted = hourlyBooking?.status === 'matched';
      const scheduledTimeStr = hourlyBooking?.scheduled_at
        ? new Date(hourlyBooking.scheduled_at).toLocaleString('hi-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        : '';
      return (
        <ScreenIn style={s.screen}>
          <View style={s.topBar}>
            <View style={{ width: 36 }} />
            <Text style={s.topTitle}>{driverAccepted && isScheduledFarAway ? '🗓️ Booking Confirmed' : '⏱️ Driver Dhundh Rahe Hain'}</Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <PulseView><Text style={{ fontSize: 72, marginBottom: 16 }}>{driverAccepted && isScheduledFarAway ? '✅' : '⏱️'}</Text></PulseView>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 10 }}>
              {driverAccepted && isScheduledFarAway ? 'Driver ne Accept kar liya!' : 'Booking Confirmed!'}
            </Text>

            {/* Scheduled ride — driver accepted, far away */}
            {driverAccepted && isScheduledFarAway && (
              <View style={{ backgroundColor: '#e8f5e9', borderRadius: 14, padding: 14, width: '100%', marginBottom: 14, alignItems: 'center' }}>
                <Text style={{ color: '#2e7d32', fontWeight: '700', fontSize: 15 }}>✅ Driver Confirm Ho Gaya</Text>
                <Text style={{ color: '#2e7d32', fontSize: 13, marginTop: 4 }}>📅 {scheduledTimeStr} pe aayega</Text>
                <Text style={{ color: '#777', fontSize: 11, marginTop: 6, textAlign: 'center' }}>App band kar sakte hain — scheduled time se pehle notification aayega</Text>
              </View>
            )}

            {/* Scheduled ride — still looking for driver */}
            {hourlyBooking?.scheduled_at && !driverAccepted && (
              <View style={{ backgroundColor: '#fff3e0', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 12, width: '100%' }}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>🗓️</Text>
                <View>
                  <Text style={{ color: '#e65100', fontWeight: '700', fontSize: 13 }}>Scheduled Booking</Text>
                  <Text style={{ color: '#e65100', fontSize: 12 }}>{scheduledTimeStr}</Text>
                </View>
              </View>
            )}

            <View style={{ backgroundColor: '#e8f5e9', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 16, width: '100%' }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>✅</Text>
              <Text style={{ color: '#2e7d32', fontWeight: '600' }}>₹{hourlyBooking?.fare} Payment Paid — Escrow Mein</Text>
            </View>

            {!(driverAccepted && isScheduledFarAway) && <FloatingDots />}
            <Text style={{ color: '#999', fontSize: 13, marginTop: 12, marginBottom: 20, textAlign: 'center' }}>
              {driverAccepted && isScheduledFarAway
                ? `Driver ko OTP ${scheduledTimeStr} ke paas milega`
                : hourlyBooking?.scheduled_at
                  ? `Driver ${scheduledTimeStr} ke paas milega`
                  : `Aapke area mein ${hVehicleIcons[hVehicle]} driver dhundh rahe hain...`}
            </Text>

            <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, width: '100%', elevation: 2, marginBottom: 20 }}>
              {[
                ['Package', `${hHourEmoji(hourlyBooking?.package_hours || hPackageHours)} ${hHourLabel(hourlyBooking?.package_hours || hPackageHours)}`],
                ['Vehicle', `${hVehicleIcons[hourlyBooking?.vehicle_type || hVehicle]} ${(hourlyBooking?.vehicle_type || hVehicle).charAt(0).toUpperCase() + (hourlyBooking?.vehicle_type || hVehicle).slice(1)}`],
                ['Pickup', hourlyBooking?.pickup || hPickup],
                ['KM Included', `${hourlyBooking?.km_included} km`],
                ['Fare (Held)', `₹${hourlyBooking?.fare}`],
              ].map(([k, v], i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: i < 4 ? 1 : 0, borderColor: '#f5f5f5' }}>
                  <Text style={{ color: '#888', fontSize: 13 }}>{k}</Text>
                  <Text style={{ color: '#1a1a2e', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{v}</Text>
                </View>
              ))}
            </View>

            {/* Cancel — only if driver hasn't accepted or it's still far from scheduled */}
            {(!driverAccepted || isScheduledFarAway) && (
              <Bouncy style={{ borderRadius: 12, borderWidth: 2, borderColor: '#e94560', padding: 12, width: '100%', alignItems: 'center' }} onPress={cancelHourlyBooking}>
                <Text style={{ color: '#e94560', fontWeight: '600' }}>✗ Booking Cancel (Full Refund)</Text>
              </Bouncy>
            )}
          </View>
        </ScreenIn>
      );
    }

    // ── BOOKING FORM ──
    return (
      <ScreenIn style={s.screen}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></TouchableOpacity>
          <Text style={s.topTitle}>⏱️ Book by Hour</Text>
          <TouchableOpacity onPress={() => setScreen('hourly-info')} style={{ width: 36, alignItems: 'flex-end' }}><Text style={{ fontSize: 20 }}>ℹ️</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>

          {/* Vehicle Selector */}
          <Text style={s.secTitle}>Vehicle Type</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {[{id:'auto',icon:'🛺',label:'Auto'},{id:'bike',icon:'🏍️',label:'Bike'},{id:'car',icon:'🚕',label:'Car'},{id:'eriksha',icon:'🛵',label:'E-Riksha'}].map(v => (
              <Bouncy key={v.id} style={{ flex: 1, backgroundColor: hVehicle === v.id ? '#1a1a2e' : '#f5f5f5', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 2, borderColor: hVehicle === v.id ? '#e94560' : 'transparent' }} onPress={() => setHVehicle(v.id)}>
                <Text style={{ fontSize: 22 }}>{v.icon}</Text>
                <Text style={{ fontSize: 10, fontWeight: '600', marginTop: 3, color: hVehicle === v.id ? '#fff' : '#333' }}>{v.label}</Text>
              </Bouncy>
            ))}
          </View>
          {/* Ultra Luxury — premium row */}
          <Bouncy
            onPress={() => setHVehicle('ultra_luxury')}
            style={{ backgroundColor: hVehicle === 'ultra_luxury' ? '#1a1a2e' : '#fff8e1', borderRadius: 12, padding: 14, marginBottom: 18, borderWidth: 2, borderColor: hVehicle === 'ultra_luxury' ? '#ffd700' : '#ffe082', flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 26, marginRight: 12 }}>💎</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: hVehicle === 'ultra_luxury' ? '#ffd700' : '#b8860b' }}>Ultra Luxury</Text>
              <Text style={{ fontSize: 11, color: hVehicle === 'ultra_luxury' ? '#aaa' : '#999', marginTop: 2 }}>BMW · Mercedes · Audi · Land Rover · Lexus</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#e94560' }}>₹{HOURLY_PACKAGES.ultra_luxury?.[hPackageHours]?.fare || 800}</Text>
          </Bouncy>

          {/* Package Cards */}
          <Text style={s.secTitle}>Package Select Karo</Text>
          {/* Standard / Multi-Day tab */}
          <View style={{ flexDirection: 'row', backgroundColor: '#f5f5f5', borderRadius: 12, padding: 4, marginBottom: 12 }}>
            {[['standard','⏱️ Same Day'],[' multi','📅 Multi-Day']].map(([key, label]) => {
              const isMulti = key.trim() === 'multi';
              const isMultiSelected = [24,48,72].includes(hPackageHours);
              const active = isMulti ? isMultiSelected : !isMultiSelected;
              return (
                <Bouncy key={key} onPress={() => { if (isMulti) setHPackageHours(24); else setHPackageHours(4); }} style={{ flex: 1, backgroundColor: active ? '#1a1a2e' : 'transparent', borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}>
                  <Text style={{ fontWeight: '700', color: active ? '#fff' : '#666', fontSize: 13 }}>{label}</Text>
                </Bouncy>
              );
            })}
          </View>
          {([24,48,72].includes(hPackageHours) ? [24,48,72] : [2,4,6,8]).map(h => {
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
          <View style={{ backgroundColor: '#fff', borderRadius: 12, elevation: 1, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 4 }}>
            <TextInput style={{ fontSize: 14, color: '#1a1a2e', padding: 12 }} placeholder="📍 Pickup kahaan se?" placeholderTextColor="#bbb" value={hPickup}
              onChangeText={t => { setHPickup(t); searchHourly(t, 'pickup'); }} />
            <TouchableOpacity onPress={useCurrentLocationPickup} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#f9f9ff', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
              <Text style={{ fontSize: 14, marginRight: 6 }}>🎯</Text>
              <Text style={{ fontSize: 12, color: '#1a1a2e', fontWeight: '600' }}>Current Location Use Karo</Text>
            </TouchableOpacity>
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

          <Text style={[s.secTitle, { marginTop: 4 }]}>Pehla Stop / Area (Optional)</Text>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 4, elevation: 1, borderWidth: 1, borderColor: '#f0f0f0' }}>
            <TextInput style={{ fontSize: 14, color: '#1a1a2e' }} placeholder="🗺️ Pehla stop ya area? (e.g. hospital, mall — optional)" placeholderTextColor="#bbb" value={hDrop}
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
          {/* KM info — educational, not a blocker */}
          <View style={{ backgroundColor: '#e3f2fd', borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 15, marginRight: 8 }}>ℹ️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#1565c0', fontWeight: '700', fontSize: 12 }}>Package mein {HOURLY_PACKAGES[hVehicle]?.[hPackageHours]?.km} km included</Text>
              <Text style={{ color: '#1565c0', fontSize: 11, marginTop: 3 }}>
                Aap kahi bhi ja sakte hain {hPackageHours} hour mein. Agar package km exceed hua to extra ₹{HOURLY_PACKAGES[hVehicle]?.extra}/km trip end pe pay hoga.
              </Text>
            </View>
          </View>

          {/* Round Trip */}
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 8, marginBottom: 12, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a2e' }}>🔄 Round Trip</Text>
                <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Driver aapko wapas pickup pe drop karega — package time ke andar</Text>
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

          {/* Scheduling */}
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 4, marginBottom: 14, elevation: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a2e' }}>🗓️ Schedule for Later?</Text>
                <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Advance booking — driver abhi/kal ayega</Text>
              </View>
              <Switch value={hScheduled} onValueChange={v => { setHScheduled(v); if (!v) { setHScheduleDate(''); setHScheduleHour(''); setHScheduleMin('00'); }}} trackColor={{ true: '#e94560' }} />
            </View>
            {!hScheduled && (
              <View style={{ marginTop: 10, backgroundColor: '#e8f5e9', borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, marginRight: 6 }}>⚡</Text>
                <Text style={{ color: '#2e7d32', fontSize: 12, fontWeight: '600' }}>Abhi Book Karo — Driver Turant Aayega</Text>
              </View>
            )}
            {hScheduled && (
              <View style={{ marginTop: 12 }}>
                {/* Date quick chips */}
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: '600' }}>Date:</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {[{label:'Aaj',days:0},{label:'Kal',days:1},{label:'+2 Din',days:2}].map(({ label, days }) => {
                    const d = new Date(); d.setDate(d.getDate() + days);
                    const ds = d.toISOString().split('T')[0];
                    const active = hScheduleDate === ds;
                    return (
                      <TouchableOpacity key={days} onPress={() => setHScheduleDate(ds)}
                        style={{ flex: 1, backgroundColor: active ? '#1a1a2e' : '#f5f5f5', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                        <Text style={{ color: active ? '#fff' : '#333', fontWeight: '700', fontSize: 13 }}>{label}</Text>
                        <Text style={{ color: active ? '#aaa' : '#999', fontSize: 10, marginTop: 2 }}>{d.getDate()}/{d.getMonth()+1}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Hour + Minute inputs — no colon needed */}
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: '600' }}>Time:</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: '#999', marginBottom: 4 }}>Hour (0–23)</Text>
                    <TextInput
                      style={{ borderWidth: 1.5, borderColor: hScheduleHour ? '#1a1a2e' : '#e0e0e0', borderRadius: 12, padding: 14, fontSize: 26, fontWeight: 'bold', color: '#1a1a2e', textAlign: 'center', width: '100%' }}
                      placeholder="14" placeholderTextColor="#ccc"
                      value={hScheduleHour} keyboardType="number-pad" maxLength={2}
                      onChangeText={v => { const n = v.replace(/\D/g,''); if (n === '' || parseInt(n) <= 23) setHScheduleHour(n.slice(0,2)); }}
                    />
                  </View>
                  <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#ccc', marginTop: 18 }}>:</Text>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: '#999', marginBottom: 4 }}>Minute</Text>
                    <TextInput
                      style={{ borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12, padding: 14, fontSize: 26, fontWeight: 'bold', color: '#1a1a2e', textAlign: 'center', width: '100%' }}
                      placeholder="00" placeholderTextColor="#ccc"
                      value={hScheduleMin} keyboardType="number-pad" maxLength={2}
                      onChangeText={v => { const n = v.replace(/\D/g,''); if (n === '' || parseInt(n) <= 59) setHScheduleMin(n.slice(0,2)); }}
                    />
                  </View>
                </View>
                {/* Minute quick buttons */}
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                  {['00','15','30','45'].map(m => (
                    <TouchableOpacity key={m} onPress={() => setHScheduleMin(m)}
                      style={{ flex: 1, backgroundColor: hScheduleMin === m ? '#e94560' : '#f5f5f5', borderRadius: 8, paddingVertical: 7, alignItems: 'center' }}>
                      <Text style={{ color: hScheduleMin === m ? '#fff' : '#666', fontSize: 13, fontWeight: '700' }}>:{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {hScheduleDate && hScheduleHour !== '' && (
                  <View style={{ backgroundColor: '#fff3e0', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, marginRight: 8 }}>📅</Text>
                    <Text style={{ color: '#e65100', fontSize: 13, fontWeight: '700' }}>
                      {hScheduleDate} at {hScheduleHour.padStart(2,'0')}:{(hScheduleMin||'00').padStart(2,'0')}
                    </Text>
                  </View>
                )}
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

  // ═══ HOURLY INFO ═══
  if (screen === 'hourly-info') return (
    <ScreenIn style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></TouchableOpacity>
        <Text style={s.topTitle}>⏱️ Book by Hour — Guide</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
        {/* How It Works */}
        <View style={{ backgroundColor: '#1a1a2e', borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <Text style={{ color: '#e94560', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>🚀 Kaise Kaam Karta Hai?</Text>
          {[
            ['1️⃣', 'Package select karo', '2h, 4h, 6h, 8h (same day) ya 1-3 din (multi-day)'],
            ['2️⃣', 'Pickup location daalo', 'Drop optional hai — driver aapke saath rahega'],
            ['3️⃣', 'Wallet se payment', 'Fare escrow mein hold hota hai (safe)'],
            ['4️⃣', 'Driver accept karta hai', 'OTP share karo trip start karne ke liye'],
            ['5️⃣', 'Trip enjoy karo', 'Timer chalta hai — driver sirf aapka hai poore package time tak'],
            ['6️⃣', 'Time khatam hone par', 'Driver Complete press karta hai — final payment auto settle'],
          ].map(([num, title, desc], i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 14 }}>
              <Text style={{ fontSize: 20, marginRight: 12 }}>{num}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{title}</Text>
                <Text style={{ color: '#aaa', fontSize: 12, marginTop: 2 }}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Packages & Fares */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2 }}>
          <Text style={{ color: '#1a1a2e', fontSize: 15, fontWeight: 'bold', marginBottom: 12 }}>💰 Packages & Fares</Text>
          <View style={{ flexDirection: 'row', backgroundColor: '#f8f8f8', borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <Text style={{ flex: 1, color: '#666', fontSize: 12, fontWeight: '700' }}>Package</Text>
            <Text style={{ width: 50, color: '#666', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>Auto</Text>
            <Text style={{ width: 50, color: '#666', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>Car</Text>
            <Text style={{ width: 50, color: '#666', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>Bike</Text>
          </View>
          {[
            ['2 Hours (20km)', 180, 260, 120],
            ['4 Hours (40km)', 320, 460, 210],
            ['6 Hours (60km)', 460, 660, 300],
            ['8 Hours (80km)', 580, 840, 380],
            ['1 Day (200km)', 1500, 2200, 1000],
            ['2 Days (400km)', 2800, 4000, 1800],
            ['3 Days (600km)', 4000, 5800, 2600],
          ].map(([label, auto, car, bike], i) => (
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: i < 6 ? 1 : 0, borderColor: '#f5f5f5' }}>
              <Text style={{ flex: 1, color: '#333', fontSize: 12 }}>{label}</Text>
              <Text style={{ width: 50, color: '#e94560', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>₹{auto}</Text>
              <Text style={{ width: 50, color: '#e94560', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>₹{car}</Text>
              <Text style={{ width: 50, color: '#e94560', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>₹{bike}</Text>
            </View>
          ))}
          <Text style={{ color: '#999', fontSize: 11, marginTop: 10 }}>Extra KM: Auto ₹8/km · Car ₹12/km · Bike ₹5/km · E-Riksha ₹7/km</Text>
        </View>

        {/* Core Rules */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 14, elevation: 2 }}>
          <Text style={{ color: '#1a1a2e', fontSize: 15, fontWeight: 'bold', marginBottom: 12 }}>📋 Important Rules</Text>
          {[
            ['✅', 'Escrow Payment', 'Aapka paisa trip complete hone par hi driver ko milega — 100% safe, koi risk nahi'],
            ['⏱️', 'Timer', 'OTP confirm hone par timer start. Package time khatam hone par driver Complete button press kar sakta hai'],
            ['🔒', 'Driver Time Lock', 'Driver package time khatam hone se pehle ride complete NAHI kar sakta — aapka poora time guaranteed hai'],
            ['🔄', 'Round Trip', 'Toggle on karo agar wapas pickup aana ho. Stay time bhi set kar sakte ho'],
            ['📍', 'Extra KM', 'Package KM se zyada chale to extra charge lagega — driver app pe live track hoga'],
            ['❌', 'Cancellation', 'Driver accept karne se pehle cancel = full refund. Baad mein cancel nahi ho sakta'],
          ].map(([icon, title, desc], i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, marginRight: 10, width: 30 }}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1a1a2e', fontWeight: '700', fontSize: 13 }}>{title}</Text>
                <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Early End Rules */}
        <View style={{ backgroundColor: '#fff3e0', borderRadius: 16, padding: 18, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: '#ff9800' }}>
          <Text style={{ color: '#e65100', fontSize: 15, fontWeight: 'bold', marginBottom: 10 }}>⏹️ Early End — Kaise Kaam Karta Hai?</Text>
          {[
            ['1️⃣', 'Request karo', 'Aap ya driver "Early End Request" bhejta hai app se'],
            ['2️⃣', 'Dono agree karein', 'Dusra party Accept kare — tabhi early end hoga'],
            ['3️⃣', 'Proportional payment', 'Actual time ke hisaab se fare calculate hoga — unused time refund wallet mein'],
            ['🚫', 'Driver shortcut nahi', 'Driver directly Complete nahi kar sakta — sirf mutual agreement se hi early end possible hai'],
            ['⚠️', 'Reject limit', 'Early end 2 baar reject karne par 15 min cooldown — 2 se zyada reject par support contact'],
          ].map(([icon, title, desc], i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 10 }}>
              <Text style={{ fontSize: 16, marginRight: 10, width: 30 }}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#bf360c', fontWeight: '700', fontSize: 13 }}>{title}</Text>
                <Text style={{ color: '#795548', fontSize: 12, marginTop: 2 }}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Extension Rules */}
        <View style={{ backgroundColor: '#e8eaf6', borderRadius: 16, padding: 18, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: '#3f51b5' }}>
          <Text style={{ color: '#283593', fontSize: 15, fontWeight: 'bold', marginBottom: 10 }}>🔄 Time Extension — Aur Time Chahiye?</Text>
          {[
            ['⏱️', 'Extend request', 'Active ride mein "+1h / +2h / +3h" option se request bhejein'],
            ['✅ Driver', 'Driver accept/reject kar sakta hai', 'Agar driver agree kare to extra hours add ho jaate hain'],
            ['💰 Extra fare', 'Auto-deducted wallet se', 'Extension ka additional fare wallet balance se instantly hold hoga'],
            ['🔒 Lock rule', 'Extension bhi same time-lock se cover', 'Extended time bhi poora karna hoga — early end ka option rahega'],
          ].map(([icon, title, desc], i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 10 }}>
              <Text style={{ fontSize: 16, marginRight: 10, width: 30 }}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1a237e', fontWeight: '700', fontSize: 13 }}>{title}</Text>
                <Text style={{ color: '#5c6bc0', fontSize: 12, marginTop: 2 }}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Schedule Rules */}
        <View style={{ backgroundColor: '#e0f2f1', borderRadius: 16, padding: 18, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: '#009688' }}>
          <Text style={{ color: '#004d40', fontSize: 15, fontWeight: 'bold', marginBottom: 10 }}>🗓️ Schedule for Later — Advance Booking</Text>
          {[
            ['📅', 'Kitni advance booking?', 'Koi bhi future time select karo — date + hour + minute se schedule karo'],
            ['🔍', 'Driver kab dikhega?', 'Driver ko booking 75 min pehle se dikhti hai — wo accept karega'],
            ['✅ Accept', 'Driver ne accept kar liya', 'Notification aata hai — app band kar sakte hain, scheduled time pe OTP aayega'],
            ['⏰ OTP timing', 'OTP kab milega?', 'Scheduled time se 20 min pehle se OTP active hoga — driver aayega aur start karega'],
            ['❌ Cancel', 'Schedule cancel karna ho?', 'Driver accept karne se pehle cancel karo — full refund. Baad mein mutual termination'],
          ].map(([icon, title, desc], i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 10 }}>
              <Text style={{ fontSize: 16, marginRight: 10, width: 30 }}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#004d40', fontWeight: '700', fontSize: 13 }}>{title}</Text>
                <Text style={{ color: '#00695c', fontSize: 12, marginTop: 2 }}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Tips */}
        <View style={{ backgroundColor: '#e8f5e9', borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <Text style={{ color: '#2e7d32', fontSize: 15, fontWeight: 'bold', marginBottom: 10 }}>💡 Pro Tips</Text>
          {[
            'Zyada trips plan ho to multi-day book karo — per-day cost kam padega',
            'Round trip toggle karo agar ek jagah rukna hai aur wapas aana hai',
            'Wallet top-up karke rakho — booking instant hogi',
            'Kal subah ki ride? Aaj raat schedule karo — tension-free',
            'Driver se chat karo pickup exact location confirm karne ke liye',
            'OTP sirf driver ko batao — trip start hone par hi share karo',
          ].map((tip, i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ color: '#4CAF50', marginRight: 8, fontSize: 14, fontWeight: 'bold' }}>•</Text>
              <Text style={{ color: '#1b5e20', fontSize: 13, flex: 1 }}>{tip}</Text>
            </View>
          ))}
        </View>

        <Bouncy style={s.btn} onPress={() => setScreen('hourly')}>
          <Text style={s.btnTxt}>⏱️ Abhi Book Karo</Text>
        </Bouncy>
      </ScrollView>
    </ScreenIn>
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

  // ═══ BOOKING — Premium Redesign ═══
  if (screen === 'booking') return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setScreen('home'); setPickupSugg([]); setDropSugg([]); setEta(''); setPromoCode(''); setPromoDiscount(0); }} style={s.backBtn}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.topTitle}>Ride Book Karo</Text>
          <Text style={{ color: '#9ba5b7', fontSize: 11, marginTop: 1 }}>Live fares • Lucknow</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>
      <View style={s.mapFit}>
        <MapWebView pickupCoords={pickupCoords} dropCoords={dropCoords} height={200} />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} />
      </View>
      <View style={{ flex: 1, backgroundColor: '#f5f6fa', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 16, paddingTop: 18 }}>

          {/* GPS Button */}
          <TouchableOpacity onPress={useMyLocation} style={{ backgroundColor: '#1a1a2e', borderRadius: 14, padding: 13, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e94560', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>📍</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Current Location Use Karo</Text>
              <Text style={{ color: '#777', fontSize: 11, marginTop: 1 }}>GPS se pickup auto-fill hoga</Text>
            </View>
            <Text style={{ color: '#e94560', fontSize: 22, fontWeight: '300' }}>›</Text>
          </TouchableOpacity>

          {/* Location Card */}
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF50', borderWidth: 2, borderColor: '#a5d6a7' }} />
              <TextInput style={{ flex: 1, fontSize: 14, color: '#1a1a2e', fontWeight: '500', paddingVertical: 6 }} placeholder="Pickup location..." placeholderTextColor="#bbb" value={pickup} onChangeText={(t) => { setPickup(t); searchPlaces(t, 'pickup'); }} returnKeyType="next" />
            </View>
            {pickupSugg.length > 0 && (
              <View style={[s.suggBox, { zIndex: 100 }]}>
                {pickupSugg.slice(0, 5).map((sg, i) => (
                  <TouchableOpacity key={i} style={[s.suggItem, { paddingVertical: 12 }]} onPress={() => { setPickup(sg.text); setPickupSugg([]); geocodePlace(sg.text, 'pickup'); if(drop) fetchEta(sg.text, drop); }}>
                    <Text style={{ fontSize: 15, marginRight: 8 }}>📍</Text>
                    <Text style={{ fontSize: 13, color: '#1a1a2e', flex: 1, fontWeight: '500' }} numberOfLines={2}>{sg.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={{ height: 1, backgroundColor: '#f0f0f0', marginVertical: 8, marginLeft: 20 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#e94560' }} />
              <TextInput style={{ flex: 1, fontSize: 14, color: '#1a1a2e', fontWeight: '500', paddingVertical: 6 }} placeholder="Drop location..." placeholderTextColor="#bbb" value={drop} onChangeText={(t) => { setDrop(t); searchPlaces(t, 'drop'); }} returnKeyType="done" />
            </View>
            {dropSugg.length > 0 && (
              <View style={[s.suggBox, { zIndex: 100 }]}>
                {dropSugg.slice(0, 5).map((sg, i) => (
                  <TouchableOpacity key={i} style={[s.suggItem, { paddingVertical: 12 }]} onPress={() => { setDrop(sg.text); setDropSugg([]); geocodePlace(sg.text, 'drop'); if(pickup) fetchEta(pickup, sg.text); }}>
                    <Text style={{ fontSize: 15, marginRight: 8 }}>🎯</Text>
                    <Text style={{ fontSize: 13, color: '#1a1a2e', flex: 1, fontWeight: '500' }} numberOfLines={2}>{sg.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ETA / Distance chip */}
          {eta ? (
            <View style={{ backgroundColor: eta.includes('Calculate') ? '#fff3e0' : '#e8f5e9', borderRadius: 12, padding: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18 }}>{eta.includes('Calculate') ? '🔄' : '🗺️'}</Text>
              <Text style={{ color: eta.includes('Calculate') ? '#e65100' : '#2e7d32', fontWeight: '700', fontSize: 13, flex: 1 }}>{eta}</Text>
            </View>
          ) : null}

          {/* Ride Type — 2-column grid */}
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a2e', marginBottom: 12 }}>Ride Type Chuniye</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
            {RIDES.filter(r => r.id !== 'luxury').map(r => {
              const isSel = rideType === r.id;
              return (
                <TouchableOpacity key={r.id} onPress={() => setRideType(r.id)} style={{ width: '47.5%', backgroundColor: isSel ? '#1a1a2e' : '#fff', borderRadius: 16, padding: 14, borderWidth: 2, borderColor: isSel ? '#e94560' : '#f0f0f0', shadowColor: '#000', shadowOpacity: isSel ? 0.15 : 0.04, shadowRadius: 8, elevation: isSel ? 4 : 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ fontSize: 28 }}>{r.icon}</Text>
                    {r.tag ? <View style={{ backgroundColor: r.tagColor || '#4CAF50', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{r.tag}</Text></View> : null}
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '800', marginTop: 8, color: isSel ? '#fff' : '#1a1a2e' }}>{r.label}</Text>
                  <Text style={{ fontSize: 11, color: isSel ? '#9ba5b7' : '#999', marginTop: 2 }}>{r.desc}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#e94560' }}>{fareEstimates[r.id] ? `₹${fareEstimates[r.id]}` : `₹${r.base}+`}</Text>
                    <Text style={{ fontSize: 10, color: isSel ? '#777' : '#bbb' }}>⏱ {r.eta}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Ultra Luxury — full-width premium card */}
          {(() => {
            const lux = RIDES.find(r => r.id === 'luxury')!;
            const isSel = rideType === 'luxury';
            return (
              <TouchableOpacity onPress={() => setRideType('luxury')} style={{ backgroundColor: isSel ? '#1a1a2e' : '#fff', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 2, borderColor: isSel ? '#9C27B0' : '#e8d5f5', shadowColor: '#9C27B0', shadowOpacity: isSel ? 0.3 : 0.08, shadowRadius: 12, elevation: isSel ? 6 : 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isSel ? '#7B1FA2' : '#f3e5f5', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 30 }}>{lux.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: isSel ? '#fff' : '#1a1a2e' }}>{lux.label}</Text>
                      <View style={{ backgroundColor: '#9C27B0', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }}>★ PREMIUM</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {['🛋️ Leather', '❄️ AC', '⭐ Top Driver', '🎵 Music'].map(f => (
                        <View key={f} style={{ backgroundColor: isSel ? 'rgba(255,255,255,0.1)' : '#f3e5f5', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 }}>
                          <Text style={{ color: isSel ? '#e0b3ff' : '#7B1FA2', fontSize: 10, fontWeight: '600' }}>{f}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#9C27B0' }}>{fareEstimates['luxury'] ? `₹${fareEstimates['luxury']}` : `₹${lux.base}+`}</Text>
                    <Text style={{ fontSize: 10, color: isSel ? '#9ba5b7' : '#aaa', marginTop: 3 }}>⏱ {lux.eta}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })()}

          {/* Promo Code */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 13, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0', elevation: 1 }}>
            <Text style={{ fontSize: 18 }}>🎫</Text>
            <TextInput style={{ flex: 1, fontSize: 13, color: '#1a1a2e', fontWeight: '600' }} placeholder="Promo code daalo (RIDE50)" placeholderTextColor="#ccc" autoCapitalize="characters" value={promoCode} onChangeText={setPromoCode} />
            <TouchableOpacity onPress={applyPromo} style={{ backgroundColor: '#1a1a2e', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Apply</Text>
            </TouchableOpacity>
          </View>
          {promoDiscount > 0 ? (
            <View style={{ backgroundColor: '#e8f5e9', borderRadius: 10, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 16 }}>✅</Text>
              <Text style={{ color: '#2e7d32', fontWeight: '700', fontSize: 13 }}>₹{promoDiscount} discount applied!</Text>
            </View>
          ) : null}

          {/* Ride Extension Info Card */}
          <TouchableOpacity onPress={() => setShowExtInfo(v => !v)} style={{ backgroundColor: '#fff', borderRadius: 14, marginBottom: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: '#bbdefb' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#e3f2fd', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20 }}>🔄</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#1565C0' }}>New: Ride Extension Feature</Text>
                <Text style={{ fontSize: 11, color: '#888', marginTop: 1 }}>Trip ke baad same driver ko dobara use karo</Text>
              </View>
              <Text style={{ fontSize: 14, color: '#1565C0', fontWeight: '700' }}>{showExtInfo ? '▲' : '▼'}</Text>
            </View>
            {showExtInfo ? (
              <View style={{ backgroundColor: '#e3f2fd', padding: 14, gap: 8 }}>
                {[
                  ['⏱️', 'Trip complete hone ke 15 minute tak available'],
                  ['🚗', 'Same driver — already aapke saath hai'],
                  ['📍', 'New drop location dalo, fare auto-calculate hoga'],
                  ['⚡', 'Driver ko 60 seconds ka response time milta hai'],
                  ['✅', 'Accept hote hi driver assign — koi wait nahi'],
                  ['❌', 'Driver free hona chahiye (no active ride)'],
                  ['🕒', '15 min baad feature expire — fresh ride book karo'],
                ].map(([icon, rule], i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <Text style={{ fontSize: 14 }}>{icon}</Text>
                    <Text style={{ fontSize: 12, color: '#1565C0', flex: 1, fontWeight: '500', lineHeight: 18 }}>{rule}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </TouchableOpacity>

          {result ? <Text style={s.err}>{result}</Text> : null}

          {/* Book Button */}
          <Bouncy style={[{ borderRadius: 16, overflow: 'hidden' }, loading && { opacity: 0.7 }]} onPress={bookRide} disabled={loading}>
            <View style={{ backgroundColor: loading ? '#aaa' : '#e94560', padding: 18, alignItems: 'center', borderRadius: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 }}>
                {loading ? '🔍 Driver dhundh raha hai...' : `🚀 Ride Book Karo${fareEstimates[rideType] ? '  •  ₹' + fareEstimates[rideType] : ''}`}
              </Text>
            </View>
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
                  <Text style={{ fontSize: 12, color: '#1a1a2e', fontWeight: '600', marginTop: 2 }}>
                    {rideData.driver.vehicle_brand ? `${rideData.driver.vehicle_brand} ` : ''}{rideData.driver.vehicle_model || ''}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 1 }}>🚗 {rideData.driver.vehicle_no}</Text>
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
  if (screen === 'payment') {
    const driverUpiId = rideData?.driver?.upi_id || '';
    const fareNum = parseInt(String(rideData?.fare).replace(/[^0-9]/g, '')) || fareCount;
    const upiLink = driverUpiId
      ? `upi://pay?pa=${encodeURIComponent(driverUpiId)}&pn=${encodeURIComponent(rideData?.driver?.name || 'Driver')}&am=${fareNum}&cu=INR&tn=RideApp%20Trip`
      : '';
    const qrUrl = driverUpiId
      ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(upiLink)}`
      : '';
    const confirmUpiQrPaid = async () => {
      try {
        await fetch(`${API}/api/rides/payment-complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, payment_method: 'upi_qr', phone: phone || '9999999999' }) });
      } catch (_e) {}
      setShowUpiQr(false);
      setPaymentDone(true); setScreen('postride'); createScratchCard();
    };
    return (
    <ScreenIn style={s.screen}>
      {/* UPI QR Fullscreen */}
      {showUpiQr && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', zIndex: 999, justifyContent: 'space-between' }}>
          <View style={{ backgroundColor: '#1a1a2e', paddingTop: 52, paddingBottom: 18, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setShowUpiQr(false)} style={{ marginRight: 14, padding: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10 }}>
              <Text style={{ color: '#fff', fontSize: 20 }}>←</Text>
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 }}>UPI QR Se Pay Karo</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            {/* Fare badge */}
            <View style={{ backgroundColor: '#e94560', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, marginBottom: 24 }}>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>₹{fareNum}</Text>
            </View>
            {/* QR Code */}
            {driverUpiId ? (
              <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 16, elevation: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, alignItems: 'center' }}>
                <Image source={{ uri: qrUrl }} style={{ width: 250, height: 250 }} resizeMode="contain" />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' }} />
                  <Text style={{ fontSize: 13, color: '#666', fontWeight: '600' }}>Scan with any UPI app</Text>
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: '#fff3e0', borderRadius: 16, padding: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 36 }}>⚠️</Text>
                <Text style={{ fontSize: 14, color: '#e65100', textAlign: 'center', marginTop: 10, fontWeight: '600' }}>Driver ka UPI set nahi hai{'\n'}Cash ya Wallet use karo</Text>
              </View>
            )}
            {/* UPI App logos */}
            <Text style={{ fontSize: 12, color: '#bbb', marginTop: 20, letterSpacing: 0.5 }}>GPay · PhonePe · Paytm · BHIM · Koi bhi UPI app</Text>
            <Text style={{ fontSize: 12, color: '#999', marginTop: 6 }}>{driverUpiId}</Text>
            {/* Open in UPI App directly */}
            {driverUpiId ? (
              <TouchableOpacity onPress={() => Linking.openURL(upiLink)}
                style={{ marginTop: 16, backgroundColor: '#1a1a2e', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>📱 UPI App Mein Kholo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {/* Confirm paid */}
          <View style={{ padding: 16, paddingBottom: 32, gap: 10 }}>
            <TouchableOpacity onPress={confirmUpiQrPaid}
              style={{ backgroundColor: '#4CAF50', borderRadius: 16, padding: 18, alignItems: 'center', elevation: 4 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>✅ Maine Pay Kar Diya — ₹{fareNum}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowUpiQr(false)}
              style={{ borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: '#bbb', fontSize: 13 }}>← Wapas Jao</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
            ...(driverUpiId ? [{ color: '#1565c0', icon: '📱', title: 'UPI QR Scan', sub: `Driver ka QR scan karo — ₹${fareNum}`, fn: () => setShowUpiQr(true) }] : []),
            { color: '#1a1a2e', icon: '💳', title: 'Online Pay', sub: 'UPI / Card (Razorpay)', fn: handlePayment },
            { color: '#4CAF50', icon: '💵', title: 'Cash Pay', sub: 'Driver ko haath mein cash do', fn: async () => {
              try { await fetch(`${API}/api/rides/payment-complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, payment_method: 'cash', phone: phone || '9999999999' }) }); } catch (_e) {}
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
  }

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
        {/* ── Ride Extension ── */}
        {extWindowSec > 0 && extStep === 'idle' && (
          <View style={{ backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginTop: 8, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 22, marginRight: 10 }}>🔄</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Same Driver — Naya Destination?</Text>
                <Text style={{ color: '#aaa', fontSize: 11, marginTop: 2 }}>Yahi driver aapko aur kahin le ja sakta hai • {Math.floor(extWindowSec / 60)}:{String(extWindowSec % 60).padStart(2,'0')} bacha hai</Text>
              </View>
            </View>
            {extMsg ? <Text style={{ color: '#e94560', fontSize: 12, marginBottom: 8 }}>{extMsg}</Text> : null}
            <Bouncy style={{ backgroundColor: '#e94560', borderRadius: 12, padding: 12, alignItems: 'center' }} onPress={() => { setExtStep('form'); setExtMsg(''); }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>➕ Extend Ride — Naya Location</Text>
            </Bouncy>
          </View>
        )}

        {extStep === 'form' && (
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 8, marginBottom: 4, elevation: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>📍</Text>
              <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#1a1a2e', flex: 1 }}>Naya Drop Location</Text>
              <TouchableOpacity onPress={() => { setExtStep('idle'); setExtDrop(''); setExtDropSugg([]); }}><Text style={{ color: '#999', fontSize: 18 }}>✕</Text></TouchableOpacity>
            </View>
            <TextInput
              style={{ borderWidth: 1.5, borderColor: '#e94560', borderRadius: 10, padding: 12, fontSize: 14, color: '#1a1a2e', marginBottom: 6 }}
              placeholder="Kahan jana hai? Location likhein..." placeholderTextColor="#bbb"
              value={extDrop} onChangeText={t => { setExtDrop(t); searchExtDrop(t); }}
            />
            {extDropSugg.length > 0 && (
              <View style={{ backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#eee', marginBottom: 8, maxHeight: 180, overflow: 'hidden' }}>
                {extDropSugg.slice(0, 4).map((sg: any, i: number) => (
                  <TouchableOpacity key={i} style={{ padding: 12, borderBottomWidth: i < extDropSugg.length - 1 ? 1 : 0, borderColor: '#f5f5f5', flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => { setExtDrop(sg.text); setExtDropSugg([]); geocodeExtDrop(sg.text); }}>
                    <Text style={{ fontSize: 14, marginRight: 8 }}>📍</Text>
                    <Text style={{ fontSize: 13, color: '#1a1a2e', flex: 1 }} numberOfLines={2}>{sg.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {extMsg ? <Text style={{ color: '#e94560', fontSize: 12, marginBottom: 8 }}>{extMsg}</Text> : null}
            <Bouncy style={[s.btn, { marginTop: 4 }]} onPress={sendExtensionRequest} disabled={!extDrop || loading}>
              <Text style={s.btnTxt}>{loading ? '⏳ Bhej rahe hain...' : '📤 Driver ko Request Bhejo'}</Text>
            </Bouncy>
          </View>
        )}

        {extStep === 'waiting' && extReq && (
          <View style={{ backgroundColor: '#fff3e0', borderRadius: 16, padding: 18, marginTop: 8, marginBottom: 4, alignItems: 'center', borderWidth: 2, borderColor: '#ff9800' }}>
            <Text style={{ fontSize: 32, marginBottom: 6 }}>⏳</Text>
            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#e65100', marginBottom: 4 }}>Driver se Confirmation Ka Intezaar...</Text>
            <Text style={{ color: '#555', fontSize: 13, marginBottom: 2 }}>{extReq.driver_name} ko request bheji — {extDrop}</Text>
            <Text style={{ color: '#e94560', fontSize: 22, fontWeight: 'bold', marginTop: 4 }}>₹{extReq.estimated_fare}</Text>
            <View style={{ backgroundColor: '#ffe0b2', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 10, marginBottom: 12 }}>
              <Text style={{ color: '#bf360c', fontWeight: 'bold', fontSize: 16 }}>{extRespSec}s</Text>
            </View>
            <TouchableOpacity onPress={() => { setExtStep('idle'); setExtMsg('Request cancel kar di'); }} style={{ borderWidth: 1, borderColor: '#bbb', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}>
              <Text style={{ color: '#888', fontSize: 13 }}>Cancel Request</Text>
            </TouchableOpacity>
          </View>
        )}

        <Bouncy style={[s.btn, { marginTop: extWindowSec > 0 ? 8 : 0 }]} onPress={async () => {
          if (rating > 0 && rideData?.ride_id) {
            try { await fetch(`${API}/api/rides/rate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, rating, review, tip }) }); } catch (_e) {}
          }
          setScreen('home'); setPickup(''); setDrop(''); setRating(0); setTab('home');
          setRideData(null); setPaymentDone(false); setResult(''); setScratchCard(null); setScratched(false); setEta(''); setPromoDiscount(0); setPromoCode(''); setUnreadChat(0);
          setDriverLoc(null); setDriverEta(''); setDriverDist('');
          setExtStep('idle'); setExtReq(null); setExtDrop(''); setExtDropSugg([]); setExtMsg(''); setExtWindowSec(0);
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
