import { useRef, useEffect } from 'react';
import { Animated, Dimensions, Image, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, DotBG, FadeIn, FloatingDots, PulseView, SlideUp, SuccessBurst, TripSteps } from '../components/ui';
import { s, C } from '../styles';
import { apiPost } from '../../api';

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
    unreadChat, setUnreadChat,
    chatToast, setChatToast,
    showCancelModal, setShowCancelModal,
    sosActive,
    searchElapsed,
    surgeBarAnim,
    surgeCount,
    surgeFare,
    surging,
    altSuggest, setAltSuggest,
    switchingVehicle,
    result, setResult,
    userCoords,
    surgeFareNow, switchVehicle, bookRide,
    callDriver, triggerSOS,
    rideIcon,
  } = useApp();

  if (showCancelModal) return <CancelModal />;

  return (
    <View style={s.screen}>
      <View style={{ backgroundColor: C.pink, overflow: 'hidden', paddingTop: Platform.OS === 'android' ? 46 : 52, paddingBottom: 20, paddingHorizontal: 16 }}>
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.10)', top: -60, right: -40 }} />
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>{rideData?.driver ? '🚗 Driver Mil Gaya!' : '🔍 Driver Dhundh Rahe Hain'}</Text>
      </View>
      {!rideData?.driver && (
        <SearchAnim emoji={rideIcon(rideType)} label={VEHICLE_LABELS[rideType] || (rideType || '').replace(/_/g, ' ')} />
      )}
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 16, paddingHorizontal: 16 }}>
        <TripSteps step={rideData?.driver ? 1 : 0} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {rideData?.driver ? (
            <>
              <SuccessBurst />
              <FadeIn delay={300} style={{ alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: C.green, letterSpacing: 0.3 }}>Driver Mil Gaya! 🎉</Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>Aapka ride confirm ho gaya</Text>
              </FadeIn>
              <SlideUp><View style={s.driverCard}>
                <View style={{ position: 'relative' }}>
                  {rideData.driver.photo
                    ? <Image source={{ uri: rideData.driver.photo }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                    : <View style={s.driverAvatar}><Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>{(rideData.driver.name||'D')[0].toUpperCase()}</Text></View>
                  }
                  {rideData.driver.verified && (
                    <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: C.green, borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>✓</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={s.driverName}>{rideData.driver.name}</Text>
                    {rideData.driver.verified && (
                      <View style={{ backgroundColor: C.greenGlass, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: C.greenBorder }}>
                        <Text style={{ fontSize: 9, color: C.green, fontWeight: '800' }}>✓ VERIFIED</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 12, color: C.textMuted, fontWeight: '600', marginTop: 2 }}>
                    {rideData.driver.vehicle_brand ? `${rideData.driver.vehicle_brand} ` : ''}{rideData.driver.vehicle_model || ''}
                  </Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>🚗 {rideData.driver.vehicle_no}</Text>
                  <Text style={{ fontSize: 12, color: C.yellow, marginTop: 2 }}>⭐ {rideData.driver.rating ? parseFloat(rideData.driver.rating).toFixed(1) : '4.8'}</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <PulseView><Text style={{ fontSize: 18, fontWeight: '800', color: C.pink }}>{driverEta || (eta ? eta.split('·')[0].trim() : '...')}</Text></PulseView>
                  <Text style={{ fontSize: 10, color: C.textMuted }}>arriving</Text>
                  {driverDist ? <Text style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{driverDist} door</Text> : null}
                </View>
              </View></SlideUp>
              {driverEta ? (
                <View style={{ backgroundColor: C.greenGlass, borderRadius: 14, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.greenBorder }}>
                  <Text style={{ fontSize: 20, marginRight: 10 }}>🚗</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '800', fontSize: 14 }}>Aapka driver aa raha hai!</Text>
                    <Text style={{ color: C.green, fontSize: 13, marginTop: 2 }}>⏱️ {driverEta} mein pahunchega · {driverDist} door</Text>
                  </View>
                  <PulseView><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.green }} /></PulseView>
                </View>
              ) : null}
              {rideData?.startOtp && (
                <View style={s.otpCard}>
                  <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 6 }}>🔐 Driver ko yeh OTP batao</Text>
                  <Text style={{ color: C.text, fontSize: 34, fontWeight: 'bold', letterSpacing: 10 }}>{rideData.startOtp}</Text>
                </View>
              )}
              <View style={s.actionRow}>
                <Bouncy style={s.actionBtn} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
                  <View>
                    <Ionicons name="chatbubble" size={22} color={C.textMuted} />
                    {unreadChat > 0 && <View style={s.chatBadge}><Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{unreadChat}</Text></View>}
                  </View>
                  <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>Chat</Text>
                </Bouncy>
                <Bouncy style={s.actionBtn} onPress={callDriver}><Ionicons name="call" size={22} color={C.green} /><Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>Call</Text></Bouncy>
                <Bouncy style={s.actionBtn} onPress={triggerSOS}><Ionicons name="warning" size={22} color={C.red} /><Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>SOS</Text></Bouncy>
              </View>
              {chatToast && (
                <TouchableOpacity
                  style={{ backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(233,69,96,0.45)', elevation: 8 }}
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
              <TouchableOpacity style={{ backgroundColor: C.pinkGlass, borderWidth: 1.5, borderColor: C.pinkBorder, borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 10 }} onPress={() => setShowCancelModal(true)}>
                <Text style={{ color: C.pink, fontWeight: '800', fontSize: 14 }}>✕ Ride Cancel karein {cancelTimer > 0 ? '(Free)' : '(₹15)'}</Text>
              </TouchableOpacity>
              <View style={s.fareCard}>
                {[['Distance',rideData.distance],['Total Fare',rideData.fare]].map(([lbl,val]: any,i: number) => (
                  <View key={i} style={[s.row, { justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i<1 ? 1 : 0, borderBottomColor: C.glassBorder }]}>
                    <Text style={{ fontSize: 13, color: C.textMuted }}>{lbl}</Text>
                    <Text style={[{ fontSize: 13, color: C.text }, i===1 && { fontWeight: '800', color: C.yellow, fontSize: 16 }]}>{val}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ textAlign: 'center', color: C.textDim, fontSize: 12, marginTop: 8 }}>⏳ Driver OTP daalkar trip shuru karega...</Text>
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

              <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                  <Text style={{ fontSize: 11, color: C.textDim, fontWeight: '600' }}>0s</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                    <Text style={{ fontSize: 26, fontWeight: '900', color: searchElapsed >= 80 ? C.red : searchElapsed >= 60 ? C.yellow : C.text }}>
                      {searchElapsed}
                    </Text>
                    <Text style={{ fontSize: 12, color: C.textMuted }}>/ 100s</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: C.textDim, fontWeight: '600' }}>100s</Text>
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
                  {searchElapsed < 25 ? '🔍 Nearby drivers dhundh rahe hain...' :
                   searchElapsed < 50 ? '📡 Aur drivers ko ping kar rahe hain...' :
                   searchElapsed < 75 ? '🌐 10km radius tak dhundh rahe hain...' :
                   searchElapsed < 100 ? '⚡ 15km tak dhundh rahe — thodi der aur' :
                   '🔴 Nahi mila — Fare badhao aur attract karo?'}
                </Text>
              </View>

              {searchElapsed >= 100 && surgeCount < 3 && (() => {
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
                            <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }}>100 Seconds Ho Gaye!</Text>
                            <Text style={{ color: '#E65100', fontSize: 12, marginTop: 1 }}>Fare badhao — zyada drivers attract karo</Text>
                          </View>
                          <View style={{ backgroundColor: '#FF5722', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{3 - surgeCount}/3</Text>
                          </View>
                        </View>
                        <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 14 }}>
                          Abhi: <Text style={{ color: C.text, fontWeight: '700' }}>{surgeFare || rideData?.fare}</Text>
                          {'  '}·{'  '}Badhao aur fresh driver search shuru hoga
                        </Text>
                        <View style={{ gap: 10 }}>
                          {opts.map((opt) => (
                            <Bouncy key={opt.amount}
                              onPress={() => surgeFareNow(opt.amount)}
                              disabled={surging}
                              style={{
                                backgroundColor: surging ? '#2a2a4a' : opt.bg,
                                borderRadius: 14, padding: 14,
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                borderWidth: 1.5, borderColor: surging ? '#3a3a5a' : opt.border,
                                opacity: surging ? 0.6 : 1,
                              }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <Text style={{ fontSize: 26 }}>{opt.emoji}</Text>
                                <View>
                                  <Text style={{ fontSize: 20, fontWeight: '900', color: surging ? C.textDim : C.text }}>{opt.label}</Text>
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

              {altSuggest && altSuggest.alternatives.length > 0 && (
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
                  <Text style={{ color: C.pink, fontWeight: '800', fontSize: 14 }}>✕ Cancel {cancelTimer > 0 ? '(Free)' : '(₹10)'}</Text>
                </Bouncy>
                <Bouncy onPress={() => { setRideData(null); bookRide(); }} style={{ flex: 1, backgroundColor: C.glass, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder }}>
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
    <View style={{ width: SW, height: 262, backgroundColor: '#07070f', overflow: 'hidden' }}>
      {/* Ambient center glow */}
      <View style={{ position: 'absolute', left: CX - 95, top: CY - 95, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(233,69,96,0.05)' }} />

      <Ring v={r1} sz={60} c="#e94560" />
      <Ring v={r2} sz={104} c="rgba(233,69,96,0.72)" />
      <Ring v={r3} sz={150} c="rgba(233,69,96,0.42)" />

      {/* Rotating radar sweep — 240×240 container centered at (CX, CY) */}
      <Animated.View style={{ position: 'absolute', left: CX - 120, top: CY - 120, width: 240, height: 240, transform: [{ rotate: sweepRot }] }}>
        {/* Line from center (120,120) to top-center (120,0) */}
        <View style={{ position: 'absolute', left: 119, top: 0, width: 2, height: 120, backgroundColor: 'rgba(233,69,96,0.5)', borderRadius: 1 }} />
        {/* Soft glow trail beside line */}
        <View style={{ position: 'absolute', left: 110, top: 8, width: 20, height: 112, backgroundColor: 'rgba(233,69,96,0.09)', borderRadius: 10 }} />
      </Animated.View>

      {/* Center vehicle icon */}
      <Animated.View style={{
        position: 'absolute', left: CX - 44, top: CY - 44,
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: 'rgba(233,69,96,0.13)',
        borderWidth: 2.5, borderColor: 'rgba(233,69,96,0.58)',
        alignItems: 'center', justifyContent: 'center',
        transform: [{ scale: pulse }],
        elevation: 14, shadowColor: '#e94560', shadowOpacity: 0.55, shadowRadius: 18,
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
            shadowColor: '#e94560', shadowOpacity: 0.7, shadowRadius: 6,
          }} />
        );
      })}

      {/* Animated label */}
      <View style={{ position: 'absolute', bottom: 16, left: 0, right: 0, alignItems: 'center' }}>
        <Animated.Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', opacity: textO }}>
          {`Dhundh rahe hain aapka ${label} Buddy...`}
        </Animated.Text>
        <Text style={{ color: 'rgba(233,69,96,0.75)', fontSize: 10, marginTop: 4, fontWeight: '700', letterSpacing: 1.5 }}>
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
    rideData, setRideData,
    setShowCancelModal, setScreen,
    setPickup, setDrop, setPickupCoords, setDropCoords, setEta,
    setAltSuggest, setDriverLoc, setResult,
  } = useApp();

  const { useRideStore } = require('../../store');
  const ride = useRideStore();

  return (
    <View style={s.screen}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34, borderTopWidth: 1, borderColor: C.glassBorder }}>
          <View style={s.sheetHandle} />
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 8 }}>Ride Cancel karein?</Text>
          <View style={{ backgroundColor: cancelTimer > 0 ? C.greenGlass : C.yellowGlass, borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: cancelTimer > 0 ? C.greenBorder : C.yellowBorder }}>
            <Text style={{ fontSize: 13, color: cancelTimer > 0 ? C.green : C.yellow, fontWeight: '700' }}>
              {cancelTimer > 0 ? `✅ Abhi cancel FREE hai (${cancelTimer}s bache)` : '⚠️ Cancel fee ₹10 lagega'}
            </Text>
          </View>
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
        </View>
      </View>
    </View>
  );
}
