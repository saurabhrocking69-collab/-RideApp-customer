import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { useApp } from '../context/AppContext';
import { C } from '../styles';
// MMKV-backed wrapper — NOT @react-native-async-storage/async-storage. Separate
// stores; mixing them makes a "seen once" flag never read back.
import { Storage } from '../storage';
import { WELCOME_SEEN_KEY } from '../constants';

const { width: W } = Dimensions.get('window');
const ART = Math.min(300, W * 0.78);

// ── One master loop for the whole screen ───────────────────────────────────
// Read several times via interpolation instead of starting a loop per element.
// The parcel guide shipped with five concurrent native loops and became
// unscrollable on mid-range Android; a horizontal pager is even more sensitive
// to loops competing with the gesture on the UI thread.
function useLoop(durationMs: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: durationMs, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: durationMs, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, durationMs]);
  return v;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Flat, geometric illustration. Everything is built from rounded rectangles
//  and circles on a fixed grid — shapes whose proportions are exact rather
//  than freehand curves, which is what makes it read as clean instead of
//  lumpy. Two tones per surface, one soft shadow, nothing else.
// ═══════════════════════════════════════════════════════════════════════════

function CarArt({ size }: { size: number }) {
  // viewBox 240×150. Body sits on y=70..118, wheels centred on the body floor.
  return (
    <Svg width={size} height={size * 0.625} viewBox="0 0 240 150">
      <Defs>
        <LinearGradient id="wBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF5B92" />
          <Stop offset="1" stopColor="#FF2D78" />
        </LinearGradient>
        <LinearGradient id="wCabin" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF7FA8" />
          <Stop offset="1" stopColor="#FF5B92" />
        </LinearGradient>
      </Defs>

      {/* cabin — sits behind the body so the join is a clean silhouette */}
      <Rect x="70" y="34" width="100" height="46" rx="15" fill="url(#wCabin)" />
      {/* windows */}
      <Rect x="82" y="44" width="34" height="24" rx="7" fill="#EAF2FF" />
      <Rect x="124" y="44" width="34" height="24" rx="7" fill="#EAF2FF" />

      {/* body */}
      <Rect x="26" y="68" width="188" height="50" rx="18" fill="url(#wBody)" />
      {/* lower tone band for depth */}
      <Rect x="26" y="100" width="188" height="18" rx="9" fill="#D91A60" opacity="0.35" />

      {/* headlight / tail light */}
      <Rect x="198" y="80" width="14" height="9" rx="4.5" fill="#FFE9A8" />
      <Rect x="28" y="80" width="12" height="9" rx="4.5" fill="#FFB3C8" />

      {/* wheels */}
      {[74, 166].map((cx, i) => (
        <G key={i}>
          <Circle cx={cx} cy="118" r="23" fill="#2E1461" />
          <Circle cx={cx} cy="118" r="10" fill="#F4F1FB" />
        </G>
      ))}
    </Svg>
  );
}

