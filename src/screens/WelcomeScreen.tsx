import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, RadialGradient, Stop, G, Ellipse } from 'react-native-svg';
import { useApp } from '../context/AppContext';
import { C } from '../styles';
// MMKV-backed wrapper — NOT @react-native-async-storage/async-storage. Separate
// stores; mixing them makes a "seen once" flag never read back.
import { Storage } from '../storage';
import { WELCOME_SEEN_KEY } from '../constants';

const { width: W } = Dimensions.get('window');

// ── One master loop drives every ambient motion on this screen ──────────────
// Deliberate: the parcel guide shipped with five concurrent native loops and
// became unscrollable on mid-range Android, because native-driven loops
// compete with gestures on the UI thread. Here the gesture is a horizontal
// pager, which is even more sensitive to that.
function useLoop(durationMs: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: durationMs, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [v, durationMs]);
  return v;
}

// ═══════════════════════════════════════════════════════════════════════════
//  VEHICLE ART — vector, but shaded: body gradients, glass with a highlight
//  sweep, rims with hubs, headlight bloom and a soft ground shadow. Raster
//  art would be heavier, blurry on some densities, and can't be recoloured.
// ═══════════════════════════════════════════════════════════════════════════

function CarArt({ w = 250 }: { w?: number }) {
  return (
    <Svg width={w} height={w * 0.46} viewBox="0 0 260 120">
      <Defs>
        <LinearGradient id="carBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF6FA0" />
          <Stop offset="0.45" stopColor="#FF2D78" />
          <Stop offset="1" stopColor="#B21050" />
        </LinearGradient>
        <LinearGradient id="carGlass" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#DDEBFF" />
          <Stop offset="0.55" stopColor="#9FC2E8" />
          <Stop offset="1" stopColor="#6E93BF" />
        </LinearGradient>
        <RadialGradient id="lamp" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FFF3C4" stopOpacity="0.95" />
          <Stop offset="1" stopColor="#FFF3C4" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F2F2F7" /><Stop offset="1" stopColor="#9A9AA8" />
        </LinearGradient>
      </Defs>

      <Ellipse cx="130" cy="106" rx="98" ry="9" fill="#1A0D2E" opacity="0.20" />

      {/* greenhouse */}
      <Path d="M78 46 q10 -25 30 -27 h44 q22 2 34 27 Z" fill="url(#carBody)" />
      {/* body */}
      <Path d="M22 92 q-4 -22 14 -28 l30 -8 q14 -16 34 -18 h48 q24 2 38 20 l32 8 q18 5 18 26 q0 8 -10 8 h-16 a20 20 0 0 0 -40 0 h-64 a20 20 0 0 0 -40 0 h-16 q-10 0 -12 -8 Z" fill="url(#carBody)" />
      {/* glass */}
      <Path d="M86 44 q9 -20 24 -21 h16 v21 Z" fill="url(#carGlass)" />
      <Path d="M134 23 h20 q17 1 26 21 h-46 Z" fill="url(#carGlass)" />
      {/* highlight sweep along the flank */}
      <Path d="M30 70 q60 -14 200 -2" stroke="#fff" strokeWidth="2.6" opacity="0.34" fill="none" strokeLinecap="round" />
      {/* headlight + bloom */}
      <Circle cx="238" cy="74" r="16" fill="url(#lamp)" />
      <Path d="M228 70 q10 -3 14 2 q-6 5 -14 3 Z" fill="#FFE9A8" />
      {/* tail light */}
      <Path d="M24 70 q-8 -2 -8 4 q0 5 8 4 Z" fill="#FF4D4D" opacity="0.9" />
      {/* door seam + handle */}
      <Path d="M112 52 v30" stroke="#8E0E3E" strokeWidth="1.6" opacity="0.55" />
      <Rect x="118" y="62" width="12" height="3.4" rx="1.7" fill="#8E0E3E" opacity="0.7" />

      {/* wheels */}
      {[86, 190].map((cx, i) => (
        <G key={i}>
          <Circle cx={cx} cy="92" r="21" fill="#221430" />
          <Circle cx={cx} cy="92" r="12.5" fill="url(#rim)" />
          <Circle cx={cx} cy="92" r="4.4" fill="#6B6B8D" />
        </G>
      ))}
    </Svg>
  );
}

