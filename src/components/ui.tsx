import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, useWindowDimensions, Easing } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { MAPS_KEY } from '../constants';
import { C, R, SHADOW } from '../styles';

// ─── GlassPanel ──────────────────────────────────────────────────────────────
// Glassmorphism via semi-transparent bg + white border + shadow.
// Pure RN — no native blur module needed (cross-platform safe).
export const GlassPanel = ({ children, style, tint = 'light' }: {
  children: React.ReactNode;
  style?: any;
  intensity?: number; // kept for API compat, unused
  tint?: 'light' | 'dark' | 'default';
}) => (
  <View style={[{
    backgroundColor: tint === 'dark'
      ? 'rgba(26,13,46,0.88)'
      : 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: tint === 'dark'
      ? 'rgba(255,255,255,0.10)'
      : 'rgba(255,255,255,0.80)',
    ...SHADOW.md,
    shadowColor: tint === 'dark' ? '#2E1461' : C.pink,
  }, style]}>
    {children}
  </View>
);

// ─── RideVehicleIcon ─────────────────────────────────────────────────────────
export const RideVehicleIcon = ({ id, size = 26, color = '#fff' }: { id: string; size?: number; color?: string }) => {
  if (id === 'bike' || id === 'green_bike') return <MaterialCommunityIcons name="motorbike" size={size} color={id === 'green_bike' ? C.green : color} />;
  if (id === 'auto' || id === 'eriksha') return <MaterialCommunityIcons name="rickshaw" size={size} color={id === 'eriksha' ? C.green : color} />;
  if (id === 'electric_auto') return <Ionicons name="leaf" size={size} color={C.green} />;
  if (id === 'luxury') return <Ionicons name="diamond" size={size - 4} color={color} />;
  return <Ionicons name="car-sport" size={size} color={color} />;
};

// ─── BlobBG — decorative soft blobs on light backgrounds ─────────────────────
export const BlobBG = ({ variant = 'pink' }: { variant?: 'pink' | 'green' | 'blue' | 'yellow' }) => {
  const palettes: Record<string, [string, string, string]> = {
    pink:   ['rgba(255,45,120,0.07)',  'rgba(245,158,11,0.05)',  'rgba(124,58,237,0.04)'],
    green:  ['rgba(5,150,105,0.08)',   'rgba(245,158,11,0.05)',  'rgba(255,45,120,0.04)'],
    blue:   ['rgba(59,130,246,0.08)',  'rgba(255,45,120,0.05)',  'rgba(5,150,105,0.04)'],
    yellow: ['rgba(245,158,11,0.09)',  'rgba(255,45,120,0.05)',  'rgba(5,150,105,0.04)'],
  };
  const [c1, c2, c3] = palettes[variant] || palettes.pink;
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={{ position: 'absolute', width: 340, height: 340, borderRadius: 170, backgroundColor: c1, top: -100, right: -80 }} />
      <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: c2, top: 240, left: -70 }} />
      <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: c3, bottom: 80, right: -40 }} />
      <View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70,  backgroundColor: c2, top: 120, right: 50 }} />
    </View>
  );
};

// Keep DotBG export pointing to BlobBG so existing imports still work
export const DotBG = BlobBG;