function ShieldArt({ size }: { size: number }) {
  return (
    <Svg width={size * 0.62} height={size * 0.72} viewBox="0 0 130 150">
      <Defs>
        <LinearGradient id="wShield" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#34D399" />
          <Stop offset="1" stopColor="#059669" />
        </LinearGradient>
      </Defs>
      <Path d="M65 6 L122 30 V72 C122 110 94 130 65 142 C36 130 8 110 8 72 V30 Z" fill="url(#wShield)" />
      <Path d="M42 72 L58 89 L90 54" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

type SlideDef = {
  key: string;
  tint: string;
  ring: string;
  title: string;
  body: string;
  chips: [string, string][];
  art: (bob: any, shadow: any) => React.ReactNode;
};

export function WelcomeScreen() {
  const { setScreen } = useApp();
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const t = useLoop(2000);

  // Float, plus a shadow that shrinks as the art lifts — that inverse pairing
  // is what makes a bob read as "floating" rather than "sliding".
  const bob    = t.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const shadow = t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });
  const shadowO = t.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.08] });
  const breathe = t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  const finish = () => {
    Storage.setItem(WELCOME_SEEN_KEY, '1').catch(() => {});
    setScreen('login');
  };

  const SLIDES: SlideDef[] = [
    {
      key: 'ride',
      tint: C.pink,
      ring: 'rgba(255,45,120,0.10)',
      title: 'Your ride,\nin minutes',
      body: 'Bikes, autos and cars with verified Buddies. See the fare before you book — never a surprise at the end.',
      chips: [['bicycle', 'Bike'], ['car', 'Auto & Car'], ['flash', 'Quick']],
      art: (b, _s) => (
        <Animated.View style={{ transform: [{ translateY: b }] }}>
          <CarArt size={ART * 0.92} />
        </Animated.View>
      ),
    },
    {
      key: 'safe',
      tint: C.green,
      ring: 'rgba(5,150,105,0.10)',
      title: 'Safe, from\nstart to finish',
      body: 'An OTP to begin, live tracking you can share with anyone, and an SOS that actually reaches someone.',
      chips: [['key', 'OTP start'], ['navigate', 'Live track'], ['shield-checkmark', 'SOS']],
      art: (b, _s) => (
        <Animated.View style={{ transform: [{ translateY: b }] }}>
          <ShieldArt size={ART} />
        </Animated.View>
      ),
    },
  ];

  const last = idx === SLIDES.length - 1;
  const next = () => {
    if (last) return finish();
    scrollRef.current?.scrollTo({ x: W, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Skip */}
      <View style={{ position: 'absolute', top: 54, right: 20, zIndex: 5 }}>
        {!last && (
          <TouchableOpacity onPress={finish} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
            <Text style={{ color: C.textDim, fontSize: 14, fontWeight: '800' }}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setIdx(Math.round(e.nativeEvent.contentOffset.x / W))}
        style={{ flex: 1 }}
      >
        {SLIDES.map(sl => (
          <View key={sl.key} style={{ width: W, flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 30 }}>

            {/* ── Stage ──────────────────────────────────────────────── */}
            <View style={{ height: ART + 70, alignItems: 'center', justifyContent: 'center' }}>
              {/* soft tinted disc, slowly breathing */}
              <Animated.View pointerEvents="none" style={{
                position: 'absolute', width: ART, height: ART, borderRadius: ART / 2,
                backgroundColor: sl.ring, transform: [{ scale: breathe }],
              }} />
              {/* inner ring for a bit of depth */}
              <View pointerEvents="none" style={{
                position: 'absolute', width: ART * 0.74, height: ART * 0.74, borderRadius: ART,
                borderWidth: 1.5, borderColor: sl.tint, opacity: 0.13,
              }} />

              {sl.art(bob, shadow)}

              {/* ground shadow — shrinks as the art lifts */}
              <Animated.View pointerEvents="none" style={{
                position: 'absolute', bottom: 34,
                width: ART * 0.5, height: 14, borderRadius: 7,
                backgroundColor: '#2E1461',
                opacity: shadowO, transform: [{ scaleX: shadow }],
              }} />
            </View>

            {/* ── Copy ───────────────────────────────────────────────── */}
            <View style={{ paddingHorizontal: 34, alignItems: 'center', marginTop: 6 }}>
              <Text style={{
                color: C.text, fontSize: 30, fontWeight: '900',
                textAlign: 'center', lineHeight: 37, letterSpacing: -0.4,
              }}>
                {sl.title}
              </Text>
              <Text style={{
                color: C.textMuted, fontSize: 14.5, textAlign: 'center',
                marginTop: 13, lineHeight: 22,
              }}>
                {sl.body}
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
                {sl.chips.map(([ic, lb], i) => (
                  <View key={i} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: '#F6F5FA', borderWidth: 1, borderColor: '#ECEAF3',
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 22,
                  }}>
                    <Ionicons name={ic as any} size={13} color={sl.tint} />
                    <Text style={{ color: C.textMuted, fontSize: 11.5, fontWeight: '800' }}>{lb}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ── Dots + CTA ──────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 26, paddingBottom: 38 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: 22 }}>
          {SLIDES.map((_, i) => (
            <View key={i} style={{
              width: i === idx ? 24 : 8, height: 8, borderRadius: 4,
              backgroundColor: i === idx ? SLIDES[idx].tint : '#E2DFEC',
            }} />
          ))}
        </View>

        <TouchableOpacity activeOpacity={0.9} onPress={next} style={{
          backgroundColor: SLIDES[idx].tint, borderRadius: 18, paddingVertical: 17,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
          shadowColor: SLIDES[idx].tint, shadowOpacity: 0.34, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 7,
        }}>
          <Text style={{ color: '#fff', fontSize: 16.5, fontWeight: '900' }}>
            {last ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons name="arrow-forward" size={19} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
