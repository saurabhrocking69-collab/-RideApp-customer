import { ActivityIndicator, Animated, Dimensions, KeyboardAvoidingView, Modal, PanResponder, Platform, ScrollView, StatusBar, TextInput, Text, TouchableOpacity, View } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Storage as AsyncStorage } from '../storage';
import { useApp } from '../context/AppContext';
import { GlassPanel, RideVehicleIcon, DotBG, SkeletonBox } from '../components/ui';
import { LiveMap } from '../components/LiveMap';
import { PickupMapPicker } from '../components/PickupMapPicker';
import { s, C, T, R, SP, SHADOW } from '../styles';
import { RIDES, MAPS_KEY } from '../constants';
import { apiGet, apiPost, externalGet } from '../../api';
import { useNearbyDrivers } from '../offline';

const SCREEN_H   = Dimensions.get('window').height;
const DRAWER_COMPACT = Math.round(SCREEN_H * 0.40); // route confirmed — 60% map visible
const DRAWER_INPUT   = Math.round(SCREEN_H * 0.56); // searching / editing
const DRAWER_BROWSE  = Math.round(SCREEN_H * 0.58); // expanded to browse vehicles

const SWIPE_H     = 58;  // swipe-to-book track height
const SWIPE_THUMB = 46;  // draggable thumb diameter
const SWIPE_PAD   = 6;   // thumb inset from track edge

