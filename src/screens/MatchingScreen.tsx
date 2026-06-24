import { Animated, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, DotBG, FloatingDots, MapOverlay, MapWebView, PulseView, RadarView, SlideUp, SuccessBurst, TripSteps } from '../components/ui';
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
      <View style={s.topBar}>
        <Text style={s.topTitle}>{rideData?.driver ? '🚗 Driver mil gaya!' : '🔍 Driver dhundh rahe hain'}</Text>
      </View>
      <View style={s.mapFit}>
        <MapWebView pickupCoords={pickupCoords} dropCoords={dropCoords} driverLat={driverLoc?.lat} driverLng={driverLoc?.lng} customerLat={userCoords?.latitude} customerLng={userCoords?.longitude} height={220} />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} live={!!rideData?.driver} />
      </View>
      <DotBG />
      <View style={{ flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, paddingTop: 16, paddingHorizontal: 16, borderTopWidth: 1, borderColor: C.glassBorder }}>
        <TripSteps step={rideData?.driver ? 1 : 0} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {rideData?.driver ? (
            <>
              <SuccessBurst />
              <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: '800', color: C.green, marginBottom: 12 }}>Driver Mil Gaya! 🎉</Text>
              <View style={s.driverCard}>
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
              </View>
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
                  <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 6 }}>🔐 Driver ko yeh OTP batao</Text>
                  <Text style={{ color: '#fff', fontSize: 34, fontWeight: 'bold', letterSpacing: 10 }}>{rideData.startOtp}</Text>
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
              {unreadChat > 0 && (
                <TouchableOpacity style={s.chatAlert} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>💬 Driver ne {unreadChat} message bheja — dekho</Text>
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
              <View style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 10 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>Driver Dhundh Rahe Hain</Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 28 }} numberOfLines={1}>{pickup} → {drop}</Text>
              </View>

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

              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <RadarView />
                <FloatingDots />
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
                      <View style={{ backgroundColor: '#1a1a2e', borderRadius: 20, padding: 18, borderWidth: 1.5, borderColor: '#FF5722' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF5722', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <Text style={{ fontSize: 20 }}>⚡</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>100 Seconds Ho Gaye!</Text>
                            <Text style={{ color: '#FF9800', fontSize: 12, marginTop: 1 }}>Fare badhao — zyada drivers attract karo</Text>
                          </View>
                          <View style={{ backgroundColor: '#FF5722', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{3 - surgeCount}/3</Text>
                          </View>
                        </View>
                        <Text style={{ color: '#888', fontSize: 12, marginBottom: 14 }}>
                          Abhi: <Text style={{ color: '#fff', fontWeight: '700' }}>{surgeFare || rideData?.fare}</Text>
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
