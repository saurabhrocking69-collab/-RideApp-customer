import { MMKV } from 'react-native-mmkv';

const store = new MMKV({ id: 'sppero-cache' });

interface CacheEntry<T> {
  data: T;
  ts: number;   // stored at
  ttl: number;  // ms until stale
}

export const Cache = {
  // Write with TTL
  set<T>(key: string, data: T, ttlMs: number): void {
    const entry: CacheEntry<T> = { data, ts: Date.now(), ttl: ttlMs };
    store.set(key, JSON.stringify(entry));
  },

  // Read — returns null if missing or expired
  get<T>(key: string): T | null {
    const raw = store.getString(key);
    if (!raw) return null;
    try {
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() - entry.ts > entry.ttl) return null;
      return entry.data;
    } catch { return null; }
  },

  // Read stale too — used for "show while refreshing" pattern
  getStale<T>(key: string): T | null {
    const raw = store.getString(key);
    if (!raw) return null;
    try { return (JSON.parse(raw) as CacheEntry<T>).data; } catch { return null; }
  },

  isStale(key: string): boolean {
    const raw = store.getString(key);
    if (!raw) return true;
    try {
      const entry: CacheEntry<unknown> = JSON.parse(raw);
      return Date.now() - entry.ts > entry.ttl;
    } catch { return true; }
  },

  del(key: string): void { store.delete(key); },

  clear(): void { store.clearAll(); },
};

// TTL constants (ms)
export const TTL = {
  NEARBY_DRIVERS:   5  * 60 * 1000,   // 5 min
  FARE_ESTIMATE:    10 * 60 * 1000,   // 10 min
  RIDE_HISTORY:     30 * 60 * 1000,   // 30 min
  WALLET_BALANCE:   2  * 60 * 1000,   // 2 min
  APP_CONFIG:       60 * 60 * 1000,   // 1 hr
  PROMO_LIST:       15 * 60 * 1000,   // 15 min
  USER_PROFILE:     24 * 60 * 60 * 1000, // 24 hr
  DROP_HISTORY:     Infinity,          // permanent
};

// Typed cache keys
export const KEY = {
  nearbyDrivers: (lat: number, lng: number) =>
    `nearby:${Math.round(lat * 100)}:${Math.round(lng * 100)}`,
  fareEstimate: (pickup: string, drop: string) =>
    `fare:${pickup}:${drop}`,
  rideHistory:   'ride:history',
  walletBalance: (phone: string) => `wallet:${phone}`,
  appConfig:     'app:config',
  promoList:     (phone: string) => `promos:${phone}`,
  userProfile:   (phone: string) => `profile:${phone}`,
  dropHistory:   'drop:history',
  driverInfo:    (rideId: string) => `driver:${rideId}`,
};