// ─── FloatBubbles — animated bubbles rising up ───────────────────────────────
export const FloatBubbles = () => {
  const CFG = [
    { size: 28, color: 'rgba(255,45,120,0.22)',  left: 40,  bottom: 100, dur: 3600, delay: 0    },
    { size: 18, color: 'rgba(5,150,105,0.22)',   left: 140, bottom: 70,  dur: 4200, delay: 700  },
    { size: 22, color: 'rgba(245,158,11,0.20)',  left: 240, bottom: 90,  dur: 3900, delay: 1400 },
    { size: 14, color: 'rgba(124,58,237,0.18)',  left: 300, bottom: 55,  dur: 4500, delay: 300  },
    { size: 20, color: 'rgba(255,45,120,0.15)',  left: 190, bottom: 40,  dur: 3300, delay: 1100 },
    { size: 16, color: 'rgba(5,150,105,0.18)',   left: 80,  bottom: 50,  dur: 4000, delay: 1800 },
  ];
  const anims = useRef(CFG.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    CFG.forEach((b, i) => {
      const run = () => {
        anims[i].setValue(0);
        Animated.sequence([
          Animated.delay(b.delay),
          Animated.timing(anims[i], { toValue: 1, duration: b.dur, useNativeDriver: true }),
        ]).start(run);
      };
      run();
    });
  }, []);
  return (
    <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]} pointerEvents="none">
      {CFG.map((b, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', width: b.size, height: b.size, borderRadius: b.size / 2,
          backgroundColor: b.color, left: b.left, bottom: b.bottom,
          opacity: anims[i].interpolate({ inputRange: [0, 0.12, 0.88, 1], outputRange: [0, 0.9, 0.9, 0] }),
          transform: [{ translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, -130] }) }],
        }} />
      ))}
    </View>
  );
};

// ─── AnimatedLine — glowing dot traveling along a line ───────────────────────
export const AnimatedLine = ({ color = C.pink, width = 200 }: { color?: string; width?: number }) => {
  const pos = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(pos, { toValue: 1, duration: 1600, useNativeDriver: false })).start();
  }, []);
  return (
    <View style={{ width, height: 2, backgroundColor: `${color}22`, borderRadius: 1, overflow: 'hidden', marginVertical: 6 }}>
      <Animated.View style={{
        position: 'absolute', height: 2, borderRadius: 1,
        width: 44, backgroundColor: color,
        left: pos.interpolate({ inputRange: [0, 1], outputRange: [-44, width] }),
        shadowColor: color, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
        elevation: 2,
      }} />
    </View>
  );
};

// ─── PulseView ───────────────────────────────────────────────────────────────
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