function AutoArt({ w = 210 }: { w?: number }) {
  return (
    <Svg width={w} height={w * 0.62} viewBox="0 0 210 130">
      <Defs>
        <LinearGradient id="autoBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFD65C" /><Stop offset="1" stopColor="#E8A600" />
        </LinearGradient>
        <LinearGradient id="autoTop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1F7A4D" /><Stop offset="1" stopColor="#0E4F30" />
        </LinearGradient>
        <LinearGradient id="autoGlass" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E6F2FF" /><Stop offset="1" stopColor="#8FB4D8" />
        </LinearGradient>
      </Defs>

      <Ellipse cx="105" cy="118" rx="76" ry="8" fill="#1A0D2E" opacity="0.20" />

      {/* canopy */}
      <Path d="M46 60 q4 -40 44 -42 h30 q34 3 40 42 Z" fill="url(#autoTop)" />
      {/* cabin body */}
      <Path d="M34 104 q-6 -34 14 -44 h116 q18 10 14 44 Z" fill="url(#autoBody)" />
      {/* windscreen */}
      <Path d="M60 58 q6 -30 34 -32 h22 q26 4 30 32 Z" fill="url(#autoGlass)" opacity="0.92" />
      {/* side bar */}
      <Rect x="46" y="66" width="118" height="5" rx="2.5" fill="#0E4F30" opacity="0.35" />
      {/* front grille + lamp */}
      <Circle cx="105" cy="86" r="9" fill="#FFF3C4" />
      <Circle cx="105" cy="86" r="4" fill="#FFE07A" />
      {/* wheels — one front, two rear */}
      <Circle cx="105" cy="112" r="15" fill="#221430" /><Circle cx="105" cy="112" r="7" fill="#B9B9C6" />
      <Circle cx="44" cy="110" r="13" fill="#221430" /><Circle cx="44" cy="110" r="6" fill="#B9B9C6" />
      <Circle cx="166" cy="110" r="13" fill="#221430" /><Circle cx="166" cy="110" r="6" fill="#B9B9C6" />
    </Svg>
  );
}

