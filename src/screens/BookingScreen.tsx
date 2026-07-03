import { Animated, KeyboardAvoidingView, Platform, ScrollView, StatusBar, TextInput, Text, TouchableOpacity, View } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Storage as AsyncStorage } from '../storage';
import { useApp } from '../context/AppContext';
import { Bouncy, GlassPanel, MapOverlay, RideVehicleIcon, DotBG } from '../components/ui';
import { LiveMap } from '../components/LiveMap';
import { s, C, T, R, SP, SHADOW } from '../styles';
import { RIDES, MAPS_KEY } from '../constants';
import { apiGet, externalGet } from '../../api';
import { useNearbyDrivers } from '../offline';

const MAP_H = 290; // includes ~90px for floating transparent header above visible map

export function BookingScreen() {
  const {
    screen, setScreen,
    pickup, setPickup, drop, setDrop,
    pickupCoords, setPickupCoords, dropCoords, setDropCoords,
    pickupSugg, setPickupSugg, dropSugg, setDropSugg,
    eta, setEta,
    rideType, setRideType,
    appConfig,
    fareEstimates, setFareEstimates, fareLoading,
    promoDiscount, setPromoDiscount,
    promoCode, setPromoCode,
    instantApplied, setInstantApplied,
    showPromoInput, setShowPromoInput,
    result, loading,
    lastFetchKey,
    searchPlaces, geocodePlace, useMyLocation, swapLocations, applyPromo, bookRide,
    dropHistory,
    userCoords,
  } = useApp();

  const selRide   = RIDES.find(r => r.id === rideType);
  const cardAnims = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(RIDES.map((r: any) => [r.id, new Animated.Value(1)]))
  ).current;
  const cardEntryAnims = useRef<Record<string, { ty: Animated.Value; op: Animated.Value }>>(
    Object.fromEntries(RIDES.map((r: any) => [r.id, { ty: new Animated.Value(38), op: new Animated.Value(0) }]))
  ).current;
  const bookPulseAnim = useRef(new Animated.Value(1)).current;
  const _est      = fareEstimates[rideType];
  const rawFare   = (_est?.fare ?? _est) || 0;
  const estBase   = _est?.base_fare ?? appConfig?.fares?.[rideType]?.base_fare ?? selRide?.base ?? 0;
  const discount  = promoDiscount;
  const finalFare = Math.max(0, rawFare - discount);
  const hasFare   = rawFare > 0 && !fareLoading;

  const showDropSugg = dropSugg.length > 0;
  const showDropHist = dropSugg.length === 0 && !drop && !dropCoords && dropHistory.length > 0;
  const hasDropDown  = showDropSugg || showDropHist;

  type EtaInfo = { dist_km: number; eta_min: number };
  const [driverEta, setDriverEta]         = useState<Record<string, EtaInfo>>({});
  const [etaLoaded, setEtaLoaded]         = useState(false);
  const [showWaitModal, setShowWaitModal] = useState(false);
  const [waitConfirmed, setWaitConfirmed] = useState(false);
  const [nearbyPlaces, setNearbyPlaces]   = useState<any[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [surgeMultiplier, setSurgeMultiplier] = useState(1.0);
  const [surgeLabel, setSurgeLabel]           = useState<string | null>(null);
  const [fareHistoryEntry, setFareHistoryEntry] = useState<{ fare: number; date: string } | null>(null);
  // Load fare history for current pickup+drop+rideType combo
  useEffect(() => {
    if (!pickup || !drop) { setFareHistoryEntry(null); return; }
    AsyncStorage.getItem('sppero_fare_history').then(raw => {
      if (!raw) return;
      const hist: any[] = JSON.parse(raw);
      const match = hist.find(h => h.pickup === pickup && h.drop === drop && h.rideType === rideType);
      setFareHistoryEntry(match ? { fare: match.fare, date: match.date } : null);
    }).catch(() => {});
  }, [pickup, drop, rideType]);

  // Fetch surge when pickup coords change
  useEffect(() => {
    if (!pickupCoords?.lat || !pickupCoords?.lng) { setSurgeMultiplier(1.0); setSurgeLabel(null); return; }
    apiGet(`/api/rides/surge-check?lat=${pickupCoords.lat}&lng=${pickupCoords.lng}`)
      .then(d => { if (!d._error) { setSurgeMultiplier(d.surge || 1.0); setSurgeLabel(d.label || null); } })
      .catch(() => {});
  }, [pickupCoords?.lat, pickupCoords?.lng]);

  // Nearby drivers — cached hook (auto-refreshes every 20s, shows stale instantly)
  const nbLat = pickupCoords?.lat || userCoords?.latitude || userCoords?.lat;
  const nbLng = pickupCoords?.lng || userCoords?.longitude || userCoords?.lng;
  const { data: nearbyDriversData } = useNearbyDrivers(nbLat, nbLng);
  const nearbyDrivers = (Array.isArray(nearbyDriversData) ? nearbyDriversData : []) as { lat: number; lng: number; vehicleType: string }[];

  useEffect(() => {
    if (!pickupCoords?.lat || !pickupCoords?.lng) { setDriverEta({}); setEtaLoaded(false); return; }
    let cancelled = false;
    setEtaLoaded(false);
    const fetchEta = () => {
      apiGet(`/api/rides/driver-eta?pickup_lat=${pickupCoords.lat}&pickup_lng=${pickupCoords.lng}`)
        .then(d => { if (!cancelled) { setDriverEta(d.eta || {}); setEtaLoaded(true); } })
        .catch(() => { if (!cancelled) setEtaLoaded(true); });
    };
    fetchEta();
    const timer = setInterval(fetchEta, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [pickupCoords?.lat, pickupCoords?.lng]);

  // Staggered card entry on mount
  useEffect(() => {
    Animated.stagger(75, RIDES.map((r: any) =>
      Animated.parallel([
        Animated.spring(cardEntryAnims[r.id].ty, { toValue: 0, friction: 7, tension: 120, useNativeDriver: true }),
        Animated.timing(cardEntryAnims[r.id].op, { toValue: 1, duration: 230, useNativeDriver: true }),
      ])
    )).start();
  }, []);

  // Breathing pulse on book button when ready
  useEffect(() => {
    if (hasFare && !loading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.delay(1400),
          Animated.spring(bookPulseAnim, { toValue: 1.035, friction: 3, tension: 280, useNativeDriver: true }),
          Animated.spring(bookPulseAnim, { toValue: 1, friction: 3, tension: 280, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      bookPulseAnim.setValue(1);
    }
  }, [hasFare, loading]);

  useEffect(() => {
    if (!userCoords?.latitude || pickup) { setNearbyPlaces([]); return; }
    let cancelled = false;
    setPlacesLoading(true);
    const fetchPlaces = async () => {
      try {
        const { lat, lng } = userCoords;
        const [transit, malls] = await Promise.all([
          externalGet(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=2500&type=transit_station&key=${MAPS_KEY}`),
          externalGet(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=3500&type=shopping_mall&key=${MAPS_KEY}`),
        ]);
        if (cancelled) return;
        const allPlaces: any[] = [];
        (transit?.results || []).slice(0, 4).forEach((p: any) => allPlaces.push({ ...p, _type: 'transit' }));
        (malls?.results || []).slice(0, 3).forEach((p: any) => allPlaces.push({ ...p, _type: 'mall' }));
        setNearbyPlaces(allPlaces.filter(p => p.name && p.geometry?.location));
      } catch (_e) {}
      if (!cancelled) setPlacesLoading(false);
    };
    fetchPlaces();
    return () => { cancelled = true; };
  }, [userCoords?.lat, userCoords?.lng, pickup]);

  const placeIcon = (p: any) => {
    if (p._type === 'transit') return { emoji: '🚇', color: '#2563EB', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.25)' };
    if (p._type === 'mall') return { emoji: '🛍️', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)' };
    return { emoji: '📍', color: '#64748B', bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.2)' };
  };

  const selectNearbyPlace = (place: any) => {
    const loc = place.geometry?.location;
    if (!loc) return;
    setPickup(place.name);
    setPickupCoords({ lat: loc.lat, lng: loc.lng });
    setNearbyPlaces([]);
  };

  const handleBook = () => {
    const eta = driverEta[rideType];
    if (eta && eta.dist_km > 5) { setWaitConfirmed(false); setShowWaitModal(true); return; }
    bookRide();
  };

  // Reverse geocode a coordinate to a human-readable address
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await externalGet(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}`);
      const result = res?.results?.[0];
      if (!result) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      const comps = result.address_components || [];
      return (
        comps.find((c: any) => c.types.includes('sublocality_level_1'))?.long_name ||
        comps.find((c: any) => c.types.includes('sublocality'))?.long_name ||
        comps.find((c: any) => c.types.includes('locality'))?.long_name ||
        result.formatted_address?.split(',')[0] ||
        result.formatted_address
      );
    } catch (_e) { return `${lat.toFixed(4)}, ${lng.toFixed(4)}`; }
  };

  // Tap on map: set drop if pickup is set, otherwise set pickup
  const handleMapPress = async (coords: { lat: number; lng: number }) => {
    if (pickupCoords && !dropCoords) {
      const addr = await reverseGeocode(coords.lat, coords.lng);
      setDrop(addr);
      setDropCoords(coords);
      setDropSugg([]);
    } else if (!pickupCoords) {
      const addr = await reverseGeocode(coords.lat, coords.lng);
      setPickup(addr);
      setPickupCoords(coords);
      setPickupSugg([]);
    }
  };

  // Draggable pickup pin — re-geocode on drag end
  const handlePickupDragEnd = async (coords: { lat: number; lng: number }) => {
    const addr = await reverseGeocode(coords.lat, coords.lng);
    setPickup(addr);
    setPickupCoords(coords);
    setFareEstimates({}); setEta(''); lastFetchKey.current = '';
  };

  // Draggable drop pin — re-geocode on drag end
  const handleDropDragEnd = async (coords: { lat: number; lng: number }) => {
    const addr = await reverseGeocode(coords.lat, coords.lng);
    setDrop(addr);
    setDropCoords(coords);
    setFareEstimates({}); setEta(''); lastFetchKey.current = '';
  };

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

      {/* ─── Map + floating transparent header ───────────── */}
      <View style={{ height: MAP_H, width: '100%' }}>
        <LiveMap
          pickupCoords={pickupCoords}
          dropCoords={dropCoords}
          userLat={userCoords?.latitude || userCoords?.lat}
          userLng={userCoords?.longitude || userCoords?.lng}
          userAccuracy={(userCoords as any)?.accuracy}
          height={MAP_H}
          mode="booking"
          showRoute={!!(pickupCoords && dropCoords)}
          nearbyDrivers={!pickupCoords || !dropCoords ? nearbyDrivers : []}
          onMapPress={handleMapPress}
          draggablePickup={!!pickupCoords}
          onPickupDragEnd={handlePickupDragEnd}
          draggableDrop={!!dropCoords}
          onDropDragEnd={handleDropDragEnd}
          showTapHint={!!pickupCoords && !dropCoords}
        />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} />
        {/* Glass header — 90% transparent, floats over map tiles */}
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          backgroundColor: 'rgba(233,30,99,0.10)',
          paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 54,
          paddingBottom: 16, paddingHorizontal: 16,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <TouchableOpacity
            onPress={() => { setScreen('home'); setPickupSugg([]); setDropSugg([]); setEta(''); setPromoCode(''); setPromoDiscount(0); setInstantApplied(false); setShowPromoInput(false); }}
            style={[s.backBtn, {
              width: 36, height: 36, borderRadius: 12,
              backgroundColor: 'rgba(15,23,42,0.45)',
              alignItems: 'center', justifyContent: 'center',
            }]}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[s.topTitle, { textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }]}>
              Book a Ride
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.90)', fontSize: 11, marginTop: 1, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
              Live fares · All India
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </View>

      {/* ─── Bottom sheet — glass panel floating over map ─── */}
      <Animated.View style={{
        flex: 1,
        opacity: sheetOpacity,
        transform: [{ translateY: sheetTranslate }],
      }}>
      <GlassPanel intensity={22} style={{
        flex: 1,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        marginTop: -28,
        elevation: 14,
        shadowColor: C.pink,
        shadowOpacity: 0.10,
        shadowRadius: 18,
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
            <>
              <View style={{
                backgroundColor: C.bgCard,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                borderBottomLeftRadius: hasDropDown ? 0 : 20,
                borderBottomRightRadius: hasDropDown ? 0 : 20,
                padding: 14,
                paddingBottom: hasDropDown ? 10 : 14,
                marginBottom: hasDropDown ? 0 : 14,
                elevation: 6,
                borderWidth: 1.5,
                borderBottomWidth: hasDropDown ? 0 : 1.5,
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

                {/* ─── Popular Nearby ─── */}
                {nearbyPlaces.length > 0 && !pickup && (
                  <View style={{ marginTop: 12, marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: C.textDim, letterSpacing: 0.8, textTransform: 'uppercase' }}>📍 Popular Nearby</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
                      {nearbyPlaces.map((place, i) => {
                        const ic = placeIcon(place);
                        return (
                          <TouchableOpacity
                            key={i}
                            onPress={() => selectNearbyPlace(place)}
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 7,
                              backgroundColor: ic.bg, borderRadius: 22,
                              paddingHorizontal: 13, paddingVertical: 9,
                              borderWidth: 1.5, borderColor: ic.border,
                              maxWidth: 200, elevation: 2,
                              shadowColor: ic.color, shadowOpacity: 0.12, shadowRadius: 6,
                            }}>
                            <Text style={{ fontSize: 16 }}>{ic.emoji}</Text>
                            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: C.text, flexShrink: 1 }}>{place.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
                {placesLoading && !pickup && nearbyPlaces.length === 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 4, paddingHorizontal: 4 }}>
                    <Text style={{ fontSize: 11, color: C.textDim }}>📍 Finding nearby spots...</Text>
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
              </View>

              {/* ── Attached dropdown — appears directly below input card ── */}
              {hasDropDown && (
                <View style={{
                  backgroundColor: C.bgCard,
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                  borderBottomLeftRadius: 20,
                  borderBottomRightRadius: 20,
                  marginBottom: 14,
                  elevation: 18,
                  borderWidth: 1.5,
                  borderTopWidth: 0,
                  borderColor: C.glassBorder,
                  shadowColor: C.pink,
                  shadowOpacity: 0.14,
                  shadowRadius: 14,
                  overflow: 'hidden',
                }}>
                  {/* Thin separator line */}
                  <View style={{ height: 1, backgroundColor: C.glassBorder, marginHorizontal: 14 }} />

                  {showDropSugg && dropSugg.slice(0, 5).map((sg: any, i: number) => (
                    <TouchableOpacity key={i}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: i < Math.min(dropSugg.length, 5) - 1 ? 1 : 0, borderBottomColor: C.glassBorder }}
                      onPress={() => { setDrop(sg.text); setDropSugg([]); geocodePlace(sg.text, 'drop'); }}>
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.pinkGlass, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: C.pinkBorder }}>
                        <Ionicons name="flag" size={14} color={C.pink} />
                      </View>
                      <Text style={{ fontSize: 13, color: C.text, flex: 1, fontWeight: '500' }} numberOfLines={2}>{sg.text}</Text>
                      <Ionicons name="chevron-forward" size={14} color={C.textDim} />
                    </TouchableOpacity>
                  ))}

                  {showDropHist && (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 6 }}>
                        <Ionicons name="time" size={12} color={C.pink} />
                        <Text style={{ fontSize: 10, color: C.pink, fontWeight: '900', letterSpacing: 1.2 }}>RECENT DESTINATIONS</Text>
                      </View>
                      {dropHistory.map((h, i) => (
                        <TouchableOpacity key={i}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: C.glassBorder }}
                          onPress={() => {
                            setDrop(h.text); setDropSugg([]);
                            if (h.coords) { setDropCoords(h.coords); }
                            else { geocodePlace(h.text, 'drop'); }
                          }}>
                          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.glassMid, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: C.glassBorder }}>
                            <Ionicons name="location-outline" size={14} color={C.textMuted} />
                          </View>
                          <Text style={{ fontSize: 13, color: C.text, flex: 1, fontWeight: '500' }} numberOfLines={1}>{h.text}</Text>
                          <Ionicons name="chevron-forward" size={14} color={C.textDim} />
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </View>
              )}
            </>
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

          {/* ─── Nearest driver recommendation banner ─── */}
          {etaLoaded && (() => {
            const nearest = RIDES
              .map(r => ({ r, info: driverEta[r.id] }))
              .filter(x => x.info)
              .sort((a, b) => (a.info?.eta_min || 999) - (b.info?.eta_min || 999))[0];
            if (!nearest) return null;
            return (
              <View style={{ backgroundColor: C.greenGlass, borderRadius: R.sm, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.greenBorder }}>
                <Text style={{ fontSize: 16 }}>💡</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.green, flex: 1 }}>
                  {nearest.r.label} is nearest — arriving in ~{nearest.info?.eta_min} min
                </Text>
                {rideType !== nearest.r.id && (
                  <TouchableOpacity onPress={() => setRideType(nearest.r.id)} style={{ backgroundColor: C.green, borderRadius: R.xs, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>Select</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}

          <View style={{ gap: 10, marginBottom: 4 }}>
            {RIDES.map((r: any) => {
              const isSel = rideType === r.id;
              const isLux = r.id === 'luxury';
              const cfgBase = appConfig?.fares?.[r.id]?.base_fare ?? r.base;
              const fareText = fareLoading ? '...' : fareEstimates[r.id] ? `₹${fareEstimates[r.id].fare ?? fareEstimates[r.id]}` : `₹${cfgBase}+`;
              const anim = cardAnims[r.id];
              const entry = cardEntryAnims[r.id];
              return (
                <Animated.View key={r.id} style={{ transform: [{ scale: anim }, { translateY: entry.ty }], opacity: entry.op }}>
                  <TouchableOpacity
                    onPress={() => {
                      setRideType(r.id);
                      RIDES.forEach((ride: any) => {
                        Animated.spring(cardAnims[ride.id], {
                          toValue: ride.id === r.id ? 1.015 : 1,
                          friction: 5, tension: 180, useNativeDriver: true,
                        }).start();
                      });
                    }}
                    activeOpacity={1}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isSel ? C.pinkGlass : C.bgCard,
                      borderRadius: R.md,
                      padding: SP.md,
                      gap: SP.md - 2,
                      borderWidth: isSel ? 1.5 : 1,
                      borderColor: isSel ? C.pink : isLux ? 'rgba(124,58,237,0.3)' : C.glassBorder,
                      overflow: 'hidden',
                      ...(isSel ? SHADOW.pink : SHADOW.sm),
                    }}>

                    {/* Left accent strip */}
                    <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3.5, backgroundColor: isSel ? C.pink : 'transparent', borderTopLeftRadius: R.md, borderBottomLeftRadius: R.md }} />

                    {/* Icon circle */}
                    <View style={{
                      width: 56, height: 56, borderRadius: 28,
                      backgroundColor: isSel ? C.pinkGlass : isLux ? C.purpleGlass : C.glassMid,
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: isSel ? 2 : 1.5,
                      borderColor: isSel ? C.pink : isLux ? C.purpleBorder : C.glassBorder,
                    }}>
                      <RideVehicleIcon id={r.id} size={27} color={isSel ? C.pink : isLux ? C.purple : C.textMuted} />
                    </View>

                    {/* Label + desc + eta */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ ...T.bodyBold, fontSize: 15, color: isSel ? C.text : C.textMuted }}>{r.label}</Text>
                        {r.tag && (
                          <View style={{ backgroundColor: isLux ? C.purple : r.tagColor, borderRadius: R.xs - 2, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }}>{r.tag}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ ...T.caption, color: C.textDim, marginTop: 2 }}>{r.desc}</Text>
                      {!etaLoaded ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.textDim }} />
                          <Text style={{ fontSize: 10, color: C.textDim }}>{r.eta}</Text>
                        </View>
                      ) : (() => {
                        const info = driverEta[r.id];
                        if (!info) {
                          const bestAlt = RIDES
                            .filter(alt => alt.id !== r.id && driverEta[alt.id])
                            .sort((a, b) => ((driverEta[a.id]?.eta_min || 999) - (driverEta[b.id]?.eta_min || 999)))[0];
                          return (
                            <View style={{ marginTop: 4 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.textMuted }} />
                                <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '600' }}>Not available in this area right now</Text>
                              </View>
                              {bestAlt && (
                                <TouchableOpacity
                                  onPress={() => setRideType(bestAlt.id)}
                                  style={{ marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.pinkGlass, borderRadius: R.xs - 2, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
                                  <Text style={{ fontSize: 10, color: C.pink, fontWeight: '800' }}>
                                    Try {bestAlt.label} · ~{driverEta[bestAlt.id]?.eta_min} min
                                  </Text>
                                  <Ionicons name="arrow-forward" size={10} color={C.pink} />
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        }
                        const isFar = info.dist_km > 5;
                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isFar ? C.yellow : C.green }} />
                            <Text style={{ fontSize: 10, color: isFar ? C.yellow : C.green, fontWeight: '800' }}>
                              {isFar ? `${info.dist_km} km away · ~${info.eta_min} min wait` : `~${info.eta_min} min · ${info.dist_km} km away`}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>

                    {/* Fare + selection pill */}
                    <View style={{ alignItems: 'flex-end', minWidth: 62 }}>
                      <Text style={{
                        fontSize: 19, fontWeight: '900',
                        color: fareLoading ? C.textDim : isSel ? C.pink : isLux ? C.purple : C.textMuted,
                      }}>{fareText}</Text>
                      {isSel ? (
                        <View style={{ marginTop: 5, backgroundColor: C.pink, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3, elevation: 4, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 6 }}>
                          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>SELECTED</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          {/* ─── Live driver availability banner ─── */}
          {etaLoaded && (() => {
            const info = driverEta[rideType];
            const selLabel = RIDES.find(r => r.id === rideType)?.label || 'Ye vehicle';

            if (info) {
              const isFar = info.dist_km > 5;
              return (
                <View style={{ backgroundColor: isFar ? C.yellowGlass : C.greenGlass, borderRadius: R.sm, padding: 14, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: isFar ? C.yellowBorder : C.greenBorder }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isFar ? C.yellowGlass : C.greenGlass, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20 }}>{isFar ? '🕐' : '✅'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: isFar ? C.yellow : C.green }}>
                      {selLabel} driver {isFar ? 'is a bit far' : 'is nearby'}
                    </Text>
                    <Text style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>
                      {info.dist_km} km away · arriving in ~{info.eta_min} min
                    </Text>
                  </View>
                </View>
              );
            }

            const availables = RIDES
              .filter(r => driverEta[r.id])
              .sort((a, b) => ((driverEta[a.id]?.eta_min || 999) - (driverEta[b.id]?.eta_min || 999)));
            if (availables.length === 0) return (
              <View style={{ backgroundColor: C.redGlass, borderRadius: R.sm, padding: 14, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: C.redBorder }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.redGlass, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 20 }}>😕</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.red }}>No driver online in this area</Text>
                  <Text style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>Please try again in a moment</Text>
                </View>
              </View>
            );
            return (
              <View style={{ backgroundColor: C.yellowGlass, borderRadius: R.sm, padding: 14, marginTop: 10, borderWidth: 1.5, borderColor: C.yellowBorder }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Text style={{ fontSize: 16 }}>⚡</Text>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: C.yellow, flex: 1 }}>
                    {selLabel} not available right now — try these:
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {availables.slice(0, 3).map(alt => (
                    <TouchableOpacity
                      key={alt.id}
                      onPress={() => setRideType(alt.id)}
                      style={{ backgroundColor: C.pink, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 4, shadowColor: C.pink, shadowOpacity: 0.35, shadowRadius: 6 }}>
                      <RideVehicleIcon id={alt.id} size={13} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>
                        {alt.label} · ~{driverEta[alt.id]?.eta_min} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })()}

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
              {/* Surge banner */}
              {surgeLabel && (
                <View style={{ backgroundColor: C.saffGlass, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderColor: C.saffBorder }}>
                  <Text style={{ fontSize: 16 }}>🔥</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.saffron, fontWeight: '900', fontSize: 12 }}>SURGE PRICING — {surgeLabel}</Text>
                    <Text style={{ color: C.saffron, fontSize: 10, marginTop: 1, opacity: 0.8 }}>High demand in your area right now</Text>
                  </View>
                  <View style={{ backgroundColor: C.saffron, borderRadius: R.xs, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{surgeLabel}</Text>
                  </View>
                </View>
              )}

              {/* Header row */}
              <View style={{ backgroundColor: C.pinkGlass, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: C.glassBorder }}>
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
                  {fareHistoryEntry && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: C.greenGlass, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: C.greenBorder }}>
                      <Text style={{ fontSize: 9, color: C.green, fontWeight: '700' }}>
                        Last time: ₹{fareHistoryEntry.fare}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Line items */}
              <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: C.textMuted }}>Base fare</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>₹{estBase}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: C.textMuted }}>Distance charge</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>₹{rawFare - estBase > 0 ? rawFare - estBase : '—'}</Text>
                </View>
                {surgeLabel && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: C.saffron, fontWeight: '700' }}>🔥 Surge ({surgeLabel})</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: C.saffron }}>Applied</Text>
                  </View>
                )}
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
          borderTopWidth: 1.5,
          borderTopColor: 'rgba(255,45,120,0.18)',
        }}>
          <Animated.View style={{ transform: [{ scale: bookPulseAnim }] }}>
          <Bouncy
            style={[{ borderRadius: 18, overflow: 'hidden' }, loading && { opacity: 0.72 }]}
            onPress={handleBook}
            disabled={loading}>
            <View style={{
              backgroundColor: loading ? C.glassMid : hasFare ? C.pink : C.glassMid,
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
          </Animated.View>
        </View>
      </GlassPanel>
      </Animated.View>

      {/* ─── Far-driver commitment modal ─── */}
      {showWaitModal && (() => {
        const info = driverEta[rideType];
        const extraMin = info ? Math.max(0, info.eta_min - 5) : 0;
        const selLabel = RIDES.find(r => r.id === rideType)?.label || 'Ride';
        return (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end', zIndex: 999 }}>
            <View style={{ backgroundColor: C.bgDark, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderTopWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' }}>

              {/* Warning icon + title */}
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.yellowGlass, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 2, borderColor: C.yellowBorder }}>
                  <Text style={{ fontSize: 28 }}>⚠️</Text>
                </View>
                <Text style={{ fontSize: 19, fontWeight: '900', color: '#fff' }}>Driver is a Bit Far</Text>
                <Text style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>{selLabel} driver is outside your pickup area</Text>
              </View>

              {/* Distance / ETA info card */}
              <View style={{ backgroundColor: C.yellowGlass, borderRadius: R.sm, padding: 16, marginBottom: 18, borderWidth: 1.5, borderColor: C.yellowBorder, gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: C.textDim }}>Driver distance</Text>
                  <View style={{ backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: C.yellow }}>{info?.dist_km} km</Text>
                  </View>
                </View>
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: C.textDim }}>Estimated wait time</Text>
                  <View style={{ backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: C.yellow }}>~{info?.eta_min} min</Text>
                  </View>
                </View>
                {extraMin > 0 && (
                  <>
                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: C.textDim }}>Extra wait</Text>
                      <View style={{ backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 14, fontWeight: '900', color: C.red }}>+{extraMin} min longer</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>

              {/* Commitment checkbox */}
              <TouchableOpacity
                onPress={() => setWaitConfirmed(v => !v)}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20, backgroundColor: waitConfirmed ? C.greenGlass : 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: waitConfirmed ? C.greenBorder : 'rgba(255,255,255,0.08)' }}>
                <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: waitConfirmed ? C.green : 'transparent', borderWidth: 2.5, borderColor: waitConfirmed ? C.green : 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                  {waitConfirmed && <Ionicons name="checkmark" size={15} color="#fff" />}
                </View>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: waitConfirmed ? C.green : 'rgba(255,255,255,0.75)', lineHeight: 19 }}>
                  Yes, I'll wait — I won't cancel the ride after booking
                </Text>
              </TouchableOpacity>

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setShowWaitModal(false)}
                  style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                  <Text style={{ fontWeight: '700', color: C.textMuted, fontSize: 14 }}>Go Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setShowWaitModal(false); bookRide(); }}
                  disabled={!waitConfirmed}
                  style={{ flex: 2, backgroundColor: waitConfirmed ? C.pink : C.glassMid, borderRadius: 14, paddingVertical: 16, alignItems: 'center', elevation: waitConfirmed ? 8 : 0, shadowColor: C.pink, shadowOpacity: waitConfirmed ? 0.45 : 0, shadowRadius: 12 }}>
                  <Text style={{ fontWeight: '900', color: waitConfirmed ? '#fff' : C.textMuted, fontSize: 15 }}>
                    {waitConfirmed ? 'Book Now →' : 'Confirm First'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: Platform.OS === 'android' ? 20 : 30 }} />
            </View>
          </View>
        );
      })()}
    </KeyboardAvoidingView>
  );
}