export function BookingScreen() {
  const { bottom: bottomInset } = useSafeAreaInsets();
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
    phone,
    availablePromos, setAvailablePromos,
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
  const [vehicleBrowsing, setVehicleBrowsing] = useState(false);
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
    if (p._type === 'transit') return { emoji: '🚇', color: C.plum,    bg: C.plumGlass,   border: C.plumBorder };
    if (p._type === 'mall')    return { emoji: '🛍️', color: C.purple,  bg: C.purpleGlass, border: C.purpleBorder };
    return                            { emoji: '📍', color: C.textMuted, bg: C.glassMid,   border: C.glassBorder };
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

  // ── Swipe-to-book gesture ────────────────────────────────────────────────────
  const swipeX        = useRef(new Animated.Value(0)).current;
  const trackWidthRef = useRef(0);
  // Keep fresh refs readable inside PanResponder (created once, avoids stale closures)
  const hasFareRef    = useRef(hasFare);
  hasFareRef.current  = hasFare;
  const loadingRef    = useRef(loading);
  loadingRef.current  = loading;
  const handleBookRef = useRef<() => void>(handleBook);
  handleBookRef.current = handleBook;

  const swipePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => hasFareRef.current && !loadingRef.current,
    onMoveShouldSetPanResponder:  (_, gs) => Math.abs(gs.dx) > 4 && hasFareRef.current && !loadingRef.current,
    onPanResponderGrant: () => swipeX.stopAnimation(),
    onPanResponderMove: (_, gs) => {
      if (!hasFareRef.current || loadingRef.current) return;
      const max = trackWidthRef.current - SWIPE_THUMB - SWIPE_PAD * 2;
      swipeX.setValue(Math.max(0, Math.min(gs.dx, max)));
    },
    onPanResponderRelease: (_, gs) => {
      const max = trackWidthRef.current - SWIPE_THUMB - SWIPE_PAD * 2;
      if (gs.dx >= max * 0.72 && hasFareRef.current) {
        Animated.spring(swipeX, { toValue: max, useNativeDriver: false, tension: 220, friction: 7 }).start(() => {
          handleBookRef.current();
          setTimeout(() => Animated.spring(swipeX, { toValue: 0, useNativeDriver: false, tension: 160, friction: 9 }).start(), 650);
        });
      } else {
        Animated.spring(swipeX, { toValue: 0, useNativeDriver: false, tension: 180, friction: 8 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(swipeX, { toValue: 0, useNativeDriver: false }).start();
    },
  })).current;

  // Reset swipe thumb when loading state changes
  useEffect(() => {
    if (loading) Animated.spring(swipeX, { toValue: 0, useNativeDriver: false }).start();
  }, [loading]);

  // Forward geocode an address string → lat/lng (used before opening picker)
  const geocodeForPicker = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const res = await externalGet(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`
      );
      const loc = res?.results?.[0]?.geometry?.location;
      return loc ? { lat: loc.lat, lng: loc.lng } : null;
    } catch { return null; }
  };

  // Picker cancel — if opened via suggestion (text set, coords not yet confirmed) apply geocoded coords
  const handlePickerClose = () => {
    if (pickup && !pickupCoords && pickerCoords) setPickupCoords(pickerCoords);
    setPickerCoords(null);
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

  // ── Pickup map picker ─────────────────────────────────────────────────────────
  const [pickerCoords, setPickerCoords]     = useState<{ lat: number; lng: number } | null>(null);
  const [pickerLoading, setPickerLoading]   = useState(false);
  const [walkGpsOrigin, setWalkGpsOrigin]   = useState<{ lat: number; lng: number } | null>(null);

  const handleUseMyLocation = async () => {
    setPickerLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setPickerLoading(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setWalkGpsOrigin(coords);
      setPickerCoords(coords);
    } catch (_e) {}
    setPickerLoading(false);
  };

  const handlePickerConfirm = (
    address: string,
    coords: { lat: number; lng: number },
    saveAs: 'Home' | 'Work' | null,
  ) => {
    setPickup(address);
    setPickupCoords(coords);
    setPickerCoords(null);
    if (saveAs) {
      const target = { text: address, coords };
      const updated = { ...savedPlaces };
      if (saveAs === 'Home')   updated.home   = target;
      else                     updated.office = target;
      persistSavedPlaces(updated);
    }
  };

  // ── Route ETA (from LiveMap directions API callback) ─────────────────────────
  const [routeEta, setRouteEta]   = useState('');
  const [routeDist, setRouteDist] = useState('');
  // Reset when route is cleared
  useEffect(() => { if (!dropCoords) { setRouteEta(''); setRouteDist(''); } }, [dropCoords]);

  // ── Coupon modal ──────────────────────────────────────────────────────────
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponApplying, setCouponApplying]   = useState(false);
  const [couponError, setCouponError]         = useState('');
  const promosFetchedRef = useRef(false);

  useEffect(() => {
    if (!routeEta || promosFetchedRef.current) return;
    promosFetchedRef.current = true;
    apiGet('/api/promo/list').then(d => {
      if (!d._error && d.promos) setAvailablePromos(d.promos);
    }).catch(() => {});
  }, [routeEta]);

  const handleApplyCoupon = async (code: string) => {
    setCouponApplying(true);
    setCouponError('');
    try {
      const fare = fareEstimates[rideType]?.fare ?? rawFare ?? 100;
      const d = await apiPost('/api/promo/validate', { code, fare, phone });
      if (d.valid) {
        setPromoCode(code);
        setPromoDiscount(d.discount);
        setShowCouponModal(false);
      } else {
        setCouponError(d.message || 'Invalid coupon');
      }
    } catch {
      setCouponError('Network error, try again');
    } finally {
      setCouponApplying(false);
    }
  };

  const handleRemoveCoupon = () => {
    setPromoCode('');
    setPromoDiscount(0);
    setInstantApplied(false);
  };

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

  // ── Drawer state machine ──────────────────────────────────────────────────
  //  DRAWER_INPUT when searching | DRAWER_COMPACT when route confirmed | DRAWER_BROWSE when expanded
  const [inputFocused, setInputFocused]     = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const bothSet = !!(pickupCoords && dropCoords);

  // Auto-collapse drawer when route is confirmed so map becomes prominent
  useEffect(() => {
    if (bothSet) setDrawerExpanded(false);
  }, [bothSet]);

  const drawerHeightAnim = useRef(new Animated.Value(DRAWER_INPUT)).current;
  useEffect(() => {
    const target = !bothSet || inputFocused ? DRAWER_INPUT
      : drawerExpanded                       ? DRAWER_BROWSE
      : DRAWER_COMPACT;
    Animated.spring(drawerHeightAnim, { toValue: target, friction: 8, tension: 85, useNativeDriver: false }).start();
  }, [bothSet, inputFocused, drawerExpanded]);

  // ── fitKey — re-triggers fitToCoordinates on route/map changes ───────────
  const [fitKey, setFitKey] = useState(0);
  // Fit 720ms after both markers are set (drawer spring settles ~700ms)
  useEffect(() => {
    if (!bothSet) return;
    const t = setTimeout(() => setFitKey(k => k + 1), 720);
    return () => clearTimeout(t);
  }, [bothSet, pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng]);
  // Re-fit 350ms after route polyline arrives — tighter fit using actual route coords
  useEffect(() => {
    if (!routeEta) return;
    const t = setTimeout(() => setFitKey(k => k + 1), 350);
    return () => clearTimeout(t);
  }, [routeEta]);
  // Re-fit when drawer collapses (map grows, route should fill the new space)
  useEffect(() => {
    if (!bothSet || drawerExpanded) return;
    const t = setTimeout(() => setFitKey(k => k + 1), 850);
    return () => clearTimeout(t);
  }, [bothSet, drawerExpanded]);


  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DotBG />

      {/* ─── Map — flex:1 fills all space above the drawer ─── */}
      <View style={{ flex: 1 }}>
        <LiveMap
          pickupCoords={pickupCoords}
          dropCoords={dropCoords}
          userLat={userCoords?.latitude || userCoords?.lat}
          userLng={userCoords?.longitude || userCoords?.lng}
          userAccuracy={(userCoords as any)?.accuracy}
          fill={true}
          mode="booking"
          showRoute={!!(pickupCoords && dropCoords)}
          nearbyDrivers={!pickupCoords || !dropCoords ? nearbyDrivers : []}
          onMapPress={handleMapPress}
          draggablePickup={!!pickupCoords && !!dropCoords}
          onPickupDragEnd={handlePickupDragEnd}
          onRouteInfo={(et, dt) => { setRouteEta(et); setRouteDist(dt); }}
          fitKey={fitKey}
          walkOrigin={walkGpsOrigin}
        />
        {/* Floating back button */}
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


      </View>

      {/* ─── Bottom drawer — slides up/down over map ─── */}
      {/* Floor seal: covers any gap below the drawer and blocks DotBG blobs */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, backgroundColor: C.bg }} pointerEvents="none" />
      <Animated.View style={{ height: drawerHeightAnim, backgroundColor: C.bg, elevation: 3, zIndex: 2 }}>
      <GlassPanel intensity={22} style={{
        flex: 1,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        marginTop: -28,
        overflow: 'hidden',
        elevation: 20,
        shadowColor: C.pink,
        shadowOpacity: 0.14,
        shadowRadius: 20,
        backgroundColor: C.bg,
        borderColor: 'rgba(180,160,255,0.18)',
      }}>
        {/* Drag handle — tap to expand/collapse when route is confirmed */}
        <TouchableOpacity
          activeOpacity={bothSet && !inputFocused ? 0.7 : 1}
          onPress={() => { if (bothSet && !inputFocused) setDrawerExpanded(e => !e); }}
          style={{ alignItems: 'center', paddingTop: 10, paddingBottom: bothSet && !inputFocused ? 2 : 10 }}>
          <View style={{ width: 48, height: 4, borderRadius: 2, backgroundColor: C.glassB2 }} />
          {bothSet && !inputFocused && (
            <Ionicons
              name={drawerExpanded ? 'chevron-down' : 'chevron-up'}
              size={15} color={C.textDim}
              style={{ marginTop: 5 }} />
          )}
        </TouchableOpacity>

        {/* ── Top-edge coupon banner — stuck to top of drawer, full-width ── */}
        {bothSet && !!routeEta && (() => {
          const maxSave = availablePromos.length > 0
            ? Math.max(...availablePromos.map((p: any) => parseFloat(String(p.max_discount)) || 0))
            : 0;
          const applied = promoDiscount > 0;
          return (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => { setCouponError(''); setShowCouponModal(true); }}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: applied ? '#16A34A' : '#FF2D78',
                paddingVertical: 9, paddingHorizontal: 16, gap: 10,
              }}>
              {/* Icon bubble */}
              <View style={{
                width: 30, height: 30, borderRadius: 9,
                backgroundColor: 'rgba(255,255,255,0.22)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons
                  name={applied ? 'checkmark-circle' : 'pricetag'}
                  size={16} color="#fff"
                />
              </View>
              {/* Text block */}
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 0.1 }}>
                  {applied
                    ? `${promoCode} Applied — ₹${promoDiscount} saved on this ride!`
                    : availablePromos.length > 0
                      ? `${availablePromos.length} coupon${availablePromos.length !== 1 ? 's' : ''} available${maxSave > 0 ? ` · Save up to ₹${maxSave}` : ''}!`
                      : 'Have a coupon? Apply & save now!'}
                </Text>
                {!applied && (
                  <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 10, marginTop: 1, fontWeight: '600' }}>
                    {availablePromos.length > 0 ? 'Tap to see & apply offers' : 'Enter code in fare section below'}
                  </Text>
                )}
              </View>
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.22)',
                borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
              }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>
                  {applied ? 'Change' : 'Apply'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })()}

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 14 }}>

          {/* ─── Location card ─── */}
          {pickupCoords && dropCoords ? (
            /* Confirmed route — tap to edit drop */
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => { setDropCoords(null); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; }}
              style={{
                backgroundColor: C.bgCard,
                marginHorizontal: -14,
                marginBottom: 14,
                elevation: 6,
                overflow: 'hidden',
                borderBottomWidth: 1.5,
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
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.plumGlass, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: C.plumBorder }}>
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

            </TouchableOpacity>
          ) : (
            /* Input mode — also hidden while dragging */
            <>
              <View style={{
                backgroundColor: C.bgCard,
                marginHorizontal: -14,
                padding: 14,
                paddingBottom: hasDropDown ? 10 : 14,
                marginBottom: hasDropDown ? 0 : 14,
                elevation: 6,
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
                  {pickerLoading ? (
                    <View style={{ padding: 7 }}>
                      <ActivityIndicator size="small" color={C.pink} />
                    </View>
                  ) : pickup ? (
                    <TouchableOpacity onPress={() => { setPickup(''); setPickupCoords(null); setPickupSugg([]); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; setWalkGpsOrigin(null); }} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={19} color={C.textDim} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={handleUseMyLocation} style={{ padding: 7, borderRadius: 20, backgroundColor: C.pinkGlass, borderWidth: 1.5, borderColor: C.pinkBorder }}>
                      <Ionicons name="navigate" size={16} color={C.pink} />
                    </TouchableOpacity>
                  )}
                </View>

                {pickupSugg.length > 0 && (
                  <View style={[s.suggBox, { zIndex: 100 }]}>
                    {pickupSugg.slice(0, 5).map((sg: any, i: number) => (
                      <TouchableOpacity key={i} style={[s.suggItem, { paddingVertical: 12 }]}
                        onPress={async () => {
                          setPickup(sg.text);
                          setPickupSugg([]);
                          setPickerLoading(true);
                          // Set walk GPS origin from current user coords if available
                          const uLat = (userCoords as any)?.latitude ?? (userCoords as any)?.lat;
                          const uLng = (userCoords as any)?.longitude ?? (userCoords as any)?.lng;
                          if (uLat && uLng) setWalkGpsOrigin({ lat: uLat, lng: uLng });
                          const coords = await geocodeForPicker(sg.text);
                          setPickerLoading(false);
                          if (coords) {
                            setPickerCoords(coords);
                          } else {
                            geocodePlace(sg.text, 'pickup'); // fallback: set coords silently
                          }
                        }}>
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
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 4, paddingHorizontal: 4 }}>
                    <SkeletonBox width={100} height={34} radius={22} />
                    <SkeletonBox width={118} height={34} radius={22} />
                    <SkeletonBox width={88} height={34} radius={22} />
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
                  marginHorizontal: -14,
                  marginBottom: 14,
                  elevation: 18,
                  borderBottomWidth: 1.5,
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
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.plumGlass, borderRadius: 16, padding: 12, borderWidth: 1.5, borderColor: C.plumBorder }}>
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
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.purpleGlass, borderRadius: 16, padding: 12, borderWidth: 1.5, borderColor: C.purpleBorder }}>
                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
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
                              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1.5, borderColor: C.plumBorder, borderStyle: 'dashed', paddingVertical: 11, backgroundColor: C.plumGlass }}>
                              <Text style={{ fontSize: 15 }}>🏠</Text>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: C.plum }}>Add Home</Text>
                            </TouchableOpacity>
                          )}
                          {!savedPlaces.office && (
                            <TouchableOpacity
                              onPress={() => { setSaveTarget(null); setShowSavePicker(true); }}
                              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1.5, borderColor: C.purpleBorder, borderStyle: 'dashed', paddingVertical: 11, backgroundColor: C.purpleGlass }}>
                              <Text style={{ fontSize: 15 }}>🏢</Text>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: C.purple }}>Add Office</Text>
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
            <View style={{ backgroundColor: C.bgDeep, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.plumBorder }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.plum, opacity: 0.5 }} />
              <Text style={{ color: C.plum, fontWeight: '700', fontSize: 12, opacity: 0.7 }}>Calculating route…</Text>
            </View>
          ) : null}

          {/* ─── Vehicle + fare + promo ───────────────────────────────────────────── */}
          <>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: C.textDim, letterSpacing: 1.4, flex: 1 }}>CHOOSE VEHICLE</Text>
            {etaLoaded && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.greenGlass, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: C.greenBorder }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.green }} />
                <Text style={{ fontSize: 9, color: C.green, fontWeight: '800' }}>LIVE</Text>
              </View>
            )}
          </View>

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

          {/* ─── Horizontal vehicle carousel ─── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 4 }}
            style={{ marginBottom: 10 }}
          >
            {RIDES.map((r: any) => {
              const isSel = rideType === r.id;
              const isLux = r.id === 'luxury';
              const cfgBase = appConfig?.fares?.[r.id]?.base_fare ?? r.base;
              const fareText = fareLoading ? '...' : fareEstimates[r.id] ? `₹${fareEstimates[r.id].fare ?? fareEstimates[r.id]}` : `₹${cfgBase}+`;
              const anim = cardAnims[r.id];
              const entry = cardEntryAnims[r.id];
              const info = driverEta[r.id];
              const notAvail = etaLoaded && !info;
              const isFar = info?.dist_km !== null && info?.dist_km > 5;
              return (
                <Animated.View key={r.id} style={{ transform: [{ scale: anim }, { translateY: entry.ty }], opacity: entry.op }}>
                  <TouchableOpacity
                    onPress={() => {
                      setRideType(r.id);
                      setVehicleBrowsing(false);
                      RIDES.forEach((ride: any) => {
                        Animated.spring(cardAnims[ride.id], {
                          toValue: ride.id === r.id ? 1.015 : 1,
                          friction: 5, tension: 180, useNativeDriver: true,
                        }).start();
                      });
                    }}
                    activeOpacity={0.82}
                    style={{
                      width: 110,
                      alignItems: 'center',
                      paddingHorizontal: 8,
                      paddingTop: 10,
                      paddingBottom: 10,
                      backgroundColor: isSel ? C.pinkGlass : notAvail ? C.glassMid : C.bgCard,
                      borderRadius: R.md,
                      borderWidth: isSel ? 2 : 1,
                      borderColor: isSel ? C.pink : isLux ? C.purpleBorder : C.glassBorder,
                      opacity: notAvail ? 0.55 : 1,
                      overflow: 'hidden',
                      ...(isSel ? SHADOW.pink : SHADOW.sm),
                    }}>

                    {/* Tag row — fixed 18px height so all icon circles align */}
                    <View style={{ height: 18, marginBottom: 8, alignItems: 'center', justifyContent: 'center' }}>
                      {r.tag ? (
                        <View style={{ backgroundColor: isLux ? C.purple : r.tagColor, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                          <Text style={{ color: '#fff', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 }}>{r.tag}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Icon circle */}
                    <View style={{
                      width: 44, height: 44, borderRadius: 22,
                      backgroundColor: isSel ? C.pinkGlass : isLux ? C.purpleGlass : C.glassMid,
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: isSel ? 2 : 1.5,
                      borderColor: isSel ? C.pink : isLux ? C.purpleBorder : C.glassBorder,
                      marginBottom: 8,
                    }}>
                      <RideVehicleIcon id={r.id} size={22} color={isSel ? C.pink : isLux ? C.purple : C.textMuted} />
                    </View>

                    {/* Vehicle name */}
                    <Text style={{ fontSize: 11, fontWeight: '800', color: isSel ? C.text : notAvail ? C.textMuted : C.textDim, textAlign: 'center', marginBottom: 3 }} numberOfLines={1}>{r.label}</Text>

                    {/* Fare */}
                    {fareLoading ? (
                      <SkeletonBox width={52} height={16} radius={6} style={{ marginBottom: 6, alignSelf: 'center' }} />
                    ) : (
                      <Text style={{ fontSize: 15, fontWeight: '900', color: isSel ? C.pink : isLux ? C.purple : C.text, textAlign: 'center', marginBottom: 6 }}>
                        {fareText}
                      </Text>
                    )}

                    {/* ETA status row — fixed 14px height */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 14 }}>
                      {!etaLoaded ? (
                        <Text style={{ fontSize: 8, color: C.textDim }}>{r.eta}</Text>
                      ) : notAvail ? (
                        <Text style={{ fontSize: 8, color: C.textMuted, fontWeight: '600' }}>No driver</Text>
                      ) : info ? (
                        <>
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isFar ? C.yellow : C.green }} />
                          <Text style={{ fontSize: 8, color: isFar ? C.yellow : C.green, fontWeight: '800' }}>
                            {info.eta_min !== null ? `~${info.eta_min} min` : 'Locating'}
                          </Text>
                        </>
                      ) : null}
                    </View>

                    {/* Selected checkmark badge */}
                    {isSel && (
                      <View style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark" size={10} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </ScrollView>

          {/* ─── Selected vehicle detail strip ─── */}
          {(() => {
            const info = driverEta[rideType];
            const sel = RIDES.find((r: any) => r.id === rideType);
            if (!sel) return null;
            const notAvail = etaLoaded && !info;
            const isFar = info?.dist_km !== null && info?.dist_km > 5;
            const stripBg = notAvail ? C.redGlass : isFar ? C.yellowGlass : etaLoaded ? C.greenGlass : C.glassMid;
            const stripBorder = notAvail ? C.redBorder : isFar ? C.yellowBorder : etaLoaded ? C.greenBorder : C.glassBorder;
            const stripColor = notAvail ? C.red : isFar ? C.yellow : etaLoaded ? C.green : C.textMuted;
            const bestAlt = notAvail
              ? (RIDES as any[]).filter(r => r.id !== rideType && driverEta[r.id])
                               .sort((a, b) => ((driverEta[a.id]?.eta_min || 999) - (driverEta[b.id]?.eta_min || 999)))[0]
              : null;
            return (
              <View style={{ backgroundColor: stripBg, borderRadius: R.sm, padding: 12, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: stripBorder }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: stripBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: stripBorder }}>
                  <RideVehicleIcon id={rideType} size={17} color={stripColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: stripColor }} numberOfLines={1}>
                    {notAvail
                      ? `No ${sel.label} driver nearby`
                      : isFar
                        ? `${sel.label} driver is a bit far`
                        : etaLoaded
                          ? `${sel.label} driver available`
                          : sel.label}
                  </Text>
                  <Text style={{ fontSize: 10, color: C.textDim, marginTop: 2 }} numberOfLines={1}>
                    {sel.desc}
                    {info?.eta_min != null ? `  ·  ~${info.eta_min} min` : ''}
                    {info?.dist_km != null ? `  ·  ${info.dist_km} km away` : ''}
                    {!etaLoaded ? '' : ''}
                  </Text>
                </View>
                {bestAlt && (
                  <TouchableOpacity
                    onPress={() => { setRideType(bestAlt.id); setVehicleBrowsing(false); }}
                    style={{ backgroundColor: C.pink, borderRadius: R.xs, paddingHorizontal: 10, paddingVertical: 6, elevation: 4, shadowColor: C.pink, shadowOpacity: 0.35, shadowRadius: 6 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>Try {bestAlt.label}</Text>
                  </TouchableOpacity>
                )}
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
                onPress={() => setShowPromoInput(!showPromoInput)}
                style={{ marginHorizontal: 16, marginBottom: showPromoInput ? 0 : 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.pink }}>🏷️ Have a promo code?</Text>
                <Ionicons name={showPromoInput ? 'chevron-up' : 'chevron-down'} size={14} color={C.pink} />
              </TouchableOpacity>
              {showPromoInput && (
                <View style={{ marginHorizontal: 16, marginBottom: 10, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.glassMid, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: C.glassBorder }}>
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

              {/* ── Coupon section — applied state OR quick-apply chips ── */}
              {promoDiscount > 0 && promoCode && !instantApplied ? (
                /* Applied coupon confirmation card */
                <View style={{
                  marginHorizontal: 16, marginBottom: 14,
                  backgroundColor: '#F0FFF4', borderRadius: 14, padding: 12,
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  borderWidth: 1.5, borderColor: '#22C55E',
                  elevation: 3, shadowColor: '#22C55E', shadowOpacity: 0.18, shadowRadius: 8,
                }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#16A34A' }}>{promoCode} Applied ✓</Text>
                    <Text style={{ fontSize: 11, color: '#22C55E', fontWeight: '700', marginTop: 1 }}>₹{promoDiscount} discount on this ride</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleRemoveCoupon}
                    style={{ backgroundColor: '#FFF5F5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#FECACA' }}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#EF4444' }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : availablePromos.length > 0 && promoDiscount === 0 ? (
                /* Quick-apply coupon chips */
                <View style={{ marginHorizontal: 16, marginBottom: 14 }}>
                  {/* Section header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
                      <Ionicons name="sparkles" size={11} color="#FF2D78" />
                      <Text style={{ fontSize: 10, fontWeight: '900', color: '#FF2D78', letterSpacing: 1 }}>AVAILABLE OFFERS</Text>
                    </View>
                    <TouchableOpacity onPress={() => { setCouponError(''); setShowCouponModal(true); }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: C.plum }}>View all →</Text>
                    </TouchableOpacity>
                  </View>
                  {/* First 2 promo quick-apply rows */}
                  {availablePromos.slice(0, 2).map((promo: any) => {
                    const discLabel = promo.discount_type === 'percent'
                      ? `${promo.discount_value}% off (max ₹${promo.max_discount})`
                      : `₹${promo.discount_value} flat off`;
                    return (
                      <View key={promo.code} style={{
                        flexDirection: 'row', alignItems: 'center',
                        backgroundColor: C.bgCard, borderRadius: 12, padding: 10,
                        marginBottom: 6, borderWidth: 1.5, borderColor: C.glassBorder,
                        borderStyle: 'dashed',
                        overflow: 'hidden',
                      }}>
                        {/* Left pink accent line */}
                        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 3, backgroundColor: '#FF2D78' }} />
                        <View style={{ flex: 1, paddingLeft: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                            <View style={{ backgroundColor: '#FFF0F6', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ fontSize: 12, fontWeight: '900', color: '#FF2D78', letterSpacing: 0.5 }}>{promo.code}</Text>
                            </View>
                          </View>
                          <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '600' }}>{discLabel}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleApplyCoupon(promo.code)}
                          disabled={couponApplying}
                          style={{
                            backgroundColor: '#FF2D78', borderRadius: 8,
                            paddingHorizontal: 13, paddingVertical: 7,
                            elevation: 3, shadowColor: '#FF2D78', shadowOpacity: 0.35, shadowRadius: 6,
                          }}>
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>
                            {couponApplying ? '…' : 'Apply'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : fareLoading ? (
            <View style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 16, marginTop: 16, gap: 14, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <SkeletonBox width={90} height={14} radius={6} />
                <SkeletonBox width={64} height={22} radius={8} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <SkeletonBox width={72} height={12} radius={5} />
                <SkeletonBox width={50} height={12} radius={5} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <SkeletonBox width={82} height={12} radius={5} />
                <SkeletonBox width={55} height={12} radius={5} />
              </View>
            </View>
          ) : null}

          {result ? <Text style={[s.err, { marginTop: 12 }]}>{result}</Text> : null}
          </>
        </ScrollView>

      </GlassPanel>
      </Animated.View>

      {/* ─── Far-driver commitment modal ─── */}
      {showWaitModal && (() => {
        const info = driverEta[rideType];
        const extraMin = info ? Math.max(0, info.eta_min - 5) : 0;
        const selLabel = RIDES.find(r => r.id === rideType)?.label || 'Ride';
        return (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end', zIndex: 999 }}>
            <View style={{ backgroundColor: C.bgDark, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 + bottomInset, borderTopWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' }}>

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
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 + bottomInset, borderTopWidth: 1.5, borderColor: C.glassBorder }}>

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
                style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.plumGlass, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: C.plumBorder }}>
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
                style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.purpleGlass, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: C.purpleBorder }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
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

      {/* ── Coupon / Promo Modal ─────────────────────────────────────────── */}
      <Modal
        visible={showCouponModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCouponModal(false)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'flex-end' }}>
          {/* Backdrop tap closes modal */}
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCouponModal(false)} />

          <View style={{
            backgroundColor: C.bg,
            borderTopLeftRadius: 26, borderTopRightRadius: 26,
            paddingBottom: bottomInset + 20,
            maxHeight: '78%',
          }}>
            {/* Handle + header */}
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
              <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: C.glassB2 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 }}>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: '#FFF0F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="pricetag" size={20} color="#FF2D78" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '900', color: C.text }}>Apply Coupon</Text>
                <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '600', marginTop: 1 }}>Select a coupon to get instant discount</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCouponModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close-circle" size={26} color={C.textDim} />
              </TouchableOpacity>
            </View>

            {/* Hairline */}
            <View style={{ height: 1, backgroundColor: C.glassBorder, marginHorizontal: 0 }} />

            {/* Applied banner */}
            {promoDiscount > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FFF4', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#BBF7D0' }}>
                <Ionicons name="checkmark-circle" size={18} color="#22C55E" style={{ marginRight: 8 }} />
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: '#16A34A' }}>
                  {promoCode} applied — ₹{promoDiscount} off
                </Text>
                <TouchableOpacity onPress={() => { handleRemoveCoupon(); setShowCouponModal(false); }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#EF4444' }}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Error message */}
            {!!couponError && (
              <View style={{ backgroundColor: '#FFF5F5', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FECACA' }}>
                <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '700' }}>{couponError}</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
              {availablePromos.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="pricetag-outline" size={44} color={C.textDim} />
                  <Text style={{ color: C.textMuted, fontWeight: '700', fontSize: 14, marginTop: 12 }}>No coupons available right now</Text>
                  <Text style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>Check back later for exciting offers</Text>
                </View>
              ) : (
                availablePromos.map((promo: any, idx: number) => {
                  const isApplied = promoCode === promo.code && promoDiscount > 0;
                  const discLabel = promo.discount_type === 'percent'
                    ? `${promo.discount_value}% off (max ₹${promo.max_discount})`
                    : `₹${promo.discount_value} flat off`;
                  return (
                    <View
                      key={promo.code}
                      style={{
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: isApplied ? '#22C55E' : C.glassBorder,
                        backgroundColor: isApplied ? '#F0FFF4' : C.bgCard,
                        marginBottom: 10,
                        overflow: 'hidden',
                      }}>
                      {/* Dashed left accent */}
                      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, backgroundColor: isApplied ? '#22C55E' : '#FF2D78' }} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingLeft: 18, paddingRight: 14 }}>
                        {/* Code badge */}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <View style={{ backgroundColor: isApplied ? '#DCFCE7' : '#FFF0F6', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 4 }}>
                              <Text style={{ fontSize: 13, fontWeight: '900', color: isApplied ? '#16A34A' : '#FF2D78', letterSpacing: 0.5 }}>{promo.code}</Text>
                            </View>
                            {isApplied && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{discLabel}</Text>
                          {promo.min_fare > 0 && (
                            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Min fare: ₹{promo.min_fare}</Text>
                          )}
                          {promo.description ? (
                            <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{promo.description}</Text>
                          ) : null}
                        </View>
                        {/* Apply button */}
                        {isApplied ? (
                          <TouchableOpacity
                            onPress={() => { handleRemoveCoupon(); }}
                            style={{ backgroundColor: '#FFF5F5', borderRadius: 10, borderWidth: 1, borderColor: '#FECACA', paddingHorizontal: 14, paddingVertical: 8 }}>
                            <Text style={{ fontSize: 12, fontWeight: '900', color: '#EF4444' }}>Remove</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleApplyCoupon(promo.code)}
                            disabled={couponApplying}
                            style={{ backgroundColor: '#FF2D78', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, opacity: couponApplying ? 0.6 : 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '900', color: '#fff' }}>{couponApplying ? '…' : 'Apply'}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Fixed book button — pinned above device nav bar ─── */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        zIndex: 20,
        backgroundColor: C.bg,
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 10 + bottomInset,
        borderTopWidth: 1,
        borderTopColor: C.pinkBorder,
        elevation: 16,
        shadowColor: C.pink,
        shadowOpacity: 0.10,
        shadowRadius: 14,
      }}>
        {/* Compact summary: vehicle · cash · discount — single tight row */}
        {hasFare && !loading && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <RideVehicleIcon id={rideType} size={12} color={C.plum} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted }}>{selRide?.label}</Text>
            <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.textDim }} />
            <Ionicons name="cash-outline" size={10} color={C.textMuted} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted }}>Cash</Text>
            {discount > 0 && (
              <>
                <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.textDim }} />
                <View style={{ backgroundColor: C.greenGlass, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: C.greenBorder }}>
                  <Text style={{ fontSize: 9, color: C.green, fontWeight: '800' }}>−₹{discount} saved</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Swipe-to-book track */}
        <Animated.View style={{ transform: [{ scale: bookPulseAnim }] }}>
          <View
            onLayout={e => { trackWidthRef.current = e.nativeEvent.layout.width; }}
            style={{
              height: SWIPE_H,
              borderRadius: SWIPE_H / 2,
              backgroundColor: hasFare ? C.bgDeep : C.glassMid,
              overflow: 'hidden',
              borderWidth: 1.5,
              borderColor: hasFare ? C.pinkBorder : C.glassBorder,
              elevation: hasFare && !loading ? 10 : 2,
              shadowColor: C.pink,
              shadowOpacity: hasFare && !loading ? 0.32 : 0,
              shadowRadius: 14,
            }}>

            {/* Fill — expands as thumb slides right, fades pink → yellow */}
            {hasFare && !loading && (
              <Animated.View style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: swipeX.interpolate({ inputRange: [0, 500], outputRange: [SWIPE_THUMB + SWIPE_PAD, SWIPE_THUMB + SWIPE_PAD + 500], extrapolate: 'extend' }),
                backgroundColor: swipeX.interpolate({ inputRange: [0, 280], outputRange: [C.pink, C.yellow], extrapolate: 'clamp' }),
                borderRadius: SWIPE_H / 2,
              }} />
            )}

            {/* Center label — fades as thumb moves right */}
            <Animated.View style={{
              position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
              opacity: swipeX.interpolate({ inputRange: [0, 70], outputRange: [1, 0], extrapolate: 'clamp' }),
            }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: hasFare ? C.plum : C.textMuted, letterSpacing: 0.2 }} numberOfLines={1}>
                {loading
                  ? 'Finding driver…'
                  : hasFare
                    ? `${selRide?.label || 'Ride'} · ₹${finalFare}${discount > 0 ? ` · saved ₹${discount}` : ''}`
                    : 'Set a route to see fare'}
              </Text>
            </Animated.View>

            {/* Right chevron — fades when thumb moves */}
            <Animated.View style={{
              position: 'absolute', right: 20, top: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
              opacity: swipeX.interpolate({ inputRange: [0, 50], outputRange: [0.4, 0], extrapolate: 'clamp' }),
            }}>
              <Ionicons name="chevron-forward" size={20} color={C.plum} />
            </Animated.View>

            {/* Draggable thumb */}
            <Animated.View
              {...(hasFare && !loading ? swipePan.panHandlers : {})}
              style={{
                position: 'absolute',
                top: SWIPE_PAD, left: SWIPE_PAD,
                width: SWIPE_THUMB, height: SWIPE_THUMB,
                borderRadius: SWIPE_THUMB / 2,
                backgroundColor: loading ? C.glassMid : hasFare ? C.plum : C.glassHigh,
                alignItems: 'center', justifyContent: 'center',
                elevation: 6,
                shadowColor: C.plum, shadowOpacity: 0.28, shadowRadius: 8,
                transform: [{ translateX: swipeX }],
              }}>
              {loading
                ? <Ionicons name="ellipsis-horizontal" size={18} color={C.textMuted} />
                : <RideVehicleIcon id={rideType} size={22} color={hasFare ? '#fff' : C.textDim} />
              }
            </Animated.View>

          </View>
        </Animated.View>
      </View>

      {/* ─── Pickup map picker modal ─── */}
      <PickupMapPicker
        visible={!!pickerCoords}
        initialCoords={pickerCoords || { lat: 26.8467, lng: 80.9462 }}
        onConfirm={handlePickerConfirm}
        onClose={handlePickerClose}
      />

    </KeyboardAvoidingView>
  );
}
