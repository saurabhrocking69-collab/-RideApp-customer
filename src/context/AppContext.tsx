import { createContext, useContext, useState, useRef, useEffect } from 'react';
import { AppState, Alert, Linking, Platform, Share } from 'react-native';
import { Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import { io, Socket } from 'socket.io-client';
import { apiGet, apiPost } from '../../api';
import { useRideStore } from '../../store';
import { API, MAPS_KEY, RIDES, DEFAULT_HOURLY_PACKAGES } from '../constants';
import { Screen, Tab, Coords, HourlyStep, ExtendStep, WalletTxnTab } from '../types';

let RazorpayCheckout: any = null;
try { const _m = require('react-native-razorpay'); RazorpayCheckout = _m?.default || _m; } catch (_e) {}

// ─── Context Type ───────────────────────────────────────────────────────────
interface AppContextType {
  // Navigation
  screen: Screen; setScreen: (s: Screen) => void;
  tab: Tab; setTab: (t: Tab) => void;
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
  gender: string; setGender: (g: 'male'|'female'|'other'|'') => void;
  // Splash anims
  splashLogo: Animated.Value; splashScale: Animated.Value;
  splashTag: Animated.Value; splashFade: Animated.Value;
  // Login anims
  onboardFade: Animated.Value; onboardSlide: Animated.Value;
  loginHeroAnim: Animated.Value; loginCardAnim: Animated.Value;
  // Booking
  pickup: string; setPickup: (p: string) => void;
  drop: string; setDrop: (d: string) => void;
  pickupCoords: Coords; setPickupCoords: (c: Coords) => void;
  dropCoords: Coords; setDropCoords: (c: Coords) => void;
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
  // Chat
  chatMsgs: any[]; setChatMsgs: (m: any[]) => void;
  chatInput: string; setChatInput: (i: string) => void;
  unreadChat: number; setUnreadChat: React.Dispatch<React.SetStateAction<number>>;
  lastChatCount: React.MutableRefObject<number>;
  chatToast: string | null; setChatToast: (v: string | null) => void;
  // Post ride
  rating: number; setRating: (r: number) => void;
  tip: number; setTip: (t: number) => void;
  review: string; setReview: (r: string) => void;
  paymentDone: boolean; setPaymentDone: (v: boolean) => void;
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
  referralData: any; setReferralData: (d: any) => void;
  referralInput: string; setReferralInput: (s: string) => void;
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
  hChatOpen: boolean; setHChatOpen: (v: boolean) => void;
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
  // Complaints
  complaints: any[]; setComplaints: (c: any[]) => void;
  activeComplaint: any; setActiveComplaint: (c: any) => void;
  cmpType: string; setCmpType: (t: string) => void;
  cmpDesc: string; setCmpDesc: (d: string) => void;
  cmpMsg: string; setCmpMsg: (m: string) => void;
  cmpLoading: boolean; setCmpLoading: (v: boolean) => void;
  cmpDetail: any; setCmpDetail: (d: any) => void;
  cmpLinkedRide: any; setCmpLinkedRide: (r: any) => void;
  cmpHistoryRides: any[]; setCmpHistoryRides: (r: any[]) => void;
  cmpShowRidePicker: boolean; setCmpShowRidePicker: (v: boolean) => void;
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
  // Functions — booking
  bookRide: () => Promise<void>;
  surgeFareNow: (amount: number) => Promise<void>;
  switchVehicle: (newType: string) => Promise<void>;
  searchPlaces: (text: string, type: 'pickup'|'drop') => void;
  geocodePlace: (address: string, type: 'pickup'|'drop') => Promise<void>;
  swapLocations: () => void;
  fetchEtaByCoords: (pc: any, dc: any) => Promise<void>;
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
  loadReferral: () => Promise<void>;
  loadSaved: () => Promise<void>;
  loadFavouriteBuddy: (ph: string) => Promise<void>;
  addFavouriteBuddy: (driverPhone: string) => Promise<any>;
  removeFavouriteBuddy: () => Promise<void>;
  registerFCM: (userPhone: string) => Promise<void>;
  // Functions — misc
  triggerSOS: () => Promise<void>;
  applyReferral: () => Promise<void>;
  shareReferral: () => Promise<void>;
  savePlace: (label: string) => Promise<void>;
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
      setScreen((cur: Screen) => (['payment', 'postride'].includes(cur) ? cur : 'payment'));
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

  // ── Active ride ─────────────────────────────────────────────────────────
  const [rideData, setRideData] = useState<any>(null);
  const rideDataRef = useRef<any>(null);
  useEffect(() => { rideDataRef.current = rideData; }, [rideData]);
  const payingRef = useRef(false);
  const [altSuggest, setAltSuggest] = useState<any>(null);
  const [switchingVehicle, setSwitchingVehicle] = useState(false);
  const [driverLoc, setDriverLoc] = useState<any>(null);
  const [driverEta, setDriverEta] = useState('');
  const [driverDist, setDriverDist] = useState('');
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

  // ── Chat ────────────────────────────────────────────────────────────────
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadChat, setUnreadChat] = useState(0);
  const lastChatCount = useRef(0);
  const [chatToast, setChatToast] = useState<string | null>(null);
  const chatToastTimer = useRef<any>(null);

  // ── Post ride ───────────────────────────────────────────────────────────
  const [rating, setRating] = useState(0);
  const [tip, setTip] = useState(0);
  const [review, setReview] = useState('');
  const [paymentDone, setPaymentDone] = useState(false);
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
  const [referralData, setReferralData] = useState<any>(null);
  const [referralInput, setReferralInput] = useState('');
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

  // ── Complaints ───────────────────────────────────────────────────────────
  const [complaints, setComplaints] = useState<any[]>([]);
  const [activeComplaint, setActiveComplaint] = useState<any>(null);
  const [cmpType, setCmpType] = useState('');
  const [cmpDesc, setCmpDesc] = useState('');
  const [cmpMsg, setCmpMsg] = useState('');
  const [cmpLoading, setCmpLoading] = useState(false);
  const [cmpDetail, setCmpDetail] = useState<any>(null);
  const [cmpLinkedRide, setCmpLinkedRide] = useState<any>(null);
  const [cmpHistoryRides, setCmpHistoryRides] = useState<any[]>([]);
  const [cmpShowRidePicker, setCmpShowRidePicker] = useState(false);

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
      const savedPhone = await AsyncStorage.getItem('userPhone').catch(() => null);
      const savedName  = await AsyncStorage.getItem('userName').catch(() => null);
      const savedDropHist = await AsyncStorage.getItem('dropLocationHistory').catch(() => null);
      if (savedDropHist) { try { setDropHistory(JSON.parse(savedDropHist)); } catch (_) {} }

      Animated.timing(splashFade, { toValue: 0, duration: 300, useNativeDriver: true }).start(async () => {
        if (savedPhone) {
          setPhone(savedPhone);
          phoneRef.current = savedPhone;
          if (savedName) setUserName(savedName);

          const activeRideId = await AsyncStorage.getItem('activeStdRideId').catch(() => null);
          if (activeRideId) {
            try {
              const r = await fetch(`${API}/api/rides/${activeRideId}`);
              const d = await r.json();
              const st = d.ride?.status || d.status;
              if (st === 'searching' || st === 'matched' || st === 'arrived') {
                setRideData(d.ride || d); setScreen('matching');
              } else if (st === 'started') {
                setRideData(d.ride || d); setScreen('inride');
              } else if (st === 'completed' || st === 'payment') {
                setScreen('payment');
              } else {
                setScreen('home');
              }
            } catch { setScreen('home'); }
          } else {
            setScreen('home');
          }
          fetchAppConfig();
          loadHistory(savedPhone); loadWallet(savedPhone);
          loadOffers(); loadHourlyPackages();
          connectSocket(savedPhone); registerFCM(savedPhone);
        } else {
          setScreen('login');
        }
      });
    }, 2000);
  }, []);

  // Notifications setup
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Sppero Notifications',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default', vibrationPattern: [0, 250, 250, 250], enableVibrate: true,
        lightColor: '#e94560', lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
    });
    const sub1 = Notifications.addNotificationReceivedListener(_n => {});
    const handleNotifTap = async (response: any) => {
      const data = response?.notification?.request?.content?.data as any;
      if (!data?.type) return;
      const rideId = data.ride_id;
      if (rideId) await AsyncStorage.setItem('activeStdRideId', String(rideId)).catch(() => {});
      if (['ride_matched','driver_arrived'].includes(data.type)) setScreen('matching');
      else if (data.type === 'trip_started') setScreen('inride');
      else if (data.type === 'trip_completed' && rideDataRef.current?.ride_id) setScreen('payment');
      else if (data.type === 'ride_cancelled') setScreen('home');
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
      }
    });
    return () => sub.remove();
  }, [phone]);

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
        const r = await fetch(`${API}/api/rides/cancel-info/${rideId}`);
        const d = await r.json();
        if (d.fee !== undefined) setCancelInfo(d);
      } catch (_e) {}
    };
    poll();
    const iv = setInterval(poll, 10000);
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

  // Auto GPS on booking screen
  useEffect(() => {
    if (screen === 'booking' && !pickup) useMyLocation();
  }, [screen]);

  // Reactively recalculate fares when coords change
  useEffect(() => {
    if (!pickupCoords?.lat || !dropCoords?.lat || screen !== 'booking') return;
    const key = `${pickupCoords.lat.toFixed(4)},${pickupCoords.lng.toFixed(4)}-${dropCoords.lat.toFixed(4)},${dropCoords.lng.toFixed(4)}`;
    if (lastFetchKey.current === key) return;
    lastFetchKey.current = key;
    fetchEtaByCoords(pickupCoords, dropCoords);
  }, [pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng, screen]);

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
    const anim = Animated.timing(surgeBarAnim, { toValue: 1, duration: 100000, useNativeDriver: false });
    surgeBarAnimRef.current = anim; anim.start();
    const iv = setInterval(() => {
      const secs = Math.floor((Date.now() - bookTime) / 1000);
      setSearchElapsed(Math.min(secs, 100));
      if (secs >= 100) clearInterval(iv);
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
    const target = Math.round(parseFloat(String(rideData.fare).replace(/[^0-9.]/g, '')) || 0);
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

  // Hourly chat polling
  useEffect(() => {
    if (screen !== 'hourly' || !hChatOpen || !hourlyBooking?.id) return;
    const load = async () => {
      try { const d = await apiGet(`/api/hourly/chat/${hourlyBooking.id}`); setHChatMsgs(d.messages || []); setHChatUnread(0); } catch (_e) {}
    };
    load();
    const iv = setInterval(load, 2500);
    return () => clearInterval(iv);
  }, [screen, hChatOpen, hourlyBooking?.id]);

  // Hourly chat badge + toast when panel closed
  useEffect(() => {
    if (screen !== 'hourly' || hChatOpen || !hourlyBooking?.id || hourlyStep === 'book') return;
    let lastCount = hChatMsgs.length;
    const iv = setInterval(async () => {
      try {
        const d = await apiGet(`/api/hourly/chat/${hourlyBooking.id}`);
        const msgs = d.messages || [];
        if (msgs.length > lastCount) {
          setHChatUnread(n => n + (msgs.length - lastCount));
          lastCount = msgs.length;
          setHChatMsgs(msgs);
          const latest = msgs[msgs.length - 1];
          if (latest?.sender === 'driver') {
            setChatToast(latest.message);
            if (chatToastTimer.current) clearTimeout(chatToastTimer.current);
            chatToastTimer.current = setTimeout(() => setChatToast(null), 4500);
          }
        }
      } catch (_e) {}
    }, 5000);
    return () => clearInterval(iv);
  }, [screen, hChatOpen, hourlyStep, hourlyBooking?.id]);

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
      socketRef.current.disconnect();
    }
    const s = io(API, { transports: ['polling', 'websocket'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 2000, reconnectionDelayMax: 10000, timeout: 10000 });

    s.on('connect', () => {
      if (activeHourlyIdRef.current) s.emit('joinHourly', { bookingId: activeHourlyIdRef.current });
      if (activeRideIdRef.current) s.emit('joinRide', { rideId: activeRideIdRef.current });
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
        apiGet(`/api/hourly/status/${data.booking_id}`)
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
      setResult('📍 Sppero Buddy pickup point pe pahunch gaya! OTP batao aur trip shuru karo.');
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
      setHChatUnread((prev: number) => prev + 1);
    });
    s.on('chatMessage', (msg: any) => {
      setChatMsgs((prev: any[]) => [...prev, msg]);
      setUnreadChat((prev: number) => prev + 1);
    });
    s.on('paymentConfirmed', (data: any) => {
      if (data.status === 'completed' && rideDataRef.current?.ride_id) {
        if (data.cashbacks?.length) setCashbackEarned(data.cashbacks);
        setPaymentDone(true);
        setScreen('postride');
        createScratchCard();
        AsyncStorage.removeItem('activeStdRideId').catch(() => {});
      }
    });
    s.on('rideUpdate', (data: any) => {
      const st = data.status;
      if (st === 'matched' || st === 'arrived') {
        setAltSuggest(null);
        if (data.driver) {
          setRideData((p: any) => p ? { ...p, startOtp: data.start_otp || p?.startOtp, driver: data.driver } : p);
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
                    startOtp: d.ride.start_otp || p?.startOtp,
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
                      verified: d.ride.driver_verified ?? false,
                    },
                  } : p);
                }
              })
              .catch(() => {});
          }
        }
      }
      if (st === 'searching') {
        setRideData((p: any) => p ? { ...p, ...(data.new_fare ? { fare: data.new_fare } : {}), ...(data.new_vehicle_type ? { vehicle_type: data.new_vehicle_type } : {}) } : p);
        useRideStore.setState({ rideStatus: 'requested' });
      }
      if (st === 'started') { setScreen('inride'); useRideStore.setState({ rideStatus: 'started', startOtp: '' }); }
      if (st === 'completed' && rideDataRef.current?.ride_id) {
        AsyncStorage.removeItem('activeStdRideId').catch(() => {});
        useRideStore.setState({ rideStatus: 'completed' });
        setScreen((cur: Screen) => (cur === 'payment' || cur === 'postride') ? cur : 'payment');
        loadWallet(phoneRef.current || userPhone);
      }
      if (st === 'buddy_declined') { buddyWaitingRef.current = false; setBuddyWaiting(false); setBuddyBookMsg('⚠️ Buddy ne abhi accept nahi kiya. Ab doosre drivers dhundh rahe hain...'); }
      if (st === 'cancelled') {
        AsyncStorage.removeItem('activeStdRideId').catch(() => {});
        ride.clearRide();
        setRideData(null); setAltSuggest(null); setDriverLoc(null);
        setPickup(''); setDrop(''); setPickupCoords(null); setDropCoords(null); setEta('');
        buddyWaitingRef.current = false; setBuddyWaiting(false); setBuddyBookMsg('');
        setScreen('home'); setResult('❌ Ride cancel ho gayi');
      }
      if (st === 'no_driver') {
        AsyncStorage.removeItem('activeStdRideId').catch(() => {});
        ride.clearRide();
        setRideData(null); setAltSuggest(null); setDriverLoc(null);
        setPickup(''); setDrop(''); setPickupCoords(null); setDropCoords(null); setEta('');
        if (buddyWaitingRef.current) {
          buddyWaitingRef.current = false; setBuddyWaiting(false);
          setBuddyBookMsg('⏰ Driver ne 25 seconds mein respond nahi kiya — naya ride try karo');
        } else {
          setBuddyWaiting(false); setBuddyBookMsg(''); setScreen('home');
          setResult('😔 Abhi driver available nahi — thodi der baad try karo');
        }
      }
    });
    s.on('driverMoved', (data: any) => {
      if (data.lat && data.lng) setDriverLoc({ lat: data.lat, lng: data.lng });
    });
    s.on('suggestAlternative', (data: any) => {
      if (data.alternatives?.length > 0) setAltSuggest({ alternatives: data.alternatives, current_type: data.current_type });
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
      const res = await fetch(`${API}/api/auth/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      const data = await res.json();
      if (data.error) { setResult('❌ ' + data.error); setLoading(false); return; }
      setOtpSent(data.otp || ''); setScreen('otp'); setResult('');
    } catch { setResult('❌ Server connect nahi hua'); }
    setLoading(false);
  };

  const verifyOtp = async (otpOverride?: string) => {
    const otpToUse = otpOverride || otp;
    if (!otpToUse) { setResult('❌ OTP likho'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, otp: otpToUse, name: userName || 'Rider' }) });
      const data = await res.json();
      if (data.token) {
        await AsyncStorage.setItem('userPhone', phone);
        await AsyncStorage.setItem('userToken', data.token);
        const serverName = data.user?.name || '';
        const onboardingDone = await AsyncStorage.getItem('onboardingCompleted');
        const nameIsDefault = !serverName || serverName === 'User' || serverName === 'Rider';
        const isNew = !onboardingDone && nameIsDefault;
        if (isNew) {
          onboardFade.setValue(0); onboardSlide.setValue(60);
          setScreen('onboarding'); setResult('');
          Animated.parallel([
            Animated.timing(onboardFade, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.spring(onboardSlide, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
          ]).start();
        } else {
          setUserName(serverName || 'Rider');
          await AsyncStorage.setItem('userName', serverName || 'Rider');
          fetchAppConfig();
          setScreen('home'); setResult(''); loadHistory(phone); loadWallet(phone);
          registerFCM(phone); loadOffers(); loadHourlyPackages(); connectSocket(phone);
        }
      } else {
        setResult('❌ ' + (data.error || 'OTP galat hai')); shakeOtp();
      }
    } catch { setResult('❌ Server connect nahi hua'); }
    setLoading(false);
  };

  const completeOnboarding = async () => {
    if (!userName.trim()) { setResult('❌ Naam likhna zaroori hai'); return; }
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
      const token = (await Notifications.getExpoPushTokenAsync({ projectId: '8f1a5733-b0fe-466b-ab3e-862983570572' })).data;
      await apiPost('/api/auth/save-fcm-token', { phone: userPhone, token, role: 'customer' });
    } catch (_e) {}
  };

  // ── Location + ETA ───────────────────────────────────────────────────────
  const useMyLocation = async () => {
    setResult('📍 Location le rahe hain...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setResult('❌ Location permission do'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = loc.coords.latitude; const lng = loc.coords.longitude;
      setUserCoords({ latitude: lat, longitude: lng }); setPickupCoords({ lat, lng });
      try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}&language=en`);
        const data = await res.json();
        if (data.results?.[0]) {
          setPickup(data.results[0].formatted_address); setResult('✅ Location mil gayi!');
          if (drop) {
            const etaRes = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${lat},${lng}&destinations=${encodeURIComponent(drop)}&key=${MAPS_KEY}&mode=driving&departure_time=now`);
            const etaData = await etaRes.json();
            const el = etaData.rows?.[0]?.elements?.[0];
            if (el?.status === 'OK') { const km = el.distance.value / 1000; setEta(`🕐 ${el.duration_in_traffic?.text || el.duration.text} · 📍 ${el.distance.text}`); loadFareEstimates(km); }
          }
        } else {
          const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          if (geo[0]) { const a = geo[0]; setPickup([a.streetNumber, a.street, a.district, a.city].filter(Boolean).join(', ')); setResult('✅ Location mil gayi!'); }
        }
      } catch (_e) {
        const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geo[0]) { const a = geo[0]; setPickup([a.streetNumber, a.street, a.city].filter(Boolean).join(', ')); }
        setResult('✅ Location mil gayi!');
      }
    } catch (_e) { setResult('❌ Location error'); }
  };

  const searchPlaces = (text: string, type: 'pickup' | 'drop') => {
    if (text.length < 3) { type === 'pickup' ? setPickupSugg([]) : setDropSugg([]); return; }
    const ref = type === 'pickup' ? pickupDebounceRef : dropDebounceRef;
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${MAPS_KEY}&components=country:in&location=26.8467,80.9462&radius=50000`);
        const data = await res.json();
        const sugg = data.predictions?.map((p: any) => ({ id: p.place_id, text: p.description })) || [];
        type === 'pickup' ? setPickupSugg(sugg) : setDropSugg(sugg);
      } catch (_e) {}
    }, 400);
  };

  const geocodePlace = async (address: string, type: 'pickup' | 'drop') => {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`);
      const data = await res.json();
      const loc = data.results?.[0]?.geometry?.location;
      if (loc) { type === 'pickup' ? setPickupCoords({ lat: loc.lat, lng: loc.lng }) : setDropCoords({ lat: loc.lat, lng: loc.lng }); }
    } catch (_e) {}
  };

  const swapLocations = () => {
    const tempText = pickup; const tempCoords = pickupCoords;
    setPickup(drop); setPickupCoords(dropCoords);
    setDrop(tempText); setDropCoords(tempCoords);
    setFareEstimates({}); setEta(''); lastFetchKey.current = '';
  };

  const fetchEtaByCoords = async (pc: any, dc: any) => {
    if (!pc?.lat || !dc?.lat) return;
    setEta('⏳ Calculate ho raha hai...'); setFareEstimates({});
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${pc.lat},${pc.lng}&destinations=${dc.lat},${dc.lng}&key=${MAPS_KEY}&mode=driving&departure_time=now`, { cache: 'no-store' } as any);
      const data = await res.json();
      const el = data.rows?.[0]?.elements?.[0];
      if (el?.status === 'OK') { const km = el.distance.value / 1000; setEta(`🕐 ${el.duration_in_traffic?.text || el.duration.text} · 📍 ${el.distance.text}`); loadFareEstimates(km); }
      else setEta('');
    } catch { setEta(''); }
  };

  const loadFareEstimates = async (km: number) => {
    setFareLoading(true);
    const est: any = {};
    await Promise.all(RIDES.map(async (r) => {
      try {
        const res = await fetch(`${API}/api/fare-estimate`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }, body: JSON.stringify({ ride_type: r.id, distance: km }) });
        const d = await res.json();
        if (d.fare) est[r.id] = { fare: d.fare, base_fare: d.base_fare, per_km_rate: d.per_km_rate };
      } catch (_e) {}
    }));
    setFareEstimates(est); setFareLoading(false);
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
      const res = await fetch(`${API}/api/promo/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: promoCode, fare: 100, phone }) });
      const data = await res.json();
      if (data.valid) { setPromoDiscount(data.discount); setResult(`✅ ${data.message}`); }
      else { setPromoDiscount(0); setResult('❌ ' + data.message); }
    } catch (_e) { setResult('❌ Error'); }
  };

  const bookRide = async () => {
    if (!pickup || !drop) { setResult('❌ Pickup aur Drop likho!'); return; }
    setLoading(true); setPaymentDone(false);
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(pickup)}&destinations=${encodeURIComponent(drop)}&key=${MAPS_KEY}&mode=driving&departure_time=now`);
      const ddata = await res.json();
      const el = ddata.rows?.[0]?.elements?.[0];
      const distanceKm = el?.status === 'OK' ? el.distance.value / 1000 : 5;
      if (!dropCoords) await geocodePlace(drop, 'drop');
      const data = await apiPost('/api/rides/book', {
        passenger_phone: phone || '9999999999', pickup, drop_location: drop, ride_type: rideType, distance: distanceKm,
        pickup_lat: pickupCoords?.lat, pickup_lng: pickupCoords?.lng, drop_lat: dropCoords?.lat, drop_lng: dropCoords?.lng,
        discount: promoDiscount, promo_code: promoDiscount > 0 ? promoCode : null
      });
      if (data._error) { setResult('❌ ' + data.message); setLoading(false); return; }
      if (promoDiscount > 0 && data.ride_id) {
        try { await fetch(`${API}/api/promo/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: promoCode, phone, ride_id: data.ride_id, discount: promoDiscount }) }); } catch (_e) {}
      }
      setRideData(data); setScreen('matching'); setResult(''); setAltSuggest(null);
      AsyncStorage.setItem('activeStdRideId', String(data.ride_id)).catch(() => {});
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
      try { const cs = await fetch(`${API}/api/customer/cancel-status?phone=${phone || '9999999999'}`); const csd = await cs.json(); setFreeCancelsLeft(csd.free_cancels_left ?? 3); } catch (_e) {}
    } catch { setResult('❌ Server connect nahi hua!'); }
    setLoading(false);
  };

  const surgeFareNow = async (amount: number) => {
    if (!rideData?.ride_id || surging || surgeCount >= 3) return;
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
      const res = await apiPost('/api/rides/switch-vehicle', { ride_id: rideData.ride_id, new_vehicle_type: newType });
      if (res._error) { setResult('❌ ' + res.message); return; }
      setAltSuggest(null);
      setRideData((p: any) => p ? { ...p, ride_type: newType, fare: res.new_fare } : p);
      setResult(`🔄 ${newType.toUpperCase()} driver dhundh rahe hain...`);
    } catch { setResult('❌ Switch nahi hua, try again'); }
    finally { setSwitchingVehicle(false); }
  };

  // ── Payment ──────────────────────────────────────────────────────────────
  const handlePayment = async () => {
    try {
      const fareNum = parseInt(String(rideData?.fare).replace(/[^0-9]/g, '')) || 0;
      const orderRes = await fetch(`${API}/api/payment/create-order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: fareNum, ride_id: rideData.ride_id }) });
      const order = await orderRes.json();
      if (!order.success) { setResult('❌ Order error'); return; }
      RazorpayCheckout.open({ description: 'Sppero Trip', currency: 'INR', key: order.key_id, amount: order.amount, order_id: order.order_id, name: 'Sppero', prefill: { contact: phone, name: userName || 'User' }, theme: { color: '#e94560' } })
        .then(async (data: any) => {
          await fetch(`${API}/api/payment/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, razorpay_payment_id: data.razorpay_payment_id, razorpay_order_id: data.razorpay_order_id, razorpay_signature: data.razorpay_signature, amount: fareNum, method: 'online' }) });
          await fetch(`${API}/api/rides/payment-complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, payment_method: 'online', phone: phone || '9999999999' }) });
          setPaymentDone(true); setScreen('postride'); createScratchCard();
          AsyncStorage.removeItem('activeStdRideId').catch(() => {});
        }).catch((_e: any) => setResult('❌ Payment cancel ya fail hua'));
    } catch (e: any) { setResult('❌ ' + (e?.message || 'Payment error')); }
  };

  const payWithWallet = async () => {
    if (payingRef.current) return; // Prevent double-tap during async call
    payingRef.current = true;
    const fareNum = parseInt(String(rideData?.fare).replace(/[^0-9]/g, '')) || 0;
    if (walletBalance < fareNum) {
      setResult(`❌ Balance kam hai! ₹${walletBalance} hai`);
      payingRef.current = false; return;
    }
    try {
      const res = await fetch(`${API}/api/wallet/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone || '9999999999', amount: fareNum, ride_id: rideData.ride_id }) });
      const data = await res.json();
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
              const pcRes = await fetch(`${API}/api/rides/payment-complete`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ride_id: rideId, payment_method: 'wallet', phone: ph }),
              });
              const pcData = await pcRes.json();
              if (pcData.cashbacks?.length) setCashbackEarned(pcData.cashbacks);
              return; // Success — stop retrying
            } catch (_e) {
              if (attempt < 4) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            }
          }
        })();
      } else {
        setResult('❌ ' + (data.message || 'Payment fail'));
      }
    } catch (_e) { setResult('❌ Server error'); }
    payingRef.current = false;
  };

  const createScratchCard = async () => {
    try {
      const res = await fetch(`${API}/api/scratch-card/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone || '9999999999', ride_id: rideData?.ride_id }) });
      const data = await res.json();
      if (data.success) { setScratchCard(data); setScratched(false); }
    } catch (_e) {}
  };

  const scratchNow = async () => {
    if (!scratchCard || scratched) return;
    scratchAnim.stopAnimation(); setScratched(true);
    try { await fetch(`${API}/api/scratch-card/scratch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ card_id: scratchCard.card_id, phone: phone || '9999999999' }) }); loadWallet(phone); } catch (_e) {}
  };

  const openRazorpayTopup = async (amt: number) => {
    if (amt < 1) return;
    if (!RazorpayCheckout) { Alert.alert('Error', 'Payment module load nahi hua. App restart karein.'); return; }
    try {
      const r = await fetch(`${API}/api/wallet/topup/order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, amount: amt }) });
      const d = await r.json();
      if (!d.success) { Alert.alert('Payment Error', d.error || 'Payment start nahi hua'); return; }
      RazorpayCheckout.open({ key: d.key_id, amount: d.amount, currency: d.currency || 'INR', order_id: d.order_id, name: 'Sppero', description: `Wallet Recharge ₹${amt}`, prefill: { contact: phone }, theme: { color: '#e94560' } })
        .then(async (payment: any) => {
          const vr = await fetch(`${API}/api/wallet/topup/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, razorpay_order_id: payment.razorpay_order_id, razorpay_payment_id: payment.razorpay_payment_id, razorpay_signature: payment.razorpay_signature, amount: amt }) });
          const vd = await vr.json();
          if (vd.success) { setWalletBalance(vd.balance); await loadWalletDetail(phone); }
          else { Alert.alert('Payment Error', vd.error || 'Wallet update nahi hua'); }
        }).catch((e: any) => { if (e?.code !== 'PAYMENT_CANCELLED') Alert.alert('Payment Error', e?.description || e?.message || 'Payment fail'); });
    } catch (_e) { Alert.alert('Error', 'Server se connect nahi hua. Internet check karein.'); }
  };

  const addMoney = async (amt: number) => { openRazorpayTopup(amt); };

  // ── Data loaders ─────────────────────────────────────────────────────────
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
    try { const r = await fetch(`${API}/api/wallet/balance?phone=${ph}`); const d = await r.json(); setWalletBalance(d.balance || 0); } catch (_e) {}
  };
  const loadWalletDetail = async (ph: string) => {
    try {
      const r = await fetch(`${API}/api/wallet/customer/detail?phone=${ph}`); const d = await r.json();
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
    try { const r = await fetch(`${API}/api/offers/active?role=customer`); const d = await r.json(); setActiveOffers(d.offers || []); } catch (_e) {}
  };
  const loadHourlyPackages = async () => {
    try { const r = await fetch(`${API}/api/hourly/packages`); const d = await r.json(); if (d.fares) setHourlyPackages(d.fares); } catch (_e) {}
  };
  const loadReferral = async () => {
    try { const r = await fetch(`${API}/api/referral/my-code?phone=${phone}`); const d = await r.json(); setReferralData(d); } catch (_e) {}
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
  const triggerSOS = async () => {
    setSosActive(true);
    try { await fetch(`${API}/api/sos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, ride_id: rideData?.ride_id, lat: userCoords?.latitude, lng: userCoords?.longitude, type: 'emergency' }) }); } catch (_e) {}
  };
  const applyReferral = async () => {
    if (!referralInput.trim()) return;
    try {
      const res = await fetch(`${API}/api/referral/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, referral_code: referralInput }) });
      const data = await res.json();
      setResult(data.success ? '✅ ' + data.message : '❌ ' + data.message);
      if (data.success) { loadWallet(phone); loadReferral(); setReferralInput(''); }
    } catch (_e) { setResult('❌ Error'); }
  };
  const shareReferral = async () => {
    if (!referralData?.code) return;
    try { await Share.share({ message: `🚖 Sppero join karo aur ₹50 pao! Mera referral code: ${referralData.code}` }); } catch (_e) {}
  };
  const savePlace = async (label: string) => {
    if (!pickup) { setResult('❌ Pehle location set karo'); return; }
    try { await fetch(`${API}/api/places/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, label, address: pickup, lat: pickupCoords?.lat, lng: pickupCoords?.lng }) }); loadSaved(); setResult(`✅ ${label} save ho gaya!`); } catch (_e) {}
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
      if (!data.success) { Alert.alert('Call', data.error || 'Call nahi ho saki'); return; }
      if (data.method === 'direct' && data.call_number) Linking.openURL(`tel:${data.call_number}`);
      else if (data.method === 'exotel') Alert.alert('📞 Calling', 'Aapke phone pe call aa rahi hai...');
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
    screen, setScreen, tab, setTab,
    phone, setPhone, otp, setOtp, otpSent, setOtpSent, otpDigits, setOtpDigits,
    resendTimer, setResendTimer, canResend, setCanResend, otpRefs, otpShakeAnim, otpSuccessAnim,
    userName, setUserName, gender, setGender,
    splashLogo, splashScale, splashTag, splashFade,
    onboardFade, onboardSlide, loginHeroAnim, loginCardAnim,
    pickup, setPickup, drop, setDrop, pickupCoords, setPickupCoords, dropCoords, setDropCoords,
    rideType, setRideType, pickupSugg, setPickupSugg, dropSugg, setDropSugg, dropHistory,
    appConfig,
    fareEstimates, setFareEstimates, fareLoading, eta, setEta, userCoords, setUserCoords,
    showPromoInput, setShowPromoInput, instantApplied, setInstantApplied, lastFetchKey,
    promoCode, setPromoCode, promoDiscount, setPromoDiscount,
    promoScreenCode, setPromoScreenCode, promoScreenMsg, setPromoScreenMsg,
    availablePromos, setAvailablePromos,
    rideData, setRideData, altSuggest, setAltSuggest,
    switchingVehicle, setSwitchingVehicle, driverLoc, setDriverLoc,
    driverEta, setDriverEta, driverDist, setDriverDist,
    showCancelModal, setShowCancelModal, cancelTimer, setCancelTimer,
    freeCancelsLeft, setFreeCancelsLeft, cancelInfo, setCancelInfo, bookTime, setBookTime,
    searchElapsed, setSearchElapsed, surgeCount, setSurgeCount,
    surgeFare, setSurgeFare, surging, setSurging, surgeBarAnim, surgeBarAnimRef,
    chatMsgs, setChatMsgs, chatInput, setChatInput, unreadChat, setUnreadChat, lastChatCount, chatToast, setChatToast,
    rating, setRating, tip, setTip, review, setReview,
    paymentDone, setPaymentDone, showUpiQr, setShowUpiQr, fareCount, setFareCount,
    scratchCard, setScratchCard, scratched, setScratched, scratchAnim, starAnims, sosActive, setSosActive,
    walletBalance, setWalletBalance, walletTxns, setWalletTxns, walletStats, setWalletStats,
    walletTxnTab, setWalletTxnTab, walletAddInput, setWalletAddInput,
    loyaltyPoints, setLoyaltyPoints, loyaltyCashback, setLoyaltyCashback,
    historyRides, setHistoryRides, activeOffers, setActiveOffers,
    offerDismissed, setOfferDismissed, referralData, setReferralData,
    referralInput, setReferralInput, savedPlaces, setSavedPlaces, customerRating, setCustomerRating,
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
    complaints, setComplaints, activeComplaint, setActiveComplaint,
    cmpType, setCmpType, cmpDesc, setCmpDesc, cmpMsg, setCmpMsg,
    cmpLoading, setCmpLoading, cmpDetail, setCmpDetail,
    cmpLinkedRide, setCmpLinkedRide, cmpHistoryRides, setCmpHistoryRides, cmpShowRidePicker, setCmpShowRidePicker,
    result, setResult, loading, setLoading, storeStatus,
    socketRef, phoneRef, pickupDebounceRef, dropDebounceRef, hPickupDebounceRef, hDropDebounceRef, buddyPUDebRef, buddyDRDebRef,
    sendOtp, verifyOtp, completeOnboarding, handleOtpChange, handleOtpKeyPress,
    connectSocket, joinRideSocket, joinHourlySocket,
    bookRide, surgeFareNow, switchVehicle, searchPlaces, geocodePlace, swapLocations,
    fetchEtaByCoords, loadFareEstimates, applyPromo, useMyLocation, calcDriverEta,
    handlePayment, payWithWallet, createScratchCard, scratchNow, addMoney, openRazorpayTopup,
    loadHistory, loadWallet, loadWalletDetail, loadLoyalty, loadOffers, loadHourlyPackages,
    loadReferral, loadSaved, loadFavouriteBuddy, addFavouriteBuddy, removeFavouriteBuddy, registerFCM,
    triggerSOS, applyReferral, shareReferral, savePlace, deletePlace,
    animateStar, sendChat, initiateCall, callDriver, rideIcon,
    rewardsDash, setRewardsDash, cashbackEarned, setCashbackEarned, loadRewardsDash,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