// ─── Bouncy Button ───────────────────────────────────────────────────────────
export const Bouncy = ({ children, onPress, style, disabled }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  // Tight press-in, springy release — (.34, 1.56, .64, 1) feel in RN spring terms
  const pressIn  = () => Animated.spring(scale, { toValue: 0.95, friction: 10, tension: 200, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    friction: 5,  tension: 120, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} style={style} disabled={disabled} activeOpacity={1}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── SuccessBurst — Driver Lock Animation ─────────────────────────────────────
export const SuccessBurst = () => {
  // Ripple rings: green → yellow → pink in cascade
  const rings = useRef([0,1,2].map(() => new Animated.Value(0))).current;
  // Car slides in from right
  const carX    = useRef(new Animated.Value(130)).current;
  const carScale = useRef(new Animated.Value(0.3)).current;
  // Motion trail lines (left of car)
  const trail = useRef([0,1,2].map(() => new Animated.Value(0))).current;
  // Check badge stamps onto car
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  // White flash on arrival
  const flash = useRef(new Animated.Value(0)).current;
  // 8 colored dot particles burst
  const dots = useRef([...Array(8)].map(() => ({
    x: new Animated.Value(0), y: new Animated.Value(0), o: new Animated.Value(1),
  }))).current;

  useEffect(() => {
    // 1. Instant white flash
    Animated.sequence([
      Animated.timing(flash, { toValue: 0.5, duration: 60, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 340, useNativeDriver: true }),
    ]).start();

    // 2. Ripple rings cascade (loop so they keep pulsing)
    rings.forEach((r, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 330),
        Animated.timing(r, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])).start()
    );

    // 3. Car spring slides in from right
    Animated.spring(carX,    { toValue: 0, friction: 7, tension: 100, useNativeDriver: true }).start();
    Animated.spring(carScale,{ toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();

    // 4. Motion trail appears then fades
    trail.forEach((t, i) =>
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 80, delay: i * 40, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 300, delay: 100, useNativeDriver: true }),
      ]).start()
    );

    // 5. Check badge stamps in after car lands
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(badgeScale,   { toValue: 1, friction: 3, tension: 220, useNativeDriver: true }),
        Animated.timing(badgeOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
    }, 500);

    // 6. Dot particles burst outward
    dots.forEach((d, i) => {
      const angle = (i / 8) * Math.PI * 2;
      Animated.parallel([
        Animated.timing(d.x, { toValue: Math.cos(angle) * 62, duration: 560, useNativeDriver: true }),
        Animated.timing(d.y, { toValue: Math.sin(angle) * 54, duration: 560, useNativeDriver: true }),
        Animated.timing(d.o, { toValue: 0, duration: 560, delay: 160, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  const DOT_COLORS = ['#4CAF50','#FFC107','#E91E63','#2196F3','#FF5722','#9C27B0','#00BCD4','#FF9800'];
  const RING_COLORS = [C.green, '#FFC107', C.pink];

  return (
    <View style={{ height: 110, alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>

      {/* Flash overlay */}
      <Animated.View style={{
        position: 'absolute', top: -8, left: -60, right: -60, bottom: -8,
        backgroundColor: '#fff', opacity: flash, borderRadius: 18,
      }} />

      {/* Ripple rings */}
      {rings.map((r, i) => (
        <Animated.View key={i} style={{
          position: 'absolute',
          width: 68, height: 68, borderRadius: 34,
          borderWidth: 2.5 - i * 0.5,
          borderColor: RING_COLORS[i],
          opacity: r.interpolate({ inputRange: [0, 0.12, 0.75, 1], outputRange: [0, 1, 0.35, 0] }),
          transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.35, 2.8] }) }],
        }} />
      ))}

      {/* Dot particles */}
      {dots.map((d, i) => (
        <Animated.View key={i} style={{
          position: 'absolute',
          width: 7, height: 7, borderRadius: 3.5,
          backgroundColor: DOT_COLORS[i],
          opacity: d.o,
          transform: [{ translateX: d.x }, { translateY: d.y }],
        }} />
      ))}

      {/* Motion trail — 3 lines, left of car center */}
      {trail.map((t, i) => (
        <Animated.View key={i} style={{
          position: 'absolute',
          height: i === 0 ? 3 : 2,
          width:  i === 0 ? 34 : i === 1 ? 22 : 14,
          borderRadius: 2,
          backgroundColor: C.green,
          opacity: t,
          transform: [
            { translateX: -(i === 0 ? 46 : i === 1 ? 38 : 30) },
            { translateY: i === 0 ? 0 : i === 1 ? 9 : -9 },
          ],
        }} />
      ))}

      {/* 🚗 Car — main element */}
      <Animated.Text style={{
        fontSize: 48,
        transform: [{ translateX: carX }, { scale: carScale }],
      }}>🚗</Animated.Text>

      {/* ✓ Lock badge pops onto car (top-right) */}
      <Animated.View style={{
        position: 'absolute',
        transform: [{ translateX: 30 }, { translateY: -32 }, { scale: badgeScale }],
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: C.green,
        alignItems: 'center', justifyContent: 'center',
        opacity: badgeOpacity,
        elevation: 10, shadowColor: C.green, shadowOpacity: 0.8, shadowRadius: 8,
        borderWidth: 2.5, borderColor: '#fff',
      }}>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>✓</Text>
      </Animated.View>

    </View>
  );
};

// ─── FadeIn ───────────────────────────────────────────────────────────────────
export const FadeIn = ({ children, style, delay = 0 }: any) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(anim, { toValue: 1, duration: 400, delay, useNativeDriver: true }).start(); }, []);
  return <Animated.View style={[style, { opacity: anim }]}>{children}</Animated.View>;
};

// ─── RadarView — concentric rings on light bg ─────────────────────────────────
export const RadarView = () => {
  const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    rings.forEach((r, i) => {
      Animated.loop(Animated.sequence([
        Animated.delay(i * 600),
        Animated.timing(r, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])).start();
    });
  }, []);
  return (
    <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
      {rings.map((r, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', width: 140, height: 140, borderRadius: 70,
          borderWidth: 2.5, borderColor: C.pink,
          opacity: r.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.8, 0.35, 0] }),
          transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] }) }],
        }} />
      ))}
      <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: C.pink, shadowOpacity: 0.45, shadowRadius: 14 }}>
        <Text style={{ fontSize: 30 }}>🚖</Text>
      </View>
    </View>
  );
};

