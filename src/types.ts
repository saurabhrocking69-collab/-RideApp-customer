export type Screen =
  | 'splash' | 'login' | 'otp' | 'onboarding' | 'home'
  | 'booking' | 'matching' | 'inride' | 'payment' | 'postride'
  | 'chat' | 'referral' | 'saved' | 'policy' | 'hourly'
  | 'wallet' | 'hourly-info' | 'promo' | 'support' | 'safety'
  | 'complaints' | 'complaint-new' | 'complaint-detail'
  | 'rewards' | 'scheduled' | 'budget';

export type Tab = 'home' | 'live' | 'history' | 'profile';

export type Coords = { lat: number; lng: number } | null;

export type HourlyStep = 'book' | 'waiting' | 'active' | 'done';
export type ExtendStep = 'idle' | 'choose' | 'pending';
export type WalletTxnTab = 'all' | 'earn' | 'spend' | 'reward';
