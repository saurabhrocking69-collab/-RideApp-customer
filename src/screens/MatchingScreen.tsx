import { useRef, useEffect, useState, useMemo } from 'react';
import { Animated, Easing, Dimensions, Linking, Platform, ScrollView, Share, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Storage as AsyncStorage } from '../storage';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, GlassPanel, PulseView, SlideUp } from '../components/ui';
import { LiveMap, vehicleVisual } from '../components/LiveMap';
import { s, C, T, SP, R, SHADOW } from '../styles';
import { apiPost, apiAuthPost } from '../../api';

// cancel-smart now verifies the caller against the ride's actual passenger/
// driver server-side (middleware/userAuth.js) — send the logged-in token
// instead of just a bare apiPost, or every cancel would 401.
async function authRideCancel(body: any) {
  const token = await AsyncStorage.getItem('userToken').catch(() => null);
  return apiAuthPost('/api/rides/cancel-smart', body, token || '');
}
import { API } from '../constants';
import { IlluNoDriver, IlluCancel } from '../components/Illustrations';

// ── Parse Google Maps duration text → seconds ──────────────────────────────
function parseEtaSec(text: string): number {
  if (!text) return 0;
  let s = 0;
  const h = text.match(/(\d+)\s*hour/i);
  const m = text.match(/(\d+)\s*min/i);
  const sc = text.match(/(\d+)\s*sec/i);
  if (h) s += parseInt(h[1]) * 3600;
  if (m) s += parseInt(m[1]) * 60;
  if (sc) s += parseInt(sc[1]);
  return s;
}

// Bearing from (fromLat,fromLng) → (toLat,toLng); used for driver approach direction
function computeBearing(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const toRad = (d: number) => d * Math.PI / 180;
  const dLng = toRad(toLng - fromLng);
  const φ1 = toRad(fromLat), φ2 = toRad(toLat);
  const y = Math.sin(dLng) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLng);
  const bearing = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  const DIRS = [
    { name: 'North',      arrow: '↑' },
    { name: 'North-East', arrow: '↗' },
    { name: 'East',       arrow: '→' },
    { name: 'South-East', arrow: '↘' },
    { name: 'South',      arrow: '↓' },
    { name: 'South-West', arrow: '↙' },
    { name: 'West',       arrow: '←' },
    { name: 'North-West', arrow: '↖' },
  ];
  return { bearing, ...DIRS[Math.round(bearing / 45) % 8] };
}

// ── Countdown timer for "retry after" — tapping retries immediately at any
// time (the countdown is just when the app will *auto*-retry on its own),
// so this always renders as an active pink button, never a greyed-out
// disabled-looking one, to avoid implying the customer must wait it out.
function RetryTimer({ seconds, onRetry }: { seconds: number; onRetry: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      {remaining > 0 && (
        <Text style={{ color: C.textMuted, fontSize: 13 }}>
          Auto-retry in {mins > 0 ? `${mins} min ` : ''}{secs}s — or tap below to retry now
        </Text>
      )}
      <Bouncy
        onPress={onRetry}
        style={{
          backgroundColor: C.pink,
          borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12,
          borderWidth: 1, borderColor: C.pink,
        }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
          🔄 Retry Now
        </Text>
      </Bouncy>
    </View>
  );
}

const VEHICLE_LABELS: Record<string, string> = {
  bike: 'Bike', auto: 'Auto', car: 'Car', eriksha: 'E-Riksha',
  green_bike: 'Green Bike', electric_auto: 'Electric Auto', luxury: 'Luxury',
};
// ── Real vehicle model (same top-down art as the map marker), scaled to
// fit a box instead of the flat emoji this screen used before. 70 is a
// rough max-dimension baseline (car's SVG is the tallest at 66) so every
// shape lands safely inside `size` without per-shape scale tuning. ─────────
function VehicleGlyph({ vehicleType, size = 40, rotateDeg = 0 }: { vehicleType: string; size?: number; rotateDeg?: number }) {
  const { Shape, props } = vehicleVisual(vehicleType);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ transform: [{ rotate: `${rotateDeg}deg` }, { scale: size / 70 }] }}>
        <Shape {...props} />
      </View>
    </View>
  );
}

// ── Status pill — compact rotating chip between drag handle and ETA hero ─────
function BuddyMessages({ visible }: { visible: boolean }) {
  const PILLS = [
    { border: C.pinkBorder,  bg: C.pinkGlass,  icon: '🤝', text: 'Buddy connected' },
    { border: C.plumBorder,  bg: C.plumGlass,  icon: '🛡️', text: 'Dedicated to your ride' },
    { border: C.greenBorder, bg: C.greenGlass, icon: '📍', text: 'Live tracking active' },
    { border: C.glassBorder, bg: C.glassMid,   icon: '✨', text: 'Safe journey ahead' },
  ];
  const [idx, setIdx]  = useState(0);
  const fadeAnim       = useRef(new Animated.Value(1)).current;
  const slideAnim      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const iv = setInterval(() => {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -5, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setIdx(p => (p + 1) % PILLS.length);
        slideAnim.setValue(5);
        Animated.parallel([
          Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start();
      });
    }, 3200);
    return () => clearInterval(iv);
  }, [visible]);

  const pill = PILLS[idx];
  return (
    <View style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 8 }}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: pill.bg, borderRadius: 20,
          paddingHorizontal: 14, paddingVertical: 6,
          borderWidth: 1.5, borderColor: pill.border,
        }}>
          <Text style={{ fontSize: 12 }}>{pill.icon}</Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: C.text }}>{pill.text}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Radar sonar rings — pulse outward while searching ─────────────────────