// ─── MapWebView ───────────────────────────────────────────────────────────────
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
    ${pickupCoords?.lat ? `const pickupPos={lat:${pickupCoords.lat},lng:${pickupCoords.lng}};new google.maps.Marker({position:pickupPos,map,icon:{path:google.maps.SymbolPath.CIRCLE,scale:10,fillColor:'#059669',fillOpacity:1,strokeColor:'#fff',strokeWeight:3},animation:google.maps.Animation.DROP});bounds.extend(pickupPos);hasPoint=true;` : ''}
    ${dropCoords?.lat ? `const dropPos={lat:${dropCoords.lat},lng:${dropCoords.lng}};new google.maps.Marker({position:dropPos,map,icon:{path:google.maps.SymbolPath.CIRCLE,scale:10,fillColor:'#FF2D78',fillOpacity:1,strokeColor:'#fff',strokeWeight:3},animation:google.maps.Animation.DROP});bounds.extend(dropPos);hasPoint=true;` : ''}
    ${driverLat && driverLng ? `const driverPos={lat:${driverLat},lng:${driverLng}};new google.maps.Marker({position:driverPos,map,label:{text:'🚗',fontSize:'22px'},icon:{path:google.maps.SymbolPath.CIRCLE,scale:0,fillOpacity:0,strokeOpacity:0}});bounds.extend(driverPos);hasPoint=true;` : ''}
    ${customerLat && customerLng ? `const customerPos={lat:${customerLat},lng:${customerLng}};new google.maps.Marker({position:customerPos,map,label:{text:'🧑',fontSize:'22px'},icon:{path:google.maps.SymbolPath.CIRCLE,scale:0,fillOpacity:0,strokeOpacity:0}});bounds.extend(customerPos);hasPoint=true;` : ''}
    ${pickupCoords?.lat && dropCoords?.lat ? `const ds=new google.maps.DirectionsService();const dr=new google.maps.DirectionsRenderer({map,suppressMarkers:true,polylineOptions:{strokeColor:'#FF2D78',strokeWeight:4,strokeOpacity:0.85}});ds.route({origin:{lat:${pickupCoords.lat},lng:${pickupCoords.lng}},destination:{lat:${dropCoords.lat},lng:${dropCoords.lng}},travelMode:'DRIVING'},(result,status)=>{if(status==='OK')dr.setDirections(result);});` : ''}
    if (hasPoint) { map.fitBounds(bounds, 80); if (map.getZoom() > 16) map.setZoom(16); }
  }
  </script><script async src="https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&callback=initMap"></script></body></html>`;
  return <WebView source={{ html }} style={{ height, width: '100%' }} scrollEnabled={false} javaScriptEnabled domStorageEnabled />;
};

// ─── CityMapView — decorative SVG city map for home screen ───────────────────
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
<rect x="0"   y="187" width="360" height="7" fill="#fafafa" opacity="0.9"/>
<rect x="72"  y="0"   width="7"   height="260" fill="#fafafa" opacity="0.9"/>
<rect x="252" y="0"   width="7"   height="260" fill="#fafafa" opacity="0.9"/>
<rect x="0"   y="124" width="360" height="8" fill="#ffffff" opacity="0.97"/>
<line x1="0"   y1="128" x2="360" y2="128" stroke="#e2bc38" stroke-width="0.9" stroke-dasharray="16 9" opacity="0.4"/>
<rect x="151" y="0"   width="8"   height="260" fill="#ffffff" opacity="0.97"/>
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
<path d="M44,128 L155,128" stroke="#FF2D78" stroke-width="2.5" fill="none" opacity="0.3" stroke-dasharray="10 7" stroke-linecap="round"><animate attributeName="stroke-dashoffset" from="0" to="-51" dur="1.4s" repeatCount="indefinite"/></path>
<path d="M155,128 L155,70 L255,70" stroke="#059669" stroke-width="2" fill="none" opacity="0.25" stroke-dasharray="9 6" stroke-linecap="round"><animate attributeName="stroke-dashoffset" from="0" to="-60" dur="1.8s" repeatCount="indefinite"/></path>
<path d="M36,190 L76,190 L76,128 L155,128" stroke="#059669" stroke-width="2" fill="none" opacity="0.25" stroke-dasharray="9 6" stroke-linecap="round"><animate attributeName="stroke-dashoffset" from="0" to="-60" dur="2s" repeatCount="indefinite"/></path>
<path d="M155,128 L255,128 L255,150" stroke="#F59E0B" stroke-width="2" fill="none" opacity="0.25" stroke-dasharray="9 6" stroke-linecap="round"><animate attributeName="stroke-dashoffset" from="0" to="-45" dur="1.6s" repeatCount="indefinite"/></path>
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
<rect x="108" y="6" width="120" height="26" rx="13" fill="rgba(255,45,120,0.09)" stroke="rgba(255,45,120,0.35)" stroke-width="0.9"/>
<text x="168" y="16" text-anchor="middle" fill="#FF2D78" font-size="10" font-weight="bold" font-family="sans-serif">⚡ SPPERO</text>
<text x="168" y="26" text-anchor="middle" fill="#999" font-size="5.5" font-family="sans-serif">Trusted Rides · Lucknow</text>
<rect x="262" y="76"  width="62" height="30" rx="7" fill="#fff" opacity="0.95" stroke="#a0bcd4" stroke-width="0.9"/>
<text x="278" y="92"  font-size="14" text-anchor="middle" dominant-baseline="central">🏢</text>
<text x="306" y="87"  text-anchor="middle" fill="#20467a" font-size="6.5" font-weight="bold" font-family="sans-serif">IT Hub</text>
<text x="306" y="98"  text-anchor="middle" fill="#5080b0" font-size="5.5" font-family="sans-serif">Office Park</text>
<rect x="4"   y="110" width="60" height="30" rx="7" fill="#fff" opacity="0.95" stroke="#c0b0d4" stroke-width="0.9"/>
<text x="19"  y="126" font-size="14" text-anchor="middle" dominant-baseline="central">🚉</text>
<text x="44"  y="120" text-anchor="middle" fill="#5540a0" font-size="6.5" font-weight="bold" font-family="sans-serif">Railway</text>
<text x="44"  y="131" text-anchor="middle" fill="#8878c0" font-size="5.5" font-family="sans-serif">Station</text>
<rect x="4"   y="43"  width="60" height="30" rx="7" fill="#fff" opacity="0.95" stroke="#a8c4a8" stroke-width="0.9"/>
<text x="19"  y="59"  font-size="14" text-anchor="middle" dominant-baseline="central">🎓</text>
<text x="44"  y="53"  text-anchor="middle" fill="#2a5e2a" font-size="6.5" font-weight="bold" font-family="sans-serif">University</text>
<text x="44"  y="64"  text-anchor="middle" fill="#508050" font-size="5.5" font-family="sans-serif">City Campus</text>
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
<circle cx="155" cy="128" r="17" fill="#fff" opacity="0.97" stroke="#e0b840" stroke-width="1.8"/>
<circle cx="155" cy="128" r="14" fill="#fff9ee" opacity="0.6"/>
<text x="155" y="123" font-size="14" text-anchor="middle" dominant-baseline="central">🛒</text>
<text x="155" y="150" text-anchor="middle" fill="#7a5010" font-size="6" font-weight="bold" font-family="sans-serif">Hazratganj</text>
</svg>
</body>
</html>`;