function BikeArt({ w = 210 }: { w?: number }) {
  return (
    <Svg width={w} height={w * 0.56} viewBox="0 0 210 118">
      <Defs>
        <LinearGradient id="bikeBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#7C3AED" /><Stop offset="1" stopColor="#4C1D95" />
        </LinearGradient>
        <LinearGradient id="tyre" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#3A2A4D" /><Stop offset="1" stopColor="#1A0D2E" />
        </LinearGradient>
      </Defs>

      <Ellipse cx="105" cy="106" rx="74" ry="7" fill="#1A0D2E" opacity="0.20" />

      {/* wheels */}
      {[46, 164].map((cx, i) => (
        <G key={i}>
          <Circle cx={cx} cy="86" r="23" fill="url(#tyre)" />
          <Circle cx={cx} cy="86" r="13" fill="none" stroke="#B9B9C6" strokeWidth="2.4" />
          <Circle cx={cx} cy="86" r="3.6" fill="#B9B9C6" />
        </G>
      ))}
      {/* frame */}
      <Path d="M46 86 L86 56 L128 56 L164 86" stroke="url(#bikeBody)" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M86 56 L104 86" stroke="url(#bikeBody)" strokeWidth="6" strokeLinecap="round" />
      {/* seat + tank */}
      <Path d="M74 54 q14 -9 34 -5 l-4 9 h-32 Z" fill="url(#bikeBody)" />
      <Path d="M108 50 q16 -3 24 4 l-6 6 h-20 Z" fill="#8B5CF6" />
      {/* handlebar */}
      <Path d="M150 46 l14 -8" stroke="#4C1D95" strokeWidth="5" strokeLinecap="round" />
      <Path d="M132 56 L152 44" stroke="url(#bikeBody)" strokeWidth="6" strokeLinecap="round" />
      {/* headlamp */}
      <Circle cx="160" cy="52" r="7.5" fill="#FFF3C4" />
      {/* delivery box on the back — ties the art to parcels */}
      <Rect x="52" y="34" width="30" height="22" rx="5" fill={C.pink} />
      <Rect x="65" y="34" width="5" height="22" fill="#fff" opacity="0.55" />
    </Svg>
  );
}

// A skyline strip that sits behind the vehicles.
function SkylineArt() {
  return (
    <Svg width={W} height={110} viewBox={`0 0 ${W} 110`}>
      <Defs>
        <LinearGradient id="bld" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3B1E6E" /><Stop offset="1" stopColor="#2A1350" />
        </LinearGradient>
      </Defs>
      {Array.from({ length: 14 }).map((_, i) => {
        const bw = 26 + ((i * 13) % 20);
        const bh = 34 + ((i * 29) % 58);
        const x = i * (W / 13) - 8;
        return (
          <G key={i}>
            <Rect x={x} y={110 - bh} width={bw} height={bh} rx="3" fill="url(#bld)" />
            {Array.from({ length: Math.max(1, Math.floor(bh / 18)) }).map((__, r) => (
              <Rect key={r} x={x + 6} y={110 - bh + 8 + r * 16} width={bw - 12} height={5} rx="1.6"
                fill="#FFD98A" opacity={(i + r) % 3 === 0 ? 0.55 : 0.16} />
            ))}
          </G>
        );
      })}
    </Svg>
  );
}

// Road with dashes that slide — the one thing that sells motion.
function MovingRoad({ t }: { t: Animated.Value }) {
  const shift = t.interpolate({ inputRange: [0, 1], outputRange: [0, -64] });
  return (
    <View style={{ height: 46, overflow: 'hidden', justifyContent: 'center' }}>
      <View style={{ height: 46, backgroundColor: '#241844' }} />
      <Animated.View style={{ position: 'absolute', flexDirection: 'row', transform: [{ translateX: shift }] }}>
        {Array.from({ length: Math.ceil(W / 64) + 2 }).map((_, i) => (
          <View key={i} style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: '#FFD98A', opacity: 0.65, marginRight: 28 }} />
        ))}
      </Animated.View>
    </View>
  );
}

type Slide = {
  key: string;
  kicker: string;
  title: string;
  body: string;
  art: (t: Animated.Value) => React.ReactNode;
  tint: string;
};