function RadarPulse({ active }: { active: boolean }) {
  const r1 = useRef(new Animated.Value(0)).current;
  const r2 = useRef(new Animated.Value(0)).current;
  const r3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) { [r1, r2, r3].forEach(r => r.setValue(0)); return; }
    const mkLoop = (val: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
    const a1 = mkLoop(r1, 0);
    const a2 = mkLoop(r2, 660);
    const a3 = mkLoop(r3, 1320);
    [a1, a2, a3].forEach(a => a.start());
    return () => [a1, a2, a3].forEach(a => a.stop());
  }, [active]);

  const ringStyle = (r: Animated.Value) => ({
    position: 'absolute' as const,
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 1.5, borderColor: C.pink,
    opacity: r.interpolate({ inputRange: [0, 0.12, 0.65, 1], outputRange: [0, 0.55, 0.18, 0] }),
    transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1] }) }],
  });

  return (
    <View style={{ position: 'absolute', width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={ringStyle(r1)} />
      <Animated.View style={ringStyle(r2)} />
      <Animated.View style={ringStyle(r3)} />
    </View>
  );
}

// ── Horizontal scan-line animation for the searching hero ───────────────────
const SCAN_LINES = [
  { speed: 1600, delay: 0,    dir: 1,  opacity: 0.13, h: 2 },
  { speed: 2200, delay: 400,  dir: -1, opacity: 0.09, h: 1 },
  { speed: 1300, delay: 800,  dir: 1,  opacity: 0.18, h: 3 },
  { speed: 2600, delay: 200,  dir: -1, opacity: 0.07, h: 1 },
  { speed: 1900, delay: 1000, dir: 1,  opacity: 0.11, h: 2 },
  { speed: 1100, delay: 600,  dir: -1, opacity: 0.15, h: 2 },
  { speed: 3000, delay: 300,  dir: 1,  opacity: 0.06, h: 1 },
  { speed: 1500, delay: 900,  dir: -1, opacity: 0.12, h: 3 },
];
const HERO_H = 240; // approximate height of the searching hero box

function ScanLines({ active }: { active: boolean }) {
  const anims = useRef(
    SCAN_LINES.map((l, i) => new Animated.Value(l.dir > 0 ? -10 : HERO_H + 10))
  ).current;

  useEffect(() => {
    if (!active) return;
    const loops = SCAN_LINES.map((cfg, i) => {
      const start = cfg.dir > 0 ? -10 : HERO_H + 10;
      const end   = cfg.dir > 0 ? HERO_H + 10 : -10;
      anims[i].setValue(start);
      return Animated.loop(
        Animated.sequence([
          Animated.delay(cfg.delay),
          Animated.timing(anims[i], {
            toValue: end,
            duration: cfg.speed,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(anims[i], { toValue: start, duration: 0, useNativeDriver: true }),
        ])
      );
    });
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [active]);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {SCAN_LINES.map((cfg, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: 0, right: 0,
            height: cfg.h,
            backgroundColor: '#fff',
            opacity: cfg.opacity,
            transform: [{ translateY: anims[i] }],
          }}
        />
      ))}
    </View>
  );
}

// ── Pre-assigned waiting card — shown when a busy driver is offered this ride ─
function PreAssignedCard({ rideData, onCancel }: { rideData: any; onCancel: () => void }) {
  const driver    = rideData?.driver;
  const etaMin    = rideData?.pre_assigned_eta_min ?? null;
  const confirmed = rideData?.pre_accepted === true;

  // Pulsing glow ring for the purple card
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  // After 5 minutes with no explicit confirmation, show "feel free to cancel" banner
  const [longWait, setLongWait] = useState(false);
  useEffect(() => {
    if (confirmed) { setLongWait(false); return; }
    const t = setTimeout(() => setLongWait(true), 5 * 60 * 1000);
    return () => clearTimeout(t);
  }, [confirmed]);

  return (
    <View style={{ marginHorizontal: 12, marginTop: 10 }}>

      {/* Purple hero card */}
      <Animated.View style={{
        backgroundColor: '#1A0A2E', borderRadius: 20, overflow: 'hidden',
        borderWidth: 1.5, borderColor: '#7C3AED',
        shadowColor: '#7C3AED', shadowOpacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }), shadowRadius: 20, elevation: 12,
      }}>

        {/* Header */}
        <View style={{ backgroundColor: '#7C3AED', paddingVertical: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 18 }}>🏍️</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 0.3 }}>Driver Found!</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginTop: 1 }}>
              {confirmed ? 'Completing current trip, then heading to you' : 'Driver reviewing your request…'}
            </Text>
          </View>
          {confirmed && (
            <View style={{ backgroundColor: '#4ADE80', borderRadius: 100, paddingHorizontal: 9, paddingVertical: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#022C22' }}>✓ CONFIRMED</Text>
            </View>
          )}
        </View>

        {/* Driver info */}
        {driver && (
          <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#2D1B4E', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#7C3AED' }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#A78BFA' }}>
                {(driver.name || 'D')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#F1F5F9' }}>{driver.name || 'Driver'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 11, color: '#C4B5FD', fontWeight: '700' }}>
                  ⭐ {driver.rating ? parseFloat(driver.rating).toFixed(1) : '5.0'}
                </Text>
                {driver.vehicle_brand ? (
                  <Text style={{ fontSize: 11, color: '#94A3B8' }}>· {[driver.vehicle_brand, driver.vehicle_model].filter(Boolean).join(' ')}</Text>
                ) : null}
              </View>
              {driver.vehicle_no ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ backgroundColor: '#2D1B4E', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#7C3AED' }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#C4B5FD', letterSpacing: 0.5 }}>
                      {driver.vehicle_no}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: '#1E3A1E', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#4ADE80' }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#4ADE80' }}>Completing trip…</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* ETA */}
        {etaMin != null && (
          <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: '#0D0520', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#4C1D95', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 22 }}>⏱️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#E9D5FF' }}>~{etaMin} min estimated arrival</Text>
              <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '600', marginTop: 2 }}>After dropping off current passenger</Text>
            </View>
          </View>
        )}
      </Animated.View>

      {/* Long wait banner */}
      {longWait && !confirmed && (
        <View style={{ marginTop: 10, backgroundColor: '#1C1400', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#78350F', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 16 }}>⏳</Text>
          <Text style={{ flex: 1, fontSize: 12, color: '#FCD34D', fontWeight: '600', lineHeight: 17 }}>
            Taking a bit longer — driver hasn't confirmed yet. You can cancel anytime for free.
          </Text>
        </View>
      )}

      {/* Free cancel note */}
      <TouchableOpacity onPress={onCancel} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 }}>
        <Ionicons name="close-circle-outline" size={16} color={C.textMuted} />
        <Text style={{ fontSize: 13, color: C.textMuted, fontWeight: '600' }}>Cancel anytime · always free in this state</Text>
      </TouchableOpacity>

    </View>
  );
}

// ── Batch queue card — shown when this parcel got route-batched with
//    another nearby delivery and the driver has a pickup to make before
//    reaching this sender. Same visual language as PreAssignedCard (purple
//    hero, pulsing glow) since it's the same underlying idea — "driver is
//    committed to you, just not coming straight to you yet" — but distinct
//    copy: unlike pre-assignment, a driver IS already fully matched here
//    (start_otp/delivery_otp already exist), so no "reviewing your
//    request…"/confirmed-toggle state, just a live stop count. ─────────────
function BatchQueueCard({ rideData }: { rideData: any }) {
  const driver = rideData?.driver;
  const stopsBefore = rideData?.stops_before_pickup ?? 1;

  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={{ marginHorizontal: 12, marginTop: 10 }}>
      <Animated.View style={{
        backgroundColor: '#1A0A2E', borderRadius: 20, overflow: 'hidden',
        borderWidth: 1.5, borderColor: '#7C3AED',
        shadowColor: '#7C3AED', shadowOpacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }), shadowRadius: 20, elevation: 12,
      }}>
        <View style={{ backgroundColor: '#7C3AED', paddingVertical: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 18 }}>📦📦</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 0.3 }}>Driver Matched!</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginTop: 1 }}>
              Batched with a nearby delivery — {stopsBefore} pickup before you
            </Text>
          </View>
        </View>

        {driver && (
          <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#2D1B4E', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#7C3AED' }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#A78BFA' }}>{(driver.name || 'D')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#F1F5F9' }}>{driver.name || 'Driver'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 11, color: '#C4B5FD', fontWeight: '700' }}>⭐ {driver.rating ? parseFloat(driver.rating).toFixed(1) : '5.0'}</Text>
                {driver.vehicle_brand ? (
                  <Text style={{ fontSize: 11, color: '#94A3B8' }}>· {[driver.vehicle_brand, driver.vehicle_model].filter(Boolean).join(' ')}</Text>
                ) : null}
              </View>
              {driver.vehicle_no ? (
                <View style={{ backgroundColor: '#2D1B4E', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#7C3AED', alignSelf: 'flex-start', marginTop: 2 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#C4B5FD', letterSpacing: 0.5 }}>{driver.vehicle_no}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: '#0D0520', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#4C1D95', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 22 }}>🔁</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#E9D5FF' }}>Your pickup OTP is ready whenever they arrive</Text>
            <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '600', marginTop: 2 }}>They're on their way to another pickup first</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Surge price step slider — shown when backend emits surge_offer ──────────
const SURGE_STEPS = [10, 20, 30, 40, 50, 80, 100, 150];

function SurgePriceSlider({
  offer, baseFare, onSelect, onDecline, surging,
}: {
  offer: { timeout_sec: number };
  baseFare: number;
  onSelect: (amt: number) => void;
  onDecline: () => void;
  surging: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(offer.timeout_sec);
  const countdownAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(countdownAnim, { toValue: 0, duration: offer.timeout_sec * 1000, useNativeDriver: false }).start();
  }, []);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const urgent = remaining < 20;

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
      <View style={{
        backgroundColor: C.bgCard,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: urgent ? C.red : C.saffron,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: urgent ? C.red : C.saffron,
        shadowOpacity: 0.28,
        shadowRadius: 16,
      }}>
        {/* Countdown bar */}
        <View style={{ height: 4, backgroundColor: 'rgba(0,0,0,0.08)' }}>
          <Animated.View style={{
            height: '100%',
            width: countdownAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            backgroundColor: urgent ? C.red : C.saffron,
          }} />
        </View>

        <View style={{ padding: 16 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 22, marginRight: 10 }}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: C.text }}>Offer a higher fare</Text>
              <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                Tap an amount — search restarts instantly
              </Text>
            </View>
            <View style={{
              alignItems: 'center',
              backgroundColor: urgent ? C.redGlass : C.saffGlass,
              borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
              borderWidth: 1, borderColor: urgent ? C.red : C.saffron,
            }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: urgent ? C.red : C.saffron, lineHeight: 24 }}>{remaining}</Text>
              <Text style={{ fontSize: 8, color: C.textMuted, letterSpacing: 0.5 }}>SEC</Text>
            </View>
          </View>

          {/* Fare display */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
            <Text style={{ fontSize: 13, color: C.textMuted, fontWeight: '600' }}>Base</Text>
            <Text style={{ fontSize: 26, fontWeight: '900', color: C.text, letterSpacing: -0.5 }}>₹{baseFare}</Text>
            {selected !== null && (
              <>
                <Text style={{ fontSize: 15, color: C.textDim, fontWeight: '700' }}>+</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: C.saffron }}>₹{selected}</Text>
                <Text style={{ fontSize: 15, color: C.textDim, fontWeight: '700' }}>=</Text>
                <Text style={{ fontSize: 26, fontWeight: '900', color: C.green, letterSpacing: -0.5 }}>₹{baseFare + selected}</Text>
              </>
            )}
          </View>

          {/* Step chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingRight: 4 }}>
              {SURGE_STEPS.map(amt => {
                const isSel = selected === amt;
                return (
                  <TouchableOpacity
                    key={amt}
                    onPress={() => { setSelected(amt); onSelect(amt); }}
                    disabled={surging}
                    activeOpacity={0.75}
                    style={{
                      borderRadius: 13,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      backgroundColor: isSel ? C.saffron : C.saffGlass,
                      borderWidth: 1.5,
                      borderColor: isSel ? C.saffron : C.saffBorder,
                      alignItems: 'center',
                      minWidth: 58,
                      opacity: surging && !isSel ? 0.45 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '900', color: isSel ? '#fff' : C.saffron }}>
                      +₹{amt}
                    </Text>
                    <Text style={{ fontSize: 9, color: isSel ? 'rgba(255,255,255,0.75)' : C.textDim, marginTop: 2 }}>
                      ₹{baseFare + amt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Decline */}
          <TouchableOpacity onPress={onDecline} disabled={surging} activeOpacity={0.7}
            style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ fontSize: 12, color: C.textMuted, fontWeight: '600' }}>Keep original fare</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Tips carousel — rotates safety/feature tips while customer waits ────────
