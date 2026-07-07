import { useRef, useEffect, useState } from 'react';
import { Animated, Dimensions, Linking, Platform, ScrollView, Share, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Storage as AsyncStorage } from '../storage';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, GlassPanel, PulseView, SlideUp } from '../components/ui';
import { LiveMap } from '../components/LiveMap';
import { s, C, T, SP, R, SHADOW } from '../styles';
import { apiPost } from '../../api';
import { API } from '../constants';

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

// ── Countdown timer for "retry after" ──────────────────────────────────────
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
          {mins > 0 ? `${mins} min ` : ''}{secs}s until retry
        </Text>
      )}
      <Bouncy
        onPress={onRetry}
        style={{
          backgroundColor: remaining > 0 ? C.glass : C.pink,
          borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12,
          borderWidth: 1, borderColor: remaining > 0 ? C.glassBorder : C.pink,
        }}>
        <Text style={{ color: remaining > 0 ? C.textDim : '#fff', fontWeight: '900', fontSize: 14 }}>
          {remaining > 0 ? `🔄 ${mins > 0 ? `${mins}m ` : ''}${secs}s to retry` : '🔄 Retry Now'}
        </Text>
      </Bouncy>
    </View>
  );
}

const VEHICLE_LABELS: Record<string, string> = {
  bike: 'Bike', auto: 'Auto', car: 'Car', eriksha: 'E-Riksha',
  green_bike: 'Green Bike', electric_auto: 'Electric Auto', luxury: 'Luxury',
};
const V_ICONS: Record<string, string> = {
  auto: '🛺', car: '🚕', bike: '🏍️', eriksha: '🛵', luxury: '🚙', green_bike: '⚡', electric_auto: '🌿',
};