export const CityMapView = ({ height = 260 }: { height?: number }) => (
  <WebView source={{ html: CITY_MAP_HTML }} style={{ height, width: '100%', backgroundColor: '#f0f2f5' }} scrollEnabled={false} javaScriptEnabled domStorageEnabled />
);

// ─── SlideUp ──────────────────────────────────────────────────────────────────
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

// ─── FloatingDots ─────────────────────────────────────────────────────────────
export const FloatingDots = ({ color = C.pink }: any) => {
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

// ─── EmptyAnim ────────────────────────────────────────────────────────────────
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
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginTop: 22 }}>{title}</Text>
      {sub ? <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>{sub}</Text> : null}
    </Animated.View>
  );
};

// ─── MapOverlay ───────────────────────────────────────────────────────────────
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
        <GlassPanel tint="dark" intensity={20} style={{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, elevation: 4 }}>
          <Animated.View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.green, marginRight: 5, transform: [{ scale: pulse }] }} />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>LIVE</Text>
        </GlassPanel>
      )}
      {hasRoute && (
        <GlassPanel intensity={20} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginRight: 6 }} />
          <Text style={{ color: C.text, fontSize: 11, flex: 1, fontWeight: '600' }} numberOfLines={1}>{pickup}</Text>
          <Text style={{ color: C.textDim, fontSize: 12, marginHorizontal: 5 }}>→</Text>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.pink, marginRight: 6 }} />
          <Text style={{ color: C.text, fontSize: 11, flex: 1, fontWeight: '600' }} numberOfLines={1}>{drop}</Text>
        </GlassPanel>
      )}
    </View>
  );
};

