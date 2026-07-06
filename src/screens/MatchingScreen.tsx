import { useRef, useEffect, useState } from 'react';
import { Animated, Dimensions, Linking, Platform, ScrollView, Share, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Storage as AsyncStorage } from '../storage';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, FloatingDots, GlassPanel, PulseView, SlideUp, SuccessBurst } from '../components/ui';
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

  // ── SuccessBurst auto-hide ─────────────────────────────────────────────────
  const [showBurst, setShowBurst] = useState(true);
  useEffect(() => {
    if (!rideData?.driver) { setShowBurst(true); return; }
    setShowBurst(true);
    const t = setTimeout(() => setShowBurst(false), 2000);
    return () => clearTimeout(t);
  }, [rideData?.driver?.id ?? rideData?.driver]);

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

  // ── Live ETA countdown — synced from driverEta, ticks every second ─────────
  const [etaRemaining, setEtaRemaining] = useState(0);
  useEffect(() => {
    const sec = parseEtaSec(driverEta || '');
    if (sec > 0 && Math.abs(sec - etaRemaining) > 30) setEtaRemaining(sec);
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
    ? Math.round(SCREEN_H * 0.54)
    : rideData?.driver
      ? Math.round(SCREEN_H * 0.50)
      : Math.round(SCREEN_H * 0.47);
  const mapH = SCREEN_H - sheetH + OVERLAP;

  // ── Surge offer options ────────────────────────────────────────────────────
  const baseFare = parseInt((surgeFare || rideData?.fare || '0').replace(/[^0-9]/g, '')) || 0;
  const surgeOpts = [
    { label: '+₹15',  amount: 15,  color: '#8BC34A' },
    { label: '+₹25',  amount: 25,  color: '#FFC107' },
    { label: '+₹40',  amount: 40,  color: '#FF9800' },
    { label: '+₹65',  amount: 65,  color: '#F44336' },
    { label: '+₹100', amount: 100, color: '#9C27B0' },
  ];

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
              {showBurst && <SuccessBurst />}

              {/* ── Row 1: ETA / Arrived status  +  inline OTP ── */}
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 20, paddingVertical: 14,
                borderBottomWidth: 1, borderBottomColor: C.glassBorder,
              }}>
                {/* Left: status text */}
                <View style={{ flex: 1 }}>
                  {driverArrived ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <PulseView>
                          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.green }} />
                        </PulseView>
                        <Text style={{ fontSize: 17, fontWeight: '900', color: C.green }}>
                          Captain has arrived!
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                        {freeSecLeft > 0
                          ? `🆓 Free wait: ${Math.floor(freeSecLeft / 60)}:${String(freeSecLeft % 60).padStart(2, '0')} left`
                          : `⏳ Wait charge: +₹${waitFareAdd}`}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: 17, fontWeight: '900', color: C.text }}>
                        {'Pickup in '}
                        <Text style={{ color: etaColor }}>{etaDisplay}</Text>
                      </Text>
                      <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                        {driverDist ? `Captain ${driverDist} away` : 'Driver on the way...'}
                      </Text>
                    </>
                  )}
                </View>

                {/* Right: compact OTP pill */}
                {rideData.startOtp ? (
                  <View style={{ alignItems: 'center', marginLeft: 12 }}>
                    <Text style={{
                      fontSize: 9, fontWeight: '800', letterSpacing: 0.8,
                      color: C.textMuted, textTransform: 'uppercase', marginBottom: 5,
                    }}>
                      Ride PIN
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {String(rideData.startOtp).split('').map((digit, i) => (
                        <View key={i} style={{
                          width: 30, height: 36, borderRadius: 8,
                          backgroundColor: C.plumGlass,
                          borderWidth: 1.5, borderColor: C.plumBorder,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: 17, fontWeight: '900', color: C.plum }}>{digit}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>

              {/* ── Row 2: Driver avatar  +  name/vehicle  +  Chat/Call ── */}
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 20, paddingVertical: 14,
                borderBottomWidth: 1, borderBottomColor: C.glassBorder,
              }}>
                {/* Avatar */}
                <View style={{
                  width: 50, height: 50, borderRadius: 25,
                  backgroundColor: C.bgCard,
                  borderWidth: 2, borderColor: C.glassBorder,
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 12, overflow: 'hidden',
                }}>
                  {rideData.driver.photo
                    ? <Image source={{ uri: rideData.driver.photo }} style={{ width: 50, height: 50 }} />
                    : <Text style={{ color: C.textMuted, fontSize: 20, fontWeight: '900' }}>
                        {(rideData.driver.name || 'D')[0].toUpperCase()}
                      </Text>
                  }
                </View>

                {/* Name + vehicle */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: C.text }}>
                    {rideData.driver.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5, flexWrap: 'wrap' }}>
                    {rideData.driver.vehicle_no ? (
                      <View style={{
                        backgroundColor: C.glass, borderRadius: 6,
                        paddingHorizontal: 7, paddingVertical: 2,
                        borderWidth: 1, borderColor: C.glassBorder,
                      }}>
                        <Text style={{ fontSize: 11, color: C.text, fontWeight: '700', letterSpacing: 0.5 }}>
                          {rideData.driver.vehicle_no}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={{ fontSize: 12, color: C.yellow, fontWeight: '800' }}>
                      ⭐ {rideData.driver.rating ? parseFloat(rideData.driver.rating).toFixed(1) : '4.8'}
                    </Text>
                    {rideData.driver.vehicle_brand ? (
                      <Text style={{ fontSize: 11, color: C.textMuted }}>
                        {[rideData.driver.vehicle_brand, rideData.driver.vehicle_model].filter(Boolean).join(' ')}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Chat + Call icon buttons */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Animated.View style={{ transform: [{ scale: chatBounceAnim }] }}>
                    <Bouncy onPress={() => { setUnreadChat(0); setChatOrigin('matching'); setScreen('chat'); }}>
                      <View style={{
                        width: 42, height: 42, borderRadius: 21,
                        backgroundColor: unreadChat > 0 ? C.plumGlass : C.bgCard,
                        borderWidth: 1.5, borderColor: unreadChat > 0 ? C.plumBorder : C.glassBorder,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name="chatbubble" size={17} color={unreadChat > 0 ? C.plum : C.textMuted} />
                        {unreadChat > 0 && (
                          <View style={{
                            position: 'absolute', top: -2, right: -2,
                            width: 16, height: 16, borderRadius: 8,
                            backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>{unreadChat}</Text>
                          </View>
                        )}
                      </View>
                    </Bouncy>
                  </Animated.View>

                  <Bouncy onPress={callDriver}>
                    <View style={{
                      width: 42, height: 42, borderRadius: 21,
                      backgroundColor: 'rgba(34,197,94,0.10)',
                      borderWidth: 1.5, borderColor: C.greenBorder,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name="call" size={17} color={C.green} />
                    </View>
                  </Bouncy>
                </View>
              </View>

              {/* ── Row 3: Route card (From → To  +  Fare) ── */}
              <View style={{
                marginHorizontal: 20, marginTop: 12, marginBottom: 12,
                borderRadius: 14, borderWidth: 1, borderColor: C.glassBorder,
                backgroundColor: C.bgCard, overflow: 'hidden',
              }}>
                {/* Pickup row */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  padding: 12, borderBottomWidth: 1, borderBottomColor: C.glassBorder,
                }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginRight: 10 }} />
                  <Text style={{ fontSize: 12, color: C.textMuted, flex: 1 }} numberOfLines={1}>{pickup}</Text>
                </View>
                {/* Drop row + fare */}
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: C.pink, marginRight: 10 }} />
                  <Text style={{ fontSize: 12, color: C.textMuted, flex: 1 }} numberOfLines={1}>{drop}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: C.yellow, marginLeft: 8 }}>
                    {waitFareAdd > 0 ? `₹${newFare}` : (surgeFare || rideData.fare)}
                  </Text>
                </View>
              </View>

              {/* ── Row 4: Action bar — Share | SOS | Cancel ── */}
              <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 10 }}>
                <Bouncy onPress={shareTracking} style={{
                  flex: 1, backgroundColor: C.bgCard, borderRadius: 12, paddingVertical: 12,
                  alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5,
                  borderWidth: 1, borderColor: C.glassBorder,
                }}>
                  <Ionicons name="share-social" size={15} color={C.textMuted} />
                  <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: '700' }}>Share</Text>
                </Bouncy>

                <TouchableOpacity onPress={triggerSOS} style={{
                  flex: 1, backgroundColor: sosActive ? 'rgba(239,68,68,0.22)' : C.redGlass,
                  borderRadius: 12, paddingVertical: 12,
                  alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5,
                  borderWidth: 1.5, borderColor: C.red,
                }}>
                  <Ionicons name="warning" size={15} color={C.red} />
                  <Text style={{ color: C.red, fontSize: 12, fontWeight: '900' }}>
                    {sosActive ? '🆘 Sent' : 'SOS'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowCancelModal(true)} style={{
                  flex: 1, backgroundColor: C.pinkGlass, borderRadius: 12, paddingVertical: 12,
                  alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5,
                  borderWidth: 1, borderColor: C.pinkBorder,
                }}>
                  <Ionicons name="close" size={15} color={C.pink} />
                  <Text style={{ color: C.pink, fontSize: 12, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
              </View>

              {/* Unread chat banner (fallback when no toast) */}
              {!chatToast && unreadChat > 0 && (
                <TouchableOpacity
                  style={{ ...s.chatAlert, marginHorizontal: 20 }}
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
              {/* ── Header: vehicle emoji + fare + status title ── */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14,
                borderBottomWidth: 1, borderBottomColor: C.glassBorder,
              }}>
                <Text style={{ fontSize: 22 }}>{rideIcon(rideType)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: C.text }}>
                    {!serverSurgeOffer && !noDriverFinal
                      ? '🔍 Finding your ride...'
                      : noDriverFinal
                        ? '😔 No driver found'
                        : '⚡ Increase fare to get a driver'}
                  </Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }} numberOfLines={1}>
                    {VEHICLE_LABELS[rideType] || rideType} · {drop}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 19, fontWeight: '900', color: C.yellow }}>
                    {surgeFare || rideData?.fare}
                  </Text>
                  {surgeCount > 0 && (
                    <View style={{ backgroundColor: C.yellow, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 }}>
                      <Text style={{ color: '#000', fontSize: 9, fontWeight: '900' }}>⚡ SURGE {surgeCount}×</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* ── Search progress bar ── */}
              {!serverSurgeOffer && !noDriverFinal && (
                <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <Text style={{ fontSize: 12, color: C.textMuted }}>
                      {searchElapsed < 30 ? 'Requesting nearby drivers...' :
                       searchElapsed < 60 ? 'Pinging all drivers in area...' :
                       'Searching up to 15km...'}
                    </Text>
                    <Text style={{
                      fontSize: 14, fontWeight: '900',
                      color: searchElapsed >= 75 ? C.red : searchElapsed >= 50 ? C.yellow : C.textMuted,
                    }}>
                      {searchElapsed}s
                    </Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: C.glass, borderRadius: 3, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder }}>
                    <Animated.View style={{
                      height: '100%', borderRadius: 3,
                      width: surgeBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                      backgroundColor: surgeBarAnim.interpolate({
                        inputRange: [0, 0.6, 0.8, 1],
                        outputRange: [C.green, C.yellow, C.saffron, C.pink],
                      }),
                    }} />
                  </View>
                </View>
              )}

              {/* ── Alt vehicle suggest (early hint while still searching) ── */}
              {altSuggest && altSuggest.alternatives.length > 0 && !noDriverFinal && (
                <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
                  <View style={{ backgroundColor: C.yellowGlass, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: C.yellowBorder }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.yellow, marginBottom: 10 }}>
                      No {altSuggest.current_type?.toUpperCase()} available — switch vehicle?
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {altSuggest.alternatives.map((alt: string) => (
                        <Bouncy key={alt} onPress={() => switchVehicle(alt)} disabled={switchingVehicle}
                          style={{ backgroundColor: switchingVehicle ? C.glass : C.pink, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 15 }}>{V_ICONS[alt] || '🚗'}</Text>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{VEHICLE_LABELS[alt] || alt}</Text>
                        </Bouncy>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* ── Server-triggered surge offer ── */}
              {serverSurgeOffer && surgeCount < 3 && (
                <SlideUp>
                  <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
                    <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
                      {'Current: '}
                      <Text style={{ color: C.text, fontWeight: '700' }}>{surgeFare || rideData?.fare}</Text>
                      {'  ·  Suggested: '}
                      <Text style={{ color: C.yellow, fontWeight: '700' }}>{serverSurgeOffer.label}</Text>
                      {'  ·  '}
                      <Text style={{ color: C.saffron }}>{3 - surgeCount}/3 tries left</Text>
                    </Text>
                    <View style={{ gap: 8 }}>
                      {surgeOpts.map(opt => (
                        <Bouncy key={opt.amount}
                          onPress={() => { setServerSurgeOffer(null); surgeFareNow(opt.amount); }}
                          disabled={surging}
                          style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            backgroundColor: opt.amount === serverSurgeOffer.amt ? opt.color + '18' : C.bgCard,
                            borderRadius: 12, padding: 12,
                            borderWidth: opt.amount === serverSurgeOffer.amt ? 2 : 1,
                            borderColor: opt.amount === serverSurgeOffer.amt ? opt.color : C.glassBorder,
                            opacity: surging ? 0.6 : 1,
                          }}>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: C.text }}>
                            {opt.label}{opt.amount === serverSurgeOffer.amt ? ' ⭐' : ''}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 12, color: C.textMuted }}>₹{baseFare + opt.amount}</Text>
                            <View style={{ backgroundColor: opt.color, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }}>
                              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>Pick</Text>
                            </View>
                          </View>
                        </Bouncy>
                      ))}
                    </View>
                    {surging && (
                      <View style={{ alignItems: 'center', marginTop: 12 }}>
                        <FloatingDots color={C.yellow} />
                        <Text style={{ color: C.yellow, fontSize: 12, fontWeight: '700', marginTop: 6 }}>Updating fare...</Text>
                      </View>
                    )}
                  </View>
                </SlideUp>
              )}

              {/* ── No driver final — alternatives + retry ── */}
              {noDriverFinal && (
                <SlideUp>
                  <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
                    <View style={{ backgroundColor: C.redGlass, borderRadius: 16, padding: 18, borderWidth: 1.5, borderColor: C.redBorder, alignItems: 'center' }}>
                      <Text style={{ fontSize: 30, marginBottom: 8 }}>😔</Text>
                      <Text style={{ color: C.red, fontSize: 15, fontWeight: '900', textAlign: 'center', marginBottom: 4 }}>
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
                              <Text style={{ fontSize: 15 }}>{V_ICONS[alt] || '🚗'}</Text>
                              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{VEHICLE_LABELS[alt] || alt}</Text>
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

              {/* ── Cancel info + buttons ── */}
              <View style={{ paddingHorizontal: 20 }}>
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
                    <Text style={{ color: C.pink, fontWeight: '800', fontSize: 14 }}>
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
                    <Text style={{ color: C.text, fontWeight: '800', fontSize: 14 }}>🔄 Retry</Text>
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
