import { useState, useEffect, useRef } from 'react';
import RazorpayCheckout from 'react-native-razorpay';
import {
  View, Text, TextInput, TouchableOpacity, Image, Alert, AppState, Modal,
  StyleSheet, ScrollView, Switch, Animated, KeyboardAvoidingView, Platform, Linking, Share, BackHandler
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import { apiGet, apiPost } from './api';
import { useRideStore } from './store';
import { WebView } from 'react-native-webview';
import { io, Socket } from 'socket.io-client';

const MAPS_KEY = 'AIzaSyAK3HFrZsahMLNVUFgxGAQMw_6OATDD8q4';
const API = 'https://rideapp-backend-production-5e1c.up.railway.app';

type Screen = 'splash' | 'login' | 'otp' | 'onboarding' | 'home' | 'booking' | 'matching' | 'inride' | 'payment' | 'postride' | 'chat' | 'referral' | 'saved' | 'policy' | 'hourly' | 'wallet' | 'hourly-info' | 'promo' | 'support' | 'safety';

// Default fares — used for instant render while API loads
const DEFAULT_hourlyPackages: any = {
  auto:          { 2:{fare:180,km:20}, 4:{fare:320,km:40}, 6:{fare:460,km:60}, 8:{fare:580,km:80},  24:{fare:1500,km:200}, 48:{fare:2800,km:400}, 72:{fare:4000,km:600}, extra:8  },
  bike:          { 2:{fare:120,km:20}, 4:{fare:210,km:40}, 6:{fare:300,km:60}, 8:{fare:380,km:80},  24:{fare:1000,km:200}, 48:{fare:1800,km:400}, 72:{fare:2600,km:600}, extra:5  },
  car:           { 2:{fare:260,km:20}, 4:{fare:460,km:40}, 6:{fare:660,km:60}, 8:{fare:840,km:80},  24:{fare:2200,km:200}, 48:{fare:4000,km:400}, 72:{fare:5800,km:600}, extra:12 },
  eriksha:       { 2:{fare:150,km:20}, 4:{fare:270,km:40}, 6:{fare:390,km:60}, 8:{fare:490,km:80},  24:{fare:1200,km:200}, 48:{fare:2200,km:400}, 72:{fare:3200,km:600}, extra:7  },
  ultra_luxury:  { 2:{fare:800,km:20}, 4:{fare:1400,km:40}, 6:{fare:2000,km:60}, 8:{fare:2600,km:80}, 24:{fare:6000,km:200}, 48:{fare:10000,km:400}, 72:{fare:14000,km:600}, extra:25 },
  green_bike:    { 2:{fare:100,km:20}, 4:{fare:180,km:40}, 6:{fare:260,km:60}, 8:{fare:330,km:80},  24:{fare:850,km:200},  48:{fare:1500,km:400}, 72:{fare:2200,km:600}, extra:4  },
  electric_auto: { 2:{fare:130,km:20}, 4:{fare:240,km:40}, 6:{fare:350,km:60}, 8:{fare:440,km:80},  24:{fare:1100,km:200}, 48:{fare:2000,km:400}, 72:{fare:2900,km:600}, extra:6  },
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

// ─── CityMapView — animated UP landmarks graphic map ───
const CITY_MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
* { margin:0; padding:0; }
html,body { width:100%; height:100%; overflow:hidden; background:#070c24; }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 260" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block">
<defs>
  <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#070c24"/><stop offset="100%" stop-color="#0f1540"/>
  </linearGradient>
  <radialGradient id="ga" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#e94560" stop-opacity="0.6"/>
    <stop offset="100%" stop-color="#e94560" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="gl" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#f0a500" stop-opacity="0.6"/>
    <stop offset="100%" stop-color="#f0a500" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="gv" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#4CAF50" stop-opacity="0.6"/>
    <stop offset="100%" stop-color="#4CAF50" stop-opacity="0"/>
  </radialGradient>
  <path id="r1"  d="M62,155 C102,128 162,122 200,135"/>
  <path id="r1r" d="M200,135 C162,122 102,128 62,155"/>
  <path id="r2"  d="M200,135 C238,128 270,140 302,158"/>
  <path id="r2r" d="M302,158 C270,140 238,128 200,135"/>
</defs>

<!-- Background -->
<rect width="360" height="260" fill="url(#bg)"/>

<!-- Map grid (subtle) -->
<g stroke="rgba(255,255,255,0.033)" stroke-width="0.8">
  <line x1="0" y1="52" x2="360" y2="52"/><line x1="0" y1="104" x2="360" y2="104"/>
  <line x1="0" y1="156" x2="360" y2="156"/><line x1="0" y1="208" x2="360" y2="208"/>
  <line x1="72" y1="0" x2="72" y2="260"/><line x1="144" y1="0" x2="144" y2="260"/>
  <line x1="216" y1="0" x2="216" y2="260"/><line x1="288" y1="0" x2="288" y2="260"/>
</g>

<!-- Stars -->
<g fill="white">
  <circle cx="18" cy="18" r="1" opacity="0.5"/><circle cx="52" cy="10" r="0.8" opacity="0.45"/>
  <circle cx="105" cy="16" r="1.1" opacity="0.65"/><circle cx="165" cy="8" r="0.8" opacity="0.5"/>
  <circle cx="245" cy="14" r="1" opacity="0.55"/><circle cx="296" cy="10" r="0.8" opacity="0.45"/>
  <circle cx="348" cy="30" r="1" opacity="0.6"/><circle cx="14" cy="72" r="0.8" opacity="0.38"/>
  <circle cx="350" cy="88" r="0.9" opacity="0.48"/><circle cx="38" cy="200" r="0.8" opacity="0.3"/>
  <circle cx="340" cy="208" r="0.9" opacity="0.38"/><circle cx="88" cy="242" r="0.8" opacity="0.28"/>
  <circle cx="282" cy="236" r="0.8" opacity="0.32"/>
</g>

<!-- Yamuna river (Agra area) -->
<path d="M8,218 C22,208 30,226 46,216 C58,208 64,224 80,216 C90,209 96,224 110,218"
  stroke="#1e6bbf" stroke-width="1.8" fill="none" opacity="0.55" stroke-linecap="round"/>
<text x="55" y="234" text-anchor="middle" fill="rgba(30,107,191,0.55)" font-size="6.5" font-family="sans-serif">Yamuna</text>

<!-- Ganga river (Varanasi area) -->
<path d="M268,244 C282,233 292,248 306,238 C318,229 326,244 340,235 C348,228 354,242 362,235"
  stroke="#1e6bbf" stroke-width="2" fill="none" opacity="0.6" stroke-linecap="round"/>
<text x="316" y="256" text-anchor="middle" fill="rgba(30,107,191,0.55)" font-size="6.5" font-family="sans-serif">Ganga</text>

<!-- Route glow (soft blur under lines) -->
<path d="M62,155 C102,128 162,122 200,135" stroke="#e94560" stroke-width="7" fill="none" opacity="0.09" stroke-linecap="round"/>
<path d="M200,135 C238,128 270,140 302,158" stroke="#f0a500" stroke-width="7" fill="none" opacity="0.09" stroke-linecap="round"/>

<!-- Animated dashes — forward Agra→Lucknow -->
<path d="M62,155 C102,128 162,122 200,135" stroke="#e94560" stroke-width="1.8" fill="none"
  opacity="0.88" stroke-dasharray="9 6" stroke-linecap="round">
  <animate attributeName="stroke-dashoffset" from="0" to="-150" dur="1.8s" repeatCount="indefinite"/>
</path>
<!-- Animated dashes — forward Lucknow→Varanasi -->
<path d="M200,135 C238,128 270,140 302,158" stroke="#f0a500" stroke-width="1.8" fill="none"
  opacity="0.88" stroke-dasharray="9 6" stroke-linecap="round">
  <animate attributeName="stroke-dashoffset" from="0" to="-150" dur="1.6s" repeatCount="indefinite"/>
</path>
<!-- Faint return dash (Lucknow→Agra) -->
<path d="M62,155 C102,128 162,122 200,135" stroke="rgba(233,69,96,0.25)" stroke-width="1"
  fill="none" stroke-dasharray="4 12">
  <animate attributeName="stroke-dashoffset" from="-150" to="0" dur="3.2s" repeatCount="indefinite"/>
</path>

<!-- VEHICLES -->
<!-- 🚗 Car: Agra → Lucknow -->
<text font-size="17" text-anchor="middle" dominant-baseline="central">
  <animateMotion dur="5s" repeatCount="indefinite" rotate="auto"><mpath href="#r1"/></animateMotion>🚗
</text>
<!-- 🏍️ Bike: Lucknow → Varanasi -->
<text font-size="15" text-anchor="middle" dominant-baseline="central">
  <animateMotion dur="4s" repeatCount="indefinite" rotate="auto"><mpath href="#r2"/></animateMotion>🏍️
</text>
<!-- 🛺 Auto: Varanasi → Lucknow (returning) -->
<text font-size="14" text-anchor="middle" dominant-baseline="central">
  <animateMotion dur="5.5s" repeatCount="indefinite" rotate="auto"><mpath href="#r2r"/></animateMotion>🛺
</text>

<!-- ── AGRA ── -->
<circle cx="62" cy="155" r="26" fill="url(#ga)">
  <animate attributeName="r" values="20;29;20" dur="3.5s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.7;1;0.7" dur="3.5s" repeatCount="indefinite"/>
</circle>
<circle cx="62" cy="155" r="7" fill="#e94560"/>
<circle cx="62" cy="155" r="4" fill="white" opacity="0.92"/>
<text x="62" y="133" text-anchor="middle" font-size="20">&#x1F54C;</text>
<text x="62" y="173" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="sans-serif" letter-spacing="1">AGRA</text>
<text x="62" y="183" text-anchor="middle" fill="rgba(233,69,96,0.95)" font-size="7" font-family="sans-serif">Taj Mahal</text>

<!-- ── LUCKNOW ── -->
<circle cx="200" cy="135" r="26" fill="url(#gl)">
  <animate attributeName="r" values="20;29;20" dur="3.5s" begin="1.2s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.7;1;0.7" dur="3.5s" begin="1.2s" repeatCount="indefinite"/>
</circle>
<circle cx="200" cy="135" r="7" fill="#f0a500"/>
<circle cx="200" cy="135" r="4" fill="white" opacity="0.92"/>
<text x="200" y="113" text-anchor="middle" font-size="20">&#x1F3DB;&#xFE0F;</text>
<text x="200" y="153" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="sans-serif" letter-spacing="0.5">LUCKNOW</text>
<text x="200" y="163" text-anchor="middle" fill="rgba(240,165,0,0.95)" font-size="7" font-family="sans-serif">Rumi Darwaza</text>

<!-- ── VARANASI ── -->
<circle cx="302" cy="158" r="26" fill="url(#gv)">
  <animate attributeName="r" values="20;29;20" dur="3.5s" begin="2.4s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.7;1;0.7" dur="3.5s" begin="2.4s" repeatCount="indefinite"/>
</circle>
<circle cx="302" cy="158" r="7" fill="#4CAF50"/>
<circle cx="302" cy="158" r="4" fill="white" opacity="0.92"/>
<text x="302" y="136" text-anchor="middle" font-size="20">&#x1F6D5;</text>
<text x="302" y="176" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="sans-serif" letter-spacing="0.5">VARANASI</text>
<text x="302" y="186" text-anchor="middle" fill="rgba(76,175,80,0.95)" font-size="7" font-family="sans-serif">Kashi Vishwanath</text>

<!-- Intermediate towns -->
<circle cx="130" cy="133" r="2.8" fill="rgba(255,255,255,0.42)" stroke="rgba(255,255,255,0.6)" stroke-width="0.8"/>
<text x="130" y="147" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6.5" font-family="sans-serif">Kanpur</text>

<circle cx="253" cy="143" r="2.8" fill="rgba(255,255,255,0.42)" stroke="rgba(255,255,255,0.6)" stroke-width="0.8"/>
<text x="253" y="157" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="6.5" font-family="sans-serif">Prayagraj</text>

<!-- Distance labels -->
<rect x="90" y="99" width="38" height="13" rx="6.5" fill="rgba(233,69,96,0.18)" stroke="rgba(233,69,96,0.38)" stroke-width="0.7"/>
<text x="109" y="108.5" text-anchor="middle" fill="#e94560" font-size="7.5" font-family="sans-serif">~350 km</text>

<rect x="228" y="113" width="38" height="13" rx="6.5" fill="rgba(240,165,0,0.18)" stroke="rgba(240,165,0,0.38)" stroke-width="0.7"/>
<text x="247" y="122.5" text-anchor="middle" fill="#f0a500" font-size="7.5" font-family="sans-serif">~300 km</text>

<!-- SPPERO brand pill -->
<rect x="125" y="10" width="110" height="28" rx="14" fill="rgba(233,69,96,0.11)" stroke="rgba(233,69,96,0.22)" stroke-width="0.8"/>
<text x="180" y="21" text-anchor="middle" fill="#e94560" font-size="12" font-weight="bold" font-family="sans-serif">&#x2B50; SPPERO</text>
<text x="180" y="32" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="7.5" font-family="sans-serif">Trusted Rides Across UP</text>

<!-- Compass (bottom-left) -->
<circle cx="22" cy="238" r="10" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)" stroke-width="0.8"/>
<text x="22" y="234" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="7.5" font-family="sans-serif" font-weight="bold">N</text>
<line x1="22" y1="236" x2="22" y2="244" stroke="rgba(255,255,255,0.28)" stroke-width="0.8"/>
<text x="22" y="249" text-anchor="middle" fill="rgba(255,255,255,0.28)" font-size="5.5" font-family="sans-serif">S</text>
<line x1="14" y1="240" x2="30" y2="240" stroke="rgba(255,255,255,0.2)" stroke-width="0.8"/>
<text x="9" y="242" text-anchor="middle" fill="rgba(255,255,255,0.28)" font-size="5.5" font-family="sans-serif">W</text>
<text x="35" y="242" text-anchor="middle" fill="rgba(255,255,255,0.28)" font-size="5.5" font-family="sans-serif">E</text>
</svg>
</body>
</html>`;

const CityMapView = ({ height = 260 }: { height?: number }) => (
  <WebView
    source={{ html: CITY_MAP_HTML }}
    style={{ height, width: '100%', backgroundColor: '#070c24' }}
    scrollEnabled={false}
    javaScriptEnabled
    domStorageEnabled
  />
);

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
  const [screen, setScreen]           = useState<Screen>('splash');
  // Splash animations
  const splashLogo  = useRef(new Animated.Value(0)).current;
  const splashScale = useRef(new Animated.Value(0.4)).current;
  const splashTag   = useRef(new Animated.Value(0)).current;
  const splashFade  = useRef(new Animated.Value(1)).current;
  // Onboarding
  const [gender, setGender] = useState<'male'|'female'|'other'|''>('');
  const onboardFade   = useRef(new Animated.Value(0)).current;
  const onboardSlide  = useRef(new Animated.Value(60)).current;
  const loginHeroAnim = useRef(new Animated.Value(0)).current;
  const loginCardAnim = useRef(new Animated.Value(80)).current;
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
  const socketRef = useRef<Socket | null>(null);
  const phoneRef  = useRef<string>(''); // always-fresh phone for socket closures
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
  const [altSuggest, setAltSuggest]   = useState<{alternatives: string[], current_type: string} | null>(null);
  const [switchingVehicle, setSwitchingVehicle] = useState(false);
  const [rating, setRating]           = useState(0);
  const [sosActive, setSosActive]     = useState(false);
  const [tab, setTab]                 = useState('home');
  const [promoCode, setPromoCode]     = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [customerRating, setCustomerRating] = useState<any>(null);
  const [availablePromos, setAvailablePromos] = useState<any[]>([]);
  const [promoScreenCode, setPromoScreenCode] = useState('');
  const [promoScreenMsg, setPromoScreenMsg]   = useState('');
  const [tip, setTip]                 = useState(0);
  const [review, setReview]           = useState('');
  const [paymentDone, setPaymentDone] = useState(false);
  const [showUpiQr, setShowUpiQr] = useState(false);
  const [historyRides, setHistoryRides] = useState<any[]>([]);
  const [driverLoc, setDriverLoc]     = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTxns, setWalletTxns]   = useState<any[]>([]);
  const [walletStats, setWalletStats] = useState<any>({});
  const [walletTxnTab, setWalletTxnTab] = useState<'all'|'earn'|'spend'|'reward'>('all');
  const [walletAddInput, setWalletAddInput] = useState('');
  const [scratchCard, setScratchCard] = useState<any>(null);
  const [scratched, setScratched]     = useState(false);
  const [eta, setEta]                 = useState('');
  const [fareCount, setFareCount]     = useState(0);
  const [userCoords, setUserCoords]   = useState<any>(null);
  const [pickupSugg, setPickupSugg]   = useState<any[]>([]);
  const [dropSugg, setDropSugg]       = useState<any[]>([]);
  const [fareEstimates, setFareEstimates] = useState<any>({});
  const [fareLoading, setFareLoading]     = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTimer, setCancelTimer] = useState(60);
  const [freeCancelsLeft, setFreeCancelsLeft] = useState(3);
  const [bookTime, setBookTime] = useState(0);
  const [searchElapsed, setSearchElapsed] = useState(0);
  const [surgeCount, setSurgeCount]       = useState(0);
  const [surgeFare, setSurgeFare]         = useState('');
  const [surging, setSurging]             = useState(false);
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
  const surgeBarAnim    = useRef(new Animated.Value(0)).current;
  const surgeBarAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // ── Favourite Buddy State ─────────────────────
  const [favouriteBuddy, setFavouriteBuddy]     = useState<any>(null);
  const [showBuddyBook, setShowBuddyBook]         = useState(false);
  const [buddyBookPU, setBuddyBookPU]             = useState('');
  const [buddyBookDR, setBuddyBookDR]             = useState('');
  const [buddyBookPUCoords, setBuddyBookPUCoords] = useState<any>(null);
  const [buddyBookDRCoords, setBuddyBookDRCoords] = useState<any>(null);
  const [buddyBookLoading, setBuddyBookLoading]   = useState(false);
  const [buddyBookMsg, setBuddyBookMsg]           = useState('');
  const [buddyWaiting, setBuddyWaiting]           = useState(false);
  const buddyWaitingRef                           = useRef(false);
  const [buddyPUSugg, setBuddyPUSugg]             = useState<any[]>([]);
  const [buddyDRSugg, setBuddyDRSugg]             = useState<any[]>([]);
  const buddyPUDebRef = useRef<any>(null);
  const buddyDRDebRef = useRef<any>(null);

  // ── Hourly Booking State ──────────────────────
  const [hourlyStep, setHourlyStep]     = useState<'book'|'waiting'|'active'|'done'>('book');
  const [hourlyBooking, setHourlyBooking] = useState<any>(null);
  const activeHourlyIdRef               = useRef<string|number|null>(null);
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
  // Hourly chat
  const [hChatOpen, setHChatOpen]         = useState(false);
  const [hChatMsgs, setHChatMsgs]         = useState<any[]>([]);
  const [hChatInput, setHChatInput]       = useState('');
  const [hChatUnread, setHChatUnread]     = useState(0);
  // Extension request
  const [hExtendStep, setHExtendStep]     = useState<'idle'|'choose'|'pending'>('idle');
  const hExtendStepRef                    = useRef<'idle'|'choose'|'pending'>('idle');
  const [hExtendResult, setHExtendResult] = useState<'accepted'|'rejected'|null>(null);
  const hExtendPrevHoursRef               = useRef<number>(0);
  const [hExtendHours, setHExtendHours]   = useState(1);
  const [hExtendMin, setHExtendMin]       = useState(0);
  const [hExtendCost, setHExtendCost]     = useState<any>(null);
  // Approaching limit
  const [hApproachLimit, setHApproachLimit] = useState<any>(null);
  // Loyalty
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyCashback, setLoyaltyCashback] = useState(0);
  const [activeOffers, setActiveOffers]   = useState<any[]>([]);
  const [offerDismissed, setOfferDismissed] = useState<Set<number>>(new Set());

  // Hourly packages — fetched from server so admin fare changes reflect immediately
  const [hourlyPackages, setHourlyPackages] = useState<any>(DEFAULT_hourlyPackages);

  // Debounce refs for place search (prevents API spam on every keystroke)
  const pickupDebounceRef = useRef<any>(null);
  const dropDebounceRef   = useRef<any>(null);
  const lastFetchKey      = useRef('');
  const hPickupDebounceRef = useRef<any>(null);
  const hDropDebounceRef   = useRef<any>(null);

  // ── Notification Handler ──────────────────────
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Sppero Notifications',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        lightColor: '#e94560',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
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

    const sub1 = Notifications.addNotificationReceivedListener(_n => {});

    // Notification tap → navigate to right screen (app in background or killed)
    const handleNotifTap = async (response: any) => {
      const data = response?.notification?.request?.content?.data as any;
      if (!data?.type) return;
      const rideId = data.ride_id;
      if (rideId) await AsyncStorage.setItem('activeStdRideId', String(rideId)).catch(() => {});
      switch (data.type) {
        case 'ride_matched':
        case 'driver_arrived':
          setScreen('matching'); break;
        case 'trip_started':
          setScreen('inride'); break;
        case 'trip_completed':
          setScreen('payment'); break;
        case 'ride_cancelled':
          setScreen('home'); break;
      }
    };
    const sub2 = Notifications.addNotificationResponseReceivedListener(handleNotifTap);

    // Handle tap when app was fully killed
    Notifications.getLastNotificationResponseAsync().then(r => { if (r) handleNotifTap(r); });

    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);

// ── FCM Token Register ────────────────────────
  const registerFCM = async (userPhone: string) => {
    try {
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
      if (screen === 'home' && tab === 'home') {
        if (rideData?.ride_id || (hourlyBooking && ['pending','matched','active'].includes(hourlyBooking?.status))) {
          setTab('live'); return true;
        }
        return false;
      }
      if (screen === 'home' && tab !== 'home') { setTab('home'); return true; }
      if (screen === 'otp') { setScreen('login'); return true; }
      if (screen === 'booking') { setScreen('home'); setPickupSugg([]); setDropSugg([]); setEta(''); setPromoCode(''); setPromoDiscount(0); return true; }
      if (screen === 'matching') { setShowCancelModal(true); return true; }
      if (screen === 'inride') return true;  // trip chal rahi hai — back band
      if (screen === 'chat') { setScreen('matching'); return true; }
      if (screen === 'hourly-info') { setScreen('home'); return true; }
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
  }, [screen, tab, hourlyStep, rideData?.ride_id]);

  // ── Splash animation + startup ──────────────────
  useEffect(() => {
    // Logo pop in
    Animated.parallel([
      Animated.spring(splashScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      Animated.timing(splashLogo, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start(() => {
      // Tagline slides up
      Animated.timing(splashTag, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    });

    // After 2.6s, fade out and navigate
    const timer = setTimeout(async () => {
      Animated.timing(splashFade, { toValue: 0, duration: 400, useNativeDriver: true }).start(async () => {
        try {
          const sp = await AsyncStorage.getItem('userPhone');
          const sn = await AsyncStorage.getItem('userName');
          if (!sp) { setScreen('login'); return; }
          setPhone(sp); setUserName(sn || ''); loadHistory(sp); loadWallet(sp); registerFCM(sp); loadOffers(); loadHourlyPackages(); loadFavouriteBuddy(sp);

          // Active hourly ride check
          const savedHourlyId = await AsyncStorage.getItem('activeHourlyId');
          if (savedHourlyId) {
            try {
              const data = await apiGet('/api/hourly/active?phone=' + sp);
              if (data.booking && ['pending','matched','active'].includes(data.booking.status)) {
                setHourlyBooking({ ...data.booking, driver: data.driver || null });
                setHourlyStep(data.booking.status === 'active' ? 'active' : 'waiting');
                joinHourlySocket(data.booking.id);
                setScreen('home'); setTab('live'); return;
              } else { await AsyncStorage.removeItem('activeHourlyId'); }
            } catch (_e) {}
          }
          // Active standard ride check
          const savedRideId = await AsyncStorage.getItem('activeStdRideId');
          if (savedRideId) {
            try {
              const rs = await apiGet('/api/rides/status/' + savedRideId);
              const LIVE = ['requested','matched','arrived','started','completed'];
              if (rs.ride && LIVE.includes(rs.ride.status)) {
                const r = rs.ride;
                const driverObj = r.driver_name ? { name: r.driver_name, phone: r.driver_phone, vehicle_no: r.vehicle_no, vehicle_brand: r.vehicle_brand, vehicle_model: r.vehicle_model, upi_id: r.driver_upi_id, verified: r.driver_verification_status === 'approved', rating: r.driver_rating, photo: r.driver_photo || null } : null;
                setRideData({ ride_id: savedRideId, fare: '₹' + Math.round(parseFloat(r.fare) || 0), startOtp: r.start_otp || '', driver: driverObj });
                setPickup(r.pickup || ''); setDrop(r.drop_location || '');
                if (r.pickup_lat) setPickupCoords({ lat: parseFloat(r.pickup_lat), lng: parseFloat(r.pickup_lng) });
                if (r.drop_lat)   setDropCoords({ lat: parseFloat(r.drop_lat),   lng: parseFloat(r.drop_lng) });
                connectSocket(sp);  // must connect first
                joinRideSocket(savedRideId);  // emit is buffered until connected
                // Route to correct screen based on status
                if (r.status === 'completed') { setScreen('payment'); return; }
                setScreen('home'); setTab('live'); return;
              } else { await AsyncStorage.removeItem('activeStdRideId'); }
            } catch (_e) {}
          }
          setScreen('home');
        } catch (_e) { setScreen('login'); }
      });
    }, 2600);
    return () => clearTimeout(timer);
  }, []);

  // ─── RIDE POLLING — screen-agnostic, overlap guard, AsyncStorage sync ───
  useEffect(() => {
    if (!rideData?.ride_id) return;
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
            setRideData((p: any) => p ? { ...p, startOtp: data.ride.start_otp, driver: { name: data.ride.driver_name, phone: data.ride.driver_phone, vehicle_no: data.ride.vehicle_no, vehicle_brand: data.ride.vehicle_brand, vehicle_model: data.ride.vehicle_model, upi_id: data.ride.driver_upi_id, verified: data.ride.driver_verification_status === 'approved', rating: data.ride.driver_rating, photo: data.ride.driver_photo || null } } : p);
            const ld = await apiGet(`/api/rides/driver-location/${rid}`);
            if (!ld._error && ld.location) {
              setDriverLoc(ld.location);
              if (ld.location.lat && pickupCoords?.lat) calcDriverEta(ld.location.lat, ld.location.lng, pickupCoords.lat, pickupCoords.lng);
            }
          }

          if (st === 'started') setScreen('inride');

          if (st === 'completed') {
            stopped = true; clearInterval(iv);
            AsyncStorage.removeItem('activeStdRideId').catch(() => {});
            setScreen((cur: Screen) => (cur === 'payment' || cur === 'postride') ? cur : 'payment');
            loadWallet(phone);
          }

          if (st === 'cancelled') {
            stopped = true; clearInterval(iv);
            AsyncStorage.removeItem('activeStdRideId').catch(() => {});
            const nd = await apiGet(`/api/notifications/latest?phone=${phone}`);
            setResult('❌ ' + (nd?.notification?.body || 'Ride cancel ho gayi'));
            setScreen('home'); setTab('home'); setRideData(null);
            setPickup(''); setDrop(''); setPickupCoords(null); setDropCoords(null); setEta('');
            setUnreadChat(0); setDriverLoc(null); setDriverEta(''); setDriverDist('');
            setAltSuggest(null);
            ride.clearRide();
          }
        }
      } catch (_e) {}
      busy = false;
    }, 6000); // Socket handles real-time; polling is fallback
    return () => { stopped = true; clearInterval(iv); };
  }, [rideData?.ride_id]);

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
            setHourlyStep('active');
          }
          if (b.status === 'active' && hourlyStep === 'waiting') setHourlyStep('active');
          if (b.status === 'completed') { setHourlyStep('done'); loadWallet(phone); AsyncStorage.removeItem('activeHourlyId').catch(() => {}); }
          // Extension result detection — use ref to avoid stale closure
          if (b.extend_requested_hours && hExtendStepRef.current === 'idle') {
            hExtendPrevHoursRef.current = parseFloat(b.package_hours || 0);
            hExtendStepRef.current = 'pending';
            setHExtendStep('pending');
          }
          if (!b.extend_requested_hours && hExtendStepRef.current === 'pending') {
            const prevHours = hExtendPrevHoursRef.current;
            const newHours = parseFloat(b.package_hours || 0);
            if (prevHours > 0 && newHours > prevHours) {
              setHExtendResult('accepted');
            } else {
              setHExtendResult('rejected');
              loadWallet(phone);
            }
            hExtendStepRef.current = 'idle';
            setHExtendStep('idle');
            setTimeout(() => setHExtendResult(null), 6000);
          }
        }
      } catch (_e) {}
    }, 3500);
    return () => { stopped = true; clearInterval(iv); };
  }, [screen, hourlyBooking?.id, hourlyStep]);

  // Hourly trip timer — timestamp-based so it survives minimize/background
  useEffect(() => {
    if (screen === 'hourly' && hourlyStep === 'active' && hourlyBooking?.status === 'active') {
      if (hourlyTimerRef.current) clearInterval(hourlyTimerRef.current);
      const startMs = hourlyBooking.started_at ? new Date(hourlyBooking.started_at).getTime() : Date.now();
      const tick = () => setHourlyTimerSec(Math.floor((Date.now() - startMs) / 1000));
      tick();
      hourlyTimerRef.current = setInterval(tick, 1000);
      // When app comes back to foreground, force immediate tick so timer snaps to correct value
      const appSub = AppState.addEventListener('change', s => { if (s === 'active') tick(); });
      return () => { if (hourlyTimerRef.current) clearInterval(hourlyTimerRef.current); appSub.remove(); };
    }
  }, [screen, hourlyStep, hourlyBooking?.status, hourlyBooking?.started_at]);

  useEffect(() => {
    if (screen !== 'chat' || !rideData?.ride_id) return;
    const load = async () => {
      try { const r = await fetch(`${API}/api/chat/${rideData.ride_id}`); const d = await r.json(); setChatMsgs(d.messages || []); lastChatCount.current = (d.messages || []).length; setUnreadChat(0); } catch (_e) {}
    };
    load();
    const iv = setInterval(load, 2500);
    return () => clearInterval(iv);
  }, [screen, rideData?.ride_id]);

  // Login screen entrance animations
  useEffect(() => {
    if (screen !== 'login') return;
    loginHeroAnim.setValue(0);
    loginCardAnim.setValue(80);
    Animated.parallel([
      Animated.timing(loginHeroAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(loginCardAnim, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [screen]);

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

  // Load customer rating + available promos when profile tab opens
  useEffect(() => {
    if (screen === 'home' && tab === 'profile' && phone) {
      fetch(`${API}/api/customer/rating?phone=${phone}`)
        .then(r => r.json()).then(d => setCustomerRating(d)).catch(() => {});
    }
    if (screen === 'promo' && availablePromos.length === 0) {
      fetch(`${API}/api/promo/list`)
        .then(r => r.json()).then(d => setAvailablePromos(d.promos || [])).catch(() => {});
    }
  }, [screen, tab, phone]);

  // Auto-fill GPS location when booking screen opens and pickup is empty
  useEffect(() => {
    if (screen === 'booking' && !pickup) useMyLocation();
  }, [screen]);

  // Reactively recalculate ETA + fares whenever pickup or drop coords change
  useEffect(() => {
    if (!pickupCoords?.lat || !dropCoords?.lat || screen !== 'booking') return;
    const key = `${pickupCoords.lat.toFixed(4)},${pickupCoords.lng.toFixed(4)}-${dropCoords.lat.toFixed(4)},${dropCoords.lng.toFixed(4)}`;
    if (lastFetchKey.current === key) return;
    lastFetchKey.current = key;
    fetchEtaByCoords(pickupCoords, dropCoords);
  }, [pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng, screen]);

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

  // Search progress bar animation (0→100s) + surge trigger countdown
  useEffect(() => {
    if (screen !== 'matching' || !!rideData?.driver || !bookTime) {
      surgeBarAnimRef.current?.stop();
      return;
    }
    setSearchElapsed(0);
    surgeBarAnim.setValue(0);
    surgeBarAnimRef.current?.stop();
    const anim = Animated.timing(surgeBarAnim, {
      toValue: 1, duration: 100000, useNativeDriver: false,
    });
    surgeBarAnimRef.current = anim;
    anim.start();
    const iv = setInterval(() => {
      const secs = Math.floor((Date.now() - bookTime) / 1000);
      setSearchElapsed(Math.min(secs, 100));
      if (secs >= 100) clearInterval(iv);
    }, 1000);
    return () => { clearInterval(iv); surgeBarAnimRef.current?.stop(); };
  }, [screen, bookTime, rideData?.driver]);

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
  const loadFavouriteBuddy = async (ph: string) => {
    try { const r = await fetch(`${API}/api/favourites?phone=${ph}`); const d = await r.json(); setFavouriteBuddy(d.buddy || null); } catch (_e) {}
  };
  const removeFavouriteBuddy = async () => {
    if (!phone) return;
    try {
      await fetch(`${API}/api/favourites`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_phone: phone }) });
      setFavouriteBuddy(null);
    } catch (_e) {}
  };
  const addFavouriteBuddy = async (driverPhone: string) => {
    if (!phone || !driverPhone) return;
    try {
      const r = await fetch(`${API}/api/favourites`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_phone: phone, driver_phone: driverPhone }) });
      const d = await r.json();
      if (d.success) setFavouriteBuddy(d.buddy);
      return d;
    } catch (_e) { return { error: 'Network error' }; }
  };
  const loadWallet = async (ph: string) => {
    try { const r = await fetch(`${API}/api/wallet/balance?phone=${ph}`); const d = await r.json(); setWalletBalance(d.balance || 0); } catch (_e) {}
  };

  // Keep phoneRef fresh for socket closures; add AppState listener for live refresh on resume
  useEffect(() => {
    phoneRef.current = phone;
  }, [phone]);
  useEffect(() => {
    if (!phone) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadWallet(phone);
        loadHistory(phone);
        // Reconnect socket if it dropped while app was in background
        if (socketRef.current && !socketRef.current.connected) {
          socketRef.current.connect();
        }
      }
    });
    return () => sub.remove();
  }, [phone]);
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
  const loadHourlyPackages = async () => {
    try { const r = await fetch(`${API}/api/hourly/packages`); const d = await r.json(); if (d.fares) setHourlyPackages(d.fares); } catch (_e) {}
  };
  const loadLoyalty = async (ph: string) => {
    try { const r = await fetch(`${API}/api/loyalty/my-points?phone=${ph}`); const d = await r.json(); setLoyaltyPoints(d.points || 0); setLoyaltyCashback(d.cashback_available || 0); } catch (_e) {}
  };

  const openRazorpayTopup = async (amt: number) => {
    if (amt < 1) return;
    try {
      const r = await fetch(`${API}/api/wallet/topup/order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount: amt }),
      });
      const d = await r.json();
      if (!d.success) { setResult('❌ ' + (d.error || 'Payment start nahi hua')); return; }
      RazorpayCheckout.open({
        key: d.key_id,
        amount: d.amount,
        currency: d.currency || 'INR',
        order_id: d.order_id,
        name: 'Sppero',
        description: `Wallet Recharge ₹${amt}`,
        prefill: { contact: phone },
        theme: { color: '#e94560' },
      }).then(async (payment: any) => {
        const vr = await fetch(`${API}/api/wallet/topup/verify`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            razorpay_order_id: payment.razorpay_order_id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_signature: payment.razorpay_signature,
            amount: amt,
          }),
        });
        const vd = await vr.json();
        if (vd.success) { setWalletBalance(vd.balance); await loadWalletDetail(phone); }
      }).catch((_e: any) => {});
    } catch (_e) { setResult('❌ Server error'); }
  };
  const loadReferral = async () => {
    try { const r = await fetch(`${API}/api/referral/my-code?phone=${phone}`); const d = await r.json(); setReferralData(d); } catch (_e) {}
  };
  const loadSaved = async () => {
    try { const r = await fetch(`${API}/api/places/saved?phone=${phone}`); const d = await r.json(); setSavedPlaces(d.places || []); } catch (_e) {}
  };

  const searchPlaces = (text: string, type: 'pickup' | 'drop') => {
    if (text.length < 3) { type === 'pickup' ? setPickupSugg([]) : setDropSugg([]); return; }
    const ref = type === 'pickup' ? pickupDebounceRef : dropDebounceRef;
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(async () => {
      try {
        const res  = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${MAPS_KEY}&components=country:in&location=26.8467,80.9462&radius=50000`);
        const data = await res.json();
        const sugg = data.predictions?.map((p: any) => ({ id: p.place_id, text: p.description })) || [];
        type === 'pickup' ? setPickupSugg(sugg) : setDropSugg(sugg);
      } catch (_e) {}
    }, 400);
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
    if (!origin || !dest) return 5;
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

  const fetchEtaByCoords = async (pc: any, dc: any) => {
    if (!pc?.lat || !dc?.lat) return;
    setEta('⏳ Calculate ho raha hai...');
    setFareEstimates({});
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${pc.lat},${pc.lng}&destinations=${dc.lat},${dc.lng}&key=${MAPS_KEY}&mode=driving&departure_time=now`,
        { cache: 'no-store' } as any
      );
      const data = await res.json();
      const el = data.rows?.[0]?.elements?.[0];
      if (el?.status === 'OK') {
        const duration = el.duration_in_traffic?.text || el.duration.text;
        const dist = el.distance.text;
        const km = el.distance.value / 1000;
        setEta(`🕐 ${duration} · 📍 ${dist}`);
        loadFareEstimates(km);
      } else setEta('');
    } catch { setEta(''); }
  };

  const loadFareEstimates = async (km: number) => {
    setFareLoading(true);
    const est: any = {};
    await Promise.all(RIDES.map(async (r) => {
      try {
        const res = await fetch(`${API}/api/fare-estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
          body: JSON.stringify({ ride_type: r.id, distance: km }),
        });
        const d = await res.json();
        if (d.fare) est[r.id] = d.fare;
      } catch (_e) {}
    }));
    setFareEstimates(est);
    setFareLoading(false);
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
      RazorpayCheckout.open({ description: 'Sppero Trip', currency: 'INR', key: order.key_id, amount: order.amount, order_id: order.order_id, name: 'Sppero', prefill: { contact: phone, name: userName || 'User' }, theme: { color: '#e94560' } })
        .then(async (data: any) => {
          await fetch(`${API}/api/payment/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, razorpay_payment_id: data.razorpay_payment_id, razorpay_order_id: data.razorpay_order_id, razorpay_signature: data.razorpay_signature, amount: fareNum, method: 'online' }) });
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
  setRideData(data); setScreen('matching'); setResult(''); setAltSuggest(null);
      AsyncStorage.setItem('activeStdRideId', String(data.ride_id)).catch(() => {});
      joinRideSocket(data.ride_id);
      ride.setRide(data); // Store mein naya ride — purana stale data auto-clear
      ride.startPolling(phone || '9999999999'); // fallback polling in case socket drops
      setBookTime(Date.now()); setCancelTimer(60);
      setSurgeCount(0); setSurgeFare(''); setSearchElapsed(0);
      // Free cancels load
      try { const cs = await fetch(`${API}/api/customer/cancel-status?phone=${phone || '9999999999'}`); const csd = await cs.json(); setFreeCancelsLeft(csd.free_cancels_left ?? 3); } catch (_e) {}
    } catch { setResult('❌ Server connect nahi hua!'); }
    setLoading(false);
  };

  const surgeFareNow = async (amount: number) => {
    if (!rideData?.ride_id || surging || surgeCount >= 3) return;
    setSurging(true);
    try {
      const res = await apiPost('/api/rides/surge-fare', {
        ride_id: rideData.ride_id,
        customer_phone: phone || '9999999999',
        surge_amount: amount,
      });
      if (res.success) {
        setSurgeFare(res.new_fare);
        setSurgeCount(res.surge_count);
        setBookTime(Date.now());  // restarts the 100s timer
        setRideData((prev: any) => ({ ...prev, fare: res.new_fare }));
      } else {
        setResult('❌ ' + (res.error || 'Surge failed'));
      }
    } catch (_e) { setResult('❌ Network error'); }
    setSurging(false);
  };

  const switchVehicle = async (newType: string) => {
    if (!rideData?.ride_id || switchingVehicle) return;
    setSwitchingVehicle(true);
    try {
      const res = await apiPost('/api/rides/switch-vehicle', { ride_id: rideData.ride_id, new_vehicle_type: newType });
      if (res._error) { setResult('❌ ' + res.message); return; }
      setAltSuggest(null);
      setRideData((p: any) => p ? { ...p, ride_type: newType, fare: res.new_fare } : p);
      setResult(`🔄 ${newType.toUpperCase()} driver dhundh rahe hain...`);
    } catch { setResult('❌ Switch nahi hua, try again'); }
    finally { setSwitchingVehicle(false); }
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
    try {
      const res = await fetch(`${API}/api/auth/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      const data = await res.json();
      if (data.error) { setResult('❌ ' + data.error); setLoading(false); return; }
      setOtpSent(data.otp || ''); setScreen('otp'); setResult('');
    } catch { setResult('❌ Server connect nahi hua'); }
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
        // Use server's stored name as source of truth — local userName state can be stale after logout
        const serverName = data.user?.name || '';
        const isNew = !serverName || serverName === 'User' || serverName === 'Rider';
        if (isNew) {
          onboardFade.setValue(0); onboardSlide.setValue(60);
          setScreen('onboarding'); setResult('');
          Animated.parallel([
            Animated.timing(onboardFade, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.spring(onboardSlide, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
          ]).start();
        } else {
          setUserName(serverName);
          await AsyncStorage.setItem('userName', serverName);
          setScreen('home'); setResult(''); loadHistory(phone); loadWallet(phone);
          registerFCM(phone); loadOffers(); loadHourlyPackages(); connectSocket(phone);
        }
    
      } else {
        setResult('❌ ' + (data.error || 'OTP galat hai'));
        shakeOtp();
      }
    } catch { setResult('❌ Server connect nahi hua'); }
    setLoading(false);
  };

  const completeOnboarding = async () => {
    setLoading(true);
    const finalName = userName.trim() || 'Rider';
    try {
      await fetch(`${API}/api/auth/update-name`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name: finalName, gender }),
      });
    } catch (_e) {}
    await AsyncStorage.setItem('userName', finalName);
    if (gender) await AsyncStorage.setItem('userGender', gender);
    setUserName(finalName);
    setResult('');
    setScreen('home'); loadHistory(phone); loadWallet(phone); registerFCM(phone); loadOffers();
    connectSocket(phone);
    setLoading(false);
  };

  const connectSocket = (userPhone: string) => {
    // Disconnect dead/old socket before creating new one — prevents listener leak
    if (socketRef.current) {
      if (socketRef.current.connected) return;
      socketRef.current.disconnect();
    }
    const s = io(API, { transports: ['polling', 'websocket'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 2000, reconnectionDelayMax: 10000, timeout: 10000 });
    s.on('connect', () => {
      // Re-join hourly room on reconnect so we don't miss events
      if (activeHourlyIdRef.current) s.emit('joinHourly', { bookingId: activeHourlyIdRef.current });
      s.on('hourlyExtensionResult', (data: any) => {
        if (data.accepted) {
          setHExtendResult('accepted');
          setHourlyBooking((p: any) => p ? { ...p, extend_requested_hours: null, package_hours: data.new_hours ?? p.package_hours, km_included: data.new_km ?? p.km_included, base_fare: data.new_fare ?? p.base_fare } : p);
        } else {
          setHExtendResult('rejected');
          setHourlyBooking((p: any) => p ? { ...p, extend_requested_hours: null } : p);
          loadWallet(userPhone);
        }
        hExtendStepRef.current = 'idle';
        setHExtendStep('idle');
        setTimeout(() => setHExtendResult(null), 6000);
      });
      s.on('hourlyTripCompleted', (data: any) => {
        setHourlyBooking((p: any) => p ? { ...p, status: 'completed', driver_earning: data.driver_earning } : p);
        setHourlyStep('done');
      });
      s.on('hourlyChatMessage', (msg: any) => {
        setHChatMsgs((prev: any[]) => [...prev, msg]);
        setHChatUnread((prev: number) => prev + 1);
      });
      s.on('chatMessage', (msg: any) => {
        setChatMsgs((prev: any[]) => [...prev, msg]);
        setUnreadChat((prev: number) => prev + 1);
      });
      // Live ride status updates via socket
      s.on('rideUpdate', (data: any) => {
        const st = data.status;
        if (st === 'matched' || st === 'arrived') {
          setAltSuggest(null); // clear suggestion when driver found
          setRideData((p: any) => p ? {
            ...p,
            startOtp: data.start_otp || p?.startOtp,
            ...(data.driver ? { driver: data.driver } : {}),
          } : p);
          // Sync to Zustand store so live tab status updates too
          useRideStore.setState({ rideStatus: st, startOtp: data.start_otp || '' });
        }
        if (st === 'searching') {
          // Vehicle switched — update displayed fare/type
          setRideData((p: any) => p ? { ...p, ...(data.new_fare ? { fare: data.new_fare } : {}), ...(data.new_vehicle_type ? { vehicle_type: data.new_vehicle_type } : {}) } : p);
          useRideStore.setState({ rideStatus: 'requested' });
        }
        if (st === 'started') { setScreen('inride'); useRideStore.setState({ rideStatus: 'started', startOtp: '' }); }
        if (st === 'completed') {
          AsyncStorage.removeItem('activeStdRideId').catch(() => {});
          useRideStore.setState({ rideStatus: 'completed' });
          setScreen((cur: Screen) => (cur === 'payment' || cur === 'postride') ? cur : 'payment');
          loadWallet(phoneRef.current || userPhone);
        }
        if (st === 'buddy_declined') {
          buddyWaitingRef.current = false;
          setBuddyWaiting(false);
          setBuddyBookMsg('⚠️ Buddy ne abhi accept nahi kiya. Ab doosre drivers dhundh rahe hain...');
        }
        if (st === 'cancelled') {
          AsyncStorage.removeItem('activeStdRideId').catch(() => {});
          ride.clearRide();
          setRideData(null); setAltSuggest(null); setDriverLoc(null);
          setPickup(''); setDrop(''); setPickupCoords(null); setDropCoords(null); setEta('');
          buddyWaitingRef.current = false;
          setBuddyWaiting(false); setBuddyBookMsg('');
          setScreen('home');
          setResult('❌ Ride cancel ho gayi');
        }
        if (st === 'no_driver') {
          AsyncStorage.removeItem('activeStdRideId').catch(() => {});
          ride.clearRide();
          setRideData(null); setAltSuggest(null); setDriverLoc(null);
          setPickup(''); setDrop(''); setPickupCoords(null); setDropCoords(null); setEta('');
          if (buddyWaitingRef.current) {
            // Buddy direct ride timed out — keep modal open with specific message
            buddyWaitingRef.current = false;
            setBuddyWaiting(false);
            setBuddyBookMsg('⏰ Driver ne 25 seconds mein respond nahi kiya — naya ride try karo');
          } else {
            setBuddyWaiting(false); setBuddyBookMsg('');
            setScreen('home');
            setResult('😔 Abhi driver available nahi — thodi der baad try karo');
          }
        }
      });
      // Alternative vehicle suggestion from backend
      s.on('suggestAlternative', (data: any) => {
        if (data.alternatives?.length > 0) {
          setAltSuggest({ alternatives: data.alternatives, current_type: data.current_type });
        }
      });
    });
    socketRef.current = s;
  };

  const joinRideSocket = (rideId: string | number) => {
    socketRef.current?.emit('joinRide', { rideId });
  };

  const joinHourlySocket = (bookingId: string | number) => {
    activeHourlyIdRef.current = bookingId;
    socketRef.current?.emit('joinHourly', { bookingId });
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !rideData?.ride_id) return;
    const msg = chatInput; setChatInput('');
    try { await fetch(`${API}/api/chat/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, sender: 'customer', message: msg }) }); const r = await fetch(`${API}/api/chat/${rideData.ride_id}`); const d = await r.json(); setChatMsgs(d.messages || []); } catch (_e) {}
  };

  const initiateCall = async (rideId: string | null, bookingId: string | null = null) => {
    try {
      const body: any = { caller_role: 'customer' };
      if (rideId) body.ride_id = rideId;
      if (bookingId) body.booking_id = bookingId;
      const r = await fetch(`${API}/api/call/initiate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!data.success) { Alert.alert('Call', data.error || 'Call nahi ho saki'); return; }
      if (data.method === 'direct' && data.call_number) Linking.openURL(`tel:${data.call_number}`);
      else if (data.method === 'exotel') Alert.alert('📞 Calling', 'Aapke phone pe call aa rahi hai...');
    } catch (_e) { Alert.alert('Error', 'Network error'); }
  };

  const callDriver = () => initiateCall(rideData?.ride_id ?? null);

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
    try { await Share.share({ message: `🚖 Sppero join karo aur ₹50 pao! Mera referral code: ${referralData.code}` }); } catch (_e) {}
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

  const rideIcon = (type: string) => type === 'auto' ? '🛺' : type === 'bike' ? '🏍️' : type === 'eriksha' ? '🛵' : type === 'luxury' ? '🚙' : type === 'green_bike' ? '⚡' : type === 'electric_auto' ? '🌿' : '🚕';

  const RIDES = [
    { id: 'bike',          icon: '🏍️', label: 'Bike',          base: 15, rate: 8,  eta: '2-3 min',  tag: 'FASTEST',  tagColor: '#FF6B35', desc: 'Traffic cut karo fast' },
    { id: 'auto',          icon: '🛺', label: 'Auto',           base: 25, rate: 12, eta: '3-5 min',  tag: null,       tagColor: '',        desc: 'Budget friendly ride' },
    { id: 'car',           icon: '🚕', label: 'Car',            base: 40, rate: 15, eta: '5-7 min',  tag: 'POPULAR',  tagColor: '#2196F3', desc: 'AC • Comfortable' },
    { id: 'eriksha',       icon: '🛵', label: 'E-Riksha',       base: 20, rate: 10, eta: '4-6 min',  tag: 'ECO',      tagColor: '#4CAF50', desc: 'Eco-friendly ride' },
    { id: 'green_bike',    icon: '⚡', label: 'Green Bike',     base: 12, rate: 6,  eta: '2-4 min',  tag: 'GREEN',    tagColor: '#2e7d32', desc: 'Electric Bike • Zero Emission' },
    { id: 'electric_auto', icon: '🌿', label: 'Electric Auto',  base: 20, rate: 9,  eta: '3-5 min',  tag: 'GREEN',    tagColor: '#2e7d32', desc: 'Electric Auto • Eco Ride' },
    { id: 'luxury',        icon: '🚙', label: 'Ultra Luxury',   base: 80, rate: 25, eta: '7-10 min', tag: 'PREMIUM',  tagColor: '#9C27B0', desc: 'Premium SUV experience' },
  ];

  // ═══ SPLASH ═══
  if (screen === 'splash') return (
    <Animated.View style={{ flex: 1, backgroundColor: '#0D0D1A', alignItems: 'center', justifyContent: 'center', opacity: splashFade }}>
      {/* Background circles */}
      <View style={{ position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: 'rgba(147,51,234,0.08)', top: -80, right: -80 }} />
      <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(233,69,96,0.06)', bottom: 40, left: -60 }} />

      {/* Logo block */}
      <Animated.View style={{ alignItems: 'center', opacity: splashLogo, transform: [{ scale: splashScale }] }}>
        <View style={{ width: 110, height: 110, borderRadius: 32, backgroundColor: 'rgba(147,51,234,0.18)', borderWidth: 1.5, borderColor: 'rgba(147,51,234,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: '#9333ea', shadowOpacity: 0.5, shadowRadius: 20, elevation: 12 }}>
          <Text style={{ fontSize: 52 }}>🚖</Text>
        </View>
        <Text style={{ fontSize: 46, fontWeight: '900', color: '#fff', letterSpacing: -1.5 }}>Sppero</Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={{ alignItems: 'center', marginTop: 14, opacity: splashTag, transform: [{ translateY: splashTag.interpolate({ inputRange: [0,1], outputRange: [16, 0] }) }] }}>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, letterSpacing: 0.5 }}>Lucknow ka smartest ride</Text>
      </Animated.View>

      {/* Bottom loader dots */}
      <View style={{ position: 'absolute', bottom: 60, flexDirection: 'row', gap: 8 }}>
        {[0,1,2].map(i => (
          <PulseView key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: i === 0 ? '#9333ea' : 'rgba(255,255,255,0.2)' }} />
        ))}
      </View>
    </Animated.View>
  );

  // ═══ ONBOARDING (first-time only, never shown after logout) ═══
  if (screen === 'onboarding') return (
    <Animated.View style={{ flex: 1, backgroundColor: '#0D0D1A', opacity: onboardFade }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={{ alignItems: 'center', paddingTop: 56, paddingBottom: 32, position: 'relative' }}>
          {/* Decorative circles */}
          <View style={{ position: 'absolute', top: -20, left: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(233,69,96,0.06)', borderWidth: 1, borderColor: 'rgba(233,69,96,0.12)' }} />
          <View style={{ position: 'absolute', top: 30, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(147,51,234,0.07)', borderWidth: 1, borderColor: 'rgba(147,51,234,0.14)' }} />
          <Animated.View style={{ transform: [{ translateY: onboardSlide.interpolate({ inputRange: [0, 60], outputRange: [0, 60] }) }] }}>
            <View style={{ width: 90, height: 90, borderRadius: 28, backgroundColor: 'rgba(233,69,96,0.15)', borderWidth: 1.5, borderColor: 'rgba(233,69,96,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 44 }}>🎉</Text>
            </View>
          </Animated.View>
          <Animated.View style={{ transform: [{ translateY: onboardSlide.interpolate({ inputRange: [0, 60], outputRange: [0, 40] }) }], alignItems: 'center' }}>
            <Text style={{ fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.8, textAlign: 'center' }}>Aapka Swagat Hai!</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13.5, marginTop: 8, textAlign: 'center', lineHeight: 21 }}>Bas thodi si jaankari do{'\n'}aur Sppero pe chalte hain 🚀</Text>
          </Animated.View>
        </View>

        {/* White card sliding up */}
        <Animated.View style={{ backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, flex: 1, padding: 28, transform: [{ translateY: onboardSlide }] }}>
          {/* Name — optional */}
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#bbb', marginBottom: 10, letterSpacing: 1.4 }}>AAPKA NAAM (OPTIONAL)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: userName ? '#e94560' : '#ebebeb', borderRadius: 18, paddingHorizontal: 16, backgroundColor: userName ? '#fff5f6' : '#fafafa', marginBottom: 28 }}>
            <Text style={{ fontSize: 20, marginRight: 10 }}>✍️</Text>
            <TextInput
              style={{ flex: 1, fontSize: 16, fontWeight: '600', color: '#1a1a2e', paddingVertical: 16 }}
              placeholder="Naam likho... (skip kar sakte ho)"
              placeholderTextColor="#ccc"
              value={userName}
              onChangeText={setUserName}
            />
            {userName ? <Text style={{ fontSize: 18 }}>✅</Text> : null}
          </View>

          {/* Gender — optional */}
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#bbb', marginBottom: 12, letterSpacing: 1.4 }}>GENDER (OPTIONAL)</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
            {[
              { id: 'male',   icon: '👨', label: 'Male'   },
              { id: 'female', icon: '👩', label: 'Female' },
              { id: 'other',  icon: '🌈', label: 'Other'  },
            ].map(g => (
              <TouchableOpacity
                key={g.id}
                onPress={() => setGender(prev => prev === g.id ? '' : g.id as any)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 18,
                  backgroundColor: gender === g.id ? '#0D0D1A' : '#f5f5f5',
                  borderWidth: 2, borderColor: gender === g.id ? '#e94560' : '#ebebeb',
                  elevation: gender === g.id ? 4 : 0, shadowColor: '#e94560', shadowOpacity: 0.2, shadowRadius: 6 }}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>{g.icon}</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: gender === g.id ? '#fff' : '#888' }}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Privacy info card */}
          <View style={{ backgroundColor: '#f0fdf4', borderRadius: 16, padding: 16, marginBottom: 28, borderWidth: 1, borderColor: '#bbf7d0', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Text style={{ fontSize: 22, marginTop: 1 }}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#166534', marginBottom: 4 }}>Aapki information safe hai</Text>
              <Text style={{ fontSize: 12, color: '#15803d', lineHeight: 18 }}>Hum aapki personal information kabhi third-party ke saath share nahi karte. Aapka data 100% secure aur encrypted hai.</Text>
            </View>
          </View>

          {result ? <Text style={{ color: '#e94560', fontSize: 13, marginBottom: 12, textAlign: 'center', fontWeight: '600' }}>{result}</Text> : null}

          {/* Continue button */}
          <Bouncy onPress={completeOnboarding} disabled={loading} style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 12, elevation: 6, shadowColor: '#e94560', shadowOpacity: 0.3, shadowRadius: 10 }}>
            <View style={{ backgroundColor: '#e94560', paddingVertical: 18, alignItems: 'center', borderRadius: 18 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 }}>
                {loading ? '⏳ Saving...' : '✨ Chalte Hain!'}
              </Text>
            </View>
          </Bouncy>

          {/* Skip */}
          <TouchableOpacity onPress={completeOnboarding} disabled={loading} style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ color: '#bbb', fontSize: 13, fontWeight: '600' }}>Skip → Baad mein bharna hai</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );

  // ═══ LOGIN ═══
  if (screen === 'login') return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0D0D1A' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Dark hero section */}
        <Animated.View style={{ alignItems: 'center', paddingTop: 68, paddingBottom: 36, opacity: loginHeroAnim, transform: [{ translateY: loginHeroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>
          {/* Glowing logo ring */}
          <View style={{ width: 100, height: 100, borderRadius: 30, backgroundColor: 'rgba(233,69,96,0.12)', borderWidth: 1.5, borderColor: 'rgba(233,69,96,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 22, elevation: 0, shadowColor: '#e94560', shadowOpacity: 0.4, shadowRadius: 20 }}>
            <Text style={{ fontSize: 50 }}>🚖</Text>
          </View>

          {/* Brand name */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 }}>
            <Text style={{ fontSize: 22, fontWeight: '300', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>Welcome to </Text>
            <Text style={{ fontSize: 38, fontWeight: '900', letterSpacing: -1 }}>
              <Text style={{ color: '#e94560' }}>Spp</Text>
              <Text style={{ color: '#fff' }}>ero</Text>
            </Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, letterSpacing: 0.2, textAlign: 'center', lineHeight: 22 }}>Lucknow ka sabse fast aur safe ride{'\n'}Aapka safar, aapke rules</Text>

          {/* Floating vehicle row */}
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 24, opacity: 0.85 }}>
            {['🛺', '🏍️', '🚗', '🚙'].map((v, i) => (
              <View key={i} style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ fontSize: 24 }}>{v}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* White card sliding up */}
        <Animated.View style={{ backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, flex: 1, padding: 28, paddingBottom: 40, transform: [{ translateY: loginCardAnim }] }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: '#1a1a2e', marginBottom: 6, letterSpacing: -0.3 }}>Apna number daalo 📱</Text>
          <Text style={{ color: '#aaa', fontSize: 13.5, marginBottom: 24, lineHeight: 20 }}>Hum aapko OTP bhejenge — koi password nahi</Text>

          {/* Phone input */}
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: phone.length === 10 ? '#e94560' : '#ebebeb', borderRadius: 18, paddingHorizontal: 16, backgroundColor: phone.length === 10 ? '#fff5f6' : '#fafafa', marginBottom: 22 }}>
            <View style={{ paddingRight: 12, borderRightWidth: 1.5, borderRightColor: '#ebebeb', marginRight: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#555' }}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={{ flex: 1, fontSize: 20, fontWeight: '700', color: '#1a1a2e', paddingVertical: 16, letterSpacing: 1.5 }}
              placeholder="XXXXXXXXXX"
              placeholderTextColor="#ddd"
              keyboardType="numeric"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
            />
            {phone.length === 10 && <Text style={{ fontSize: 20 }}>✅</Text>}
          </View>

          {result ? <Text style={{ color: '#e94560', fontSize: 13, marginBottom: 14, textAlign: 'center', fontWeight: '600' }}>{result}</Text> : null}

          {/* CTA button */}
          <Bouncy
            onPress={sendOtp}
            disabled={loading || phone.length < 10}
            style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 18, opacity: phone.length < 10 ? 0.45 : 1, elevation: phone.length === 10 ? 8 : 0, shadowColor: '#e94560', shadowOpacity: 0.35, shadowRadius: 12 }}
          >
            <View style={{ backgroundColor: '#e94560', paddingVertical: 18, alignItems: 'center', borderRadius: 18 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>
                {loading ? '⏳ OTP bhej raha hai...' : 'OTP Bhejo 📱'}
              </Text>
            </View>
          </Bouncy>

          <Text style={{ color: '#ccc', fontSize: 11.5, textAlign: 'center', lineHeight: 18 }}>
            Continue karke aap hamare{' '}
            <Text style={{ color: '#e94560', fontWeight: '700' }}>Terms of Service</Text>
            {' '}aur{' '}
            <Text style={{ color: '#e94560', fontWeight: '700' }}>Privacy Policy</Text>
            {' '}se agree karte hain
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ═══ OTP ═══
  if (screen === 'otp') return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0D0D1A' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Dark hero */}
        <View style={{ alignItems: 'center', paddingTop: 64, paddingBottom: 32 }}>
          <Animated.View style={{ width: 90, height: 90, borderRadius: 28, backgroundColor: 'rgba(233,69,96,0.12)', borderWidth: 1.5, borderColor: 'rgba(233,69,96,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, transform: [{ scale: otpSuccessAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }}>
            <Text style={{ fontSize: 46 }}>🔐</Text>
          </Animated.View>
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>OTP Verify Karo</Text>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13.5, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            6-digit code bheja gaya{'\n'}
            <Text style={{ color: '#e94560', fontWeight: '800' }}>+91 {phone}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.45)' }}> pe 📱</Text>
          </Text>
        </View>

        {/* White card */}
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, flex: 1, padding: 28, paddingBottom: 36 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#bbb', marginBottom: 16, letterSpacing: 1.4 }}>6-DIGIT OTP DAALO</Text>

          {/* 6 OTP Boxes */}
          <Animated.View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22, transform: [{ translateX: otpShakeAnim }] }}>
            {otpDigits.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => { otpRefs.current[i] = ref; }}
                style={{
                  width: 46, height: 58, borderRadius: 16, textAlign: 'center', fontSize: 24, fontWeight: '900',
                  borderWidth: 2.5, borderColor: digit ? '#e94560' : '#f0f0f0',
                  backgroundColor: digit ? '#fff5f6' : '#fafafa', color: '#1a1a2e',
                }}
                keyboardType="number-pad" maxLength={1} value={digit}
                onChangeText={(t) => handleOtpChange(t, i)}
                onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
              />
            ))}
          </Animated.View>

          {/* Clipboard paste */}
          <TouchableOpacity style={{ backgroundColor: '#f0f7ff', borderRadius: 14, padding: 13, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#dbeafe' }} onPress={checkClipboard}>
            <Text style={{ fontSize: 18 }}>📋</Text>
            <Text style={{ fontSize: 13, color: '#1565c0', fontWeight: '700' }}>Clipboard se paste karo</Text>
          </TouchableOpacity>

          {/* Test OTP hint */}
          <View style={{ backgroundColor: '#fff8f0', borderRadius: 14, padding: 12, marginBottom: 18, borderWidth: 1, borderColor: '#fde68a' }}>
            {otpSent ? (
              <Text style={{ fontSize: 12, color: '#92400e', textAlign: 'center', marginBottom: 4 }}>🧪 Test OTP: <Text style={{ fontWeight: '900', letterSpacing: 5 }}>{otpSent}</Text></Text>
            ) : null}
            <Text style={{ fontSize: 11, color: '#b45309', textAlign: 'center' }}>Testing: <Text style={{ fontWeight: '800', letterSpacing: 3 }}>000000</Text> kisi bhi number pe kaam karta hai</Text>
          </View>

          {result ? <Text style={{ color: '#e94560', fontSize: 13, marginBottom: 14, textAlign: 'center', fontWeight: '600' }}>{result}</Text> : null}

          {/* Verify button */}
          <Bouncy
            style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 16, opacity: (loading || otpDigits.join('').length < 6) ? 0.5 : 1, elevation: 6, shadowColor: '#e94560', shadowOpacity: 0.3, shadowRadius: 10 }}
            onPress={() => verifyOtp()} disabled={loading || otpDigits.join('').length < 6}>
            <View style={{ backgroundColor: '#e94560', paddingVertical: 18, alignItems: 'center', borderRadius: 18 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>
                {loading ? '⏳ Verify ho raha hai...' : '✅ OTP Verify Karo'}
              </Text>
            </View>
          </Bouncy>

          {/* Resend */}
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            {canResend ? (
              <TouchableOpacity onPress={async () => {
                setOtpDigits(['','','','','','']); setOtp(''); setResult('');
                setCanResend(false); setResendTimer(60);
                await sendOtp();
              }}>
                <Text style={{ color: '#e94560', fontWeight: '800', fontSize: 14 }}>🔄 OTP Dobara Bhejo</Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ color: '#bbb', fontSize: 13 }}><Text style={{ color: '#e94560', fontWeight: '700' }}>{resendTimer}s</Text> mein dobara bhej sakte ho</Text>
            )}
          </View>

          {/* Back */}
          <TouchableOpacity onPress={() => setScreen('login')} style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Text style={{ color: '#bbb', fontSize: 13 }}>✏️ Number badalna hai? <Text style={{ color: '#e94560', fontWeight: '700' }}>Wapas jao</Text></Text>
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
      {/* City Map — decorative animated graphic (home screen) */}
      <View style={s.mapFit}>
        <CityMapView height={260} />
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

          {/* ─── Favourite Sppero Buddy Card ─────────────────────── */}
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
      {BuddyBookModal()}
    </View>
  );

  // ═══ LIVE RIDE TAB ═══
  if (screen === 'home' && tab === 'live') {
    const hasStd     = !!rideData?.ride_id && storeStatus !== 'cancelled';
    const hasHourly  = !!hourlyBooking && ['pending','matched','active'].includes(hourlyBooking?.status);
    const stdStatus  = storeStatus !== 'idle' ? storeStatus : (rideData?.ride_id ? 'requested' : 'idle');
    const stdStatusMap: any = {
      requested: { label: 'Driver dhoondh rahe hain...', color: '#f57c00', icon: '🔍' },
      matched:   { label: 'Driver aa raha hai',          color: '#1565C0', icon: '🚗' },
      arrived:   { label: 'Driver pahunch gaya!',        color: '#388e3c', icon: '📍' },
      started:   { label: 'Trip chal rahi hai',          color: '#7b1fa2', icon: '🛣️' },
      completed: { label: 'Trip complete — Payment pending', color: '#e94560', icon: '✅' },
    };
    const si = stdStatusMap[stdStatus] || stdStatusMap.requested;
    const driverInfo = ride.driverInfo || rideData?.driver;
    const otp        = ride.startOtp   || rideData?.startOtp;

    const hElapsed   = hourlyTimerSec;
    const hh2 = Math.floor(hElapsed / 3600);
    const mm2 = Math.floor((hElapsed % 3600) / 60);
    const ss2 = hElapsed % 60;
    const hTimerStr  = hh2 > 0 ? `${hh2}h ${mm2}m ${ss2}s` : `${mm2}m ${ss2}s`;
    const hStatus    = hourlyStep === 'active' ? 'Ride chal rahi hai' : hourlyBooking?.status === 'matched' ? 'Driver aa raha hai' : 'Driver dhoondh rahe hain...';
    const hColor     = hourlyStep === 'active' ? '#7b1fa2' : hourlyBooking?.status === 'matched' ? '#1565C0' : '#f57c00';
    const vEmoji: any = { auto:'🛺', bike:'🏍️', car:'🚕', eriksha:'🛵', ultra_luxury:'🚙', green_bike:'⚡', electric_auto:'🌿' };

    return (
      <View style={s.screen}>
        <View style={s.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={s.topTitle}>🔴 Live Ride</Text>
          </View>
          {(hasStd || hasHourly) && (
            <PulseView><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#e94560', marginRight: 4 }} /></PulseView>
          )}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

          {/* ── Standard Ride Card ── */}
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
                {/* Route */}
                {(pickup || drop) ? (
                  <View style={{ backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                    {pickup ? (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: drop ? 8 : 0 }}>
                        <Text style={{ fontSize: 14, marginRight: 8, marginTop: 1 }}>📍</Text>
                        <Text style={{ color: '#333', fontSize: 13, flex: 1 }} numberOfLines={2}>{pickup}</Text>
                      </View>
                    ) : null}
                    {drop ? (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: 14, marginRight: 8, marginTop: 1 }}>🎯</Text>
                        <Text style={{ color: '#333', fontSize: 13, flex: 1 }} numberOfLines={2}>{drop}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Driver info */}
                {driverInfo ? (
                  <View style={{ backgroundColor: '#f0f4ff', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>{(driverInfo.name||'D')[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ color: '#1a1a2e', fontWeight: '700', fontSize: 14 }}>{driverInfo.name}</Text>
                        {driverInfo.verified && (
                          <View style={{ backgroundColor: '#e8f5e9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 9, color: '#2e7d32', fontWeight: '800' }}>✓ VERIFIED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: '#666', fontSize: 12, marginTop: 1 }}>
                        {[driverInfo.vehicle_brand, driverInfo.vehicle_model].filter(Boolean).join(' ')}
                        {driverInfo.vehicle_no ? ` · ${driverInfo.vehicle_no}` : ''}
                      </Text>
                    </View>
                    {driverInfo?.name ? (
                      <TouchableOpacity onPress={callDriver} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 18 }}>📞</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}

                {/* Start OTP */}
                {(stdStatus === 'matched' || stdStatus === 'arrived') && otp ? (
                  <View style={{ backgroundColor: '#e8f5e9', borderRadius: 12, padding: 14, marginBottom: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#2e7d32', fontWeight: '600', marginBottom: 4 }}>Ride Start OTP — Driver ko dikhao</Text>
                    <Text style={{ fontSize: 32, fontWeight: '800', color: '#1b5e20', letterSpacing: 8 }}>{otp}</Text>
                  </View>
                ) : null}

                {/* Full screen CTA */}
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

          {/* ── Hourly Ride Card ── */}
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
                {/* Live timer */}
                {hourlyStep === 'active' && (
                  <View style={{ backgroundColor: '#f3e5f5', borderRadius: 12, padding: 14, marginBottom: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#7b1fa2', fontWeight: '600', marginBottom: 4 }}>Time Elapsed</Text>
                    <Text style={{ fontSize: 30, fontWeight: '800', color: '#6a1b9a', letterSpacing: 4 }}>{hTimerStr}</Text>
                    <Text style={{ fontSize: 11, color: '#9c27b0', marginTop: 4 }}>Package: {hourlyBooking?.package_hours} hours · {hourlyBooking?.km_included} km included</Text>
                  </View>
                )}

                {/* Driver info */}
                {hourlyBooking?.driver ? (
                  <View style={{ backgroundColor: '#f0f4ff', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#7b1fa2', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>{(hourlyBooking.driver.name||'D')[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#1a1a2e', fontWeight: '700', fontSize: 14 }}>{hourlyBooking.driver.name}</Text>
                      <Text style={{ color: '#666', fontSize: 12, marginTop: 1 }}>
                        {[hourlyBooking.driver.vehicle_brand, hourlyBooking.driver.vehicle_model].filter(Boolean).join(' ')}
                      </Text>
                    </View>
                    {hourlyBooking?.driver?.name ? (
                      <TouchableOpacity onPress={() => initiateCall(null, hourlyBooking.id)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#f3e5f5', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 18 }}>📞</Text>
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

          {/* ── Empty state ── */}
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
        <View style={s.navFloat}><NavBarInner /></View>
      </View>
    );
  }

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
        <Bouncy style={s.menuItem} onPress={() => { setPromoScreenCode(''); setPromoScreenMsg(''); setScreen('promo'); }}>
          <View style={s.menuIconBox}><Text style={{ fontSize: 18 }}>🎫</Text></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Promo Codes</Text><Text style={{ fontSize: 11, color: '#999' }}>Discount codes apply karo</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </Bouncy>
        <Bouncy style={s.menuItem} onPress={() => Alert.alert('🔔 Notifications', 'Aapki sabhi ride notifications, wallet alerts aur offers automatically enable hain.\n\nNew rides, driver updates aur promo alerts aapko push notification ke through milenge.')}>
          <View style={s.menuIconBox}><Text style={{ fontSize: 18 }}>🔔</Text></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Notifications</Text><Text style={{ fontSize: 11, color: '#999' }}>Alerts — Enabled ✓</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </Bouncy>
        <Bouncy style={s.menuItem} onPress={() => setScreen('safety')}>
          <View style={s.menuIconBox}><Text style={{ fontSize: 18 }}>🛡️</Text></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Safety</Text><Text style={{ fontSize: 11, color: '#999' }}>Emergency contacts & SOS</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </Bouncy>
        <Bouncy style={s.menuItem} onPress={() => setScreen('support')}>
          <View style={s.menuIconBox}><Text style={{ fontSize: 18 }}>📞</Text></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>Support</Text><Text style={{ fontSize: 11, color: '#999' }}>24x7 help</Text></View>
          <Text style={{ fontSize: 18, color: '#ddd' }}>›</Text>
        </Bouncy>
        <Bouncy style={s.logoutBtn} onPress={async () => { await AsyncStorage.removeItem('userPhone'); await AsyncStorage.removeItem('userName'); setScreen('login'); setTab('home'); setPhone(''); setOtp(''); setOtpDigits(['','','','','','']); setUserName(''); setGender(''); setWalletBalance(0); }}>
          <Text style={{ color: '#e94560', fontWeight: 'bold', fontSize: 14 }}>🚪 Logout</Text>
        </Bouncy>
      </ScrollView>
      <View style={s.navFloat}><NavBarInner /></View>
    </View>
  );

  // ═══ PROMO CODES SCREEN ═══
  if (screen === 'promo') return (
    <ScreenIn style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }} style={{ padding: 4 }}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></TouchableOpacity>
        <Text style={s.topTitle}>🎫 Promo Codes</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Apply code */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a2e', marginBottom: 4 }}>Code Apply Karo</Text>
          <Text style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>Booking se pehle code daalo — discount automatically lagega</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={{ flex: 1, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#1a1a2e', fontWeight: '700', letterSpacing: 1 }}
              placeholder="RIDE50, FLAT20..."
              placeholderTextColor="#ccc"
              autoCapitalize="characters"
              value={promoScreenCode}
              onChangeText={t => { setPromoScreenCode(t.toUpperCase()); setPromoScreenMsg(''); }}
            />
            <TouchableOpacity
              onPress={async () => {
                if (!promoScreenCode.trim()) return;
                setPromoScreenMsg('Checking...');
                try {
                  const res = await fetch(`${API}/api/promo/validate`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: promoScreenCode, fare: 100, phone }),
                  });
                  const d = await res.json();
                  if (d.valid) {
                    setPromoCode(promoScreenCode);
                    setPromoScreenMsg(`✅ ${d.message} — Booking pe apply hoga`);
                  } else {
                    setPromoScreenMsg('❌ ' + (d.message || 'Invalid code'));
                  }
                } catch (_e) { setPromoScreenMsg('❌ Network error'); }
              }}
              style={{ backgroundColor: '#1a1a2e', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11, justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Apply</Text>
            </TouchableOpacity>
          </View>
          {promoCode ? <Text style={{ fontSize: 12, color: '#2e7d32', marginTop: 6 }}>✅ Code saved: <Text style={{ fontWeight: '800' }}>{promoCode}</Text> — next booking pe lagega</Text> : null}
          {promoScreenMsg ? <Text style={{ fontSize: 12, color: promoScreenMsg.startsWith('✅') ? '#2e7d32' : '#e94560', marginTop: 6 }}>{promoScreenMsg}</Text> : null}
        </View>

        {/* Available promos */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#1a1a2e', marginBottom: 10 }}>Available Offers</Text>
        {availablePromos.length === 0 ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 20, alignItems: 'center', elevation: 1 }}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>🎫</Text>
            <Text style={{ color: '#999', fontSize: 13 }}>Abhi koi active promo nahi — jaldi aayenge!</Text>
          </View>
        ) : availablePromos.map((p, i) => (
          <View key={i} style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#e94560' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#1a1a2e', letterSpacing: 1 }}>{p.code}</Text>
              <View style={{ backgroundColor: '#e94560', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
                  {p.discount_type === 'percent' ? `${p.discount_value}% OFF` : `₹${p.discount_value} OFF`}
                </Text>
              </View>
            </View>
            {p.description ? <Text style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{p.description}</Text> : null}
            <Text style={{ fontSize: 11, color: '#999' }}>
              Max discount: ₹{p.max_discount} · Min ride: ₹{p.min_fare}
              {p.expires_at ? ` · Expires: ${new Date(p.expires_at).toLocaleDateString('en-IN')}` : ''}
            </Text>
            <TouchableOpacity
              onPress={() => { setPromoCode(p.code); setPromoScreenCode(p.code); setPromoScreenMsg(`✅ ${p.code} saved — next booking pe lagega`); }}
              style={{ marginTop: 10, backgroundColor: '#1a1a2e', borderRadius: 8, padding: 10, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Use This Code</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </ScreenIn>
  );

  // ═══ SAFETY SCREEN ═══
  if (screen === 'safety') return (
    <ScreenIn style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }} style={{ padding: 4 }}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></TouchableOpacity>
        <Text style={s.topTitle}>🛡️ Safety</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* SOS Button */}
        <View style={{ backgroundColor: '#e94560', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, elevation: 4 }}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>🆘</Text>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 4 }}>Emergency SOS</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>Police, ambulance aur Sppero team ko alert bhejo</Text>
          <TouchableOpacity
            onPress={() => triggerSOS()}
            style={{ backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 }}>
            <Text style={{ color: '#e94560', fontWeight: '900', fontSize: 16 }}>🆘 SOS Alert Bhejo</Text>
          </TouchableOpacity>
        </View>

        {/* Emergency Numbers */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#1a1a2e', marginBottom: 10 }}>Emergency Numbers</Text>
        {[
          { label: '🚓 Police', number: '100', color: '#1a1a2e' },
          { label: '🚑 Ambulance', number: '108', color: '#e94560' },
          { label: '🚒 Fire Brigade', number: '101', color: '#FF5722' },
          { label: '👩 Women Helpline', number: '1091', color: '#9C27B0' },
          { label: '📞 National Emergency', number: '112', color: '#2196F3' },
        ].map((item, i) => (
          <TouchableOpacity key={i} onPress={() => Linking.openURL(`tel:${item.number}`)}
            style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 2 }}>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1a1a2e' }}>{item.label}</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: item.color, marginTop: 2 }}>{item.number}</Text>
            </View>
            <View style={{ backgroundColor: item.color, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Call Now</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Safety Tips */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#1a1a2e', marginTop: 8, marginBottom: 10 }}>Safety Tips</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, elevation: 1 }}>
          {[
            '✅ Driver ka naam aur vehicle number verify karo boarding se pehle',
            '✅ Ride share — family ko location share karo',
            '✅ Raat ko front seat pe mat baitho, back seat prefer karo',
            '✅ Trip end hone se pehle payment mat karo',
            '✅ Kisi bhi problem pe SOS button press karo — help milegi',
          ].map((tip, i) => (
            <Text key={i} style={{ fontSize: 13, color: '#444', paddingVertical: 8, borderBottomWidth: i < 4 ? 1 : 0, borderBottomColor: '#f5f5f5' }}>{tip}</Text>
          ))}
        </View>
      </ScrollView>
    </ScreenIn>
  );

  // ═══ SUPPORT SCREEN ═══
  if (screen === 'support') return (
    <ScreenIn style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }} style={{ padding: 4 }}><Text style={{ color: '#fff', fontSize: 22 }}>←</Text></TouchableOpacity>
        <Text style={s.topTitle}>📞 Support</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ backgroundColor: '#1a1a2e', borderRadius: 20, padding: 20, marginBottom: 16, alignItems: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🎧</Text>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>Sppero Support</Text>
          <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4, textAlign: 'center' }}>24x7 help ke liye humse contact karo</Text>
        </View>

        {/* Contact Options */}
        {[
          { icon: '💬', label: 'WhatsApp', sub: 'Sabse fast response', color: '#25D366', action: () => Linking.openURL('https://wa.me/919999999999?text=Hi%20Sppero%20Support') },
          { icon: '📞', label: 'Helpline Call', sub: '24x7 available', color: '#2196F3', action: () => Linking.openURL('tel:9999999999') },
          { icon: '📧', label: 'Email Support', sub: 'Response in 24 hrs', color: '#e94560', action: () => Linking.openURL('mailto:support@sppero.com') },
        ].map((item, i) => (
          <TouchableOpacity key={i} onPress={item.action}
            style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: item.color, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
              <Text style={{ fontSize: 24 }}>{item.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1a1a2e' }}>{item.label}</Text>
              <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{item.sub}</Text>
            </View>
            <Text style={{ fontSize: 20, color: '#ddd' }}>›</Text>
          </TouchableOpacity>
        ))}

        {/* FAQ */}
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#1a1a2e', marginTop: 8, marginBottom: 10 }}>Aksar Pooche Jane Wale Sawaal</Text>
        {[
          ['Ride cancel kaise karein?', 'Matching screen pe "Cancel" button press karo. 60 seconds tak free cancellation milti hai.'],
          ['Payment kaise karein?', 'Cash, Wallet ya UPI — driver aapke saath settle karega trip end pe.'],
          ['Driver nahi mila?', '100 seconds baad "Surge" option aata hai — fare badhao aur zyada drivers attract karo.'],
          ['Wallet recharge kaise karein?', 'Profile → Wallet → "+₹100/200/500" buttons pe tap karo.'],
          ['Apna account kaise delete karein?', 'support@sppero.com pe email karo — 7 din me delete ho jayega.'],
        ].map(([q, a], i) => (
          <View key={i} style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 }}>❓ {q}</Text>
            <Text style={{ fontSize: 12, color: '#666', lineHeight: 18 }}>{a}</Text>
          </View>
        ))}
      </ScrollView>
    </ScreenIn>
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
    const pkg = hourlyPackages[hVehicle]?.[hPackageHours];
    const hVehicleIcons: any = { auto: '🛺', bike: '🏍️', car: '🚕', eriksha: '🛵', ultra_luxury: '💎', green_bike: '⚡', electric_auto: '🌿' };
    const hHourLabel = (h: number) => h >= 24 ? `${h/24} Day${h > 24 ? 's' : ''}` : h === 8 ? 'Full Day (8h)' : `${h} Hours`;
    const hHourEmoji = (h: number) => h >= 72 ? '🗓️' : h >= 48 ? '📅' : h >= 24 ? '🌙' : h === 2 ? '⏱️' : h === 4 ? '🕐' : h === 6 ? '🕕' : '☀️';
    const fmtTime = (sec: number) => `${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor((sec%3600)/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;

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
          AsyncStorage.setItem('activeHourlyId', String(data.booking_id)).catch(() => {});
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
      Alert.alert(
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
                  Alert.alert('Error', data.error || 'Kuch galat ho gaya — dobara try karo');
                }
              } catch (e: any) {
                Alert.alert('Network Error', 'Server se connect nahi hua');
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
                    <Text style={{ color: '#999', fontSize: 11 }}>{b.extra_km || 0} km × ₹{hourlyPackages[b.vehicle_type || hVehicle]?.extra || 8}/km</Text>
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
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Bouncy style={{ backgroundColor: '#e8f5e9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' }}
                  onPress={() => initiateCall(null, hourlyBooking?.id)}>
                  <Text style={{ fontSize: 18 }}>📞</Text>
                  <Text style={{ fontSize: 9, color: '#2e7d32', fontWeight: '600', marginTop: 2 }}>Call</Text>
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
              ['Extra KM Rate', `₹${hourlyPackages[hourlyBooking?.vehicle_type || hVehicle]?.extra}/km`],
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
            const extraRate = hourlyPackages[hourlyBooking.vehicle_type || hVehicle]?.extra || 8;
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
                  <TouchableOpacity onPress={() => { hExtendStepRef.current = 'choose'; setHExtendStep('choose'); }}
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
                const pkg = hourlyPackages[hourlyBooking?.vehicle_type || hVehicle];
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
                <Bouncy style={{ flex: 1, backgroundColor: '#e0e0e0', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={() => { hExtendStepRef.current = 'idle'; setHExtendStep('idle'); setHExtendHours(1); setHExtendMin(0); }}>
                  <Text style={{ color: '#333', fontWeight: 'bold' }}>Cancel</Text>
                </Bouncy>
                <Bouncy
                  style={{ flex: 2, backgroundColor: (hExtendHours > 0 || hExtendMin >= 15) ? '#e94560' : '#ccc', borderRadius: 10, padding: 12, alignItems: 'center' }}
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
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>📤 Driver ko Request Bhejo</Text>
                </Bouncy>
              </View>
            </View>
          )}

          {/* Extension result feedback */}
          {hExtendResult === 'accepted' && (
            <View style={{ backgroundColor: '#e8f5e9', borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#4CAF50' }}>
              <Text style={{ fontSize: 22, marginRight: 10 }}>✅</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', color: '#2e7d32', fontSize: 14 }}>Extension Approve Ho Gaya!</Text>
                <Text style={{ color: '#388e3c', fontSize: 12, marginTop: 2 }}>Trip aur {parseFloat(hourlyBooking?.package_hours || 0) > hExtendPrevHoursRef.current ? `${Math.round((parseFloat(hourlyBooking?.package_hours || 0) - hExtendPrevHoursRef.current) * 60)} minute` : ''} extend ho gayi</Text>
              </View>
            </View>
          )}
          {hExtendResult === 'rejected' && (
            <View style={{ backgroundColor: '#ffebee', borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#e53935' }}>
              <Text style={{ fontSize: 22, marginRight: 10 }}>❌</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', color: '#c62828', fontSize: 14 }}>Extension Reject Ho Gaya</Text>
                <Text style={{ color: '#e53935', fontSize: 12, marginTop: 2 }}>Driver ne reject kiya — paise wapas wallet mein aa gaye</Text>
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
            <Bouncy style={{ backgroundColor: '#e3f2fd', borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} onPress={() => { hExtendStepRef.current = 'choose'; setHExtendStep('choose'); }}>
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

          {/* Customer wants to end early — immediate, full payment to driver */}
          {!hourlyBooking?.early_end_requested_by && (
            <TouchableOpacity
              style={{ backgroundColor: '#e94560', borderRadius: 14, padding: 18, alignItems: 'center', elevation: 4, shadowColor: '#e94560', shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 }}
              onPress={requestEarlyEnd}
            >
              <Text style={{ fontSize: 26, marginBottom: 4 }}>⏹️</Text>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Trip Complete Karo</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4, textAlign: 'center' }}>Driver ko full payment milegi — turant complete hoga</Text>
            </TouchableOpacity>
          )}
          {hourlyBooking?.early_end_requested_by === 'customer' && (
            <View style={{ backgroundColor: '#fff3e0', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#ffe082' }}>
              <Text style={{ fontSize: 22, marginBottom: 4 }}>⏳</Text>
              <Text style={{ color: '#e65100', fontWeight: '700', fontSize: 14 }}>Driver ke Confirm ka Intezaar...</Text>
              <Text style={{ color: '#999', fontSize: 12, marginTop: 4 }}>Driver ne abhi confirm nahi kiya</Text>
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
          <View style={s.topBar}>
            <View style={{ width: 36 }} />
            <Text style={s.topTitle}>⏱️ Driver Dhundh Rahe Hain</Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <PulseView><Text style={{ fontSize: 72, marginBottom: 16 }}>⏱️</Text></PulseView>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 10 }}>
              {driverAccepted ? 'Driver Mil Gaya!' : 'Booking Confirmed!'}
            </Text>

            <View style={{ backgroundColor: '#e8f5e9', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 16, width: '100%' }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>✅</Text>
              <Text style={{ color: '#2e7d32', fontWeight: '600' }}>₹{hourlyBooking?.fare} Payment Paid — Escrow Mein</Text>
            </View>

            {!driverAccepted && <FloatingDots />}
            <Text style={{ color: '#999', fontSize: 13, marginTop: 12, marginBottom: 20, textAlign: 'center' }}>
              {driverAccepted
                ? 'Driver aa raha hai — OTP ready rakho'
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

            {!driverAccepted && (
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
          {/* Green vehicles row */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {[{id:'green_bike',icon:'⚡',label:'Green Bike'},{id:'electric_auto',icon:'🌿',label:'Elec. Auto'}].map(v => (
              <Bouncy key={v.id} style={{ flex: 1, backgroundColor: hVehicle === v.id ? '#1b5e20' : '#e8f5e9', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 2, borderColor: hVehicle === v.id ? '#66bb6a' : '#a5d6a7' }} onPress={() => setHVehicle(v.id)}>
                <Text style={{ fontSize: 22 }}>{v.icon}</Text>
                <Text style={{ fontSize: 10, fontWeight: '600', marginTop: 3, color: hVehicle === v.id ? '#fff' : '#2e7d32' }}>{v.label}</Text>
                <Text style={{ fontSize: 9, color: hVehicle === v.id ? '#a5d6a7' : '#66bb6a', marginTop: 1 }}>ECO</Text>
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
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#e94560' }}>₹{hourlyPackages.ultra_luxury?.[hPackageHours]?.fare || 800}</Text>
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
            const p = hourlyPackages[hVehicle]?.[h];
            const sel = hPackageHours === h;
            return (
              <Bouncy key={h} onPress={() => setHPackageHours(h)} style={{ backgroundColor: sel ? '#1a1a2e' : '#fff', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 2, borderColor: sel ? '#e94560' : '#f0f0f0', flexDirection: 'row', alignItems: 'center', elevation: sel ? 4 : 1 }}>
                <Text style={{ fontSize: 28, marginRight: 14 }}>{hHourEmoji(h)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: sel ? '#fff' : '#1a1a2e' }}>{hHourLabel(h)}</Text>
                  <Text style={{ fontSize: 12, color: sel ? '#aaa' : '#999', marginTop: 2 }}>{p?.km} km included · extra ₹{hourlyPackages[hVehicle]?.extra}/km</Text>
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
              <Text style={{ color: '#1565c0', fontWeight: '700', fontSize: 12 }}>Package mein {hourlyPackages[hVehicle]?.[hPackageHours]?.km} km included</Text>
              <Text style={{ color: '#1565c0', fontSize: 11, marginTop: 3 }}>
                Aap kahi bhi ja sakte hain {hPackageHours} hour mein. Agar package km exceed hua to extra ₹{hourlyPackages[hVehicle]?.extra}/km trip end pe pay hoga.
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

          {/* Fare Summary */}
          <View style={{ backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 10, letterSpacing: 1 }}>FARE SUMMARY</Text>
            {[
              [`${hHourLabel(hPackageHours)} (${hVehicleIcons[hVehicle]})`, `₹${pkg?.fare}`],
              [`KM Included`, `${pkg?.km} km`],
              [`Extra KM Rate`, `₹${hourlyPackages[hVehicle]?.extra}/km`],
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

          <Bouncy style={[s.btn, { opacity: walletBalance >= (pkg?.fare || 0) ? 1 : 0.5 }]} onPress={walletBalance >= (pkg?.fare || 0) ? bookHourly : () => { loadWalletDetail(phone); loadLoyalty(phone); setScreen('wallet'); }}>
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
              <TextInput style={{ flex: 1, fontSize: 14, color: '#1a1a2e', fontWeight: '500', paddingVertical: 6 }} placeholder="Pickup location..." placeholderTextColor="#bbb" value={pickup} onChangeText={(t) => { setPickup(t); searchPlaces(t, 'pickup'); if (!t) { setPickupCoords(null); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; } }} returnKeyType="next" />
            </View>
            {pickupSugg.length > 0 && (
              <View style={[s.suggBox, { zIndex: 100 }]}>
                {pickupSugg.slice(0, 5).map((sg, i) => (
                  <TouchableOpacity key={i} style={[s.suggItem, { paddingVertical: 12 }]} onPress={() => { setPickup(sg.text); setPickupSugg([]); geocodePlace(sg.text, 'pickup'); }}>
                    <Text style={{ fontSize: 15, marginRight: 8 }}>📍</Text>
                    <Text style={{ fontSize: 13, color: '#1a1a2e', flex: 1, fontWeight: '500' }} numberOfLines={2}>{sg.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={{ height: 1, backgroundColor: '#f0f0f0', marginVertical: 8, marginLeft: 20 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#e94560' }} />
              <TextInput style={{ flex: 1, fontSize: 14, color: '#1a1a2e', fontWeight: '500', paddingVertical: 6 }} placeholder="Drop location..." placeholderTextColor="#bbb" value={drop} onChangeText={(t) => { setDrop(t); searchPlaces(t, 'drop'); if (dropCoords) { setDropCoords(null); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; } }} returnKeyType="done" />
            </View>
            {dropSugg.length > 0 && (
              <View style={[s.suggBox, { zIndex: 100 }]}>
                {dropSugg.slice(0, 5).map((sg, i) => (
                  <TouchableOpacity key={i} style={[s.suggItem, { paddingVertical: 12 }]} onPress={() => { setDrop(sg.text); setDropSugg([]); geocodePlace(sg.text, 'drop'); }}>
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
                    <Text style={{ fontSize: 14, fontWeight: '800', color: fareLoading ? '#bbb' : '#e94560' }}>{fareLoading ? '⌛ ...' : fareEstimates[r.id] ? `₹${fareEstimates[r.id]}` : `₹${r.base}+`}</Text>
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
                    <Text style={{ fontSize: 16, fontWeight: '800', color: fareLoading ? '#bbb' : '#9C27B0' }}>{fareLoading ? '⌛ ...' : fareEstimates['luxury'] ? `₹${fareEstimates['luxury']}` : `₹${lux.base}+`}</Text>
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

          {result ? <Text style={s.err}>{result}</Text> : null}

          {/* Book Button */}
          <Bouncy style={[{ borderRadius: 16, overflow: 'hidden' }, loading && { opacity: 0.7 }]} onPress={bookRide} disabled={loading}>
            <View style={{ backgroundColor: loading ? '#aaa' : '#e94560', padding: 18, alignItems: 'center', borderRadius: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 }}>
                {loading ? '🔍 Driver dhundh raha hai...' : fareLoading ? '⏳ Fare calculate ho raha hai...' : `🚀 Ride Book Karo${fareEstimates[rideType] ? '  •  ₹' + fareEstimates[rideType] : ''}`}
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
                <View style={{ position: 'relative' }}>
                  {rideData.driver.photo
                    ? <Image source={{ uri: rideData.driver.photo }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                    : <View style={s.driverAvatar}><Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>{(rideData.driver.name||'D')[0].toUpperCase()}</Text></View>
                  }
                  {rideData.driver.verified && (
                    <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: '#4CAF50', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={s.driverName}>{rideData.driver.name}</Text>
                    {rideData.driver.verified && (
                      <View style={{ backgroundColor: '#e8f5e9', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Text style={{ fontSize: 9, color: '#2e7d32', fontWeight: '800' }}>✓ VERIFIED</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 12, color: '#1a1a2e', fontWeight: '600', marginTop: 2 }}>
                    {rideData.driver.vehicle_brand ? `${rideData.driver.vehicle_brand} ` : ''}{rideData.driver.vehicle_model || ''}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 1 }}>🚗 {rideData.driver.vehicle_no}</Text>
                  <Text style={{ fontSize: 12, color: '#f0a500', marginTop: 2 }}>⭐ {rideData.driver.rating ? parseFloat(rideData.driver.rating).toFixed(1) : '4.8'}</Text>
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
            <View style={{ paddingBottom: 24 }}>
              {/* Header */}
              <View style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 10 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#1a1a2e' }}>Driver Dhundh Rahe Hain</Text>
                <Text style={{ fontSize: 12, color: '#aaa', marginTop: 4, textAlign: 'center', paddingHorizontal: 28 }} numberOfLines={1}>{pickup} → {drop}</Text>
              </View>

              {/* Fare + vehicle pill */}
              <View style={{ alignItems: 'center', marginBottom: 14 }}>
                <View style={{ backgroundColor: '#1a1a2e', borderRadius: 28, paddingHorizontal: 22, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8 }}>
                  <Text style={{ fontSize: 27, fontWeight: '900', color: '#fff' }}>{surgeFare || rideData?.fare}</Text>
                  <View style={{ width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                  <Text style={{ fontSize: 20 }}>{rideIcon(rideType)}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#e94560', textTransform: 'uppercase', letterSpacing: 0.5 }}>{(rideType || '').replace('_', ' ')}</Text>
                  {surgeCount > 0 && (
                    <View style={{ backgroundColor: '#FF9800', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>⚡ SURGE {surgeCount}x</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Radar animation */}
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <RadarView />
                <FloatingDots />
              </View>

              {/* ── Search Progress Bar ── */}
              <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
                {/* Labels */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                  <Text style={{ fontSize: 11, color: '#ccc', fontWeight: '600' }}>0s</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                    <Text style={{ fontSize: 26, fontWeight: '900', color: searchElapsed >= 80 ? '#FF5722' : searchElapsed >= 60 ? '#FF9800' : '#1a1a2e' }}>
                      {searchElapsed}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#aaa' }}>/ 100s</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#ccc', fontWeight: '600' }}>100s</Text>
                </View>

                {/* Track */}
                <View style={{ height: 10, backgroundColor: '#f0f0f0', borderRadius: 5, overflow: 'hidden' }}>
                  <Animated.View style={{
                    height: '100%', borderRadius: 5,
                    width: surgeBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    backgroundColor: surgeBarAnim.interpolate({
                      inputRange: [0, 0.6, 0.8, 1],
                      outputRange: ['#4CAF50', '#FFC107', '#FF9800', '#FF5722'],
                    }),
                  }} />
                </View>

                {/* Status message */}
                <Text style={{ textAlign: 'center', fontSize: 12, color: '#999', marginTop: 7, fontStyle: 'italic' }}>
                  {searchElapsed < 25 ? '🔍 Nearby drivers dhundh rahe hain...' :
                   searchElapsed < 50 ? '📡 Aur drivers ko ping kar rahe hain...' :
                   searchElapsed < 75 ? '🌐 10km radius tak dhundh rahe hain...' :
                   searchElapsed < 100 ? '⚡ 15km tak dhundh rahe — thodi der aur' :
                   '🔴 Nahi mila — Fare badhao aur attract karo?'}
                </Text>
              </View>

              {/* ── SURGE PANEL (slides in after 100s) ── */}
              {searchElapsed >= 100 && surgeCount < 3 && (() => {
                const baseFare = parseInt((surgeFare || rideData?.fare || '0').replace(/[^0-9]/g, '')) || 0;
                const opts = [
                  { label: '+₹15',  amount: 15,  newFare: baseFare + 15,  emoji: '🟢', bg: '#F1F8E9', border: '#8BC34A', btnBg: '#8BC34A' },
                  { label: '+₹25',  amount: 25,  newFare: baseFare + 25,  emoji: '🟡', bg: '#FFFDE7', border: '#FFC107', btnBg: '#FFC107' },
                  { label: '+₹40',  amount: 40,  newFare: baseFare + 40,  emoji: '🟠', bg: '#FFF3E0', border: '#FF9800', btnBg: '#FF9800' },
                  { label: '+₹65',  amount: 65,  newFare: baseFare + 65,  emoji: '🔴', bg: '#FFEBEE', border: '#F44336', btnBg: '#F44336' },
                  { label: '+₹100', amount: 100, newFare: baseFare + 100, emoji: '🔥', bg: '#F3E5F5', border: '#9C27B0', btnBg: '#9C27B0' },
                ];
                return (
                  <SlideUp>
                    <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
                      <View style={{ backgroundColor: '#1a1a2e', borderRadius: 20, padding: 18, borderWidth: 1.5, borderColor: '#FF5722' }}>
                        {/* Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF5722', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <Text style={{ fontSize: 20 }}>⚡</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>100 Seconds Ho Gaye!</Text>
                            <Text style={{ color: '#FF9800', fontSize: 12, marginTop: 1 }}>Fare badhao — zyada drivers attract karo</Text>
                          </View>
                          <View style={{ backgroundColor: '#FF5722', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{3 - surgeCount}/3</Text>
                          </View>
                        </View>

                        <Text style={{ color: '#888', fontSize: 12, marginBottom: 14 }}>
                          Abhi: <Text style={{ color: '#fff', fontWeight: '700' }}>{surgeFare || rideData?.fare}</Text>
                          {'  '}·{'  '}Badhao aur fresh driver search shuru hoga
                        </Text>

                        {/* Options */}
                        <View style={{ gap: 10 }}>
                          {opts.map((opt) => (
                            <Bouncy key={opt.amount}
                              onPress={() => surgeFareNow(opt.amount)}
                              disabled={surging}
                              style={{
                                backgroundColor: surging ? '#2a2a4a' : opt.bg,
                                borderRadius: 14, padding: 14,
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                borderWidth: 1.5, borderColor: surging ? '#3a3a5a' : opt.border,
                                opacity: surging ? 0.6 : 1,
                              }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <Text style={{ fontSize: 26 }}>{opt.emoji}</Text>
                                <View>
                                  <Text style={{ fontSize: 20, fontWeight: '900', color: surging ? '#666' : '#1a1a2e' }}>{opt.label}</Text>
                                  <Text style={{ fontSize: 11, color: surging ? '#555' : '#777' }}>Naya fare: ₹{opt.newFare}</Text>
                                </View>
                              </View>
                              <View style={{ backgroundColor: surging ? '#555' : opt.btnBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
                                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>₹{opt.newFare}</Text>
                              </View>
                            </Bouncy>
                          ))}
                        </View>

                        {surging && (
                          <View style={{ alignItems: 'center', marginTop: 14 }}>
                            <FloatingDots color="#FF9800" />
                            <Text style={{ color: '#FF9800', fontSize: 13, fontWeight: '700', marginTop: 6 }}>⚡ Fare update ho raha hai...</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </SlideUp>
                );
              })()}

              {/* Alt vehicle suggestion */}
              {altSuggest && altSuggest.alternatives.length > 0 && (
                <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
                  <View style={{ backgroundColor: '#fff8e1', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#ffd54f' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#e65100', textAlign: 'center', marginBottom: 4 }}>
                      😕 {(altSuggest.current_type || '').toUpperCase()} driver nahi mila
                    </Text>
                    <Text style={{ fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 12 }}>
                      Kya hum aapke liye doosra vehicle dhundhe?
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {altSuggest.alternatives.map((alt: string) => {
                        const aicons: Record<string, string> = { auto: '🛺', car: '🚕', bike: '🏍️', eriksha: '🛵', luxury: '🚙', green_bike: '⚡', electric_auto: '🌿' };
                        const alabels: Record<string, string> = { auto: 'Auto', car: 'Car', bike: 'Bike', eriksha: 'E-Riksha', luxury: 'Luxury', green_bike: 'Green Bike', electric_auto: 'E-Auto' };
                        return (
                          <Bouncy key={alt} onPress={() => switchVehicle(alt)} disabled={switchingVehicle}
                            style={{ backgroundColor: switchingVehicle ? '#ccc' : '#1a1a2e', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 18 }}>{aicons[alt] || '🚗'}</Text>
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{alabels[alt] || alt}</Text>
                          </Bouncy>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}

              {/* Cancel info */}
              <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
                <View style={{ backgroundColor: cancelTimer > 0 ? '#e8f5e9' : '#fff3e0', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: cancelTimer > 0 ? '#c8e6c9' : '#ffe0b2' }}>
                  <Text style={{ fontSize: 12, color: cancelTimer > 0 ? '#2e7d32' : '#e65100', fontWeight: '700', textAlign: 'center' }}>
                    {cancelTimer > 0 ? `✅ ${cancelTimer}s tak FREE cancellation` : '⚠️ Ab cancel pe ₹10 fee lagega'}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 3 }}>Aaj {freeCancelsLeft} free cancels bache hain</Text>
                </View>
              </View>

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20 }}>
                <Bouncy onPress={() => setShowCancelModal(true)} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#e94560' }}>
                  <Text style={{ color: '#e94560', fontWeight: 'bold', fontSize: 14 }}>✕ Cancel {cancelTimer > 0 ? '(Free)' : '(₹10)'}</Text>
                </Bouncy>
                <Bouncy onPress={() => { setRideData(null); bookRide(); }} style={{ flex: 1, backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>🔄 Retry</Text>
                </Bouncy>
              </View>
            </View>
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
                  AsyncStorage.removeItem('activeStdRideId').catch(() => {});
                }
                setShowCancelModal(false); setScreen('home'); setRideData(null);
                setPickup(''); setDrop(''); setPickupCoords(null); setDropCoords(null); setEta('');
                setAltSuggest(null); setDriverLoc(null);
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
      ? `upi://pay?pa=${encodeURIComponent(driverUpiId)}&pn=${encodeURIComponent(rideData?.driver?.name || 'Driver')}&am=${fareNum}&cu=INR&tn=Sppero%20Trip`
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

        {/* ── Make Favourite Buddy ── */}
        {rideData?.driver?.phone && (() => {
          const alreadyBuddy = favouriteBuddy?.driver_phone === rideData.driver.phone;
          return (
            <TouchableOpacity
              onPress={async () => {
                if (alreadyBuddy) return;
                const res = await addFavouriteBuddy(rideData.driver.phone);
                if (res?.error) alert('⚠️ ' + res.error);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: alreadyBuddy ? '#e8f5e9' : '#fff8e1', borderRadius: 12, padding: 12, marginVertical: 10, borderWidth: 1.5, borderColor: alreadyBuddy ? '#4CAF50' : '#f0a500' }}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>{alreadyBuddy ? '✅' : '⭐'}</Text>
              <View>
                <Text style={{ fontWeight: '800', fontSize: 13, color: alreadyBuddy ? '#2e7d32' : '#b8860b' }}>
                  {alreadyBuddy ? 'Yeh aapka Sppero Buddy hai!' : `${rideData.driver.name} ko Sppero Buddy banao`}
                </Text>
                {!alreadyBuddy && <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Seedha inhe request bhej sakoge</Text>}
              </View>
            </TouchableOpacity>
          );
        })()}

        <Text style={s.secTitle}>💰 Tip do (optional)</Text>
        <View style={[s.row, { gap: 8, marginBottom: 14 }]}>
          {[0,10,20,50].map(t => (
            <TouchableOpacity key={t} style={[s.tipBtn, tip===t && { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' }]} onPress={() => setTip(t)}>
              <Text style={[{ fontSize: 13, fontWeight: '600', color: '#555' }, tip===t && { color: '#fff' }]}>{t===0 ? 'Skip' : '₹'+t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Bouncy style={[s.btn, { marginTop: 8 }]} onPress={async () => {
          if (rating > 0 && rideData?.ride_id) {
            try { await fetch(`${API}/api/rides/rate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, rating, review, tip }) }); } catch (_e) {}
          }
          setScreen('home'); setPickup(''); setDrop(''); setRating(0); setTab('home');
          setRideData(null); setPaymentDone(false); setResult(''); setScratchCard(null); setScratched(false); setEta(''); setPromoDiscount(0); setPromoCode(''); setUnreadChat(0);
          setDriverLoc(null); setDriverEta(''); setDriverDist('');
          ride.clearRide();
          AsyncStorage.removeItem('activeStdRideId').catch(() => {});
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

  // ═══ FAVOURITE BUDDY DIRECT BOOKING MODAL ═══
  function BuddyBookModal() {
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

    const useMyLocation = async () => {
      if (!userCoords) { setBuddyBookMsg('📍 Location unavailable — manually enter pickup'); return; }
      setBuddyBookMsg('📍 Detect kar rahe hain...');
      try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${userCoords.latitude},${userCoords.longitude}&key=${MAPS_KEY}`);
        const data = await res.json();
        const addr = data.results?.[0]?.formatted_address || '';
        if (addr) {
          setBuddyBookPU(addr);
          setBuddyBookPUCoords({ lat: userCoords.latitude, lng: userCoords.longitude });
          setBuddyPUSugg([]);
          setBuddyBookMsg('');
        } else setBuddyBookMsg('📍 Address nahi mila — manually likhao');
      } catch (_e) { setBuddyBookMsg('❌ Location fetch failed'); }
    };

    const bookWithBuddy = async () => {
      if (isOffline) { setBuddyBookMsg('⛔ Driver offline hai — request nahi bhej sakte'); return; }
      if (!buddyBookPU.trim()) { setBuddyBookMsg('⚠️ Pickup location daalo'); return; }
      if (!buddyBookDR.trim()) { setBuddyBookMsg('⚠️ Drop location daalo'); return; }
      setBuddyBookLoading(true); setBuddyBookMsg('');
      try {
        const res = await apiPost('/api/favourites/book', {
          customer_phone: phone,
          pickup: buddyBookPU,
          drop_location: buddyBookDR,
          pickup_lat: buddyBookPUCoords?.lat,
          pickup_lng: buddyBookPUCoords?.lng,
          drop_lat: buddyBookDRCoords?.lat,
          drop_lng: buddyBookDRCoords?.lng,
        });
        if (res.success) {
          setRideData({ ride_id: res.ride_id, fare: res.fare, startOtp: '', driver: null });
          setPickup(buddyBookPU); setDrop(buddyBookDR);
          if (buddyBookPUCoords) setPickupCoords(buddyBookPUCoords);
          if (buddyBookDRCoords) setDropCoords(buddyBookDRCoords);
          joinRideSocket(res.ride_id);
          AsyncStorage.setItem('activeStdRideId', String(res.ride_id)).catch(() => {});
          buddyWaitingRef.current = true;
          setBuddyWaiting(true);
          setBuddyBookMsg('');
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
            {/* Drag handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 14 }} />

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ paddingBottom: 12 }}>
              {/* ── Header: driver info ── */}
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

              {/* ── Offline alert banner ── */}
              {isOffline && !buddyWaiting && (
                <View style={{ backgroundColor: '#ffebee', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1.5, borderColor: '#ef9a9a', flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, marginRight: 10 }}>⛔</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#b71c1c', fontSize: 13, fontWeight: '800' }}>{favouriteBuddy.driver_name} abhi offline hai</Text>
                    <Text style={{ color: '#c62828', fontSize: 11, marginTop: 2 }}>Request nahi bhejI jayegi. Baad mein try karo ya kisi aur driver se book karo.</Text>
                  </View>
                </View>
              )}

              {/* ── WAITING STATE ── */}
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
                  {/* ── PICKUP ── */}
                  <Text style={{ fontWeight: '700', fontSize: 13, color: '#1a1a2e', marginBottom: 6 }}>📍 Pickup Location</Text>

                  {/* Current location button */}
                  <TouchableOpacity onPress={useMyLocation}
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
                    <View style={{ backgroundColor: '#fff', borderRadius: 12, marginTop: 4, marginBottom: 4, borderWidth: 1, borderColor: '#e8e8e8', elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 }}>
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

                  {/* ── DROP ── */}
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
                    <View style={{ backgroundColor: '#fff', borderRadius: 12, marginTop: 4, marginBottom: 4, borderWidth: 1, borderColor: '#e8e8e8', elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 }}>
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

                  {/* ── Status message ── */}
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

                  {/* ── Book button ── */}
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

  function NavBarInner() {
    const hasLive = (!!rideData?.ride_id && storeStatus !== 'cancelled') ||
                    (!!hourlyBooking && ['pending','matched','active'].includes(hourlyBooking?.status));
    const navTabs = [
      { t: 'home',    icon: '🏠', lbl: 'Home'    },
      { t: 'live',    icon: '🔴', lbl: 'Live'    },
      { t: 'history', icon: '🕐', lbl: 'Trips'   },
      { t: 'profile', icon: '👤', lbl: 'Profile' },
    ];
    return (
      <View style={s.nav}>
        {navTabs.map(({ t, icon, lbl }) => {
          const active = tab === t && screen === 'home';
          return (
            <TouchableOpacity key={t} style={s.navItem} onPress={() => { setScreen('home'); setTab(t); if(t==='history') loadHistory(phone); }} activeOpacity={0.65}>
              <View style={{ position: 'relative', alignItems: 'center' }}>
                <Text style={[s.navIcon, active && { color: '#e94560' }]}>{icon}</Text>
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
}

const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: '#f5f5f5' },
  mapFit:        { height: 260, width: '100%', backgroundColor: '#e8eaed' },
  greeting:      { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  subTxt:        { color: '#aaa', fontSize: 11, marginTop: 2 },
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
  back:          { textAlign: 'center', color: '#e94560', marginTop: 14, fontSize: 13 },
  terms:         { textAlign: 'center', color: '#bbb', fontSize: 11, marginTop: 10 },
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
  menuItem:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
  menuIconBox:   { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  logoutBtn:     { borderWidth: 1.5, borderColor: '#e94560', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 6, marginBottom: 24 },
  suggBox:       { backgroundColor: '#fff', borderRadius: 10, marginTop: 4, elevation: 20, borderWidth: 1, borderColor: '#f0f0f0', zIndex: 99 },
  suggItem:      { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
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
