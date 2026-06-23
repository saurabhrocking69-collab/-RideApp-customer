import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { MAPS_KEY } from '../constants';

// ─── RideVehicleIcon ─────────────────────────────────────────────────────────
export const RideVehicleIcon = ({ id, size = 26, color = '#1a1a2e' }: { id: string; size?: number; color?: string }) => {
  if (id === 'bike' || id === 'green_bike') return <MaterialCommunityIcons name="motorbike" size={size} color={id === 'green_bike' ? '#2e7d32' : color} />;
  if (id === 'auto' || id === 'eriksha') return <MaterialCommunityIcons name="rickshaw" size={size} color={id === 'eriksha' ? '#4CAF50' : color} />;
  if (id === 'electric_auto') return <Ionicons name="leaf" size={size} color="#2e7d32" />;
  if (id === 'luxury') return <Ionicons name="diamond" size={size - 4} color={color} />;
  return <Ionicons name="car-sport" size={size} color={color} />;
};

// ─── PulseView ───
export const PulseView = ({ children, style }: any) => {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={[style, { transform: [{ scale: anim }] }]}>{children}</Animated.View>;
};

// ─── Bouncy Button ───
export const Bouncy = ({ children, onPress, style, disabled }: any) => {
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

// ─── SuccessBurst ───
export const SuccessBurst = () => {
  const scale = useRef(new Animated.Value(0)).current;
  const particles = useRef([0,1,2,3,4,5,6,7].map(() => ({
    x: new Animated.Value(0), y: new Animated.Value(0), o: new Animated.Value(1),
  }))).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }).start();
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

// ─── FadeIn ───
export const FadeIn = ({ children, style, delay = 0 }: any) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(anim, { toValue: 1, duration: 400, delay, useNativeDriver: true }).start(); }, []);
  return <Animated.View style={[style, { opacity: anim }]}>{children}</Animated.View>;
};

