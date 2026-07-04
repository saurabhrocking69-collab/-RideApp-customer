import { Animated, Dimensions, KeyboardAvoidingView, Platform, ScrollView, StatusBar, TextInput, Text, TouchableOpacity, View } from 'react-native';
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

const SCREEN_H   = Dimensions.get('window').height;
const MAP_BIG    = Math.floor(SCREEN_H * 0.62); // > half screen — default and post-route
const MAP_MED    = Math.floor(SCREEN_H * 0.38); // while entering one location
const MAP_SMALL  = Platform.OS === 'android' ? 110 : 130; // collapsed — keyboard visible

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

  // ── Saved places (Home / Office / Other) ────────────────────────────────────
  type SavedPlace = { text: string; coords: { lat: number; lng: number } };
  type SavedPlaces = { home: SavedPlace | null; office: SavedPlace | null; others: SavedPlace[] };
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaces>({ home: null, office: null, others: [] });
  const [showSavePicker, setShowSavePicker] = useState(false);
  const [saveTarget, setSaveTarget] = useState<SavedPlace | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('sppero_saved_places').then(raw => {
      if (raw) setSavedPlaces(JSON.parse(raw));
    }).catch(() => {});
  }, []);

  const persistSavedPlaces = async (updated: SavedPlaces) => {
    setSavedPlaces(updated);
    await AsyncStorage.setItem('sppero_saved_places', JSON.stringify(updated)).catch(() => {});
  };

  const savePlaceAs = (type: 'home' | 'office' | 'other') => {
    if (!saveTarget) return;
    const updated = { ...savedPlaces };
    if (type === 'home')   updated.home   = saveTarget;
    else if (type === 'office') updated.office = saveTarget;
    else updated.others = [saveTarget, ...savedPlaces.others.filter(o => o.text !== saveTarget.text)].slice(0, 3);
    persistSavedPlaces(updated);
    setShowSavePicker(false);
  };

  const removeSavedPlace = (type: 'home' | 'office') => {
    persistSavedPlaces({ ...savedPlaces, [type]: null });
  };

  const openSavePicker = (place: SavedPlace) => {
    setSaveTarget(place);
    setShowSavePicker(true);
  };

  const selectSaved = (place: SavedPlace) => {
    setDrop(place.text); setDropSugg([]);
    setDropCoords(place.coords);
  };

  const hasSavedPlaces = !!(savedPlaces.home || savedPlaces.office || savedPlaces.others.length > 0);

  const showDropSugg = dropSugg.length > 0;
  const showDropHist = dropSugg.length === 0 && !drop && !dropCoords && (dropHistory.length > 0 || hasSavedPlaces || !savedPlaces.home || !savedPlaces.office);
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

  // Haversine distance in km between two coords
  const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2
      + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(s));
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

  // Tap on map: only set pickup (drop is set via drag)
  const handleMapPress = async (coords: { lat: number; lng: number }) => {
    if (!pickupCoords) {
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

  // ── Drop drag mode ────────────────────────────────────────────────────────
  const centerCoordsRef  = useRef<{ lat: number; lng: number } | null>(null);
  const originalDropRef  = useRef<{ lat: number; lng: number } | null>(null); // saved when entering adjust mode
  const dragTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragCenter,   setDragCenter]   = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading,   setGeoLoading]   = useState(false);

  const confirmDropHere = async () => {
    const target = centerCoordsRef.current || pickupCoords;
    if (!target || geoLoading) return;
    // Enforce 1km radius when in adjustment mode
    if (originalDropRef.current && haversineKm(target, originalDropRef.current) > 1) return;
    setGeoLoading(true);
    const addr = await reverseGeocode(target.lat, target.lng);
    setDrop(addr);
    setDropCoords(target);
    setDropSugg([]);
    originalDropRef.current = null;
    setDragCenter(null);
    setGeoLoading(false);
  };

  // Enter drag-to-adjust mode: save original drop so 1km guard can reference it
  const enterAdjustMode = () => {
    if (dropCoords) {
      centerCoordsRef.current  = { ...dropCoords };
      originalDropRef.current  = { ...dropCoords };
      setDragCenter({ ...dropCoords });
    }
    setDropCoords(null);
    setFareEstimates({});
    setEta('');
    lastFetchKey.current = '';
  };

  // ── Route ETA (from LiveMap directions API callback) ─────────────────────────
  const [routeEta, setRouteEta]   = useState('');
  const [routeDist, setRouteDist] = useState('');
  // Reset when route is cleared
  useEffect(() => { if (!dropCoords) { setRouteEta(''); setRouteDist(''); } }, [dropCoords]);

  // ETA card animations
  const etaCardFade  = useRef(new Animated.Value(0)).current;
  const etaCardSlide = useRef(new Animated.Value(18)).current;
  const etaTimeFade  = useRef(new Animated.Value(0)).current;
  const etaTimeSlide = useRef(new Animated.Value(12)).current;
  const etaDistFade  = useRef(new Animated.Value(0)).current;
  const etaDistSlide = useRef(new Animated.Value(12)).current;
  const pulseDot     = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (routeEta && dropCoords) {
      // Card slides up
      Animated.parallel([
        Animated.spring(etaCardSlide, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
        Animated.timing(etaCardFade,  { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
      // Stats stagger in
      Animated.stagger(110, [
        Animated.parallel([
          Animated.spring(etaTimeSlide, { toValue: 0, friction: 9, tension: 110, useNativeDriver: true }),
          Animated.timing(etaTimeFade,  { toValue: 1, duration: 220, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.spring(etaDistSlide, { toValue: 0, friction: 9, tension: 110, useNativeDriver: true }),
          Animated.timing(etaDistFade,  { toValue: 1, duration: 220, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      etaCardFade.setValue(0); etaCardSlide.setValue(18);
      etaTimeFade.setValue(0); etaTimeSlide.setValue(12);
      etaDistFade.setValue(0); etaDistSlide.setValue(12);
    }
  }, [routeEta, dropCoords]);

  // Continuous pulse on the live dot
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseDot, { toValue: 1.9, duration: 750, useNativeDriver: true }),
      Animated.timing(pulseDot, { toValue: 1,   duration: 750, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Map height state machine ──────────────────────
  // Phases:
  //   !bothSet           → MAP_MED  (picking locations)
  //   bothSet, browsing  → MAP_SMALL (user scrolled into vehicle list)
  //   bothSet, !browsing → MAP_BIG  (route set OR vehicle just selected — confirmation peak)
  const [inputFocused,    setInputFocused]    = useState(false);
  const [vehicleBrowsing, setVehicleBrowsing] = useState(false);
  const bothSet    = !!(pickupCoords && dropCoords);
  const inDragMode = !!(pickupCoords && !dropCoords);

  // Reset browse mode when route is cleared
  useEffect(() => { if (!bothSet) setVehicleBrowsing(false); }, [bothSet]);

  const mapHeightAnim = useRef(new Animated.Value(MAP_MED)).current;
  useEffect(() => {
    // Priority: drag mode → always big so user can see map clearly
    const target = inDragMode
      ? MAP_BIG
      : inputFocused
        ? MAP_SMALL
        : !bothSet
          ? MAP_MED
          : vehicleBrowsing
            ? MAP_SMALL
            : MAP_BIG;
    Animated.spring(mapHeightAnim, { toValue: target, friction: 9, tension: 70, useNativeDriver: false }).start();
  }, [inDragMode, inputFocused, bothSet, vehicleBrowsing]);

  // ── fitKey — re-triggers fitToCoordinates when map expands ──
  const [fitKey, setFitKey] = useState(0);
  useEffect(() => {
    // Fire when map is about to expand: route just set, or vehicle selected (browsing→false)
    if (!bothSet || vehicleBrowsing) return;
    const t = setTimeout(() => setFitKey(k => k + 1), 720);
    return () => clearTimeout(t);
  }, [bothSet, vehicleBrowsing]);

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
      <Animated.View style={{ height: mapHeightAnim, width: '100%' }}>
        <LiveMap
          pickupCoords={pickupCoords}
          dropCoords={dropCoords}
          userLat={userCoords?.latitude || userCoords?.lat}
          userLng={userCoords?.longitude || userCoords?.lng}
          userAccuracy={(userCoords as any)?.accuracy}
          height={MAP_BIG}
          mode="booking"
          showRoute={!!(pickupCoords && dropCoords)}
          nearbyDrivers={!pickupCoords || !dropCoords ? nearbyDrivers : []}
          onMapPress={handleMapPress}
          draggablePickup={!!pickupCoords && !!dropCoords}
          onPickupDragEnd={handlePickupDragEnd}
          draggableDrop={!!dropCoords}
          onDropDragEnd={handleDropDragEnd}
          dropDragMode={!!(pickupCoords && !dropCoords)}
          onRegionChange={pickupCoords && !dropCoords
            ? (coords) => {
                centerCoordsRef.current = coords;
                // Debounce dragCenter state — avoid re-rendering on every drag frame
                if (dragTimerRef.current) clearTimeout(dragTimerRef.current);
                dragTimerRef.current = setTimeout(() => setDragCenter(coords), 120);
              }
            : undefined}
          skipAutoFit={!!(pickupCoords && !dropCoords)}
          onRouteInfo={(et, dt) => { setRouteEta(et); setRouteDist(dt); }}
          fitKey={fitKey}
        />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} />

        {/* Floating back button — no panel, just a pill over the map */}
        <TouchableOpacity
          onPress={() => { setScreen('home'); setPickupSugg([]); setDropSugg([]); setEta(''); setPromoCode(''); setPromoDiscount(0); setInstantApplied(false); setShowPromoInput(false); }}
          style={{
            position: 'absolute', zIndex: 10,
            top: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 8 : 52,
            left: 14,
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.93)',
            alignItems: 'center', justifyContent: 'center',
            elevation: 8,
            shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10,
          }}>
          <Ionicons name="arrow-back" size={20} color={C.plum} />
        </TouchableOpacity>
      </Animated.View>

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
          onScrollBeginDrag={() => { if (bothSet) setVehicleBrowsing(true); }}
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <Text style={{ fontSize: 9, color: C.textDim, fontWeight: '800', letterSpacing: 1 }}>TO</Text>
                        {/* Save drop location */}
                        {dropCoords && (
                          <TouchableOpacity
                            onPress={e => { e.stopPropagation(); openSavePicker({ text: drop, coords: dropCoords }); }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(46,20,97,0.10)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(46,20,97,0.20)' }}>
                            <Ionicons name="bookmark-outline" size={9} color={C.plum} />
                            <Text style={{ fontSize: 9, fontWeight: '800', color: C.plum }}>SAVE</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: C.text }}>{drop}</Text>
                    </View>
                  </View>

                  {/* Edit badge */}
                  <View style={{ alignSelf: 'center', marginLeft: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: C.pinkGlass, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.pinkBorder }}>
                    <Ionicons name="pencil" size={15} color={C.pink} />
                  </View>
                </View>
              </View>

              {/* Drag-to-adjust drop strip */}
              <TouchableOpacity
                onPress={e => { e.stopPropagation(); enterAdjustMode(); }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.glassBorder, marginHorizontal: 16, marginBottom: 4 }}>
                <Ionicons name="move" size={14} color={C.pink} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: C.pink }}>Drag map to adjust drop</Text>
                <Ionicons name="chevron-forward" size={12} color={C.pinkBorder} />
              </TouchableOpacity>
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
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
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
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
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
                      {/* ── Saved Places — Home & Office ── */}
                      {hasSavedPlaces && (
                        <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                            <Ionicons name="bookmark" size={11} color={C.pink} />
                            <Text style={{ fontSize: 10, color: C.pink, fontWeight: '900', letterSpacing: 1.3 }}>SAVED PLACES</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            {savedPlaces.home && (
                              <TouchableOpacity onPress={() => selectSaved(savedPlaces.home!)}
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(46,20,97,0.07)', borderRadius: 16, padding: 12, borderWidth: 1.5, borderColor: 'rgba(46,20,97,0.18)' }}>
                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.plum, alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ fontSize: 17 }}>🏠</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.text }}>Home</Text>
                                  <Text style={{ fontSize: 10, color: C.textDim, marginTop: 1 }} numberOfLines={1}>{savedPlaces.home.text}</Text>
                                </View>
                              </TouchableOpacity>
                            )}
                            {savedPlaces.office && (
                              <TouchableOpacity onPress={() => selectSaved(savedPlaces.office!)}
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(37,99,235,0.07)', borderRadius: 16, padding: 12, borderWidth: 1.5, borderColor: 'rgba(37,99,235,0.18)' }}>
                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ fontSize: 17 }}>🏢</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.text }}>Office</Text>
                                  <Text style={{ fontSize: 10, color: C.textDim, marginTop: 1 }} numberOfLines={1}>{savedPlaces.office.text}</Text>
                                </View>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}

                      {/* ── Recent destinations (max 3) ── */}
                      {dropHistory.length > 0 && (
                        <>
                          <View style={{ height: 1, backgroundColor: C.glassBorder, marginHorizontal: 14, marginTop: hasSavedPlaces ? 4 : 0 }} />
                          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 6 }}>
                            <Ionicons name="time" size={11} color={C.textMuted} />
                            <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '900', letterSpacing: 1.2 }}>RECENT</Text>
                          </View>
                          {dropHistory.slice(0, 3).map((h, i) => (
                            <TouchableOpacity key={i}
                              activeOpacity={0.75}
                              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.glassBorder }}
                              onPress={() => { setDrop(h.text); setDropSugg([]); if (h.coords) setDropCoords(h.coords); else geocodePlace(h.text, 'drop'); }}>
                              {/* Icon */}
                              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.glassMid, alignItems: 'center', justifyContent: 'center', marginRight: 13, borderWidth: 1.5, borderColor: C.glassBorder }}>
                                <Ionicons name="location-outline" size={16} color={C.textMuted} />
                              </View>
                              {/* Address */}
                              <Text style={{ fontSize: 13, color: C.text, flex: 1, fontWeight: '600' }} numberOfLines={1}>{h.text}</Text>
                              {/* Save bookmark */}
                              {h.coords && (
                                <TouchableOpacity
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  onPress={e => { e.stopPropagation(); openSavePicker({ text: h.text, coords: h.coords! }); }}
                                  style={{ padding: 8, marginLeft: 4 }}>
                                  <Ionicons name="bookmark-outline" size={17} color={C.textDim} />
                                </TouchableOpacity>
                              )}
                            </TouchableOpacity>
                          ))}
                        </>
                      )}

                      {/* ── Add Home / Office nudge (if neither set) ── */}
                      {(!savedPlaces.home || !savedPlaces.office) && (
                        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.glassBorder }}>
                          {!savedPlaces.home && (
                            <TouchableOpacity
                              onPress={() => { setSaveTarget(null); setShowSavePicker(true); }}
                              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(46,20,97,0.25)', borderStyle: 'dashed', paddingVertical: 11, backgroundColor: 'rgba(46,20,97,0.04)' }}>
                              <Text style={{ fontSize: 15 }}>🏠</Text>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: C.plum }}>Add Home</Text>
                            </TouchableOpacity>
                          )}
                          {!savedPlaces.office && (
                            <TouchableOpacity
                              onPress={() => { setSaveTarget(null); setShowSavePicker(true); }}
                              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(37,99,235,0.25)', borderStyle: 'dashed', paddingVertical: 11, backgroundColor: 'rgba(37,99,235,0.04)' }}>
                              <Text style={{ fontSize: 15 }}>🏢</Text>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#1D4ED8' }}>Add Office</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}
            </>
          )}

          {/* ─── Drag mode status panel ─────────────────────────────────────────── */}
          {inDragMode && (() => {
            const dragDist = dragCenter && originalDropRef.current
              ? haversineKm(dragCenter, originalDropRef.current) : null;
            const tooFar = dragDist !== null && dragDist > 1;
            return (
              <View style={{ gap: 10, marginTop: 10 }}>
                {/* Instruction row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.pinkGlass, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.pinkBorder }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="locate" size={18} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: C.plum }}>Drag the map to place your drop</Text>
                    <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>The pin follows the map center</Text>
                  </View>
                </View>

                {/* 1km distance guard — only shown in adjust mode */}
                {dragDist !== null && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 12,
                    backgroundColor: tooFar ? 'rgba(255,59,48,0.07)' : 'rgba(5,150,105,0.07)',
                    borderWidth: 1, borderColor: tooFar ? 'rgba(255,59,48,0.22)' : 'rgba(5,150,105,0.22)',
                  }}>
                    <Text style={{ fontSize: 18 }}>{tooFar ? '⚠️' : '✅'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: tooFar ? '#FF3B30' : C.green }}>
                        {tooFar
                          ? `Too far — ${dragDist.toFixed(1)} km away`
                          : dragDist < 0.05
                            ? 'At searched location'
                            : `${dragDist < 1 ? Math.round(dragDist * 1000) + ' m' : dragDist.toFixed(1) + ' km'} from searched drop`}
                      </Text>
                      {tooFar && (
                        <Text style={{ fontSize: 10, color: '#FF3B30', opacity: 0.8, marginTop: 2 }}>
                          Move the pin within 1 km of your searched location
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Road hint */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(46,20,97,0.06)', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 }}>
                  <Text style={{ fontSize: 16 }}>🛣️</Text>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.plum }}>Place the pin on a road for accurate fare</Text>
                </View>
              </View>
            );
          })()}

          {/* ─── Plum ETA card — animated, only when route is ready ──────────────── */}
          {bothSet && routeEta ? (
            <Animated.View style={{ opacity: etaCardFade, transform: [{ translateY: etaCardSlide }], marginBottom: 16 }}>
              <View style={{
                backgroundColor: C.plum,
                borderRadius: 20,
                overflow: 'hidden',
                elevation: 10,
                shadowColor: C.plum,
                shadowOpacity: 0.40,
                shadowRadius: 16,
              }}>
                {/* Top row — live badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 13, paddingBottom: 9, gap: 8 }}>
                  {/* Pulse dot */}
                  <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
                    <Animated.View style={{
                      position: 'absolute',
                      width: 14, height: 14, borderRadius: 7,
                      backgroundColor: '#4ADE80',
                      opacity: pulseDot.interpolate({ inputRange: [1, 1.9], outputRange: [0.4, 0] }),
                      transform: [{ scale: pulseDot }],
                    }} />
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' }} />
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }}>LIVE ROUTE</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '600' }}>tap card to edit</Text>
                </View>

                {/* Hairline divider */}
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginHorizontal: 16 }} />

                {/* Stats row */}
                <View style={{ flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 16 }}>
                  {/* Time */}
                  <Animated.View style={{ flex: 1, opacity: etaTimeFade, transform: [{ translateY: etaTimeSlide }] }}>
                    <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }}>{routeEta}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.50)', fontSize: 11, fontWeight: '700', marginTop: 4, letterSpacing: 0.3 }}>Est. travel time</Text>
                  </Animated.View>

                  {/* Vertical separator */}
                  <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 2, marginHorizontal: 4 }} />

                  {/* Distance */}
                  <Animated.View style={{ flex: 1, paddingLeft: 18, opacity: etaDistFade, transform: [{ translateY: etaDistSlide }] }}>
                    <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }}>{routeDist}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.50)', fontSize: 11, fontWeight: '700', marginTop: 4, letterSpacing: 0.3 }}>Total distance</Text>
                  </Animated.View>
                </View>
              </View>
            </Animated.View>
          ) : bothSet ? (
            /* Calculating skeleton */
            <View style={{ backgroundColor: 'rgba(46,20,97,0.18)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(46,20,97,0.20)' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.plum, opacity: 0.5 }} />
              <Text style={{ color: C.plum, fontWeight: '700', fontSize: 12, opacity: 0.7 }}>Calculating route…</Text>
            </View>
          ) : null}

          {/* ─── Vehicle + fare + promo — hidden in drag mode ───────────────────── */}
          {!inDragMode && <>
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
                  <TouchableOpacity onPress={() => { setRideType(nearest.r.id); setVehicleBrowsing(false); }} style={{ backgroundColor: C.green, borderRadius: R.xs, paddingHorizontal: 10, paddingVertical: 5 }}>
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
                      setVehicleBrowsing(false); // expand map — confirmation peak
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
                                  onPress={() => { setRideType(bestAlt.id); setVehicleBrowsing(false); }}
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
                      onPress={() => { setRideType(alt.id); setVehicleBrowsing(false); }}
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
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.greenGlass, alignItems: 'center', justifyContent: 'center' }}>
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
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
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
          </>}{/* end !inDragMode */}
        </ScrollView>

        {/* ─── Sticky bottom button — swaps between drag mode and book mode ─── */}
        {inDragMode ? (() => {
          const dragDist = dragCenter && originalDropRef.current
            ? haversineKm(dragCenter, originalDropRef.current) : null;
          const tooFar = dragDist !== null && dragDist > 1;
          return (
            <View style={{
              paddingHorizontal: 14, paddingTop: 10,
              paddingBottom: Platform.OS === 'android' ? 28 : 24,
              backgroundColor: C.bg,
              borderTopWidth: 1.5,
              borderTopColor: 'rgba(255,45,120,0.18)',
            }}>
              <TouchableOpacity
                activeOpacity={tooFar ? 1 : 0.85}
                onPress={tooFar ? undefined : confirmDropHere}
                disabled={geoLoading || tooFar}
                style={{
                  backgroundColor: geoLoading || tooFar ? C.glassMid : C.pink,
                  borderRadius: 16, paddingVertical: 15, paddingHorizontal: 20,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
                  elevation: tooFar ? 0 : 14,
                  shadowColor: C.pink, shadowOpacity: tooFar ? 0 : 0.55, shadowRadius: 14,
                }}>
                <Ionicons name={tooFar ? 'warning' : 'flag'} size={18} color={tooFar ? C.textMuted : '#fff'} />
                <Text style={{ fontWeight: '900', fontSize: 15, color: tooFar ? C.textMuted : '#fff' }}>
                  {geoLoading ? 'Setting location...' : tooFar ? 'Move pin within 1 km' : 'Set Drop Here'}
                </Text>
                {!geoLoading && !tooFar && <Ionicons name="checkmark-circle" size={20} color="rgba(255,255,255,0.85)" />}
              </TouchableOpacity>
            </View>
          );
        })() : (
        <View style={{
          paddingHorizontal: 14,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'android' ? 38 : 34,
          backgroundColor: C.bg,
          borderTopWidth: 1.5,
          borderTopColor: 'rgba(255,45,120,0.18)',
        }}>
          <Animated.View style={{ transform: [{ scale: bookPulseAnim }] }}>
          <Bouncy
            style={[{ borderRadius: 16, overflow: 'hidden' }, loading && { opacity: 0.72 }]}
            onPress={handleBook}
            disabled={loading}>
            <View style={{
              backgroundColor: loading ? C.glassMid : hasFare ? C.pink : C.glassMid,
              paddingVertical: 13,
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
        )}{/* end !inDragMode book button */}
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
                  <View style={{ backgroundColor: C.yellowGlass, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: C.yellow }}>{info?.dist_km} km</Text>
                  </View>
                </View>
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: C.textDim }}>Estimated wait time</Text>
                  <View style={{ backgroundColor: C.yellowGlass, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: C.yellow }}>~{info?.eta_min} min</Text>
                  </View>
                </View>
                {extraMin > 0 && (
                  <>
                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: C.textDim }}>Extra wait</Text>
                      <View style={{ backgroundColor: C.redGlass, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
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

      {/* ─── Save Place picker modal ─────────────────────────────────────────── */}
      {showSavePicker && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', zIndex: 999 }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSavePicker(false)} />
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, paddingBottom: Platform.OS === 'android' ? 36 : 44, borderTopWidth: 1.5, borderColor: C.glassBorder }}>

            {/* Handle */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: C.glassB2 }} />
            </View>

            {/* Label */}
            <Text style={{ fontSize: 12, color: C.textDim, fontWeight: '900', letterSpacing: 1.3, marginBottom: 6 }}>SAVE LOCATION AS</Text>
            {saveTarget && (
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 20 }} numberOfLines={1}>{saveTarget.text}</Text>
            )}

            {/* Options */}
            <View style={{ gap: 12 }}>
              {/* Home */}
              <TouchableOpacity onPress={() => savePlaceAs('home')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: 'rgba(46,20,97,0.07)', borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: 'rgba(46,20,97,0.18)' }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.plum, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22 }}>🏠</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>Home</Text>
                  <Text style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                    {savedPlaces.home ? `Replace: ${savedPlaces.home.text}` : 'Set your home address'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textDim} />
              </TouchableOpacity>

              {/* Office */}
              <TouchableOpacity onPress={() => savePlaceAs('office')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: 'rgba(37,99,235,0.07)', borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: 'rgba(37,99,235,0.18)' }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22 }}>🏢</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>Office</Text>
                  <Text style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                    {savedPlaces.office ? `Replace: ${savedPlaces.office.text}` : 'Set your work address'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textDim} />
              </TouchableOpacity>

              {/* Other */}
              <TouchableOpacity onPress={() => savePlaceAs('other')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.glassMid, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: C.glassBorder }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.glassBorder }}>
                  <Text style={{ fontSize: 22 }}>📍</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>Favourite Place</Text>
                  <Text style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>Save as a favourite spot</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textDim} />
              </TouchableOpacity>
            </View>

            {/* Cancel */}
            <TouchableOpacity onPress={() => setShowSavePicker(false)}
              style={{ marginTop: 14, alignItems: 'center', paddingVertical: 14 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.textMuted }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