export function WelcomeScreen() {
  const { setScreen } = useApp();
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const t = useLoop(2200);

  // Vehicles ride the shared loop with a small vertical bob.
  const bob = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -6, 0] });

  const finish = () => {
    Storage.setItem(WELCOME_SEEN_KEY, '1').catch(() => {});
    setScreen('login');
  };

  const SLIDES: Slide[] = [
    {
      key: 'hello',
      kicker: 'WELCOME TO',
      title: 'Sppero',
      body: 'Your city, one tap away. Bikes, autos and cars with verified Buddies — ready when you are.',
      tint: C.pink,
      art: () => (
        <Animated.View style={{ alignItems: 'center', transform: [{ translateY: bob }] }}>
          <CarArt w={Math.min(280, W * 0.78)} />
        </Animated.View>
      ),
    },
    {
      key: 'rides',
      kicker: 'EVERY KIND OF TRIP',
      title: 'Pick what fits',
      body: 'A bike to beat the traffic, an auto for the everyday, a car when it matters. Fare shown before you book — always.',
      tint: '#7C3AED',
      art: () => (
        <View style={{ alignItems: 'center' }}>
          <Animated.View style={{ transform: [{ translateY: bob }] }}>
            <AutoArt w={Math.min(230, W * 0.62)} />
          </Animated.View>
          <View style={{ marginTop: -14 }}>
            <BikeArt w={Math.min(210, W * 0.58)} />
          </View>
        </View>
      ),
    },
    {
      key: 'more',
      kicker: 'MORE THAN RIDES',
      title: 'Book by the hour.\nSend a parcel.',
      body: 'Keep a Buddy for a whole day of errands, or send a package across town without leaving home.',
      tint: '#F59E0B',
      art: () => (
        <View style={{ alignItems: 'center' }}>
          <Animated.View style={{ transform: [{ translateY: bob }] }}>
            <BikeArt w={Math.min(250, W * 0.68)} />
          </Animated.View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            {[['time-outline', 'By the hour'], ['cube-outline', 'Parcel'], ['map-outline', 'Intercity']].map(([ic, lb], i) => (
              <View key={i} style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
                paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20,
              }}>
                <Ionicons name={ic as any} size={13} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '800' }}>{lb}</Text>
              </View>
            ))}
          </View>
        </View>
      ),
    },
    {
      key: 'safe',
      kicker: 'EVERY SINGLE TRIP',
      title: 'Safe, start to finish',
      body: 'OTP-verified starts, live tracking you can share, an SOS that actually reaches someone, and Buddies we have checked ourselves.',
      tint: C.green,
      art: () => (
        <View style={{ alignItems: 'center' }}>
          <Animated.View style={{ transform: [{ translateY: bob }] }}>
            <Svg width={Math.min(190, W * 0.5)} height={Math.min(190, W * 0.5)} viewBox="0 0 190 190">
              <Defs>
                <LinearGradient id="shieldG" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#34D399" /><Stop offset="1" stopColor="#047857" />
                </LinearGradient>
              </Defs>
              <Circle cx="95" cy="95" r="82" fill="#fff" opacity="0.07" />
              <Path d="M95 22 L156 46 V98 c0 40 -33 62 -61 70 c-28 -8 -61 -30 -61 -70 V46 Z" fill="url(#shieldG)" />
              <Path d="M70 96 l17 18 l35 -40" stroke="#fff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          </Animated.View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {[['🔑', 'OTP'], ['📍', 'Live track'], ['🆘', 'SOS']].map(([e, lb], i) => (
              <View key={i} style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
                paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20,
              }}>
                <Text style={{ fontSize: 12 }}>{e}</Text>
                <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '800' }}>{lb}</Text>
              </View>
            ))}
          </View>
        </View>
      ),
    },
  ];

  const last = idx === SLIDES.length - 1;
  const next = () => {
    if (last) return finish();
    scrollRef.current?.scrollTo({ x: (idx + 1) * W, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1A0D2E' }}>
      {/* ambient colour wash — pointerEvents off so nothing eats the swipe */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -90, right: -70, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,45,120,0.20)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 120, left: -90, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(124,58,237,0.22)' }} />

      {/* skip */}
      <View style={{ position: 'absolute', top: 52, right: 18, zIndex: 5 }}>
        {!last && (
          <TouchableOpacity onPress={finish} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.62)', fontSize: 13.5, fontWeight: '800' }}>Skip</Text>
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
          <View key={sl.key} style={{ width: W, flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
            {/* art stage */}
            <View style={{ height: 300, justifyContent: 'flex-end', alignItems: 'center' }}>
              <View pointerEvents="none" style={{ position: 'absolute', bottom: 46, opacity: 0.5 }}>
                <SkylineArt />
              </View>
              <View style={{ marginBottom: -6 }}>{sl.art(t)}</View>
              <MovingRoad t={t} />
            </View>

            <View style={{ paddingHorizontal: 30, marginTop: 30, alignItems: 'center' }}>
              <Text style={{ color: sl.tint, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }}>{sl.kicker}</Text>
              <Text style={{ color: '#fff', fontSize: sl.key === 'hello' ? 40 : 26, fontWeight: '900', textAlign: 'center', marginTop: 8, lineHeight: sl.key === 'hello' ? 46 : 33 }}>
                {sl.title}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.62)', fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 21 }}>
                {sl.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* dots + CTA */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 34 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: 20 }}>
          {SLIDES.map((_, i) => (
            <View key={i} style={{
              width: i === idx ? 22 : 7, height: 7, borderRadius: 4,
              backgroundColor: i === idx ? C.pink : 'rgba(255,255,255,0.26)',
            }} />
          ))}
        </View>

        <TouchableOpacity activeOpacity={0.9} onPress={next} style={{
          backgroundColor: C.pink, borderRadius: 17, paddingVertical: 17,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
          shadowColor: C.pink, shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 9,
        }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>
            {last ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons name="arrow-forward" size={19} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