// ─── RadarView ───
export const RadarView = () => {
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

// ─── MapWebView ───
export const MapWebView = ({ pickup, drop, pickupCoords, dropCoords, driverLat, driverLng, customerLat, customerLng, userLat, userLng, height = 280 }: any) => {
  const centerLat = pickupCoords?.lat || userLat || customerLat || 26.8467;
  const centerLng = pickupCoords?.lng || userLng || customerLng || 80.9462;
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>* { margin: 0; padding: 0; } html, body, #map { height: 100%; width: 100%; } #map { background: #e8eaed; }</style></head><body><div id="map"></div><script>
  let map;
  function initMap() {
    const center = { lat: ${centerLat}, lng: ${centerLng} };
    map = new google.maps.Map(document.getElementById('map'), { center, zoom: 14, disableDefaultUI: true, zoomControl: true, styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }, { featureType: 'transit', stylers: [{ visibility: 'off' }] }] });
    const bounds = new google.maps.LatLngBounds();
    let hasPoint = false;
    ${pickupCoords?.lat ? `const pickupPos={lat:${pickupCoords.lat},lng:${pickupCoords.lng}};new google.maps.Marker({position:pickupPos,map,icon:{path:google.maps.SymbolPath.CIRCLE,scale:10,fillColor:'#4CAF50',fillOpacity:1,strokeColor:'#fff',strokeWeight:3},animation:google.maps.Animation.DROP});bounds.extend(pickupPos);hasPoint=true;` : ''}
    ${dropCoords?.lat ? `const dropPos={lat:${dropCoords.lat},lng:${dropCoords.lng}};new google.maps.Marker({position:dropPos,map,icon:{path:google.maps.SymbolPath.CIRCLE,scale:10,fillColor:'#e94560',fillOpacity:1,strokeColor:'#fff',strokeWeight:3},animation:google.maps.Animation.DROP});bounds.extend(dropPos);hasPoint=true;` : ''}
    ${driverLat && driverLng ? `const driverPos={lat:${driverLat},lng:${driverLng}};new google.maps.Marker({position:driverPos,map,label:{text:'🚗',fontSize:'22px'},icon:{path:google.maps.SymbolPath.CIRCLE,scale:0,fillOpacity:0,strokeOpacity:0}});bounds.extend(driverPos);hasPoint=true;` : ''}
    ${customerLat && customerLng ? `const customerPos={lat:${customerLat},lng:${customerLng}};new google.maps.Marker({position:customerPos,map,label:{text:'🧑',fontSize:'22px'},icon:{path:google.maps.SymbolPath.CIRCLE,scale:0,fillOpacity:0,strokeOpacity:0}});bounds.extend(customerPos);hasPoint=true;` : ''}
    ${pickupCoords?.lat && dropCoords?.lat ? `const ds=new google.maps.DirectionsService();const dr=new google.maps.DirectionsRenderer({map,suppressMarkers:true,polylineOptions:{strokeColor:'#1a1a2e',strokeWeight:4,strokeOpacity:0.8}});ds.route({origin:{lat:${pickupCoords.lat},lng:${pickupCoords.lng}},destination:{lat:${dropCoords.lat},lng:${dropCoords.lng}},travelMode:'DRIVING'},(result,status)=>{if(status==='OK')dr.setDirections(result);});` : ''}
    if (hasPoint) { map.fitBounds(bounds, 80); if (map.getZoom() > 16) map.setZoom(16); }
  }
  </script><script async src="https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&callback=initMap"></script></body></html>`;
  return <WebView source={{ html }} style={{ height, width: '100%' }} scrollEnabled={false} javaScriptEnabled domStorageEnabled />;
};

// ─── CityMapView — decorative SVG city map for home screen ───
const CITY_MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>*{margin:0;padding:0;}html,body{width:100%;height:100%;overflow:hidden;background:#f0f2f5;}</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 260" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block">
<defs>
  <path id="rA"  d="M44,128 L155,128"/>
  <path id="rAr" d="M155,128 L44,128"/>
  <path id="rB"  d="M155,128 L155,70 L255,70"/>
  <path id="rBr" d="M255,70 L155,70 L155,128"/>
  <path id="rC"  d="M36,190 L76,190 L76,128 L155,128"/>
  <path id="rD"  d="M155,128 L255,128 L255,150"/>
  <path id="rDr" d="M255,150 L255,128 L155,128"/>
</defs>
<rect width="360" height="260" fill="#f0f2f5"/>
<rect x="0"   y="0"   width="76"  height="70"  fill="#e6e9e3" opacity="0.75"/>
<rect x="76"  y="0"   width="79"  height="70"  fill="#eaecec" opacity="0.6"/>
<rect x="155" y="0"   width="100" height="70"  fill="#e8ecf0" opacity="0.65"/>
<rect x="255" y="0"   width="105" height="70"  fill="#e4e9f0" opacity="0.7"/>
<rect x="0"   y="128" width="76"  height="62"  fill="#eceae6" opacity="0.65"/>
<rect x="76"  y="128" width="79"  height="62"  fill="#e8eaec" opacity="0.55"/>
<rect x="155" y="128" width="100" height="62"  fill="#eaeced" opacity="0.55"/>
<rect x="255" y="128" width="105" height="62"  fill="#e6eaf0" opacity="0.6"/>
<rect x="0"   y="190" width="76"  height="70"  fill="#ede9e4" opacity="0.7"/>
<rect x="76"  y="190" width="79"  height="70"  fill="#edeae6" opacity="0.65"/>
<rect x="155" y="190" width="100" height="70"  fill="#edebe6" opacity="0.65"/>
<rect x="255" y="190" width="105" height="70"  fill="#eaecf0" opacity="0.65"/>
<path d="M0,38 C28,30 48,46 76,36 C104,26 126,42 155,34 C178,27 200,22 228,29 C252,35 268,25 295,19 C318,14 342,24 360,17" stroke="#90bcd6" stroke-width="13" fill="none" stroke-linecap="round" opacity="0.38"/>
<path d="M0,38 C28,30 48,46 76,36 C104,26 126,42 155,34 C178,27 200,22 228,29 C252,35 268,25 295,19 C318,14 342,24 360,17" stroke="#b4d2e8" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.55"/>
<path d="M0,38 C28,30 48,46 76,36 C104,26 126,42 155,34 C178,27 200,22 228,29 C252,35 268,25 295,19 C318,14 342,24 360,17" stroke="#d4e8f4" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.85"/>
<path d="M60,33 C70,30 80,36 90,32" stroke="#a0c8e0" stroke-width="0.8" fill="none" opacity="0.5"/>
<path d="M190,26 C202,23 214,28 226,25" stroke="#a0c8e0" stroke-width="0.8" fill="none" opacity="0.5"/>
<text x="310" y="16" text-anchor="middle" fill="#4888aa" font-size="6" font-family="sans-serif" font-style="italic" opacity="0.85">Gomti River</text>
<rect x="85" y="8" width="58" height="56" rx="10" fill="#c6e2bc" opacity="0.85"/>
<rect x="85" y="8" width="58" height="56" rx="10" fill="none" stroke="#86be7a" stroke-width="0.9" opacity="0.6"/>
<line x1="114" y1="8"  x2="114" y2="64" stroke="#b0d4a8" stroke-width="1.4" stroke-dasharray="3 4" opacity="0.55"/>
<line x1="85"  y1="36" x2="143" y2="36" stroke="#b0d4a8" stroke-width="1.4" stroke-dasharray="3 4" opacity="0.55"/>
<circle cx="114" cy="36" r="4" fill="#a4cce0" opacity="0.7"/>
<circle cx="114" cy="36" r="2" fill="#c8e4f0" opacity="0.9"/>
<circle cx="98"  cy="20" r="5.5" fill="#72b068" opacity="0.85"/>
<circle cx="114" cy="16" r="4.5" fill="#82c078" opacity="0.8"/>
<circle cx="130" cy="21" r="5"   fill="#6aaa60" opacity="0.85"/>
<circle cx="96"  cy="38" r="4"   fill="#7cba70" opacity="0.8"/>
<circle cx="132" cy="38" r="4.5" fill="#74b26a" opacity="0.8"/>
<circle cx="98"  cy="55" r="4"   fill="#78b46c" opacity="0.8"/>
<circle cx="118" cy="57" r="4.5" fill="#6aaa60" opacity="0.8"/>
<circle cx="133" cy="54" r="3.5" fill="#7cbf72" opacity="0.75"/>
<rect x="0"   y="66" width="360" height="7" fill="#fafafa" opacity="0.9"/>
<line x1="0" y1="66"  x2="360" y2="66"  stroke="#cdd0d5" stroke-width="0.5"/>
<line x1="0" y1="73"  x2="360" y2="73"  stroke="#cdd0d5" stroke-width="0.5"/>
<rect x="0"   y="187" width="360" height="7" fill="#fafafa" opacity="0.9"/>
<line x1="0" y1="187" x2="360" y2="187" stroke="#cdd0d5" stroke-width="0.5"/>
<line x1="0" y1="194" x2="360" y2="194" stroke="#cdd0d5" stroke-width="0.5"/>
<rect x="72"  y="0"   width="7"   height="260" fill="#fafafa" opacity="0.9"/>
<line x1="72" y1="0"  x2="72"  y2="260" stroke="#cdd0d5" stroke-width="0.5"/>
<line x1="79" y1="0"  x2="79"  y2="260" stroke="#cdd0d5" stroke-width="0.5"/>
<rect x="252" y="0"   width="7"   height="260" fill="#fafafa" opacity="0.9"/>
<line x1="252" y1="0" x2="252" y2="260" stroke="#cdd0d5" stroke-width="0.5"/>
<line x1="259" y1="0" x2="259" y2="260" stroke="#cdd0d5" stroke-width="0.5"/>
<rect x="0"   y="124" width="360" height="8" fill="#ffffff" opacity="0.97"/>
<line x1="0"   y1="124" x2="360" y2="124" stroke="#c4c8ce" stroke-width="0.6"/>
<line x1="0"   y1="132" x2="360" y2="132" stroke="#c4c8ce" stroke-width="0.6"/>
<line x1="0"   y1="128" x2="360" y2="128" stroke="#e2bc38" stroke-width="0.9" stroke-dasharray="16 9" opacity="0.4"/>
<rect x="151" y="0"   width="8"   height="260" fill="#ffffff" opacity="0.97"/>
<line x1="151" y1="0"  x2="151" y2="260" stroke="#c4c8ce" stroke-width="0.6"/>
<line x1="159" y1="0"  x2="159" y2="260" stroke="#c4c8ce" stroke-width="0.6"/>
<line x1="155" y1="0"  x2="155" y2="260" stroke="#e2bc38" stroke-width="0.9" stroke-dasharray="16 9" opacity="0.4"/>
<line x1="0"   y1="105" x2="151" y2="105" stroke="#fff" stroke-width="3.5" opacity="0.8"/>
<line x1="159" y1="105" x2="252" y2="105" stroke="#fff" stroke-width="3.5" opacity="0.75"/>
<line x1="259" y1="105" x2="360" y2="105" stroke="#fff" stroke-width="3"   opacity="0.7"/>
<line x1="0"   y1="155" x2="72"  y2="155" stroke="#fff" stroke-width="3"   opacity="0.75"/>
<line x1="79"  y1="155" x2="151" y2="155" stroke="#fff" stroke-width="3"   opacity="0.75"/>
<line x1="159" y1="155" x2="252" y2="155" stroke="#fff" stroke-width="3"   opacity="0.7"/>
<line x1="259" y1="155" x2="360" y2="155" stroke="#fff" stroke-width="3"   opacity="0.7"/>
<line x1="0"   y1="215" x2="72"  y2="215" stroke="#fff" stroke-width="3"   opacity="0.7"/>
<line x1="79"  y1="215" x2="151" y2="215" stroke="#fff" stroke-width="3"   opacity="0.7"/>
<line x1="159" y1="215" x2="252" y2="215" stroke="#fff" stroke-width="3"   opacity="0.7"/>
<line x1="259" y1="215" x2="360" y2="215" stroke="#fff" stroke-width="3"   opacity="0.7"/>
<line x1="38"  y1="0"   x2="38"  y2="66"  stroke="#fff" stroke-width="3.5" opacity="0.75"/>
<line x1="38"  y1="73"  x2="38"  y2="124" stroke="#fff" stroke-width="3.5" opacity="0.75"/>
<line x1="38"  y1="132" x2="38"  y2="187" stroke="#fff" stroke-width="3"   opacity="0.7"/>
<line x1="38"  y1="194" x2="38"  y2="260" stroke="#fff" stroke-width="3"   opacity="0.7"/>
<line x1="113" y1="73"  x2="113" y2="124" stroke="#fff" stroke-width="3"   opacity="0.7"/>
<line x1="113" y1="132" x2="113" y2="187" stroke="#fff" stroke-width="3"   opacity="0.65"/>
<line x1="113" y1="194" x2="113" y2="260" stroke="#fff" stroke-width="3"   opacity="0.65"/>
<line x1="210" y1="73"  x2="210" y2="124" stroke="#fff" stroke-width="3"   opacity="0.7"/>
<line x1="210" y1="132" x2="210" y2="187" stroke="#fff" stroke-width="3"   opacity="0.7"/>
<line x1="210" y1="194" x2="210" y2="260" stroke="#fff" stroke-width="3"   opacity="0.65"/>
<line x1="302" y1="73"  x2="302" y2="124" stroke="#fff" stroke-width="3"   opacity="0.7"/>
<line x1="302" y1="132" x2="302" y2="187" stroke="#fff" stroke-width="3"   opacity="0.7"/>
<line x1="302" y1="194" x2="302" y2="260" stroke="#fff" stroke-width="3"   opacity="0.65"/>
<path d="M0,106 L38,106 L38,124" stroke="#c8b0d8" stroke-width="3.5" fill="none" opacity="0.55" stroke-linecap="round"/>
<path d="M0,106 L38,106 L38,124" stroke="#fff" stroke-width="1.5" fill="none" stroke-dasharray="5 4" opacity="0.65"/>
<line x1="5"  y1="106" x2="5"  y2="109" stroke="#c8b0d8" stroke-width="1.5" opacity="0.45"/>
<line x1="12" y1="106" x2="12" y2="109" stroke="#c8b0d8" stroke-width="1.5" opacity="0.45"/>
<line x1="19" y1="106" x2="19" y2="109" stroke="#c8b0d8" stroke-width="1.5" opacity="0.45"/>
<line x1="26" y1="106" x2="26" y2="109" stroke="#c8b0d8" stroke-width="1.5" opacity="0.45"/>
<path d="M44,128 L155,128" stroke="#e94560" stroke-width="2.5" fill="none" opacity="0.28" stroke-dasharray="10 7" stroke-linecap="round"><animate attributeName="stroke-dashoffset" from="0" to="-51" dur="1.4s" repeatCount="indefinite"/></path>
<path d="M155,128 L155,70 L255,70" stroke="#1a73e8" stroke-width="2" fill="none" opacity="0.24" stroke-dasharray="9 6" stroke-linecap="round"><animate attributeName="stroke-dashoffset" from="0" to="-60" dur="1.8s" repeatCount="indefinite"/></path>
<path d="M36,190 L76,190 L76,128 L155,128" stroke="#34a853" stroke-width="2" fill="none" opacity="0.24" stroke-dasharray="9 6" stroke-linecap="round"><animate attributeName="stroke-dashoffset" from="0" to="-60" dur="2s" repeatCount="indefinite"/></path>
<path d="M155,128 L255,128 L255,150" stroke="#f0a500" stroke-width="2" fill="none" opacity="0.24" stroke-dasharray="9 6" stroke-linecap="round"><animate attributeName="stroke-dashoffset" from="0" to="-45" dur="1.6s" repeatCount="indefinite"/></path>
<text font-size="14" text-anchor="middle" dominant-baseline="central"><animateMotion dur="5s" repeatCount="indefinite" rotate="auto"><mpath href="#rA"/></animateMotion>🚗</text>
<text font-size="12" text-anchor="middle" dominant-baseline="central"><animateMotion dur="5s" begin="-2.5s" repeatCount="indefinite" rotate="auto"><mpath href="#rAr"/></animateMotion>🚕</text>
<text font-size="12" text-anchor="middle" dominant-baseline="central"><animateMotion dur="6.5s" repeatCount="indefinite" rotate="auto"><mpath href="#rB"/></animateMotion>🏍️</text>
<text font-size="13" text-anchor="middle" dominant-baseline="central"><animateMotion dur="6.5s" begin="-3.2s" repeatCount="indefinite" rotate="auto"><mpath href="#rBr"/></animateMotion>🚗</text>
<text font-size="11" text-anchor="middle" dominant-baseline="central"><animateMotion dur="7s" repeatCount="indefinite" rotate="auto"><mpath href="#rC"/></animateMotion>🛺</text>
<text font-size="12" text-anchor="middle" dominant-baseline="central"><animateMotion dur="4.5s" begin="-1s" repeatCount="indefinite" rotate="auto"><mpath href="#rD"/></animateMotion>🚕</text>
<text font-size="11" text-anchor="middle" dominant-baseline="central"><animateMotion dur="4.5s" begin="-3s" repeatCount="indefinite" rotate="auto"><mpath href="#rDr"/></animateMotion>🏍️</text>
<circle cx="76"  cy="70"  r="3.5" fill="#bec2c8" opacity="0.9"/>
<circle cx="155" cy="70"  r="3.5" fill="#bec2c8" opacity="0.9"/>
<circle cx="255" cy="70"  r="3.5" fill="#bec2c8" opacity="0.9"/>
<circle cx="76"  cy="128" r="3.5" fill="#bec2c8" opacity="0.9"/>
<circle cx="255" cy="128" r="3.5" fill="#bec2c8" opacity="0.9"/>
<circle cx="76"  cy="190" r="3"   fill="#bec2c8" opacity="0.8"/>
<circle cx="155" cy="190" r="3"   fill="#bec2c8" opacity="0.8"/>
<circle cx="255" cy="190" r="3"   fill="#bec2c8" opacity="0.8"/>
<rect x="4"   y="110" width="60" height="30" rx="7" fill="#fff" opacity="0.95" stroke="#c0b0d4" stroke-width="0.9"/>
<text x="19"  y="126" font-size="14" text-anchor="middle" dominant-baseline="central">🚉</text>
<text x="44"  y="120" text-anchor="middle" fill="#5540a0" font-size="6.5" font-weight="bold" font-family="sans-serif">Railway</text>
<text x="44"  y="131" text-anchor="middle" fill="#8878c0" font-size="5.5" font-family="sans-serif">Station</text>
<rect x="4"   y="43"  width="60" height="30" rx="7" fill="#fff" opacity="0.95" stroke="#a8c4a8" stroke-width="0.9"/>
<text x="19"  y="59"  font-size="14" text-anchor="middle" dominant-baseline="central">🎓</text>
<text x="44"  y="53"  text-anchor="middle" fill="#2a5e2a" font-size="6.5" font-weight="bold" font-family="sans-serif">University</text>
<text x="44"  y="64"  text-anchor="middle" fill="#508050" font-size="5.5" font-family="sans-serif">City Campus</text>
<rect x="262" y="76"  width="62" height="30" rx="7" fill="#fff" opacity="0.95" stroke="#a0bcd4" stroke-width="0.9"/>
<text x="278" y="92"  font-size="14" text-anchor="middle" dominant-baseline="central">🏢</text>
<text x="306" y="87"  text-anchor="middle" fill="#20467a" font-size="6.5" font-weight="bold" font-family="sans-serif">IT Hub</text>
<text x="306" y="98"  text-anchor="middle" fill="#5080b0" font-size="5.5" font-family="sans-serif">Office Park</text>
<rect x="262" y="136" width="62" height="30" rx="7" fill="#fff" opacity="0.95" stroke="#d4a8a8" stroke-width="0.9"/>
<text x="278" y="152" font-size="14" text-anchor="middle" dominant-baseline="central">🏥</text>
<text x="306" y="147" text-anchor="middle" fill="#841818" font-size="6.5" font-weight="bold" font-family="sans-serif">City Hospital</text>
<text x="306" y="158" text-anchor="middle" fill="#c05050" font-size="5.5" font-family="sans-serif">24x7 Emergency</text>
<rect x="4"   y="197" width="62" height="30" rx="7" fill="#fff" opacity="0.95" stroke="#c8bca8" stroke-width="0.9"/>
<text x="20"  y="213" font-size="14" text-anchor="middle" dominant-baseline="central">🏠</text>
<text x="46"  y="207" text-anchor="middle" fill="#604020" font-size="6.5" font-weight="bold" font-family="sans-serif">Gomti Nagar</text>
<text x="46"  y="218" text-anchor="middle" fill="#907050" font-size="5.5" font-family="sans-serif">Residential</text>
<rect x="84"  y="197" width="62" height="30" rx="7" fill="#fff" opacity="0.95" stroke="#aabcd0" stroke-width="0.9"/>
<text x="100" y="213" font-size="14" text-anchor="middle" dominant-baseline="central">🛍️</text>
<text x="126" y="207" text-anchor="middle" fill="#304070" font-size="6.5" font-weight="bold" font-family="sans-serif">City Mall</text>
<text x="126" y="218" text-anchor="middle" fill="#7888b0" font-size="5.5" font-family="sans-serif">Shopping</text>
<rect x="168" y="197" width="62" height="30" rx="7" fill="#fff" opacity="0.95" stroke="#d4bc88" stroke-width="0.9"/>
<text x="184" y="213" font-size="14" text-anchor="middle" dominant-baseline="central">🕌</text>
<text x="210" y="207" text-anchor="middle" fill="#7a5010" font-size="6" font-weight="bold" font-family="sans-serif">Bara Imambara</text>
<text x="210" y="218" text-anchor="middle" fill="#b08030" font-size="5.5" font-family="sans-serif">Heritage Site</text>
<rect x="262" y="197" width="62" height="30" rx="7" fill="#fff" opacity="0.95" stroke="#c8d0a8" stroke-width="0.9"/>
<text x="278" y="213" font-size="14" text-anchor="middle" dominant-baseline="central">⛽</text>
<text x="306" y="207" text-anchor="middle" fill="#305828" font-size="6.5" font-weight="bold" font-family="sans-serif">Petrol Pump</text>
<text x="306" y="218" text-anchor="middle" fill="#608848" font-size="5.5" font-family="sans-serif">HP / IndianOil</text>
<circle cx="155" cy="128" r="17" fill="#fff" opacity="0.97" stroke="#e0b840" stroke-width="1.8"/>
<circle cx="155" cy="128" r="14" fill="#fff9ee" opacity="0.6"/>
<text x="155" y="123" font-size="14" text-anchor="middle" dominant-baseline="central">🛒</text>
<text x="155" y="150" text-anchor="middle" fill="#7a5010" font-size="6" font-weight="bold" font-family="sans-serif">Hazratganj</text>
<text x="114" y="70" text-anchor="middle" fill="#3a7030" font-size="5.5" font-family="sans-serif" font-style="italic">Ambedkar Park</text>
<text x="105" y="120" text-anchor="middle" fill="#b4b8c0" font-size="4.8" font-family="sans-serif">← Hazratganj Rd →</text>
<text x="145" y="48"  text-anchor="middle" fill="#b4b8c0" font-size="4.8" font-family="sans-serif" transform="rotate(-90,145,48)">MG Marg</text>
<text x="210" y="64"  text-anchor="middle" fill="#b4b8c0" font-size="4.8" font-family="sans-serif">Vibhuti Khand Rd</text>
<text x="36"  y="64"  text-anchor="middle" fill="#b4b8c0" font-size="4.8" font-family="sans-serif">Ring Rd</text>
<rect x="108" y="6" width="120" height="26" rx="13" fill="rgba(233,69,96,0.08)" stroke="rgba(233,69,96,0.30)" stroke-width="0.9"/>
<text x="168" y="16" text-anchor="middle" fill="#e94560" font-size="10" font-weight="bold" font-family="sans-serif">&#x26A1; SPPERO</text>
<text x="168" y="26" text-anchor="middle" fill="#c09098" font-size="5.5" font-family="sans-serif">Trusted Rides · Lucknow</text>
<circle cx="24" cy="242" r="12" fill="rgba(0,0,0,0.04)" stroke="#c4c8ce" stroke-width="0.8"/>
<text x="24"  y="237" text-anchor="middle" fill="#888" font-size="7.5" font-family="sans-serif" font-weight="bold">N</text>
<line x1="24" y1="238" x2="24" y2="247" stroke="#bbb" stroke-width="0.9"/>
<text x="24"  y="254" text-anchor="middle" fill="#bbb" font-size="5" font-family="sans-serif">S</text>
<line x1="15" y1="242" x2="33" y2="242" stroke="#bbb" stroke-width="0.7"/>
<text x="10"  y="244" text-anchor="middle" fill="#bbb" font-size="5" font-family="sans-serif">W</text>
<text x="38"  y="244" text-anchor="middle" fill="#bbb" font-size="5" font-family="sans-serif">E</text>
<line x1="296" y1="249" x2="350" y2="249" stroke="#c0c4ca" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
<line x1="296" y1="246" x2="296" y2="252" stroke="#c0c4ca" stroke-width="1.5" opacity="0.7"/>
<line x1="350" y1="246" x2="350" y2="252" stroke="#c0c4ca" stroke-width="1.5" opacity="0.7"/>
<text x="323" y="258" text-anchor="middle" fill="#aaa" font-size="5.5" font-family="sans-serif">1 km</text>
</svg>
</body>
</html>`;

