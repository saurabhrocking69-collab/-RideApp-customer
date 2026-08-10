import { createContext, useContext, useState, useRef, useEffect } from 'react';
import { AppState, Alert, Linking, Platform, Share } from 'react-native';
import { Animated } from 'react-native';
import { Storage as AsyncStorage } from '../storage';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import { io, Socket } from 'socket.io-client';
import { apiGet, apiPost, apiAuthPost, apiAuthGet, authGet, authPost, externalGet } from '../../api';
import { saveNotification } from '../components/NotificationCenter';
import { C } from '../styles';
import type { ToastNotif } from '../components/NotificationToast';
import type { NearbyCategory } from '../nearbyCategories';
import { useRideStore } from '../../store';
import { API, MAPS_KEY, RIDES, DEFAULT_HOURLY_PACKAGES, WELCOME_SEEN_KEY } from '../constants';
import { Screen, Tab, Coords, HourlyStep, ExtendStep, WalletTxnTab } from '../types';
import { shortRideId } from '../rideId';

let RazorpayCheckout: any = null;
try { const _m = require('react-native-razorpay'); RazorpayCheckout = _m?.default || _m || null; } catch (_e) {}

function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const padded = payload + '==='.slice((payload.length + 3) % 4);
    const json = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp : null;
  } catch { return null; }
}

function _haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function _fmtDist(km: number): string {
  if (km < 0.05) return 'Yahaan hai';
  if (km < 1) return `${Math.round(km * 1000 / 50) * 50} m`;
  return `${km.toFixed(1)} km`;
}
function _fmtEta(km: number): string {
  const min = Math.round((km / 18) * 60); // 18 km/h city average
  if (min <= 0) return 'Abhi aa raha hai';
  if (min === 1) return '1 min';
  return `${min} min`;
}

// ─── Context Type ───────────────────────────────────────────────────────────
interface AppContextType {
  // Navigation
  screen: Screen; setScreen: (s: Screen) => void;
  tab: Tab; setTab: (t: Tab) => void;
  scheduleIntent: boolean; setScheduleIntent: (v: boolean) => void;
  intercityRoute: { km: number; durationMin: number } | null;
  setIntercityRoute: (v: { km: number; durationMin: number } | null) => void;
  bookIntercity: (p: { vehicleType: 'car' | 'luxury'; tripKind: 'oneway' | 'round'; fare?: number; scheduledAt?: string | null; returnAt?: string | null }) => Promise<any>;
  bookParcel: (p: { vehicleType: string; packageSize: 'small' | 'medium' | 'large'; distanceKm: number; fare: number; packageNote?: string; dropBuilding?: string; dropFloor?: string; dropLandmark?: string; dropNote?: string }) => Promise<any>;
  parcelEstimate: (distanceKm: number, packageSize: 'small' | 'medium' | 'large') => Promise<any>;
  reportParcelNotDelivered: (rideId: string | number, reason: string) => Promise<any>;
  returnDecision: (rideId: string | number, decision: 'retry' | 'return') => Promise<any>;
  payReturnFare: (rideId: string | number, paymentMethod: 'wallet' | 'online', payment?: any) => Promise<any>;
  greenSummary: any;
  loadGreenSummary: (ph: string) => Promise<void>;
  // Auth
  phone: string; setPhone: (p: string) => void;
  otp: string; setOtp: (o: string) => void;
  otpSent: string; setOtpSent: (o: string) => void;
  otpDigits: string[]; setOtpDigits: (d: string[]) => void;
  resendTimer: number; setResendTimer: React.Dispatch<React.SetStateAction<number>>;
  canResend: boolean; setCanResend: (v: boolean) => void;
  otpRefs: React.MutableRefObject<any[]>;
  otpShakeAnim: Animated.Value;
  otpSuccessAnim: Animated.Value;
  userName: string; setUserName: (n: string) => void;
  // Dispatch, not a plain setter: it IS a useState setter, and the narrow
  // signature rejected the updater form callers legitimately use.
  gender: string; setGender: React.Dispatch<React.SetStateAction<'male'|'female'|'other'|''>>;
  // Splash anims
  splashLogo: Animated.Value; splashScale: Animated.Value;
  splashTag: Animated.Value; splashFade: Animated.Value;
  splashDone: boolean;
  // Login anims
  onboardFade: Animated.Value; onboardSlide: Animated.Value;
  loginHeroAnim: Animated.Value; loginCardAnim: Animated.Value;
  // Booking
  pickup: string; setPickup: (p: string) => void;
  drop: string; setDrop: (d: string) => void;
  pickupCoords: Coords; setPickupCoords: (c: Coords) => void;
  dropCoords: Coords; setDropCoords: (c: Coords) => void;
  resetBookingState: () => void;
  rideType: string; setRideType: (t: string) => void;
  pickupSugg: any[]; setPickupSugg: (s: any[]) => void;
  dropSugg: any[]; setDropSugg: (s: any[]) => void;
  dropHistory: { text: string; coords: { lat: number; lng: number } | null }[];
  appConfig: any;
  fareEstimates: any; setFareEstimates: (e: any) => void;
  fareLoading: boolean;
  eta: string; setEta: (e: string) => void;
  userCoords: any; setUserCoords: (c: any) => void;
  showPromoInput: boolean; setShowPromoInput: (v: boolean) => void;
  instantApplied: boolean; setInstantApplied: (v: boolean) => void;
  lastFetchKey: React.MutableRefObject<string>;
  // Promo
  promoCode: string; setPromoCode: (c: string) => void;
  promoDiscount: number; setPromoDiscount: (d: number) => void;
  promoScreenCode: string; setPromoScreenCode: (c: string) => void;
  promoScreenMsg: string; setPromoScreenMsg: (m: string) => void;
  availablePromos: any[]; setAvailablePromos: (p: any[]) => void;
  // Who's riding
  rideForSelf: boolean; setRideForSelf: (v: boolean) => void;
  riderName: string; setRiderName: (n: string) => void;
  riderPhone: string; setRiderPhone: (p: string) => void;
  // Active ride
  rideData: any; setRideData: (d: any) => void;
  altSuggest: any; setAltSuggest: (s: any) => void;
  switchingVehicle: boolean; setSwitchingVehicle: (v: boolean) => void;
  driverLoc: any; setDriverLoc: (l: any) => void;
  driverEta: string; setDriverEta: (e: string) => void;
  driverDist: string; setDriverDist: (d: string) => void;
  showCancelModal: boolean; setShowCancelModal: (v: boolean) => void;
  cancelTimer: number; setCancelTimer: (t: number) => void;
  freeCancelsLeft: number; setFreeCancelsLeft: (n: number) => void;
  cancelInfo: any; setCancelInfo: (v: any) => void;
  bookTime: number; setBookTime: (t: number) => void;
  searchElapsed: number; setSearchElapsed: (n: number) => void;
  surgeCount: number; setSurgeCount: (n: number) => void;
  surgeFare: string; setSurgeFare: (f: string) => void;
  surging: boolean; setSurging: (v: boolean) => void;
  surgeBarAnim: Animated.Value;
  surgeBarAnimRef: React.MutableRefObject<Animated.CompositeAnimation | null>;
  serverSurgeOffer: { amt: number; label: string; timeout_sec: number } | null;
  setServerSurgeOffer: (v: { amt: number; label: string; timeout_sec: number } | null) => void;
  noDriverFinal: { alternatives: string[]; retry_after_sec: number } | null;
  setNoDriverFinal: (v: { alternatives: string[]; retry_after_sec: number } | null) => void;
  driverCancelPopup: boolean; setDriverCancelPopup: (v: boolean) => void;
  // Notification toast (foreground in-app)
  notifToast: ToastNotif | null; setNotifToast: (n: ToastNotif | null) => void;
  // Chat
  chatMsgs: any[]; setChatMsgs: (m: any[]) => void;
  chatInput: string; setChatInput: (i: string) => void;
  unreadChat: number; setUnreadChat: React.Dispatch<React.SetStateAction<number>>;
  lastChatCount: React.MutableRefObject<number>;
  chatToast: string | null; setChatToast: (v: string | null) => void;
  chatOrigin: Screen; setChatOrigin: (s: Screen) => void;
  // Post ride
  rating: number; setRating: (r: number) => void;
  tip: number; setTip: (t: number) => void;
  review: string; setReview: (r: string) => void;
  paymentDone: boolean; setPaymentDone: (v: boolean) => void;
  showRatingModal: boolean; setShowRatingModal: (v: boolean) => void;
  showUpiQr: boolean; setShowUpiQr: (v: boolean) => void;
  fareCount: number; setFareCount: (n: number) => void;
  scratchCard: any; setScratchCard: (c: any) => void;
  scratched: boolean; setScratched: (v: boolean) => void;
  scratchAnim: Animated.Value;
  starAnims: Animated.Value[];
  sosActive: boolean; setSosActive: (v: boolean) => void;
  // Wallet
  walletBalance: number; setWalletBalance: (b: number) => void;
  walletTxns: any[]; setWalletTxns: (t: any[]) => void;
  walletStats: any; setWalletStats: (s: any) => void;
  walletTxnTab: WalletTxnTab; setWalletTxnTab: (t: WalletTxnTab) => void;
  walletAddInput: string; setWalletAddInput: (v: string) => void;
  loyaltyPoints: number; setLoyaltyPoints: (n: number) => void;
  loyaltyCashback: number; setLoyaltyCashback: (n: number) => void;
  rewardsDash: any; setRewardsDash: (d: any) => void;
  cashbackEarned: any[]; setCashbackEarned: (c: any[]) => void;
  loadRewardsDash: (ph: string) => Promise<void>;
  // History
  historyRides: any[]; setHistoryRides: (r: any[]) => void;
  // Offers + Referral
  activeOffers: any[]; setActiveOffers: (o: any[]) => void;
  offerDismissed: Set<number>; setOfferDismissed: React.Dispatch<React.SetStateAction<Set<number>>>;
  savedPlaces: any[]; setSavedPlaces: (p: any[]) => void;
  customerRating: any; setCustomerRating: (r: any) => void;
  // Buddy
  favouriteBuddy: any; setFavouriteBuddy: (b: any) => void;
  showBuddyBook: boolean; setShowBuddyBook: (v: boolean) => void;
  buddyBookPU: string; setBuddyBookPU: (s: string) => void;
  buddyBookDR: string; setBuddyBookDR: (s: string) => void;
  buddyBookPUCoords: any; setBuddyBookPUCoords: (c: any) => void;
  buddyBookDRCoords: any; setBuddyBookDRCoords: (c: any) => void;
  buddyBookLoading: boolean; setBuddyBookLoading: (v: boolean) => void;
  buddyBookMsg: string; setBuddyBookMsg: (m: string) => void;
  buddyWaiting: boolean; setBuddyWaiting: (v: boolean) => void;
  buddyWaitingRef: React.MutableRefObject<boolean>;
  buddyPUSugg: any[]; setBuddyPUSugg: (s: any[]) => void;
  buddyDRSugg: any[]; setBuddyDRSugg: (s: any[]) => void;
  // Hourly
  hourlyStep: HourlyStep; setHourlyStep: (s: HourlyStep) => void;
  hourlyBooking: any; setHourlyBooking: React.Dispatch<React.SetStateAction<any>>;
  activeHourlyIdRef: React.MutableRefObject<string|number|null>;
  activeRideIdRef: React.MutableRefObject<string|number|null>;
  hPackageHours: number; setHPackageHours: (h: number) => void;
  hVehicle: string; setHVehicle: (v: string) => void;
  hPickup: string; setHPickup: (s: string) => void;
  hPickupCoords: any; setHPickupCoords: (c: any) => void;
  hDrop: string; setHDrop: (s: string) => void;
  hDropCoords: any; setHDropCoords: (c: any) => void;
  hRoundTrip: boolean; setHRoundTrip: (v: boolean) => void;
  hStayHours: number; setHStayHours: (h: number) => void;
  hPickupSugg: any[]; setHPickupSugg: (s: any[]) => void;
  hDropSugg: any[]; setHDropSugg: (s: any[]) => void;
  hourlyTimerSec: number; setHourlyTimerSec: (s: number) => void;
  hOtpInput: string; setHOtpInput: (s: string) => void;
  // Declared as the real useState setter, not (v: boolean) => void. The narrow
  // form was a lie — the value behind it is a useState setter, so the updater
  // call HourlyScreen already makes, setHChatOpen(o => !o), works at runtime
  // and only failed to compile.
  hChatOpen: boolean; setHChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  hChatMsgs: any[]; setHChatMsgs: React.Dispatch<React.SetStateAction<any[]>>;
  hChatInput: string; setHChatInput: (s: string) => void;
  hChatUnread: number; setHChatUnread: React.Dispatch<React.SetStateAction<number>>;
  hExtendStep: ExtendStep; setHExtendStep: (s: ExtendStep) => void;
  hExtendStepRef: React.MutableRefObject<ExtendStep>;
  hExtendResult: 'accepted'|'rejected'|null; setHExtendResult: (r: 'accepted'|'rejected'|null) => void;
  hExtendPrevHoursRef: React.MutableRefObject<number>;
  hExtendHours: number; setHExtendHours: (h: number) => void;
  hExtendMin: number; setHExtendMin: (m: number) => void;
  hExtendCost: any; setHExtendCost: (c: any) => void;
  hApproachLimit: any; setHApproachLimit: (l: any) => void;
  hourlyPackages: any; setHourlyPackages: (p: any) => void;
  hourlyTimerRef: React.MutableRefObject<any>;
  // UI
  result: string; setResult: (r: string) => void;
  loading: boolean; setLoading: (v: boolean) => void;
  storeStatus: string;
  // Refs
  socketRef: React.MutableRefObject<Socket | null>;
  phoneRef: React.MutableRefObject<string>;
  pickupDebounceRef: React.MutableRefObject<any>;
  dropDebounceRef: React.MutableRefObject<any>;
  hPickupDebounceRef: React.MutableRefObject<any>;
  hDropDebounceRef: React.MutableRefObject<any>;
  buddyPUDebRef: React.MutableRefObject<any>;
  buddyDRDebRef: React.MutableRefObject<any>;
  // Functions — auth
  sendOtp: () => Promise<void>;
  verifyOtp: (override?: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  handleOtpChange: (text: string, index: number) => void;
  handleOtpKeyPress: (key: string, index: number) => void;
  // Functions — socket
  connectSocket: (phone: string) => void;
  joinRideSocket: (rideId: string | number) => void;
  joinHourlySocket: (bookingId: string | number) => void;
  adoptActiveRide: (rideId: string | number) => Promise<boolean>;
  // Functions — booking
  bookRide: (route?: { distanceKm: number; durationMin: number; polyline: string; routeType: string }) => Promise<void>;
  surgeFareNow: (amount: number) => Promise<void>;
  switchVehicle: (newType: string) => Promise<void>;
  searchPlaces: (text: string, type: 'pickup'|'drop') => void;
  searchNearbyCategory: (cat: NearbyCategory, type: 'pickup'|'drop') => void;
  geocodePlace: (address: string, type: 'pickup'|'drop') => Promise<void>;
  swapLocations: () => void;
  // Resolves true only if a distance actually came back — callers must not
  // treat a failed lookup as a completed one.
  fetchEtaByCoords: (pc: any, dc: any) => Promise<boolean>;
  loadFareEstimates: (km: number) => Promise<void>;
  applyPromo: () => Promise<void>;
  useMyLocation: () => Promise<void>;
  calcDriverEta: (driverLat: number, driverLng: number, pickupLat: number, pickupLng: number) => Promise<void>;
  // Functions — payment
  handlePayment: () => Promise<void>;
  payWithWallet: () => Promise<void>;
  createScratchCard: () => Promise<void>;
  scratchNow: () => Promise<void>;
  addMoney: (amt: number) => Promise<void>;
  openRazorpayTopup: (amt: number) => Promise<void>;
  // Functions — data loaders
  loadHistory: (ph: string) => Promise<void>;
  loadWallet: (ph: string) => Promise<void>;
  loadWalletDetail: (ph: string) => Promise<void>;
  loadLoyalty: (ph: string) => Promise<void>;
  loadOffers: () => Promise<void>;
  loadHourlyPackages: () => Promise<void>;
  loadSaved: () => Promise<void>;
  loadFavouriteBuddy: (ph: string) => Promise<void>;
  addFavouriteBuddy: (driverPhone: string) => Promise<any>;
  removeFavouriteBuddy: () => Promise<void>;
  registerFCM: (userPhone: string) => Promise<void>;
  // Functions — misc
  triggerSOS: () => Promise<void>;
  reportCancelRide: (reason: string) => Promise<void>;
  savePlace: (label: string) => Promise<void>;
  savePlaceAt: (label: string, address: string, lat?: number | null, lng?: number | null) => Promise<void>;
  deletePlace: (id: number) => Promise<void>;
  animateStar: (i: number) => void;
  sendChat: (text?: string) => Promise<void>;
  initiateCall: (rideId: string | null, bookingId?: string | null) => Promise<void>;
  callDriver: () => void;
  rideIcon: (type: string) => string;
}

const AppContext = createContext<AppContextType>(null!);
export const useApp = () => useContext(AppContext);

// ─── Provider ──────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  // ── Navigation ──────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>('splash');
  const [tab, setTab] = useState<Tab>('home');
  // When true, BookingScreen auto-opens the schedule picker on mount (set by
  // entry points like the Profile → Scheduled Rides "Book a Scheduled Ride" CTA).
  const [scheduleIntent, setScheduleIntent] = useState(false);
  // Set when the selected route is >80km — BookingScreen hands off to IntercityScreen
  const [intercityRoute, setIntercityRoute] = useState<{ km: number; durationMin: number } | null>(null);

  // ── Auth ────────────────────────────────────────────────────────────────
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState('');
  const [otpDigits, setOtpDigits] = useState(['','','','','','']);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const otpRefs = useRef<any[]>([]);
  const otpShakeAnim = useRef(new Animated.Value(0)).current;
  const otpSuccessAnim = useRef(new Animated.Value(0)).current;
  const [userName, setUserName] = useState('');
  const [gender, setGender] = useState<'male'|'female'|'other'|''>('');

  // ── Splash anims ────────────────────────────────────────────────────────
  const splashLogo  = useRef(new Animated.Value(0)).current;
  const splashScale = useRef(new Animated.Value(0.4)).current;
  const splashTag   = useRef(new Animated.Value(0)).current;
  const splashFade  = useRef(new Animated.Value(1)).current;
  const [splashDone, setSplashDone] = useState(false);
  const onboardFade   = useRef(new Animated.Value(0)).current;
  const onboardSlide  = useRef(new Animated.Value(60)).current;
  const loginHeroAnim = useRef(new Animated.Value(0)).current;
  const loginCardAnim = useRef(new Animated.Value(80)).current;

  // ── Zustand store ───────────────────────────────────────────────────────
  const ride = useRideStore();
  const [storeStatus, setStoreStatus] = useState('idle');
  const [storeDriverLoc, setStoreDriverLoc] = useState<any>(null);
  useEffect(() => {
    const unsub = useRideStore.subscribe((state) => {
      setStoreStatus(state.rideStatus);
      setStoreDriverLoc(state.driverLoc);
    });
    return unsub;
  }, []);

