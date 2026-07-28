import React, { useRef, useEffect } from 'react';
import Svg, {
  G, Circle, Ellipse, Path, Rect, Line,
  Defs, LinearGradient, RadialGradient, Stop,
  Text as SvgText,
} from 'react-native-svg';
import { View, Text, Animated, Easing } from 'react-native';

const AnimatedG = Animated.createAnimatedComponent(G);

const PINK   = '#FF2D78';
const PLUM   = '#2E1461';
const GREEN  = '#059669';
const HAIR   = '#14080C';
const SKIN_L = '#DFA070';
const SKIN_M = '#B87840';
const SKIN_D = '#9B5530';
const SHIRT  = '#5BA8FF';
const SHIRTD = '#1A52CC';
const JEANS  = '#3B60D8';
const JEANSD = '#1B2F7E';
const KURTA  = '#F472B6';
const KURTAD = '#9D1755';

/* ═══════════════════════════════════════════════════════════════
   IlluNoDriver  — 220×190
   Smart Indian man searching for a driver, phone raised
   Used in MatchingScreen noDriverFinal block
═══════════════════════════════════════════════════════════════ */
export function IlluNoDriver({ width = 220, height = 190 }: { width?: number; height?: number }) {
  // Character: head at (80,28) r=20, feet at y=160
  return (
    <Svg width={width} height={height} viewBox="0 0 220 190">
      <Defs>
        <RadialGradient id="nd_sk" cx="38%" cy="30%" r="65%">
          <Stop offset="0%"   stopColor={SKIN_L} />
          <Stop offset="100%" stopColor={SKIN_D} />
        </RadialGradient>
        <LinearGradient id="nd_sh" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor={SHIRT} />
          <Stop offset="100%" stopColor={SHIRTD} />
        </LinearGradient>
        <LinearGradient id="nd_jn" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%"   stopColor={JEANS} />
          <Stop offset="100%" stopColor={JEANSD} />
        </LinearGradient>
        <RadialGradient id="nd_bg" cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor="rgba(255,45,120,0.05)" />
          <Stop offset="100%" stopColor="rgba(255,45,120,0)" />
        </RadialGradient>
      </Defs>

      {/* Ambient glow */}
      <Circle cx="110" cy="95" r="85" fill="url(#nd_bg)" />

      {/* ── Road / ground ── */}
      <Path d="M0,162 Q110,154 220,162 L220,190 L0,190 Z" fill="#ECEEF5" />
      <Path d="M0,164 Q110,156 220,164" stroke="white" strokeWidth="2.5"
        strokeDasharray="14,10" fill="none" strokeOpacity="0.8" />

      {/* Person shadow */}
      <Ellipse cx="75" cy="163" rx="20" ry="4" fill="rgba(46,20,97,0.10)" />

      {/* ── Shoes ── */}
      <Ellipse cx="67" cy="159" rx="12"  ry="5"   fill="#110608" />
      <Ellipse cx="80" cy="159.5" rx="11" ry="4.5" fill="#0E0406" />

      {/* ── Jeans ── */}
      <Path d="M63,155 L62,108 L73,108 L72,155 Z" fill={JEANS} />
      <Path d="M73,155 L74,108 L84,108 L83,155 Z" fill={JEANSD} />
      {/* subtle crease */}
      <Line x1="67" y1="108" x2="66" y2="140" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" />
      <Line x1="79" y1="108" x2="80" y2="140" stroke="rgba(0,0,0,0.10)" strokeWidth="1" />

      {/* ── Belt ── */}
      <Rect x="62" y="102" width="33" height="7"  rx="2"   fill="#1A0802" />
      <Rect x="74" y="100" width="9"  height="11" rx="1.5" fill="#8A6A18" />

      {/* ── Shirt body ── */}
      <Path d="M62,102 Q59,82 70,73 L77,70 L80,65 L83,70 L90,73 Q101,82 98,102 Z"
        fill="url(#nd_sh)" />
      {/* Collar */}
      <Path d="M77,70 L80,78 L83,70" fill="#7ABEFF" stroke={SHIRTD} strokeWidth="0.6" />
      {/* Shirt pocket detail */}
      <Rect x="84" y="82" width="9" height="7" rx="2" fill="rgba(0,0,0,0.10)" />

      {/* ── Left arm relaxed ── */}
      <Path d="M62,84 Q51,98 53,114" stroke={SHIRTD} strokeWidth="14" fill="none" strokeLinecap="round" />
      <Path d="M53,114 Q51,124 55,134" stroke={SKIN_M} strokeWidth="12" fill="none" strokeLinecap="round" />
      {/* Relaxed fist */}
      <Circle cx="57" cy="137" r="6" fill={SKIN_M} />

      {/* ── Right arm raised — holding phone ── */}
      <Path d="M98,84 Q109,70 110,52" stroke={SHIRTD} strokeWidth="14" fill="none" strokeLinecap="round" />
      <Path d="M110,52 Q112,36 110,22" stroke={SKIN_M} strokeWidth="12" fill="none" strokeLinecap="round" />

      {/* ── Phone ── */}
      <Rect x="103" y="8" width="17" height="28" rx="4" fill="#0D0620" />
      <Rect x="105.5" y="11" width="12" height="22" rx="2.5" fill="#EAE4FF" />
      {/* Search indicator on screen */}
      <Circle cx="111.5" cy="16" r="3.5" fill="none" stroke={PLUM} strokeWidth="1.3" />
      <Line x1="114" y1="18.5" x2="116.5" y2="21" stroke={PLUM} strokeWidth="1.5" strokeLinecap="round" />
      {/* Loading dots */}
      <Circle cx="107.5" cy="27" r="1.8" fill={PINK} />
      <Circle cx="111.5" cy="27" r="1.8" fill={PINK} fillOpacity="0.5" />
      <Circle cx="115.5" cy="27" r="1.8" fill={PINK} fillOpacity="0.2" />

      {/* ── Neck ── */}
      <Rect x="74" y="48" width="12" height="14" rx="5" fill={SKIN_D} />

      {/* ── Short male hair (above head) ── */}
      <Path d="M60,18 Q60,6 80,4 Q100,6 100,18 Q97,8 80,7 Q63,8 60,18 Z" fill={HAIR} />
      {/* Sideburns */}
      <Line x1="60" y1="18" x2="60" y2="27" stroke={HAIR} strokeWidth="3" strokeLinecap="round" />
      <Line x1="100" y1="18" x2="100" y2="27" stroke={HAIR} strokeWidth="3" strokeLinecap="round" />

      {/* ── Face ── */}
      <Circle cx="80" cy="28" r="20" fill="url(#nd_sk)" />

      {/* Ears */}
      <Ellipse cx="60" cy="28" rx="4"   ry="7.5" fill={SKIN_D} />
      <Ellipse cx="100" cy="28" rx="4"  ry="7.5" fill={SKIN_D} />

      {/* ── Eyebrows — raised/worried ── */}
      <Path d="M68,19 Q75,14 80,19" stroke={HAIR} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <Path d="M80,19 Q85,14 92,19" stroke={HAIR} strokeWidth="2.2" fill="none" strokeLinecap="round" />

      {/* ── Left eye ── */}
      <Ellipse cx="69" cy="24" rx="6"  ry="5.5" fill="white" />
      <Circle  cx="69.5" cy="24" r="3.5" fill="#241008" />
      <Circle  cx="69.5" cy="24" r="2"   fill="#060204" />
      <Circle  cx="70.8" cy="22.4" r="1.1" fill="white" />
      {/* Eyelid */}
      <Path d="M63,25.5 Q69,19.5 75,25.5" stroke={HAIR} strokeWidth="1.5" fill="none" />

      {/* ── Right eye ── */}
      <Ellipse cx="91" cy="24" rx="6"  ry="5.5" fill="white" />
      <Circle  cx="90.5" cy="24" r="3.5" fill="#241008" />
      <Circle  cx="90.5" cy="24" r="2"   fill="#060204" />
      <Circle  cx="91.8" cy="22.4" r="1.1" fill="white" />
      {/* Eyelid */}
      <Path d="M85,25.5 Q91,19.5 97,25.5" stroke={HAIR} strokeWidth="1.5" fill="none" />

      {/* ── Nose ── */}
      <Path d="M79,33 Q76,37 76,39" stroke={SKIN_D} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <Path d="M79,33 Q83,37 83,39" stroke={SKIN_D} strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* ── Worried mouth ── */}
      <Path d="M73,42 Q80,38 87,42" stroke="#8B4020" strokeWidth="2.4" fill="none" strokeLinecap="round" />

      {/* ── Sweat drop ── */}
      <Path d="M95,21 Q97.5,26 95,30 Q92.5,26 95,21 Z" fill="#78C8F8" fillOpacity="0.8" />

      {/* ── Question marks floating (right side, varies size) ── */}
      <SvgText x="142" y="68"  fontSize="26" fontWeight="bold" fill={PINK}   fillOpacity="0.72">?</SvgText>
      <SvgText x="28"  y="82"  fontSize="18" fontWeight="bold" fill="#7C3AED" fillOpacity="0.38">?</SvgText>
      <SvgText x="162" y="114" fontSize="13" fontWeight="bold" fill={PINK}   fillOpacity="0.28">?</SvgText>

      {/* ── Radar / search rings (right side) ── */}
      <Circle cx="152" cy="86" r="30" fill="none" stroke={PINK} strokeWidth="1.2" strokeOpacity="0.14" />
      <Circle cx="152" cy="86" r="20" fill="none" stroke={PINK} strokeWidth="1.2" strokeOpacity="0.22" />
      <Circle cx="152" cy="86" r="11" fill="none" stroke={PINK} strokeWidth="1.5" strokeOpacity="0.36" />
      <Circle cx="152" cy="86" r="4"  fill={PINK} fillOpacity="0.28" />

      {/* ── Street lamp (left side) ── */}
      <Rect x="15" y="94" width="4.5" height="68" rx="2" fill="#B4BAC8" />
      <Path d="M19.5,94 Q30,88 30,97" stroke="#B4BAC8" strokeWidth="4.5" fill="none" />
      <Ellipse cx="30" cy="100" rx="5.5" ry="3" fill="#FFE07A" fillOpacity="0.45" />
    </Svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   IlluCancel  — 200×128
   Auto driving away, sad woman waving goodbye, broken heart
   Used in CancelModal header
═══════════════════════════════════════════════════════════════ */
export function IlluCancel({ width = 200, height = 128 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 128">
      <Defs>
        <RadialGradient id="ic_sk" cx="38%" cy="30%" r="65%">
          <Stop offset="0%"   stopColor={SKIN_L} />
          <Stop offset="100%" stopColor={SKIN_D} />
        </RadialGradient>
        <LinearGradient id="ic_ab" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor="#FF8A20" />
          <Stop offset="100%" stopColor="#C84800" />
        </LinearGradient>
        <LinearGradient id="ic_rf" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor="#FF6500" />
          <Stop offset="100%" stopColor="#A03200" />
        </LinearGradient>
        <LinearGradient id="ic_kt" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor={KURTA} />
          <Stop offset="100%" stopColor={KURTAD} />
        </LinearGradient>
      </Defs>

      {/* Road */}
      <Path d="M0,106 Q100,100 200,106 L200,128 L0,128 Z" fill="#ECEEF5" />
      <Path d="M0,108 Q100,102 200,108" stroke="white" strokeWidth="2"
        strokeDasharray="12,9" fill="none" strokeOpacity="0.75" />

      {/* ── Auto (right side, driving away) ── */}
      {/* Shadow */}
      <Ellipse cx="158" cy="104" rx="34" ry="5" fill="rgba(0,0,0,0.08)" />
      {/* Body */}
      <Path d="M118,90 L118,60 Q118,52 126,52 L190,52 Q196,52 196,60 L196,90 Z" fill="url(#ic_ab)" />
      {/* Roof */}
      <Path d="M120,62 L120,52 Q120,44 128,44 L188,44 Q194,44 194,52 L194,62 Z" fill="url(#ic_rf)" />
      {/* Rear windshield glass */}
      <Path d="M124,61 L124,53 L190,53 L190,61 Z" fill="#AADEFF" fillOpacity="0.55" />
      {/* Glass glare */}
      <Rect x="126" y="53" width="14" height="2.5" rx="1" fill="white" fillOpacity="0.5" />
      {/* Vertical window bars */}
      <Line x1="136" y1="52" x2="136" y2="90" stroke="rgba(0,0,0,0.16)" strokeWidth="1.5" />
      <Line x1="150" y1="52" x2="150" y2="90" stroke="rgba(0,0,0,0.16)" strokeWidth="1.5" />
      <Line x1="163" y1="52" x2="163" y2="90" stroke="rgba(0,0,0,0.16)" strokeWidth="1.5" />
      <Line x1="176" y1="52" x2="176" y2="90" stroke="rgba(0,0,0,0.16)" strokeWidth="1.5" />
      {/* Tail lights */}
      <Rect x="120" y="70" width="6.5" height="8" rx="2" fill="#FF3030" />
      <Rect x="187" y="70" width="6.5" height="8" rx="2" fill="#FF3030" />
      {/* SPPERO strip */}
      <Rect x="124" y="86" width="64" height="5" rx="2" fill={PINK} fillOpacity="0.88" />
      {/* Wheels */}
      <Circle cx="133" cy="94" r="12" fill="#1C1C3A" />
      <Circle cx="133" cy="94" r="8"  fill="#2E2E50" />
      <Circle cx="133" cy="94" r="3.5" fill="#7878A0" />
      <Circle cx="180" cy="94" r="12" fill="#1C1C3A" />
      <Circle cx="180" cy="94" r="8"  fill="#2E2E50" />
      <Circle cx="180" cy="94" r="3.5" fill="#7878A0" />
      {/* Speed lines going left */}
      <Line x1="104" y1="62" x2="116" y2="62" stroke="#FF8A20" strokeWidth="2.5" strokeOpacity="0.55" strokeLinecap="round" />
      <Line x1="98"  y1="70" x2="116" y2="70" stroke="#FF8A20" strokeWidth="2"   strokeOpacity="0.38" strokeLinecap="round" />
      <Line x1="102" y1="78" x2="116" y2="78" stroke="#FF8A20" strokeWidth="1.5" strokeOpacity="0.25" strokeLinecap="round" />

      {/* ── Sad woman waving goodbye (left side) ── */}
      {/* Person at x=42, feet at y=108 */}
      {/* Shadow */}
      <Ellipse cx="42" cy="110" rx="16" ry="3.5" fill="rgba(46,20,97,0.09)" />
      {/* Shoes */}
      <Ellipse cx="34" cy="108" rx="9"  ry="4"   fill="#110608" />
      <Ellipse cx="46" cy="108.5" rx="8" ry="3.5" fill="#0E0406" />
      {/* Kurta / dress */}
      <Path d="M28,107 L26,68 Q26,60 36,58 L48,58 Q58,60 58,68 L56,107 Z" fill="url(#ic_kt)" />
      {/* Dupatta drape */}
      <Path d="M26,68 Q23,76 17,82 Q21,72 28,68 Z" fill="rgba(244,114,182,0.45)" />
      {/* Left arm sad/limp */}
      <Path d="M28,68 Q20,80 22,96" stroke={KURTAD} strokeWidth="13" fill="none" strokeLinecap="round" />
      <Path d="M22,96 Q21,102 24,108" stroke={SKIN_M} strokeWidth="11" fill="none" strokeLinecap="round" />
      {/* Right arm waving */}
      <Path d="M57,68 Q66,56 68,46" stroke={KURTAD} strokeWidth="13" fill="none" strokeLinecap="round" />
      <Path d="M68,46 Q70,36 68,28" stroke={SKIN_M} strokeWidth="11" fill="none" strokeLinecap="round" />
      {/* Waving hand */}
      <Circle cx="67" cy="25" r="6.5" fill={SKIN_M} />
      {/* Neck */}
      <Rect x="36" y="50" width="11" height="12" rx="5" fill={SKIN_D} />
      {/* Long hair with bun */}
      <Path d="M26,36 Q25,18 42,14 Q59,18 58,36 Q56,24 42,22 Q28,24 26,36 Z" fill={HAIR} />
      <Circle cx="42" cy="14" r="8"   fill={HAIR} />
      <Circle cx="42" cy="6"  r="5.5" fill={HAIR} />
      {/* Face */}
      <Circle cx="42" cy="36" r="19" fill="url(#ic_sk)" />
      {/* Ears */}
      <Ellipse cx="23" cy="36" rx="3.5" ry="6.5" fill={SKIN_D} />
      <Ellipse cx="61" cy="36" rx="3.5" ry="6.5" fill={SKIN_D} />
      {/* Earring */}
      <Circle cx="23" cy="40" r="2.8" fill="none" stroke="#FFD700" strokeWidth="1.5" />
      {/* Eyebrows — sad, inner corners raised */}
      <Path d="M31,27 Q37,23 42,27" stroke={HAIR} strokeWidth="2"   fill="none" strokeLinecap="round" />
      <Path d="M42,27 Q47,23 53,27" stroke={HAIR} strokeWidth="2"   fill="none" strokeLinecap="round" />
      {/* Left eye with tear */}
      <Ellipse cx="34.5" cy="33" rx="5.5" ry="5"   fill="white" />
      <Circle  cx="35"   cy="33" r="3.2"            fill="#241008" />
      <Circle  cx="35"   cy="33" r="1.9"            fill="#060204" />
      <Circle  cx="36.2" cy="31.4" r="1"            fill="white" />
      <Path d="M29,34.5 Q34.5,29 40,34.5" stroke={HAIR} strokeWidth="1.4" fill="none" />
      {/* Teardrop */}
      <Path d="M30,36 Q32,42 30,46 Q28,42 30,36 Z" fill="#78C8F8" fillOpacity="0.82" />
      {/* Right eye */}
      <Ellipse cx="49.5" cy="33" rx="5.5" ry="5"   fill="white" />
      <Circle  cx="49"   cy="33" r="3.2"            fill="#241008" />
      <Circle  cx="49"   cy="33" r="1.9"            fill="#060204" />
      <Circle  cx="50.2" cy="31.4" r="1"            fill="white" />
      <Path d="M44,34.5 Q49.5,29 55,34.5" stroke={HAIR} strokeWidth="1.4" fill="none" />
      {/* Bindi */}
      <Circle cx="42" cy="25.5" r="1.8" fill={PINK} />
      {/* Nose */}
      <Path d="M41,40 Q39,43 39,45" stroke={SKIN_D} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <Path d="M41,40 Q44,43 44,45" stroke={SKIN_D} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* Sad mouth */}
      <Path d="M35,47 Q42,43 49,47" stroke="#8B4020" strokeWidth="2.2" fill="none" strokeLinecap="round" />

      {/* ── Broken heart (center) ── */}
      <Path d="M91,37 Q80,25 71,33 Q67,40 91,58 Q115,40 111,33 Q102,25 91,37 Z"
        fill={PINK} fillOpacity="0.88" />
      {/* Crack line */}
      <Path d="M91,37 L88,43 L94,47 L89,54 L91,58" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FeatureIllustrationBanner  — HomeScreen feature section
   Wide hero card + two feature cards below
═══════════════════════════════════════════════════════════════ */
export function FeatureIllustrationBanner() {
  const floatY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -7, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0,  duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={{ gap: 10, marginBottom: 14 }}>

      {/* ── Hero card: "Get a ride in 3 min" ── */}
      <View style={{
        borderRadius: 22,
        backgroundColor: PLUM,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 18,
        paddingRight: 8,
        paddingVertical: 16,
        minHeight: 100,
      }}>
        {/* Left: text */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: GREEN }} />
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
              LIVE DRIVERS NEARBY
            </Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', lineHeight: 26 }}>
            Get a ride{'\n'}in 3 minutes
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 6 }}>
            Auto · Bike · Car · E-Rickshaw
          </Text>
        </View>
        {/* Right: floating mini fleet — scooter tucked in front of the auto */}
        <Animated.View style={{ transform: [{ translateY: floatY }], flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{ marginRight: -20, marginBottom: 2 }}>
            <MiniScooterSvg width={46} height={70} />
          </View>
          <MiniAutoSvg width={104} height={83} />
        </Animated.View>
      </View>

      {/* ── Safety card — full width. The Buddy panel that used to sit next
             to this was dropped: Sppero Buddy already gets its own full
             card lower on the Home screen, so this hero only needed to
             carry the one thing nothing else on the screen says. ── */}
      <View style={{
        borderRadius: 20, padding: 16,
        backgroundColor: GREEN, minHeight: 92, overflow: 'hidden',
        flexDirection: 'row', alignItems: 'center',
      }}>
        <View style={{ position: 'absolute', top: -18, right: -18, width: 70, height: 70,
          borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.10)' }} />
        {/* Family illustration bottom-right */}
        <View style={{ position: 'absolute', bottom: -2, right: -8, opacity: 0.88 }}>
          <IlluFamily3 width={80} height={50} />
        </View>
        <Text style={{ fontSize: 28, marginRight: 12 }}>🛡️</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', lineHeight: 18 }}>
              Safety First
            </Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 20,
              paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)' }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>INSURED</Text>
            </View>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 10.5, marginTop: 3, lineHeight: 14 }}>
            Live tracking & family alerts, every ride
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════
   IlluFamily3  — 88×56  (fits inside home screen cards)
   Mom (bindi, kurta) · Child (center, short) · Dad (shirt)
   Used in Auto card + Safety feature card