export const CityMapView = ({ height = 260 }: { height?: number }) => (
  <WebView
    source={{ html: CITY_MAP_HTML }}
    style={{ height, width: '100%', backgroundColor: '#f0f2f5' }}
    scrollEnabled={false}
    javaScriptEnabled
    domStorageEnabled
  />
);

// ─── SlideUp ───
export const SlideUp = ({ children, style, delay = 0 }: any) => {
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

// ─── FloatingDots ───
export const FloatingDots = ({ color = '#e94560' }: any) => {
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

// ─── EmptyAnim ───
export const EmptyAnim = ({ icon, title, sub }: any) => {
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

// ─── MapOverlay ───
export const MapOverlay = ({ hasRoute, pickup, drop, live = false }: any) => {
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

// ─── Confetti ───
export const Confetti = () => {
  const COLORS = ['#e94560','#4CAF50','#f0a500','#2196F3','#9C27B0','#FF5722','#00BCD4'];
  const pieces = useRef([...Array(28)].map((_, i) => ({
    y: new Animated.Value(-20), rot: new Animated.Value(0), o: new Animated.Value(1),
    left: (i * 13 + (i % 4) * 9) % 360, dur: 1200 + (i % 6) * 180, delay: (i % 7) * 90,
    color: COLORS[i % COLORS.length], size: i % 3 === 0 ? 10 : i % 2 === 0 ? 7 : 5, round: i % 4 === 0,
  }))).current;
  useEffect(() => {
    pieces.forEach(p => {
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          Animated.timing(p.y, { toValue: 720, duration: p.dur, useNativeDriver: true }),
          Animated.timing(p.rot, { toValue: 8, duration: p.dur, useNativeDriver: true }),
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
          position: 'absolute', left: p.left, width: p.size, height: p.round ? p.size : p.size * 1.6,
          backgroundColor: p.color, borderRadius: p.round ? p.size : 2, opacity: p.o,
          transform: [{ translateY: p.y }, { rotate: p.rot.interpolate({ inputRange: [0, 8], outputRange: ['0deg', '720deg'] }) }],
        }} />
      ))}
    </View>
  );
};

// ─── ScreenIn — screen mount slide + fade ───
export const ScreenIn = ({ children, style }: any) => {
  const x = useRef(new Animated.Value(45)).current;
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(x, { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 230, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { transform: [{ translateX: x }], opacity: o }]}>{children}</Animated.View>;
};

// ─── TripSteps ───
export const TripSteps = ({ step }: { step: 0 | 1 | 2 | 3 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: step, friction: 8, tension: 60, useNativeDriver: false }).start();
  }, [step]);
  const steps = [{ icon: '🔍', label: 'Booking' }, { icon: '🚗', label: 'Driver' }, { icon: '🛣️', label: 'Ride' }, { icon: '✅', label: 'Done' }];
  return (
    <View style={{ paddingHorizontal: 6, paddingBottom: 14, paddingTop: 4 }}>
      <View style={{ height: 4, backgroundColor: '#f0f0f0', borderRadius: 2, marginHorizontal: 14, marginBottom: 10, overflow: 'hidden' }}>
        <Animated.View style={{ height: 4, backgroundColor: '#e94560', borderRadius: 2, width: anim.interpolate({ inputRange: [0, 3], outputRange: ['0%', '100%'] }) }} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {steps.map((s, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Animated.View style={{
              width: 30, height: 30, borderRadius: 15,
              backgroundColor: i <= step ? '#e94560' : '#efefef',
              alignItems: 'center', justifyContent: 'center',
              transform: [{ scale: i === step ? 1.2 : 1 }], elevation: i === step ? 4 : 0,
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

// ─── CountUp ───
export const CountUp = ({ to, prefix = '', style }: any) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    anim.setValue(prevRef.current);
    const id = anim.addListener(({ value }) => setDisplay(Math.floor(value)));
    Animated.timing(anim, { toValue: to, duration: 750, useNativeDriver: false }).start(() => { prevRef.current = to; });
    return () => anim.removeListener(id);
  }, [to]);
  return <Text style={style}>{prefix}{display}</Text>;
};