// ─── Confetti ─────────────────────────────────────────────────────────────────
export const Confetti = () => {
  const COLORS = ['#FF2D78','#059669','#F59E0B','#3B82F6','#7C3AED','#EF4444','#06B6D4'];
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

// ─── ScreenIn ─────────────────────────────────────────────────────────────────
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

// ─── TripSteps ────────────────────────────────────────────────────────────────
export const TripSteps = ({ step }: { step: 0 | 1 | 2 | 3 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: step, friction: 8, tension: 60, useNativeDriver: false }).start();
  }, [step]);
  const steps = [{ icon: '🔍', label: 'Booking' }, { icon: '🚗', label: 'Driver' }, { icon: '🛣️', label: 'Ride' }, { icon: '✅', label: 'Done' }];
  return (
    <View style={{ paddingHorizontal: 6, paddingBottom: 14, paddingTop: 4 }}>
      <View style={{ height: 4, backgroundColor: C.glassBorder, borderRadius: 2, marginHorizontal: 14, marginBottom: 10, overflow: 'hidden' }}>
        <Animated.View style={{ height: 4, backgroundColor: C.pink, borderRadius: 2, width: anim.interpolate({ inputRange: [0, 3], outputRange: ['0%', '100%'] }), shadowColor: C.pink, shadowOpacity: 0.5, shadowRadius: 4 }} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {steps.map((s, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Animated.View style={{
              width: 30, height: 30, borderRadius: 15,
              backgroundColor: i <= step ? C.pink : C.glassMid,
              alignItems: 'center', justifyContent: 'center',
              transform: [{ scale: i === step ? 1.2 : 1 }],
              elevation: i === step ? 6 : 0,
              shadowColor: C.pink, shadowOpacity: i === step ? 0.4 : 0, shadowRadius: 8,
              borderWidth: i > step ? 1 : 0, borderColor: C.glassBorder,
            }}>
              <Text style={{ fontSize: 13 }}>{i <= step ? s.icon : '·'}</Text>
            </Animated.View>
            <Text style={{ fontSize: 9, marginTop: 4, color: i <= step ? C.pink : C.textDim, fontWeight: i === step ? '800' : 'normal' }}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── CountUp ──────────────────────────────────────────────────────────────────
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

// ─── GlowPulse ────────────────────────────────────────────────────────────────
export const GlowPulse = ({ color = C.pink, size = 12 }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.8, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    ])).start();
  }, []);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity, transform: [{ scale }] }} />
      <View style={{ width: size * 0.5, height: size * 0.5, borderRadius: size / 4, backgroundColor: color }} />
    </View>
  );
};

