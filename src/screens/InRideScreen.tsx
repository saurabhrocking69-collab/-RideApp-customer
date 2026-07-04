import { useRef, useState, useEffect } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View, Animated, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useApp } from '../context/AppContext';
import { Bouncy, GlassPanel, MapOverlay, PulseView, TripSteps, DotBG } from '../components/ui';
import { LiveMap } from '../components/LiveMap';
import { s, C, T, SP, R, SHADOW } from '../styles';

function InlineSOSButton({ onActivate, active }: { onActivate: () => void; active: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;
  const scale    = useRef(new Animated.Value(1)).current;
  const holdRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef  = useRef<Animated.CompositeAnimation | null>(null);
  const [holding, setHolding] = useState(false);

  const startHold = () => {
    if (active) return;
    setHolding(true);
    Vibration.vibrate(60);
    animRef.current = Animated.parallel([
      Animated.timing(progress, { toValue: 1, duration: 2000, useNativeDriver: false }),
      Animated.timing(scale, { toValue: 0.97, duration: 200, useNativeDriver: true }),
    ]);
    animRef.current.start();
    holdRef.current = setTimeout(() => {
      Vibration.vibrate([0, 100, 80, 100]);
      onActivate();
    }, 2000);
  };

  const cancelHold = () => {
    if (active) return;
    setHolding(false);
    if (holdRef.current) clearTimeout(holdRef.current);
    animRef.current?.stop();
    Animated.timing(progress, { toValue: 0, duration: 250, useNativeDriver: false }).start();
    Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };

  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 10 }}>
      <TouchableOpacity activeOpacity={1} onPressIn={startHold} onPressOut={cancelHold}>
        <Animated.View style={{
          borderRadius: 18, flexDirection: 'row', alignItems: 'center',
          paddingVertical: 16, paddingHorizontal: 20, gap: 14, overflow: 'hidden',
          backgroundColor: active ? 'rgba(239,68,68,0.22)' : C.redGlass,
          borderWidth: 2, borderColor: C.red,
          elevation: active ? 14 : 7,
          shadowColor: C.red, shadowOpacity: active ? 0.60 : 0.32, shadowRadius: 14,
        }}>
          {/* Fill bar sweeps left-to-right while holding */}
          {holding && !active && (
            <Animated.View style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              backgroundColor: 'rgba(239,68,68,0.18)', width: fillWidth,
            }} />
          )}

          {/* Icon */}
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(239,68,68,0.20)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.red }}>
            <Ionicons name="warning" size={25} color={C.red} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: C.red, fontSize: 14, fontWeight: '900' }}>
              {active ? '🆘 Alert Sent!' : holding ? 'Sending SOS...' : 'Hold for Emergency SOS'}
            </Text>
            <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>
              {active ? 'Police: 100 · Ambulance: 108' : 'Hold 2s · Alerts police + emergency contacts'}
            </Text>
          </View>

          {!active && !holding && (
            <View style={{ backgroundColor: C.red, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>HOLD</Text>
            </View>
          )}
          {holding && !active && (
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(239,68,68,0.28)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.red }}>
              <Text style={{ color: C.red, fontWeight: '900', fontSize: 11 }}>2s</Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function formatElapsed(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const VEHICLE_EMOJI: Record<string, string> = {
  auto: '🛺', bike: '🏍️', car: '🚗', suv: '🚙', mini: '🚗',
};

export function InRideScreen() {
  const {
    setScreen,
    pickup, drop,
    pickupCoords, dropCoords,
    driverLoc,
    driverEta, driverDist,
    rideData, rideType,
    unreadChat, setUnreadChat,
    chatToast, setChatToast,
    sosActive, setSosActive,
    callDriver, triggerSOS,
  } = useApp();

  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(
    rideData?.started_at ? new Date(rideData.started_at).getTime() : Date.now()
  );

  // Chat bounce — pulses when there are unread messages
  const chatBounceAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (unreadChat > 0) {
      const loop = Animated.loop(Animated.sequence([
        Animated.spring(chatBounceAnim, { toValue: 1.14, friction: 3, tension: 300, useNativeDriver: true }),
        Animated.spring(chatBounceAnim, { toValue: 1, friction: 3, tension: 300, useNativeDriver: true }),
        Animated.delay(1800),
      ]));
      loop.start();
      return () => loop.stop();
    } else {
      chatBounceAnim.setValue(1);
    }
  }, [unreadChat]);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleSOS = async () => {
    setSosActive(true);
    await triggerSOS();
    setTimeout(() => setSosActive(false), 6000);
  };

  const driver = rideData?.driver;
  const vType  = (rideData?.vehicle_type || rideData?.ride_type || rideType || 'auto').toLowerCase();
  const vEmoji = VEHICLE_EMOJI[vType] || '🚗';

  return (
    <View style={s.screen}>
      <View style={{
        backgroundColor: C.night, overflow: 'hidden',
        paddingTop: Platform.OS === 'android' ? 46 : 52,
        paddingBottom: 16, paddingHorizontal: SP.md,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.06)', top: -80, right: -60 }} />
        <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,45,120,0.12)', bottom: -50, left: -30 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)' }}>
            <Text style={{ fontSize: 18 }}>{vEmoji}</Text>
          </View>
          <View>
            <Text style={{ ...T.bodyBold, color: '#fff' }}>Ride In Progress</Text>
            <Text style={{ ...T.caption, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{vType.charAt(0).toUpperCase() + vType.slice(1)}</Text>
          </View>
        </View>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <PulseView><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }} /></PulseView>
          <Text style={{ ...T.bodyBold, color: '#fff', fontVariant: ['tabular-nums'] }}>{formatElapsed(elapsed)}</Text>
        </View>
      </View>

      <View style={s.mapFit}>
        <LiveMap
          pickupCoords={pickupCoords}
          dropCoords={dropCoords}
          driverLat={driverLoc?.lat}
          driverLng={driverLoc?.lng}
          vehicleType={vType}
          height={260}
          mode="inride"
          showRoute={true}
          followDriver={true}
          showTraffic={true}
        />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} live={true} />
      </View>

      <GlassPanel intensity={22} style={{
        flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        marginTop: -20, paddingTop: 16, paddingHorizontal: 16,
        elevation: 12, shadowColor: C.pink, shadowOpacity: 0.12, shadowRadius: 18,
        borderTopWidth: 1.5, borderTopColor: 'rgba(255,45,120,0.22)',
      }}>
        <TripSteps step={2} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

          {/* Driver card */}
          {driver && (
            <View style={{
              backgroundColor: C.bgCard, borderRadius: R.md, padding: SP.md, marginBottom: 10,
              flexDirection: 'row', alignItems: 'center', gap: 12,
              borderWidth: 1.5, borderColor: C.pinkBorder,
              elevation: 6, shadowColor: C.pink, shadowOpacity: 0.15, shadowRadius: 12,
            }}>
              <View style={{ position: 'relative' }}>
                {driver.photo ? (
                  <Image source={{ uri: driver.photo }} style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, borderColor: C.pink }} contentFit="cover" />
                ) : (
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'rgba(255,45,120,0.35)' }}>
                    <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{(driver.name || 'D')[0].toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: C.green, borderWidth: 2, borderColor: '#fff' }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...T.title, color: C.text }}>{driver.name || 'Driver'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <View style={{ backgroundColor: C.pinkGlass, borderRadius: R.xs, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: C.pinkBorder, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Text style={{ fontSize: 11 }}>{vEmoji}</Text>
                    <Text style={{ ...T.caption, color: C.pink, textTransform: 'capitalize' }}>{vType}</Text>
                  </View>
                  {rideData?.vehicle_no ? (
                    <View style={{ backgroundColor: C.plumGlass, borderRadius: R.xs, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: C.plumBorder }}>
                      <Text style={{ ...T.caption, color: C.plum, letterSpacing: 0.5 }}>{rideData.vehicle_no}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              {driver.rating ? (
                <View style={{ backgroundColor: C.yellowGlass, borderRadius: R.xs, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: C.yellowBorder, alignItems: 'center' }}>
                  <Text style={{ color: C.yellow, fontSize: 16, lineHeight: 18 }}>★</Text>
                  <Text style={{ ...T.caption, color: C.yellow, marginTop: 1 }}>{Number(driver.rating).toFixed(1)}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* ─── Quick contact — compact pills right below driver card ─── */}
          {driver && (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10, marginTop: -4 }}>
              <Bouncy style={{ flex: 1 }} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
                <Animated.View style={{
                  backgroundColor: C.plumGlass, borderRadius: 14,
                  paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  borderWidth: 1.5, borderColor: unreadChat > 0 ? C.plumBorder : 'rgba(46,20,97,0.25)',
                  elevation: 2, shadowColor: C.plum, shadowOpacity: 0.15, shadowRadius: 6,
                  transform: [{ scale: chatBounceAnim }],
                }}>
                  <Ionicons name="chatbubble" size={16} color={C.plum} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.plum }}>
                    {unreadChat > 0 ? `Chat (${unreadChat})` : 'Chat'}
                  </Text>
                </Animated.View>
              </Bouncy>
              <Bouncy style={{ flex: 1 }} onPress={callDriver}>
                <View style={{
                  backgroundColor: C.greenGlass, borderRadius: 14,
                  paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  borderWidth: 1.5, borderColor: C.greenBorder,
                  elevation: 2, shadowColor: C.green, shadowOpacity: 0.15, shadowRadius: 6,
                }}>
                  <Ionicons name="call" size={16} color={C.green} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.green }}>Call Driver</Text>
                </View>
              </Bouncy>
            </View>
          )}

          {/* Live trip stats */}
          <View style={{
            backgroundColor: 'rgba(0,212,168,0.10)', borderRadius: R.md, padding: SP.md,
            marginBottom: 10, borderWidth: 1.5, borderColor: 'rgba(0,212,168,0.30)',
            flexDirection: 'row', alignItems: 'center',
          }}>
            <PulseView style={{ marginRight: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.mint, elevation: 2, shadowColor: C.mint, shadowOpacity: 0.7, shadowRadius: 6 }} />
            </PulseView>
            <View style={{ flex: 1 }}>
              <Text style={{ ...T.bodyBold, color: C.mint }}>Live — In Progress</Text>
              {(rideData?.distance || driverDist) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <View style={{ backgroundColor: 'rgba(0,200,83,0.12)', borderRadius: R.xs, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ ...T.caption, color: C.green }}>📏 {rideData?.distance || driverDist}</Text>
                  </View>
                  {rideData?.fare ? (
                    <View style={{ backgroundColor: C.pinkGlass, borderRadius: R.xs, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C.pinkBorder }}>
                      <Text style={{ ...T.caption, color: C.pink }}>₹ {String(rideData.fare).replace('₹', '')}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
            {driverEta ? (
              <View style={{ backgroundColor: C.green, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', elevation: 3, shadowColor: C.green, shadowOpacity: 0.4, shadowRadius: 6 }}>
                <Text style={{ ...T.label, color: '#fff' }}>ETA</Text>
                <Text style={{ ...T.bodyBold, color: '#fff', marginTop: 1 }}>{driverEta}</Text>
              </View>
            ) : null}
          </View>

          {/* Pickup → Drop */}
          <View style={{
            backgroundColor: C.glass, borderRadius: 16, padding: 14,
            marginBottom: 12, borderWidth: 1, borderColor: C.glassBorder,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Text style={{ fontSize: 14, marginTop: 1 }}>📍</Text>
              <Text style={{ fontSize: 13, color: C.green, fontWeight: '700', flex: 1 }} numberOfLines={2}>{pickup}</Text>
            </View>
            <View style={{ width: 2, height: 14, backgroundColor: C.glassBorder, marginLeft: 11, marginVertical: 6 }} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Text style={{ fontSize: 14, marginTop: 1 }}>🎯</Text>
              <Text style={{ fontSize: 13, color: C.pink, fontWeight: '700', flex: 1 }} numberOfLines={2}>{drop}</Text>
            </View>
          </View>

          {/* ─── SOS — full width hold button ─── */}
          <InlineSOSButton onActivate={handleSOS} active={sosActive} />

          {/* SOS active banner */}
          {sosActive && (
            <View style={{
              backgroundColor: C.redGlass, borderRadius: 14, padding: 14,
              flexDirection: 'row', alignItems: 'center', gap: 10,
              borderWidth: 1.5, borderColor: C.red, marginBottom: 10,
            }}>
              <Ionicons name="warning" size={18} color={C.red} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: C.red, fontWeight: '900' }}>🆘 SOS Alert Sent!</Text>
                <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Emergency contacts notified via WhatsApp. Police: 100</Text>
              </View>
            </View>
          )}

          {/* Chat toast */}
          {chatToast && (
            <TouchableOpacity
              style={{
                backgroundColor: C.bgDark, borderRadius: R.sm, padding: 14, marginTop: 4,
                flexDirection: 'row', alignItems: 'center', gap: 10,
                borderWidth: 1, borderColor: C.pinkBorder, elevation: 8,
              }}
              onPress={() => { setChatToast(null); setUnreadChat(0); setScreen('chat'); }}>
              <Ionicons name="chatbubble" size={16} color={C.pink} />
              <Text style={{ color: '#fff', fontSize: 13, flex: 1, fontWeight: '600' }} numberOfLines={1}>{chatToast}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>Reply</Text>
            </TouchableOpacity>
          )}
          {!chatToast && unreadChat > 0 && (
            <TouchableOpacity style={s.chatAlert} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>💬 {unreadChat} new message from driver — tap to read</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </GlassPanel>
    </View>
  );
}
