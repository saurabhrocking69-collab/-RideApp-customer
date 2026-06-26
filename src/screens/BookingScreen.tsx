import { Animated, KeyboardAvoidingView, Platform, ScrollView, TextInput, Text, TouchableOpacity, View } from 'react-native';
import { useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, MapOverlay, MapWebView, RideVehicleIcon, DotBG } from '../components/ui';
import { s, C } from '../styles';
import { RIDES } from '../constants';

const MAP_H = 200;

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

  // Sheet entrance: fade + slide-up on mount
  const sheetAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(sheetAnim, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, []);
  const sheetOpacity = sheetAnim;
  const sheetTranslate = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DotBG />

      {/* ─── Top bar ─────────────────────────────────────── */}
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={() => { setScreen('home'); setPickupSugg([]); setDropSugg([]); setEta(''); setPromoCode(''); setPromoDiscount(0); setInstantApplied(false); setShowPromoInput(false); }}
          style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.topTitle}>Book a Ride</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 1 }}>Live fares · All India</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* ─── Map — FIXED height, never resizes → zero flicker ─── */}
      <View style={{ height: MAP_H, width: '100%' }}>
        <MapWebView pickupCoords={pickupCoords} dropCoords={dropCoords} height={MAP_H} />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} />
      </View>

      {/* ─── Bottom sheet — animates up once on mount ─── */}
      <Animated.View style={{
        flex: 1,
        backgroundColor: C.bg,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        marginTop: -28,
        borderTopWidth: 1.5,
        borderTopColor: C.glassBorder,
        elevation: 14,
        shadowColor: C.pink,
        shadowOpacity: 0.10,
        shadowRadius: 18,
        opacity: sheetOpacity,
        transform: [{ translateY: sheetTranslate }],
      }}>
        {/* Drag handle */}
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <View style={{ width: 48, height: 4, borderRadius: 2, backgroundColor: C.glassB2 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingBottom: 16, paddingHorizontal: 14 }}>

          {/* ─── Location card ─────────────────────────────── */}
          {pickupCoords && dropCoords ? (
            /* Confirmed route — tap to edit drop */
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => { setDropCoords(null); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; }}
              style={{
                backgroundColor: C.bgCard,
                borderRadius: 20,
                marginBottom: 14,
                elevation: 6,
                overflow: 'hidden',
                borderWidth: 1.5,
                borderColor: C.glassBorder,
                shadowColor: C.pink,
                shadowOpacity: 0.10,
                shadowRadius: 14,
              }}>

              {/* ETA stripe — green banner at top */}
              {eta && !eta.includes('Calculate') ? (
                <View style={{ backgroundColor: C.green, paddingHorizontal: 16, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 13 }}>🗺️</Text>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12, flex: 1 }}>{eta}</Text>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>EDIT</Text>
                  </View>
                </View>
              ) : null}

              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                  {/* Swap button */}
                  <TouchableOpacity
                    onPress={e => { e.stopPropagation(); swapLocations(); }}
                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.pinkGlass, alignItems: 'center', justifyContent: 'center', marginRight: 12, alignSelf: 'center', borderWidth: 1.5, borderColor: C.pinkBorder }}>
                    <Ionicons name="swap-vertical" size={16} color={C.pink} />
                  </TouchableOpacity>

                  {/* Route indicator */}
                  <View style={{ width: 16, alignItems: 'center', marginRight: 12, paddingVertical: 3 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: C.green, borderWidth: 2.5, borderColor: 'rgba(5,150,105,0.3)' }} />
                    <View style={{ flex: 1, width: 2, backgroundColor: C.glassBorder, marginVertical: 3, minHeight: 24 }} />
                    <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: C.pink, borderWidth: 2.5, borderColor: C.pinkBorder }} />
                  </View>

                  {/* Text labels */}
                  <View style={{ flex: 1, gap: 14 }}>
                    <View>
                      <Text style={{ fontSize: 9, color: C.textDim, fontWeight: '800', letterSpacing: 1, marginBottom: 3 }}>FROM</Text>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: C.text }}>{pickup}</Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 9, color: C.textDim, fontWeight: '800', letterSpacing: 1, marginBottom: 3 }}>TO</Text>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: C.text }}>{drop}</Text>
                    </View>
                  </View>

                  {/* Edit badge */}
                  <View style={{ alignSelf: 'center', marginLeft: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: C.pinkGlass, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.pinkBorder }}>
                    <Ionicons name="pencil" size={15} color={C.pink} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            /* Input mode */
            <View style={{
              backgroundColor: C.bgCard,
              borderRadius: 20,
              padding: 14,
              marginBottom: 14,
              elevation: 6,
              borderWidth: 1.5,
              borderColor: C.glassBorder,
              shadowColor: C.pink,
              shadowOpacity: 0.08,
              shadowRadius: 14,
            }}>
              {/* Pickup row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 13, height: 13, borderRadius: 6.5, backgroundColor: C.green, borderWidth: 2.5, borderColor: 'rgba(5,150,105,0.3)' }} />
                <TextInput
                  style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: '600', paddingVertical: 9 }}
                  placeholder="Pickup location..."
                  placeholderTextColor={C.textDim}
                  value={pickup}
                  onChangeText={(t) => {
                    setPickup(t);
                    searchPlaces(t, 'pickup');
                    if (pickupCoords || !t) { setPickupCoords(null); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; }
                  }}
                  returnKeyType="next"
                />
                {pickup ? (
                  <TouchableOpacity onPress={() => { setPickup(''); setPickupCoords(null); setPickupSugg([]); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; }} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={19} color={C.textDim} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={useMyLocation} style={{ padding: 7, borderRadius: 20, backgroundColor: C.pinkGlass, borderWidth: 1.5, borderColor: C.pinkBorder }}>
                    <Ionicons name="navigate" size={16} color={C.pink} />
                  </TouchableOpacity>
                )}
              </View>

              {pickupSugg.length > 0 && (
                <View style={[s.suggBox, { zIndex: 100 }]}>
                  {pickupSugg.slice(0, 5).map((sg: any, i: number) => (
                    <TouchableOpacity key={i} style={[s.suggItem, { paddingVertical: 12 }]}
                      onPress={() => { setPickup(sg.text); setPickupSugg([]); geocodePlace(sg.text, 'pickup'); }}>
                      <Ionicons name="location" size={15} color={C.green} style={{ marginRight: 8 }} />
                      <Text style={{ fontSize: 13, color: C.text, flex: 1, fontWeight: '500' }} numberOfLines={2}>{sg.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Divider with swap */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6, paddingLeft: 5 }}>
                <View style={{ width: 2, height: 18, backgroundColor: C.glassBorder }} />
                <TouchableOpacity
                  onPress={swapLocations}
                  style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.glassMid, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.glassBorder, marginLeft: 'auto', marginRight: 2 }}>
                  <Ionicons name="swap-vertical" size={14} color={C.pink} />
                </TouchableOpacity>
              </View>

              {/* Drop row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 13, height: 13, borderRadius: 3, backgroundColor: C.pink, borderWidth: 2.5, borderColor: C.pinkBorder }} />
                <TextInput
                  style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: '600', paddingVertical: 9 }}
                  placeholder="Where to?"
                  placeholderTextColor={C.textDim}
                  value={drop}
                  onChangeText={(t) => {
                    setDrop(t);
                    searchPlaces(t, 'drop');
                    if (dropCoords || !t) { setDropCoords(null); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; }
                  }}
                  returnKeyType="done"
                />
                {drop ? (
                  <TouchableOpacity onPress={() => { setDrop(''); setDropCoords(null); setDropSugg([]); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; }} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={19} color={C.textDim} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {dropSugg.length > 0 && (
                <View style={[s.suggBox, { zIndex: 100 }]}>
                  {dropSugg.slice(0, 5).map((sg: any, i: number) => (
                    <TouchableOpacity key={i} style={[s.suggItem, { paddingVertical: 12 }]}
                      onPress={() => { setDrop(sg.text); setDropSugg([]); geocodePlace(sg.text, 'drop'); }}>
                      <Ionicons name="flag" size={15} color={C.pink} style={{ marginRight: 8 }} />
                      <Text style={{ fontSize: 13, color: C.text, flex: 1, fontWeight: '500' }} numberOfLines={2}>{sg.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ETA calculating spinner */}
          {eta && eta.includes('Calculate') && (
            <View style={{ backgroundColor: C.yellowGlass, borderRadius: 12, padding: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.yellowBorder }}>
              <Text style={{ fontSize: 15 }}>🔄</Text>
              <Text style={{ color: C.yellow, fontWeight: '700', fontSize: 12 }}>{eta}</Text>
            </View>
          )}

          {/* ─── Vehicle selector ───────────────────────────── */}
          <Text style={{ fontSize: 11, fontWeight: '900', color: C.textDim, letterSpacing: 1.4, marginBottom: 10, marginTop: 2, marginLeft: 2 }}>
            CHOOSE VEHICLE
          </Text>
          <View style={{ gap: 10, marginBottom: 4 }}>
            {RIDES.map((r: any) => {
              const isSel = rideType === r.id;
              const isLux = r.id === 'luxury';
              const fareText = fareLoading ? '...' : fareEstimates[r.id] ? `₹${fareEstimates[r.id]}` : `₹${r.base}+`;
              return (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => setRideType(r.id)}
                  activeOpacity={0.72}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isSel ? '#FFF0F6' : C.bgCard,
                    borderRadius: 18,
                    padding: 14,
                    gap: 14,
                    borderWidth: isSel ? 2 : 1,
                    borderColor: isSel ? C.pink : isLux ? 'rgba(124,58,237,0.3)' : C.glassBorder,
                    elevation: isSel ? 8 : 2,
                    shadowColor: isSel ? C.pink : '#000',
                    shadowOpacity: isSel ? 0.18 : 0.04,
                    shadowRadius: isSel ? 12 : 6,
                  }}>

                  {/* Icon circle */}
                  <View style={{
                    width: 52, height: 52, borderRadius: 26,
                    backgroundColor: isSel ? C.pinkGlass : C.glassMid,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5,
                    borderColor: isSel ? C.pinkBorder : isLux ? 'rgba(124,58,237,0.25)' : C.glassBorder,
                  }}>
                    <RideVehicleIcon id={r.id} size={26} color={isSel ? C.pink : isLux ? C.purple : C.textMuted} />
                  </View>

                  {/* Label + desc + eta */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: isSel ? C.text : C.textMuted }}>{r.label}</Text>
                      {r.tag && (
                        <View style={{ backgroundColor: isLux ? C.purple : r.tagColor, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }}>{r.tag}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>{r.desc}</Text>
                    <Text style={{ color: C.textDim, fontSize: 11, marginTop: 3 }}>🕐 {r.eta}</Text>
                  </View>

                  {/* Fare + selected indicator */}
                  <View style={{ alignItems: 'flex-end', minWidth: 64 }}>
                    <Text style={{
                      fontSize: 18, fontWeight: '900',
                      color: fareLoading ? C.textDim : isSel ? C.yellow : isLux ? C.purple : C.textMuted,
                    }}>{fareText}</Text>
                    {isSel ? (
                      <View style={{ marginTop: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 4 }}>
                        <Ionicons name="checkmark" size={13} color="#fff" />
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ─── Fare breakdown ─────────────────────────────── */}
          {selRide && hasFare ? (
            <View style={{
              backgroundColor: C.bgCard,
              borderRadius: 20,
              marginTop: 16,
              elevation: 5,
              overflow: 'hidden',
              borderWidth: 1.5,
              borderColor: C.glassBorder,
              shadowColor: C.pink,
              shadowOpacity: 0.08,
              shadowRadius: 14,
            }}>
              {/* Header row */}
              <View style={{ backgroundColor: '#FFF0F6', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: C.glassBorder }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.pinkGlass, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.pinkBorder }}>
                  <RideVehicleIcon id={selRide.id} size={19} color={C.pink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '800', fontSize: 14 }}>{selRide.label}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 1 }}>{selRide.desc}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: C.yellow, fontWeight: '900', fontSize: 22 }}>₹{finalFare}</Text>
                  {discount > 0 && <Text style={{ color: C.textDim, fontSize: 11, textDecorationLine: 'line-through' }}>₹{rawFare}</Text>}
                </View>
              </View>

              {/* Line items */}
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
                    <Text style={{ fontSize: 13, color: C.green, fontWeight: '700' }}>Discount{promoCode ? ` (${promoCode})` : ''}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: C.green }}>−₹{discount}</Text>
                  </View>
                )}
                <View style={{ height: 1, backgroundColor: C.glassBorder, marginVertical: 2 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>Total</Text>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: C.yellow }}>₹{finalFare}</Text>
                </View>
              </View>

              {/* Instant promo offer */}
              {!instantApplied && discount === 0 && (
                <TouchableOpacity
                  onPress={() => { setPromoDiscount(10); setPromoCode('SPPERO10'); setInstantApplied(true); }}
                  style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: C.greenGlass, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: C.greenBorder, borderStyle: 'dashed' }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.green + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 17 }}>🎁</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: C.green }}>₹10 OFF — Instant Discount</Text>
                    <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Tap to apply • No code needed</Text>
                  </View>
                  <View style={{ backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, elevation: 2 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>APPLY</Text>
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

              {/* Promo code toggle */}
              <TouchableOpacity
                onPress={() => setShowPromoInput((p: boolean) => !p)}
                style={{ marginHorizontal: 16, marginBottom: showPromoInput ? 0 : 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.pink }}>🏷️ Have a promo code?</Text>
                <Ionicons name={showPromoInput ? 'chevron-up' : 'chevron-down'} size={14} color={C.pink} />
              </TouchableOpacity>
              {showPromoInput && (
                <View style={{ marginHorizontal: 16, marginBottom: 14, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.glassMid, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: C.glassBorder }}>
                  <Ionicons name="pricetag" size={16} color={C.textMuted} />
                  <TextInput
                    style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: '700', letterSpacing: 1 }}
                    placeholder="Enter promo code"
                    placeholderTextColor={C.textDim}
                    autoCapitalize="characters"
                    value={promoCode}
                    onChangeText={setPromoCode}
                  />
                  <TouchableOpacity onPress={applyPromo} style={{ backgroundColor: C.pink, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, elevation: 4, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 6 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Apply</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : fareLoading ? (
            <View style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 20, marginTop: 16, alignItems: 'center', gap: 8, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
              <Text style={{ fontSize: 24 }}>⏳</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.textMuted }}>Calculating fare...</Text>
            </View>
          ) : null}

          {result ? <Text style={[s.err, { marginTop: 12 }]}>{result}</Text> : null}
        </ScrollView>

        {/* ─── Sticky book button — always visible ─── */}
        <View style={{
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'android' ? 20 : 28,
          backgroundColor: C.bg,
          borderTopWidth: 1,
          borderTopColor: C.glassBorder,
        }}>
          <Bouncy
            style={[{ borderRadius: 18, overflow: 'hidden' }, loading && { opacity: 0.72 }]}
            onPress={bookRide}
            disabled={loading}>
            <View style={{
              backgroundColor: loading ? C.glassMid : hasFare ? C.pink : '#C0C6D4',
              paddingVertical: 17,
              paddingHorizontal: 24,
              borderRadius: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              elevation: hasFare && !loading ? 10 : 1,
              shadowColor: C.pink,
              shadowOpacity: hasFare && !loading ? 0.50 : 0,
              shadowRadius: 14,
            }}>
              {!loading && <RideVehicleIcon id={rideType} size={20} color="#fff" />}
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 }}>
                  {loading ? 'Finding driver...' : `Book ${selRide?.label || 'Ride'}`}
                </Text>
                {!loading && (
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 1 }}>
                    {hasFare ? `₹${finalFare}${discount > 0 ? ` · saved ₹${discount}` : ''}` : 'Set route to see fare'}
                  </Text>
                )}
              </View>
            </View>
          </Bouncy>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
