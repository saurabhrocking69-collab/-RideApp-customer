import { KeyboardAvoidingView, Platform, ScrollView, TextInput, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, MapOverlay, MapWebView, RideVehicleIcon } from '../components/ui';
import { s } from '../styles';
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

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setScreen('home'); setPickupSugg([]); setDropSugg([]); setEta(''); setPromoCode(''); setPromoDiscount(0); setInstantApplied(false); setShowPromoInput(false); }} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.topTitle}>Book a Ride</Text>
          <Text style={{ color: '#9ba5b7', fontSize: 11, marginTop: 1 }}>Live fares · Lucknow</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.mapFit}>
        <MapWebView pickupCoords={pickupCoords} dropCoords={dropCoords} height={200} />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} />
      </View>

      <View style={{ flex: 1, backgroundColor: '#f7f8fc', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingBottom: 36, paddingHorizontal: 14, paddingTop: 16 }}>

          {pickupCoords && dropCoords ? (
            <TouchableOpacity activeOpacity={0.88}
              onPress={() => { setPickupCoords(null); setDropCoords(null); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; }}
              style={{ backgroundColor: '#fff', borderRadius: 18, marginBottom: 14, elevation: 3, overflow: 'hidden' }}>
              <View style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                  <TouchableOpacity onPress={e => { e.stopPropagation(); swapLocations(); }}
                    style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#f5f6fa', alignItems: 'center', justifyContent: 'center', marginRight: 12, alignSelf: 'center', borderWidth: 1, borderColor: '#ebebeb' }}>
                    <Ionicons name="swap-vertical" size={16} color="#555" />
                  </TouchableOpacity>
                  <View style={{ width: 14, alignItems: 'center', marginRight: 10, paddingVertical: 2 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF50', borderWidth: 2, borderColor: '#a5d6a7' }} />
                    <View style={{ flex: 1, width: 2, backgroundColor: '#e0e0e0', marginVertical: 3 }} />
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#e94560' }} />
                  </View>
                  <View style={{ flex: 1, gap: 11 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: '#1a1a2e' }}>{pickup}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: '#1a1a2e' }}>{drop}</Text>
                  </View>
                </View>
              </View>
              {eta && !eta.includes('Calculate') && (
                <View style={{ backgroundColor: '#edf7ed', paddingHorizontal: 14, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12 }}>🗺️</Text>
                  <Text style={{ color: '#2e7d32', fontWeight: '700', fontSize: 12, flex: 1 }}>{eta}</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 14, elevation: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 11, height: 11, borderRadius: 5.5, backgroundColor: '#4CAF50', borderWidth: 2, borderColor: '#a5d6a7' }} />
                <TextInput style={{ flex: 1, fontSize: 14, color: '#1a1a2e', fontWeight: '500', paddingVertical: 7 }}
                  placeholder="Pickup location..." placeholderTextColor="#bbb" value={pickup}
                  onChangeText={(t) => { setPickup(t); searchPlaces(t, 'pickup'); if (pickupCoords || !t) { setPickupCoords(null); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; } }}
                  returnKeyType="next" />
                {pickup ? (
                  <TouchableOpacity onPress={() => { setPickup(''); setPickupCoords(null); setPickupSugg([]); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; }} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={18} color="#ccc" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={useMyLocation} style={{ padding: 5, borderRadius: 18, backgroundColor: '#f5f6fa' }}>
                    <Ionicons name="navigate" size={16} color="#e94560" />
                  </TouchableOpacity>
                )}
              </View>
              {pickupSugg.length > 0 && (
                <View style={[s.suggBox, { zIndex: 100 }]}>
                  {pickupSugg.slice(0, 5).map((sg, i) => (
                    <TouchableOpacity key={i} style={[s.suggItem, { paddingVertical: 12 }]} onPress={() => { setPickup(sg.text); setPickupSugg([]); geocodePlace(sg.text, 'pickup'); }}>
                      <Ionicons name="location" size={15} color="#e94560" style={{ marginRight: 8 }} />
                      <Text style={{ fontSize: 13, color: '#1a1a2e', flex: 1, fontWeight: '500' }} numberOfLines={2}>{sg.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
                <TouchableOpacity onPress={swapLocations} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f5f6fa', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e8e8e8', marginRight: 10 }}>
                  <Ionicons name="swap-vertical" size={14} color="#888" />
                </TouchableOpacity>
                <View style={{ width: 2, height: 18, backgroundColor: '#e8e8e8' }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: '#e94560' }} />
                <TextInput style={{ flex: 1, fontSize: 14, color: '#1a1a2e', fontWeight: '500', paddingVertical: 7 }}
                  placeholder="Drop location..." placeholderTextColor="#bbb" value={drop}
                  onChangeText={(t) => { setDrop(t); searchPlaces(t, 'drop'); if (dropCoords || !t) { setDropCoords(null); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; } }}
                  returnKeyType="done" />
                {drop ? (
                  <TouchableOpacity onPress={() => { setDrop(''); setDropCoords(null); setDropSugg([]); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; }} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={18} color="#ccc" />
                  </TouchableOpacity>
                ) : null}
              </View>
              {dropSugg.length > 0 && (
                <View style={[s.suggBox, { zIndex: 100 }]}>
                  {dropSugg.slice(0, 5).map((sg, i) => (
                    <TouchableOpacity key={i} style={[s.suggItem, { paddingVertical: 12 }]} onPress={() => { setDrop(sg.text); setDropSugg([]); geocodePlace(sg.text, 'drop'); }}>
                      <Ionicons name="flag" size={15} color="#1a1a2e" style={{ marginRight: 8 }} />
                      <Text style={{ fontSize: 13, color: '#1a1a2e', flex: 1, fontWeight: '500' }} numberOfLines={2}>{sg.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
          {eta && eta.includes('Calculate') && (
            <View style={{ backgroundColor: '#fff3e0', borderRadius: 12, padding: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 15 }}>🔄</Text>
              <Text style={{ color: '#e65100', fontWeight: '700', fontSize: 12 }}>{eta}</Text>
            </View>
          )}

          <Text style={{ fontSize: 13, fontWeight: '800', color: '#888', letterSpacing: 1, marginBottom: 10, marginLeft: 2 }}>CHOOSE VEHICLE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -14 }} contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingBottom: 4 }}>
            {RIDES.map(r => {
              const isSel = rideType === r.id;
              const isLux = r.id === 'luxury';
              const fareText = fareLoading ? '...' : fareEstimates[r.id] ? `₹${fareEstimates[r.id]}` : `₹${r.base}+`;
              return (
                <TouchableOpacity key={r.id} onPress={() => setRideType(r.id)}
                  style={{ width: 86, backgroundColor: isSel ? '#1a1a2e' : '#fff', borderRadius: 16, padding: 12, alignItems: 'center',
                    borderWidth: 2, borderColor: isSel ? '#e94560' : isLux ? '#e8d5f5' : '#ebebeb',
                    elevation: isSel ? 6 : 1, shadowColor: isSel ? '#e94560' : '#000', shadowOpacity: isSel ? 0.2 : 0.04, shadowRadius: 8 }}>
                  {r.tag ? (
                    <View style={{ position: 'absolute', top: -1, right: -1, backgroundColor: isLux ? '#9C27B0' : r.tagColor, borderRadius: 8, borderTopRightRadius: 14, paddingHorizontal: 5, paddingVertical: 2 }}>
                      <Text style={{ color: '#fff', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 }}>{r.tag}</Text>
                    </View>
                  ) : null}
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: isSel ? 'rgba(233,69,96,0.15)' : isLux ? '#f3e5f5' : '#f5f6fa', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <RideVehicleIcon id={r.id} size={22} color={isSel ? '#e94560' : isLux ? '#9C27B0' : '#1a1a2e'} />
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: isSel ? '#fff' : '#1a1a2e', textAlign: 'center', marginBottom: 4 }}>{r.label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: fareLoading ? '#bbb' : isSel ? '#e94560' : isLux ? '#9C27B0' : '#1a1a2e' }}>{fareText}</Text>
                  <Text style={{ fontSize: 9, color: isSel ? '#7a8595' : '#bbb', marginTop: 2 }}>{r.eta}</Text>
                  {isSel && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#e94560', marginTop: 6 }} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selRide && hasFare ? (
            <View style={{ backgroundColor: '#fff', borderRadius: 20, marginTop: 16, elevation: 3, overflow: 'hidden' }}>
              <View style={{ backgroundColor: '#1a1a2e', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(233,69,96,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <RideVehicleIcon id={selRide.id} size={18} color="#e94560" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{selRide.label}</Text>
                  <Text style={{ color: '#7a8595', fontSize: 11, marginTop: 1 }}>{selRide.desc}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#e94560', fontWeight: '900', fontSize: 18 }}>₹{finalFare}</Text>
                  {discount > 0 && <Text style={{ color: '#7a8595', fontSize: 11, textDecorationLine: 'line-through' }}>₹{rawFare}</Text>}
                </View>
              </View>

              <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: '#555' }}>Base fare</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a2e' }}>₹{selRide.base}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: '#555' }}>Distance charge</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a2e' }}>₹{rawFare - selRide.base > 0 ? rawFare - selRide.base : '—'}</Text>
                </View>
                {discount > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#2e7d32', fontWeight: '600' }}>Discount {promoCode ? `(${promoCode})` : ''}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#2e7d32' }}>−₹{discount}</Text>
                  </View>
                )}
                <View style={{ height: 1, backgroundColor: '#f0f0f0', marginVertical: 4 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a2e' }}>Total</Text>
                  <Text style={{ fontSize: 17, fontWeight: '900', color: '#e94560' }}>₹{finalFare}</Text>
                </View>
              </View>

              {!instantApplied && discount === 0 && (
                <TouchableOpacity onPress={() => { setPromoDiscount(10); setPromoCode('SPPERO10'); setInstantApplied(true); }}
                  style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#bbf7d0', borderStyle: 'dashed' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 16 }}>🎁</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#15803d' }}>₹10 OFF — Instant Discount</Text>
                    <Text style={{ fontSize: 11, color: '#4ade80', marginTop: 1 }}>Tap to apply • No code needed</Text>
                  </View>
                  <View style={{ backgroundColor: '#15803d', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>APPLY</Text>
                  </View>
                </TouchableOpacity>
              )}
              {instantApplied && (
                <View style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>✅</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#15803d', flex: 1 }}>₹10 instant discount applied!</Text>
                  <TouchableOpacity onPress={() => { setPromoDiscount(0); setPromoCode(''); setInstantApplied(false); }}>
                    <Ionicons name="close-circle" size={20} color="#86efac" />
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity onPress={() => setShowPromoInput((p: boolean) => !p)}
                style={{ marginHorizontal: 16, marginBottom: showPromoInput ? 0 : 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#e94560' }}>🏷️ Have a promo code?</Text>
                <Ionicons name={showPromoInput ? 'chevron-up' : 'chevron-down'} size={14} color="#e94560" />
              </TouchableOpacity>
              {showPromoInput && (
                <View style={{ marginHorizontal: 16, marginBottom: 14, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8f9fc', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#ebebeb' }}>
                  <Ionicons name="pricetag" size={16} color="#999" />
                  <TextInput style={{ flex: 1, fontSize: 13, color: '#1a1a2e', fontWeight: '700', letterSpacing: 1 }}
                    placeholder="Enter promo code" placeholderTextColor="#ccc"
                    autoCapitalize="characters" value={promoCode} onChangeText={setPromoCode} />
                  <TouchableOpacity onPress={applyPromo} style={{ backgroundColor: '#1a1a2e', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Apply</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : fareLoading ? (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginTop: 16, alignItems: 'center', gap: 8, elevation: 2 }}>
              <Text style={{ fontSize: 22 }}>⏳</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#aaa' }}>Calculating fare...</Text>
            </View>
          ) : null}

          {result ? <Text style={[s.err, { marginTop: 12 }]}>{result}</Text> : null}

          <Bouncy style={[{ borderRadius: 18, overflow: 'hidden', marginTop: 18 }, loading && { opacity: 0.7 }]} onPress={bookRide} disabled={loading}>
            <View style={{ backgroundColor: loading ? '#aaa' : '#e94560', paddingVertical: 18, paddingHorizontal: 24, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
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

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