═══════════════════════════════════════════════════════════════ */
export function IlluFamily3({ width = 88, height = 56 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 88 56">
      <Defs>
        <RadialGradient id="f3_sk1" cx="40%" cy="30%" r="65%">
          <Stop offset="0%"   stopColor="#DFA070" />
          <Stop offset="100%" stopColor="#9B5530" />
        </RadialGradient>
        <RadialGradient id="f3_sk2" cx="40%" cy="30%" r="65%">
          <Stop offset="0%"   stopColor="#E8B87A" />
          <Stop offset="100%" stopColor="#A06030" />
        </RadialGradient>
        <RadialGradient id="f3_sk3" cx="40%" cy="30%" r="65%">
          <Stop offset="0%"   stopColor="#C88050" />
          <Stop offset="100%" stopColor="#8B4820" />
        </RadialGradient>
      </Defs>

      {/* Shadow */}
      <Ellipse cx="44" cy="54" rx="36" ry="2.5" fill="rgba(0,0,0,0.08)" />

      {/* ── MOM (left, height ~48px) ── */}
      {/* Hair bun */}
      <Circle cx="18" cy="8"  r="5"   fill={HAIR} />
      <Circle cx="18" cy="3.5" r="3.5" fill={HAIR} />
      {/* Face */}
      <Circle cx="18" cy="15" r="6.5" fill="url(#f3_sk1)" />
      {/* Ears */}
      <Ellipse cx="11.5" cy="15" rx="2" ry="3.5" fill="#9B5530" />
      <Ellipse cx="24.5" cy="15" rx="2" ry="3.5" fill="#9B5530" />
      {/* Earring */}
      <Circle cx="11.5" cy="17" r="1.8" fill="none" stroke="#FFD700" strokeWidth="1.2" />
      {/* Bindi */}
      <Circle cx="18" cy="9.5" r="1.2" fill={PINK} />
      {/* Eyes */}
      <Ellipse cx="15.2" cy="14" rx="2.2" ry="2" fill="white" />
      <Circle  cx="15.4" cy="14" r="1.3"          fill="#241008" />
      <Circle  cx="15.9" cy="13.2" r="0.6"         fill="white" />
      <Ellipse cx="20.8" cy="14" rx="2.2" ry="2"  fill="white" />
      <Circle  cx="20.6" cy="14" r="1.3"          fill="#241008" />
      <Circle  cx="21.1" cy="13.2" r="0.6"         fill="white" />
      {/* Nose */}
      <Path d="M17.5,17 Q16.5,19 16.5,20" stroke="#9B5530" strokeWidth="1" fill="none" strokeLinecap="round" />
      <Path d="M17.5,17 Q19,19 19,20" stroke="#9B5530" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* Smile */}
      <Path d="M14.5,22 Q18,25 21.5,22" stroke="#8B4020" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* Kurta (pink) */}
      <Path d="M10,22 Q10,21 18,21 Q26,21 26,22 L28,50 L8,50 Z" fill={KURTA} />
      {/* Dupatta hint */}
      <Path d="M10,22 Q7,26 5,32 Q8,27 10,24 Z" fill="rgba(244,114,182,0.5)" />

      {/* ── CHILD (center, shortest, ~38px) ── */}
      {/* Short hair */}
      <Path d="M37,18 Q37,12 44,11 Q51,12 51,18 Q49,13 44,13 Q39,13 37,18 Z" fill={HAIR} />
      {/* Face */}
      <Circle cx="44" cy="20" r="5.5" fill="url(#f3_sk2)" />
      {/* Eyes */}
      <Ellipse cx="41.8" cy="19.2" rx="1.9" ry="1.7" fill="white" />
      <Circle  cx="42"   cy="19.2" r="1.1"           fill="#241008" />
      <Circle  cx="42.4" cy="18.6" r="0.5"           fill="white" />
      <Ellipse cx="46.2" cy="19.2" rx="1.9" ry="1.7" fill="white" />
      <Circle  cx="46"   cy="19.2" r="1.1"           fill="#241008" />
      <Circle  cx="46.4" cy="18.6" r="0.5"           fill="white" />
      {/* Big happy smile */}
      <Path d="M41,23 Q44,26 47,23" stroke="#8B4020" strokeWidth="1.4" fill="rgba(255,100,80,0.10)" strokeLinecap="round" />
      {/* Colorful top (teal) */}
      <Path d="M37.5,26 Q37.5,24.5 44,24.5 Q50.5,24.5 50.5,26 L52,50 L36,50 Z" fill="#34D399" />

      {/* ── DAD (right, tallest, ~51px) ── */}
      {/* Short hair */}
      <Path d="M62,8 Q62,2 70,1 Q78,2 78,8 Q76,3 70,3 Q64,3 62,8 Z" fill={HAIR} />
      {/* Sideburn */}
      <Line x1="62" y1="8" x2="62" y2="14" stroke={HAIR} strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="78" y1="8" x2="78" y2="14" stroke={HAIR} strokeWidth="2.5" strokeLinecap="round" />
      {/* Face */}
      <Circle cx="70" cy="12" r="6.5" fill="url(#f3_sk3)" />
      {/* Ears */}
      <Ellipse cx="63.5" cy="12" rx="2" ry="3.5" fill="#8B4820" />
      <Ellipse cx="76.5" cy="12" rx="2" ry="3.5" fill="#8B4820" />
      {/* Eyes */}
      <Ellipse cx="67.5" cy="11" rx="2.2" ry="2" fill="white" />
      <Circle  cx="67.7" cy="11" r="1.3"          fill="#241008" />
      <Circle  cx="68.2" cy="10.2" r="0.6"         fill="white" />
      <Ellipse cx="72.5" cy="11" rx="2.2" ry="2"  fill="white" />
      <Circle  cx="72.3" cy="11" r="1.3"          fill="#241008" />
      <Circle  cx="72.8" cy="10.2" r="0.6"         fill="white" />
      {/* Nose */}
      <Path d="M69.5,14 Q68.5,16.5 68.5,17.5" stroke="#8B4820" strokeWidth="1" fill="none" strokeLinecap="round" />
      <Path d="M69.5,14 Q71,16.5 71,17.5" stroke="#8B4820" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* Smile */}
      <Path d="M67,20 Q70,23 73,20" stroke="#8B4020" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* Shirt (blue) */}
      <Path d="M62,20 Q62,18 70,18 Q78,18 78,20 L80,50 L60,50 Z" fill={SHIRT} />
      {/* Collar */}
      <Path d="M68,18 L70,22 L72,18" fill="#7ABEFF" stroke={SHIRTD} strokeWidth="0.5" />
    </Svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BikeScene  — animated SVG motorcycle
   Spinning wheels · body bounce · speed lines · rider
   Used in HomeScreen bike card