const WAIT_TIPS = [
  { icon: '🛡️', text: 'Every Sppero Buddy is verified & background-checked' },
  { icon: '⭐', text: 'Rate your Buddy after the ride — it really helps drivers!' },
  { icon: '🔔', text: 'You\'ll be notified the moment a Buddy accepts your request' },
  { icon: '🗺️', text: 'Live tracking starts as soon as your Buddy is assigned' },
  { icon: '💬', text: 'Chat directly with your Buddy once they\'re matched' },
  { icon: '🔒', text: 'Share your ride OTP only after boarding — never before' },
];
function TipsCarousel() {
  const [idx, setIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const iv = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setIdx(i => (i + 1) % WAIT_TIPS.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      });
    }, 3600);
    return () => clearInterval(iv);
  }, []);

  const tip = WAIT_TIPS[idx];
  return (
    <Animated.View style={{
      opacity: fadeAnim,
      marginHorizontal: 20, marginBottom: 10,
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.glassMid, borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: C.glassBorder,
    }}>
      <Text style={{ fontSize: 18 }}>{tip.icon}</Text>
      <Text style={{ fontSize: 12, color: C.textMuted, flex: 1, lineHeight: 18 }}>{tip.text}</Text>
    </Animated.View>
  );
}

// ── Circular ETA ring — spinner arc + countdown ────────────────────────────
function EtaRing({ etaMins, etaColor, driverArrived }: { etaMins: number; etaColor: string; driverArrived: boolean }) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim   = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (driverArrived) { rotateAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 4800, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [driverArrived]);

  useEffect(() => {
    const glow = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1,   duration: 1100, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.3, duration: 1100, useNativeDriver: true }),
    ]));
    glow.start();
    return () => glow.stop();
  }, []);

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer pulsing glow ring */}
      <Animated.View style={{
        position: 'absolute', width: 140, height: 140, borderRadius: 70,
        borderWidth: 2, borderColor: driverArrived ? C.green : etaColor,
        opacity: glowAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.15, 0.45] }),
      }} />
      {/* Static background track */}
      <View style={{ position: 'absolute', width: 116, height: 116, borderRadius: 58, borderWidth: 2.5, borderColor: C.glassBorder }} />
      {/* Spinning arc (waiting state only) */}
      {!driverArrived && (
        <Animated.View style={{
          position: 'absolute', width: 116, height: 116, borderRadius: 58,
          borderWidth: 3.5,
          borderTopColor: etaColor,
          borderRightColor: (etaColor || '') + '55',
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent',
          transform: [{ rotate }],
        }} />
      )}
      {/* Inner content circle */}
      <View style={{
        width: 90, height: 90, borderRadius: 45,
        backgroundColor: driverArrived ? 'rgba(5,150,105,0.10)' : C.bgDeep,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: driverArrived ? C.greenBorder : C.glassMid,
      }}>
        {driverArrived ? (
          <>
            <Text style={{ fontSize: 28 }}>🙌</Text>
            <Text style={{ fontSize: 8, color: C.green, fontWeight: '900', letterSpacing: 1, marginTop: 4 }}>HERE!</Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 34, fontWeight: '900', color: etaColor, lineHeight: 38 }}>
              {etaMins <= 0 ? '<1' : etaMins}
            </Text>
            <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: '700', letterSpacing: 0.3 }}>min away</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ── OTP digits with staggered pop-in ──────────────────────────────────────
