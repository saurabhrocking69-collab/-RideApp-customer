import { ActivityIndicator, Alert, Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar, StyleSheet, TextInput, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { SchedulePickerSheet, ScheduleResult } from '../components/SchedulePickerSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Storage as AsyncStorage } from '../storage';
import { useApp } from '../context/AppContext';
import { GlassPanel, RideVehicleIcon, DotBG, SkeletonBox } from '../components/ui';
import { LiveMap, RouteOption } from '../components/LiveMap';
import { PickupMapPicker } from '../components/PickupMapPicker';
import { s, C, T, R, SP, SHADOW } from '../styles';
import { RIDES, MAPS_KEY } from '../constants';
import { apiGet, apiPost, externalGet } from '../../api';
import { useNearbyDrivers } from '../offline';
import { NEARBY_CATEGORIES } from '../nearbyCategories';

// Reverted the local neutral-accent shadow tried earlier: on real-device
// testing, every C.pink/C.plum/C.purple use in this file turned out to be
// meaningful state (selected vehicle tab, swap/edit/GPS buttons, save chips)
// rather than pure decoration — neutralizing all of it read as "offline"/
// disabled, not calm. The one part of that experiment worth keeping — a
// calmer neutral background instead of the lavender tint — is already live
// app-wide via the shared tokens in '../styles', so nothing needed here.
const BRAND_PINK = C.pink;

// Nimble vehicles that can actually take a tighter/shorter route (a car/luxury
// often can't) — these get the Fastest/Shortest route choice.
const ROUTE_CHOICE_VEHICLES = ['bike', 'auto', 'eriksha', 'electric_auto', 'green_bike'];

// Short area-name for the map pin tags — a plain `split(',')[0]` usually grabs
// the house/plot number ("660/ZH/P-69") since that's the first segment of a
// typical formatted address, not a readable place name. Skip segments that
// look like a plot code (short, has a slash/hyphen/hash alongside digits) and
// use the first segment that reads like an actual locality name instead.
function shortAreaLabel(address?: string): string | undefined {
  if (!address) return undefined;
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  const isPlotLike = (p: string) => p.length < 20 && /\d/.test(p) && /[\/\-#]/.test(p);
  return parts.find(p => !isPlotLike(p)) || parts[0];
}

// Drawer heights are fractions of the CURRENT window height, read live via
// useWindowDimensions() inside the component rather than a static constant —
// Android's windowSoftInputMode="adjustResize" actually shrinks the window
// itself while the keyboard is up, so a one-time Dimensions.get() snapshot
// (taken from the full, keyboard-less screen) made the drawer request a
// height taller than the space now available above the keyboard, clipping
// the bottom of the suggestion list behind it. Reading the height reactively
// means the drawer's target height shrinks in step with the keyboard.

// Android safe-area insets can misreport a much larger value than the device's
// actual nav-bar/gesture-pill height during layout transitions (a known
// react-native-safe-area-context flakiness on edge-to-edge builds — see
// DRAWER animation below). Clamping keeps the CTA bar's bottom padding to a
// realistic range so it never balloons into a big empty strip above the nav
// bar; MAX_SAFE_BOTTOM covers the tallest real device paddings (~34dp).
const MAX_SAFE_BOTTOM = 34;

export function BookingScreen() {
  const { bottom: rawBottomInset } = useSafeAreaInsets();
  const bottomInset = Math.min(Math.max(rawBottomInset, 0), MAX_SAFE_BOTTOM);
  const { height: winH } = useWindowDimensions();
  const drawerCompact = Math.round(winH * 0.40); // route confirmed — map gets more room to breathe, drawer is a compact summary
  const drawerInputH  = Math.round(winH * 0.80); // searching / editing — near-full-page like Maps' search sheet
  const drawerBrowse  = Math.round(winH * 0.72); // expanded on tap — clearer contrast against compact
  const drawerMax     = Math.round(winH * 0.94); // keyboard actively up (typing/browsing suggestions) — maximize so the suggestion list never gets clipped; the floating back button is hidden in this state too so there's nothing for the drawer's glass edge to ghost through
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
    searchPlaces, searchNearbyCategory, geocodePlace, useMyLocation, swapLocations, applyPromo, bookRide,
    dropHistory,
    userCoords, setUserCoords,
    phone,
    availablePromos, setAvailablePromos,
    scheduleRide,
    scheduleIntent, setScheduleIntent,
    rideForSelf, setRideForSelf, riderName, setRiderName, riderPhone, setRiderPhone,
  } = useApp() as any;

  // Defensive reset: this screen shares "who's riding" state with IntercityScreen.
  // If a user started filling it in there (or here) and navigated away without
  // booking, don't let it silently carry over into the next trip.
  useEffect(() => { setRideForSelf(true); setRiderName(''); setRiderPhone(''); }, []);

  const selRide   = RIDES.find(r => r.id === rideType);
  const cardAnims = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(RIDES.map((r: any) => [r.id, new Animated.Value(1)]))
  ).current;
  const cardEntryAnims = useRef<Record<string, { ty: Animated.Value; op: Animated.Value }>>(
    Object.fromEntries(RIDES.map((r: any) => [r.id, { ty: new Animated.Value(38), op: new Animated.Value(0) }]))
  ).current;
  const bookPulseAnim = useRef(new Animated.Value(1)).current; // kept for layout compat

  // ── Route choice (fastest vs shortest) — nimble vehicles only ────────────────
  const [routeOptions, setRouteOptions] = useState<{ fastest: RouteOption; shortest: RouteOption | null } | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<'fastest' | 'shortest'>('fastest');
  const [routeFares, setRouteFares] = useState<{ fastest: number; shortest: number } | null>(null);
  const routeChoiceEligible = ROUTE_CHOICE_VEHICLES.includes(rideType);
  // Offer the choice only when the selected vehicle can use it AND a genuinely shorter route exists.
  const routeChoiceActive = routeChoiceEligible && !!routeOptions?.shortest;

  const _est        = fareEstimates[rideType];
  // With a route choice, the shown fare follows the selected route.
  const routeFareOverride = routeChoiceActive && routeFares ? routeFares[selectedRoute] : null;
  const rawFare     = routeFareOverride ?? ((_est?.fare ?? _est) || 0);
  const estDistFare = Math.round(_est?.dist_fare ?? 0);
  const estTimeFare = Math.round(_est?.time_fare ?? 0);
  const estPlatFee  = Math.round(parseFloat(String(_est?.platform_fee ?? 2)) || 2);
  const isNightFare  = _est?.is_night ?? false;
  const isMinApplied = _est?.is_min_applied ?? false;
  const discount    = promoDiscount;
  const finalFare   = Math.max(0, rawFare - discount);
  const tripSubtotal = Math.max(0, finalFare - estPlatFee);
  const hasFare     = rawFare > 0 && !fareLoading;

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
    Keyboard.dismiss();
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

  // ── Schedule-for-later ──────────────────────────────────────────────────────
  const [scheduledAt, setScheduledAt]           = useState<ScheduleResult | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);

  // Arrived here via "Book a Scheduled Ride" (Profile → Scheduled Rides) — open the picker.
  useEffect(() => {
    if (scheduleIntent) {
      setShowSchedulePicker(true);
      setScheduleIntent(false);
    }
  }, [scheduleIntent]);

  const handleScheduleRide = useCallback(async () => {
    if (!pickup || !drop || !pickupCoords || !dropCoords) return;
    if (!rideForSelf && (!riderName.trim() || riderPhone.length !== 10)) {
      Alert.alert('Who\'s riding?', 'Enter their name and a 10-digit phone number so the driver knows who to look for.');
      return;
    }
    const _est2 = fareEstimates[rideType];
    await scheduleRide({
      pickup, drop,
      rideType,
      pickupLat:   (pickupCoords as any).lat,
      pickupLng:   (pickupCoords as any).lng,
      dropLat:     (dropCoords as any).lat,
      dropLng:     (dropCoords as any).lng,
      distanceKm:  parseFloat(_est2?.distance_km ?? '5') || 5,
      durationMin: parseFloat(_est2?.duration_min ?? '15') || 15,
      discount:    promoDiscount,
      promoCode:   promoCode || '',
      scheduledAt: scheduledAt!.iso,
    });
    setScheduledAt(null);
  }, [pickup, drop, rideType, pickupCoords, dropCoords, fareEstimates, promoDiscount, promoCode, scheduledAt, scheduleRide, rideForSelf, riderName, riderPhone]);
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

  // Only reset the choice when the ROUTE itself changes (new destination) — not
  // on the re-fetch that our own selection toggle triggers.
  const lastRouteKeyRef = useRef<string>('');
  const handleRoutes = useCallback((routes: { fastest: RouteOption; shortest: RouteOption | null }) => {
    setRouteOptions(routes);
    const key = routes.fastest.polyline;
    if (key !== lastRouteKeyRef.current) {
      lastRouteKeyRef.current = key;
      setSelectedRoute('fastest');
    }
  }, []);

  // Price both route options for the CURRENTLY selected vehicle. Re-runs when the
  // route changes OR the vehicle changes (an auto and a bike price differently),
  // but not on a mere selection toggle (deps are the polylines, not the object).
  useEffect(() => {
    if (!routeChoiceEligible || !routeOptions?.shortest) { setRouteFares(null); return; }
    const f = routeOptions.fastest, s = routeOptions.shortest;
    let cancelled = false;
    Promise.all([
      apiPost('/api/fare-estimate', { ride_type: rideType, distance: f.distanceKm, duration_min: f.durationMin }),
      apiPost('/api/fare-estimate', { ride_type: rideType, distance: s.distanceKm, duration_min: s.durationMin }),
    ]).then(([ff, ss]) => {
      if (cancelled) return;
      if (ff?.fare != null && ss?.fare != null) setRouteFares({ fastest: ff.fare, shortest: ss.fare });
      else setRouteFares(null);
    }).catch(() => { if (!cancelled) setRouteFares(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeOptions?.fastest.polyline, routeOptions?.shortest?.polyline, rideType, routeChoiceEligible]);

  const handleBook = () => {
    if (!rideForSelf && (!riderName.trim() || riderPhone.length !== 10)) {
      Alert.alert('Who\'s riding?', 'Enter their name and a 10-digit phone number so the driver knows who to look for.');
      return;
    }
    const eta = driverEta[rideType];
    if (eta && eta.dist_km > 5) { setWaitConfirmed(false); setShowWaitModal(true); return; }
    // Pass the customer's chosen route so the fare, map, and driver navigation
    // all agree on the same path.
    const chosen = routeChoiceActive
      ? (selectedRoute === 'shortest' ? routeOptions!.shortest! : routeOptions!.fastest)
      : (routeOptions?.fastest ?? null);
    const routeArg = chosen
      ? { distanceKm: chosen.distanceKm, durationMin: chosen.durationMin, polyline: chosen.polyline, routeType: routeChoiceActive ? selectedRoute : 'fastest' }
      : undefined;
    bookRide(routeArg);
  };

  // Book button press animation
  const bookBtnScale = useRef(new Animated.Value(1)).current;
  const onBookPressIn  = () => Animated.spring(bookBtnScale, { toValue: 0.97, useNativeDriver: true, friction: 5, tension: 300 }).start();
  const onBookPressOut = () => Animated.spring(bookBtnScale, { toValue: 1,    useNativeDriver: true, friction: 5, tension: 300 }).start();

  // Pulse the book button once when fare becomes ready — rewarding "ready to book" signal
  const prevHasFareRef = useRef(false);
  useEffect(() => {
    if (hasFare && !prevHasFareRef.current) {
      Animated.sequence([
        Animated.spring(bookBtnScale, { toValue: 1.04, useNativeDriver: true, friction: 4, tension: 250 }),
        Animated.spring(bookBtnScale, { toValue: 1,    useNativeDriver: true, friction: 5, tension: 180 }),
      ]).start();
    }
    prevHasFareRef.current = hasFare;
  }, [hasFare]);

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

  // Pulsing shimmer when GPS is being fetched
  const pickupLocAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (!pickerLoading) { pickupLocAnim.setValue(0.4); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pickupLocAnim, { toValue: 1,   duration: 540, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(pickupLocAnim, { toValue: 0.4, duration: 540, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pickerLoading]);

  // Seed userCoords from cache on mount so walk line appears without user tapping GPS
  useEffect(() => {
    Location.getLastKnownPositionAsync({}).then(loc => {
      if (loc && !userCoords) {
        setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    }).catch(() => {});
  }, []);

  // Auto-prefill pickup via GPS on mount instead of waiting for the user to
  // tap "use my location" — only when permission is ALREADY granted (a plain
  // status check, not a request), so a first-time user never gets ambushed
  // by a permission dialog they didn't ask for; that case still falls back
  // to the manual GPS-button flow. The user still reviews/edits it — this
  // only removes the "tap a button, wait" step for the common repeat-visit case.
  useEffect(() => {
    if (pickup || pickupCoords) return;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync().catch(() => ({ status: 'undetermined' } as any));
      if (status !== 'granted') return;
      const cached = await Location.getLastKnownPositionAsync({}).catch(() => null);
      if (!cached || pickup || pickupCoords) return;
      const { latitude, longitude } = cached.coords;
      setUserCoords({ latitude, longitude });
      const addr = await reverseGeocode(latitude, longitude);
      if (pickup || pickupCoords) return; // user started typing while this resolved
      setPickup(addr);
      setPickupCoords({ lat: latitude, lng: longitude });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Drop map picker ───────────────────────────────────────────────────────────
  const [dropPickerOpen, setDropPickerOpen]     = useState(false);
  const [dropPickerLoading, setDropPickerLoading] = useState(false);
  const walkGpsOrigin = (() => {
    const lat = (userCoords as any)?.latitude ?? (userCoords as any)?.lat;
    const lng = (userCoords as any)?.longitude ?? (userCoords as any)?.lng;
    return lat != null ? { lat: lat as number, lng: lng as number } : null;
  })();

  const handleUseMyLocation = async () => {
    setPickerLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setPickerLoading(false); return; }

      // Open the picker on a cached fix immediately — a live GPS lock can
      // take 5-7s in practice (far more than the "~1-3s" a Balanced-accuracy
      // fix is supposed to take), and there's no reason to make the user
      // stare at "Finding your location…" for all of that just to see the
      // map. The pin corrects itself in the background once the live fix
      // resolves (below), same as it would if they nudged it themselves.
      const cached = await Location.getLastKnownPositionAsync({}).catch(() => null);
      if (cached) {
        setUserCoords({ latitude: cached.coords.latitude, longitude: cached.coords.longitude });
        setPickerCoords({ lat: cached.coords.latitude, lng: cached.coords.longitude });
        setPickerLoading(false);
      }

      // Balanced = network + GPS, resolves in ~1–3s on any device (High can hang 30s+ indoors)
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setPickerCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch (_e) {
      // If live fix fails, open picker at cached position so user isn't stuck
      const cached = await Location.getLastKnownPositionAsync({}).catch(() => null);
      if (cached) {
        setUserCoords({ latitude: cached.coords.latitude, longitude: cached.coords.longitude });
        setPickerCoords({ lat: cached.coords.latitude, lng: cached.coords.longitude });
      }
    }
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

  const handleOpenDropPicker = async () => {
    // If we already have drop coords, jump straight there; otherwise geocode the typed text first
    if (dropCoords) { setDropPickerOpen(true); return; }
    if (drop) {
      setDropPickerLoading(true);
      const coords = await geocodeForPicker(drop);
      setDropPickerLoading(false);
      if (coords) setDropCoords(coords);
    }
    setDropPickerOpen(true);
  };

  const handleDropPickerConfirm = (
    address: string,
    coords: { lat: number; lng: number },
    _saveLabel: 'Home' | 'Work' | null,
  ) => {
    setDrop(address);
    setDropCoords(coords);
    setDropSugg([]);
    setDropPickerOpen(false);
    // Clear fare so it recalculates with the new coords
    setFareEstimates({}); setEta(''); lastFetchKey.current = '';
  };

  // ── Route ETA (from LiveMap directions API callback) ─────────────────────────
  const [routeEta, setRouteEta]   = useState('');
  const [routeDist, setRouteDist] = useState('');
  // Reset when route is cleared
  useEffect(() => {
    if (!dropCoords) {
      setRouteEta(''); setRouteDist('');
      setRouteOptions(null); setRouteFares(null); setSelectedRoute('fastest');
      lastRouteKeyRef.current = '';
    }
  }, [dropCoords]);

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
  //  drawerInputH when searching | drawerCompact when route confirmed | drawerBrowse when expanded
  const [inputFocused, setInputFocused]     = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const bothSet = !!(pickupCoords && dropCoords);

  // ROOT FIX for the "book button disappears / gap shows background" bug:
  // The book bar used to hide on `inputFocused`, but RN's onBlur is unreliable
  // (tapping the map, picking a suggestion, or a programmatic Keyboard.dismiss
  // often doesn't fire it) so the flag got stuck true → the whole book bar
  // stopped rendering and the drawer left an empty reserved gap showing the
  // background. keyboardDidShow/Hide are OS-level events tied to the ACTUAL
  // keyboard, so they're the reliable source of truth — the bar shows whenever
  // the keyboard is physically down and can never get stuck again.
  const [keyboardShown, setKeyboardShown] = useState(false);
  useEffect(() => {
    const s1 = Keyboard.addListener('keyboardDidShow', () => setKeyboardShown(true));
    const s2 = Keyboard.addListener('keyboardDidHide', () => { setKeyboardShown(false); setInputFocused(false); });
    return () => { s1.remove(); s2.remove(); };
  }, []);

  // Auto-collapse drawer when route is confirmed so map becomes prominent
  useEffect(() => {
    if (bothSet) setDrawerExpanded(false);
  }, [bothSet]);

  const drawerHeightAnim = useRef(new Animated.Value(drawerInputH)).current;
  useEffect(() => {
    const target = keyboardShown                ? drawerMax
      : !bothSet || inputFocused ? drawerInputH
      : drawerExpanded                       ? drawerBrowse
      : drawerCompact;
    Animated.spring(drawerHeightAnim, { toValue: target, friction: 8, tension: 85, useNativeDriver: false }).start();
  }, [bothSet, inputFocused, drawerExpanded, drawerInputH, drawerBrowse, drawerCompact, drawerMax, keyboardShown]);

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


  // Android already resizes the window for the keyboard via
  // android:windowSoftInputMode="adjustResize" in the manifest — layering
  // KeyboardAvoidingView's own 'height' resize on top of that is
  // double-compensation, and over many repeated keyboard open/close cycles
  // (editing pickup/drop back and forth) it drifts, which showed up as the
  // fixed bottom bar intermittently leaving a gap above the OS nav bar.
  // Only iOS (no OS-level auto-resize) needs RN to do this.
  return (
    <KeyboardAvoidingView style={[s.screen, { backgroundColor: C.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
          onRoutes={handleRoutes}
          selectedRouteType={selectedRoute}
          fitKey={fitKey}
          walkOrigin={walkGpsOrigin}
          pickupLabel={shortAreaLabel(pickup)}
          dropLabel={shortAreaLabel(drop)}
        />
        {/* Floating back button — hidden while the keyboard is up, since the
             drawer maximizes to ~94% of the screen in that state (full-page
             suggestions) and would otherwise ghost through this button's
             position at the very top of the map sliver that's left. */}
        {!keyboardShown && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { setScreen('home'); setPickupSugg([]); setDropSugg([]); setEta(''); setPromoCode(''); setPromoDiscount(0); setInstantApplied(false); setShowPromoInput(false); }}
          style={{
            position: 'absolute', zIndex: 10,
            top: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 54,
            left: 16,
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: '#fff',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: 'rgba(46,20,97,0.08)',
            elevation: 10,
            shadowColor: C.plum, shadowOpacity: 0.24, shadowRadius: 14, shadowOffset: { width: 0, height: 5 },
          }}>
          <Ionicons name="arrow-back" size={21} color={C.plum} />
        </TouchableOpacity>
        )}

        {/* Edit + save — floating over the map once both points are confirmed.
             Replaces the old tappable FROM/TO card in the drawer: the
             addresses now live as tags on the pins themselves, so editing
             happens from here instead. */}
        {!!(pickupCoords && dropCoords) && (
          <View style={{
            position: 'absolute', zIndex: 10, right: 16,
            top: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 54,
            gap: 10,
          }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => { setDropCoords(null); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; }}
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: C.pink,
                alignItems: 'center', justifyContent: 'center',
                elevation: 10,
                shadowColor: C.pink, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 5 },
              }}>
              <Ionicons name="pencil" size={19} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => openSavePicker({ text: drop, coords: dropCoords! })}
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: '#fff',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: 'rgba(46,20,97,0.08)',
                elevation: 10,
                shadowColor: C.plum, shadowOpacity: 0.24, shadowRadius: 14, shadowOffset: { width: 0, height: 5 },
              }}>
              <Ionicons name="bookmark-outline" size={19} color={C.plum} />
            </TouchableOpacity>
          </View>
        )}

      </View>

      {/* ─── Bottom drawer — slides up/down over map ─── */}
      {/* Floor seal: covers any gap below the drawer and blocks DotBG blobs.
          Height tracks the same clamped inset as the CTA bar below so the two
          never disagree and leave a mismatched strip on either side. */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 + bottomInset, backgroundColor: C.bg }} pointerEvents="none" />
      <Animated.View style={{ height: drawerHeightAnim, backgroundColor: C.bg, elevation: 3, zIndex: 2 }}>
      <GlassPanel intensity={22} style={{
        flex: 1,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        marginTop: -32,
        overflow: 'hidden',
        elevation: 26,
        shadowColor: C.plum,
        shadowOpacity: 0.20,
        shadowRadius: 26,
        shadowOffset: { width: 0, height: -8 },
        backgroundColor: C.bg,
        borderColor: 'rgba(180,160,255,0.18)',
      }}>
        {/* Drag handle — tap to expand/collapse when route is confirmed */}
        <TouchableOpacity
          activeOpacity={bothSet && !inputFocused ? 0.7 : 1}
          onPress={() => { if (bothSet && !inputFocused) setDrawerExpanded(e => !e); }}
          style={{ alignItems: 'center', paddingTop: 12, paddingBottom: bothSet && !inputFocused ? 3 : 10 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: C.glassB2 }} />
          {bothSet && !inputFocused && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 7,
              backgroundColor: C.glassMid, borderRadius: R.full,
              paddingHorizontal: 10, paddingVertical: 3,
            }}>
              <Ionicons
                name={drawerExpanded ? 'chevron-down' : 'chevron-up'}
                size={12} color={C.textMuted} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: C.textMuted }}>
                {drawerExpanded ? 'Less' : 'More'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Top-edge coupon banner — stuck to top of drawer, full-width ── */}
        {bothSet && !!routeEta && (() => {
          const maxSave = availablePromos.length > 0
            ? Math.max(...availablePromos.map((p: any) => parseFloat(String(p.max_discount)) || 0))
            : 0;
          const applied = promoDiscount > 0;
          // Unapplied state uses a light lemon-yellow background, so text/icons
          // switch to a dark tone here for contrast (white was for the pink bg).
          const fg      = applied ? '#fff' : '#3D2E00';
          const fgDim   = applied ? 'rgba(255,255,255,0.78)' : 'rgba(61,46,0,0.72)';
          const chipBg  = applied ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.08)';
          return (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => { setCouponError(''); setShowCouponModal(true); }}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: applied ? '#16A34A' : '#FFEB3B',
                paddingVertical: 7, paddingHorizontal: 18, gap: 9,
              }}>
              {/* Icon bubble */}
              <View style={{
                width: 26, height: 26, borderRadius: 9,
                backgroundColor: chipBg,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons
                  name={applied ? 'checkmark-circle' : 'pricetag'}
                  size={14} color={fg}
                />
              </View>
              {/* Text block */}
              <View style={{ flex: 1 }}>
                <Text style={{ color: fg, fontWeight: '900', fontSize: 12, letterSpacing: 0.1 }}>
                  {applied
                    ? `${promoCode} Applied — ₹${promoDiscount} saved on this ride!`
                    : availablePromos.length > 0
                      ? `${availablePromos.length} coupon${availablePromos.length !== 1 ? 's' : ''} available${maxSave > 0 ? ` · Save up to ₹${maxSave}` : ''}!`
                      : 'Have a coupon? Apply & save now!'}
                </Text>
                {!applied && (
                  <Text style={{ color: fgDim, fontSize: 10, marginTop: 1, fontWeight: '600' }}>
                    {availablePromos.length > 0 ? 'Tap to see & apply offers' : 'Enter code in fare section below'}
                  </Text>
                )}
              </View>
              <View style={{
                backgroundColor: chipBg,
                borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
              }}>
                <Text style={{ color: fg, fontSize: 10, fontWeight: '900' }}>
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
          // Clear the fixed book bar (~130px + safe area) so the last rows
          // (offers, fare details) are never hidden behind the CTA
          contentContainerStyle={{ paddingBottom: 150 + bottomInset, paddingHorizontal: 14 }}>

          {/* ─── Location card — once both points are set, the addresses are
                 shown as tags directly on the map pins instead (with an edit
                 pencil + save bookmark floating over the map), so the drawer
                 skips straight to route/vehicle/fare. Nothing to render here
                 in that state. ─── */}
          {pickupCoords && dropCoords ? null : (
            /* Input mode — also hidden while dragging. Full-bleed edge-to-edge
                 (Maps' search-sheet look): the outer drawer panel already
                 provides the rounded-top sheet chrome, so this content runs
                 flush to the screen edges instead of sitting as an inset card. */
            <View style={{
              backgroundColor: C.bgCard,
              marginHorizontal: -14,
              marginBottom: 14,
            }}>
              <View style={{
                padding: 18,
                paddingBottom: hasDropDown ? 12 : 18,
              }}>
                {/* ── "Near me" category search — Hospital/Hotel/Police/... near pickup ── */}
                {!!pickupCoords && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
                  {NEARBY_CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat.label}
                      onPress={() => {
                        Keyboard.dismiss();
                        setDrop(cat.label + ' near me');
                        setDropCoords(null); setFareEstimates({}); setEta(''); lastFetchKey.current = '';
                        searchNearbyCategory(cat.q, 'drop', cat.wideSearch, cat.acceptTypes, cat.rejectTypes);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.glassMid, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.glassBorder }}>
                      <Text style={{ fontSize: 14 }}>{cat.icon}</Text>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.text }}>{cat.shortLabel}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                )}

                {/* Pickup row — flat/minimal, Maps-style (no tinted box, just the dot) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 }}>
                  <Animated.View style={[
                    { width: 13, height: 13, borderRadius: 6.5, backgroundColor: C.green, borderWidth: 2.5, borderColor: 'rgba(5,150,105,0.3)' },
                    pickerLoading && { transform: [{ scale: pickupLocAnim.interpolate({ inputRange: [0.4, 1], outputRange: [0.85, 1.25] }) }] },
                  ]} />
                  {pickerLoading ? (
                    <Animated.Text style={{ flex: 1, fontSize: 14.5, color: C.green, fontWeight: '700', paddingVertical: 10, opacity: pickupLocAnim }}>
                      Finding your location…
                    </Animated.Text>
                  ) : (
                    <TextInput
                      style={{ flex: 1, fontSize: 17, color: C.text, fontWeight: '700', paddingVertical: 11 }}
                      placeholder="Pickup location"
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
                  )}
                  {pickerLoading ? (
                    <Animated.View style={{ padding: 7, opacity: pickupLocAnim }}>
                      <ActivityIndicator size="small" color={C.green} />
                    </Animated.View>
                  ) : pickup ? (
                    <TouchableOpacity onPress={() => { setPickup(''); setPickupCoords(null); setPickupSugg([]); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; }} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={19} color={C.textDim} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={handleUseMyLocation} style={{ padding: 7, borderRadius: 20, backgroundColor: C.pinkGlass, borderWidth: 1.5, borderColor: C.pinkBorder }}>
                      <Ionicons name="navigate" size={16} color={C.pink} />
                    </TouchableOpacity>
                  )}
                </View>

                {pickupSugg.length > 0 && (
                  <View style={[s.suggBox, { zIndex: 100, borderColor: C.glassBorder }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingTop: 2, paddingBottom: 6 }}>
                      <Ionicons name="location" size={11} color={C.green} />
                      <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '900', letterSpacing: 1.2 }}>PICKUP SUGGESTIONS</Text>
                    </View>
                    {pickupSugg.slice(0, 5).map((sg: any, i: number) => (
                      <TouchableOpacity key={i}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: i < pickupSugg.length - 1 ? 1 : 0, borderBottomColor: C.glassBorder }}
                        onPress={async () => {
                          Keyboard.dismiss();
                          setPickup(sg.text);
                          setPickupSugg([]);
                          setPickerLoading(true);
                          const coords = await geocodeForPicker(sg.text);
                          setPickerLoading(false);
                          if (coords) {
                            setPickerCoords(coords);
                          } else {
                            geocodePlace(sg.text, 'pickup');
                          }
                        }}>
                        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.glassMid, alignItems: 'center', justifyContent: 'center', marginRight: 11, borderWidth: 1, borderColor: C.glassBorder, flexShrink: 0 }}>
                          <Ionicons name="location-outline" size={17} color={C.textMuted} />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={{ fontSize: 14.5, color: C.text, fontWeight: '700' }} numberOfLines={1}>{sg.main || sg.text}</Text>
                          {!!sg.secondary && (
                            <Text style={{ fontSize: 12.5, color: C.textMuted, fontWeight: '500' }} numberOfLines={1}>{sg.secondary}</Text>
                          )}
                        </View>
                        {sg.distance_m != null && (
                          <View style={{ marginLeft: 8, backgroundColor: C.glassMid, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
                            <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '700' }}>
                              {sg.distance_m < 1000 ? `${Math.round(sg.distance_m)}m` : `${(sg.distance_m / 1000).toFixed(1)}km`}
                            </Text>
                          </View>
                        )}
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
                            <Text style={{ fontSize: 17 }}>{ic.emoji}</Text>
                            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: C.text, flexShrink: 1 }}>{place.name}</Text>
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

                {/* Separator with floating swap button + Drop row — the "step 2"
                     of the search, only shown once pickup is chosen (step 1). */}
                {!!pickupCoords && (
                <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 5 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: C.glassBorder }} />
                  <TouchableOpacity
                    onPress={swapLocations}
                    style={{
                      width: 32, height: 32, borderRadius: 16,
                      backgroundColor: C.bgCard,
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: 1.5, borderColor: C.glassBorder,
                      marginHorizontal: 10,
                      elevation: 4,
                      shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 6,
                    }}>
                    <Ionicons name="swap-vertical" size={15} color={C.pink} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, height: 1, backgroundColor: C.glassBorder }} />
                </View>

                {/* Drop row — flat/minimal, Maps-style (no tinted box, just the pin) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 }}>
                  <View style={{ width: 13, height: 13, borderRadius: 3, backgroundColor: C.pink, borderWidth: 2.5, borderColor: C.pinkBorder }} />
                  <TextInput
                    style={{ flex: 1, fontSize: 17, color: C.text, fontWeight: '700', paddingVertical: 11 }}
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
                    autoFocus
                  />
                  {dropPickerLoading ? (
                    <View style={{ padding: 7 }}>
                      <ActivityIndicator size="small" color={C.pink} />
                    </View>
                  ) : drop ? (
                    <TouchableOpacity onPress={() => { setDrop(''); setDropCoords(null); setDropSugg([]); setFareEstimates({}); setEta(''); lastFetchKey.current = ''; }} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={19} color={C.textDim} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={handleOpenDropPicker} style={{ padding: 7, borderRadius: 20, backgroundColor: C.pinkGlass, borderWidth: 1.5, borderColor: C.pinkBorder }}>
                      <Ionicons name="map-outline" size={16} color={C.pink} />
                    </TouchableOpacity>
                  )}
                </View>
                </>
                )}
              </View>

              {/* ── Attached dropdown — appears directly below input card, same rounded surface ── */}
              {!!pickupCoords && hasDropDown && (
                <View>
                  {/* Thin separator line */}
                  <View style={{ height: 1, backgroundColor: C.glassBorder, marginHorizontal: 16 }} />

                  {showDropSugg && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
                      <Ionicons name="location" size={11} color={C.pink} />
                      <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '900', letterSpacing: 1.2 }}>DROP SUGGESTIONS</Text>
                    </View>
                  )}
                  {showDropSugg && dropSugg.slice(0, 5).map((sg: any, i: number) => (
                    <TouchableOpacity key={i}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 16, borderBottomWidth: i < Math.min(dropSugg.length, 5) - 1 ? 1 : 0, borderBottomColor: C.glassBorder }}
                      onPress={() => { Keyboard.dismiss(); setDrop(sg.text); setDropSugg([]); geocodePlace(sg.text, 'drop'); }}>
                      {/* Location pin icon — clean, neutral */}
                      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.glassMid, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: C.glassBorder, flexShrink: 0 }}>
                        <Ionicons name="location-outline" size={18} color={C.textMuted} />
                      </View>
                      {/* Two-line address */}
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontSize: 14.5, color: C.text, fontWeight: '700' }} numberOfLines={1}>{sg.main || sg.text}</Text>
                        {!!sg.secondary && (
                          <Text style={{ fontSize: 12.5, color: C.textMuted, fontWeight: '500' }} numberOfLines={1}>{sg.secondary}</Text>
                        )}
                      </View>
                      {/* Distance badge — from pickup, once pickup is set */}
                      {sg.distance_m != null && (
                        <View style={{ marginLeft: 8, backgroundColor: C.glassMid, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
                          <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '700' }}>
                            {sg.distance_m < 1000 ? `${Math.round(sg.distance_m)}m` : `${(sg.distance_m / 1000).toFixed(1)}km`}
                          </Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={14} color={C.textDim} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ))}

                  {showDropHist && (
                    <>
                      {/* ── Recent-destinations header row doubles as the Home/Office
                             quick-access slot — same line, spare space on the right,
                             instead of a whole separate row above the input. ── */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {dropHistory.length > 0 && (
                            <>
                              <Ionicons name="time" size={12} color={C.textMuted} />
                              <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '900', letterSpacing: 1.2 }}>RECENT</Text>
                            </>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {savedPlaces.home ? (
                            <TouchableOpacity
                              onPress={() => selectSaved(savedPlaces.home!)}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.glassMid, borderRadius: R.full, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: C.glassBorder }}>
                              <Text style={{ fontSize: 12 }}>🏠</Text>
                              <Text style={{ fontSize: 11, fontWeight: '800', color: C.text }}>Home</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              onPress={() => { setSaveTarget(null); setShowSavePicker(true); }}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: R.full, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: C.glassBorder, borderStyle: 'dashed' }}>
                              <Ionicons name="add" size={12} color={C.textMuted} />
                              <Text style={{ fontSize: 10.5, fontWeight: '700', color: C.textMuted }}>Home</Text>
                            </TouchableOpacity>
                          )}
                          {savedPlaces.office ? (
                            <TouchableOpacity
                              onPress={() => selectSaved(savedPlaces.office!)}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.glassMid, borderRadius: R.full, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: C.glassBorder }}>
                              <Text style={{ fontSize: 12 }}>🏢</Text>
                              <Text style={{ fontSize: 11, fontWeight: '800', color: C.text }}>Office</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              onPress={() => { setSaveTarget(null); setShowSavePicker(true); }}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: R.full, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: C.glassBorder, borderStyle: 'dashed' }}>
                              <Ionicons name="add" size={12} color={C.textMuted} />
                              <Text style={{ fontSize: 10.5, fontWeight: '700', color: C.textMuted }}>Office</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      {dropHistory.length > 0 && (
                        <>
                          {dropHistory.slice(0, 3).map((h, i) => (
                            <TouchableOpacity key={i}
                              activeOpacity={0.75}
                              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.glassBorder }}
                              onPress={() => { Keyboard.dismiss(); setDrop(h.text); setDropSugg([]); if (h.coords) setDropCoords(h.coords); else geocodePlace(h.text, 'drop'); }}>
                              {/* Icon */}
                              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.glassMid, alignItems: 'center', justifyContent: 'center', marginRight: 13, borderWidth: 1.5, borderColor: C.glassBorder }}>
                                <Ionicons name="location-outline" size={17} color={C.textMuted} />
                              </View>
                              {/* Address */}
                              <Text style={{ fontSize: 14.5, color: C.text, flex: 1, fontWeight: '600' }} numberOfLines={1}>{h.text}</Text>
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
                    </>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ─── Nearest driver recommendation banner ─── */}
          {etaLoaded && (() => {
            // Only consider drivers with a real ETA — a driver whose GPS hasn't
            // reported yet has info but a null eta_min, which used to render as
            // a literal blank ("arriving in ~ min").
            const nearest = RIDES
              .map(r => ({ r, info: driverEta[r.id] }))
              .filter((x): x is { r: typeof x.r; info: NonNullable<typeof x.info> & { eta_min: number } } => x.info?.eta_min != null)
              .sort((a, b) => a.info.eta_min - b.info.eta_min)[0];
            if (!nearest) return null;
            return (
              <View style={{ backgroundColor: C.bgCard, borderRadius: R.sm, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: C.glassBorder }}>
                <Text style={{ fontSize: 15 }}>💡</Text>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.textMuted, flex: 1 }}>
                  {nearest.r.label} is nearest — arriving in ~{nearest.info.eta_min} min
                </Text>
                {rideType !== nearest.r.id && (
                  <TouchableOpacity onPress={() => { setRideType(nearest.r.id); setVehicleBrowsing(false); }} style={{ backgroundColor: C.textMuted, borderRadius: R.xs, paddingHorizontal: 12, paddingVertical: 6, elevation: 3, shadowColor: C.textMuted, shadowOpacity: 0.3, shadowRadius: 6 }}>
                    <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '900' }}>Select</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}

          {/* ─── Route + vehicle — one flat Maps-style card: route summary, a
                 thin mode-tab strip (icon+fare per vehicle, underline-selected —
                 mirrors Maps' "Public transport" mode tabs), then the detail row
                 for whichever vehicle is currently selected. ─── */}
          <View style={{
            backgroundColor: C.bgCard,
            marginHorizontal: -14,
            overflow: 'hidden',
            marginBottom: 16,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: C.glassBorder,
          }}>
            {/* Route summary row — only once both points are set */}
            {bothSet && (
              <>
                <Animated.View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingHorizontal: 16, paddingVertical: 13,
                  opacity: routeEta ? etaCardFade : 1,
                  transform: routeEta ? [{ translateY: etaCardSlide }] : [],
                }}>
                  {routeEta ? (
                    <>
                      <Ionicons name="time-outline" size={15} color={C.textMuted} />
                      <Text style={{ fontSize: 13.5, fontWeight: '900', color: C.text }}>{routeEta}</Text>
                      <Text style={{ fontSize: 12, color: C.textDim }}>·</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.textMuted }}>{routeDist}</Text>
                      <View style={{ flex: 1 }} />
                      {(() => {
                        // Only count drivers with a real ETA — one whose GPS
                        // hasn't reported yet has an entry but a null eta_min,
                        // which used to fall through to a 999-sentinel and
                        // render literally as "driver ~999 min".
                        if (!etaLoaded) return null;
                        const etas = Object.values(driverEta).map((v: any) => v?.eta_min).filter((n: any) => n != null);
                        if (etas.length === 0) return null;
                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
                              <Animated.View style={{
                                position: 'absolute', width: 14, height: 14, borderRadius: 7,
                                backgroundColor: C.green,
                                opacity: pulseDot.interpolate({ inputRange: [1, 1.9], outputRange: [0.35, 0] }),
                                transform: [{ scale: pulseDot }],
                              }} />
                              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.green }} />
                            </View>
                            <Text style={{ fontSize: 11, color: C.green, fontWeight: '800' }}>
                              driver ~{Math.min(...etas)} min
                            </Text>
                          </View>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.plum, opacity: 0.5 }} />
                      <Text style={{ color: C.plum, fontWeight: '700', fontSize: 12, opacity: 0.7 }}>Calculating route…</Text>
                    </>
                  )}
                </Animated.View>
                <View style={{ height: 1, backgroundColor: C.glassBorder }} />
              </>
            )}

            {/* Vehicle mode-tab strip */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 2 }}
            >
              {RIDES.map((r: any) => {
                const isSel = rideType === r.id;
                const isLux = r.id === 'luxury';
                const accent = isLux ? C.purple : C.pink;
                // routeFares (Fastest/Shortest) only ever apply to whichever
                // vehicle is currently selected — for that one tab, show the
                // same overridden fare the Book button uses below, so the two
                // numbers on screen never disagree with each other.
                const fareText = fareLoading ? '…'
                  : (isSel && routeChoiceActive && routeFares) ? `₹${routeFares[selectedRoute]}`
                  : fareEstimates[r.id] ? `₹${fareEstimates[r.id].fare ?? fareEstimates[r.id]}` : `₹${r.base}+`;
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
                            toValue: ride.id === r.id ? 1.02 : 1,
                            friction: 5, tension: 180, useNativeDriver: true,
                          }).start();
                        });
                      }}
                      activeOpacity={0.75}
                      style={{
                        minWidth: 96, alignItems: 'center',
                        paddingHorizontal: 16, paddingBottom: 10, paddingTop: 4,
                        opacity: notAvail ? 0.45 : 1,
                        borderBottomWidth: 3,
                        borderBottomColor: isSel ? accent : 'transparent',
                      }}>
                      <RideVehicleIcon id={r.id} size={28} color={isSel ? accent : notAvail ? C.textDim : C.textMuted} />
                      {fareLoading ? (
                        <SkeletonBox width={46} height={16} radius={4} style={{ marginTop: 8 }} />
                      ) : (
                        <Text style={{ fontSize: 15, fontWeight: isSel ? '900' : '700', color: isSel ? C.text : C.textMuted, marginTop: 8 }}>
                          {fareText}
                        </Text>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5, minHeight: 14 }}>
                        {!etaLoaded ? null : notAvail ? (
                          <Text style={{ fontSize: 9.5, color: C.textDim, fontWeight: '700' }}>no driver</Text>
                        ) : info ? (
                          <>
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isFar ? C.yellow : C.green }} />
                            <Text style={{ fontSize: 9.5, color: isFar ? C.yellow : C.green, fontWeight: '800' }}>
                              {info.eta_min !== null ? `${info.eta_min}m` : '…'}
                            </Text>
                          </>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </ScrollView>

            {/* "Leave now ▾" row — Maps-style departure-time control, sits right
                 below the mode-tab strip (was previously a chip buried in the
                 fixed bottom bar). */}
            <View style={{ borderTopWidth: 1, borderTopColor: C.glassBorder }}>
              {scheduledAt ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 11 }}>
                  <Ionicons name="calendar" size={14} color="#F59E0B" />
                  <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '800', color: '#92400E' }} numberOfLines={1}>
                    {scheduledAt.label}
                  </Text>
                  <TouchableOpacity onPress={() => setScheduledAt(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={17} color="#D97706" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowSchedulePicker(true)}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11 }}
                >
                  <Ionicons name="time-outline" size={14} color={C.textMuted} />
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.textMuted }}>Leave now</Text>
                  <Ionicons name="chevron-down" size={13} color={C.textDim} />
                </TouchableOpacity>
              )}
            </View>

            {/* Selected vehicle detail row */}
            {(() => {
              const info = driverEta[rideType];
              const sel = RIDES.find((r: any) => r.id === rideType);
              if (!sel) return null;
              const notAvail = etaLoaded && !info;
              const isFar = info?.dist_km !== null && info?.dist_km > 5;
              const stripColor = notAvail ? C.red : isFar ? C.yellow : etaLoaded ? C.green : C.textMuted;
              const bestAlt = notAvail
                ? (RIDES as any[]).filter(r => r.id !== rideType && driverEta[r.id])
                                 .sort((a, b) => ((driverEta[a.id]?.eta_min || 999) - (driverEta[b.id]?.eta_min || 999)))[0]
                : null;
              return (
                <View style={{ borderTopWidth: 1, borderTopColor: C.glassBorder, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: stripColor }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: C.text }} numberOfLines={1}>
                      {notAvail
                        ? `No ${sel.label} driver nearby`
                        : isFar
                          ? `${sel.label} driver is a bit far`
                          : etaLoaded
                            ? `${sel.label} driver available`
                            : sel.label}
                    </Text>
                    <Text style={{ fontSize: 10.5, color: C.textDim, marginTop: 2 }} numberOfLines={1}>
                      {sel.desc}
                      {info?.eta_min != null ? `  ·  ~${info.eta_min} min` : ''}
                      {info?.dist_km != null ? `  ·  ${info.dist_km} km away` : ''}
                    </Text>
                  </View>
                  {bestAlt && (
                    <TouchableOpacity
                      onPress={() => { setRideType(bestAlt.id); setVehicleBrowsing(false); }}
                      style={{ backgroundColor: C.pink, borderRadius: R.xs, paddingHorizontal: 10, paddingVertical: 6, elevation: 3, shadowColor: C.pink, shadowOpacity: 0.3, shadowRadius: 6 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>Try {bestAlt.label}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })()}
          </View>

          {/* ── Who's riding — defaults to "Myself"; picking "Someone else"
                 reveals a quick name+phone so the driver knows who to look
                 for at pickup and can reach them directly. Sits right after
                 the vehicle is chosen, just before the fare/coupon details. ── */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setRideForSelf(true)}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  paddingVertical: 10, borderRadius: R.full,
                  backgroundColor: rideForSelf ? C.yellowGlass : C.glassMid,
                  borderWidth: 1.5, borderColor: rideForSelf ? C.yellow : C.glassBorder,
                }}>
                <Ionicons name="person" size={14} color={rideForSelf ? C.yellow : C.textMuted} />
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: rideForSelf ? C.yellow : C.textMuted }}>For Myself</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setRideForSelf(false)}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  paddingVertical: 10, borderRadius: R.full,
                  backgroundColor: !rideForSelf ? C.yellowGlass : C.glassMid,
                  borderWidth: 1.5, borderColor: !rideForSelf ? C.yellow : C.glassBorder,
                }}>
                <Ionicons name="people" size={14} color={!rideForSelf ? C.yellow : C.textMuted} />
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: !rideForSelf ? C.yellow : C.textMuted }}>For Someone Else</Text>
              </TouchableOpacity>
            </View>

            {!rideForSelf && (
              <View style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={{ flex: 1, backgroundColor: C.glassMid, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: C.text, borderWidth: 1, borderColor: C.glassBorder }}
                    placeholder="Their name"
                    placeholderTextColor={C.textDim}
                    value={riderName}
                    onChangeText={setRiderName}
                  />
                  <TextInput
                    style={{ flex: 1, backgroundColor: C.glassMid, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: C.text, borderWidth: 1, borderColor: C.glassBorder }}
                    placeholder="Their 10-digit phone"
                    placeholderTextColor={C.textDim}
                    keyboardType="number-pad"
                    maxLength={10}
                    value={riderPhone}
                    onChangeText={(v: string) => setRiderPhone(v.replace(/[^0-9]/g, ''))}
                  />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, paddingHorizontal: 2 }}>
                  <Ionicons name="information-circle" size={14} color={C.textMuted} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 11, color: C.textMuted, lineHeight: 15 }}>
                    You'll still get all ride updates and pay from your account — we just share these details with the driver so they know who to look for and can call them directly if needed.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ─── Fare breakdown ─────────────────────────────── */}
          {selRide && hasFare ? (
            <View style={{
              backgroundColor: C.bgCard,
              borderRadius: R.lg,
              marginTop: 18,
              elevation: 8,
              overflow: 'hidden',
              borderWidth: 1.5,
              borderColor: C.glassBorder,
              shadowColor: C.plum,
              shadowOpacity: 0.10,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
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
              <View style={{ backgroundColor: C.pinkGlass, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderColor: C.glassBorder }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.pinkGlass, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.pinkBorder }}>
                  <RideVehicleIcon id={selRide.id} size={21} color={C.pink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '800', fontSize: 14.5 }}>{selRide.label}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 1 }}>{selRide.desc}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: C.plum, fontWeight: '900', fontSize: 26, letterSpacing: -0.6 }}>₹{finalFare}</Text>
                  {discount > 0 && <Text style={{ color: C.textDim, fontSize: 11, textDecorationLine: 'line-through' }}>₹{rawFare}</Text>}
                  {fareHistoryEntry && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, backgroundColor: C.greenGlass, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.greenBorder }}>
                      <Text style={{ fontSize: 9, color: C.green, fontWeight: '700' }}>
                        Last time: ₹{fareHistoryEntry.fare}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Line items */}
              <View style={{ paddingHorizontal: 18, paddingVertical: 14, gap: 9 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: C.textMuted }}>Distance fare</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>₹{estDistFare > 0 ? estDistFare : '—'}</Text>
                </View>
                {estTimeFare > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: C.textMuted }}>Time fare</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>₹{estTimeFare}</Text>
                  </View>
                )}
                {isNightFare && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#7c6ef5', fontWeight: '700' }}>🌙 Night multiplier</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#7c6ef5' }}>Applied</Text>
                  </View>
                )}
                {isMinApplied && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: C.textMuted, fontStyle: 'italic' }}>Min fare applied</Text>
                    <Text style={{ fontSize: 13, color: C.textMuted, fontStyle: 'italic' }}>₹{_est?.min_fare ?? 0}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: C.textMuted }}>Platform fee</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>₹{estPlatFee}</Text>
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
                <View style={{ height: 1, backgroundColor: C.glassBorder, marginVertical: 3 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 15.5, fontWeight: '800', color: C.text }}>Total</Text>
                    {discount > 0 && (
                      <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>Trip ₹{tripSubtotal} + Platform ₹{estPlatFee}</Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 25, fontWeight: '900', color: C.plum, letterSpacing: -0.5 }}>₹{finalFare}</Text>
                </View>
              </View>

              {/* Instant promo offer */}
              {!instantApplied && discount === 0 && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => { setPromoDiscount(2); setPromoCode('SPPERO2'); setInstantApplied(true); }}
                  style={{ marginHorizontal: 18, marginBottom: 16, backgroundColor: C.greenGlass, borderRadius: R.sm, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1.5, borderColor: C.greenBorder, borderStyle: 'dashed' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.greenGlass, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>🎁</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: C.green }}>₹2 OFF — Instant Discount</Text>
                    <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Tap to apply • No code needed</Text>
                  </View>
                  <View style={{ backgroundColor: C.green, borderRadius: R.xs, paddingHorizontal: 13, paddingVertical: 7, elevation: 3, shadowColor: C.green, shadowOpacity: 0.3, shadowRadius: 6 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>APPLY</Text>
                  </View>
                </TouchableOpacity>
              )}
              {instantApplied && (
                <View style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: C.greenGlass, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.greenBorder }}>
                  <Text style={{ fontSize: 18 }}>✅</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.green, flex: 1 }}>₹2 instant discount applied!</Text>
                  <TouchableOpacity onPress={() => { setPromoDiscount(0); setPromoCode(''); setInstantApplied(false); }}>
                    <Ionicons name="close-circle" size={20} color={C.green} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Promo code toggle */}
              <TouchableOpacity
                onPress={() => setShowPromoInput(!showPromoInput)}
                style={{ marginHorizontal: 18, marginBottom: showPromoInput ? 0 : 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.pink }}>🏷️ Have a promo code?</Text>
                <Ionicons name={showPromoInput ? 'chevron-up' : 'chevron-down'} size={14} color={C.pink} />
              </TouchableOpacity>
              {showPromoInput && (
                <View style={{ marginHorizontal: 18, marginBottom: 12, marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.glassMid, borderRadius: R.sm, padding: 11, borderWidth: 1, borderColor: C.glassBorder }}>
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
                  <TouchableOpacity onPress={applyPromo} style={{ backgroundColor: BRAND_PINK, borderRadius: R.xs, paddingHorizontal: 15, paddingVertical: 9, elevation: 4, shadowColor: BRAND_PINK, shadowOpacity: 0.4, shadowRadius: 6 }}>
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
        </ScrollView>

      </GlassPanel>
      </Animated.View>

      {/* ─── Far-driver commitment modal ─── */}
      {showWaitModal && (() => {
        const info = driverEta[rideType];
        const extraMin = info ? Math.max(0, info.eta_min - 5) : 0;
        const selLabel = RIDES.find(r => r.id === rideType)?.label || 'Ride';
        return (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'flex-end', zIndex: 999 }}>
            <View style={{ backgroundColor: C.bgDark, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 + bottomInset, borderTopWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', elevation: 30, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 30 }}>

              {/* Warning icon + title */}
              <View style={{ alignItems: 'center', marginBottom: 22 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.yellowGlass, alignItems: 'center', justifyContent: 'center', marginBottom: 13, borderWidth: 2, borderColor: C.yellowBorder }}>
                  <Text style={{ fontSize: 30 }}>⚠️</Text>
                </View>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>Driver is a Bit Far</Text>
                <Text style={{ fontSize: 12.5, color: C.textDim, marginTop: 5 }}>{selLabel} driver is outside your pickup area</Text>
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
                  style={{ flex: 2, backgroundColor: waitConfirmed ? BRAND_PINK : C.glassMid, borderRadius: 16, paddingVertical: 17, alignItems: 'center', elevation: waitConfirmed ? 10 : 0, shadowColor: BRAND_PINK, shadowOpacity: waitConfirmed ? 0.48 : 0, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}>
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
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'flex-end', zIndex: 999 }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSavePicker(false)} />
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 + bottomInset, borderTopWidth: 1.5, borderColor: C.glassBorder, elevation: 28, shadowColor: C.plum, shadowOpacity: 0.22, shadowRadius: 26 }}>

            {/* Handle */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: C.glassB2 }} />
            </View>

            {/* Label */}
            <Text style={{ fontSize: 12, color: C.textDim, fontWeight: '900', letterSpacing: 1.3, marginBottom: 6 }}>SAVE LOCATION AS</Text>
            {saveTarget && (
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 20 }} numberOfLines={1}>{saveTarget.text}</Text>
            )}

            {/* Options */}
            <View style={{ gap: 12 }}>
              {/* Home */}
              <TouchableOpacity activeOpacity={0.85} onPress={() => savePlaceAs('home')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.plumGlass, borderRadius: R.md, padding: 16, borderWidth: 1.5, borderColor: C.plumBorder }}>
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.plum, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: C.plum, shadowOpacity: 0.3, shadowRadius: 8 }}>
                  <Text style={{ fontSize: 23 }}>🏠</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: '800', color: C.text }}>Home</Text>
                  <Text style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                    {savedPlaces.home ? `Replace: ${savedPlaces.home.text}` : 'Set your home address'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textDim} />
              </TouchableOpacity>

              {/* Office */}
              <TouchableOpacity activeOpacity={0.85} onPress={() => savePlaceAs('office')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.purpleGlass, borderRadius: R.md, padding: 16, borderWidth: 1.5, borderColor: C.purpleBorder }}>
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: C.purple, shadowOpacity: 0.3, shadowRadius: 8 }}>
                  <Text style={{ fontSize: 23 }}>🏢</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: '800', color: C.text }}>Office</Text>
                  <Text style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                    {savedPlaces.office ? `Replace: ${savedPlaces.office.text}` : 'Set your work address'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textDim} />
              </TouchableOpacity>

              {/* Other */}
              <TouchableOpacity activeOpacity={0.85} onPress={() => savePlaceAs('other')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.glassMid, borderRadius: R.md, padding: 16, borderWidth: 1.5, borderColor: C.glassBorder }}>
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.glassBorder }}>
                  <Text style={{ fontSize: 23 }}>📍</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: '800', color: C.text }}>Favourite Place</Text>
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
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'flex-end' }}>
          {/* Backdrop tap closes modal */}
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCouponModal(false)} />

          <View style={{
            backgroundColor: C.bg,
            borderTopLeftRadius: 32, borderTopRightRadius: 32,
            paddingBottom: bottomInset + 20,
            maxHeight: '78%',
            elevation: 28,
            shadowColor: C.plum, shadowOpacity: 0.22, shadowRadius: 26,
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

      {/* ─── Fixed book bar — info strip + full-width CTA ───
           Visibility is driven by the ACTUAL keyboard state (keyboardShown),
           NOT the unreliable inputFocused flag — so it always reappears the
           moment the keyboard closes and can never get stuck hidden. Hidden
           only while the keyboard is up (typing a destination), so the
           suggestion list gets the full drawer, like Uber/Rapido. */}
      {!keyboardShown && (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
          // Flush bottom-menu bar — flat, edge-to-edge, opaque white like a
          // standard bottom nav/action bar, not a floating rounded card.
          backgroundColor: C.bgCard,
          paddingHorizontal: 16, paddingTop: 14,
          // Match the app's own bottom tab bar (HomeScreen's `s.nav` style)
          // exactly: a fixed platform padding, not `useSafeAreaInsets()`.
          // The dynamic inset here used to under-report on some devices,
          // leaving a black gap between this bar and the OS nav bar — the
          // home tab bar never has that problem because it never relies on
          // the inset at all.
          paddingBottom: Platform.OS === 'android' ? 44 : Math.max(bottomInset, 16),
          borderTopWidth: 1, borderTopColor: C.glassBorder,
          elevation: 20,
          shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -3 },
          gap: 11,
        }}>

          {/* ── Route: always show a route row for eligible vehicles; upgrade to
                 an interactive Fastest/Shortest choice only when a genuinely
                 shorter route exists (most city trips have one best route). ── */}
          {routeChoiceEligible && routeOptions && !loading && !scheduledAt && !(routeChoiceActive && routeFares) && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 9,
              backgroundColor: C.bgCard, borderRadius: R.sm,
              borderWidth: 1.5, borderColor: C.glassBorder,
              paddingVertical: 10, paddingHorizontal: 14,
            }}>
              <Text style={{ fontSize: 14 }}>🛣️</Text>
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: C.text }}>Best route</Text>
              <View style={{ flex: 1 }} />
              <Text style={{ fontSize: 11.5, color: C.textMuted, fontWeight: '600' }}>
                {routeOptions.fastest.etaText} · {routeOptions.fastest.distText}
              </Text>
            </View>
          )}

          {/* ── Route choice — Fastest vs Shortest (saves money) ── */}
          {routeChoiceActive && routeFares && !loading && !scheduledAt && (() => {
            const saving = Math.max(0, Math.round(routeFares.fastest - routeFares.shortest));
            const opts: { key: 'fastest' | 'shortest'; icon: string; label: string; route: RouteOption; fare: number }[] = [
              { key: 'fastest',  icon: '⚡', label: 'Fastest',  route: routeOptions!.fastest,   fare: routeFares.fastest },
              { key: 'shortest', icon: '🛣️', label: 'Shortest', route: routeOptions!.shortest!, fare: routeFares.shortest },
            ];
            return (
              <View style={{ flexDirection: 'row', gap: 9 }}>
                {opts.map(o => {
                  const active = selectedRoute === o.key;
                  return (
                    <TouchableOpacity
                      key={o.key}
                      activeOpacity={0.85}
                      onPress={() => setSelectedRoute(o.key)}
                      style={{
                        flex: 1, borderRadius: R.sm, paddingVertical: 10, paddingHorizontal: 12,
                        borderWidth: active ? 0 : 1.5,
                        borderColor: C.glassBorder,
                        backgroundColor: active ? C.plum : C.bgCard,
                        elevation: active ? 8 : 1,
                        shadowColor: C.plum, shadowOpacity: active ? 0.35 : 0.05, shadowRadius: active ? 12 : 3,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12.5, fontWeight: '900', color: active ? '#fff' : C.text }}>
                          {o.icon} {o.label}
                        </Text>
                        {o.key === 'shortest' && saving > 0 && (
                          <View style={{ backgroundColor: active ? 'rgba(255,255,255,0.22)' : C.green, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff' }}>SAVE ₹{saving}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 10.5, color: active ? 'rgba(255,255,255,0.6)' : C.textMuted, marginTop: 3, fontWeight: '600' }}>
                        {o.route.etaText} · {o.route.distText}
                      </Text>
                      <Text style={{ fontSize: 15.5, fontWeight: '900', color: active ? '#fff' : C.text, marginTop: 2, letterSpacing: -0.3 }}>
                        ₹{o.fare}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })()}

          {/* Compact info strip — vehicle / ETA / cash. Departure time (now vs
               scheduled) is now shown/edited in the route+vehicle card above,
               Maps' "Leave at ▾" style — no longer duplicated down here. */}
          {hasFare && !loading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.glassMid, borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 5 }}>
                <RideVehicleIcon id={rideType} size={12} color={C.plum} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>{selRide?.label}</Text>
                {etaLoaded && driverEta[rideType] && (
                  <Text style={{ fontSize: 11, color: C.green, fontWeight: '700' }}>
                    · ~{driverEta[rideType].eta_min <= 1 ? '< 1' : driverEta[rideType].eta_min} min
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.glassMid, borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Ionicons name="cash-outline" size={12} color={C.textMuted} />
                <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '600' }}>Cash</Text>
              </View>
              {discount > 0 && (
                <View style={{ backgroundColor: C.greenGlass, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: C.greenBorder }}>
                  <Text style={{ fontSize: 10, color: C.green, fontWeight: '900' }}>₹{discount} off</Text>
                </View>
              )}
              {scheduledAt && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', borderRadius: R.full, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: '#FDE68A' }}>
                  <Ionicons name="calendar-outline" size={11} color="#F59E0B" />
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#92400E' }}>Scheduled</Text>
                </View>
              )}
            </View>
          )}

          {/* Fare + compact pink CTA pill — Maps' "Start" button treatment
               (small pill action button beside the info, not a full-width
               hero bar), just labeled "Book"/"Schedule" and pink. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1 }}>
              {loading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color={C.textMuted} />
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: C.textMuted }}>
                    {scheduledAt ? 'Scheduling…' : 'Finding driver…'}
                  </Text>
                </View>
              ) : hasFare ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7 }}>
                    <Text style={{ fontSize: 26, fontWeight: '900', color: C.text, letterSpacing: -0.6 }}>₹{finalFare}</Text>
                    {discount > 0 && (
                      <Text style={{ fontSize: 12, color: C.textDim, textDecorationLine: 'line-through' }}>₹{rawFare}</Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2, fontWeight: '600' }} numberOfLines={1}>
                    {selRide?.label} · {scheduledAt ? 'scheduled' : 'instant booking'}
                  </Text>
                </>
              ) : (
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: C.textMuted }}>Select pickup & drop</Text>
              )}
            </View>

            <Animated.View style={{ transform: [{ scale: bookBtnScale }] }}>
              <TouchableOpacity
                activeOpacity={hasFare && !loading ? 0.85 : 1}
                disabled={!hasFare || loading}
                onPress={scheduledAt ? handleScheduleRide : handleBook}
                onPressIn={hasFare && !loading ? onBookPressIn : undefined}
                onPressOut={hasFare && !loading ? onBookPressOut : undefined}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: hasFare && !loading ? BRAND_PINK : C.glassMid,
                  borderRadius: R.full,
                  paddingHorizontal: 22, paddingVertical: 13,
                  elevation: hasFare && !loading ? 10 : 0,
                  shadowColor: BRAND_PINK, shadowOpacity: hasFare && !loading ? 0.4 : 0, shadowRadius: 14, shadowOffset: { width: 0, height: 5 },
                }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: hasFare && !loading ? '#fff' : C.textDim }}>
                  {scheduledAt ? 'Schedule' : 'Book'}
                </Text>
                <Ionicons name="arrow-forward" size={16} color={hasFare && !loading ? '#fff' : C.textDim} />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      )}

      {/* ─── Schedule Picker Sheet ─── */}
      <SchedulePickerSheet
        visible={showSchedulePicker}
        onClose={() => setShowSchedulePicker(false)}
        onConfirm={(result) => { setScheduledAt(result); setShowSchedulePicker(false); }}
      />

      {/* ─── Pickup map picker modal ─── */}
      <PickupMapPicker
        visible={!!pickerCoords}
        initialCoords={pickerCoords || { lat: 26.8467, lng: 80.9462 }}
        onConfirm={handlePickerConfirm}
        onClose={handlePickerClose}
      />

      {/* ─── Drop map picker modal ─── */}
      <PickupMapPicker
        visible={dropPickerOpen}
        mode="drop"
        initialCoords={
          dropCoords ??
          pickupCoords ??
          (userCoords?.latitude ? { lat: userCoords.latitude, lng: userCoords.longitude } : null) ??
          (userCoords?.lat ? { lat: userCoords.lat, lng: userCoords.lng } : null) ??
          { lat: 26.8467, lng: 80.9462 }
        }
        originCoords={pickupCoords}
        onConfirm={handleDropPickerConfirm}
        onClose={() => setDropPickerOpen(false)}
      />

    </KeyboardAvoidingView>
  );
}