═══════════════════════════════════════════════════════════════ */
export function BikeScene({ width = 148, height = 88 }: { width?: number; height?: number }) {
  const wheelRot = useRef(new Animated.Value(0)).current;
  const roadX    = useRef(new Animated.Value(0)).current;   // road dash scroll
  const bodyY    = useRef(new Animated.Value(0)).current;   // micro suspension
  const spdX     = useRef(new Animated.Value(0)).current;
  const spdOp    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;

    // 1. Wheel spin — recursive so value resets cleanly each revolution
    const spinWheel = () => {
      if (!alive) return;
      wheelRot.setValue(0);
      Animated.timing(wheelRot, { toValue: 360, duration: 420, easing: Easing.linear, useNativeDriver: false })
        .start(({ finished }) => { if (finished && alive) spinWheel(); });
    };
    spinWheel();

    // 2. Road dashes scroll left — speed-matched to wheel
    //    Wheel circumference ≈ 75.4px, one rev = 420ms → road speed ≈ 179px/s
    //    Dash cycle = 14+10 = 24px → 24/179 ≈ 134ms per cycle
    const scrollRoad = () => {
      if (!alive) return;
      roadX.setValue(0);
      Animated.timing(roadX, { toValue: -24, duration: 134, easing: Easing.linear, useNativeDriver: false })
        .start(({ finished }) => { if (finished && alive) scrollRoad(); });
    };
    scrollRoad();

    // 3. Micro suspension bounce — very subtle so axle gap stays invisible
    Animated.loop(
      Animated.sequence([
        Animated.timing(bodyY, { toValue: -0.5, duration: 200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(bodyY, { toValue:  0.3, duration: 200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();

    // 4. Speed lines — fade in at start, sweep left, fade out, repeat
    const runSpd = () => {
      if (!alive) return;
      spdX.setValue(0); spdOp.setValue(0.85);
      Animated.parallel([
        Animated.timing(spdX,  { toValue: -52, duration: 420, easing: Easing.linear, useNativeDriver: false }),
        Animated.sequence([
          Animated.delay(90),
          Animated.timing(spdOp, { toValue: 0, duration: 330, useNativeDriver: false }),
        ]),
      ]).start(({ finished }) => { if (finished && alive) runSpd(); });
    };
    runSpd();

    return () => { alive = false; };
  }, []);

  // Geometry: WCY=72, WR=12 → tyre bottom at y=84 sits on road surface (y=76–88)
  const RCX = 30, FCX = 116, WCY = 72, WR = 12, WD = 8.5;

  // Road dash tile x-positions: cover -24 to 192 so scroll loop is seamless
  const DASH_XS = [-24, 0, 24, 48, 72, 96, 120, 144, 168, 192];

  // SpokesAtOrigin draws the wheel internals centered at (0,0).
  // Used inside a G translate so rotation happens around the true wheel centre.
  const SpokesAtOrigin = () => (
    <>
      <Circle cx={0} cy={0} r={WR - 4} fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="1.1" />
      <Circle cx={0} cy={0} r={3.5} fill="rgba(255,255,255,0.88)" />
      <Line x1={0}        y1={-(WR - 2)} x2={0}        y2={-4}     stroke="rgba(255,255,255,0.78)" strokeWidth="1.2" />
      <Line x1={0}        y1={WR - 2}    x2={0}        y2={4}      stroke="rgba(255,255,255,0.78)" strokeWidth="1.2" />
      <Line x1={-(WR-2)}  y1={0}         x2={-4}       y2={0}      stroke="rgba(255,255,255,0.78)" strokeWidth="1.2" />
      <Line x1={WR - 2}   y1={0}         x2={4}        y2={0}      stroke="rgba(255,255,255,0.78)" strokeWidth="1.2" />
      <Line x1={-WD} y1={-WD} x2={-2.8} y2={-2.8} stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
      <Line x1={WD}  y1={WD}  x2={2.8}  y2={2.8}  stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
      <Line x1={WD}  y1={-WD} x2={2.8}  y2={-2.8} stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
      <Line x1={-WD} y1={WD}  x2={-2.8} y2={2.8}  stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
    </>
  );

  return (
    <Svg width={width} height={height} viewBox="0 0 148 88">

      {/* ── ROAD ── */}
      <Rect x="0" y="76" width="148" height="12" fill="#111814" />
      {/* Shoulder line */}
      <Line x1="0" y1="77.5" x2="148" y2="77.5" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
      {/* Animated centre dashes — tile scrolls left, gives road-moving illusion */}
      <AnimatedG translateX={roadX}>
        {DASH_XS.map((x) => (
          <Rect key={x} x={x} y={80} width={14} height={2} rx={1} fill="rgba(255,255,255,0.58)" />
        ))}
      </AnimatedG>

      {/* ── SPEED LINES (behind bike, left zone) ── */}
      <AnimatedG translateX={spdX} opacity={spdOp}>
        <Line x1="8"  y1="44" x2="52" y2="44" stroke="rgba(255,255,255,0.62)" strokeWidth="2.4" strokeLinecap="round" />
        <Line x1="2"  y1="54" x2="38" y2="54" stroke="rgba(255,255,255,0.44)" strokeWidth="1.6" strokeLinecap="round" />
        <Line x1="10" y1="63" x2="42" y2="63" stroke="rgba(255,255,255,0.52)" strokeWidth="1.8" strokeLinecap="round" />
      </AnimatedG>

      {/* ── TYRES — static, always pinned to road ── */}
      {/* G translate shifts origin to wheel centre so AnimatedG rotates around (0,0) = exact axle */}
      <Circle cx={RCX} cy={WCY} r={WR} fill="#0D1117" />
      <Circle cx={RCX} cy={WCY} r={WR} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.2" />
      <G transform={`translate(${RCX} ${WCY})`}>
        <AnimatedG rotation={wheelRot}>
          <SpokesAtOrigin />
        </AnimatedG>
      </G>

      <Circle cx={FCX} cy={WCY} r={WR} fill="#0D1117" />
      <Circle cx={FCX} cy={WCY} r={WR} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.2" />
      <G transform={`translate(${FCX} ${WCY})`}>
        <AnimatedG rotation={wheelRot}>
          <SpokesAtOrigin />
        </AnimatedG>
      </G>

      {/* ── BODY — micro-bounce only ±0.5 px
          Swing arm & fork endpoints at y=74 (2px inside tyre ring) so
          even at max upward bounce the join never creates a visible gap ── */}
      <AnimatedG translateY={bodyY}>

        {/* Exhaust pipe */}
        <Path d="M50,65 L36,69 L24,73" stroke="rgba(255,255,255,0.34)" strokeWidth="2" strokeLinecap="round" />

        {/* Swing arm — origin 2px below axle centre */}
        <Path d="M30,74 L56,60" stroke="rgba(255,255,255,0.92)" strokeWidth="3" strokeLinecap="round" />
        <Path d="M30,74 L52,67" stroke="rgba(255,255,255,0.38)" strokeWidth="1.6" strokeLinecap="round" />

        {/* Main backbone */}
        <Path d="M56,60 L80,44 L106,42" stroke="rgba(255,255,255,0.94)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {/* Down tube */}
        <Path d="M56,60 L76,57 L106,52" stroke="rgba(255,255,255,0.52)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Seat tube */}
        <Path d="M76,44 L70,60" stroke="rgba(255,255,255,0.78)" strokeWidth="2.8" strokeLinecap="round" />

        {/* Front fork — endpoint 2px below axle centre */}
        <Path d="M106,42 L111,58 L116,74" stroke="rgba(255,255,255,0.92)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M106,52 L118,67 L116,74" stroke="rgba(255,255,255,0.52)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Fuel tank */}
        <Path d="M76,41 Q92,36 104,40 Q104,50 90,52 Q76,50 76,41 Z" fill="rgba(255,255,255,0.86)" />
        <Path d="M76,44 Q91,40 104,43" stroke="#FF2D78" strokeWidth="2.2" fill="none" strokeLinecap="round" />

        {/* Seat */}
        <Path d="M62,40 Q72,35 80,39 L80,46 Q72,48 62,44 Z" fill="#0F172A" />

        {/* Headlight */}
        <Ellipse cx="122" cy="50" rx="7" ry="5.5" fill="#FEF9C3" />
        <Ellipse cx="123" cy="50" rx="4" ry="3.2" fill="#FFFBCC" />
        <Ellipse cx="122" cy="50" rx="7" ry="5.5" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />

        {/* Rider legs */}
        <Path d="M72,53 L54,57 L48,63" stroke="#1E293B" strokeWidth="5"   fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M72,53 L66,59 L70,64" stroke="#1E293B" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Rider torso */}
        <Path d="M72,53 L76,38 L88,34" stroke="#0F172A" strokeWidth="6"   fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Arms to handlebars */}
        <Path d="M82,40 L106,42" stroke="#1E293B" strokeWidth="3.8" fill="none" strokeLinecap="round" />
        {/* Neck */}
        <Line x1="76" y1="38" x2="76" y2="31" stroke="#B87840" strokeWidth="3.5" strokeLinecap="round" />
        {/* Helmet */}
        <Ellipse cx="76" cy="25" rx="11" ry="10" fill="#FF2D78" />
        <Ellipse cx="76" cy="25" rx="11" ry="10" fill="none" stroke="#C01060" strokeWidth="1" />
        {/* Visor */}
        <Path d="M66,27 Q76,34 86,27 Q83,21 76,20 Q69,21 66,27 Z" fill="#080E1A" fillOpacity="0.92" />
        <Line x1="68" y1="25" x2="84" y2="25" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
        {/* Helmet gloss */}
        <Path d="M67,19 Q76,15 85,19" stroke="rgba(255,255,255,0.36)" strokeWidth="1.5" fill="none" />
        {/* Handlebar */}
        <Circle cx="106" cy="42" r="4" fill="#1E293B" />

      </AnimatedG>
    </Svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   IlluRideComplete  — 220×150
   Happy person arms raised, green checkmark, confetti stars
   Used in PostRideScreen between TripSteps and stats
═══════════════════════════════════════════════════════════════ */
export function IlluRideComplete({ width = 220, height = 150 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 220 150">
      <Defs>
        <RadialGradient id="rc_sk" cx="38%" cy="30%" r="65%">
          <Stop offset="0%"   stopColor={SKIN_L} />
          <Stop offset="100%" stopColor={SKIN_D} />
        </RadialGradient>
        <LinearGradient id="rc_kt" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor="#F472B6" />
          <Stop offset="100%" stopColor="#9D1755" />
        </LinearGradient>
        <RadialGradient id="rc_ck" cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor="rgba(5,150,105,0.18)" />
          <Stop offset="100%" stopColor="rgba(5,150,105,0)" />
        </RadialGradient>
        <LinearGradient id="rc_ck2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor="#34D399" />
          <Stop offset="100%" stopColor="#059669" />
        </LinearGradient>
      </Defs>

      {/* Green glow behind checkmark */}
      <Circle cx="160" cy="72" r="52" fill="url(#rc_ck)" />

      {/* ── Big checkmark circle (right side) ── */}
      <Circle cx="160" cy="72" r="38" fill="none" stroke="rgba(5,150,105,0.18)" strokeWidth="8" />
      <Circle cx="160" cy="72" r="30" fill="url(#rc_ck2)" />
      {/* Check tick */}
      <Path d="M146,72 L156,82 L176,60" stroke="white" strokeWidth="5.5"
        fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* ── Stars / sparkles ── */}
      <SvgText x="188" y="36" fontSize="14" fill="#FFD700" fillOpacity="0.88">★</SvgText>
      <SvgText x="196" y="60" fontSize="9"  fill="#FFD700" fillOpacity="0.6">★</SvgText>
      <SvgText x="125" y="28" fontSize="11" fill="#FFD700" fillOpacity="0.7">★</SvgText>
      <SvgText x="18"  y="38" fontSize="13" fill={PINK}   fillOpacity="0.55">✦</SvgText>
      <SvgText x="8"   y="70" fontSize="9"  fill="#FFD700" fillOpacity="0.5">✦</SvgText>
      <SvgText x="186" y="108" fontSize="10" fill={PINK}  fillOpacity="0.45">✦</SvgText>

      {/* Confetti dots */}
      <Circle cx="30"  cy="24" r="3.5" fill={PINK}  fillOpacity="0.7" />
      <Circle cx="46"  cy="16" r="2.5" fill="#FFD700" fillOpacity="0.8" />
      <Circle cx="62"  cy="22" r="2"   fill={GREEN} fillOpacity="0.7" />
      <Circle cx="185" cy="44" r="3"   fill={PINK}  fillOpacity="0.55" />
      <Circle cx="200" cy="80" r="2"   fill="#FFD700" fillOpacity="0.65" />
      {/* Confetti rectangles */}
      <Rect x="22" y="50" width="6" height="3" rx="1" fill={GREEN}  fillOpacity="0.6" transform="rotate(-25 22 50)" />
      <Rect x="54" y="14" width="5" height="2.5" rx="1" fill={PINK} fillOpacity="0.6" transform="rotate(15 54 14)" />
      <Rect x="192" y="92" width="6" height="3" rx="1" fill="#FFD700" fillOpacity="0.7" transform="rotate(-40 192 92)" />

      {/* ── Happy woman arms raised (left side) ── */}
      {/* Person at x=76, feet at y=148 */}
      {/* Shadow */}
      <Ellipse cx="76" cy="148" rx="18" ry="4" fill="rgba(46,20,97,0.10)" />
      {/* Feet / shoes */}
      <Ellipse cx="67" cy="146" rx="10" ry="4.5" fill="#110608" />
      <Ellipse cx="80" cy="146.5" rx="9" ry="4"  fill="#0E0406" />
      {/* Kurta */}
      <Path d="M60,145 L59,100 Q59,92 68,90 L84,90 Q93,92 93,100 L91,145 Z" fill="url(#rc_kt)" />
      {/* Left arm raised and bent (celebration) */}
      <Path d="M60,102 Q48,88 40,72" stroke={KURTAD} strokeWidth="13" fill="none" strokeLinecap="round" />
      <Path d="M40,72 Q32,56 36,44" stroke={SKIN_M} strokeWidth="11" fill="none" strokeLinecap="round" />
      <Circle cx="38" cy="40" r="7" fill={SKIN_M} />
      {/* Right arm raised (other side) */}
      <Path d="M92,102 Q105,88 113,72" stroke={KURTAD} strokeWidth="13" fill="none" strokeLinecap="round" />
      <Path d="M113,72 Q120,56 116,44" stroke={SKIN_M} strokeWidth="11" fill="none" strokeLinecap="round" />
      <Circle cx="114" cy="40" r="7" fill={SKIN_M} />
      {/* Neck */}
      <Rect x="70" y="82" width="11" height="12" rx="5" fill={SKIN_D} />
      {/* Long hair with bun */}
      <Path d="M58,68 Q57,50 76,46 Q95,50 94,68 Q92,56 76,54 Q60,56 58,68 Z" fill={HAIR} />
      <Circle cx="76" cy="46" r="8.5" fill={HAIR} />
      <Circle cx="76" cy="37"  r="6"   fill={HAIR} />
      {/* Face */}
      <Circle cx="76" cy="66" r="20" fill="url(#rc_sk)" />
      {/* Ears */}
      <Ellipse cx="56" cy="66" rx="4"  ry="7.5" fill={SKIN_D} />
      <Ellipse cx="96" cy="66" rx="4"  ry="7.5" fill={SKIN_D} />
      {/* Earring */}
      <Circle cx="56" cy="70" r="3"   fill="none" stroke="#FFD700" strokeWidth="1.5" />
      {/* Eyebrows happy (relaxed arcs) */}
      <Path d="M64,57 Q71,53 76,57" stroke={HAIR} strokeWidth="2"   fill="none" strokeLinecap="round" />
      <Path d="M76,57 Q81,53 88,57" stroke={HAIR} strokeWidth="2"   fill="none" strokeLinecap="round" />
      {/* Left eye (happy crescent) */}
      <Ellipse cx="68.5" cy="63" rx="6"  ry="5.5" fill="white" />
      <Circle  cx="69"   cy="63" r="3.5"           fill="#241008" />
      <Circle  cx="69"   cy="63" r="2"              fill="#060204" />
      <Circle  cx="70.3" cy="61.4" r="1.1"          fill="white" />
      <Path d="M62.5,64.5 Q68.5,59 74.5,64.5" stroke={HAIR} strokeWidth="1.5" fill="none" />
      {/* Right eye */}
      <Ellipse cx="83.5" cy="63" rx="6"  ry="5.5" fill="white" />
      <Circle  cx="83"   cy="63" r="3.5"           fill="#241008" />
      <Circle  cx="83"   cy="63" r="2"              fill="#060204" />
      <Circle  cx="84.3" cy="61.4" r="1.1"          fill="white" />
      <Path d="M77.5,64.5 Q83.5,59 89.5,64.5" stroke={HAIR} strokeWidth="1.5" fill="none" />
      {/* Bindi */}
      <Circle cx="76" cy="55.5" r="1.9" fill={PINK} />
      {/* Nose */}
      <Path d="M75,70 Q73,73 73,75" stroke={SKIN_D} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <Path d="M75,70 Q78,73 78,75" stroke={SKIN_D} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* Big happy smile */}
      <Path d="M67,79 Q76,87 85,79" stroke="#8B4020" strokeWidth="2.5"
        fill="rgba(255,100,80,0.12)" strokeLinecap="round" />
    </Svg>
  );
}

function MiniAutoSvg({ width = 120, height = 96 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 120 96">
      <Defs>
        <LinearGradient id="ma_bd" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor="#FFAB36" />
          <Stop offset="100%" stopColor="#D85A00" />
        </LinearGradient>
        <LinearGradient id="ma_rf" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor="#FF7A00" />
          <Stop offset="100%" stopColor="#B34500" />
        </LinearGradient>
        <LinearGradient id="ma_gl" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%"   stopColor="#C6E8FF" stopOpacity="0.95" />
          <Stop offset="100%" stopColor="#A8D8F8" stopOpacity="0.75" />
        </LinearGradient>
      </Defs>

      {/* Shadow */}
      <Ellipse cx="60" cy="88" rx="50" ry="7" fill="rgba(0,0,0,0.20)" />

      {/* ── Rear chassis / lower body ── */}
      <Path d="M8,80 L8,50 Q8,42 16,42 L38,42 L38,80 Z" fill="url(#ma_bd)" />
      {/* Main passenger cabin body */}
      <Path d="M38,42 L38,80 L94,80 L94,56 Q94,48 86,48 L38,48 Z" fill="url(#ma_bd)" />
      {/* Front nose/fairing */}
      <Path d="M94,48 Q108,44 112,54 L112,72 Q112,80 104,80 L94,80 L94,48 Z" fill="url(#ma_bd)" />

      {/* ── Roof canopy — the signature auto-rickshaw rounded top ── */}
      <Path d="M8,24 Q10,14 38,12 Q68,10 94,12 Q110,14 112,24 L108,28 Q92,22 38,22 Q16,24 10,28 Z" fill="url(#ma_rf)" />
      {/* Roof ridge highlight */}
      <Path d="M14,22 Q54,16 94,18 Q104,19 108,22" stroke="rgba(255,200,100,0.45)" strokeWidth="2" fill="none" />
      {/* Roof front overhang curve */}
      <Path d="M108,24 Q114,28 114,38" stroke="url(#ma_rf)" strokeWidth="6" fill="none" strokeLinecap="round" />

      {/* ── Rear upright post ── */}
      <Rect x="10" y="22" width="5" height="22" rx="2.5" fill="rgba(0,0,0,0.28)" />

      {/* ── A-pillar (driver/front divider) ── */}
      <Rect x="90" y="22" width="5" height="26" rx="2.5" fill="rgba(0,0,0,0.32)" />

      {/* ── Windshield glass (entire cabin face) ── */}
      <Path d="M15,22 L15,42 L90,42 L90,22 Z" fill="url(#ma_gl)" />
      {/* Windshield top glare */}
      <Rect x="17" y="23" width="22" height="3" rx="1.5" fill="rgba(255,255,255,0.55)" />
      {/* Windshield frame */}
      <Path d="M15,22 L15,42 L90,42 L90,22 Z" fill="none" stroke="rgba(255,140,0,0.4)" strokeWidth="1.2" />

      {/* Driver-side rear-view mirror — single mirror, matches real Indian autos */}
      <Path d="M90,21 L94,18" stroke="#1F2937" strokeWidth="1.3" strokeLinecap="round" />
      <Ellipse cx="95.5" cy="17" rx="2.3" ry="1.7" fill="#1F2937" />
      <Ellipse cx="95.5" cy="17" rx="1.2" ry="0.8" fill="#BFE3FF" opacity={0.8} />

      {/* ── Driver ── */}
      <Circle cx="24" cy="34" r="6" fill={SKIN_M} />
      {/* Driver hair */}
      <Path d="M18,30 Q18,24 24,24 Q30,24 30,30 Q28,26 24,26 Q20,26 18,30 Z" fill={HAIR} />
      {/* Driver shirt */}
      <Path d="M16,40 Q16,36 24,34 Q32,36 32,40 Z" fill="#2563EB" />

      {/* ── Passenger ── */}
      <Circle cx="60" cy="34" r="5.5" fill={SKIN_L} />
      <Path d="M54.5,30 Q54.5,25 60,25 Q65.5,25 65.5,30 Q63,27 60,27 Q57,27 54.5,30 Z" fill={HAIR} />
      {/* Saree/kurta hint */}
      <Path d="M53,40 Q53,37 60,35 Q67,37 67,40 Z" fill={KURTA} />

      {/* ── Sppero brand strip ── */}
      <Rect x="8" y="74" width="86" height="5" rx="2.5" fill="#FF2D78" fillOpacity="0.90" />

      {/* ── Front headlight ── */}
      <Ellipse cx="114" cy="58" rx="5.5" ry="7.5" fill="#FFE87A" />
      <Ellipse cx="114" cy="58" rx="3.5" ry="5"   fill="#FFFBB0" />
      <Ellipse cx="114" cy="58" rx="5.5" ry="7.5" fill="none" stroke="rgba(255,220,50,0.6)" strokeWidth="1" />

      {/* ── Front grille/bumper ── */}
      <Path d="M110,72 L114,72 L114,78 Q112,80 108,80 Z" fill="rgba(0,0,0,0.55)" />

      {/* ── Rear wheel (left) ── */}
      <Circle cx="26" cy="82" r="13"  fill="#1A1A30" />
      <Circle cx="26" cy="82" r="9"   fill="#26264A" />
      <Circle cx="26" cy="82" r="3.5" fill="#7080A8" />
      <Line x1="26" y1="69" x2="26" y2="75" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" />
      <Line x1="26" y1="89" x2="26" y2="95" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" />
      <Line x1="13" y1="82" x2="19" y2="82" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" />
      <Line x1="33" y1="82" x2="39" y2="82" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" />

      {/* ── Front wheel (right) ── */}
      <Circle cx="92" cy="82" r="12"  fill="#1A1A30" />
      <Circle cx="92" cy="82" r="8"   fill="#26264A" />
      <Circle cx="92" cy="82" r="3"   fill="#7080A8" />
      <Line x1="92" y1="70" x2="92" y2="76" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" />
      <Line x1="92" y1="88" x2="92" y2="94" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" />
      <Line x1="80" y1="82" x2="86" y2="82" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" />
      <Line x1="98" y1="82" x2="104" y2="82" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" />

      {/* Front mudguard lip over the nose wheel — real autos have this */}
      <Path d="M82,74 Q92,66 102,74" stroke="#1F2937" strokeWidth="2" fill="none" strokeLinecap="round" opacity={0.6} />

      {/* Speed lines (trailing from rear) */}
      <Line x1="0" y1="46" x2="7"  y2="46" stroke="#FFAB36" strokeWidth="2.5" strokeOpacity="0.70" strokeLinecap="round" />
      <Line x1="0" y1="55" x2="7"  y2="55" stroke="#FFAB36" strokeWidth="2"   strokeOpacity="0.48" strokeLinecap="round" />
      <Line x1="0" y1="63" x2="7"  y2="63" stroke="#FFAB36" strokeWidth="1.5" strokeOpacity="0.32" strokeLinecap="round" />
    </Svg>
  );
}

/* Side-view scooter + helmeted rider — companion to MiniAutoSvg in the Home
   hero card, so "Auto · Bike · Car · E-Rickshaw" actually shows more than
   one vehicle. Flat step-through floor + rounded cowl (Activa/Jupiter
   style), matching the real top-down ScooterShape used on the live map. */
function MiniScooterSvg({ width = 60, height = 92 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 60 92">
      <Defs>
        <LinearGradient id="ms_bd" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor="#FB8DA6" />
          <Stop offset="100%" stopColor="#DB1B5C" />
        </LinearGradient>
      </Defs>

      {/* Shadow */}
      <Ellipse cx="30" cy="88" rx="25" ry="4" fill="rgba(0,0,0,0.20)" />

      {/* Speed lines (trailing from rear-left, same direction of travel as the auto) */}
      <Line x1="0" y1="54" x2="6" y2="54" stroke="#FB8DA6" strokeWidth="2.2" strokeOpacity="0.65" strokeLinecap="round" />
      <Line x1="0" y1="62" x2="6" y2="62" stroke="#FB8DA6" strokeWidth="1.8" strokeOpacity="0.45" strokeLinecap="round" />
      <Line x1="0" y1="70" x2="6" y2="70" stroke="#FB8DA6" strokeWidth="1.4" strokeOpacity="0.30" strokeLinecap="round" />

      {/* Rear mudguard */}
      <Path d="M4,72 Q13,65 22,72" stroke="#1F2937" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity={0.65} />

      {/* Rear wheel */}
      <Circle cx="13" cy="78" r="11"  fill="#1A1A30" />
      <Circle cx="13" cy="78" r="7"   fill="#26264A" />
      <Circle cx="13" cy="78" r="2.6" fill="#7080A8" />
      <Line x1="13" y1="67" x2="13" y2="72" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
      <Line x1="13" y1="84" x2="13" y2="89" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
      <Line x1="2"  y1="78" x2="7"  y2="78" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
      <Line x1="19" y1="78" x2="24" y2="78" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />

      {/* Front wheel */}
      <Circle cx="46" cy="78" r="10"  fill="#1A1A30" />
      <Circle cx="46" cy="78" r="6.4" fill="#26264A" />
      <Circle cx="46" cy="78" r="2.3" fill="#7080A8" />
      <Line x1="46" y1="68"   x2="46" y2="72.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.1" />
      <Line x1="46" y1="83.5" x2="46" y2="88"   stroke="rgba(255,255,255,0.4)" strokeWidth="1.1" />
      <Line x1="36" y1="78" x2="40.5" y2="78" stroke="rgba(255,255,255,0.4)" strokeWidth="1.1" />
      <Line x1="51.5" y1="78" x2="56" y2="78" stroke="rgba(255,255,255,0.4)" strokeWidth="1.1" />

      {/* Step-through floor — flat panel between the wheels, the scooter's
          signature "no engine bulge" cue */}
      <Path d="M15,68 L44,68 L44,74 Q44,77 41,77 L18,77 Q15,77 15,74 Z" fill="url(#ms_bd)" opacity={0.94} />

      {/* Rear body hump under the seat */}
      <Path d="M8,68 Q8,56 20,54 L30,54 L30,68 Z" fill="url(#ms_bd)" />

      {/* Seat */}
      <Path d="M9,54 Q9,49 16,48 L29,48 Q33,48 33,52 L33,56 L9,56 Z" fill="#1F2937" />

      {/* Front leg-shield rising to the headlamp cowl */}
      <Path d="M30,68 L30,50 Q30,40 40,38 Q49,37 50,46 L50,68 Z" fill="url(#ms_bd)" />
      <Path d="M32,64 L32,52 Q32,44 39,41" stroke="rgba(255,255,255,0.30)" strokeWidth="1.6" fill="none" strokeLinecap="round" />

      {/* Rounded LED headlamp cowl */}
      <Ellipse cx="44" cy="36" rx="8.5" ry="8" fill="url(#ms_bd)" stroke="#fff" strokeWidth="1" />
      <Ellipse cx="44" cy="36" rx="4"   ry="3.6" fill="#FFE87A" />
      <Ellipse cx="44" cy="36" rx="2"   ry="1.8" fill="#FFFBB0" />

      {/* Handlebar + mirror */}
      <Rect x="34" y="26.5" width="18" height="2.6" rx="1.3" fill="#1F2937" transform="rotate(-8 43 28)" />
      <Circle cx="35" cy="23.5" r="2.1" fill="#1F2937" />

      {/* ── Rider ── */}
      {/* Torso, leaning slightly forward toward the handlebar */}
      <Path d="M22,52 Q22,40 33,36 L38,42 Q30,45 29,54 Z" fill={SHIRT} />
      {/* Arm reaching to the handlebar */}
      <Path d="M33,38 Q38,33 37,27" stroke={SHIRTD} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      {/* Head */}
      <Circle cx="30" cy="30" r="6" fill={SKIN_M} />
      {/* Half-face helmet — a quiet nod to the "Safety First" card below */}
      <Path d="M23.5,29.5 Q23.2,20 30,20 Q36.8,20 36.5,29.5 Q35.5,25 30,25 Q24.5,25 23.5,29.5 Z" fill="#1F2937" />
      <Path d="M23.8,28 Q30,23.6 36.2,28" stroke={PINK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <Path d="M25,32 Q30,35.5 35,32" stroke="#1F2937" strokeWidth="1.3" fill="none" strokeLinecap="round" />

      {/* Sppero brand strip on the floor panel */}
      <Rect x="17" y="70.5" width="25" height="3.4" rx="1.7" fill="#FF2D78" fillOpacity="0.9" />
    </Svg>
  );
}
