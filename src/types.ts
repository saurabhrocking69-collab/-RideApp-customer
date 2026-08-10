export type Screen =
  | 'splash' | 'login' | 'otp' | 'onboarding' | 'language-select' | 'home'
  | 'booking' | 'matching' | 'inride' | 'payment' | 'postride'
  | 'chat' | 'partner' | 'saved' | 'policy' | 'hourly'
  | 'wallet' | 'hourly-info' | 'promo' | 'support' | 'safety'
  | 'rewards' | 'budget' | 'surge' | 'insights' | 'tier'
  | 'tickets' | 'ticket-new' | 'fare-rates'
  | 'scheduled-rides' | 'scheduled-detail' | 'intercity' | 'parcel' | 'parcel-intro'
  | 'welcome';

export type Tab = 'home' | 'live' | 'history' | 'profile';

export type Coords = { lat: number; lng: number } | null;

export type HourlyStep = 'book' | 'waiting' | 'active' | 'done';
export type ExtendStep = 'idle' | 'choose' | 'pending';
export type WalletTxnTab = 'all' | 'earn' | 'spend' | 'reward';