  // Polling-driven screen transitions — fallback if socket event was missed (e.g. app backgrounded)
  useEffect(() => {
    if (storeStatus === 'matched' || storeStatus === 'arrived') {
      // Driver accepted — fetch fresh ride data to populate driver info in context
      const rideId = activeRideIdRef.current;
      if (rideId) {
        fetch(`${API}/api/rides/status/${rideId}`)
          .then(r => r.json())
          .then(d => {
            if (d.ride?.driver_name || d.ride?.driver_phone) {
              setRideData((p: any) => p ? {
                ...p,
                startOtp: d.ride.start_otp || p?.startOtp,
                deliveryOtp: d.ride.delivery_otp || p?.deliveryOtp,
                returnOtp: d.ride.return_otp || p?.returnOtp,
                returnStatus: d.ride.return_status ?? p?.returnStatus,
                deliveryFailReason: d.ride.delivery_fail_reason ?? p?.deliveryFailReason,
                fare: d.ride.fare || p?.fare,
                distance: d.ride.distance || p?.distance,
                driver: {
                  name: d.ride.driver_name,
                  phone: d.ride.driver_phone,
                  vehicle_no: d.ride.vehicle_no,
                  vehicle_brand: d.ride.vehicle_brand,
                  vehicle_model: d.ride.vehicle_model,
                  rating: d.ride.driver_rating,
                  photo: d.ride.driver_photo,
                  vehicle_photo: d.ride.driver_vehicle_photo || null,
                  verified: d.ride.driver_verified ?? false,
                },
              } : p);
            }
          })
          .catch(() => {});
      }
    }
    if (storeStatus === 'started') {
      setScreen((cur: Screen) => (['matching', 'inride'].includes(cur) ? 'inride' : cur));
    } else if (storeStatus === 'completed' && rideDataRef.current?.ride_id) {
      // Parcel: already paid in full at booking (escrow) — nothing to pay,
      // go straight to the post-ride summary instead of the payment screen.
      const target = rideDataRef.current?.is_parcel ? 'postride' : 'payment';
      setScreen((cur: Screen) => (['payment', 'postride'].includes(cur) ? cur : target));
      AsyncStorage.removeItem('activeStdRideId').catch(() => {});
    }
  }, [storeStatus]);

  // ── Socket + phone ref ──────────────────────────────────────────────────
  const socketRef = useRef<Socket | null>(null);
  const phoneRef  = useRef<string>('');
  useEffect(() => { phoneRef.current = phone; }, [phone]);

  // ── Booking ─────────────────────────────────────────────────────────────
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [pickupCoords, setPickupCoords] = useState<Coords>(null);
  // Landmark the customer actually saw next to their pickup ("near Charbagh
  // Metro Station"). Sent with the booking and frozen onto the ride so the
  // driver reads the same phrase the customer confirmed — the backend can also
  // resolve one itself, but only this carries what was genuinely on screen.
  const [pickupLandmark, setPickupLandmark] = useState<string | null>(null);
  // How precisely the chosen drop is pinned, and a free-text note for the last
  // 100 metres. `precise: true` by default so nothing nags before a drop is
  // even chosen, and so an unknown result never produces a false warning.
  const [dropPrecision, setDropPrecision] = useState<{ precise: boolean; areaName: string | null }>({ precise: true, areaName: null });
  const [dropNote, setDropNote] = useState('');
  const [dropCoords, setDropCoords] = useState<Coords>(null);
  const [rideType, setRideType] = useState('auto');
  const [pickupSugg, setPickupSugg] = useState<any[]>([]);
  const [dropSugg, setDropSugg] = useState<any[]>([]);
  const [dropHistory, setDropHistory] = useState<{ text: string; coords: { lat: number; lng: number } | null }[]>([]);
  const [appConfig, setAppConfig] = useState<any>({});
  const [fareEstimates, setFareEstimates] = useState<any>({});
  const [fareLoading, setFareLoading] = useState(false);
  const [eta, setEta] = useState('');
  const [userCoords, setUserCoords] = useState<any>(null);
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [instantApplied, setInstantApplied] = useState(false);
  const lastFetchKey = useRef('');
  // Bumped to re-run the fare effect after a failed distance lookup, so a
  // transient network blip can't leave the Book button permanently dead.
  const [fareRetry, setFareRetry] = useState(0);
  const fareRetryTimer = useRef<any>(null);
  // Attempts are counted per route, so a new pickup/drop always starts fresh.
  const fareAttempts = useRef(0);
  const fareAttemptKey = useRef('');
  const [fareFailed, setFareFailed] = useState(false);
  // Manual "Try again" from the booking screen: forgets the route so the
  // effect re-runs, and resets the attempt budget.
  const retryFare = () => {
    lastFetchKey.current = '';
    fareAttempts.current = 0; fareAttemptKey.current = '';
    setFareFailed(false);
    setFareRetry(v => v + 1);
  };
  const pickupDebounceRef = useRef<any>(null);
  const dropDebounceRef   = useRef<any>(null);
  const hPickupDebounceRef = useRef<any>(null);
  const hDropDebounceRef   = useRef<any>(null);
  const buddyPUDebRef = useRef<any>(null);
  const buddyDRDebRef = useRef<any>(null);

