import { useRef, useEffect, useState } from 'react';
import { Animated, Dimensions, Linking, Platform, ScrollView, Share, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Storage as AsyncStorage } from '../storage';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, DotBG, FadeIn, FloatingDots, GlassPanel, PulseView, SlideUp, SuccessBurst, TripSteps } from '../components/ui';
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

// ── Live ETA Countdown ──────────────────────────────────────────────────────
function ETACountdown({ etaText, distText, arrived }: { etaText: string; distText: string; arrived: boolean }) {
  const [remaining, setRemaining] = useState(() => parseEtaSec(etaText));
  const totalRef = useRef(parseEtaSec(etaText));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;

  // Smooth depleting bar — spring to new pct on each tick
  useEffect(() => {
    const pct = Math.max(0, Math.min(1, remaining / (totalRef.current || 1)));
    Animated.timing(progressAnim, { toValue: pct, duration: 900, useNativeDriver: false }).start();
  }, [remaining]);

  // Re-sync ETA when it updates from the API (only if difference > 30s to avoid jitter)
  useEffect(() => {
    if (arrived) return;
    const parsed = parseEtaSec(etaText);
    if (parsed > 0) {
      setRemaining(r => {
        if (r === 0 || Math.abs(parsed - r) > 30) {
          totalRef.current = parsed;
          return parsed;
        }
        return r;
      });
    }
  }, [etaText, arrived]);

  // Tick every second
  useEffect(() => {
    if (arrived) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining(r => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [arrived]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const total = totalRef.current || 1;
  const pct   = Math.max(0, Math.min(1, remaining / total));
  const color = arrived || remaining === 0 ? C.green : remaining <= 60 ? C.red : remaining <= 120 ? C.yellow : C.green;

  if (arrived || remaining === 0) {
    return (
      <View style={{ backgroundColor: C.greenGlass, borderRadius: 20, padding: 18, marginBottom: 10, alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: C.greenBorder }}>
        <Text style={{ fontSize: 32 }}>✅</Text>
        <Text style={{ color: C.green, fontSize: 17, fontWeight: '900' }}>Driver Aa Gaya!</Text>
        <Text style={{ color: C.green, fontSize: 12, textAlign: 'center', opacity: 0.7 }}>OTP share karke trip shuru karo</Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: color + '12', borderRadius: 20, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: color + '30' }}>
      {/* Depleting progress strip — animated */}
      <View style={{ height: 3, backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
        <Animated.View style={{ width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), height: '100%', backgroundColor: color, borderRadius: 2 }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: color + '18', borderWidth: 2, borderColor: color + '30', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 28 }}>🚗</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            driver pahunch raha hai
          </Text>
          <Text style={{ color: color, fontSize: 40, fontWeight: '900', letterSpacing: 1, lineHeight: 48, marginTop: 1 }}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </Text>
          {distText ? (
            <Text style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{distText} door • real-time</Text>
          ) : null}
        </View>
        <PulseView><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} /></PulseView>
      </View>
    </View>
  );
}

// ── OTP digit pop-in animation ───────────────────────────────────────────────
function OtpDisplay({ otp }: { otp: string | number }) {
  const digits = String(otp).split('');
  const anims = useRef(digits.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    anims.forEach(a => a.setValue(0));
    Animated.stagger(130, anims.map(a =>
      Animated.spring(a, { toValue: 1, friction: 4, tension: 260, useNativeDriver: true })
    )).start();
  }, [String(otp)]);

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {digits.map((digit, i) => (
        <Animated.View key={i} style={{
          width: 52, height: 68, backgroundColor: C.plumGlass, borderRadius: R.sm,
          borderWidth: 2, borderColor: C.plumBorder, alignItems: 'center', justifyContent: 'center',
          elevation: 3, shadowColor: C.plum, shadowOpacity: 0.12, shadowRadius: 8,
          opacity: anims[i],
          transform: [{
            scale: anims[i].interpolate({ inputRange: [0, 0.65, 0.88, 1], outputRange: [0, 1.28, 0.9, 1] }),
          }],
        }}>
          <Text style={{ fontSize: 30, fontWeight: '900' as const, color: C.plum, letterSpacing: 0 }}>{digit}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

// ── Countdown timer with retry button ───────────────────────────────────────
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
      {remaining > 0 ? (
        <Text style={{ color: C.textMuted, fontSize: 13 }}>
          {mins > 0 ? `${mins} min ` : ''}{secs}s baad retry ho sakta hai
        </Text>
      ) : null}
      <Bouncy
        onPress={onRetry}
        style={{
          backgroundColor: remaining > 0 ? C.glass : C.pink,
          borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12,
          borderWidth: 1, borderColor: remaining > 0 ? C.glassBorder : C.pink,
        }}>
        <Text style={{ color: remaining > 0 ? C.textDim : '#fff', fontWeight: '900', fontSize: 14 }}>
          {remaining > 0 ? `🔄 ${mins > 0 ? `${mins}m ` : ''}${secs}s baad retry` : '🔄 Abhi Retry Karo'}
        </Text>
      </Bouncy>
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
  } = useApp();

  // SuccessBurst auto-hide after 2s
  const [showBurst, setShowBurst] = useState(true);
  useEffect(() => {
    if (!rideData?.driver) { setShowBurst(true); return; }
    setShowBurst(true);
    const t = setTimeout(() => setShowBurst(false), 2000);
    return () => clearTimeout(t);
  }, [rideData?.driver?.id ?? rideData?.driver]);

  if (showCancelModal) return <CancelModal />;

  const getDriverLevel = (rating: number) => {
    if (rating >= 4.8) return { emoji: '💎', name: 'Platinum', color: '#9C27B0', bg: 'rgba(156,39,176,0.1)', border: 'rgba(156,39,176,0.3)' };
    if (rating >= 4.7) return { emoji: '🥇', name: 'Gold', color: '#B45309', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.35)' };
    if (rating >= 4.5) return { emoji: '🥈', name: 'Silver', color: '#475569', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)' };
    return { emoji: '🥉', name: 'Bronze', color: '#92400E', bg: 'rgba(205,127,50,0.1)', border: 'rgba(205,127,50,0.3)' };
  };

  // Wait fare locals (derived from cancelInfo — separate system from cancel fee)
  const driverArrived = cancelInfo?.driver_status === 'arrived';
  const driverWaitSec = cancelInfo?.driver_wait_sec ?? 0;
  const waitFareAdd = cancelInfo?.wait_fare_add ?? 0;
  const waitFareFreeMin = cancelInfo?.wait_fare_free_min ?? 3;
  const waitMin = Math.floor(driverWaitSec / 60);
  const waitSecRem = driverWaitSec % 60;
  const freeSecLeft = Math.max(0, waitFareFreeMin * 60 - driverWaitSec);
  const origFare = cancelInfo?.wait_fare_orig ?? 0;
  const newFare = cancelInfo?.wait_fare_new_total ?? origFare;

  const HEADER_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 40 : 84;
  const SEARCH_H = 262;
  const MAP_H    = 240 + HEADER_H;

  return (
    <View style={s.screen}>
      {/* Hero: SearchAnim when searching, LiveMap when driver assigned */}
      <View style={{ height: rideData?.driver ? MAP_H : SEARCH_H }}>
        {rideData?.driver ? (
          <LiveMap
            pickupCoords={pickupCoords}
            dropCoords={dropCoords}
            driverLat={driverLoc?.lat}
            driverLng={driverLoc?.lng}
            vehicleType={rideType}
            userLat={userCoords?.latitude || userCoords?.lat}
            userLng={userCoords?.longitude || userCoords?.lng}
            userAccuracy={(userCoords as any)?.accuracy}
            height={MAP_H}
            mode="matching"
            showRoute={true}
            followDriver={true}
            showTraffic={false}
          />
        ) : (
          <SearchAnim emoji={rideIcon(rideType)} label={VEHICLE_LABELS[rideType] || (rideType || '').replace(/_/g, ' ')} />
        )}
        {/* Glass header — floats over SearchAnim (paper style) or LiveMap (pink tint) */}
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, overflow: 'hidden',
          backgroundColor: rideData?.driver ? 'rgba(233,30,99,0.10)' : 'rgba(244,239,227,0.88)',
          paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 8 : 46,
          paddingBottom: 10, paddingHorizontal: 16,
        }}>
          <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.06)', top: -55, right: -35 }} />
          <Text style={{
            fontSize: 17, fontWeight: '900',
            color: rideData?.driver ? '#fff' : '#2d1f0e',
            textShadowColor: rideData?.driver ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.5)',
            textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
          }}>{rideData?.driver ? '🚗 Driver Mil Gaya!' : '🔍 Driver Dhundh Rahe Hain'}</Text>
        </View>
      </View>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 8, paddingHorizontal: 16 }}>
        <TripSteps step={rideData?.driver ? 1 : 0} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {rideData?.driver ? (
            <>
              {showBurst && <SuccessBurst />}
              <FadeIn delay={300} style={{ alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: C.green, letterSpacing: 0.3 }}>Driver Mil Gaya! 🎉</Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>Aapka ride confirm ho gaya</Text>
              </FadeIn>
              <SlideUp>
                <View style={{
                  backgroundColor: C.bgCard,
                  borderRadius: R.lg,
                  marginBottom: 12,
                  overflow: 'hidden',
                  borderWidth: 1.5,
                  borderColor: C.pinkBorder,
                  ...SHADOW.md,
                  shadowColor: C.pink,
                }}>
                  {/* Pink header — ETA displayed prominently */}
                  <View style={{
                    backgroundColor: C.pinkGlass,
                    paddingHorizontal: SP.md,
                    paddingVertical: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottomWidth: 1,
                    borderBottomColor: C.pinkBorder,
                  }}>
                    <Text style={{ ...T.label, color: C.pink }}>DRIVER CONFIRMED</Text>
                    <PulseView>
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        backgroundColor: C.pink, borderRadius: R.full,
                        paddingHorizontal: 12, paddingVertical: 5,
                        elevation: 4, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 6,
                      }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>
                          {driverEta || (eta ? eta.split('·')[0].trim() : '...')}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.70)', fontSize: 9 }}>away</Text>
                      </View>
                    </PulseView>
                  </View>

                  {/* Avatar + driver info row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: SP.md, gap: SP.md }}>
                    {/* Avatar with pink ring + level badge */}
                    <View style={{ position: 'relative' }}>
                      <View style={{
                        width: 68, height: 68, borderRadius: 34,
                        borderWidth: 2.5, borderColor: C.pink,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: C.pinkGlass,
                      }}>
                        {rideData.driver.photo
                          ? <Image source={{ uri: rideData.driver.photo }} style={{ width: 63, height: 63, borderRadius: 31.5 }} />
                          : <Text style={{ color: C.pink, fontSize: 26, fontWeight: '900' }}>{(rideData.driver.name||'D')[0].toUpperCase()}</Text>
                        }
                      </View>
                      {(() => {
                        const rating = parseFloat(rideData.driver.rating || '4.8');
                        const lvl = getDriverLevel(rating);
                        return (
                          <View style={{
                            position: 'absolute', bottom: -3, right: -3,
                            width: 26, height: 26, borderRadius: 13,
                            backgroundColor: lvl.bg, borderWidth: 2, borderColor: C.bgCard,
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Text style={{ fontSize: 13 }}>{lvl.emoji}</Text>
                          </View>
                        );
                      })()}
                    </View>

                    {/* Driver info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ ...T.title, color: C.text }}>{rideData.driver.name}</Text>
                        {rideData.driver.verified && (
                          <View style={{ backgroundColor: C.greenGlass, borderRadius: R.xs, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C.greenBorder }}>
                            <Text style={{ fontSize: 9, color: C.green, fontWeight: '800' }}>✓ VERIFIED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ ...T.caption, color: C.textMuted, marginTop: 3 }}>
                        {[rideData.driver.vehicle_brand, rideData.driver.vehicle_model].filter(Boolean).join(' ')}
                        {rideData.driver.vehicle_no ? ` · ${rideData.driver.vehicle_no}` : ''}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(245,158,11,0.28)' }}>
                          <Text style={{ fontSize: 11 }}>⭐</Text>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: '#92400E' }}>
                            {rideData.driver.rating ? parseFloat(rideData.driver.rating).toFixed(1) : '4.8'}
                          </Text>
                        </View>
                        {driverDist && (
                          <Text style={{ ...T.caption, color: C.textDim }}>· {driverDist} away</Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              </SlideUp>
              <ETACountdown
                etaText={driverEta || ''}
                distText={driverDist || ''}
                arrived={driverArrived}
              />
              {rideData?.startOtp && (
                <View style={{
                  backgroundColor: C.bgCard, borderRadius: R.md, paddingHorizontal: SP.md, paddingVertical: SP.md,
                  alignItems: 'center', marginBottom: 12, borderWidth: 2, borderColor: C.plumBorder, ...SHADOW.md,
                }}>
                  <Text style={{ ...T.label, color: C.textMuted, marginBottom: 14 }}>🔐 DRIVER KO YEH OTP BATAO</Text>
                  <OtpDisplay otp={rideData.startOtp} />
                  <Text style={{ ...T.caption, color: C.textDim, marginTop: 10 }}>Trip start hone par driver dalega</Text>
                </View>
              )}
              <View style={{
                flexDirection: 'row',
                backgroundColor: C.bgCard,
                borderRadius: R.md,
                padding: SP.sm + SP.xs,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: C.glassBorder,
                ...SHADOW.sm,
              }}>
                {/* Chat */}
                <Bouncy style={{ flex: 1, alignItems: 'center', gap: 5 }} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.plumGlass, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.plumBorder }}>
                    <Ionicons name="chatbubble" size={20} color={C.plum} />
                    {unreadChat > 0 && <View style={s.chatBadge}><Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{unreadChat}</Text></View>}
                  </View>
                  <Text style={{ ...T.label, color: C.textMuted }}>Chat</Text>
                </Bouncy>

                {/* Call */}
                <Bouncy style={{ flex: 1, alignItems: 'center', gap: 5 }} onPress={callDriver}>
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.greenGlass, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.greenBorder }}>
                    <Ionicons name="call" size={20} color={C.green} />
                  </View>
                  <Text style={{ ...T.label, color: C.textMuted }}>Call</Text>
                </Bouncy>

                {/* Share */}
                <Bouncy style={{ flex: 1, alignItems: 'center', gap: 5 }} onPress={() => {
                  const d = rideData?.driver;
                  const trackUrl = `${API}/track/${rideData?.ride_id || ''}`;
                  const msg = `🚖 *Sppero — Live Tracking*\n\n` +
                    `Driver: ${d?.name || 'Assigned'} | ${d?.vehicle_no || ''}\n` +
                    (rideData?.startOtp ? `OTP: ${rideData.startOtp}\n` : '') +
                    `📍 From: ${pickup}\n🎯 To: ${drop}\n\n` +
                    `📡 *Live track karo:*\n${trackUrl}`;
                  Share.share({ message: msg, url: trackUrl, title: 'Sppero Live Tracking' }).catch(() => {
                    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
                  });
                }}>
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(59,130,246,0.07)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(59,130,246,0.22)' }}>
                    <Ionicons name="share-social" size={20} color="#3B82F6" />
                  </View>
                  <Text style={{ ...T.label, color: C.textMuted }}>Share</Text>
                </Bouncy>

                {/* SOS */}
                <Bouncy style={{ flex: 1, alignItems: 'center', gap: 5 }} onPress={triggerSOS}>
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.redGlass, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.redBorder }}>
                    <Ionicons name="warning" size={20} color={C.red} />
                  </View>
                  <Text style={{ ...T.label, color: C.red }}>SOS</Text>
                </Bouncy>
              </View>
              {chatToast && (
                <TouchableOpacity
                  style={{ backgroundColor: C.bgDark, borderRadius: R.sm, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.pinkBorder, elevation: 8 }}
                  onPress={() => { setChatToast(null); setUnreadChat(0); setScreen('chat'); }}>
                  <Ionicons name="chatbubble" size={16} color={C.pink} />
                  <Text style={{ color: '#fff', fontSize: 13, flex: 1, fontWeight: '600' }} numberOfLines={1}>{chatToast}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>Reply</Text>
                </TouchableOpacity>
              )}
              {!chatToast && unreadChat > 0 && (
                <TouchableOpacity style={s.chatAlert} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>💬 Driver ke {unreadChat} message — tap to read</Text>
                </TouchableOpacity>
              )}
              {sosActive && <View style={[s.infoBox, { backgroundColor: C.redGlass, borderColor: C.redBorder }]}><Text style={{ fontSize: 13, color: C.red, fontWeight: '800' }}>🆘 Alert bheja! Police: 100 · Ambulance: 108</Text></View>}

              {/* ─── Wait Timer — separate system ─── */}
              {driverArrived && driverWaitSec > 0 && (
                <View style={{
                  backgroundColor: waitFareAdd > 0 ? C.saffGlass : C.greenGlass,
                  borderRadius: 14, padding: 14, marginBottom: 10,
                  borderWidth: 1.5,
                  borderColor: waitFareAdd > 0 ? C.saffBorder : C.greenBorder,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 22 }}>⏳</Text>
                      <View>
                        <Text style={{ fontWeight: '800', fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Driver Wait Kar Raha Hai</Text>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: waitFareAdd > 0 ? C.saffron : C.green, marginTop: 2, letterSpacing: 0.5 }}>
                          {waitMin}m {waitSecRem}s
                        </Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: waitFareAdd > 0 ? C.saffron : C.green, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 }}>
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                        {waitFareAdd > 0 ? `+₹${waitFareAdd}` : 'FREE'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 7 }}>
                    <View style={{
                      height: '100%', borderRadius: 3,
                      width: `${Math.min(100, (driverWaitSec / (waitFareFreeMin * 60)) * 100)}%`,
                      backgroundColor: waitFareAdd > 0 ? C.saffron : C.green,
                    }} />
                  </View>
                  <Text style={{ fontSize: 11, color: C.textMuted, textAlign: 'center' }}>
                    {waitFareAdd > 0
                      ? `3 min free window khatam • ₹1/min wait charge lag raha`
                      : `${Math.floor(freeSecLeft / 60)}m ${freeSecLeft % 60}s baad ₹1/min shuru hoga`}
                  </Text>
                </View>
              )}

              {/* ─── Fare Card — shows wait fare breakdown when applicable ─── */}
              <View style={s.fareCard}>
                <View style={[s.row, { justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.glassBorder }]}>
                  <Text style={{ fontSize: 13, color: C.textMuted }}>Distance</Text>
                  <Text style={{ fontSize: 13, color: C.text }}>{rideData.distance}</Text>
                </View>
                {waitFareAdd > 0 ? (
                  <>
                    <View style={[s.row, { justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.glassBorder }]}>
                      <Text style={{ fontSize: 13, color: C.textMuted }}>Base Fare</Text>
                      <Text style={{ fontSize: 13, color: C.text }}>₹{origFare}</Text>
                    </View>
                    <View style={[s.row, { justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.glassBorder }]}>
                      <Text style={{ fontSize: 13, color: C.saffron }}>⏳ Wait Charge ({cancelInfo?.wait_fare_billable_min} min × ₹1)</Text>
                      <Text style={{ fontSize: 13, color: C.saffron, fontWeight: '700' }}>+₹{waitFareAdd}</Text>
                    </View>
                    <View style={[s.row, { justifyContent: 'space-between', paddingVertical: 8 }]}>
                      <Text style={{ fontSize: 13, color: C.textMuted }}>Total Fare</Text>
                      <Text style={{ fontSize: 16, color: C.yellow, fontWeight: '900' }}>₹{newFare}</Text>
                    </View>
                  </>
                ) : (
                  <View style={[s.row, { justifyContent: 'space-between', paddingVertical: 8 }]}>
                    <Text style={{ fontSize: 13, color: C.textMuted }}>Total Fare</Text>
                    <Text style={{ fontSize: 16, color: C.yellow, fontWeight: '800' }}>{rideData.fare}</Text>
                  </View>
                )}
              </View>

              {/* ─── Cancel — separate system ─── */}
              <TouchableOpacity style={{ backgroundColor: C.pinkGlass, borderWidth: 1.5, borderColor: C.pinkBorder, borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 10 }} onPress={() => setShowCancelModal(true)}>
                <Text style={{ color: C.pink, fontWeight: '800', fontSize: 14 }}>
                  ✕ Ride Cancel karein {cancelInfo ? (cancelInfo.is_free ? '(Free)' : `(₹${cancelInfo.fee})`) : cancelTimer > 0 ? '(Free)' : '(₹10)'}
                </Text>
                {driverWaitSec > 0 && (
                  <Text style={{ color: C.pink, fontSize: 11, marginTop: 3, opacity: 0.75 }}>
                    Cancel fee alag • Wait charge alag hota hai
                  </Text>
                )}
              </TouchableOpacity>
              <Text style={{ textAlign: 'center', color: C.textDim, fontSize: 12, marginTop: 4, marginBottom: 8 }}>⏳ Driver OTP daalkar trip shuru karega...</Text>
            </>
          ) : (
            <View style={{ paddingBottom: 24 }}>

              <View style={{ alignItems: 'center', marginBottom: 14 }}>
                <View style={{ backgroundColor: C.bgCard, borderRadius: 28, paddingHorizontal: 22, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 8, shadowColor: C.pink, shadowOpacity: 0.2, shadowRadius: 12, borderWidth: 1, borderColor: C.glassBorder }}>
                  <Text style={{ fontSize: 27, fontWeight: '900', color: C.yellow }}>{surgeFare || rideData?.fare}</Text>
                  <View style={{ width: 1, height: 26, backgroundColor: C.glassBorder }} />
                  <Text style={{ fontSize: 20 }}>{rideIcon(rideType)}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: C.pink, textTransform: 'uppercase', letterSpacing: 0.5 }}>{(rideType || '').replace('_', ' ')}</Text>
                  {surgeCount > 0 && (
                    <View style={{ backgroundColor: C.yellow, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: '#000', fontSize: 10, fontWeight: '900' }}>⚡ SURGE {surgeCount}x</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Search progress bar — shows while looking for driver */}
              {!serverSurgeOffer && !noDriverFinal && (
                <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <Text style={{ fontSize: 11, color: C.textDim, fontWeight: '600' }}>0s</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                      <Text style={{ fontSize: 26, fontWeight: '900', color: searchElapsed >= 75 ? C.red : searchElapsed >= 50 ? C.yellow : C.text }}>
                        {searchElapsed}
                      </Text>
                      <Text style={{ fontSize: 12, color: C.textMuted }}>/ 90s</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: C.textDim, fontWeight: '600' }}>90s</Text>
                  </View>
                  <View style={{ height: 10, backgroundColor: C.glass, borderRadius: 5, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder }}>
                    <Animated.View style={{
                      height: '100%', borderRadius: 5,
                      width: surgeBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                      backgroundColor: surgeBarAnim.interpolate({
                        inputRange: [0, 0.6, 0.8, 1],
                        outputRange: ['#4CAF50', '#FFC107', '#FF9800', '#FF5722'],
                      }),
                    }} />
                  </View>
                  <Text style={{ textAlign: 'center', fontSize: 12, color: C.textMuted, marginTop: 7, fontStyle: 'italic' }}>
                    {searchElapsed < 30 ? '🔍 Nearby drivers ko request bhej rahe hain...' :
                     searchElapsed < 60 ? '📡 Sabhi area drivers ko ping kiya — wait karo...' :
                     '⚡ 15km tak dhundh rahe — thodi der aur'}
                  </Text>
                </View>
              )}

              {/* Server-triggered surge offer — shows after 90s with no driver accepting */}
              {serverSurgeOffer && surgeCount < 3 && (() => {
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
                      <View style={{ backgroundColor: C.bg, borderRadius: 20, padding: 18, borderWidth: 1.5, borderColor: '#FF5722', elevation: 6, shadowColor: '#FF5722', shadowOpacity: 0.15, shadowRadius: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF5722', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <Text style={{ fontSize: 20 }}>⚡</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }}>Koi driver nahi mila!</Text>
                            <Text style={{ color: '#E65100', fontSize: 12, marginTop: 1 }}>
                              Fare badhao — drivers zyada attract honge
                            </Text>
                          </View>
                          <View style={{ backgroundColor: '#FF5722', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{3 - surgeCount}/3</Text>
                          </View>
                        </View>
                        <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 14 }}>
                          Abhi: <Text style={{ color: C.text, fontWeight: '700' }}>{surgeFare || rideData?.fare}</Text>
                          {'  '}·{'  '}Suggested: <Text style={{ color: C.yellow, fontWeight: '700' }}>{serverSurgeOffer.label}</Text>
                        </Text>
                        <View style={{ gap: 10 }}>
                          {opts.map((opt) => (
                            <Bouncy key={opt.amount}
                              onPress={() => { setServerSurgeOffer(null); surgeFareNow(opt.amount); }}
                              disabled={surging}
                              style={{
                                backgroundColor: surging ? '#2a2a4a' : opt.bg,
                                borderRadius: 14, padding: 14,
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                borderWidth: opt.amount === serverSurgeOffer.amt ? 2.5 : 1.5,
                                borderColor: surging ? '#3a3a5a' : opt.amount === serverSurgeOffer.amt ? opt.btnBg : opt.border,
                                opacity: surging ? 0.6 : 1,
                              }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <Text style={{ fontSize: 26 }}>{opt.emoji}</Text>
                                <View>
                                  <Text style={{ fontSize: 20, fontWeight: '900', color: surging ? C.textDim : C.text }}>
                                    {opt.label}{opt.amount === serverSurgeOffer.amt ? ' ⭐' : ''}
                                  </Text>
                                  <Text style={{ fontSize: 11, color: surging ? C.textDim : C.textMuted }}>Naya fare: ₹{opt.newFare}</Text>
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
                            <FloatingDots color={C.yellow} />
                            <Text style={{ color: C.yellow, fontSize: 13, fontWeight: '700', marginTop: 6 }}>⚡ Fare update ho raha hai...</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </SlideUp>
                );
              })()}

              {/* Final no-driver state — alternatives + retry */}
              {noDriverFinal && (
                <SlideUp>
                  <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
                    <View style={{ backgroundColor: C.redGlass, borderRadius: 20, padding: 18, borderWidth: 1.5, borderColor: C.redBorder }}>
                      <Text style={{ fontSize: 30, textAlign: 'center', marginBottom: 8 }}>😔</Text>
                      <Text style={{ color: C.red, fontSize: 16, fontWeight: '900', textAlign: 'center' }}>
                        Is area mein driver nahi mila
                      </Text>
                      <Text style={{ color: C.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 16 }}>
                        Doosra vehicle try karo ya kuch minutes baad retry karo
                      </Text>
                      {noDriverFinal.alternatives.length > 0 && (
                        <>
                          <Text style={{ color: C.text, fontSize: 12, fontWeight: '800', marginBottom: 10, textAlign: 'center' }}>
                            Abhi available hain:
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14 }}>
                            {noDriverFinal.alternatives.map((alt: string) => {
                              const aicons: Record<string, string> = { auto: '🛺', car: '🚕', bike: '🏍️', eriksha: '🛵', luxury: '🚙', green_bike: '⚡', electric_auto: '🌿' };
                              const alabels: Record<string, string> = { auto: 'Auto', car: 'Car', bike: 'Bike', eriksha: 'E-Riksha', luxury: 'Luxury', green_bike: 'Green Bike', electric_auto: 'E-Auto' };
                              return (
                                <Bouncy key={alt} onPress={() => { setNoDriverFinal(null); switchVehicle(alt); }} disabled={switchingVehicle}
                                  style={{ backgroundColor: switchingVehicle ? C.glass : C.pink, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 6, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 8 }}>
                                  <Text style={{ fontSize: 18 }}>{aicons[alt] || '🚗'}</Text>
                                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{alabels[alt] || alt}</Text>
                                </Bouncy>
                              );
                            })}
                          </View>
                        </>
                      )}
                      <RetryTimer
                        seconds={noDriverFinal.retry_after_sec}
                        onRetry={() => { setNoDriverFinal(null); setServerSurgeOffer(null); if (rideData?.ride_id) bookRide(); }}
                      />
                    </View>
                  </View>
                </SlideUp>
              )}

              {altSuggest && altSuggest.alternatives.length > 0 && !noDriverFinal && (
                <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
                  <View style={{ backgroundColor: C.yellowGlass, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: C.yellowBorder }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.yellow, textAlign: 'center', marginBottom: 4 }}>
                      😕 {(altSuggest.current_type || '').toUpperCase()} driver nahi mila
                    </Text>
                    <Text style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', marginBottom: 12 }}>
                      Kya hum aapke liye doosra vehicle dhundhe?
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {altSuggest.alternatives.map((alt: string) => {
                        const aicons: Record<string, string> = { auto: '🛺', car: '🚕', bike: '🏍️', eriksha: '🛵', luxury: '🚙', green_bike: '⚡', electric_auto: '🌿' };
                        const alabels: Record<string, string> = { auto: 'Auto', car: 'Car', bike: 'Bike', eriksha: 'E-Riksha', luxury: 'Luxury', green_bike: 'Green Bike', electric_auto: 'E-Auto' };
                        return (
                          <Bouncy key={alt} onPress={() => switchVehicle(alt)} disabled={switchingVehicle}
                            style={{ backgroundColor: switchingVehicle ? C.glass : C.pink, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 6, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 8 }}>
                            <Text style={{ fontSize: 18 }}>{aicons[alt] || '🚗'}</Text>
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{alabels[alt] || alt}</Text>
                          </Bouncy>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}

              <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
                <View style={{ backgroundColor: cancelTimer > 0 ? C.greenGlass : C.yellowGlass, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: cancelTimer > 0 ? C.greenBorder : C.yellowBorder }}>
                  <Text style={{ fontSize: 12, color: cancelTimer > 0 ? C.green : C.yellow, fontWeight: '700', textAlign: 'center' }}>
                    {cancelTimer > 0 ? `✅ ${cancelTimer}s tak FREE cancellation` : '⚠️ Ab cancel pe ₹10 fee lagega'}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 3 }}>Aaj {freeCancelsLeft} free cancels bache hain</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20 }}>
                <Bouncy onPress={() => setShowCancelModal(true)} style={{ flex: 1, backgroundColor: C.pinkGlass, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: C.pinkBorder }}>
                  <Text style={{ color: C.pink, fontWeight: '800', fontSize: 14 }}>
                    ✕ Cancel {cancelInfo ? (cancelInfo.is_free ? '(Free)' : `(₹${cancelInfo.fee})`) : cancelTimer > 0 ? '(Free)' : '(₹10)'}
                  </Text>
                </Bouncy>
                <Bouncy onPress={async () => {
                    if (rideData?.ride_id) {
                      try { await apiPost('/api/rides/cancel-smart', { ride_id: rideData.ride_id, cancelled_by: 'customer', reason: 'Retry' }); } catch (_e) {}
                    }
                    setRideData(null); bookRide();
                  }} style={{ flex: 1, backgroundColor: C.glass, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder }}>
                  <Text style={{ color: C.text, fontWeight: '800', fontSize: 14 }}>🔄 Retry</Text>
                </Bouncy>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const VEHICLE_LABELS: Record<string, string> = {
  bike: 'Bike', auto: 'Auto', car: 'Car', eriksha: 'E-Riksha',
  green_bike: 'Green Bike', electric_auto: 'Electric Auto', luxury: 'Luxury',
};

function SearchAnim({ emoji, label }: { emoji: string; label: string }) {
  const SW = Dimensions.get('window').width;
  const CX = SW / 2;
  const CY = 128;

  const r1 = useRef(new Animated.Value(0)).current;
  const r2 = useRef(new Animated.Value(0)).current;
  const r3 = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const dots = useRef([0, 1, 2, 3, 4, 5].map(() => new Animated.Value(0))).current;
  const textO = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const ring = (val: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
    ring(r1, 0).start();
    ring(r2, 660).start();
    ring(r3, 1320).start();

    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.13, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
    ])).start();

    Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 2800, useNativeDriver: true })
    ).start();

    const dotDelays = [0, 850, 1700, 2550, 3400, 4250];
    dots.forEach((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(dotDelays[i]),
        Animated.timing(d, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(d, { toValue: 0, duration: 480, useNativeDriver: true }),
        Animated.delay(1200),
      ])).start()
    );

    Animated.loop(Animated.sequence([
      Animated.timing(textO, { toValue: 1, duration: 1100, useNativeDriver: true }),
      Animated.timing(textO, { toValue: 0.45, duration: 1100, useNativeDriver: true }),
    ])).start();
  }, []);

  const DOT_R = 106;
  const DOT_ANGLES = [20, 80, 150, 200, 280, 340];
  const sweepRot = sweep.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const Ring = ({ v, sz, c }: { v: Animated.Value; sz: number; c: string }) => (
    <Animated.View style={{
      position: 'absolute', left: CX - sz, top: CY - sz,
      width: sz * 2, height: sz * 2, borderRadius: sz,
      borderWidth: sz < 80 ? 2 : 1.5, borderColor: c,
      opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.95, 0.5, 0] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.6] }) }],
    }} />
  );

  return (
    <View style={{ width: SW, height: 262, backgroundColor: '#f4efe3', overflow: 'hidden' }}>

      {/* ── Paper map background ── */}
      {/* Horizontal grid lines */}
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: (i + 1) * 30, height: 1, backgroundColor: 'rgba(160,130,80,0.18)' }} />
      ))}
      {/* Vertical grid lines */}
      {Array.from({ length: Math.ceil(SW / 30) }).map((_, i) => (
        <View key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: (i + 1) * 30, width: 1, backgroundColor: 'rgba(160,130,80,0.18)' }} />
      ))}
      {/* Road strips — horizontal */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 52, height: 5, backgroundColor: 'rgba(195,165,105,0.28)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 182, height: 8, backgroundColor: 'rgba(195,165,105,0.22)' }} />
      {/* Road strips — vertical */}
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: SW * 0.22, width: 5, backgroundColor: 'rgba(195,165,105,0.26)' }} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: SW * 0.71, width: 8, backgroundColor: 'rgba(195,165,105,0.20)' }} />
      {/* Slight vignette edges */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 28, backgroundColor: 'rgba(210,190,150,0.18)' }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, backgroundColor: 'rgba(210,190,150,0.18)' }} />

      {/* Ambient center glow */}
      <View style={{ position: 'absolute', left: CX - 95, top: CY - 95, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(233,69,96,0.07)' }} />

      <Ring v={r1} sz={60} c="#e94560" />
      <Ring v={r2} sz={104} c="rgba(233,69,96,0.68)" />
      <Ring v={r3} sz={150} c="rgba(233,69,96,0.38)" />

      {/* Rotating radar sweep — 240×240 container centered at (CX, CY) */}
      <Animated.View style={{ position: 'absolute', left: CX - 120, top: CY - 120, width: 240, height: 240, transform: [{ rotate: sweepRot }] }}>
        <View style={{ position: 'absolute', left: 119, top: 0, width: 2, height: 120, backgroundColor: 'rgba(233,69,96,0.65)', borderRadius: 1 }} />
        <View style={{ position: 'absolute', left: 110, top: 8, width: 20, height: 112, backgroundColor: 'rgba(233,69,96,0.13)', borderRadius: 10 }} />
      </Animated.View>

      {/* Center vehicle icon */}
      <Animated.View style={{
        position: 'absolute', left: CX - 44, top: CY - 44,
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderWidth: 2.5, borderColor: 'rgba(233,69,96,0.65)',
        alignItems: 'center', justifyContent: 'center',
        transform: [{ scale: pulse }],
        elevation: 14, shadowColor: '#e94560', shadowOpacity: 0.45, shadowRadius: 16,
      }}>
        <Text style={{ fontSize: 40, lineHeight: 46 }}>{emoji}</Text>
      </Animated.View>

      {/* Driver blip dots at clock-face positions */}
      {dots.map((d, i) => {
        const ang = DOT_ANGLES[i] * Math.PI / 180;
        return (
          <Animated.View key={i} style={{
            position: 'absolute',
            left: CX + DOT_R * Math.cos(ang) - 11,
            top: CY + DOT_R * Math.sin(ang) - 11,
            width: 22, height: 22, borderRadius: 11,
            backgroundColor: '#e94560',
            borderWidth: 1.5, borderColor: '#fff',
            opacity: d, elevation: 6,
            shadowColor: '#e94560', shadowOpacity: 0.6, shadowRadius: 6,
          }} />
        );
      })}

      {/* Animated label */}
      <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0, alignItems: 'center' }}>
        <Animated.Text style={{ color: '#2d1f0e', fontSize: 13, fontWeight: '800', opacity: textO }}>
          {`Dhundh rahe hain aapka ${label} Buddy...`}
        </Animated.Text>
        <Text style={{ color: '#e94560', fontSize: 10, marginTop: 4, fontWeight: '700', letterSpacing: 1.5 }}>
          SPPERO · BEST MATCH FOR YOU
        </Text>
      </View>
    </View>
  );
}

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
  const fee = cancelInfo?.fee ?? (cancelTimer > 0 ? 0 : 10);
  const waitSec = cancelInfo?.driver_wait_sec ?? 0;
  const waitMin = Math.floor(waitSec / 60);
  const waitSecRem = waitSec % 60;

  return (
    <View style={s.screen}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' }}>
        <GlassPanel intensity={24} style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34 }}>
          <View style={s.sheetHandle} />
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 8 }}>Ride Cancel karein?</Text>
          <View style={{ backgroundColor: isFree ? C.greenGlass : C.yellowGlass, borderRadius: 12, padding: 12, marginBottom: waitSec > 0 ? 8 : 16, borderWidth: 1, borderColor: isFree ? C.greenBorder : C.yellowBorder }}>
            <Text style={{ fontSize: 13, color: isFree ? C.green : C.yellow, fontWeight: '700' }}>
              {isFree
                ? `✅ Abhi cancel FREE hai${cancelInfo ? ` (${cancelInfo.sec_since_book} sec hua)` : ` (${cancelTimer}s bache)`}`
                : `⚠️ Cancel fee ₹${fee} lagega`}
            </Text>
          </View>
          {waitSec > 0 && (
            <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18 }}>⏱️</Text>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#DC2626' }}>Driver {waitMin}m {waitSecRem}s se wait kar raha hai</Text>
                {!isFree && <Text style={{ fontSize: 11, color: '#9B1C1C', marginTop: 2 }}>Jitna zyada wait, utna zyada fee barhta hai</Text>}
              </View>
            </View>
          )}
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.textMuted, marginBottom: 10 }}>Cancel ka reason?</Text>
          {['Galti se book ho gaya', 'Bahut wait ho raha', 'Plan change ho gaya', 'Driver door hai', 'Koi aur reason'].map((reason, i) => (
            <TouchableOpacity key={i} style={{ backgroundColor: C.glass, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.glassBorder }}
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
          <TouchableOpacity style={{ borderWidth: 1.5, borderColor: C.glassBorder, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 8, backgroundColor: C.glass }}
            onPress={() => setShowCancelModal(false)}>
            <Text style={{ color: C.text, fontWeight: '800', fontSize: 14 }}>Nahi, ride rakhni hai</Text>
          </TouchableOpacity>
        </GlassPanel>
      </View>
    </View>
  );
}
