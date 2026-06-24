import { Animated, KeyboardAvoidingView, Platform, ScrollView, TextInput, Text, TouchableOpacity, View } from 'react-native';
import { useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, MapOverlay, MapWebView, RideVehicleIcon, DotBG } from '../components/ui';
import { s, C } from '../styles';
import { RIDES } from '../constants';

export function BookingScreen() {
  const {
    screen, setScreen,
    pickup, setPickup, drop, setDrop,
    pickupCoords, setPickupCoords, dropCoords, setDropCoords,
    pickupSugg, setPickupSugg, dropSugg, setDropSugg,
    eta, setEta,
    rideType, setRideType,
    fareEstimates, setFareEstimates, fareLoading,
    promoDiscount, setPromoDiscount,
    promoCode, setPromoCode,
    instantApplied, setInstantApplied,
    showPromoInput, setShowPromoInput,
    result, loading,
    lastFetchKey,
    searchPlaces, geocodePlace, useMyLocation, swapLocations, applyPromo, bookRide,
  } = useApp();

  const selRide   = RIDES.find(r => r.id === rideType);
  const rawFare   = fareEstimates[rideType] || 0;
  const discount  = promoDiscount;
  const finalFare = Math.max(0, rawFare - discount);
  const hasFare   = rawFare > 0 && !fareLoading;

  // Animated map collapse on scroll
  const scrollY = useRef(new Animated.Value(0)).current;
  const mapHeight = scrollY.interpolate({ inputRange: [0, 100], outputRange: [200, 0], extrapolate: 'clamp' });
  const sheetRadius = scrollY.interpolate({ inputRange: [0, 80], outputRange: [24, 0], extrapolate: 'clamp' });

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={() => { setScreen('home'); setPickupSugg([]); setDropSugg([]); setEta(''); setPromoCode(''); setPromoDiscount(0); setInstantApplied(false); setShowPromoInput(false); }}
          style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.topTitle}>Book a Ride</Text>
          <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 1 }}>Live fares · Lucknow</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Map — collapses as user scrolls up */}
      <Animated.View style={{ height: mapHeight, overflow: 'hidden' }}>
        <MapWebView pickupCoords={pickupCoords} dropCoords={dropCoords} height={200} />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} />
      </Animated.View>

      {/* Bottom sheet — slides up over map */}
      <Animated.View style={{
        flex: 1,
        backgroundColor: C.bg,
        borderTopLeftRadius: sheetRadius,
        borderTopRightRadius: sheetRadius,
        marginTop: -20,
        borderTopWidth: 1,
        borderTopColor: C.glassBorder,
      }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          contentContainerStyle={{ paddingBottom: 36, paddingHorizontal: 14 }}>

          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: C.glassMid }} />
          </View>

          {/* Route card / location inputs */}
          {pickupCoords && dropCoords ? (
            <TouchableOpacity activeOpacity={0.88}
              onPress={() => { setPickupCoords(null); setDropCoords(null); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; }}
              style={{ backgroundColor: C.glass, borderRadius: 18, marginBottom: 14, elevation: 3, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder }}>
              <View style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                  <TouchableOpacity onPress={e => { e.stopPropagation(); swapLocations(); }}
                    style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.glassMid, alignItems: 'center', justifyContent: 'center', marginRight: 12, alignSelf: 'center', borderWidth: 1, borderColor: C.glassBorder }}>
                    <Ionicons name="swap-vertical" size={16} color={C.textMuted} />
                  </TouchableOpacity>
                  <View style={{ width: 14, alignItems: 'center', marginRight: 10, paddingVertical: 2 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.green, borderWidth: 2, borderColor: C.greenBorder }} />
                    <View style={{ flex: 1, width: 2, backgroundColor: C.glassMid, marginVertical: 3 }} />
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: C.pink }} />
                  </View>
                  <View style={{ flex: 1, gap: 11 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{pickup}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{drop}</Text>
                  </View>
                </View>
              </View>
              {eta && !eta.includes('Calculate') && (
                <View style={{ backgroundColor: C.greenGlass, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderColor: C.greenBorder }}>
                  <Text style={{ fontSize: 12 }}>🗺️</Text>
                  <Text style={{ color: C.green, fontWeight: '700', fontSize: 12, flex: 1 }}>{eta}</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ backgroundColor: C.glass, borderRadius: 18, padding: 14, marginBottom: 14, elevation: 3, borderWidth: 1, borderColor: C.glassBorder }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 11, height: 11, borderRadius: 5.5, backgroundColor: C.green, borderWidth: 2, borderColor: C.greenBorder }} />
                <TextInput style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: '500', paddingVertical: 7 }}
                  placeholder="Pickup location..." placeholderTextColor={C.textDim} value={pickup}
                  onChangeText={(t) => { setPickup(t); searchPlaces(t, 'pickup'); if (pickupCoords || !t) { setPickupCoords(null); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; } }}
                  returnKeyType="next" />
                {pickup ? (
                  <TouchableOpacity onPress={() => { setPickup(''); setPickupCoords(null); setPickupSugg([]); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; }} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={18} color={C.textDim} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={useMyLocation} style={{ padding: 5, borderRadius: 18, backgroundColor: C.pinkGlass, borderWidth: 1, borderColor: C.pinkBorder }}>
                    <Ionicons name="navigate" size={16} color={C.pink} />
                  </TouchableOpacity>
                )}
              </View>
              {pickupSugg.length > 0 && (
                <View style={[s.suggBox, { zIndex: 100 }]}>
                  {pickupSugg.slice(0, 5).map((sg: any, i: number) => (
                    <TouchableOpacity key={i} style={[s.suggItem, { paddingVertical: 12 }]} onPress={() => { setPickup(sg.text); setPickupSugg([]); geocodePlace(sg.text, 'pickup'); }}>
                      <Ionicons name="location" size={15} color={C.pink} style={{ marginRight: 8 }} />
                      <Text style={{ fontSize: 13, color: C.text, flex: 1, fontWeight: '500' }} numberOfLines={2}>{sg.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
                <TouchableOpacity onPress={swapLocations} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.glassMid, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.glassBorder, marginRight: 10 }}>
                  <Ionicons name="swap-vertical" size={14} color={C.textMuted} />
                </TouchableOpacity>
                <View style={{ width: 2, height: 18, backgroundColor: C.glassMid }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: C.pink }} />
                <TextInput style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: '500', paddingVertical: 7 }}
                  placeholder="Drop location..." placeholderTextColor={C.textDim} value={drop}
                  onChangeText={(t) => { setDrop(t); searchPlaces(t, 'drop'); if (dropCoords || !t) { setDropCoords(null); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; } }}
                  returnKeyType="done" />
                {drop ? (
                  <TouchableOpacity onPress={() => { setDrop(''); setDropCoords(null); setDropSugg([]); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; }} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={18} color={C.textDim} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {dropSugg.length > 0 && (
                <View style={[s.suggBox, { zIndex: 100 }]}>
                  {dropSugg.slice(0, 5).map((sg: any, i: number) => (
                    <TouchableOpacity key={i} style={[s.suggItem, { paddingVertical: 12 }]} onPress={() => { setDrop(sg.text); setDropSugg([]); geocodePlace(sg.text, 'drop'); }}>
                      <Ionicons name="flag" size={15} color={C.pink} style={{ marginRight: 8 }} />
                      <Text style={{ fontSize: 13, color: C.text, flex: 1, fontWeight: '500' }} numberOfLines={2}>{sg.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {eta && eta.includes('Calculate') && (
            <View style={{ backgroundColor: C.yellowGlass, borderRadius: 12, padding: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.yellowBorder }}>
              <Text style={{ fontSize: 15 }}>🔄</Text>
              <Text style={{ color: C.yellow, fontWeight: '700', fontSize: 12 }}>{eta}</Text>
            </View>
          )}

          {/* Vehicle selector — vertical */}
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 10, marginTop: 4, marginLeft: 2 }}>
            CHOOSE VEHICLE
          </Text>
          <View style={{ gap: 10, marginBottom: 4 }}>
            {RIDES.map((r: any) => {
              const isSel = rideType === r.id;
              const isLux = r.id === 'luxury';
              const fareText = fareLoading ? '...' : fareEstimates[r.id] ? `₹${fareEstimates[r.id]}` : `₹${r.base}+`;
              return (
                <TouchableOpacity key={r.id} onPress={() => setRideType(r.id)}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: isSel ? C.bgCard : C.glass,
                    borderRadius: 18, padding: 14, gap: 14,
                    borderWidth: 2, borderColor: isSel ? C.pink : isLux ? 'rgba(156,39,176,0.4)' : C.glassBorder,
                    elevation: isSel ? 8 : 2,
                    shadowColor: isSel ? C.pink : '#000',
                    shadowOpacity: isSel ? 0.4 : 0.04,
                    shadowRadius: 10,
                  }}>
                  {/* Icon circle */}
                  <View style={{
                    width: 52, height: 52, borderRadius: 26,
                    backgroundColor: isSel ? C.pinkGlass : C.glassMid,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: isSel ? C.pinkBorder : C.glassBorder,
                  }}>
                    <RideVehicleIcon id={r.id} size={26} color={isSel ? C.pink : isLux ? '#ce93d8' : C.textMuted} />
                  </View>

                  {/* Label + desc + eta */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: isSel ? C.text : C.textMuted }}>{r.label}</Text>
                      {r.tag && (
                        <View style={{ backgroundColor: isLux ? '#9C27B0' : r.tagColor, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }}>{r.tag}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>{r.desc}</Text>
                    <Text style={{ color: C.textDim, fontSize: 11, marginTop: 3 }}>🕐 {r.eta}</Text>
                  </View>

                  {/* Fare + selection indicator */}
                  <View style={{ alignItems: 'flex-end', minWidth: 60 }}>
                    <Text style={{
                      fontSize: 18, fontWeight: '900',
                      color: fareLoading ? C.textDim : isSel ? C.yellow : isLux ? '#ce93d8' : C.textMuted,
                    }}>{fareText}</Text>
                    {isSel && (
                      <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.pink }} />
                        <Text style={{ fontSize: 10, color: C.pink, fontWeight: '700' }}>Selected</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Fare breakdown card */}
          {selRide && hasFare ? (
            <View style={{ backgroundColor: C.glass, borderRadius: 20, marginTop: 16, elevation: 4, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder }}>
              <View style={{ backgroundColor: C.bgCard, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: C.glassBorder }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.pinkGlass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.pinkBorder }}>
                  <RideVehicleIcon id={selRide.id} size={18} color={C.pink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '800', fontSize: 14 }}>{selRide.label}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 1 }}>{selRide.desc}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: C.yellow, fontWeight: '900', fontSize: 20 }}>₹{finalFare}</Text>
                  {discount > 0 && <Text style={{ color: C.textDim, fontSize: 11, textDecorationLine: 'line-through' }}>₹{rawFare}</Text>}
                </View>
              </View>

              <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: C.textMuted }}>Base fare</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>₹{selRide.base}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: C.textMuted }}>Distance charge</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>₹{rawFare - selRide.base > 0 ? rawFare - selRide.base : '—'}</Text>
                </View>
                {discount > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: C.green, fontWeight: '700' }}>Discount {promoCode ? `(${promoCode})` : ''}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: C.green }}>−₹{discount}</Text>
                  </View>
                )}
                <View style={{ height: 1, backgroundColor: C.glassBorder, marginVertical: 4 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>Total</Text>
                  <Text style={{ fontSize: 19, fontWeight: '900', color: C.yellow }}>₹{finalFare}</Text>
                </View>
              </View>

              {!instantApplied && discount === 0 && (
                <TouchableOpacity onPress={() => { setPromoDiscount(10); setPromoCode('SPPERO10'); setInstantApplied(true); }}
                  style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: C.greenGlass, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: C.greenBorder, borderStyle: 'dashed' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.green + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 16 }}>🎁</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: C.green }}>₹10 OFF — Instant Discount</Text>
                    <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Tap to apply • No code needed</Text>
                  </View>
                  <View style={{ backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ color: '#000', fontSize: 12, fontWeight: '900' }}>APPLY</Text>
                  </View>
                </TouchableOpacity>
              )}
              {instantApplied && (
                <View style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: C.greenGlass, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.greenBorder }}>
                  <Text style={{ fontSize: 18 }}>✅</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.green, flex: 1 }}>₹10 instant discount applied!</Text>
                  <TouchableOpacity onPress={() => { setPromoDiscount(0); setPromoCode(''); setInstantApplied(false); }}>
                    <Ionicons name="close-circle" size={20} color={C.green} />
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity onPress={() => setShowPromoInput((p: boolean) => !p)}
                style={{ marginHorizontal: 16, marginBottom: showPromoInput ? 0 : 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.pink }}>🏷️ Have a promo code?</Text>
                <Ionicons name={showPromoInput ? 'chevron-up' : 'chevron-down'} size={14} color={C.pink} />
              </TouchableOpacity>
              {showPromoInput && (
                <View style={{ marginHorizontal: 16, marginBottom: 14, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.glassMid, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: C.glassBorder }}>
                  <Ionicons name="pricetag" size={16} color={C.textMuted} />
                  <TextInput style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: '700', letterSpacing: 1 }}
                    placeholder="Enter promo code" placeholderTextColor={C.textDim}
                    autoCapitalize="characters" value={promoCode} onChangeText={setPromoCode} />
                  <TouchableOpacity onPress={applyPromo} style={{ backgroundColor: C.pink, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, elevation: 4, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 6 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Apply</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : fareLoading ? (
            <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 20, marginTop: 16, alignItems: 'center', gap: 8, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
              <Text style={{ fontSize: 22 }}>⏳</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.textMuted }}>Calculating fare...</Text>
            </View>
          ) : null}

          {result ? <Text style={[s.err, { marginTop: 12 }]}>{result}</Text> : null}

          <Bouncy style={[{ borderRadius: 18, overflow: 'hidden', marginTop: 18 }, loading && { opacity: 0.7 }]} onPress={bookRide} disabled={loading}>
            <View style={{ backgroundColor: loading ? C.glass : C.pink, paddingVertical: 18, paddingHorizontal: 24, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, elevation: 10, shadowColor: C.pink, shadowOpacity: 0.55, shadowRadius: 14 }}>
              {!loading && <RideVehicleIcon id={rideType} size={20} color="#fff" />}
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 }}>
                  {loading ? 'Finding driver...' : `Book ${selRide?.label || 'Ride'}`}
                </Text>
                {!loading && (
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 }}>
                    {hasFare ? `₹${finalFare}${discount > 0 ? ` · saved ₹${discount}` : ''}` : 'Set route to see fare'}
                  </Text>
                )}
              </View>
            </View>
          </Bouncy>

        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