  // ── Promo ───────────────────────────────────────────────────────────────
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoScreenCode, setPromoScreenCode] = useState('');
  const [promoScreenMsg, setPromoScreenMsg] = useState('');
  const [availablePromos, setAvailablePromos] = useState<any[]>([]);

  // Ride-specific booking state (pickup/drop/coords/fare/promo) lives in this
  // Provider, which never unmounts — so it must be explicitly cleared on ride
  // completion/cancellation, or it silently bleeds into the next booking
  // attempt (stale pins/route on the map, stale fare, stale promo discount).
  // Deliberately does NOT reset rideType (vehicle selection) — that's a sticky
  // user preference across bookings, not stale ride data.
  const resetBookingState = () => {
    setPickup(''); setDrop('');
    setPickupCoords(null); setDropCoords(null);
    setFareEstimates({}); setEta('');
    setPromoCode(''); setPromoDiscount(0); setShowPromoInput(false); setInstantApplied(false);
  };

  // ── Who's riding — defaults to the account holder; "someone else" carries
  // a name + phone through to booking so the driver can identify/reach the
  // actual rider instead of the person who booked. Reset per booking. ──────
  const [rideForSelf, setRideForSelf] = useState(true);
  const [riderName, setRiderName]     = useState('');
  const [riderPhone, setRiderPhone]   = useState('');

  // ── Active ride ─────────────────────────────────────────────────────────
  const [rideData, setRideData] = useState<any>(null);
  const rideDataRef = useRef<any>(null);
  useEffect(() => { rideDataRef.current = rideData; }, [rideData]);
  const screenRef = useRef<Screen>('splash');
  useEffect(() => { screenRef.current = screen; }, [screen]);
  const payingRef = useRef(false);
  const bookingInFlightRef = useRef(false);
  const [altSuggest, setAltSuggest] = useState<any>(null);
  const [switchingVehicle, setSwitchingVehicle] = useState(false);
  const [driverLoc, setDriverLoc] = useState<any>(null);
  const [driverEta, setDriverEta] = useState('');
  const [driverDist, setDriverDist] = useState('');

  // Refs so socket handlers always see the latest coords + status without stale closures
  const pickupCoordsRef = useRef<Coords>(null);
  const dropCoordsRef   = useRef<Coords>(null);
  const storeStatusRef  = useRef('idle');
  useEffect(() => { pickupCoordsRef.current = pickupCoords; }, [pickupCoords]);
  useEffect(() => { dropCoordsRef.current = dropCoords; }, [dropCoords]);
  useEffect(() => { storeStatusRef.current = storeStatus; }, [storeStatus]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTimer, setCancelTimer] = useState(60);
  const [freeCancelsLeft, setFreeCancelsLeft] = useState(3);
  const [cancelInfo, setCancelInfo] = useState<any>(null);
  const [bookTime, setBookTime] = useState(0);
  const [searchElapsed, setSearchElapsed] = useState(0);
  const [surgeCount, setSurgeCount] = useState(0);
  const [surgeFare, setSurgeFare] = useState('');
  const [surging, setSurging] = useState(false);
  const surgeBarAnim    = useRef(new Animated.Value(0)).current;
  const surgeBarAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const [serverSurgeOffer, setServerSurgeOffer] = useState<{ amt: number; label: string; timeout_sec: number } | null>(null);
  const [noDriverFinal, setNoDriverFinal] = useState<{ alternatives: string[]; retry_after_sec: number } | null>(null);
  const [driverCancelPopup, setDriverCancelPopup] = useState(false);

  // ── Notification toast ──────────────────────────────────────────────────
  const [notifToast, setNotifToast] = useState<ToastNotif | null>(null);

  // ── Chat ────────────────────────────────────────────────────────────────
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadChat, setUnreadChat] = useState(0);
  const lastChatCount = useRef(0);
  const [chatToast, setChatToast] = useState<string | null>(null);
  const [chatOrigin, setChatOrigin] = useState<Screen>('matching');
  const chatToastTimer = useRef<any>(null);

  // ── Post ride ───────────────────────────────────────────────────────────
  const [rating, setRating] = useState(0);
  const [tip, setTip] = useState(0);
  const [review, setReview] = useState('');
  const [paymentDone, setPaymentDone] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showUpiQr, setShowUpiQr] = useState(false);
  const [fareCount, setFareCount] = useState(0);
  const [scratchCard, setScratchCard] = useState<any>(null);
  const [scratched, setScratched] = useState(false);
  const scratchAnim = useRef(new Animated.Value(1)).current;
  const starAnims   = useRef([0,1,2,3,4].map(() => new Animated.Value(1))).current;
  const [sosActive, setSosActive] = useState(false);

  // ── Wallet ──────────────────────────────────────────────────────────────
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTxns, setWalletTxns] = useState<any[]>([]);
  const [walletStats, setWalletStats] = useState<any>({});
  const [walletTxnTab, setWalletTxnTab] = useState<WalletTxnTab>('all');
  const [walletAddInput, setWalletAddInput] = useState('');
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyCashback, setLoyaltyCashback] = useState(0);
  const [rewardsDash, setRewardsDash] = useState<any>(null);
  const [cashbackEarned, setCashbackEarned] = useState<any[]>([]);

  // ── History / offers / referral ─────────────────────────────────────────
  const [historyRides, setHistoryRides] = useState<any[]>([]);
  const [activeOffers, setActiveOffers] = useState<any[]>([]);
  const [offerDismissed, setOfferDismissed] = useState<Set<number>>(new Set());
  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const [customerRating, setCustomerRating] = useState<any>(null);

  // ── Buddy ────────────────────────────────────────────────────────────────
  const [favouriteBuddy, setFavouriteBuddy] = useState<any>(null);
  const [showBuddyBook, setShowBuddyBook] = useState(false);
  const [buddyBookPU, setBuddyBookPU] = useState('');
  const [buddyBookDR, setBuddyBookDR] = useState('');
  const [buddyBookPUCoords, setBuddyBookPUCoords] = useState<any>(null);
  const [buddyBookDRCoords, setBuddyBookDRCoords] = useState<any>(null);
  const [buddyBookLoading, setBuddyBookLoading] = useState(false);
  const [buddyBookMsg, setBuddyBookMsg] = useState('');
  const [buddyWaiting, setBuddyWaiting] = useState(false);
  const buddyWaitingRef = useRef(false);
  const [buddyPUSugg, setBuddyPUSugg] = useState<any[]>([]);
  const [buddyDRSugg, setBuddyDRSugg] = useState<any[]>([]);

  // ── Hourly ───────────────────────────────────────────────────────────────
  const [hourlyStep, setHourlyStep] = useState<HourlyStep>('book');
  const [hourlyBooking, setHourlyBooking] = useState<any>(null);
  const activeHourlyIdRef = useRef<string|number|null>(null);
  const activeRideIdRef   = useRef<string|number|null>(null);
  const lastFareKmRef     = useRef<number | null>(null);
  const lastFareDurRef    = useRef<number | null>(null); // estimated trip duration (min) for fare re-fetch on admin update
  const [hPackageHours, setHPackageHours] = useState(4);
  const [hVehicle, setHVehicle] = useState('auto');
  const [hPickup, setHPickup] = useState('');
  const [hPickupCoords, setHPickupCoords] = useState<any>(null);
  const [hDrop, setHDrop] = useState('');
  const [hDropCoords, setHDropCoords] = useState<any>(null);
  const [hRoundTrip, setHRoundTrip] = useState(false);
  const [hStayHours, setHStayHours] = useState(1);
  const [hPickupSugg, setHPickupSugg] = useState<any[]>([]);
  const [hDropSugg, setHDropSugg] = useState<any[]>([]);
  const [hourlyTimerSec, setHourlyTimerSec] = useState(0);
  const [hOtpInput, setHOtpInput] = useState('');
  const hourlyTimerRef = useRef<any>(null);
  const [hChatOpen, setHChatOpen] = useState(false);
  const hChatOpenRef = useRef(false);
  const [hChatMsgs, setHChatMsgs] = useState<any[]>([]);
  const [hChatInput, setHChatInput] = useState('');
  const [hChatUnread, setHChatUnread] = useState(0);
  const [hExtendStep, setHExtendStep] = useState<ExtendStep>('idle');
  const hExtendStepRef = useRef<ExtendStep>('idle');
  const [hExtendResult, setHExtendResult] = useState<'accepted'|'rejected'|null>(null);
  const hExtendPrevHoursRef = useRef<number>(0);
  const [hExtendHours, setHExtendHours] = useState(1);
  const [hExtendMin, setHExtendMin] = useState(0);
  const [hExtendCost, setHExtendCost] = useState<any>(null);
  const [hApproachLimit, setHApproachLimit] = useState<any>(null);
  const [hourlyPackages, setHourlyPackages] = useState<any>(DEFAULT_HOURLY_PACKAGES);

  // ── UI ───────────────────────────────────────────────────────────────────
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════

  // Splash init + auto-login
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(splashLogo, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        Animated.spring(splashScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      ]),
      Animated.timing(splashTag, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    setTimeout(async () => {
      let savedPhone = await AsyncStorage.getItem('userPhone').catch(() => null);
      const savedName  = await AsyncStorage.getItem('userName').catch(() => null);
      const savedDropHist = await AsyncStorage.getItem('dropLocationHistory').catch(() => null);
      if (savedDropHist) { try { setDropHistory(JSON.parse(savedDropHist)); } catch (_) {} }

      // JWT expiry check — expired = force re-login; < 7 days left = silent background refresh
      if (savedPhone) {
        const savedToken = await AsyncStorage.getItem('userToken').catch(() => null);
        if (savedToken) {
          const exp = decodeJwtExp(savedToken);
          const nowSec = Math.floor(Date.now() / 1000);
          if (exp !== null && exp < nowSec) {
            await AsyncStorage.removeItem('userPhone');
            await AsyncStorage.removeItem('userName');
            await AsyncStorage.removeItem('userToken');
            savedPhone = null;
          } else if (exp !== null && exp - nowSec < 7 * 86400) {
            fetch(`${API}/api/auth/refresh`, { method: 'POST', headers: { Authorization: `Bearer ${savedToken}` } })
              .then(r => r.json())
              .then(d => { if (d.token) AsyncStorage.setItem('userToken', d.token).catch(() => {}); })
              .catch(() => {});
          }
        }
      }

      // Set the real screen BEFORE the fade so it renders under the still-opaque splash overlay
      if (savedPhone) {
        setPhone(savedPhone);
        phoneRef.current = savedPhone;
        if (savedName) setUserName(savedName);
        setScreen('home');
      } else {
        // Genuinely new install → introduce Sppero before asking for a phone
        // number. Someone who has seen it (or logged out later) goes straight
        // to login. Read here rather than inside WelcomeScreen so the correct
        // screen is set BEFORE the splash fades — same reason the branch above
        // sets 'home' up front, otherwise login flashes underneath first.
        const seenWelcome = await AsyncStorage.getItem(WELCOME_SEEN_KEY).catch(() => null);
        setScreen(seenWelcome ? 'login' : 'welcome');
      }

      Animated.timing(splashFade, { toValue: 0, duration: 300, useNativeDriver: true }).start(async () => {
        setSplashDone(true);
        if (savedPhone) {
          // Start background tasks without waiting for ride check
          fetchAppConfig();
          loadHistory(savedPhone); loadWallet(savedPhone); loadGreenSummary(savedPhone);
          loadOffers(); loadHourlyPackages();
          connectSocket(savedPhone); registerFCM(savedPhone);

          // Check for active ride in background, redirect only if one is found
          const activeRideId = await AsyncStorage.getItem('activeStdRideId').catch(() => null);
          if (activeRideId) {
            try {
              const r    = await fetch(`${API}/api/rides/status/${activeRideId}`);
              const d    = await r.json();
              const ride = d.ride;
              const st   = ride?.status;

              if (st === 'searching' || st === 'matched' || st === 'arrived' || st === 'started') {
                const driver = ride.driver_name ? {
                  name:          ride.driver_name,
                  vehicle_no:    ride.vehicle_no,
                  vehicle_brand: ride.vehicle_brand,
                  vehicle_model: ride.vehicle_model,
                  phone:         ride.driver_phone_masked,
                  photo:         ride.driver_photo,
                  vehicle_photo: ride.driver_vehicle_photo || null,
                  rating:        ride.driver_rating,
                  upi_id:        ride.driver_upi_id,
                } : null;

                setRideData({
                  ...ride,
                  ride_id:  ride.ride_id ?? ride.id,
                  startOtp: st === 'started' ? '' : (ride.start_otp || ''),
                  deliveryOtp: ride.delivery_otp || '',
                  returnOtp: ride.return_otp || '',
                  returnStatus: ride.return_status || null,
                  deliveryFailReason: ride.delivery_fail_reason || null,
                  driver,
                });

                if (ride.pickup)        setPickup(ride.pickup);
                if (ride.drop_location) setDrop(ride.drop_location);
                if (ride.pickup_lat && ride.pickup_lng)
                  setPickupCoords({ lat: parseFloat(ride.pickup_lat), lng: parseFloat(ride.pickup_lng) });
                if (ride.drop_lat && ride.drop_lng)
                  setDropCoords({ lat: parseFloat(ride.drop_lat), lng: parseFloat(ride.drop_lng) });

                activeRideIdRef.current = activeRideId;
                // Cold-start race: connectSocket() was already kicked off above
                // (line ~633) before this ride ID was known — if that socket's
                // 'connect' event fired first, its join check saw
                // activeRideIdRef.current still null and skipped joining the
                // room, with nothing else ever re-emitting it. If we're already
                // connected by now, join explicitly; if not, connectSocket's own
                // 'connect' handler will see the ref set and join correctly.
                if (socketRef.current?.connected) socketRef.current.emit('joinRide', { rideId: activeRideId });
                setScreen(st === 'started' ? 'inride' : 'matching');
              } else if (st === 'completed' || st === 'payment') {
                // rides.status alone can't distinguish "trip ended, please pay"
                // from "driver already confirmed payment" — both read as
                // 'completed' here. payment_status is the column that actually
                // changes when the driver taps confirm (cash-confirm / online
                // payment-complete), so it's the one that decides which screen
                // is correct. Without this check, reopening the app after the
                // driver already confirmed payment always re-showed the
                // pay-now screen instead of the completed/post-ride screen.
                if (ride.payment_status === 'completed') {
                  setRideData({ ...ride, ride_id: ride.ride_id ?? ride.id });
                  setPaymentDone(true);
                  setScreen('postride');
                  AsyncStorage.removeItem('activeStdRideId').catch(() => {});
                } else {
                  setRideData({ ...ride, ride_id: ride.ride_id ?? ride.id });
                  setScreen('payment');
                }
              } else {
                AsyncStorage.removeItem('activeStdRideId').catch(() => {});
              }
            } catch { /* already on home */ }
          } else {
            // No active standard ride — check for active hourly booking
            try {
              // Authenticated: /hourly/active returns the booking's OTP and the
              // driver's details, so it must not answer to a bare phone number.
              const hd = await authGet(`/api/hourly/active?phone=${savedPhone}`);
              if (hd.booking && ['pending','matched','active'].includes(hd.booking.status)) {
                setHourlyBooking({ ...hd.booking, driver: hd.driver });
                activeHourlyIdRef.current = hd.booking.id;
                // 'matched' and 'pending' are BOOKING statuses, not steps —
                // HourlyStep is 'book' | 'waiting' | 'active' | 'done'. Setting
                // it to either matched nothing in HourlyScreen, so it fell
                // through to the default render: a customer reopening the app
                // with a live hourly booking was shown the form to book a NEW
                // one. It could not self-correct either, because the status
                // poll that would have fixed it only runs while the step is
                // 'waiting'.
                //
                // Mapping matches what the poll and the socket already do: a
                // driver being assigned puts you on the trip screen (that is
                // where the OTP lives), and only an unassigned booking waits.
                const step: HourlyStep = hd.booking.status === 'pending' ? 'waiting' : 'active';
                setHourlyStep(step);
                setScreen('hourly');
              }
            } catch { /* already on home */ }
          }
        }
      });
    }, 3000); // 2s pink + ~0.7s plum flood + 0.3s fade
  }, []);

  // Notifications setup
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Sppero Notifications',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default', vibrationPattern: [0, 250, 250, 250], enableVibrate: true,
        lightColor: C.pink, lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
    });
    // Foreground notification handler — save to center + show in-app toast
    const sub1 = Notifications.addNotificationReceivedListener(n => {
      const content = n.request.content;
      const data    = content.data as any;
      if (data?.type === 'ride_cancelled') {
        setDriverCancelPopup(true);
        setRideData(null);
        resetBookingState();
      }
      // Silently adopt the ride into live tracking (rideData + socket room)
      // so the Live tab reflects a match/arrival even if the user never taps
      // the push — e.g. it arrives while they're already in the app.
      if (['ride_matched', 'driver_arrived', 'trip_started', 'scheduled_matching'].includes(data?.type) && data?.ride_id) {
        adoptActiveRide(data.ride_id).catch(() => {});
      }
      const toast: ToastNotif = {
        id:       n.request.identifier,
        title:    content.title || 'Sppero',
        body:     content.body  || '',
        type:     data?.type,
        ts:       Date.now(),
        imageUrl: data?.image_url || undefined,
      };
      // saveNotification stamps `read: false` itself — passing it here was
      // both redundant and outside the argument's type.
      saveNotification(toast);
      setNotifToast(toast);
    });

    // Notification tap handler — navigate to correct screen
    const handleNotifTap = async (response: any) => {
      const data = response?.notification?.request?.content?.data as any;
      if (!data?.type) return;
      const rideId = data.ride_id;
      if (rideId) await AsyncStorage.setItem('activeStdRideId', String(rideId)).catch(() => {});
      // Ride flow — adopt the ride into live tracking state (rideData +
      // socket room) before navigating, so matching/in-ride screens render
      // real data immediately instead of a stale/empty context.
      if (['ride_matched', 'driver_arrived', 'scheduled_matching'].includes(data.type)) {
        if (rideId) await adoptActiveRide(rideId);
        setScreen('matching');
      }
      else if (data.type === 'trip_started') {
        if (rideId) await adoptActiveRide(rideId);
        setScreen('inride');
      }
      else if (data.type === 'trip_completed') {
        // Parcel: already paid at booking (escrow) — nothing to pay, skip
        // straight to postride instead of the payment screen. Also refresh
        // rideData's net_fare/discount from the server here — previously this
        // handler only fetched the ride to check is_parcel and threw the rest
        // away, so a customer who cold-opened the app via this exact
        // notification tap could land on PaymentScreen showing a stale
        // pre-trip fare estimate instead of the real metered fare (the socket
        // rideUpdate handler already does this merge; this path didn't).
        if (rideId) {
          fetch(`${API}/api/rides/status/${rideId}`).then(r => r.json()).then(d => {
            const ride = d?.ride;
            if (ride) {
              setRideData((p: any) => p ? { ...p, net_fare: ride.net_fare, discount: ride.discount ?? p?.discount ?? 0 } : p);
            }
            setScreen(ride?.is_parcel ? 'postride' : 'payment');
          }).catch(() => setScreen('payment'));
        } else setScreen('payment');
      }
      else if (data.type === 'ride_cancelled')                     { setScreen('home'); setDriverCancelPopup(true); setRideData(null); resetBookingState(); }
      else if (data.type === 'no_driver_found')                    setScreen('home');
      else if (data.type === 'extension_accepted')                 { if (rideId) await adoptActiveRide(rideId); setScreen('matching'); }
      else if (data.type === 'scheduled_confirmed')                setScreen('scheduled-rides');
      // Wallet / payments
      else if (['cashback_earned', 'refund', 'wallet_topup'].includes(data.type)) setScreen('home');
      // Account
      else if (['account_restricted', 'payment_dispute', 'warning', 'suspended'].includes(data.type)) setScreen('home');
      // Support tickets
      else if (['support_reply', 'support_resolved'].includes(data.type)) setScreen('tickets');
    };
    const sub2 = Notifications.addNotificationResponseReceivedListener(handleNotifTap);
    Notifications.getLastNotificationResponseAsync().then(r => { if (r) handleNotifTap(r); });
    return () => { sub1.remove(); sub2.remove(); };
  }, []);

  // AppState — refresh on resume
  useEffect(() => {
    if (!phone) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchAppConfig();
        loadWallet(phone); loadHistory(phone);
        registerFCM(phone);
        if (socketRef.current && !socketRef.current.connected) socketRef.current.connect();
        // Restore hourly booking if state was lost while app was backgrounded
        if (!hourlyBooking) {
          authGet(`/api/hourly/active?phone=${phone}`)
            .then(hd => {
              if (hd.booking && ['pending','matched','active'].includes(hd.booking.status)) {
                setHourlyBooking({ ...hd.booking, driver: hd.driver });
                activeHourlyIdRef.current = hd.booking.id;
                // 'matched' and 'pending' are BOOKING statuses, not steps —
                // HourlyStep is 'book' | 'waiting' | 'active' | 'done'. Setting
                // it to either matched nothing in HourlyScreen, so it fell
                // through to the default render: a customer reopening the app
                // with a live hourly booking was shown the form to book a NEW
                // one. It could not self-correct either, because the status
                // poll that would have fixed it only runs while the step is
                // 'waiting'.
                //
                // Mapping matches what the poll and the socket already do: a
                // driver being assigned puts you on the trip screen (that is
                // where the OTP lives), and only an unassigned booking waits.
                const step: HourlyStep = hd.booking.status === 'pending' ? 'waiting' : 'active';
                setHourlyStep(step);
                if (screen === 'home') setScreen('hourly');
              }
            })
            .catch(() => {});
        }
        // Catch a scheduled ride that got matched/dispatched while the app was
        // fully backgrounded (no notification tap happened, so activeStdRideId
        // was never adopted) — reconcile against the scheduled-rides list.
        if (!rideDataRef.current?.ride_id) {
          fetch(`${API}/api/scheduled/my-rides?phone=${phone}`)
            .then(r => r.json())
            .then(sd => {
              const active = (sd.scheduled_rides || []).find((sr: any) =>
                ['requested', 'matched', 'arrived', 'started'].includes(sr.status)
              );
              if (active) adoptActiveRide(active.id);
            })
            .catch(() => {});
        }
        // Catch a driver "payment confirmed" event missed entirely while the
        // socket was disconnected (backgrounded) — the socket event is the
        // fast path, this resume check is the durable fallback so the pay-now
        // screen doesn't sit stale if the push was also missed.
        AsyncStorage.getItem('activeStdRideId').then(id => {
          if (!id) return;
          reconcilePaymentConfirmed(id).then(ok => { if (ok && screen === 'payment') setScreen('postride'); });
          reconcileReturnStatus(id);
        }).catch(() => {});
        // Re-sync an already-tracked standard ride against the server on every
        // resume, not just at cold start. A socket 'rideUpdate' (matched/
        // arrived) missed entirely while backgrounded — or a stray/stale event
        // received earlier — otherwise leaves rideData.driver/status wrong
        // indefinitely, since nothing else here re-checks a ride that's
        // already being tracked (the scheduled-ride block above only fires
        // when there's NO ride_id at all). adoptActiveRide re-fetches the true
        // status and safely no-ops if the ride's already in a terminal state.
        if (rideDataRef.current?.ride_id && !['completed', 'cancelled'].includes(rideDataRef.current?.status)) {
          adoptActiveRide(rideDataRef.current.ride_id).catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, [phone, hourlyBooking, screen]);

  // App config refresh every 5 minutes
  useEffect(() => {
    if (!phone) return;
    const iv = setInterval(() => fetchAppConfig(), 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [phone]);

  // Live cancel fee polling — every 10s when waiting for driver
  useEffect(() => {
    const rideId = rideData?.ride_id;
    if (!rideId || !['matching', 'inride'].includes(screen)) { setCancelInfo(null); return; }
    const poll = async () => {
      try {
        const d = await apiGet(`/api/rides/cancel-info/${rideId}`);
        if (d.fee !== undefined) setCancelInfo(d);
      } catch (_e) {}
    };
    poll();
    const iv = setInterval(poll, 10000);
    return () => clearInterval(iv);
  }, [rideData?.ride_id, screen]);

  // Payment-confirmed polling fallback — every 8s while sitting on the pay-now
  // screen. The socket event + reconnect reconciliation are the fast paths;
  // this is the last-resort catch-all for the rare case neither fires (e.g.
  // the confirm landed in a room-join race) so the screen never gets stuck.
  useEffect(() => {
    const rideId = rideData?.ride_id;
    if (!rideId || screen !== 'payment') return;
    const poll = async () => {
      const ok = await reconcilePaymentConfirmed(rideId);
      if (ok && screenRef.current === 'payment') setScreen('postride');
    };
    const iv = setInterval(poll, 8000);
    return () => clearInterval(iv);
  }, [rideData?.ride_id, screen]);

  // Resend timer
  useEffect(() => {
    if (screen !== 'otp') return;
    setResendTimer(60); setCanResend(false);
    const iv = setInterval(() => {
      setResendTimer(t => { if (t <= 1) { clearInterval(iv); setCanResend(true); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(iv);
  }, [screen]);

  // Clipboard check on OTP screen
  useEffect(() => {
    if (screen !== 'otp') return;
    const iv = setInterval(async () => {
      try {
        const text = await Clipboard.getStringAsync();
        if (text && /^\d{6}$/.test(text)) {
          const digits = text.split('');
          setOtpDigits(digits); setOtp(text);
          setTimeout(() => verifyOtp(text), 300);
        }
      } catch (_e) {}
    }, 2000);
    return () => clearInterval(iv);
  }, [screen]);

  // Login screen entrance animation
  useEffect(() => {
    if (screen !== 'login') return;
    loginHeroAnim.setValue(0); loginCardAnim.setValue(80);
    Animated.parallel([
      Animated.timing(loginHeroAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(loginCardAnim, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [screen]);

  // Silent background GPS — sets userCoords only (for walk line / nearby drivers), never touches pickup.
  // Accepts any cached position (no maxAge limit) for instant result; falls back to a live low-accuracy fix.
  useEffect(() => {
    if (screen !== 'home' && screen !== 'booking') return;
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      // No maxAge restriction — any cached position is fine for walk-line purposes
      Location.getLastKnownPositionAsync({}).then(last => {
        if (last) { setUserCoords({ latitude: last.coords.latitude, longitude: last.coords.longitude }); return; }
        // No cache at all (fresh install / permissions just granted) — do a quick network fix
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }).then(loc => {
          setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }).catch(() => {});
      }).catch(() => {});
    }).catch(() => {});
  }, [screen]);

  // Reactively recalculate fares when coords change
  useEffect(() => {
    if (!pickupCoords?.lat || !dropCoords?.lat || screen !== 'booking') return;
    const key = `${pickupCoords.lat.toFixed(4)},${pickupCoords.lng.toFixed(4)}-${dropCoords.lat.toFixed(4)},${dropCoords.lng.toFixed(4)}`;
    if (lastFetchKey.current === key) return;
    lastFetchKey.current = key;
    setFareFailed(false);
    fetchEtaByCoords(pickupCoords, dropCoords).then(ok => {
      if (ok) { fareAttempts.current = 0; return; }
      // Only a SUCCESSFUL fetch gets to claim this pair.
      //
      // The key used to be committed before the result was known, while
      // fetchEtaByCoords clears the fare estimates as it starts. So a single
      // failed call left BOTH an empty fare table and the route marked
      // "already fetched" — and because the effect only re-runs when the
      // coordinates change, nothing ever retried. hasFare stayed false and the
      // Book button read "Select pickup & drop" forever, on a screen already
      // showing a drawn route and a distance.
      //
      // The near-me categories are the most exposed path to this: picking a
      // suggestion sets searchedDropRef, which always opens the drop-pin
      // picker, and confirming that pin usually moves the point by a few
      // metres — which rounds to the SAME 4-decimal key (~11m), so the confirm
      // could not force the retry either.
      if (lastFetchKey.current === key) lastFetchKey.current = '';
      // Back off over three tries rather than one. A single retry 1.5s later
      // lands inside the same blip that caused the first failure, so it tended
      // to fail with it and leave the screen just as dead.
      if (fareAttemptKey.current !== key) { fareAttemptKey.current = key; fareAttempts.current = 0; }
      fareAttempts.current += 1;
      if (fareAttempts.current > 3) {
        // Out of automatic tries. Surface it so the customer has a button to
        // press — if the network is genuinely down, retrying forever behind a
        // disabled Book button just looks broken.
        setFareFailed(true);
        return;
      }
      const wait = [1500, 3000, 6000][fareAttempts.current - 1] ?? 6000;
      const t = setTimeout(() => setFareRetry(v => v + 1), wait);
      fareRetryTimer.current = t;
    });
  }, [pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng, screen, fareRetry]);
  useEffect(() => () => { if (fareRetryTimer.current) clearTimeout(fareRetryTimer.current); }, []);

  // Cancel countdown timer
  useEffect(() => {
    if (screen !== 'matching' || !bookTime) return;
    const iv = setInterval(() => {
      const elapsed = Math.floor((Date.now() - bookTime) / 1000);
      const left = Math.max(0, 60 - elapsed);
      setCancelTimer(left);
      if (left === 0) clearInterval(iv);
    }, 1000);
    return () => clearInterval(iv);
  }, [screen, bookTime]);

  // Search progress bar animation
  useEffect(() => {
    if (screen !== 'matching' || !!rideData?.driver || !bookTime) {
      surgeBarAnimRef.current?.stop(); return;
    }
    setSearchElapsed(0); surgeBarAnim.setValue(0); surgeBarAnimRef.current?.stop();
    const anim = Animated.timing(surgeBarAnim, { toValue: 1, duration: 90000, useNativeDriver: false });
    surgeBarAnimRef.current = anim; anim.start();
    const iv = setInterval(() => {
      const secs = Math.floor((Date.now() - bookTime) / 1000);
      setSearchElapsed(Math.min(secs, 90));
      if (secs >= 90) clearInterval(iv);
    }, 1000);
    return () => { clearInterval(iv); surgeBarAnimRef.current?.stop(); };
  }, [screen, bookTime, rideData?.driver]);

  // Scratch card animation
  useEffect(() => {
    if (!scratchCard || scratched) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(scratchAnim, { toValue: 1.06, duration: 600, useNativeDriver: true }),
      Animated.timing(scratchAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [scratchCard, scratched]);

  // Fare counter animation on payment screen
  useEffect(() => {
    if (screen !== 'payment' || !rideData?.fare) return;
    const rawFare = Math.round(parseFloat(String(rideData.fare).replace(/[^0-9.]/g, '')) || 0);
    const disc = Math.round(parseFloat(String(rideData.discount ?? '0')) || 0);
    const target = rideData.net_fare != null ? Math.round(rideData.net_fare) : Math.max(0, rawFare - disc);
    let cur = 0; const step = Math.ceil(target / 30);
    const t = setInterval(() => { cur = Math.min(cur + step, target); setFareCount(cur); if (cur >= target) clearInterval(t); }, 40);
    return () => clearInterval(t);
  }, [screen]);

  // Payment screen: socket 'paymentConfirmed' drives the transition (no polling needed)
  // Socket handler is in connectSocket below — this effect is intentionally empty now

  // Customer rating + promos on profile/promo screen
  useEffect(() => {
    if (screen === 'home' && tab === 'profile' && phone) {
      fetch(`${API}/api/customer/rating?phone=${phone}`).then(r => r.json()).then(d => setCustomerRating(d)).catch(() => {});
    }
    if (screen === 'promo' && availablePromos.length === 0) {
      fetch(`${API}/api/promo/list`).then(r => r.json()).then(d => setAvailablePromos(d.promos || [])).catch(() => {});
    }
  }, [screen, tab, phone]);

  // Background chat badge + toast
  useEffect(() => {
    if (!['matching','inride'].includes(screen) || !rideData?.ride_id) return;
    let busy = false;
    const iv = setInterval(async () => {
      if (busy) return; busy = true;
      try {
        const d = await apiGet(`/api/chat/${rideData.ride_id}`);
        if (!d._error) {
          const msgs = d.messages || [];
          if (msgs.length > lastChatCount.current) {
            setUnreadChat(msgs.length - lastChatCount.current);
            const latest = msgs[msgs.length - 1];
            if (latest?.sender === 'driver') {
              setChatToast(latest.message);
              if (chatToastTimer.current) clearTimeout(chatToastTimer.current);
              chatToastTimer.current = setTimeout(() => setChatToast(null), 4500);
            }
          }
        }
      } catch (_e) {}
      busy = false;
    }, 5000);
    return () => clearInterval(iv);
  }, [screen, rideData?.ride_id]);

  // Chat screen: load history once on open; socket 'chatMessage' handles new messages in real-time
  useEffect(() => {
    if (screen !== 'chat' || !rideData?.ride_id) return;
    fetch(`${API}/api/chat/${rideData.ride_id}`)
      .then(r => r.json())
      .then(d => { setChatMsgs(d.messages || []); lastChatCount.current = (d.messages || []).length; setUnreadChat(0); })
      .catch(() => {});
  }, [screen, rideData?.ride_id]);

  // Keep ref in sync so socket listener can check open state without stale closure
  useEffect(() => { hChatOpenRef.current = hChatOpen; }, [hChatOpen]);

  // Hourly chat: load history once on open + reset unread; socket 'hourlyChatMessage' handles new messages
  useEffect(() => {
    if (screen !== 'hourly' || !hChatOpen || !hourlyBooking?.id) return;
    apiGet(`/api/chat/h_${hourlyBooking.id}`)
      .then((d: any) => { if (!d._error && Array.isArray(d.messages)) { setHChatMsgs(d.messages); setHChatUnread(0); } })
      .catch(() => {});
  }, [screen, hChatOpen, hourlyBooking?.id]);

  // Hourly trip timer
  useEffect(() => {
    if (screen === 'hourly' && hourlyStep === 'active' && hourlyBooking?.status === 'active') {
      if (hourlyTimerRef.current) clearInterval(hourlyTimerRef.current);
      const startMs = hourlyBooking.started_at ? new Date(hourlyBooking.started_at).getTime() : Date.now();
      const tick = () => setHourlyTimerSec(Math.floor((Date.now() - startMs) / 1000));
      tick();
      hourlyTimerRef.current = setInterval(tick, 1000);
      const appSub = AppState.addEventListener('change', s => { if (s === 'active') tick(); });
      return () => { if (hourlyTimerRef.current) clearInterval(hourlyTimerRef.current); appSub.remove(); };
    }
  }, [screen, hourlyStep, hourlyBooking?.status, hourlyBooking?.started_at]);

  // ═══════════════════════════════════════════════════════════════════════
  // FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════

  // ── Socket ──────────────────────────────────────────────────────────────
  const connectSocket = (userPhone: string) => {
    if (socketRef.current) {
      if (socketRef.current.connected) {
        if (activeHourlyIdRef.current) socketRef.current.emit('joinHourly', { bookingId: activeHourlyIdRef.current });
        if (activeRideIdRef.current) socketRef.current.emit('joinRide', { rideId: activeRideIdRef.current });
        return;
      }
      // Already attempting to reconnect — don't spawn a second socket
      if ((socketRef.current as any).active) return;
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    const s = io(API, { transports: ['polling', 'websocket'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 2000, reconnectionDelayMax: 10000, timeout: 10000 });

    s.on('connect', () => {
      if (activeHourlyIdRef.current) s.emit('joinHourly', { bookingId: activeHourlyIdRef.current });
      if (activeRideIdRef.current) s.emit('joinRide', { rideId: activeRideIdRef.current });
      // Catch a "payment confirmed" event that fired while this exact socket
      // was mid-reconnect (app stayed foregrounded the whole time, so the
      // AppState resume reconciliation never ran) — rejoining the room only
      // gets us future events, not ones we already missed during the gap.
      if (activeRideIdRef.current) {
        reconcilePaymentConfirmed(activeRideIdRef.current).then(ok => {
          if (ok && screenRef.current === 'payment') setScreen('postride');
        });
        reconcileReturnStatus(activeRideIdRef.current);
      }
    });

    s.on('hourlyExtensionResult', (data: any) => {
      if (data.accepted) {
        setHExtendResult('accepted');
        setHourlyBooking((p: any) => p ? { ...p, extend_requested_hours: null, package_hours: data.new_hours ?? p.package_hours, km_included: data.new_km ?? p.km_included, base_fare: data.new_fare ?? p.base_fare } : p);
      } else {
        setHExtendResult('rejected');
        setHourlyBooking((p: any) => p ? { ...p, extend_requested_hours: null } : p);
        loadWallet(userPhone);
      }
      hExtendStepRef.current = 'idle'; setHExtendStep('idle');
      setTimeout(() => setHExtendResult(null), 6000);
    });
    s.on('hourlyMatched', (data: any) => {
      if (data.booking_id) {
        authGet(`/api/hourly/status/${data.booking_id}`)
          .then(d => {
            if (d.booking) setHourlyBooking((p: any) => p ? { ...p, ...d.booking, driver: d.driver } : d.booking);
            else setHourlyBooking((p: any) => p ? { ...p, status: 'matched', driver_phone: data.driver_phone } : p);
          })
          .catch(() => setHourlyBooking((p: any) => p ? { ...p, status: 'matched', driver_phone: data.driver_phone } : p));
      } else {
        setHourlyBooking((p: any) => p ? { ...p, status: 'matched', driver_phone: data.driver_phone } : p);
      }
      setHourlyStep('active');
    });
    s.on('hourlyTripStarted', (data: any) => {
      setHourlyBooking((p: any) => p ? { ...p, status: 'active', started_at: data.started_at } : p);
      setHourlyStep('active');
    });
    s.on('hourlyDriverArrived', () => {
      setHourlyBooking((p: any) => p ? { ...p, driver_arrived: true } : p);
      setResult('📍 Your Sppero Buddy has arrived! Share the OTP to start the trip.');
    });
    s.on('hourlyDriverCancelled', () => {
      setHourlyBooking((p: any) => p ? { ...p, status: 'pending', driver_phone: null } : p);
      setHourlyStep('waiting');
    });
    s.on('hourlyTripCompleted', (data: any) => {
      setHourlyBooking((p: any) => p ? { ...p, status: 'completed', driver_earning: data.driver_earning } : p);
      setHourlyStep('done');
    });
    s.on('hourlyChatMessage', (msg: any) => {
      setHChatMsgs((prev: any[]) => [...prev, msg]);
      if (!hChatOpenRef.current) {
        setHChatUnread((prev: number) => prev + 1);
        if (msg.sender === 'driver') {
          setChatToast(msg.message);
          if (chatToastTimer.current) clearTimeout(chatToastTimer.current);
          chatToastTimer.current = setTimeout(() => setChatToast(null), 4500);
        }
      }
    });
    s.on('chatMessage', (msg: any) => {
      setChatMsgs((prev: any[]) => [...prev, msg]);
      setUnreadChat((prev: number) => prev + 1);
    });
    // Driver couldn't complete a parcel delivery (receiver unreachable/
    // refused) — sender needs to decide whether to get the package back.
    s.on('returnDecisionNeeded', (data: any) => {
      if (data.ride_id && rideDataRef.current?.ride_id &&
          String(data.ride_id) !== String(rideDataRef.current.ride_id)) return;
      setRideData((p: any) => p ? { ...p, returnStatus: 'pending_decision', deliveryFailReason: data.reason || null } : p);
    });
    s.on('paymentConfirmed', (data: any) => {
      // Guard: ignore events for old/different ride rooms we haven't left yet
      if (data.ride_id && rideDataRef.current?.ride_id &&
          String(data.ride_id) !== String(rideDataRef.current.ride_id)) return;
      if (data.status === 'completed' && rideDataRef.current?.ride_id) {
        if (data.cashbacks?.length) setCashbackEarned(data.cashbacks);
        setPaymentDone(true);
        setScreen('postride');
        notifyPaymentReceivedInApp(rideDataRef.current?.fare);
        AsyncStorage.removeItem('activeStdRideId').catch(() => {});
        s.emit('leaveRide', { rideId: data.ride_id }); // leave room so old events can't leak again
        // Clear booking-form state now (not just on rating-modal dismiss) — rideData
        // itself is untouched, PostRideScreen's receipt reads from that, not this.
        resetBookingState();
      }
    });
    s.on('rideUpdate', (data: any) => {
      const st = data.status;
      if (st === 'matched' || st === 'arrived') {
        setAltSuggest(null); setServerSurgeOffer(null); setNoDriverFinal(null);
        // On driver arrived, immediately poll cancelInfo so wait countdown shows without waiting 10s
        if (st === 'arrived') {
          const arrivedRideId = activeRideIdRef.current;
          if (arrivedRideId) {
            apiGet(`/api/rides/cancel-info/${arrivedRideId}`)
              .then((d: any) => { if (d.fee !== undefined) setCancelInfo(d); })
              .catch(() => {});
          }
        }
        if (data.driver) {
          setRideData((p: any) => p ? {
            ...p, status: st, startOtp: data.start_otp || p?.startOtp, deliveryOtp: data.delivery_otp || p?.deliveryOtp, driver: data.driver,
            // Route batching (2 parcels, one driver trip) — batched/
            // stops_before_pickup tell MatchingScreen's BatchQueueCard
            // whether the driver is coming straight here or has another
            // pickup first. ?? not ||, since stops_before_pickup can
            // legitimately be 0 (driver's next stop IS this one).
            batched: data.batched ?? p?.batched, stops_before_pickup: data.stops_before_pickup ?? p?.stops_before_pickup,
          } : p);
          useRideStore.setState({ rideStatus: st, startOtp: data.start_otp || '' });
        } else {
          // Driver info not in socket payload — fetch from API immediately
          useRideStore.setState({ rideStatus: st, startOtp: data.start_otp || '' });
          const rideId = activeRideIdRef.current;
          if (rideId) {
            fetch(`${API}/api/rides/status/${rideId}`)
              .then(r => r.json())
              .then(d => {
                if (d.ride?.driver_name || d.ride?.driver_phone) {
                  setRideData((p: any) => p ? {
                    ...p,
                    status: st,
                    startOtp: d.ride.start_otp || p?.startOtp,
                    deliveryOtp: d.ride.delivery_otp || p?.deliveryOtp,
                    returnOtp: d.ride.return_otp || p?.returnOtp,
                    returnStatus: d.ride.return_status ?? p?.returnStatus,
                    deliveryFailReason: d.ride.delivery_fail_reason ?? p?.deliveryFailReason,
                    fare: d.ride.fare || p?.fare,
                    discount: d.ride.discount ?? p?.discount ?? 0,
                    net_fare: d.ride.net_fare ?? p?.net_fare,
                    distance: d.ride.distance || p?.distance,
                    driver: {
                      name: d.ride.driver_name,
                      phone: d.ride.driver_phone,
                      vehicle_no: d.ride.vehicle_no,
                      vehicle_brand: d.ride.vehicle_brand,
                      vehicle_model: d.ride.vehicle_model,
                      rating: d.ride.driver_rating,
                      photo: d.ride.driver_photo,
                      vehicle_photo: d.ride.driver_vehicle_photo || null,
                      verified: d.ride.driver_verified ?? false,
                      upi_id: d.ride.driver_upi_id || null,
                    },
                  } : p);
                }
              })
              .catch(() => {});
          }
        }
      }
      if (st === 'searching') {
        setRideData((p: any) => p ? { ...p, status: 'requested', ...(data.new_fare ? { fare: data.new_fare } : {}), ...(data.new_vehicle_type ? { vehicle_type: data.new_vehicle_type } : {}) } : p);
        useRideStore.setState({ rideStatus: 'requested' });
      }
      if (st === 'pre_assigned') {
        // A busy-but-nearby driver has been offered this ride — customer waits while they finish current trip.
        // pre_accepted: true means the driver explicitly confirmed; otherwise the offer is still pending.
        setRideData((p: any) => ({
          ...(p || {}),
          ...(data.driver ? { driver: data.driver } : {}),
          pre_assigned_eta_min: data.eta_min ?? null,
          pre_accepted: data.pre_accepted ?? (p?.pre_accepted ?? false),
          status: 'pre_assigned',
        }));
        useRideStore.setState({ rideStatus: 'pre_assigned' });
        setAltSuggest(null); setServerSurgeOffer(null); setNoDriverFinal(null);
        setScreen('matching');
      }
      if (st === 'started') { setScreen('inride'); useRideStore.setState({ rideStatus: 'started', startOtp: '' }); }
      if (st === 'completed' && rideDataRef.current?.ride_id) {
        if (data.rideId && String(data.rideId) !== String(activeRideIdRef.current)) return;
        AsyncStorage.removeItem('activeStdRideId').catch(() => {});
        useRideStore.setState({ rideStatus: 'completed' });
        // Update rideData with net fare from server (already discount-applied)
        if (data.fare != null) {
          setRideData((p: any) => p ? { ...p, status: 'completed', net_fare: data.fare, discount: data.discount ?? p?.discount ?? 0, returnStatus: data.return_status ?? p?.returnStatus } : p);
        }
        // Parcel: already paid at booking (escrow) — nothing to pay, skip
        // straight to postride instead of the payment screen.
        const completedTarget = rideDataRef.current?.is_parcel ? 'postride' : 'payment';
        setScreen((cur: Screen) => (cur === 'payment' || cur === 'postride') ? cur : completedTarget);
        loadWallet(phoneRef.current || userPhone);
        resetBookingState();
      }
      if (st === 'buddy_declined') { buddyWaitingRef.current = false; setBuddyWaiting(false); setBuddyBookMsg('⚠️ Buddy did not accept. Searching other drivers...'); }
      if (st === 'cancelled') {
        if (data.rideId && String(data.rideId) !== String(activeRideIdRef.current)) return;
        AsyncStorage.removeItem('activeStdRideId').catch(() => {});
        ride.clearRide();
        setRideData(null); setAltSuggest(null); setDriverLoc(null); setServerSurgeOffer(null); setNoDriverFinal(null);
        resetBookingState();
        buddyWaitingRef.current = false; setBuddyWaiting(false); setBuddyBookMsg('');
        s.emit('leaveRide', { rideId: data.rideId });
        setScreen('home'); setResult('❌ Ride cancelled');
      }
      if (st === 'surge_offer') {
        // Reset status so surge slider is visible (not hidden behind PreAssignedCard)
        setRideData((p: any) => p ? { ...p, status: 'requested', driver: null } : p);
        setServerSurgeOffer({
          amt: data.suggested_surge_amt || 25,
          label: data.surge_label || `+₹${data.suggested_surge_amt || 25}`,
          timeout_sec: data.timeout_sec || 20,
        });
        // stays on matching screen — inline surge card handles selection
      }
      if (st === 'no_driver_final') {
        // The search is OVER — it is not paused, and it must not look paused.
        //
        // This used to leave rideData in 'requested' with an auto-retry
        // countdown, which meant the app kept presenting itself as searching
        // after the server had already given up. Two things went wrong because
        // of it: the matching screen carried on animating a search that no
        // longer existed, and Home kept showing "Looking for a driver..." for a
        // ride nobody was looking for. Worse, the stale 'requested' ride was
        // still the active ride, so starting a fresh search — an intercity one,
        // say — landed back on the same dead screen.
        //
        // So the ride is cleared exactly the way a genuine 'no_driver' clears
        // it. The customer is told plainly that drivers are busy and to try
        // again shortly, which is true, instead of being shown a spinner that
        // will never resolve.
        if (data.rideId && String(data.rideId) !== String(activeRideIdRef.current)) return;
        AsyncStorage.removeItem('activeStdRideId').catch(() => {});
        ride.clearRide();
        setRideData(null);
        setDriverLoc(null);
        setServerSurgeOffer(null);
        setNoDriverFinal({
          alternatives: data.alternatives || [],
          retry_after_sec: 0,          // 0 = no countdown; retry is manual only
        });
        // Alternatives are still worth offering — a different vehicle really
        // may be available — but they are now a suggestion on a finished
        // search rather than a live one.
        setAltSuggest(data.alternatives?.length
          ? { alternatives: data.alternatives, current_type: rideDataRef.current?.vehicle_type || '' }
          : null);
        s.emit('leaveRide', { rideId: data.rideId });
        setScreen(prev => prev === 'surge' ? 'matching' : prev);
      }
      if (st === 'no_driver') {
        if (data.rideId && String(data.rideId) !== String(activeRideIdRef.current)) return;
        AsyncStorage.removeItem('activeStdRideId').catch(() => {});
        ride.clearRide();
        setRideData(null); setAltSuggest(null); setDriverLoc(null); setServerSurgeOffer(null); setNoDriverFinal(null);
        resetBookingState();
        s.emit('leaveRide', { rideId: data.rideId });
        if (buddyWaitingRef.current) {
          buddyWaitingRef.current = false; setBuddyWaiting(false);
          setBuddyBookMsg('⏰ Driver did not respond in 25 seconds — try a new ride');
        } else {
          setBuddyWaiting(false); setBuddyBookMsg(''); setScreen('home');
          setResult('😔 No drivers available right now — try again shortly');
        }
      }
    });
    s.on('driverMoved', (data: any) => {
      if (!data.lat || !data.lng) return;
      setDriverLoc({ lat: data.lat, lng: data.lng });
      // Live distance + ETA — use haversine (no API cost), updates every ~4s
      const status = storeStatusRef.current;
      const dest =
        (status === 'matched' || status === 'arrived') ? pickupCoordsRef.current :
        status === 'started' ? dropCoordsRef.current : null;
      if (dest?.lat && dest?.lng) {
        const km = _haversineKm(data.lat, data.lng, dest.lat, dest.lng);
        setDriverDist(_fmtDist(km));
        setDriverEta(_fmtEta(km));
      }
    });
    s.on('suggestAlternative', (data: any) => {
      if (data.alternatives?.length > 0) setAltSuggest({ alternatives: data.alternatives, current_type: data.current_type });
    });
    s.on('fareSettingsUpdated', () => {
      fetchAppConfig();
      if (lastFareKmRef.current !== null) {
        loadFareEstimates(lastFareKmRef.current, lastFareDurRef.current ?? undefined);
      } else {
        setFareEstimates({});
      }
    });
    socketRef.current = s;
  };

  const joinRideSocket = (rideId: string | number) => {
    activeRideIdRef.current = rideId;
    socketRef.current?.emit('joinRide', { rideId });
  };

  const joinHourlySocket = (bookingId: string | number) => {
    activeHourlyIdRef.current = bookingId;
    socketRef.current?.emit('joinHourly', { bookingId });
  };

  // Pull a ride's current state from the server and wire it into live
  // tracking (rideData + socket room + AsyncStorage) — the same bookkeeping
  // the instant-booking flows do at booking time. Scheduled rides never get
  // this at booking time (there's no driver yet), so this is what lets the
  // app catch up once the backend actually matches/dispatches one — from a
  // push notification (tap or foreground-received) or an app-resume check.
  const adoptActiveRide = async (rideId: string | number) => {
    try {
      const r    = await fetch(`${API}/api/rides/status/${rideId}`);
      const d    = await r.json();
      const ride = d.ride;
      const st   = ride?.status;
      if (!ride || !['requested', 'searching', 'matched', 'arrived', 'started'].includes(st)) return false;

      const driver = ride.driver_name ? {
        name:          ride.driver_name,
        vehicle_no:    ride.vehicle_no,
        vehicle_brand: ride.vehicle_brand,
        vehicle_model: ride.vehicle_model,
        phone:         ride.driver_phone_masked,
        photo:         ride.driver_photo,
        vehicle_photo: ride.driver_vehicle_photo || null,
        rating:        ride.driver_rating,
        upi_id:        ride.driver_upi_id,
      } : null;

      setRideData({
        ...ride,
        ride_id:  ride.ride_id ?? ride.id,
        startOtp: st === 'started' ? '' : (ride.start_otp || ''),
        deliveryOtp: ride.delivery_otp || '',
        returnOtp: ride.return_otp || '',
        returnStatus: ride.return_status || null,
        deliveryFailReason: ride.delivery_fail_reason || null,
        driver,
      });

      if (ride.pickup)        setPickup(ride.pickup);
      if (ride.drop_location) setDrop(ride.drop_location);
      if (ride.pickup_lat && ride.pickup_lng)
        setPickupCoords({ lat: parseFloat(ride.pickup_lat), lng: parseFloat(ride.pickup_lng) });
      if (ride.drop_lat && ride.drop_lng)
        setDropCoords({ lat: parseFloat(ride.drop_lat), lng: parseFloat(ride.drop_lng) });

      await AsyncStorage.setItem('activeStdRideId', String(rideId)).catch(() => {});
      joinRideSocket(rideId);
      return true;
    } catch { return false; }
  };

  // Reconcile a ride the driver has already marked paid (cash-confirm /
  // payment-complete) — the durable fallback for the 'paymentConfirmed'
  // socket event, which only fires if the customer's socket is connected at
  // the exact instant the driver taps confirm. rides.status stays
  // 'completed' for both "please pay" and "already paid", so this checks the
  // separate payment_status column to tell them apart and route correctly.
  // In-app-only notification — no OS push for this event by design, just a
  // toast + notification-center entry using the app's own existing system,
  // for whenever we discover the driver has confirmed payment.
  const notifyPaymentReceivedInApp = (fare?: number) => {
    const toast: ToastNotif = {
      id:   `payment-confirmed-${Date.now()}`,
      title: '✅ Payment Received',
      body:  fare ? `Your ₹${Math.round(fare)} payment has been confirmed by the driver.` : 'Your payment has been confirmed by the driver.',
      type:  'payment_confirmed',
      ts:    Date.now(),
    };
    saveNotification(toast);
    setNotifToast(toast);
  };

  const reconcilePaymentConfirmed = async (rideId: string | number): Promise<boolean> => {
    try {
      const r = await fetch(`${API}/api/rides/status/${rideId}`);
      const d = await r.json();
      const ride = d.ride;
      if (!ride || ride.status !== 'completed' || ride.payment_status !== 'completed') return false;
      setRideData({ ...ride, ride_id: ride.ride_id ?? ride.id });
      setPaymentDone(true);
      notifyPaymentReceivedInApp(ride.fare);
      await AsyncStorage.removeItem('activeStdRideId').catch(() => {});
      return true;
    } catch { return false; }
  };

  // Same class of gap as reconcilePaymentConfirmed above, for the parcel
  // return-decision flow: `returnDecisionNeeded` only had a live socket
  // listener, no reconciliation-on-reconnect — a driver's flag fired while
  // this exact socket was mid-reconnect (app stayed foregrounded, so the
  // AppState resume path never ran either) was silently lost forever, with
  // the driver left waiting on a decision the sender never even saw asked.
  const reconcileReturnStatus = async (rideId: string | number) => {
    try {
      const r = await fetch(`${API}/api/rides/status/${rideId}`);
      const d = await r.json();
      const ride = d.ride;
      if (!ride) return;
      setRideData((p: any) => p ? {
        ...p,
        returnStatus: ride.return_status ?? p?.returnStatus,
        returnOtp: ride.return_otp || p?.returnOtp,
        deliveryFailReason: ride.delivery_fail_reason ?? p?.deliveryFailReason,
      } : p);
    } catch {}
  };

  // ── Auth ─────────────────────────────────────────────────────────────────
  const handleOtpChange = (text: string, index: number) => {
    const newDigits = [...otpDigits];
    newDigits[index] = text.replace(/[^0-9]/g, '').slice(-1);
    setOtpDigits(newDigits); setOtp(newDigits.join(''));
    if (text && index < 5) otpRefs.current[index + 1]?.focus();
    if (newDigits.filter(d => d !== '').length === 6) setTimeout(() => verifyOtp(newDigits.join('')), 300);
  };
  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };
  const shakeOtp = () => {
    Animated.sequence([
      Animated.timing(otpShakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(otpShakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(otpShakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(otpShakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const sendOtp = async () => {
    if (!phone || phone.length < 10) { setResult('❌ Sahi phone number likho'); return; }
    setLoading(true);
    try {
      const data = await apiPost('/api/auth/send-otp', { phone });
      if (data._error || data.error) { setResult('❌ ' + (data.message || data.error || 'Server error')); return; }
      setOtpSent(data.otp || ''); setScreen('otp'); setResult('');
    } catch { setResult('❌ Could not connect to server'); }
    finally { setLoading(false); }
  };

  const verifyOtp = async (otpOverride?: string) => {
    const otpToUse = otpOverride || otp;
    if (!otpToUse) { setResult('❌ Enter OTP'); return; }
    setLoading(true);
    try {
      const data = await apiPost('/api/auth/verify-otp', { phone, otp: otpToUse, name: userName || 'Rider' });
      if (data._error) { setResult('❌ ' + (data.message || 'Could not connect to server')); shakeOtp(); return; }
      if (data.token) {
        await AsyncStorage.setItem('userPhone', phone);
        await AsyncStorage.setItem('userToken', data.token);
        const serverName = data.user?.name || '';
        const onboardingDone = await AsyncStorage.getItem('onboardingCompleted');
        const nameIsDefault = !serverName || serverName === 'User' || serverName === 'Rider';
        const isNew = !onboardingDone && nameIsDefault;
        const langSet = await AsyncStorage.getItem('userLanguage');
        if (isNew) {
          if (!langSet) {
            await AsyncStorage.setItem('_postLangDest', 'onboarding');
            setScreen('language-select'); setResult('');
          } else {
            onboardFade.setValue(0); onboardSlide.setValue(60);
            setScreen('onboarding'); setResult('');
            Animated.parallel([
              Animated.timing(onboardFade, { toValue: 1, duration: 500, useNativeDriver: true }),
              Animated.spring(onboardSlide, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
            ]).start();
          }
        } else {
          setUserName(serverName || 'Rider');
          await AsyncStorage.setItem('userName', serverName || 'Rider');
          fetchAppConfig(); loadHistory(phone); loadWallet(phone);
          registerFCM(phone); loadOffers(); loadHourlyPackages(); connectSocket(phone);
          setResult('');
          if (!langSet) {
            await AsyncStorage.setItem('_postLangDest', 'home');
            setScreen('language-select');
          } else {
            setScreen('home');
          }
        }
      } else {
        setResult('❌ ' + (data.error || 'Incorrect OTP')); shakeOtp();
      }
    } catch { setResult('❌ Could not connect to server'); }
    finally { setLoading(false); }
  };

  const completeOnboarding = async () => {
    if (!userName.trim()) { setResult('❌ Name is required'); return; }
    setLoading(true);
    const finalName = userName.trim();
    try {
      await fetch(`${API}/api/auth/update-name`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, name: finalName, gender }) });
    } catch (_e) {}
    await AsyncStorage.setItem('userName', finalName);
    await AsyncStorage.setItem('onboardingCompleted', 'true');
    if (gender) await AsyncStorage.setItem('userGender', gender);
    setUserName(finalName); setResult('');
    fetchAppConfig();
    setScreen('home'); loadHistory(phone); loadWallet(phone); registerFCM(phone);
    loadOffers(); loadHourlyPackages(); connectSocket(phone);
    setLoading(false);
  };

  const fetchAppConfig = async () => {
    try {
      const r = await fetch(`${API}/api/app/config`);
      const d = await r.json();
      if (d.fares) {
        setAppConfig(d);
        AsyncStorage.setItem('appConfig', JSON.stringify(d)).catch(() => {});
      }
    } catch (_e) {
      try {
        const cached = await AsyncStorage.getItem('appConfig');
        if (cached) setAppConfig(JSON.parse(cached));
      } catch (_e2) {}
    }
  };

  const registerFCM = async (userPhone: string) => {
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') { const { status } = await Notifications.requestPermissionsAsync(); finalStatus = status; }
      if (finalStatus !== 'granted') return;
      let token: string | null = null;
      try {
        // Native device FCM token — direct Firebase Admin path, no Expo relay latency
        const dt = await Notifications.getDevicePushTokenAsync();
        token = dt.data as string;
      } catch (_e) {
        // Fallback: Expo relay (works in Expo Go / emulator)
        try {
          const et = await Notifications.getExpoPushTokenAsync({ projectId: '8f1a5733-b0fe-466b-ab3e-862983570572' });
          token = et.data;
        } catch (_e2) {}
      }
      if (!token) return;
      await apiPost('/api/auth/save-fcm-token', { phone: userPhone, token, role: 'customer' });
    } catch (_e) {}
  };

  // ── Location + ETA ───────────────────────────────────────────────────────
  const useMyLocation = async () => {
    setResult('📍 Getting your location...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setResult('❌ Location permission denied'); return; }

      // Fast path: OS-cached position (instant)
      const last = await Location.getLastKnownPositionAsync({ maxAge: 120000, requiredAccuracy: 200 });
      if (last) {
        const lt = last.coords.latitude; const lg = last.coords.longitude;
        setUserCoords({ latitude: lt, longitude: lg }); setPickupCoords({ lat: lt, lng: lg });
        await geocodePickup(lt, lg);
        return;
      }

      // Fallback: network-assisted fix (~2–5s on Android)
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude; const lng = loc.coords.longitude;
      setUserCoords({ latitude: lat, longitude: lng }); setPickupCoords({ lat, lng });
      await geocodePickup(lat, lng);
    } catch (_e) { setResult('❌ Location error'); }
  };

  const geocodePickup = async (lat: number, lng: number) => {
    // Try Google Geocode API first
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}&language=en`);
      const data = await res.json();
      if (data.results?.[0]) {
        setPickup(data.results[0].formatted_address); setResult('✅ Location found!');
        if (drop) {
          try {
            const etaRes = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${lat},${lng}&destinations=${encodeURIComponent(drop)}&key=${MAPS_KEY}&mode=driving&departure_time=now`);
            const etaData = await etaRes.json();
            const el = etaData.rows?.[0]?.elements?.[0];
            if (el?.status === 'OK') { const km = el.distance.value / 1000; const durMin = (el.duration_in_traffic?.value ?? el.duration?.value ?? 0) / 60; setEta(`🕐 ${el.duration_in_traffic?.text || el.duration.text} · 📍 ${el.distance.text}`); loadFareEstimates(km, durMin); }
          } catch (_e) {}
        }
        return;
      }
    } catch (_e) {}

    // Fallback: expo-location reverse geocode (offline-capable)
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geo[0]) {
        const a = geo[0];
        setPickup([a.streetNumber, a.street, a.district, a.city].filter(Boolean).join(', '));
        setResult('✅ Location found!');
        return;
      }
    } catch (_e) {}

    // Last resort: show coordinates so pickup is never left blank
    setPickup(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    setResult('✅ Location found!');
  };

  const searchPlaces = (text: string, type: 'pickup' | 'drop') => {
    if (text.length < 3) { type === 'pickup' ? setPickupSugg([]) : setDropSugg([]); return; }
    const ref = type === 'pickup' ? pickupDebounceRef : dropDebounceRef;
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(async () => {
      try {
        // Places Autocomplete only returns `distance_meters` per-prediction when
        // an `origin` is supplied. Drop suggestions are measured from the
        // pickup point (what the customer actually cares about once pickup is
        // set); pickup suggestions from the device's current location.
        const originCoords = type === 'drop'
          ? pickupCoords
          : (userCoords
              ? { lat: (userCoords as any).latitude ?? (userCoords as any).lat, lng: (userCoords as any).longitude ?? (userCoords as any).lng }
              : null);
        const originParam = originCoords?.lat != null ? `&origin=${originCoords.lat},${originCoords.lng}` : '';
        const biasCenter = originCoords?.lat != null ? `${originCoords.lat},${originCoords.lng}` : '26.8467,80.9462';
        const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${MAPS_KEY}&components=country:in&location=${biasCenter}&radius=50000${originParam}`);
        const data = await res.json();
        const sugg = data.predictions?.map((p: any) => ({
          id:         p.place_id,
          text:       p.description,
          main:       p.structured_formatting?.main_text      || p.description.split(',')[0],
          secondary:  p.structured_formatting?.secondary_text || p.description.split(',').slice(1).join(',').trim(),
          distance_m: p.distance_meters ?? null,
        })) || [];
        type === 'pickup' ? setPickupSugg(sugg) : setDropSugg(sugg);
      } catch (_e) {}
    }, 400);
  };

  // "Near me" category search (Hospital, Hotel, Police Station, ...) — reuses the
  // same Autocomplete endpoint as searchPlaces (no separate Nearby Search billing),
  // just biased tightly to the actual pickup/user location with strictbounds so
  // results stay genuinely close instead of the loose 50km relevance bias above.
  //
  // Accepts multiple query variants per category because Autocomplete matches
  // literal name text, not a place "type" — e.g. Indian police stations are
  // almost always named "Thana" on Maps, not "Police Station", so a single
  // English query can silently miss the actual nearest match. Variants are
  // queried in parallel and merged, deduped by place_id, sorted by distance.
  // Takes the whole category rather than seven positional args — the previous
  // shape was one unlabelled boolean and three string arrays in a row, which
  // is exactly the signature a new field gets silently dropped from.
  /* Replaces the straight-line distance on each suggestion with the real
     driving distance, and re-sorts on it.

     Autocomplete's `distance_meters` is geodesic — "as the crow flies". For a
     rider choosing between four ATMs that is the wrong number twice over: it
     is not what they will travel, not what the fare is built from, and it does
     not even rank them correctly, because a place 4.3km across a river can be
     8.8km to drive while a 5.2km one is 8.3km. The list said one was nearer
     when it was not.

     One Distance Matrix request covers the whole list — destinations can be
     given as place_id, so no per-item Place Details lookup is needed. On any
     failure the geodesic numbers are simply left in place; a slightly wrong
     badge beats an empty one. */
  const attachRoadDistances = async (list: any[], origin: { lat: number; lng: number }) => {
    const ids = list.filter(p => p.id).slice(0, 25);
    if (!ids.length) return list;
    try {
      const dests = ids.map(p => `place_id:${p.id}`).join('|');
      const d = await externalGet(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}` +
        `&destinations=${encodeURIComponent(dests)}&key=${MAPS_KEY}&mode=driving`
      );
      const els = d?.rows?.[0]?.elements || [];
      const byId = new Map<string, number>();
      ids.forEach((p, i) => {
        const e = els[i];
        if (e?.status === 'OK' && e.distance?.value != null) byId.set(p.id, e.distance.value);
      });
      if (!byId.size) return list;
      return list
        .map(p => (byId.has(p.id) ? { ...p, distance_m: byId.get(p.id), by_road: true } : p))
        // Anything the matrix could not reach sorts last rather than pretending
        // to be nearest on a number measured a different way.
        .sort((a, b) => (a.by_road ? a.distance_m : Infinity) - (b.by_road ? b.distance_m : Infinity));
    } catch { return list; }
  };

  const searchNearbyCategory = (cat: NearbyCategory, type: 'pickup' | 'drop') => {
    const { q: category, wideSearch, acceptTypes, rejectTypes, rejectNamePrefixes, textSearch } = cat;
    const originCoords = type === 'drop'
      ? (pickupCoords || (userCoords
          ? { lat: (userCoords as any).latitude ?? (userCoords as any).lat, lng: (userCoords as any).longitude ?? (userCoords as any).lng }
          : null))
      : (userCoords
          ? { lat: (userCoords as any).latitude ?? (userCoords as any).lat, lng: (userCoords as any).longitude ?? (userCoords as any).lng }
          : null);
    if (!originCoords?.lat) return;

    // Type-defined categories (mall, tourist spot) go through Places TEXT
    // SEARCH instead of autocomplete — see nearbyCategories.ts for why
    // autocomplete and nearbysearch both fail at this. Ranked by prominence,
    // gated on ratings count so small commercial buildings Google happens to
    // type as shopping_mall don't crowd out the mall the rider actually means.
    if (textSearch) {
      (async () => {
        try {
          const d = await externalGet(
            `https://maps.googleapis.com/maps/api/place/textsearch/json` +
            `?query=${encodeURIComponent(textSearch.query)}` +
            `&location=${originCoords.lat},${originCoords.lng}` +
            `&radius=${textSearch.radiusM}&type=${textSearch.type}&key=${MAPS_KEY}`
          );
          const merged = (d?.results || [])
            // Google keeps shut-down places in the index; sending a rider to
            // one is worse than showing them nothing.
            .filter((p: any) => !p.business_status || p.business_status === 'OPERATIONAL')
            .filter((p: any) => (p.user_ratings_total || 0) >= textSearch.minRatings)
            .map((p: any) => {
              // Monuments often have no street address, so Google returns a
              // plus-code ("VW7H+88H, Lucknow, …"). That leading token is
              // noise to a rider — keep the human part of the address.
              const addr = String(p.formatted_address || '').replace(/^[A-Z0-9]{4,}\+[A-Z0-9]{2,},?\s*/i, '');
              return {
              id:         p.place_id,
              text:       [p.name, addr].filter(Boolean).join(', '),
              main:       p.name,
              secondary:  addr,
              distance_m: p.geometry?.location
                ? Math.round(_haversineKm(originCoords.lat, originCoords.lng,
                             p.geometry.location.lat, p.geometry.location.lng) * 1000)
                : null,
              };
            })
            // Text search biases to the location but does not bound it — drop
            // anything past the radius so "near me" stays true.
            .filter((p: any) => p.distance_m == null || p.distance_m <= textSearch.radiusM)
            .sort((a: any, b: any) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity))
            .slice(0, 8);
          // Show it immediately on the geodesic ordering, then upgrade to real
          // driving distances — waiting on a second round-trip to render would
          // make the list feel slow for a number most taps never read.
          type === 'drop' ? setDropSugg(merged) : setPickupSugg(merged);
          const road = await attachRoadDistances(merged, originCoords);
          type === 'drop' ? setDropSugg(road) : setPickupSugg(road);
        } catch (_e) {}
      })();
      return;
    }

    const variants = Array.isArray(category) ? category : [category];
    const fetchAtRadius = async (radiusM: number) => {
      const results = await Promise.all(variants.map(v =>
        fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(v)}&key=${MAPS_KEY}&components=country:in&location=${originCoords.lat},${originCoords.lng}&radius=${radiusM}&strictbounds=true&origin=${originCoords.lat},${originCoords.lng}`)
          .then(r => r.json()).catch(() => ({ predictions: [] }))
      ));
      const seen = new Set<string>();
      return results
        .flatMap(data => data.predictions || [])
        .filter((p: any) => (p.place_id && !seen.has(p.place_id)) ? (seen.add(p.place_id), true) : false)
        .sort((a: any, b: any) => (a.distance_meters ?? Infinity) - (b.distance_meters ?? Infinity));
    };
    (async () => {
      try {
        // Sparse categories (malls, tourist spots) can genuinely have nothing
        // within a tight radius — widen the search step by step instead of
        // showing "no results" when a real match just exists further out.
        const radii = wideSearch ? [6000, 15000, 30000] : [6000];
        let strict: any[] = [];
        let loose: any[] = [];
        for (const radiusM of radii) {
          const raw = await fetchAtRadius(radiusM);
          // Autocomplete matches literal name text, not place type — e.g.
          // "Mall" prefix-matches "Mallpur"/"Mall Avenue" and "Park" prefix-
          // matches "Parking No. 5". Two-tier: strict = genuinely typed as
          // the right category (best quality); loose = just not a confirmed-
          // wrong category (temple/hospital/parking/lodging/route etc — some
          // false positives only carry generic establishment/point_of_interest
          // types with nothing specific to reject either way, so loose keeps
          // those too). Real named malls/parks often don't start with the
          // query word at all, so strict can legitimately stay empty even at
          // 30km — loose is the fallback so the customer sees *something*
          // plausible instead of a dead "no results" screen.
          strict = raw.filter((p: any) => !acceptTypes || (p.types || []).some((t: string) => acceptTypes.includes(t)));
          loose  = raw.filter((p: any) => {
            if (rejectTypes && (p.types || []).some((t: string) => rejectTypes.includes(t))) return false;
            // Backstop for false positives with no specific type to reject by
            // (e.g. "Parking No. 5" is only ever typed as generic
            // establishment/point_of_interest) — match on name instead.
            const name = (p.structured_formatting?.main_text || p.description || '').toLowerCase();
            if (rejectNamePrefixes && rejectNamePrefixes.some(prefix => name.startsWith(prefix.toLowerCase()))) return false;
            return true;
          });
          if (strict.length >= 3) break;
        }
        const best = strict.length > 0 ? strict : loose;
        const merged = best.slice(0, 8).map((p: any) => ({
          id:         p.place_id,
          text:       p.description,
          main:       p.structured_formatting?.main_text      || p.description.split(',')[0],
          secondary:  p.structured_formatting?.secondary_text || p.description.split(',').slice(1).join(',').trim(),
          distance_m: p.distance_meters ?? null,
        }));
        type === 'pickup' ? setPickupSugg(merged) : setDropSugg(merged);
        const road = await attachRoadDistances(merged, originCoords);
        type === 'pickup' ? setPickupSugg(road) : setDropSugg(road);
      } catch (_e) {}
    })();
  };

  // Does this destination need the customer to confirm an exact pin?
  //
  // The first version leaned on geometry.location_type and viewport span. Both
  // were checked against the live API and both are wrong for this job:
  //   - "Aminabad Market" returns ROOFTOP. ROOFTOP means "we have a confident
  //     coordinate for this entity", NOT "this is your doorstep" — the entity
  //     is a market 300m across. Charbagh Railway Station is ROOFTOP too.
  //   - Google clamps the geocoding viewport to a ~0.30km minimum, so a house
  //     and a shopping mall BOTH report span 0.30. It cannot separate them.
  // That is exactly why the picker never appeared for "Aminabad Market".
  //
  // TYPES are the signal that actually separates them:
  //   premise / street_address / subpremise / store  -> a real doorstep
  //   shopping_mall / train_station / university / … -> a big place with gates
  //   political / sublocality / locality            -> an area, centroid only
  const AREA_TYPES = ['locality', 'sublocality', 'sublocality_level_1', 'political',
                      'neighborhood', 'administrative_area_level_1',
                      'administrative_area_level_2', 'postal_code'];
  // Large venues: one confident coordinate, but the customer's actual
  // destination can be a few hundred metres inside or around it.
  const BIG_VENUE_TYPES = ['shopping_mall', 'department_store', 'supermarket',
                           'train_station', 'subway_station', 'transit_station',
                           'light_rail_station', 'bus_station', 'airport',
                           'hospital', 'university', 'stadium', 'park',
                           'tourist_attraction', 'museum', 'amusement_park',
                           'zoo', 'convention_center', 'campground'];
  const gradeDrop = (result: any): { precise: boolean; areaName: string | null } => {
    if (!result) return { precise: true, areaName: null };   // unknown -> don't nag
    const types: string[] = result.types || [];
    const isArea  = types.some(t => AREA_TYPES.includes(t));
    const isVenue = types.some(t => BIG_VENUE_TYPES.includes(t));
    // APPROXIMATE kept as a backstop for anything the type lists miss.
    const lt = result.geometry?.location_type || '';
    const precise = !isArea && !isVenue && lt !== 'APPROXIMATE';
    if (precise) return { precise: true, areaName: null };
    // Name it the way the customer will recognise it: the place itself for a
    // venue, the locality for an area.
    const areaName = isVenue
      ? (String(result.formatted_address || '').split(',')[0] || null)
      : (result.address_components?.find((c: any) => c.types?.some((t: string) => AREA_TYPES.includes(t)))?.long_name
         || String(result.formatted_address || '').split(',')[0] || null);
    return { precise: false, areaName };
  };

  /* Resolves a chosen suggestion to coordinates.
     Prefers the place_id. Geocoding the description text instead was sending
     riders to the wrong place entirely: the Geocoding API resolves ADDRESSES,
     not POI names, so "Bank of Baroda ATM, Kursi Road, near Pahadpur Chauraha,
     Sector H, Jankipuram, Lucknow" collapsed to "Kursi Rd, Uttar Pradesh" —
     the whole road — and returned a point 8.3km from the ATM the customer had
     just tapped. The suggestion row said 1.3km; the booking screen then
     quoted 10.0km, and the fare with it.

     It bites hardest exactly where suggestions matter most: near-me results
     are chain outlets sharing one name (four "Bank of Baroda ATM" here), so
     the text carries no way to tell them apart while the place_id is precise
     by construction. Text remains the fallback for entries that have no id,
     such as items typed by hand or recalled from history. */
  const geocodePlace = async (address: string, type: 'pickup' | 'drop', placeId?: string | null) => {
    try {
      let result: any = null;
      if (placeId) {
        const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry,types,formatted_address,address_components,name&key=${MAPS_KEY}`);
        const d = await r.json();
        if (d?.result?.geometry?.location) result = d.result;
      }
      if (!result) {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`);
        const data = await res.json();
        result = data.results?.[0];
      }
      const loc = result?.geometry?.location;
      if (loc) {
        if (type === 'pickup') setPickupCoords({ lat: loc.lat, lng: loc.lng });
        else {
          setDropCoords({ lat: loc.lat, lng: loc.lng });
          setDropPrecision(gradeDrop(result));
        }
      }
    } catch (_e) {}
  };

  const swapLocations = () => {
    const tempText = pickup; const tempCoords = pickupCoords;
    setPickup(drop); setPickupCoords(dropCoords);
    setDrop(tempText); setDropCoords(tempCoords);
    setFareEstimates({}); setEta(''); lastFetchKey.current = '';
  };

  // Returns whether it actually produced a distance — the caller uses that to
  // decide if this pickup/drop pair may be recorded as fetched. Reporting
  // nothing meant a failure was indistinguishable from a success.
  const fetchEtaByCoords = async (pc: any, dc: any): Promise<boolean> => {
    if (!pc?.lat || !dc?.lat) return false;
    setEta('⏳ Calculate ho raha hai...'); setFareEstimates({});
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${pc.lat},${pc.lng}&destinations=${dc.lat},${dc.lng}&key=${MAPS_KEY}&mode=driving&departure_time=now`, { cache: 'no-store' } as any);
      const data = await res.json();
      const el = data.rows?.[0]?.elements?.[0];
      if (el?.status === 'OK') {
        const km = el.distance.value / 1000;
        const durMin = ((el.duration_in_traffic?.value ?? el.duration?.value ?? 0) / 60);
        setEta(`🕐 ${el.duration_in_traffic?.text || el.duration.text} · 📍 ${el.distance.text}`);
        // AWAITED, and its result decides the outcome.
        //
        // This used to be fire-and-forget, so the function reported success the
        // moment Google answered — even when the fare call that follows it
        // failed. The screen then showed a drawn route, "17 mins · 5.1 km", and
        // a vehicle row that had quietly fallen back to its "₹15+" starting
        // prices, while hasFare stayed false and the Book button sat disabled
        // reading "Select pickup & drop". The retry below never fired, because
        // as far as it could tell nothing had gone wrong.
        return await loadFareEstimates(km, durMin);
      }
      setEta('');
      return false;
    } catch { setEta(''); return false; }
  };

  // Returns whether it actually produced fares. The caller needs to know:
  // an empty fare table is what disables the Book button.
  const loadFareEstimates = async (km: number, durationMin?: number): Promise<boolean> => {
    lastFareKmRef.current = km;
    if (durationMin != null) lastFareDurRef.current = durationMin;
    // Long-distance route (>80km) → this is an intercity trip, not a city ride.
    // Hand off to the IntercityScreen instead of loading city fares.
    if (km > 80) {
      setIntercityRoute({ km, durationMin: durationMin ?? lastFareDurRef.current ?? (km / 20) * 60 });
      setFareLoading(false);
      setScreen((cur: Screen) => (cur === 'booking' || cur === 'intercity' ? 'intercity' : cur));
      // Handed off, not failed — retrying here would fight the screen change.
      return true;
    }
    setIntercityRoute(null);
    setFareLoading(true);
    const est: any = {};
    const durMin = durationMin ?? lastFareDurRef.current ?? (km / 20) * 60;
    // ONE batched call for all vehicle fares (was 7 separate requests → felt
    // slow). Falls back to per-vehicle calls if the batch endpoint is missing.
    try {
      const res = await fetch(`${API}/api/fare-estimate/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ distance: km, duration_min: durMin }),
      });
      const d = await res.json();
      if (d?.fares && !d.error) {
        for (const r of RIDES) if (d.fares[r.id]) est[r.id] = d.fares[r.id];
      }
    } catch (_e) {}
    // Fallback: if the batch returned nothing (old backend), fan out per vehicle.
    if (Object.keys(est).length === 0) {
      await Promise.all(RIDES.map(async (r) => {
        try {
          const res = await fetch(`${API}/api/fare-estimate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
            body: JSON.stringify({ ride_type: r.id, distance: km, duration_min: durMin }),
          });
          const d = await res.json();
          if (!d.error && d.fare != null) est[r.id] = d;
        } catch (_e) {}
      }));
    }
    setFareEstimates(est); setFareLoading(false);
    // Every vehicle missing means the carousel is showing its "₹15+" starting
    // prices and nothing is bookable — that is a failure, not an empty result.
    return Object.keys(est).length > 0;
  };

  const calcDriverEta = async (driverLat: number, driverLng: number, pickupLat: number, pickupLng: number) => {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${driverLat},${driverLng}&destinations=${pickupLat},${pickupLng}&key=${MAPS_KEY}&mode=driving&departure_time=now`);
      const data = await res.json();
      const el = data.rows?.[0]?.elements?.[0];
      if (el?.status === 'OK') { setDriverEta(el.duration_in_traffic?.text || el.duration.text); setDriverDist(el.distance.text); }
    } catch (_e) {}
  };

  // ── Booking ──────────────────────────────────────────────────────────────
  const applyPromo = async () => {
    if (!promoCode) return;
    try {
      const res = await fetch(`${API}/api/promo/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: promoCode, fare: fareEstimates[rideType]?.fare ?? 100, phone }) });
      const data = await res.json();
      if (data.valid) { setPromoDiscount(data.discount); setResult(`✅ ${data.message}`); }
      else { setPromoDiscount(0); setResult('❌ ' + data.message); }
    } catch (_e) { setResult('❌ Error'); }
  };

  // Ride-mutation endpoints (book/cancel/switch-vehicle/etc.) now verify the
  // caller's identity server-side against this token, not just whatever
  // phone is typed into the request body — see middleware/userAuth.js.
  // A rider can end up tokenless (signed in before tokens were stored, or the
  // token expired and was cleared), in which case an empty Bearer goes out.
  // The server doesn't enforce this yet so nothing fires today; the moment the
  // held-back auth enforcement deploys, this is the difference between one
  // clear "sign in again" and every booking failing with a generic error.
  // Rate-limited so a burst of calls can't stack alerts.
  const authAlertAtRef = useRef(0);
  const notifyAuthExpired = () => {
    const now = Date.now();
    if (now - authAlertAtRef.current < 60000) return;
    authAlertAtRef.current = now;
    Alert.alert('Session expired', 'Please sign in again to continue.');
  };
  const authRidePost = async (path: string, body: any) => {
    const token = await AsyncStorage.getItem('userToken').catch(() => null);
    const res = await apiAuthPost(path, body, token || '');
    if (res?._authExpired) notifyAuthExpired();
    return res;
  };
  const authRideGet = async (path: string) => {
    const token = await AsyncStorage.getItem('userToken').catch(() => null);
    const res = await apiAuthGet(path, token || '');
    if (res?._authExpired) notifyAuthExpired();
    return res;
  };

  const bookRide = async (route?: { distanceKm: number; durationMin: number; polyline: string; routeType: string }) => {
    if (!pickup || !drop) { setResult('❌ Enter pickup and drop locations'); return; }
    // Synchronous ref guard, set before ANY await (including the advance
    // collection below) — `loading` state alone doesn't close this window
    // since setLoading(true) previously only ran after collectAdvance
    // resolved, leaving the whole multi-second Razorpay advance sheet open
    // with the Book button still enabled, so a stray second tap could start
    // a second advance collection + a second /api/rides/book for the same trip.
    if (bookingInFlightRef.current) return;
    bookingInFlightRef.current = true;
    setLoading(true);
    try {
      // High-value city ride (>₹3000, rare — surge/long trip): collect the 1/3
      // advance before booking, same as intercity.
      let advance: { order_id: string; payment_id: string; signature: string } | null = null;
      const estFare = (fareEstimates[rideType]?.fare ?? 0) as number;
      if (estFare > ADVANCE_THRESHOLD) {
        advance = await collectAdvance(estFare);
        if (!advance) return; // advance cancelled → abort booking
      }
      await bookRideCore(route, advance);
    } finally {
      bookingInFlightRef.current = false;
    }
  };

  const bookRideCore = async (route: { distanceKm: number; durationMin: number; polyline: string; routeType: string } | undefined, advance: { order_id: string; payment_id: string; signature: string } | null) => {
    setPaymentDone(false);
    try {
      let distanceKm: number, durationMin: number;
      if (route) {
        // Customer chose a specific route (e.g. bike shortest) — price the ride
        // on exactly that route so fare, map, and driver navigation all agree.
        distanceKm = route.distanceKm;
        durationMin = route.durationMin;
      } else {
        const ddata = await externalGet(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(pickup)}&destinations=${encodeURIComponent(drop)}&key=${MAPS_KEY}&mode=driving&departure_time=now`);
        const el = ddata._error ? null : ddata.rows?.[0]?.elements?.[0];
        distanceKm = el?.status === 'OK' ? el.distance.value / 1000 : 5;
        durationMin = el?.status === 'OK' ? (el.duration_in_traffic?.value ?? el.duration?.value ?? 0) / 60 : (distanceKm / 20) * 60;
      }
      // Resolve drop coords inline — can't read state immediately after setDropCoords
      let dropLat = dropCoords?.lat;
      let dropLng = dropCoords?.lng;
      if (!dropLat || !dropLng) {
        try {
          const gr = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(drop)}&key=${MAPS_KEY}`);
          const gd = await gr.json();
          const loc = gd.results?.[0]?.geometry?.location;
          // Straight from `loc` rather than via the two `number | undefined`
          // locals, which is both narrower and clearer about the source.
          if (loc) { dropLat = loc.lat; dropLng = loc.lng; setDropCoords({ lat: loc.lat, lng: loc.lng }); }
        } catch (_e) {}
      }
      const data = await authRidePost('/api/rides/book', {
        passenger_phone: phone || '9999999999', pickup, drop_location: drop, ride_type: rideType, distance: distanceKm,
        duration_min: durationMin,
        pickup_lat: pickupCoords?.lat, pickup_lng: pickupCoords?.lng, drop_lat: dropLat, drop_lng: dropLng,
        discount: promoDiscount, promo_code: promoDiscount > 0 ? promoCode : null,
        route_polyline: route?.polyline ?? null, route_type: route?.routeType ?? null,
        advance,
        rider_name:  !rideForSelf ? riderName.trim()  : null,
        rider_phone: !rideForSelf ? riderPhone.trim() : null,
        // Only the standard booking route accepts this. Intercity and
        // scheduled bookings go to their own endpoints, so they keep whatever
        // landmark the backend resolves for them (currently none).
        pickup_landmark: pickupLandmark || null,
        // The last 100 metres that no coordinate can express — "Gali 3, behind
        // Sharma Medical". Shown to the driver as-is.
        drop_note: dropNote.trim() ? dropNote.trim().slice(0, 140) : null,
      });
      if (data.restricted) {
        // Dedicated global toast (rendered once at the app root, auto-dismisses)
        // instead of the generic `result` string — that's read independently by
        // several screens' own banners, so setting it here made this warning
        // "leak" onto whatever screen the customer navigated to next, not just
        // the booking screen where the block actually happened.
        setNotifToast({ id: 'restricted-' + Date.now(), title: '🚫 Account On Hold', body: data.error || 'Contact support: help@sppero.com', type: 'account_restricted', ts: Date.now() });
        return;
      }
      if (data._error || data.error) { setResult('❌ ' + (data.message || data.error || 'Booking failed')); return; }
      if (!data.ride_id) { setResult('❌ Booking failed — please try again'); return; }
      if (promoDiscount > 0 && data.ride_id) {
        try { await apiPost('/api/promo/apply', { code: promoCode, phone, ride_id: data.ride_id, discount: promoDiscount }); } catch (_e) {}
      }
      setRideData({ ...data, discount: data.discount ?? promoDiscount ?? 0, platform_fee: data.platform_fee ?? 2 }); setScreen('matching'); setResult(''); setAltSuggest(null);
      setRideForSelf(true); setRiderName(''); setRiderPhone(''); // reset for next booking
      AsyncStorage.setItem('activeStdRideId', String(data.ride_id)).catch(() => {});
      // Save fare to route history (for "last time ₹XX" display on BookingScreen)
      try {
        const fareNum = parseFloat(String(data.fare ?? fareEstimates[rideType]?.fare).replace(/[^0-9.]/g, ''));
        if (fareNum > 0 && pickup && drop) {
          const histKey = 'sppero_fare_history';
          const existing = await AsyncStorage.getItem(histKey);
          const hist: any[] = existing ? JSON.parse(existing) : [];
          const entry = { pickup, drop, fare: fareNum, rideType, date: new Date().toISOString() };
          const updated = [entry, ...hist.filter(h => !(h.pickup === pickup && h.drop === drop && h.rideType === rideType))].slice(0, 50);
          AsyncStorage.setItem(histKey, JSON.stringify(updated)).catch(() => {});
        }
      } catch (_e) {}
      // Save drop to local history (last 7, deduped)
      const _dropEntry = { text: drop, coords: dropCoords || null };
      setDropHistory(prev => {
        const updated = [_dropEntry, ...prev.filter(h => h.text !== drop)].slice(0, 7);
        AsyncStorage.setItem('dropLocationHistory', JSON.stringify(updated)).catch(() => {});
        return updated;
      });
      joinRideSocket(data.ride_id);
      ride.setRide(data); ride.startPolling(phone || '9999999999');
      setBookTime(Date.now()); setCancelTimer(60); setSurgeCount(0); setSurgeFare(''); setSearchElapsed(0);
      try { const csd = await apiGet(`/api/customer/cancel-status?phone=${phone || '9999999999'}`); setFreeCancelsLeft(csd.free_cancels_left ?? 3); } catch (_e) {}
    } catch { setResult('❌ Could not connect to server'); }
    finally { setLoading(false); }
  };

  // High-value ride 1/3 advance: create order → Razorpay → return the payment
  // proof to attach to the booking call. Returns null if cancelled/failed.
  const ADVANCE_THRESHOLD = 3000;
  const collectAdvance = async (fare: number): Promise<{ order_id: string; payment_id: string; signature: string } | null> => {
    if (!RazorpayCheckout) { Alert.alert('Payment Error', 'Payment module failed to load. Please restart the app.'); return null; }
    try {
      const d = await apiPost('/api/advance/order', { phone: phone || '9999999999', fare });
      if (!d.success) { Alert.alert('Payment Error', d.error || 'Could not start advance payment'); return null; }
      return await new Promise((resolve) => {
        RazorpayCheckout.open({
          key: d.key_id, amount: d.amount, currency: 'INR', order_id: d.order_id, name: 'Sppero',
          description: `Advance ₹${d.advance} now · ₹${d.remaining} at drop`,
          prefill: { contact: phone }, theme: { color: C.pink },
        })
          .then((payment: any) => resolve({ order_id: payment.razorpay_order_id, payment_id: payment.razorpay_payment_id, signature: payment.razorpay_signature }))
          .catch((e: any) => { const { cancelled, msg } = rzpErr(e); if (!cancelled) Alert.alert('Advance payment failed', msg); resolve(null); });
      });
    } catch { Alert.alert('Error', 'Could not connect to server'); return null; }
  };

  // Parcel delivery fee is paid in FULL upfront, before the ride is created
  // — held in escrow and released to the driver on delivery. Prefers the
  // sender's Sppero wallet balance (instant, no checkout) and falls back to
  // Razorpay — same two "digital" options already used for a normal ride.
  const collectParcelPayment = async (fare: number): Promise<{ method: 'wallet' } | { method: 'online'; order_id: string; payment_id: string; signature: string } | null> => {
    if (walletBalance >= fare) return { method: 'wallet' };
    if (!RazorpayCheckout) { Alert.alert('Payment Error', 'Payment module failed to load. Please restart the app.'); return null; }
    try {
      const d = await authRidePost('/api/parcel/payment-order', { fare });
      if (!d.success) { Alert.alert('Payment Error', d.error || 'Could not start payment'); return null; }
      return await new Promise((resolve) => {
        RazorpayCheckout.open({
          key: d.key_id, amount: d.amount, currency: 'INR', order_id: d.order_id, name: 'Sppero',
          description: `Parcel delivery ₹${fare}`,
          prefill: { contact: phone }, theme: { color: C.pink },
        })
          .then((payment: any) => resolve({ method: 'online', order_id: payment.razorpay_order_id, payment_id: payment.razorpay_payment_id, signature: payment.razorpay_signature }))
          .catch((e: any) => { const { cancelled, msg } = rzpErr(e); if (!cancelled) Alert.alert('Payment failed', msg); resolve(null); });
      });
    } catch { Alert.alert('Error', 'Could not connect to server'); return null; }
  };

  const bookIntercity = async (p: { vehicleType: 'car' | 'luxury'; tripKind: 'oneway' | 'round'; fare?: number; scheduledAt?: string | null; returnAt?: string | null }) => {
    if (!pickup || !drop || !intercityRoute) { Alert.alert('Missing route', 'Please select pickup and drop first'); return null; }
    // Collect the 1/3 advance up front for high-value bookings, before creating the ride.
    let advance: { order_id: string; payment_id: string; signature: string } | null = null;
    if ((p.fare ?? 0) > ADVANCE_THRESHOLD) {
      advance = await collectAdvance(p.fare!);
      if (!advance) return null; // customer cancelled the advance payment → don't book
    }
    setLoading(true); setPaymentDone(false);
    try {
      const data = await apiPost('/api/intercity/book', {
        passenger_phone: phone || '9999999999',
        pickup, drop_location: drop,
        vehicle_type: p.vehicleType,
        trip_kind:    p.tripKind,
        distance:     intercityRoute.km,
        pickup_lat: pickupCoords?.lat, pickup_lng: pickupCoords?.lng,
        drop_lat:   dropCoords?.lat,   drop_lng:   dropCoords?.lng,
        scheduled_at: p.scheduledAt || null,
        return_at:    p.returnAt || null,
        discount: 0, promo_code: null,
        advance,
        rider_name:  !rideForSelf ? riderName.trim()  : null,
        rider_phone: !rideForSelf ? riderPhone.trim() : null,
      });
      if (data.restricted) { Alert.alert('Account on hold', data.error || 'Contact support: help@sppero.com'); return null; }
      if (data._error || data.error) { Alert.alert('Could not book', data.error || data.message || 'Please try again'); return null; }
      if (!data.ride_id) { Alert.alert('Could not book', 'Please try again'); return null; }

      setRideForSelf(true); setRiderName(''); setRiderPhone('');

      if (data.status === 'scheduled') {
        setScreen('scheduled-rides');
        Alert.alert(
          '🛣️ Intercity Trip Scheduled!',
          `Departure ${new Date(p.scheduledAt!).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}. We'll match a driver 15 mins before.`,
          [{ text: 'View Trips', style: 'default' }]
        );
        return data;
      }

      // Leave now → same live-matching flow as a standard ride
      setRideData({ ...data, discount: 0, platform_fee: 0 });
      setScreen('matching'); setResult(''); setAltSuggest(null);
      AsyncStorage.setItem('activeStdRideId', String(data.ride_id)).catch(() => {});
      joinRideSocket(data.ride_id);
      ride.setRide(data); ride.startPolling(phone || '9999999999');
      setBookTime(Date.now()); setCancelTimer(60); setSurgeCount(0); setSurgeFare(''); setSearchElapsed(0);
      return data;
    } catch { Alert.alert('Could not book', 'Network error — please try again'); return null; }
    finally { setLoading(false); }
  };

  const bookParcel = async (p: { vehicleType: string; packageSize: 'small' | 'medium' | 'large'; distanceKm: number; fare: number; packageNote?: string; dropBuilding?: string; dropFloor?: string; dropLandmark?: string; dropNote?: string }) => {
    if (!pickup || !drop) { Alert.alert('Missing addresses', 'Please enter both the pickup and drop-off address'); return null; }
    if (!riderName.trim() || riderPhone.length !== 10) {
      Alert.alert("Receiver's details needed", "Enter the receiver's name and a 10-digit phone number so we can text them the delivery OTP.");
      return null;
    }
    // Full delivery fee is collected upfront (escrow) — before the ride exists.
    const payment = await collectParcelPayment(p.fare);
    if (!payment) return null; // cancelled/failed → don't book
    setLoading(true); setPaymentDone(false);
    try {
      const data = await authRidePost('/api/parcel/book', {
        passenger_phone: phone || '9999999999',
        pickup, drop_location: drop,
        vehicle_type: p.vehicleType,
        package_size: p.packageSize,
        package_note: p.packageNote || null,
        distance: p.distanceKm,
        pickup_lat: pickupCoords?.lat, pickup_lng: pickupCoords?.lng,
        drop_lat:   dropCoords?.lat,   drop_lng:   dropCoords?.lng,
        discount: 0, promo_code: null,
        receiver_name:  riderName.trim(),
        receiver_phone: riderPhone.trim(),
        // Structured delivery address. For a parcel nobody is riding along to
        // redirect the driver at the end, so these are not a nicety — they are
        // the difference between a delivery and a return.
        drop_building: p.dropBuilding || null,
        drop_floor:    p.dropFloor    || null,
        drop_landmark: p.dropLandmark || null,
        drop_note:     p.dropNote     || null,
        payment,
      });
      if (data.restricted) { Alert.alert('Account on hold', data.error || 'Contact support: help@sppero.com'); return null; }
      if (data._error || data.error) { Alert.alert('Could not book', data.error || data.message || 'Please try again'); return null; }
      if (!data.ride_id) { Alert.alert('Could not book', 'Please try again'); return null; }
      if (payment.method === 'wallet') setWalletBalance(b => Math.max(0, b - p.fare));

      setRiderName(''); setRiderPhone('');

      // Same live-matching flow as a standard ride — parcels track through
      // the shared MatchingScreen, not a separate status/screen.
      setRideData({ ...data, discount: 0, platform_fee: 0 });
      setScreen('matching'); setResult(''); setAltSuggest(null);
      AsyncStorage.setItem('activeStdRideId', String(data.ride_id)).catch(() => {});
      joinRideSocket(data.ride_id);
      ride.setRide(data); ride.startPolling(phone || '9999999999');
      setBookTime(Date.now()); setCancelTimer(60); setSurgeCount(0); setSurgeFare(''); setSearchElapsed(0);
      return data;
    } catch { Alert.alert('Could not book', 'Network error — please try again'); return null; }
    finally { setLoading(false); }
  };

  // Fare preview doesn't mutate anything, but still needs the caller's
  // identity verified — same userAuth middleware as /api/parcel/book.
  const parcelEstimate = async (distanceKm: number, packageSize: 'small' | 'medium' | 'large') => {
    return authRidePost('/api/parcel/estimate', { distance: distanceKm, package_size: packageSize });
  };

  // Sender decides what happens after a flagged delivery failure —
  // 'retry' lets the driver try reaching the receiver again, 'return' has
  // the driver bring the package back (partial refund, OTP-verified hand-back).
  const returnDecision = async (rideId: string | number, decision: 'retry' | 'return') => {
    const data = await authRidePost('/api/parcel/return-decision', { ride_id: rideId, decision });
    if (data?.success) {
      // Trust the server's own return_status rather than assuming 'accepted'.
      // With paid returns enabled the server parks this at 'awaiting_payment'
      // and mints NO OTP until the return trip is actually paid for; assuming
      // otherwise would show the sender an OTP that does not exist.
      setRideData((p: any) => p ? {
        ...p,
        returnStatus: decision === 'retry' ? null : (data.return_status || 'accepted'),
        returnFare: data.return_fare ?? p?.returnFare,
        returnOtp: data.return_otp ?? p?.returnOtp,
      } : p);
    }
    return data;
  };

  // Pay for the return trip. Only after this does the driver get sent back and
  // a return OTP get created — the money is held (escrowed) until the handover,
  // exactly like the original parcel fare.
  const payReturnFare = async (rideId: string | number, paymentMethod: 'wallet' | 'online', payment?: any) => {
    const data = await authRidePost('/api/parcel/return-pay', { ride_id: rideId, payment_method: paymentMethod, payment });
    if (data?.success) {
      setRideData((p: any) => p ? {
        ...p,
        returnStatus: 'accepted',
        returnOtp: data.return_otp ?? p?.returnOtp,
        returnFare: data.return_fare ?? p?.returnFare,
      } : p);
      if (phoneRef.current) loadWallet(phoneRef.current);
    }
    return data;
  };

  // Sender reports a completed delivery as never having reached the
  // receiver — opens a review with Sppero's team (money's already been
  // released to the driver by this point, so this doesn't undo anything by
  // itself; an admin decides refund/penalty after review).
  const reportParcelNotDelivered = async (rideId: string | number, reason: string) => {
    return authRidePost('/api/parcel/report-not-delivered', { ride_id: rideId, reason });
  };

  const surgeFareNow = async (amount: number) => {
    if (!rideData?.ride_id || surging) return;
    setSurging(true);
    try {
      const res = await apiPost('/api/rides/surge-fare', { ride_id: rideData.ride_id, customer_phone: phone || '9999999999', surge_amount: amount });
      if (res.success) { setSurgeFare(res.new_fare); setSurgeCount(res.surge_count); setBookTime(Date.now()); setRideData((prev: any) => ({ ...prev, fare: res.new_fare })); }
      else setResult('❌ ' + (res.error || 'Surge failed'));
    } catch (_e) { setResult('❌ Network error'); }
    setSurging(false);
  };

  const switchVehicle = async (newType: string) => {
    if (!rideData?.ride_id || switchingVehicle) return;
    setSwitchingVehicle(true);
    try {
      const res = await authRidePost('/api/rides/switch-vehicle', { ride_id: rideData.ride_id, new_vehicle_type: newType });
      if (res._error || !res.success) { setResult('❌ ' + (res.message || 'Switch failed')); return; }
      setAltSuggest(null);
      setRideData((p: any) => p ? { ...p, ride_type: newType, fare: res.new_fare } : p);
      setResult(`🔄 Searching for ${newType.toUpperCase()} driver...`);
    } catch { setResult('❌ Switch failed, try again'); }
    finally { setSwitchingVehicle(false); }
  };

  // ── Razorpay error → friendly message (never shows raw JSON to user) ─────
  const rzpErr = (e: any): { cancelled: boolean; msg: string } => {
    const code   = String(e?.code   || '').toUpperCase();
    const reason = String(e?.reason || e?.error?.reason || '').toLowerCase();
    const desc   = String(e?.description || e?.error?.description || '').toLowerCase();
    const isCancelled =
      code === 'PAYMENT_CANCELLED' ||
      reason.includes('cancel') ||
      desc.includes('cancel') ||
      (code === 'BAD_REQUEST_ERROR' && reason === 'payment_error' && (!e?.description || e?.description === 'undefined'));
    if (isCancelled)   return { cancelled: true,  msg: 'Payment cancelled' };
    if (code === 'NETWORK_ERROR') return { cancelled: false, msg: 'Slow connection. Try again — you were not charged.' };
    if (code === 'SERVER_ERROR')  return { cancelled: false, msg: 'Payment server unreachable. Try again shortly.' };
    return { cancelled: false, msg: 'Payment failed. Try again — you were not charged.' };
  };

  // ── Payment ──────────────────────────────────────────────────────────────
  const _netFare = () => {
    const rawF = Math.round(parseFloat(String(rideData?.fare ?? '').replace(/[^0-9.]/g, '')) || 0);
    const disc  = Math.round(parseFloat(String(rideData?.discount ?? '0')) || 0);
    return (rideData?.net_fare != null ? Math.round(rideData.net_fare) : Math.max(0, rawF - disc)) || fareCount;
  };

  const handlePayment = async () => {
    if (!RazorpayCheckout) { Alert.alert('Payment Error', 'Payment module failed to load. Please restart the app.'); return; }
    // Same payingRef guard payWithWallet already uses — without it, a fast
    // double-tap before the native Razorpay sheet visually blocks input can
    // fire two /api/payment/create-order calls for the same ride (two orders,
    // two checkout sheets).
    if (payingRef.current) return;
    payingRef.current = true;
    try {
      const fareNum = _netFare();
      const order = await apiPost('/api/payment/create-order', { amount: fareNum, ride_id: rideData.ride_id });
      if (!order.success) { setResult('❌ ' + (order.error || 'Could not create order')); payingRef.current = false; return; }
      RazorpayCheckout.open({ description: 'Sppero Trip', currency: 'INR', key: order.key_id, amount: order.amount, order_id: order.order_id, name: 'Sppero', prefill: { contact: phone, name: userName || 'User' }, theme: { color: C.pink } })
        .then(async (data: any) => {
          apiPost('/api/payment/verify', { ride_id: rideData.ride_id, razorpay_payment_id: data.razorpay_payment_id, razorpay_order_id: data.razorpay_order_id, razorpay_signature: data.razorpay_signature, amount: fareNum, method: 'online' }).catch(() => {});
          apiPost('/api/rides/payment-complete', { ride_id: rideData.ride_id, payment_method: 'online', phone: phone || '9999999999' }).catch(() => {});
          setPaymentDone(true); setScreen('postride'); createScratchCard();
          AsyncStorage.removeItem('activeStdRideId').catch(() => {});
          payingRef.current = false;
        }).catch((e: any) => {
          const { cancelled, msg } = rzpErr(e);
          setResult(cancelled ? '❌ Payment cancelled' : `❌ ${msg}`);
          payingRef.current = false;
        });
    } catch (e: any) { setResult('❌ Payment failed. Please try again.'); payingRef.current = false; }
  };

  const payWithWallet = async () => {
    if (payingRef.current) return; // Prevent double-tap during async call
    payingRef.current = true;
    const fareNum = _netFare();
    if (walletBalance < fareNum) {
      setResult(`❌ Balance kam hai! ₹${walletBalance} hai`);
      payingRef.current = false; return;
    }
    try {
      const data = await authRidePost('/api/wallet/pay', { phone: phone || '9999999999', amount: fareNum, ride_id: rideData.ride_id });
      if (data.success) {
        setWalletBalance(data.balance);
        // Advance screen immediately — never block the customer on payment-complete network call
        setPaymentDone(true); setScreen('postride'); createScratchCard();
        AsyncStorage.removeItem('activeStdRideId').catch(() => {});
        // Notify backend + driver via socket in background with retry
        const rideId = rideData.ride_id;
        const ph = phone || '9999999999';
        (async () => {
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const pcData = await apiPost('/api/rides/payment-complete', { ride_id: rideId, payment_method: 'wallet', phone: ph });
              if (pcData.cashbacks?.length) setCashbackEarned(pcData.cashbacks);
              return;
            } catch (_e) {
              if (attempt < 4) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            }
          }
        })();
      } else {
        setResult('❌ ' + (data.message || 'Wallet payment fail'));
      }
    } catch (_e) { setResult('❌ Could not connect to server'); }
    payingRef.current = false;
  };

  const createScratchCard = async () => {
    try {
      const data = await apiPost('/api/scratch-card/create', { phone: phone || '9999999999', ride_id: rideData?.ride_id });
      if (data.success) { setScratchCard(data); setScratched(false); }
    } catch (_e) {}
  };

  const scratchNow = async () => {
    if (!scratchCard || scratched) return;
    scratchAnim.stopAnimation(); setScratched(true);
    try {
      await apiPost('/api/scratch-card/scratch', { card_id: scratchCard.card_id, phone: phone || '9999999999' });
      loadWallet(phone);
    } catch (_e) {}
  };

  const openRazorpayTopup = async (amt: number) => {
    if (amt < 1) return;
    if (!RazorpayCheckout) { Alert.alert('Error', 'Payment module failed to load. Please restart the app.'); return; }
    try {
      const d = await authRidePost('/api/wallet/topup/order', { phone, amount: amt });
      if (!d.success) { Alert.alert('Payment Error', d.error || 'Could not initiate payment'); return; }
      RazorpayCheckout.open({ key: d.key_id, amount: d.amount, currency: d.currency || 'INR', order_id: d.order_id, name: 'Sppero', description: `Wallet Recharge ₹${amt}`, prefill: { contact: phone }, theme: { color: C.pink } })
        .then(async (payment: any) => {
          try {
            const vd = await authRidePost('/api/wallet/topup/verify', { phone, razorpay_order_id: payment.razorpay_order_id, razorpay_payment_id: payment.razorpay_payment_id, razorpay_signature: payment.razorpay_signature, amount: amt });
            if (vd.success) { setWalletBalance(vd.balance); await loadWalletDetail(phone); Alert.alert('✅ Wallet Recharged!', `₹${amt} has been added to your wallet!`); }
            else { Alert.alert('Payment Failed', 'Payment could not be verified. Your balance will refresh shortly.'); }
          } catch (_e) { Alert.alert('Network Error', 'Payment done but verification pending. Refresh your balance in a moment.'); }
        }).catch((e: any) => {
          const { cancelled, msg } = rzpErr(e);
          if (!cancelled) Alert.alert('Payment Fail', msg);
          // cancelled = user tapped back — silent, no alert needed
        });
    } catch (_e) { Alert.alert('Error', 'Could not connect to server. Please check your internet.'); }
  };

  const addMoney = async (amt: number) => { openRazorpayTopup(amt); };

  // ── Scheduled rides ──────────────────────────────────────────────────────
  const [selectedScheduledRide, setSelectedScheduledRide] = useState<any>(null);

  const scheduleRide = async (payload: {
    pickup: string; drop: string; rideType: string;
    pickupLat: number; pickupLng: number; dropLat: number; dropLng: number;
    distanceKm: number; durationMin: number; discount: number; promoCode: string;
    scheduledAt: string;
  }) => {
    setLoading(true);
    try {
      const data = await apiPost('/api/scheduled', {
        passenger_phone: phone,
        pickup:         payload.pickup,
        drop_location:  payload.drop,
        ride_type:      payload.rideType,
        pickup_lat:     payload.pickupLat,
        pickup_lng:     payload.pickupLng,
        drop_lat:       payload.dropLat,
        drop_lng:       payload.dropLng,
        distance:       payload.distanceKm,
        duration_min:   payload.durationMin,
        discount:       payload.discount,
        promo_code:     payload.promoCode,
        scheduled_at:   payload.scheduledAt,
        // Same "who's riding" state bookRide() reads — scheduling for later
        // shouldn't silently drop it just because it's a different endpoint.
        rider_name:  !rideForSelf ? riderName.trim()  : null,
        rider_phone: !rideForSelf ? riderPhone.trim() : null,
      });
      if (data?.error || data?._error) {
        Alert.alert('Could not schedule', data.error || 'Please try again');
        return;
      }
      setScreen('scheduled-rides');
      setRideForSelf(true); setRiderName(''); setRiderPhone(''); // reset for next booking
      Alert.alert(
        '📅 Ride Scheduled!',
        `Your ${payload.rideType} is booked for ${new Date(payload.scheduledAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}. We'll match a driver 15 mins before.`,
        [{ text: 'View Rides', style: 'default' }]
      );
      return data;
    } catch (err: any) {
      Alert.alert('Could not schedule', err?.message || 'Please try again');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ── Data loaders ─────────────────────────────────────────────────────────
  // Lifetime CO₂ saved by choosing electric vehicles, plus the per-km factors
  // the booking screen uses. Factors come from the server (services/green.js)
  // rather than being duplicated here, so the two can never disagree.
  const [greenSummary, setGreenSummary] = useState<any>(null);

  const loadGreenSummary = async (ph: string) => {
    if (!ph) return;
    try {
      const r = await fetch(`${API}/api/rides/green-summary?phone=${ph}`);
      const d = await r.json();
      if (!d?.error) setGreenSummary(d);
    } catch (_e) {}
  };

  const loadHistory = async (ph: string) => {
    try {
      const r = await fetch(`${API}/api/rides/history?phone=${ph}`);
      const d = await r.json();
      const rides = d.rides || [];
      setHistoryRides(rides);
      // Seed dropHistory from completed rides if no local history saved yet
      const saved = await AsyncStorage.getItem('dropLocationHistory').catch(() => null);
      if (!saved) {
        const unique: { text: string; coords: null }[] = [];
        for (const h of rides) {
          if (h.status === 'completed' && h.drop_location && !unique.find(u => u.text === h.drop_location)) {
            unique.push({ text: h.drop_location, coords: null });
            if (unique.length >= 7) break;
          }
        }
        if (unique.length > 0) setDropHistory(unique);
      }
    } catch (_e) {}
  };
  const loadWallet = async (ph: string) => {
    try { const d = await authRideGet(`/api/wallet/balance?phone=${ph}`); setWalletBalance(d.balance || 0); } catch (_e) {}
  };
  const loadWalletDetail = async (ph: string) => {
    try {
      const d = await authRideGet(`/api/wallet/customer/detail?phone=${ph}`);
      setWalletBalance(d.balance || 0); setWalletTxns(d.transactions || []); setWalletStats(d.stats || {});
    } catch (_e) {}
  };
  const loadLoyalty = async (ph: string) => {
    try { const r = await fetch(`${API}/api/loyalty/my-points?phone=${ph}`); const d = await r.json(); setLoyaltyPoints(d.points || 0); setLoyaltyCashback(d.cashback_available || 0); } catch (_e) {}
  };
  const loadRewardsDash = async (ph: string) => {
    try { const r = await fetch(`${API}/api/rewards/dashboard?phone=${ph}`); const d = await r.json(); setRewardsDash(d); } catch (_e) {}
  };
  const loadOffers = async () => {
    try { const r = await fetch(`${API}/api/offers/active?role=customer&phone=${phone || ''}`); const d = await r.json(); setActiveOffers(d.offers || []); } catch (_e) {}
  };
  const loadHourlyPackages = async () => {
    try { const r = await fetch(`${API}/api/hourly/packages`); const d = await r.json(); if (d.fares) setHourlyPackages(d.fares); } catch (_e) {}
  };
  const loadSaved = async () => {
    try { const r = await fetch(`${API}/api/places/saved?phone=${phone}`); const d = await r.json(); setSavedPlaces(d.places || []); } catch (_e) {}
  };
  const loadFavouriteBuddy = async (ph: string) => {
    try { const r = await fetch(`${API}/api/favourites?phone=${ph}`); const d = await r.json(); setFavouriteBuddy(d.buddy || null); } catch (_e) {}
  };
  const addFavouriteBuddy = async (driverPhone: string) => {
    if (!phone || !driverPhone) return { error: 'Missing' };
    try {
      const r = await fetch(`${API}/api/favourites`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_phone: phone, driver_phone: driverPhone }) });
      const d = await r.json();
      if (d.success) setFavouriteBuddy(d.buddy);
      return d;
    } catch (_e) { return { error: 'Network error' }; }
  };
  const removeFavouriteBuddy = async () => {
    if (!phone) return;
    try {
      await fetch(`${API}/api/favourites`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_phone: phone }) });
      setFavouriteBuddy(null);
    } catch (_e) {}
  };

  // ── Misc ─────────────────────────────────────────────────────────────────
  // Emergency mid-trip cancel: ends the trip and reports it; any advance is held
  // and refunded per admin's decision within 2 days.
  const reportCancelRide = async (reason: string) => {
    const rideId = rideData?.ride_id;
    if (!rideId) return;
    try {
      const res = await authRidePost('/api/rides/report-cancel', { ride_id: rideId, phone: phone || '9999999999', reason });
      if (res?.success) {
        Alert.alert('🛡️ Report Submitted', res.message || 'Your report is under review. Any refund will be decided within 2 days.', [{ text: 'OK' }]);
        try { ride.stopPolling(); } catch (_e) {}
        setScreen('home');
      } else {
        Alert.alert('Could not submit', res?.error || res?.message || 'Please try again');
      }
    } catch { Alert.alert('Error', 'Network error — please try again'); }
  };

  const triggerSOS = async () => {
    setSosActive(true);
    // 1. Notify backend
    try {
      await fetch(`${API}/api/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, ride_id: rideData?.ride_id, lat: userCoords?.latitude, lng: userCoords?.longitude, type: 'emergency' }),
      });
    } catch (_e) {}
    // 2. Send WhatsApp alert to every saved emergency contact
    try {
      const raw = await AsyncStorage.getItem('sppero_emergency_contacts');
      const contacts: { name: string; phone: string }[] = raw ? JSON.parse(raw) : [];
      if (contacts.length === 0) return;
      const locUrl = userCoords
        ? `https://maps.google.com/?q=${userCoords.latitude},${userCoords.longitude}`
        : '';
      const driverPart = rideData
        ? `\nDriver: ${rideData.driver_name || 'Unknown'} | Vehicle: ${rideData.vehicle_no || 'Unknown'} | Ride ${shortRideId(rideData.ride_id)}`
        : '';
      const message = `🆘 EMERGENCY — I need immediate help!\nI am on a Sppero ride.${driverPart}\n📍 My current location:\n${locUrl}\n\nPlease call me or alert the police (100).`;
      const encoded = encodeURIComponent(message);
      // Open WhatsApp for the first contact; others get alerted via SMS fallback
      const first = contacts[0];
      const waNum = first.phone.startsWith('91') ? first.phone : `91${first.phone}`;
      await Linking.openURL(`https://wa.me/${waNum}?text=${encoded}`);
      // SMS to remaining contacts (Android supports comma-separated)
      if (contacts.length > 1) {
        const numbers = contacts.slice(1).map(c => c.phone).join(',');
        await Linking.openURL(`sms:${numbers}?body=${encoded}`).catch(() => {});
      }
    } catch (_e) {}
  };
  const savePlace = async (label: string) => {
    if (!pickup) { setResult('❌ Set a location first'); return; }
    try { await fetch(`${API}/api/places/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, label, address: pickup, lat: pickupCoords?.lat, lng: pickupCoords?.lng }) }); loadSaved(); setResult(`✅ ${label} saved!`); } catch (_e) {}
  };
  // Save an arbitrary coordinate, rather than the current pickup. Used after a
  // ride to capture where the trip ACTUALLY ended: that point is proven
  // vehicle-reachable and is exactly where the customer meant to go, so
  // reusing it next time removes the area-centroid guesswork permanently. This
  // is the one fix that compounds — every saved destination is one that can
  // never be mis-pinned again.
  const savePlaceAt = async (label: string, address: string, lat?: number | null, lng?: number | null) => {
    if (lat == null || lng == null) { setResult('❌ No exact location to save'); return; }
    try {
      await fetch(`${API}/api/places/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, label, address, lat, lng }),
      });
      loadSaved();
      setResult(`✅ ${label} saved — next time it's one tap`);
    } catch (_e) {}
  };
  const deletePlace = async (id: number) => {
    try { await fetch(`${API}/api/places/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); loadSaved(); } catch (_e) {}
  };
  const animateStar = (i: number) => {
    Animated.sequence([
      Animated.timing(starAnims[i], { toValue: 1.5, duration: 120, useNativeDriver: true }),
      Animated.timing(starAnims[i], { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };
  const sendChat = async (text?: string) => {
    const msg = text ?? chatInput;
    if (!msg.trim() || !rideData?.ride_id) return;
    if (!text) setChatInput('');
    try { await fetch(`${API}/api/chat/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, sender: 'customer', message: msg }) }); const r = await fetch(`${API}/api/chat/${rideData.ride_id}`); const d = await r.json(); setChatMsgs(d.messages || []); } catch (_e) {}
  };
  const initiateCall = async (rideId: string | null, bookingId: string | null = null) => {
    try {
      const body: any = { caller_role: 'customer' };
      if (rideId) body.ride_id = rideId;
      if (bookingId) body.booking_id = bookingId;
      const r = await fetch(`${API}/api/call/initiate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!data.success) { Alert.alert('Call', data.error || 'Call could not be placed'); return; }
      if (data.method === 'direct' && data.call_number) Linking.openURL(`tel:${data.call_number}`);
      else if (data.method === 'exotel') Alert.alert('📞 Calling', 'You will receive a call shortly...');
    } catch (_e) { Alert.alert('Error', 'Network error'); }
  };
  const callDriver = () => initiateCall(rideData?.ride_id ?? null);
  const rideIcon = (type: string) =>
    type === 'auto' ? '🛺' : type === 'bike' ? '🏍️' : type === 'eriksha' ? '🛵' :
    type === 'luxury' ? '🚙' : type === 'green_bike' ? '⚡' : type === 'electric_auto' ? '🌿' : '🚕';

  // ═══════════════════════════════════════════════════════════════════════
  // PROVIDE
  // ═══════════════════════════════════════════════════════════════════════
  const value: AppContextType = {
    screen, setScreen, tab, setTab, scheduleIntent, setScheduleIntent,
    intercityRoute, setIntercityRoute, bookIntercity, bookParcel, parcelEstimate, reportParcelNotDelivered, returnDecision, payReturnFare, greenSummary, loadGreenSummary,
    phone, setPhone, otp, setOtp, otpSent, setOtpSent, otpDigits, setOtpDigits,
    resendTimer, setResendTimer, canResend, setCanResend, otpRefs, otpShakeAnim, otpSuccessAnim,
    userName, setUserName, gender, setGender,
    splashLogo, splashScale, splashTag, splashFade, splashDone,
    onboardFade, onboardSlide, loginHeroAnim, loginCardAnim,
    pickup, setPickup, drop, setDrop, pickupCoords, setPickupCoords, dropCoords, setDropCoords,
    pickupLandmark, setPickupLandmark,
    dropPrecision, setDropPrecision, dropNote, setDropNote,
    resetBookingState,
    rideType, setRideType, pickupSugg, setPickupSugg, dropSugg, setDropSugg, dropHistory,
    appConfig,
    fareEstimates, setFareEstimates, fareLoading, fareFailed, retryFare, eta, setEta, userCoords, setUserCoords,
    showPromoInput, setShowPromoInput, instantApplied, setInstantApplied, lastFetchKey,
    promoCode, setPromoCode, promoDiscount, setPromoDiscount,
    promoScreenCode, setPromoScreenCode, promoScreenMsg, setPromoScreenMsg,
    availablePromos, setAvailablePromos,
    rideForSelf, setRideForSelf, riderName, setRiderName, riderPhone, setRiderPhone,
    rideData, setRideData, altSuggest, setAltSuggest,
    switchingVehicle, setSwitchingVehicle, driverLoc, setDriverLoc,
    driverEta, setDriverEta, driverDist, setDriverDist,
    showCancelModal, setShowCancelModal, cancelTimer, setCancelTimer,
    freeCancelsLeft, setFreeCancelsLeft, cancelInfo, setCancelInfo, bookTime, setBookTime,
    searchElapsed, setSearchElapsed, surgeCount, setSurgeCount,
    surgeFare, setSurgeFare, surging, setSurging, surgeBarAnim, surgeBarAnimRef,
    serverSurgeOffer, setServerSurgeOffer, noDriverFinal, setNoDriverFinal,
    driverCancelPopup, setDriverCancelPopup,
    notifToast, setNotifToast,
    chatMsgs, setChatMsgs, chatInput, setChatInput, unreadChat, setUnreadChat, lastChatCount, chatToast, setChatToast, chatOrigin, setChatOrigin,
    rating, setRating, tip, setTip, review, setReview,
    paymentDone, setPaymentDone, showRatingModal, setShowRatingModal, showUpiQr, setShowUpiQr, fareCount, setFareCount,
    scratchCard, setScratchCard, scratched, setScratched, scratchAnim, starAnims, sosActive, setSosActive,
    walletBalance, setWalletBalance, walletTxns, setWalletTxns, walletStats, setWalletStats,
    walletTxnTab, setWalletTxnTab, walletAddInput, setWalletAddInput,
    loyaltyPoints, setLoyaltyPoints, loyaltyCashback, setLoyaltyCashback,
    historyRides, setHistoryRides, activeOffers, setActiveOffers,
    offerDismissed, setOfferDismissed, savedPlaces, setSavedPlaces, customerRating, setCustomerRating,
    favouriteBuddy, setFavouriteBuddy, showBuddyBook, setShowBuddyBook,
    buddyBookPU, setBuddyBookPU, buddyBookDR, setBuddyBookDR,
    buddyBookPUCoords, setBuddyBookPUCoords, buddyBookDRCoords, setBuddyBookDRCoords,
    buddyBookLoading, setBuddyBookLoading, buddyBookMsg, setBuddyBookMsg,
    buddyWaiting, setBuddyWaiting, buddyWaitingRef, buddyPUSugg, setBuddyPUSugg, buddyDRSugg, setBuddyDRSugg,
    hourlyStep, setHourlyStep, hourlyBooking, setHourlyBooking,
    activeHourlyIdRef, activeRideIdRef,
    hPackageHours, setHPackageHours, hVehicle, setHVehicle,
    hPickup, setHPickup, hPickupCoords, setHPickupCoords,
    hDrop, setHDrop, hDropCoords, setHDropCoords,
    hRoundTrip, setHRoundTrip, hStayHours, setHStayHours,
    hPickupSugg, setHPickupSugg, hDropSugg, setHDropSugg,
    hourlyTimerSec, setHourlyTimerSec, hOtpInput, setHOtpInput,
    hChatOpen, setHChatOpen, hChatMsgs, setHChatMsgs,
    hChatInput, setHChatInput, hChatUnread, setHChatUnread,
    hExtendStep, setHExtendStep, hExtendStepRef, hExtendResult, setHExtendResult,
    hExtendPrevHoursRef, hExtendHours, setHExtendHours, hExtendMin, setHExtendMin,
    hExtendCost, setHExtendCost, hApproachLimit, setHApproachLimit,
    hourlyPackages, setHourlyPackages, hourlyTimerRef,
    result, setResult, loading, setLoading, storeStatus,
    socketRef, phoneRef, pickupDebounceRef, dropDebounceRef, hPickupDebounceRef, hDropDebounceRef, buddyPUDebRef, buddyDRDebRef,
    sendOtp, verifyOtp, completeOnboarding, handleOtpChange, handleOtpKeyPress,
    connectSocket, joinRideSocket, joinHourlySocket, adoptActiveRide,
    bookRide, surgeFareNow, switchVehicle, searchPlaces, searchNearbyCategory, geocodePlace, swapLocations,
    fetchEtaByCoords, loadFareEstimates, applyPromo, useMyLocation, calcDriverEta,
    handlePayment, payWithWallet, createScratchCard, scratchNow, addMoney, openRazorpayTopup,
    loadHistory, loadWallet, loadWalletDetail, loadLoyalty, loadOffers, loadHourlyPackages,
    loadSaved, loadFavouriteBuddy, addFavouriteBuddy, removeFavouriteBuddy, registerFCM,
    triggerSOS, reportCancelRide, savePlace, savePlaceAt, deletePlace,
    animateStar, sendChat, initiateCall, callDriver, rideIcon,
    rewardsDash, setRewardsDash, cashbackEarned, setCashbackEarned, loadRewardsDash,
    selectedScheduledRide, setSelectedScheduledRide, scheduleRide,
  } as any;

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