// ─── SkeletonBox — shimmer placeholder for loading states ───────────────────
export const SkeletonBox = ({ width, height = 16, radius = 8, style }: {
  width?: number;
  height?: number;
  radius?: number;
  style?: any;
}) => {
  const shimmer = useRef(new Animated.Value(0)).current;
  const { width: W } = useWindowDimensions();
  const w = width ?? W - 64;
  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1100, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, []);
  return (
    <View style={[{ width: w, height, borderRadius: radius, backgroundColor: C.glassMid, overflow: 'hidden' }, style]}>
      <Animated.View style={{
        position: 'absolute', top: 0, bottom: 0, width: 80,
        backgroundColor: 'rgba(255,255,255,0.72)',
        transform: [{ translateX: shimmer.interpolate({ inputRange: [0, 1], outputRange: [-80, w + 80] }) }],
      }} />
    </View>
  );
};

// ─── ShineCard — shine sweep animation ───────────────────────────────────────
export const ShineCard = ({ children, style }: any) => {
  const shine = useRef(new Animated.Value(-100)).current;
  useEffect(() => {
    const loop = () => {
      shine.setValue(-100);
      Animated.sequence([
        Animated.delay(2500),
        Animated.timing(shine, { toValue: 500, duration: 900, useNativeDriver: true }),
      ]).start(() => loop());
    };
    loop();
  }, []);
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      {children}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', top: 0, bottom: 0, width: 70,
        backgroundColor: 'rgba(255,255,255,0.35)',
        transform: [{ translateX: shine }, { skewX: '-20deg' }],
      }} />
    </View>
  );
};

// ─── GradientBar — animated accent bar ───────────────────────────────────────
export const GradientBar = ({ colors = [C.pink, C.yellow], height = 3, style }: any) => (
  <View style={[{ height, borderRadius: height / 2, flexDirection: 'row' }, style]}>
    <View style={{ flex: 1, backgroundColor: colors[0], borderRadius: height / 2 }} />
    <View style={{ flex: 1, backgroundColor: colors[1] || colors[0], borderRadius: height / 2 }} />
  </View>
);

