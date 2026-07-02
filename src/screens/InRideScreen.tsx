import { useRef, useState, useEffect } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View, Animated, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useApp } from '../context/AppContext';
import { GlassPanel, MapOverlay, PulseView, TripSteps, DotBG } from '../components/ui';
import { LiveMap } from '../components/LiveMap';
import { s, C } from '../styles';

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
      Animated.timing(scale, { toValue: 0.92, duration: 200, useNativeDriver: true }),
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

  const bgColor = progress.interpolate({ inputRange: [0, 1], outputRange: [C.redGlass, 'rgba(239,68,68,0.22)'] });
  const borderC = progress.interpolate({ inputRange: [0, 1], outputRange: [C.redBorder, C.red] });

  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1 }}>
      <TouchableOpacity activeOpacity={1} onPressIn={startHold} onPressOut={cancelHold} style={{ flex: 1 }}>
        <Animated.View style={{
          flex: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
          paddingVertical: 14, backgroundColor: active ? 'rgba(239,68,68,0.18)' : bgColor,
          borderWidth: 1.5, borderColor: active ? C.red : borderC,
          elevation: active ? 8 : 4, shadowColor: C.red, shadowOpacity: active ? 0.5 : 0.2, shadowRadius: 8,
        }}>
          <Ionicons name="warning" size={22} color={C.red} />
          <Text style={{ fontSize: 10, color: C.red, marginTop: 3, fontWeight: '800' }}>
            {active ? '🆘 Sent!' : holding ? 'Ruko...' : 'Hold SOS'}
          </Text>
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
  // Use ride's server-side started_at so timer survives chat navigation and remounts
  const startRef = useRef(
    rideData?.started_at ? new Date(rideData.started_at).getTime() : Date.now()
  );

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
        backgroundColor: C.pink, overflow: 'hidden',
        paddingTop: Platform.OS === 'android' ? 46 : 52,
        paddingBottom: 14, paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.10)', top: -60, right: -40 }} />
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>🚗 Ride Chal Rahi Hai</Text>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] }}>⏱ {formatElapsed(elapsed)}</Text>
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

      <GlassPanel intensity={20} style={{
        flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        marginTop: -20, paddingTop: 16, paddingHorizontal: 16,
        elevation: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16,
      }}>
        <TripSteps step={2} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

          {/* Driver card */}
          {driver && (
            <View style={{
              backgroundColor: C.glass, borderRadius: 18, padding: 14, marginBottom: 10,
              flexDirection: 'row', alignItems: 'center', gap: 12,
              borderWidth: 1, borderColor: C.glassBorder,
            }}>
              {driver.photo ? (
                <Image source={{ uri: driver.photo }} style={{ width: 52, height: 52, borderRadius: 26 }} contentFit="cover" />
              ) : (
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{(driver.name || 'D')[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>{driver.name || 'Driver'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <Text style={{ fontSize: 13 }}>{vEmoji}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{vType}</Text>
                  {rideData?.vehicle_no ? (
                    <View style={{ backgroundColor: C.glassMid, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: C.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>{rideData.vehicle_no}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: C.yellow, fontSize: 18, fontWeight: '900' }}>★</Text>
                <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '700' }}>
                  {driver.rating ? Number(driver.rating).toFixed(1) : '—'}
                </Text>
              </View>
            </View>
          )}

          {/* Live trip stats */}
          <View style={{
            backgroundColor: C.greenGlass, borderRadius: 16, padding: 14,
            marginBottom: 10, borderWidth: 1, borderColor: C.greenBorder,
            flexDirection: 'row', alignItems: 'center',
          }}>
            <PulseView style={{ marginRight: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
            </PulseView>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.green, fontSize: 14, fontWeight: '800' }}>🚗 Chal Rahi Hai</Text>
              {(rideData?.distance || driverDist) ? (
                <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>
                  📏 {rideData?.distance || driverDist}
                  {rideData?.fare ? `  ·  💰 ${rideData.fare}` : ''}
                </Text>
              ) : null}
            </View>
            {driverEta ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: C.textDim, fontSize: 10 }}>ETA</Text>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '800' }}>{driverEta}</Text>
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

          {/* Action row: Chat | Call | SOS */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <TouchableOpacity
              onPress={() => { setUnreadChat(0); setScreen('chat'); }}
              style={[s.actionBtn, { flex: 1, borderRadius: 16, paddingVertical: 14, position: 'relative' }]}>
              <View>
                <Ionicons name="chatbubble" size={22} color={C.textMuted} />
                {unreadChat > 0 && (
                  <View style={s.chatBadge}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{unreadChat}</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={callDriver} style={[s.actionBtn, { flex: 1, borderRadius: 16, paddingVertical: 14 }]}>
              <Ionicons name="call" size={22} color={C.green} />
              <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>Call</Text>
            </TouchableOpacity>

            <InlineSOSButton onActivate={handleSOS} active={sosActive} />
          </View>

          {/* SOS active banner */}
          {sosActive && (
            <View style={{
              backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 14, padding: 14,
              flexDirection: 'row', alignItems: 'center', gap: 10,
              borderWidth: 1.5, borderColor: C.red, marginBottom: 10,
            }}>
              <Ionicons name="warning" size={18} color={C.red} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: C.red, fontWeight: '900' }}>🆘 SOS Alert bheja!</Text>
                <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Emergency contacts ko WhatsApp message gaya. Police: 100</Text>
              </View>
            </View>
          )}

          {/* Chat toast */}
          {chatToast && (
            <TouchableOpacity
              style={{
                backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, marginTop: 4,
                flexDirection: 'row', alignItems: 'center', gap: 10,
                borderWidth: 1, borderColor: 'rgba(233,69,96,0.45)', elevation: 8,
              }}
              onPress={() => { setChatToast(null); setUnreadChat(0); setScreen('chat'); }}>
              <Ionicons name="chatbubble" size={16} color={C.pink} />
              <Text style={{ color: '#fff', fontSize: 13, flex: 1, fontWeight: '600' }} numberOfLines={1}>{chatToast}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>Reply</Text>
            </TouchableOpacity>
          )}
          {!chatToast && unreadChat > 0 && (
            <TouchableOpacity style={s.chatAlert} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>💬 Driver ke {unreadChat} message — tap to read</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </GlassPanel>
    </View>
  );
}