// ── 4-statement flip banner shown when driver is matched ───────────────────
function BuddyMessages({ visible }: { visible: boolean }) {
  const CARDS = [
    { border: C.pinkBorder, bg: C.pinkGlass, icon: '🤝', text: 'Sppero Buddy is connected' },
    { border: C.plumBorder, bg: C.plumGlass, icon: '🛡️', text: 'Sppero Buddy dedicated to your ride' },
    { border: C.glassBorder, bg: C.glass, icon: '💬', text: 'Keep patience and talk' },
    { border: C.greenBorder, bg: C.greenGlass, icon: '✨', text: 'Make safe and good journey' },
  ];
  const [idx, setIdx] = useState(0);
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const iv = setInterval(() => {
      Animated.timing(flipAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        setIdx(p => (p + 1) % CARDS.length);
        flipAnim.setValue(-1);
        Animated.timing(flipAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      });
    }, 3200);
    return () => clearInterval(iv);
  }, [visible]);

  const rotateX = flipAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-90deg', '0deg', '90deg'],
  });
  const card = CARDS[idx];
  return (
    <Animated.View style={{
      marginHorizontal: 20, marginTop: 6, marginBottom: 6,
      backgroundColor: card.bg, borderRadius: 12,
      borderWidth: 1.5, borderColor: card.border,
      paddingVertical: 11, paddingHorizontal: 16,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      transform: [{ perspective: 700 }, { rotateX }],
    }}>
      <Text style={{ fontSize: 20 }}>{card.icon}</Text>
      <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', flex: 1 }}>{card.text}</Text>
    </Animated.View>
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

// ── Inline surge boost card — shown when backend emits surge_offer ─────────
function SurgeOfferCard({
  offer, onAccept, onDecline,
}: {
  offer: { amt: number; label: string; timeout_sec: number };
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [remaining, setRemaining] = useState(offer.timeout_sec);
  const countdownAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim     = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(countdownAnim, { toValue: 0, duration: offer.timeout_sec * 1000, useNativeDriver: false }).start();
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.03, duration: 650, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 650, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const urgent = remaining < 7;

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }], marginHorizontal: 20, marginBottom: 12 }}>
      <View style={{
        backgroundColor: urgent ? C.redGlass : C.saffGlass,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: urgent ? C.red : C.saffron,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: urgent ? C.red : C.saffron,
        shadowOpacity: 0.35,
        shadowRadius: 14,
      }}>
        {/* Animated countdown bar */}
        <View style={{ height: 4, backgroundColor: 'rgba(0,0,0,0.12)', overflow: 'hidden' }}>
          <Animated.View style={{
            height: '100%',
            width: countdownAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            backgroundColor: urgent ? C.red : C.saffron,
          }} />
        </View>

        <View style={{ padding: 16 }}>
          {/* Header row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <View style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: urgent ? C.redGlass : C.saffGlass,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: urgent ? C.red : C.saffron,
            }}>
              <Text style={{ fontSize: 22 }}>⚡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: urgent ? C.red : C.saffron }}>
                Boost your ride request
              </Text>
              <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                Pay {offer.label} more — attract drivers faster
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 26, fontWeight: '900', color: urgent ? C.red : C.saffron, lineHeight: 28 }}>{remaining}</Text>
              <Text style={{ fontSize: 8, color: C.textMuted, letterSpacing: 0.5 }}>SEC LEFT</Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={onDecline}
              style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: C.glassMid, borderWidth: 1, borderColor: C.glassBorder }}>
              <Text style={{ color: C.textMuted, fontWeight: '700', fontSize: 12 }}>Keep Waiting</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onAccept}
              style={{ flex: 2, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: urgent ? C.red : C.saffron, elevation: 6, shadowColor: urgent ? C.red : C.saffron, shadowOpacity: 0.45, shadowRadius: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>Accept {offer.label} Boost ⚡</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
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
  const {
    phone,
    screen, setScreen,
    pickup, setPickup, drop, setDrop,
    pickupCoords, dropCoords, setPickupCoords, setDropCoords,
    eta, setEta,
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

  const etaMins        = etaRemaining > 0 ? Math.ceil(etaRemaining / 60) : 0;
  const etaDisplay     = !etaRemaining ? (driverEta || '...') : etaMins <= 1 ? '< 1 min' : `${etaMins} min`;
  const etaColor       = !etaRemaining ? C.textMuted : etaMins <= 2 ? C.green : etaMins <= 5 ? C.yellow : C.text;

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
        <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 28, lineHeight: 20 }}>Aapke liye naya driver dhundh rahe hain...</Text>
        <TouchableOpacity
          onPress={() => setDriverCancelPopup(false)}
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
        />

        {/* Minimal top overlay — back button + chat toast */}
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          paddingTop: (StatusBar.currentHeight ?? 28) + 8,
          paddingHorizontal: 16, paddingBottom: 10,
          flexDirection: 'row', alignItems: 'center', gap: 10,
        }}>
          <TouchableOpacity
            onPress={() => setShowCancelModal(true)}
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
        height: sheetH,
        backgroundColor: C.bg,
        borderTopLeftRadius: OVERLAP,
        borderTopRightRadius: OVERLAP,
        marginTop: -OVERLAP,
        elevation: 24,
        shadowColor: '#000',
        shadowOpacity: 0.30,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -4 },
      }}>
        {/* Drag pill */}
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassMid }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >

          {/* ═══════════════ DRIVER ASSIGNED STATE ═══════════════ */}
          {rideData?.driver ? (
            <>
              {!driverArrived && <BuddyMessages visible />}

              {/* ══ ETA HERO — animated ring + status ══ */}
              <View style={{ alignItems: 'center', paddingTop: 18, paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.glassBorder }}>
                <EtaRing etaMins={etaMins} etaColor={etaColor} driverArrived={driverArrived} />

                <Text style={{ fontSize: 19, fontWeight: '900', color: driverArrived ? C.green : C.text, marginTop: 14, textAlign: 'center' }}>
                  {driverArrived ? 'Sppero Buddy Has Arrived!' : `Pickup in ${etaDisplay}`}
                </Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 5, textAlign: 'center' }}>
                  {driverArrived
                    ? 'Walk to your pickup point and show OTP'
                    : driverDist ? `Your Buddy is ${driverDist} away` : 'Sppero Buddy is on the way…'}
                </Text>

                {/* Wait timer pill when driver has arrived */}
                {driverArrived && (
                  <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: freeSecLeft > 0 ? C.greenGlass : C.redGlass, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1.5, borderColor: freeSecLeft > 0 ? C.greenBorder : C.redBorder }}>
                    <Ionicons name={freeSecLeft > 0 ? 'time-outline' : 'warning'} size={14} color={freeSecLeft > 0 ? C.green : C.red} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: freeSecLeft > 0 ? C.green : C.red }}>
                      {freeSecLeft > 0
                        ? `Free wait: ${Math.floor(freeSecLeft / 60)}m ${String(freeSecLeft % 60).padStart(2, '0')}s left`
                        : `Wait charge active: +₹${waitFareAdd}`}
                    </Text>
                  </View>
                )}
              </View>

              {/* ══ OTP CARD — prominent digit boxes with pop-in ══ */}
              {rideData.startOtp ? (
                <View style={{ marginHorizontal: 20, marginTop: 14 }}>
                  <View style={{
                    backgroundColor: C.plumGlass, borderRadius: 20,
                    borderWidth: 2, borderColor: C.plumBorder,
                    paddingVertical: 18, paddingHorizontal: 20, alignItems: 'center',
                    elevation: 8, shadowColor: C.plum, shadowOpacity: 0.25, shadowRadius: 16,
                  }}>
                    <Text style={{ fontSize: 9, fontWeight: '900', color: C.plum, letterSpacing: 1.6, marginBottom: 14 }}>
                      RIDE PIN — SHOW TO DRIVER TO START TRIP
                    </Text>
                    <OtpDisplay otp={String(rideData.startOtp)} />
                  </View>
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
                </View>

                {/* Thin divider */}
                <View style={{ height: 1, backgroundColor: C.glassBorder, marginHorizontal: 16 }} />

                {/* Chat + Call buttons row */}
                <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
                  <Animated.View style={{ flex: 1, transform: [{ scale: chatBounceAnim }] }}>
                    <TouchableOpacity
                      onPress={() => { setUnreadChat(0); setChatOrigin('matching'); setScreen('chat'); }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 13, backgroundColor: unreadChat > 0 ? C.plumGlass : C.glassMid, borderWidth: 1.5, borderColor: unreadChat > 0 ? C.plumBorder : C.glassBorder }}>
                      <Ionicons name="chatbubble" size={16} color={unreadChat > 0 ? C.plum : C.textMuted} />
                      <Text style={{ fontSize: 13, fontWeight: '800', color: unreadChat > 0 ? C.plum : C.textMuted }}>
                        {unreadChat > 0 ? `Chat (${unreadChat})` : 'Chat'}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                  <TouchableOpacity
                    onPress={callDriver}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 13, backgroundColor: 'rgba(34,197,94,0.10)', borderWidth: 1.5, borderColor: C.greenBorder }}>
                    <Ionicons name="call" size={16} color={C.green} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: C.green }}>Call</Text>
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
                    {waitFareAdd > 0 ? `₹${newFare}` : (surgeFare || rideData.fare)}
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

                <TouchableOpacity onPress={() => setShowCancelModal(true)} style={{ flex: 1, backgroundColor: C.pinkGlass, borderRadius: 13, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: C.pinkBorder }}>
                  <Ionicons name="close" size={15} color={C.pink} />
                  <Text style={{ color: C.pink, fontSize: 12, fontWeight: '700' }}>Cancel</Text>
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
              {/* ── Hero: radar rings + vehicle icon + status ── */}
              <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 6 }}>
                {/* Radar + icon */}
                <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
                  <RadarPulse active={!noDriverFinal} />
                  <View style={{
                    width: 76, height: 76, borderRadius: 38,
                    backgroundColor: noDriverFinal ? C.redGlass : C.pinkGlass,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 2.5,
                    borderColor: noDriverFinal ? C.red : C.pink,
                    elevation: 12,
                    shadowColor: noDriverFinal ? C.red : C.pink,
                    shadowOpacity: 0.5, shadowRadius: 18,
                  }}>
                    <Text style={{ fontSize: 38 }}>{V_ICONS[rideType] || '🚗'}</Text>
                  </View>
                </View>

                {/* Title */}
                <Text style={{ fontSize: 19, fontWeight: '900', color: noDriverFinal ? C.red : C.text, textAlign: 'center', marginTop: 8 }}>
                  {noDriverFinal ? '😔 No Buddy Found' : 'Summoning Sppero Buddy'}
                </Text>

                {/* Search phase subtitle */}
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 4, textAlign: 'center' }}>
                  {noDriverFinal
                    ? 'Try another vehicle or wait a moment'
                    : searchElapsed < 25
                      ? 'Requesting nearby drivers within 5km…'
                      : searchElapsed < 55
                        ? 'Expanding search radius to 10km…'
                        : 'Searching all available drivers up to 15km…'}
                </Text>

                {/* Fare + vehicle pill */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: C.bgCard, borderRadius: 20,
                    paddingHorizontal: 14, paddingVertical: 7,
                    borderWidth: 1, borderColor: C.glassBorder,
                    elevation: 3, shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 6,
                  }}>
                    <Text style={{ fontSize: 12, color: C.textMuted }}>{VEHICLE_LABELS[rideType] || rideType}</Text>
                    <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.glassBorder }} />
                    <Text style={{ fontSize: 16, fontWeight: '900', color: C.yellow }}>{surgeFare || rideData?.fare}</Text>
                    {surgeCount > 0 && (
                      <View style={{ backgroundColor: C.yellow, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 }}>
                        <Text style={{ color: '#000', fontSize: 8, fontWeight: '900' }}>⚡ {surgeCount}×</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* ── Search progress bar (hidden when no driver final) ── */}
              {!noDriverFinal && (
                <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14 }}>
                  <View style={{ height: 5, backgroundColor: C.glassMid, borderRadius: 3, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder }}>
                    <Animated.View style={{
                      height: '100%', borderRadius: 3,
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

              {/* ── Inline surge boost card ── */}
              {serverSurgeOffer && !noDriverFinal && (
                <SurgeOfferCard
                  offer={serverSurgeOffer}
                  onAccept={() => surgeFareNow(serverSurgeOffer!.amt)}
                  onDecline={() => setServerSurgeOffer(null)}
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
                          <Text style={{ fontSize: 14 }}>{V_ICONS[alt] || '🚗'}</Text>
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
                              <Text style={{ fontSize: 14 }}>{V_ICONS[alt] || '🚗'}</Text>
                              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{VEHICLE_LABELS[alt] || alt}</Text>
                            </Bouncy>
                          ))}
                        </View>
                      )}
                      <RetryTimer
                        seconds={noDriverFinal.retry_after_sec}
                        onRetry={() => { setNoDriverFinal(null); setServerSurgeOffer(null); if (rideData?.ride_id) bookRide(); }}
                      />
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
                      try { await apiPost('/api/rides/cancel-smart', { ride_id: rideData.ride_id, cancelled_by: 'customer', reason: 'Retry' }); } catch (_e) {}
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
    setPickup, setDrop, setPickupCoords, setDropCoords, setEta,
    setAltSuggest, setDriverLoc, setResult,
  } = useApp();

  const { useRideStore } = require('../../store');
  const ride = useRideStore();

  const isFree = cancelInfo ? cancelInfo.is_free : cancelTimer > 0;
  const fee    = cancelInfo?.fee ?? (cancelTimer > 0 ? 0 : 10);
  const waitSec    = cancelInfo?.driver_wait_sec ?? 0;
  const waitMin    = Math.floor(waitSec / 60);
  const waitSecRem = waitSec % 60;

  return (
    <View style={s.screen}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' }}>
        <GlassPanel intensity={24} style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34 }}>
          <View style={s.sheetHandle} />
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 8 }}>Cancel Ride?</Text>
          <View style={{
            backgroundColor: isFree ? C.greenGlass : C.yellowGlass, borderRadius: 12, padding: 12,
            marginBottom: waitSec > 0 ? 8 : 16, borderWidth: 1, borderColor: isFree ? C.greenBorder : C.yellowBorder,
          }}>
            <Text style={{ fontSize: 13, color: isFree ? C.green : C.yellow, fontWeight: '700' }}>
              {isFree
                ? `✅ Cancel is FREE right now${cancelInfo ? ` (${cancelInfo.sec_since_book}s since booking)` : ` (${cancelTimer}s left)`}`
                : `⚠️ Cancel fee ₹${fee} applies`}
            </Text>
          </View>
          {waitSec > 0 && (
            <View style={{ backgroundColor: C.redGlass, borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: C.redBorder, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18 }}>⏱️</Text>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '800', color: C.red }}>Driver has been waiting {waitMin}m {waitSecRem}s</Text>
                {!isFree && <Text style={{ fontSize: 11, color: C.red, marginTop: 2, opacity: 0.7 }}>Longer wait = higher fee</Text>}
              </View>
            </View>
          )}
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.textMuted, marginBottom: 10 }}>Reason for cancelling?</Text>
          {['Booked by mistake', 'Waiting too long', 'Plans changed', 'Driver is too far', 'Other reason'].map((reason, i) => (
            <TouchableOpacity key={i}
              style={{ backgroundColor: C.glass, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.glassBorder }}
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
              <Text style={{ fontSize: 14, color: C.text, fontWeight: '500' }}>{reason}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={{ borderWidth: 1.5, borderColor: C.glassBorder, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 8, backgroundColor: C.glass }}
            onPress={() => setShowCancelModal(false)}>
            <Text style={{ color: C.text, fontWeight: '800', fontSize: 14 }}>No, keep my ride</Text>
          </TouchableOpacity>
        </GlassPanel>
      </View>
    </View>
  );
}