// ─── PinkBadge ────────────────────────────────────────────────────────────────
export const PinkBadge = ({ label, color = C.pink }: any) => (
  <View style={{ backgroundColor: color + '18', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: color + '40' }}>
    <Text style={{ color, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>{label}</Text>
  </View>
);

// ─── IndiaCityCard — metro-map style India illustration ──────────────────────
export const LucknowCityCard = () => {
  const { width: W } = useWindowDimensions();
  const PAD = 18;

  const dotX  = useRef(new Animated.Value(0)).current;
  const autoX = useRef(new Animated.Value(-50)).current;
  const glow  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(dotX, { toValue: 1, duration: 4400, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1.18, duration: 750, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1.0,  duration: 750, useNativeDriver: true }),
      ])
    ).start();

    const drive = () => {
      autoX.setValue(-50);
      Animated.timing(autoX, { toValue: W + 50, duration: 5600, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        .start(({ finished }) => { if (finished) setTimeout(drive, 1400); });
    };
    const t = setTimeout(drive, 500);
    return () => { clearTimeout(t); dotX.stopAnimation(); autoX.stopAnimation(); glow.stopAnimation(); };
  }, []);

  const landmarks = [
    { icon: '🕌', label: 'Taj\nMahal' },
    { icon: '🏰', label: 'Red\nFort' },
    { icon: '⛪', label: 'Golden\nTemple' },
    { icon: '🌉', label: 'Gateway\nMumbai' },
    { icon: '🏛️', label: 'Charminar' },
  ];

  const DOT_Y = 48;

  return (
    <View style={{ height: 148, backgroundColor: '#E8EBF5', overflow: 'hidden' }}>
      {/* Grid lines */}
      {[33, 66].map(p => (
        <View key={`h${p}`} style={{ position: 'absolute', left: 0, right: 0, top: `${p}%` as any, height: 1, backgroundColor: 'rgba(120,130,200,0.07)' }} />
      ))}
      {[25, 50, 75].map(p => (
        <View key={`v${p}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${p}%` as any, width: 1, backgroundColor: 'rgba(120,130,200,0.07)' }} />
      ))}

      {/* India-silhouette blobs */}
      <View style={{ position: 'absolute', width: 220, height: 165, borderTopRightRadius: 90, borderBottomRightRadius: 55, borderBottomLeftRadius: 75, borderTopLeftRadius: 50, backgroundColor: 'rgba(140,148,210,0.11)', top: -8, left: -18 }} />
      <View style={{ position: 'absolute', width: 110, height: 125, borderRadius: 55, borderBottomLeftRadius: 18, borderBottomRightRadius: 28, backgroundColor: 'rgba(140,148,210,0.08)', top: 0, right: 36 }} />
      <View style={{ position: 'absolute', width: 65, height: 75, borderTopRightRadius: 32, borderTopLeftRadius: 32, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: 'rgba(140,148,210,0.06)', bottom: 0, right: 76 }} />

      {/* Dotted route line */}
      <View style={{ position: 'absolute', top: DOT_Y - 1, left: PAD, right: PAD, flexDirection: 'row', overflow: 'hidden', height: 3, alignItems: 'center' }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <View key={i} style={{ width: 6, height: 2.5, borderRadius: 1.5, backgroundColor: 'rgba(255,45,120,0.38)', marginRight: 4 }} />
        ))}
      </View>

      {/* Animated traveling dot with glow */}
      <Animated.View style={{
        position: 'absolute', top: DOT_Y - 8, left: 0,
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: C.pink,
        borderWidth: 3, borderColor: '#fff',
        elevation: 10,
        shadowColor: C.pink, shadowOpacity: 0.35, shadowRadius: 4,
        transform: [
          { translateX: dotX.interpolate({ inputRange: [0, 1], outputRange: [PAD - 8, W - PAD - 8] }) },
          { scale: glow },
        ],
      }} />

      {/* Landmark icons + vertical connectors + junction dots */}
      <View style={{ position: 'absolute', top: 4, left: PAD - 10, right: PAD - 10, flexDirection: 'row', justifyContent: 'space-between' }}>
        {landmarks.map((l, i) => (
          <View key={i} style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 17, lineHeight: 22 }}>{l.icon}</Text>
            <View style={{ width: 1.5, height: 18, backgroundColor: 'rgba(255,45,120,0.20)', marginTop: 1 }} />
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.pink, borderWidth: 1.5, borderColor: '#fff', marginTop: -1 }} />
            <Text style={{ fontSize: 6.5, color: '#6B7CB0', fontWeight: '700', textAlign: 'center', marginTop: 3, lineHeight: 9 }} numberOfLines={2}>{l.label}</Text>
          </View>
        ))}
      </View>

      {/* Road line */}
      <View style={{ position: 'absolute', bottom: 22, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(155,165,220,0.38)' }} />

      {/* Animated auto */}
      <Animated.View style={{ position: 'absolute', bottom: 13, transform: [{ translateX: autoX }] }}>
        <Text style={{ fontSize: 17, transform: [{ scaleX: -1 }] }}>🛺</Text>
      </Animated.View>

      {/* Location dots — decorative */}
      <View style={{ position: 'absolute', top: '12%' as any, left: '7%' as any, width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(124,58,237,0.28)' }} />
      <View style={{ position: 'absolute', top: '32%' as any, left: '14%' as any, width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(124,58,237,0.22)' }} />
      <View style={{ position: 'absolute', top: '18%' as any, right: '14%' as any, width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(124,58,237,0.22)' }} />
      <View style={{ position: 'absolute', top: '42%' as any, right: '24%' as any, width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(124,58,237,0.18)' }} />

      {/* LUCKNOW badge */}
      <View style={{ position: 'absolute', bottom: 5, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,45,120,0.10)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,45,120,0.20)' }}>
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.pink }} />
        <Text style={{ color: C.pink, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }}>INDIA</Text>
      </View>
    </View>
  );
};