function OtpDisplay({ otp }: { otp: string }) {
  const digits = String(otp).split('').slice(0, 4);
  const a0 = useRef(new Animated.Value(0)).current;
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const a3 = useRef(new Animated.Value(0)).current;
  const anims = [a0, a1, a2, a3];

  useEffect(() => {
    anims.slice(0, digits.length).forEach(a => a.setValue(0));
    Animated.stagger(90, anims.slice(0, digits.length).map(a =>
      Animated.spring(a, { toValue: 1, friction: 6, tension: 300, useNativeDriver: true })
    )).start();
  }, [otp]);

  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {digits.map((digit, i) => (
        <Animated.View key={i} style={{
          transform: [{ scale: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
          opacity: anims[i],
        }}>
          <View style={{
            width: 44, height: 54, borderRadius: 12,
            backgroundColor: C.plumGlass,
            borderWidth: 2, borderColor: C.plumBorder,
            alignItems: 'center', justifyContent: 'center',
            elevation: 8, shadowColor: C.plum, shadowOpacity: 0.35, shadowRadius: 10,
          }}>
            <Text style={{ fontSize: 26, fontWeight: '900', color: C.plum }}>{digit}</Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

export function MatchingScreen() {
  const { bottom: screenBottomInset } = useSafeAreaInsets();
  const {
    phone,
    screen, setScreen,
    pickup, setPickup, drop, setDrop,
    pickupCoords, dropCoords, setPickupCoords, setDropCoords,
    eta, setEta,
    resetBookingState,
    rideType,
    rideData, setRideData,
    driverLoc, setDriverLoc,
    driverEta, driverDist,
    cancelTimer,
    freeCancelsLeft,
    cancelInfo,
    unreadChat, setUnreadChat,
    chatToast, setChatToast,
    showCancelModal, setShowCancelModal,
    sosActive,
    searchElapsed,
    surgeBarAnim,
    surgeCount,
    surgeFare,
    surging,
    serverSurgeOffer, setServerSurgeOffer,
    noDriverFinal, setNoDriverFinal,
    altSuggest, setAltSuggest,
    switchingVehicle,
    result, setResult,
    userCoords,
    surgeFareNow, switchVehicle, bookRide,
    callDriver, triggerSOS,
    rideIcon,
    setChatOrigin,
    driverCancelPopup, setDriverCancelPopup,
  } = useApp();


  // ── Chat icon bounce ───────────────────────────────────────────────────────
  const chatBounceAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (unreadChat > 0) {
      const loop = Animated.loop(Animated.sequence([
        Animated.spring(chatBounceAnim, { toValue: 1.16, friction: 3, tension: 300, useNativeDriver: true }),
        Animated.spring(chatBounceAnim, { toValue: 1, friction: 3, tension: 300, useNativeDriver: true }),
        Animated.delay(1800),
      ]));
      loop.start();
      return () => loop.stop();
    } else {
      chatBounceAnim.setValue(1);
    }
  }, [unreadChat]);

  // ── Driver avatar breathing animation ──
  const breatheAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!rideData?.driver) return;
    const breathe = Animated.loop(Animated.sequence([
      Animated.delay(2500),
      Animated.timing(breatheAnim, { toValue: 1.028, duration: 850, useNativeDriver: true }),
      Animated.timing(breatheAnim, { toValue: 1, duration: 850, useNativeDriver: true }),
    ]));
    breathe.start();
    return () => breathe.stop();
  }, [!!rideData?.driver]);

  // ── Live ETA countdown — syncs from driverEta on every update (haversine-backed, ~4s interval) ──
  const [etaRemaining, setEtaRemaining] = useState(0);
  useEffect(() => {
    const sec = parseEtaSec(driverEta || '');
    if (sec > 0) setEtaRemaining(sec); // sync immediately — haversine updates are already smoothed
  }, [driverEta]);
  useEffect(() => {
    const driverArrived = cancelInfo?.driver_status === 'arrived';
    if (driverArrived || etaRemaining <= 0) return;
    const iv = setInterval(() => setEtaRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(iv);
  }, [cancelInfo?.driver_status, etaRemaining]);

  // ── Approach progress — how far driver has travelled vs. original ETA ───────
  const initialEtaRef = useRef<number>(0);
  const approachAnim  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (rideData?.driver && etaRemaining > 30 && !initialEtaRef.current)
      initialEtaRef.current = etaRemaining;
    if (!rideData?.driver) { initialEtaRef.current = 0; approachAnim.setValue(0); }
  }, [!!rideData?.driver, etaRemaining]);
  useEffect(() => {
    if (initialEtaRef.current > 0) {
      const pct = Math.max(0, Math.min(100, (1 - etaRemaining / initialEtaRef.current) * 100));
      Animated.timing(approachAnim, { toValue: pct, duration: 1000, useNativeDriver: false }).start();
    }
  }, [etaRemaining]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const driverArrived  = cancelInfo?.driver_status === 'arrived';
  const driverWaitSec  = cancelInfo?.driver_wait_sec ?? 0;
  const waitFareAdd    = cancelInfo?.wait_fare_add ?? 0;
  const waitFareFreeMin = cancelInfo?.wait_fare_free_min ?? 3;
  const freeSecLeft    = Math.max(0, waitFareFreeMin * 60 - driverWaitSec);
  const waitMin        = Math.floor(driverWaitSec / 60);
  const waitSecRem     = driverWaitSec % 60;
  const origFare       = cancelInfo?.wait_fare_orig ?? 0;
  const newFare        = cancelInfo?.wait_fare_new_total ?? origFare;
  const baseRideFare   = (() => {
    const rawF = Math.round(parseFloat(String(rideData?.fare ?? '').replace(/[^0-9.]/g, '')) || 0);
    const disc  = Math.round(parseFloat(String(rideData?.discount ?? '0')) || 0);
    return rideData?.net_fare != null ? Math.round(rideData.net_fare) : Math.max(0, rawF - disc);
  })();

  const etaMins        = etaRemaining > 0 ? Math.ceil(etaRemaining / 60) : 0;
  const etaDisplay     = !etaRemaining ? (driverEta || '...') : etaMins <= 1 ? '< 1 min' : `${etaMins} min`;
  const etaColor       = !etaRemaining ? C.textMuted : etaMins <= 2 ? C.green : etaMins <= 5 ? C.yellow : C.text;
  const etaCountdown   = etaRemaining > 0
    ? `${Math.floor(etaRemaining / 60)}:${String(etaRemaining % 60).padStart(2, '0')}`
    : 'Arriving';

  // Bearing from pickup → driver: tells customer which side driver is coming from
  const approachDir = useMemo(() => {
    const pLat = (pickupCoords as any)?.lat ?? (pickupCoords as any)?.latitude;
    const pLng = (pickupCoords as any)?.lng ?? (pickupCoords as any)?.longitude;
    if (!pLat || !pLng || !driverLoc?.lat || !driverLoc?.lng) return null;
    return computeBearing(pLat, pLng, driverLoc.lat, driverLoc.lng);
  }, [pickupCoords, driverLoc]);

  // ── Share tracking ─────────────────────────────────────────────────────────
  const shareTracking = () => {
    const d = rideData?.driver;
    const trackUrl = `${API}/track/${rideData?.ride_id || ''}`;
    const msg = `🚖 *Sppero — Live Tracking*\n\nDriver: ${d?.name || 'Assigned'} | ${d?.vehicle_no || ''}\n${rideData?.startOtp ? `OTP: ${rideData.startOtp}\n` : ''}📍 From: ${pickup}\n🎯 To: ${drop}\n\n📡 *Live track:*\n${trackUrl}`;
    Share.share({ message: msg, url: trackUrl, title: 'Sppero Live Tracking' }).catch(() => {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
    });
  };

  if (showCancelModal) return <CancelModal />;

  if (driverCancelPopup) return (
    <View style={{ flex: 1, backgroundColor: 'rgba(8,14,24,0.88)', justifyContent: 'center', alignItems: 'center', padding: 28 }}>
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 26, padding: 32, alignItems: 'center', width: '100%', elevation: 20 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 2, borderColor: '#EF4444', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Text style={{ fontSize: 34 }}>🚫</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 8, textAlign: 'center' }}>Driver ne Cancel Kiya</Text>
        <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 28, lineHeight: 20 }}>Ride cancel ho gayi. Dobara book karne ke liye home se search karein.</Text>
        <TouchableOpacity
          onPress={() => {
            setDriverCancelPopup(false);
            setRideData(null);
            resetBookingState();
            setScreen('home');
          }}
          style={{ backgroundColor: C.pink, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 52 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Okay</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Layout math ────────────────────────────────────────────────────────────
  const SCREEN_H = Dimensions.get('window').height;
  const OVERLAP  = 24; // sheet overlaps map by this much (for rounded top corners)

  const sheetH = driverArrived
    ? Math.round(SCREEN_H * 0.64)
    : rideData?.driver
      ? Math.round(SCREEN_H * 0.60)
      : Math.round(SCREEN_H * 0.47);
  const mapH = SCREEN_H - sheetH + OVERLAP;


  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ══ FULL MAP ══ */}
      <View style={{ height: mapH }}>
        <LiveMap
          pickupCoords={pickupCoords}
          dropCoords={dropCoords}
          driverLat={driverLoc?.lat}
          driverLng={driverLoc?.lng}
          vehicleType={rideType}
          userLat={(userCoords as any)?.latitude ?? (userCoords as any)?.lat}
          userLng={(userCoords as any)?.longitude ?? (userCoords as any)?.lng}
          userAccuracy={(userCoords as any)?.accuracy}
          height={mapH}
          mode={rideData?.driver ? 'matching' : 'booking'}
          showRoute
          followDriver={!!rideData?.driver}
          showTraffic={false}
          pulsePickup={!!rideData?.driver && !driverArrived}
          pulseSearching={!!rideData && !rideData?.driver}
        />


        {/* Approach direction chip — light frosted glass, top of map, below back button */}
        {rideData?.driver && !driverArrived && approachDir && (
          <View
            style={{ position: 'absolute', top: (StatusBar.currentHeight ?? 28) + 64, left: 0, right: 0, alignItems: 'center' }}
            pointerEvents="none"
          >
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.88)',
              borderRadius: 22, paddingHorizontal: 14, paddingVertical: 7,
              flexDirection: 'row', alignItems: 'center', gap: 7,
              borderWidth: 1, borderColor: 'rgba(200,210,230,0.55)',
              elevation: 6,
              shadowColor: '#000', shadowOpacity: 0.09, shadowRadius: 10,
              shadowOffset: { width: 0, height: 2 },
            }}>
              <Text style={{ fontSize: 15, lineHeight: 20 }}>{approachDir.arrow}</Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#1a1a2e' }}>
                From {approachDir.name} side
              </Text>
              {driverDist ? (
                <>
                  <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#ccc' }} />
                  <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>{driverDist}</Text>
                </>
              ) : null}
            </View>
          </View>
        )}

        {/* Minimal top overlay — back button + chat toast */}
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          paddingTop: (StatusBar.currentHeight ?? 28) + 8,
          paddingHorizontal: 16, paddingBottom: 10,
          flexDirection: 'row', alignItems: 'center', gap: 10,
        }}>
          <TouchableOpacity
            onPress={() => noDriverFinal ? setScreen('home') : setShowCancelModal(true)}
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: 'rgba(0,0,0,0.54)',
              alignItems: 'center', justifyContent: 'center',
            }}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>

          {chatToast && (
            <TouchableOpacity
              onPress={() => { setChatToast(null); setUnreadChat(0); setChatOrigin('matching'); setScreen('chat'); }}
              style={{
                flex: 1, backgroundColor: 'rgba(0,0,0,0.80)', borderRadius: 10,
                paddingHorizontal: 12, paddingVertical: 9,
                flexDirection: 'row', alignItems: 'center', gap: 8,
                borderWidth: 1, borderColor: C.pinkBorder,
              }}>
              <Ionicons name="chatbubble" size={14} color={C.pink} />
              <Text style={{ color: '#fff', fontSize: 12, flex: 1 }} numberOfLines={1}>{chatToast}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Reply</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ══ BOTTOM SHEET ══ */}
      <View style={{
        // sheetH is computed from SCREEN_H alone, with no safe-area awareness --
        // on edge-to-edge Android builds the sheet then falls short of the true
        // screen bottom, exposing the dark screen backdrop as a stray strip
        // above the system nav bar. Extend the sheet itself to cover it.
        height: sheetH + screenBottomInset,
        backgroundColor: '#F0F2F5',
        borderTopLeftRadius: OVERLAP,
        borderTopRightRadius: OVERLAP,
        marginTop: -OVERLAP,
        elevation: 24,
        shadowColor: '#000',
        shadowOpacity: 0.30,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -4 },
      }}>
        {/* Walk-to-pickup banner — caps the sheet when driver is en-route */}
        {rideData?.driver && !driverArrived && rideData?.status !== 'pre_assigned' ? (
          <View style={{
            backgroundColor: '#1356C4',
            borderTopLeftRadius: OVERLAP,
            borderTopRightRadius: OVERLAP,
            paddingTop: 10, paddingBottom: 12,
            paddingHorizontal: 20,
            alignItems: 'center',
          }}>
            <View style={{ width: 36, height: 3.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.30)', marginBottom: 8 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="walk-outline" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.15 }}>
                Walk to your pickup point
              </Text>
              {driverDist ? (
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10,
                  paddingHorizontal: 8, paddingVertical: 2,
                }}>
                  <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 11, fontWeight: '700' }}>
                    {driverDist}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassMid }} />
          </View>
        )}

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{ paddingBottom: 20 + screenBottomInset }}
        >

          {/* ═══════════════ PRE-ASSIGNED STATE ═══════════════ */}
          {rideData?.status === 'pre_assigned' ? (
            <PreAssignedCard rideData={rideData} onCancel={() => setShowCancelModal(true)} />
          ) : rideData?.batched && (rideData?.stops_before_pickup ?? 0) > 0 ? (
            <BatchQueueCard rideData={rideData} />
          ) : rideData?.driver ? (
            <>
              {!driverArrived && <BuddyMessages visible />}

              {/* ══ ETA HERO v2 — countdown + approach bar ══ */}
              <View style={{ marginHorizontal: 20, marginTop: 10, marginBottom: 6 }}>
                {driverArrived ? (
                  /* ── Arrived card — compact horizontal ── */
                  <View style={{ backgroundColor: C.bgCard, borderRadius: 20, borderWidth: 1.5, borderColor: C.greenBorder, overflow: 'hidden', elevation: 6, shadowColor: C.green, shadowOpacity: 0.12, shadowRadius: 14 }}>
                    {/* Full-width green bar at top */}
                    <View style={{ height: 4, backgroundColor: C.green }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
                      {/* Icon */}
                      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(5,150,105,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.greenBorder, flexShrink: 0 }}>
                        <Ionicons name="checkmark" size={26} color={C.green} />
                      </View>
                      {/* Text block */}
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontSize: 17, fontWeight: '900', color: C.green }}>Driver is here!</Text>
                        <Text style={{ fontSize: 12, color: C.textMuted }}>Walk over · Show PIN to start</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}>
                          <Ionicons name={freeSecLeft > 0 ? 'time-outline' : 'warning-outline'} size={11} color={freeSecLeft > 0 ? C.green : C.red} />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: freeSecLeft > 0 ? C.green : C.red }}>
                            {freeSecLeft > 0
                              ? `${Math.floor(freeSecLeft / 60)}m ${String(freeSecLeft % 60).padStart(2, '0')}s free wait left`
                              : `Wait charge active · +₹${waitFareAdd}`}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : (
                  /* ── En-route hero ── */
                  <View style={{ backgroundColor: C.bgCard, borderRadius: 20, borderWidth: 1.5, borderColor: etaMins <= 2 ? C.greenBorder : C.glassBorder, overflow: 'hidden', elevation: 6, shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 14 }}>
                    {/* Approach progress bar */}
                    <View style={{ height: 4, backgroundColor: C.glassMid }}>
                      <Animated.View style={{ height: '100%', backgroundColor: etaColor, width: approachAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }} />
                    </View>
                    {/* Content row */}
                    <View style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                      {/* Live countdown */}
                      <View style={{ alignItems: 'center', minWidth: 72 }}>
                        {etaRemaining > 0 ? (
                          <Text adjustsFontSizeToFit numberOfLines={1} style={{ fontSize: 36, fontWeight: '900', color: etaColor, lineHeight: 40, letterSpacing: -1.5 }}>
                            {etaCountdown}
                          </Text>
                        ) : (
                          <View style={{ alignItems: 'center', gap: 3 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.green }} />
                            <Text style={{ fontSize: 15, fontWeight: '900', color: C.green }}>Arriving</Text>
                          </View>
                        )}
                        <Text style={{ fontSize: 9, color: etaRemaining === 0 ? C.green : C.textDim, letterSpacing: 1, fontWeight: '700', marginTop: 3 }}>
                          {etaRemaining === 0 ? 'NOW' : 'AWAY'}
                        </Text>
                      </View>
                      {/* Vertical rule */}
                      <View style={{ width: 1, height: 52, backgroundColor: C.glassBorder }} />
                      {/* Driver name + status */}
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontSize: 19, fontWeight: '900', color: C.text, lineHeight: 23 }} numberOfLines={1}>
                          {(rideData.driver.name || 'Driver').split(' ')[0]}
                        </Text>
                        <Text style={{ fontSize: 12, color: C.textMuted }}>
                          {driverDist ? `${driverDist} from pickup` : 'En route to you…'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.green }} />
                          <Text style={{ fontSize: 10, color: C.green, fontWeight: '700' }}>Live tracking active</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* ── Quick message chips ── */}
              {!driverArrived && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 8 }}>
                  {["On my way 🏃", "At the entrance 🚪", "2 min late ⏰", "Can't find you?"].map(msg => (
                    <TouchableOpacity
                      key={msg}
                      onPress={() => { setChatOrigin('matching'); setScreen('chat'); }}
                      style={{ backgroundColor: C.glassMid, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.glassBorder }}>
                      <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: '600' }}>{msg}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* ══ PIN STRIP — compact single row ══ */}
              {rideData.startOtp ? (
                <View style={{ marginHorizontal: 20, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.glassMid, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 11, borderWidth: 1, borderColor: C.plumBorder }}>
                  <Ionicons name="lock-closed-outline" size={14} color={C.plum} />
                  <Text style={{ fontSize: 10, fontWeight: '900', color: C.textDim, letterSpacing: 1.5 }}>{rideData?.is_parcel ? 'PICKUP PIN' : 'RIDE PIN'}</Text>
                  <View style={{ flex: 1 }} />
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {String(rideData.startOtp).split('').slice(0, 4).map((d, i) => (
                      <View key={i} style={{ width: 32, height: 38, borderRadius: 9, backgroundColor: C.plumGlass, borderWidth: 1.5, borderColor: C.plumBorder, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: C.plum }}>{d}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* ══ DELIVERY OTP — parcel only. Shown as soon as a driver is
                   matched, not just once picked up, since the sender is the
                   one responsible for getting this to the receiver and
                   should be able to start sharing it right away. Shared
                   manually (WhatsApp/call/text — whatever the sender
                   prefers) instead of an automatic SMS, which depended on
                   Fast2SMS actually delivering and added a failure point
                   for no real benefit — the sender is already right here. ══ */}
              {rideData?.is_parcel && rideData?.deliveryOtp ? (
                <View style={{ marginHorizontal: 20, marginTop: 8, backgroundColor: C.plumGlass, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: C.plumBorder }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="lock-closed-outline" size={14} color={C.plum} />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: C.textDim, letterSpacing: 1.5 }}>DELIVERY OTP</Text>
                    <View style={{ flex: 1 }} />
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {String(rideData.deliveryOtp).split('').slice(0, 4).map((d: string, i: number) => (
                        <View key={i} style={{ width: 32, height: 38, borderRadius: 9, backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.plumBorder, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 18, fontWeight: '900', color: C.plum }}>{d}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      const msg = `📦 Sppero delivery OTP: ${rideData.deliveryOtp}\n\nGive this code to the delivery partner when your package arrives.`;
                      Share.share({ message: msg }).catch(() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`));
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, backgroundColor: C.plum, borderRadius: 10, paddingVertical: 9 }}>
                    <Ionicons name="share-social-outline" size={14} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
                      Share with {rideData.receiver_name || 'receiver'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* ══ DRIVER CARD — avatar + info + chat/call ══ */}
              <View style={{ marginHorizontal: 20, marginTop: 14, backgroundColor: C.bgCard, borderRadius: 20, borderWidth: 1, borderColor: C.glassBorder, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 14 }}>
                {/* Driver info row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }}>
                  {/* Avatar with breathing animation + online dot */}
                  <View>
                    <Animated.View style={{ transform: [{ scale: breatheAnim }] }}>
                      <View style={{
                        width: 62, height: 62, borderRadius: 31,
                        backgroundColor: C.glassMid,
                        borderWidth: 2.5, borderColor: C.glassBorder,
                        alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                        elevation: 4, shadowColor: C.plum, shadowOpacity: 0.18, shadowRadius: 8,
                      }}>
                        {rideData.driver.photo
                          ? <Image source={{ uri: rideData.driver.photo }} style={{ width: 62, height: 62 }} />
                          : <Text style={{ color: C.plum, fontSize: 26, fontWeight: '900' }}>
                              {(rideData.driver.name || 'D')[0].toUpperCase()}
                            </Text>
                        }
                      </View>
                    </Animated.View>
                    {/* Online indicator */}
                    <View style={{ position: 'absolute', bottom: 1, right: 1, width: 15, height: 15, borderRadius: 8, backgroundColor: C.green, borderWidth: 2.5, borderColor: C.bgCard }} />
                  </View>

                  {/* Name, rating, vehicle info */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: C.text }}>{rideData.driver.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.yellowGlass, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.yellowBorder }}>
                        <Text style={{ fontSize: 10 }}>⭐</Text>
                        <Text style={{ fontSize: 11, color: C.yellow, fontWeight: '900' }}>
                          {rideData.driver.rating ? parseFloat(rideData.driver.rating).toFixed(1) : '4.8'}
                        </Text>
                      </View>
                      {rideData.driver.vehicle_brand ? (
                        <Text style={{ fontSize: 11, color: C.textMuted }}>
                          {[rideData.driver.vehicle_brand, rideData.driver.vehicle_model].filter(Boolean).join(' ')}
                        </Text>
                      ) : null}
                    </View>
                    {/* Indian number plate */}
                    {rideData.driver.vehicle_no ? (
                      <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#ffffff', borderRadius: 5, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1.5, borderColor: '#1a3a1a', elevation: 2 }}>
                        <Text style={{ fontSize: 12, fontWeight: '900', color: '#1a3a1a', letterSpacing: 1.3 }}>
                          {rideData.driver.vehicle_no}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Vehicle photo — right side */}
                  <View style={{
                    width: 82, height: 62, borderRadius: 12,
                    backgroundColor: C.glassMid,
                    borderWidth: 1, borderColor: C.glassBorder,
                    alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {rideData.driver.vehicle_photo
                      ? <Image source={{ uri: rideData.driver.vehicle_photo }} style={{ width: 82, height: 62 }} resizeMode="cover" />
                      : <VehicleGlyph vehicleType={rideType} size={58} rotateDeg={90} />
                    }
                  </View>
                </View>

                {/* Thin divider */}
                <View style={{ height: 1, backgroundColor: C.glassBorder, marginHorizontal: 16 }} />

                {/* Chat + Call row */}
                <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: !driverArrived && driverLoc?.lat ? 8 : 12, gap: 8 }}>
                  <Animated.View style={{ flex: 1, transform: [{ scale: chatBounceAnim }] }}>
                    <TouchableOpacity
                      onPress={() => { setUnreadChat(0); setChatOrigin('matching'); setScreen('chat'); }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 13, backgroundColor: unreadChat > 0 ? C.plumGlass : C.glassMid, borderWidth: 1.5, borderColor: unreadChat > 0 ? C.plumBorder : C.glassBorder }}>
                      <Ionicons name="chatbubble" size={15} color={unreadChat > 0 ? C.plum : C.textMuted} />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: unreadChat > 0 ? C.plum : C.textMuted }}>
                        {unreadChat > 0 ? `Chat (${unreadChat})` : 'Chat'}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>

                  <TouchableOpacity
                    onPress={callDriver}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 13, backgroundColor: 'rgba(34,197,94,0.10)', borderWidth: 1.5, borderColor: C.greenBorder }}>
                    <Ionicons name="call" size={15} color={C.green} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: C.green }}>Call</Text>
                  </TouchableOpacity>
                </View>

              </View>

              {/* ══ TRIP TIMELINE — dotted route line with fare ══ */}
              <View style={{ marginHorizontal: 20, marginTop: 14, backgroundColor: C.bgCard, borderRadius: 20, borderWidth: 1, borderColor: C.glassBorder, overflow: 'hidden' }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: C.glassMid, borderBottomWidth: 1, borderBottomColor: C.glassBorder }}>
                  <Ionicons name="map" size={13} color={C.textMuted} />
                  <Text style={{ fontSize: 10, fontWeight: '900', color: C.textMuted, letterSpacing: 1.3, flex: 1 }}>TRIP DETAILS</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: C.yellow }}>
                    {waitFareAdd > 0 ? `₹${newFare}` : (surgeFare || `₹${baseRideFare}`)}
                  </Text>
                </View>

                {/* Pickup → Drop with dotted connector */}
                <View style={{ flexDirection: 'row', padding: 16, gap: 14 }}>
                  {/* Timeline column */}
                  <View style={{ alignItems: 'center', width: 14, paddingTop: 1 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: C.green, borderWidth: 2.5, borderColor: 'rgba(5,150,105,0.25)' }} />
                    {[0, 1, 2, 3, 4, 5].map(i => (
                      <View key={i} style={{ width: 2.5, height: 5, borderRadius: 1.5, backgroundColor: C.glassBorder, marginVertical: 1.5 }} />
                    ))}
                    <View style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: C.pink, borderWidth: 2, borderColor: C.pinkBorder }} />
                  </View>

                  {/* Address column */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: C.text, fontWeight: '700', lineHeight: 16 }} numberOfLines={2}>{pickup}</Text>
                    <View style={{ height: 28 }} />
                    <Text style={{ fontSize: 12, color: C.text, fontWeight: '700', lineHeight: 16 }} numberOfLines={2}>{drop}</Text>
                  </View>
                </View>

                {/* Wait fare row (only when wait charge is added) */}
                {waitFareAdd > 0 && (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                    <View style={{ backgroundColor: C.saffGlass, borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: C.saffBorder }}>
                      <Ionicons name="time" size={13} color={C.saffron} />
                      <Text style={{ fontSize: 11, color: C.saffron, fontWeight: '700' }}>
                        +₹{waitFareAdd} wait charge · driver waited {waitMin}m {waitSecRem}s
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* ══ ACTION BAR — Share · SOS · Cancel ══ */}
              <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 20, marginTop: 14, marginBottom: 12 }}>
                <Bouncy onPress={shareTracking} style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: 13, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: C.glassBorder }}>
                  <Ionicons name="share-social" size={15} color={C.textMuted} />
                  <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: '700' }}>Share</Text>
                </Bouncy>

                <TouchableOpacity onPress={triggerSOS} style={{ flex: 1, backgroundColor: sosActive ? 'rgba(239,68,68,0.22)' : C.redGlass, borderRadius: 13, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1.5, borderColor: C.red }}>
                  <Ionicons name="warning" size={15} color={C.red} />
                  <Text style={{ color: C.red, fontSize: 12, fontWeight: '900' }}>{sosActive ? '🆘 Sent' : 'SOS'}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowCancelModal(true)} style={{ flex: 1, backgroundColor: C.glass, borderRadius: 13, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: C.glassBorder }}>
                  <Ionicons name="close" size={14} color={C.textDim} />
                  <Text style={{ color: C.textDim, fontSize: 12, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
              </View>

              {/* Unread chat banner */}
              {!chatToast && unreadChat > 0 && (
                <TouchableOpacity
                  style={{ ...s.chatAlert, marginHorizontal: 20, marginBottom: 8 }}
                  onPress={() => { setUnreadChat(0); setChatOrigin('matching'); setScreen('chat'); }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                    💬 {unreadChat} new message — tap to read
                  </Text>
                </TouchableOpacity>
              )}
            </>

          ) : (

            /* ═══════════════ SEARCHING STATE ═══════════════ */
            <>
              {/* ── Hero: scan lines + radar rings + vehicle icon + status ── */}
              <View style={{ backgroundColor: 'rgba(10,3,24,0.82)', borderRadius: 20, marginHorizontal: 12, marginTop: 8, marginBottom: 4, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,45,120,0.55)' }}>
              {/* Horizontal scan-line micro-animation */}
              <ScanLines active={!noDriverFinal} />
              <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 16 }}>
                {/* Radar + icon */}
                <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
                  <RadarPulse active={!noDriverFinal} />
                  <View style={{
                    width: 76, height: 76, borderRadius: 38,
                    backgroundColor: noDriverFinal ? 'rgba(239,68,68,0.22)' : 'rgba(255,45,120,0.22)',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 2.5,
                    borderColor: noDriverFinal ? C.red : C.pink,
                    elevation: 12,
                    shadowColor: noDriverFinal ? C.red : C.pink,
                    shadowOpacity: 0.5, shadowRadius: 18,
                  }}>
                    <VehicleGlyph vehicleType={rideType} size={54} />
                  </View>
                </View>

                {/* Title */}
                <Text style={{ fontSize: 19, fontWeight: '900', color: noDriverFinal ? '#FDA4AF' : '#fff', textAlign: 'center', marginTop: 8 }}>
                  {noDriverFinal ? '😔 No Buddy Found' : 'Summoning Sppero Buddy'}
                </Text>

                {/* Search phase subtitle */}
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4, textAlign: 'center', paddingHorizontal: 16 }}>
                  {noDriverFinal
                    ? 'Try another vehicle or wait a moment'
                    : searchElapsed < 25
                      ? 'Requesting nearby drivers within 5km…'
                      : searchElapsed < 55
                        ? 'Expanding search radius to 10km…'
                        : 'Searching all available drivers up to 15km…'}
                </Text>

                {/* Fare + vehicle pill */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20,
                    paddingHorizontal: 14, paddingVertical: 7,
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
                  }}>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{VEHICLE_LABELS[rideType] || rideType}</Text>
                    <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.30)' }} />
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#FFD580' }}>{surgeFare || rideData?.fare}</Text>
                    {surgeCount > 0 && (
                      <View style={{ backgroundColor: '#FFD580', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 }}>
                        <Text style={{ color: '#000', fontSize: 8, fontWeight: '900' }}>⚡ {surgeCount}×</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              </View>

              {/* ── Search progress bar (hidden when no driver final) ── */}
              {!noDriverFinal && (
                <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 }}>
                  <View style={{ height: 9, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 5, overflow: 'hidden', shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 6 }}>
                    <Animated.View style={{
                      height: '100%', borderRadius: 5,
                      width: surgeBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                      backgroundColor: surgeBarAnim.interpolate({
                        inputRange: [0, 0.55, 0.78, 1],
                        outputRange: [C.green, C.yellow, C.saffron, C.pink],
                      }),
                    }} />
                  </View>
                  <Text style={{ fontSize: 10, color: C.textMuted, textAlign: 'right', marginTop: 5 }}>
                    {searchElapsed}s elapsed
                  </Text>
                </View>
              )}

              {/* ── Surge price slider ── */}
              {serverSurgeOffer && !noDriverFinal && (
                <SurgePriceSlider
                  offer={serverSurgeOffer}
                  baseFare={parseInt(String(rideData?.fare ?? '0').replace(/[^\d]/g, '')) || 0}
                  onSelect={(amt) => surgeFareNow(amt)}
                  onDecline={() => setServerSurgeOffer(null)}
                  surging={surging}
                />
              )}

              {/* ── Alt vehicle suggest ── */}
              {altSuggest && altSuggest.alternatives.length > 0 && !noDriverFinal && (
                <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
                  <View style={{ backgroundColor: C.yellowGlass, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: C.yellowBorder }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.yellow, marginBottom: 10 }}>
                      No {altSuggest.current_type?.toUpperCase()} available — switch vehicle?
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {altSuggest.alternatives.map((alt: string) => (
                        <Bouncy key={alt} onPress={() => switchVehicle(alt)} disabled={switchingVehicle}
                          style={{ backgroundColor: switchingVehicle ? C.glass : C.pink, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <VehicleGlyph vehicleType={alt} size={20} />
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{VEHICLE_LABELS[alt] || alt}</Text>
                        </Bouncy>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* ── Tips carousel (hidden when surge card or no driver final) ── */}
              {!serverSurgeOffer && !noDriverFinal && <TipsCarousel />}

              {/* ── No driver final — alternatives + retry ── */}
              {noDriverFinal && (
                <SlideUp>
                  <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
                    <View style={{ alignItems: 'center', marginBottom: 4 }}>
                      <IlluNoDriver width={220} height={190} />
                    </View>
                    <View style={{ backgroundColor: C.redGlass, borderRadius: 16, padding: 18, borderWidth: 1.5, borderColor: C.redBorder, alignItems: 'center' }}>
                      <Text style={{ color: C.red, fontSize: 14, fontWeight: '900', textAlign: 'center', marginBottom: 4 }}>
                        No driver found in this area
                      </Text>
                      <Text style={{ color: C.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 14 }}>
                        Try another vehicle or retry in a few minutes
                      </Text>
                      {noDriverFinal.alternatives.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14 }}>
                          {noDriverFinal.alternatives.map((alt: string) => (
                            <Bouncy key={alt} onPress={() => { setNoDriverFinal(null); switchVehicle(alt); }} disabled={switchingVehicle}
                              style={{ backgroundColor: switchingVehicle ? C.glass : C.pink, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <VehicleGlyph vehicleType={alt} size={20} />
                              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{VEHICLE_LABELS[alt] || alt}</Text>
                            </Bouncy>
                          ))}
                        </View>
                      )}
                      <RetryTimer
                        seconds={noDriverFinal.retry_after_sec}
                        onRetry={() => { setNoDriverFinal(null); setServerSurgeOffer(null); if (rideData?.ride_id) bookRide(); }}
                      />
                      {/* The search has already stopped server-side at this point (the
                          ride is auto-cancelled once no driver is found), so this just
                          takes the customer home — same action as the header back
                          button already does here, just visible without scrolling. */}
                      <Bouncy
                        onPress={() => setScreen('home')}
                        style={{ marginTop: 10, paddingHorizontal: 24, paddingVertical: 10 }}>
                        <Text style={{ color: C.textMuted, fontWeight: '700', fontSize: 13 }}>✕ Cancel</Text>
                      </Bouncy>
                    </View>
                  </View>
                </SlideUp>
              )}

              {/* ── Cancel info + action buttons ── */}
              <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
                <Text style={{ textAlign: 'center', fontSize: 11, color: C.textMuted, marginBottom: 10 }}>
                  {cancelTimer > 0
                    ? `✅ Free cancel for ${cancelTimer}s · ${freeCancelsLeft} free cancels today`
                    : `⚠️ ₹10 cancel fee · ${freeCancelsLeft} free cancels today`}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Bouncy onPress={() => setShowCancelModal(true)} style={{
                    flex: 1, backgroundColor: C.pinkGlass, borderRadius: 12,
                    paddingVertical: 13, alignItems: 'center',
                    borderWidth: 1.5, borderColor: C.pinkBorder,
                  }}>
                    <Text style={{ color: C.pink, fontWeight: '800', fontSize: 13 }}>
                      ✕ Cancel {cancelInfo ? (cancelInfo.is_free ? '(Free)' : `(₹${cancelInfo.fee})`) : cancelTimer > 0 ? '(Free)' : '(₹10)'}
                    </Text>
                  </Bouncy>
                  <Bouncy onPress={async () => {
                    if (rideData?.ride_id) {
                      try { await authRideCancel({ ride_id: rideData.ride_id, cancelled_by: 'customer', reason: 'Retry' }); } catch (_e) {}
                    }
                    setRideData(null); bookRide();
                  }} style={{
                    flex: 1, backgroundColor: C.glass, borderRadius: 12,
                    paddingVertical: 13, alignItems: 'center',
                    borderWidth: 1, borderColor: C.glassBorder,
                  }}>
                    <Text style={{ color: C.text, fontWeight: '800', fontSize: 13 }}>🔄 Retry</Text>
                  </Bouncy>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

// ── Cancel modal — full sheet ──────────────────────────────────────────────
function CancelModal() {
  const {
    phone,
    cancelTimer,
    cancelInfo,
    rideData, setRideData,
    setShowCancelModal, setScreen,
    resetBookingState,
    setAltSuggest, setDriverLoc, setResult,
    loadWallet,
  } = useApp();

  const { useRideStore } = require('../../store');
  const ride = useRideStore();
  const { bottom: bottomInset } = useSafeAreaInsets();

  const isFree = cancelInfo ? cancelInfo.is_free : cancelTimer > 0;
  const fee        = cancelInfo?.fee ?? (cancelTimer > 0 ? 0 : 10);
  const waitSec    = cancelInfo?.driver_wait_sec ?? 0;
  const waitMin    = Math.floor(waitSec / 60);
  const waitSecRem = waitSec % 60;

  const doCancel = async (reason: string) => {
    if (rideData?.ride_id) {
      const cd = await authRideCancel({ ride_id: rideData.ride_id, cancelled_by: 'customer', reason, phone: phone || '9999999999' });
      if (cd._error) setResult('❌ ' + cd.message);
      else {
        setResult(cd.penalty > 0 ? `⚠️ ${cd.message}` : `✅ ${cd.message}`);
        // Penalty is charged straight to the wallet server-side now — refresh
        // so the balance shown in-app reflects it immediately.
        if (cd.penalty > 0) loadWallet(phone || '9999999999').catch(() => {});
      }
      ride.clearRide();
      AsyncStorage.removeItem('activeStdRideId').catch(() => {});
    }
    setShowCancelModal(false); setScreen('home'); setRideData(null);
    resetBookingState();
    setAltSuggest(null); setDriverLoc(null);
  };

  const REASONS = ['Booked by mistake', 'Waiting too long', 'Plans changed', 'Driver is too far', 'Other reason'];

  return (
    <View style={s.screen}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 14 + bottomInset }}>

          {/* Handle */}
          <View style={{ width: 40, height: 4, backgroundColor: C.glassBorder, borderRadius: 2, alignSelf: 'center', marginTop: 12 }} />

          {/* Illustration header */}
          <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 8 }}>
            <IlluCancel width={200} height={128} />
            <Text style={{ fontSize: 20, fontWeight: '900', color: C.text, letterSpacing: -0.4, marginTop: 6 }}>Cancel Ride?</Text>
            <Text style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>Select a reason to proceed</Text>
          </View>

          <View style={{ paddingHorizontal: 18 }}>

            {/* Free / fee badge */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: isFree ? C.greenGlass : C.yellowGlass,
              borderRadius: 14, padding: 14,
              marginBottom: waitSec > 0 ? 10 : 14,
              borderWidth: 1.5, borderColor: isFree ? C.greenBorder : C.yellowBorder,
            }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: isFree ? 'rgba(5,150,105,0.12)' : 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={isFree ? 'checkmark-circle' : 'warning'} size={20} color={isFree ? C.green : C.yellow} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: isFree ? C.green : C.yellow, fontWeight: '800' }}>
                  {isFree ? 'Free Cancellation' : `₹${fee} Cancellation Fee`}
                </Text>
                <Text style={{ fontSize: 11, color: isFree ? C.green : C.yellow, opacity: 0.75, marginTop: 2 }}>
                  {isFree
                    ? `${cancelInfo ? cancelInfo.sec_since_book + 's' : cancelTimer + 's'} since booking — no charge`
                    : 'Fee applies as window has passed'}
                </Text>
              </View>
            </View>

            {/* Driver waiting warning */}
            {waitSec > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.redGlass, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1.5, borderColor: C.redBorder }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="time" size={20} color={C.red} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.red }}>Driver waiting {waitMin}m {waitSecRem}s</Text>
                  {!isFree && <Text style={{ fontSize: 11, color: C.red, marginTop: 2, opacity: 0.75 }}>Longer wait increases the fee</Text>}
                </View>
              </View>
            )}

            {/* Reasons */}
            <Text style={{ fontSize: 11, fontWeight: '900', color: C.textDim, letterSpacing: 1.3, marginBottom: 10 }}>REASON FOR CANCELLING</Text>
            {REASONS.map((reason, i) => (
              <TouchableOpacity key={i}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.glass, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1, borderColor: C.glassBorder }}
                onPress={() => doCancel(reason)}
                activeOpacity={0.7}>
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.glassBorder }} />
                <Text style={{ fontSize: 14, color: C.text, fontWeight: '600', flex: 1 }}>{reason}</Text>
                <Ionicons name="chevron-forward" size={15} color={C.textDim} />
              </TouchableOpacity>
            ))}

            {/* Keep ride — pink primary */}
            <TouchableOpacity
              style={{ backgroundColor: C.pink, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 6, elevation: 6, shadowColor: C.pink, shadowOpacity: 0.38, shadowRadius: 12 }}
              onPress={() => setShowCancelModal(false)}
              activeOpacity={0.85}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.2 }}>Keep My Ride →</Text>
            </TouchableOpacity>

          </View>
        </View>
      </View>
    </View>
  );
}
