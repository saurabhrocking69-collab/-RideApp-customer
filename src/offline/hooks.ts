import { useCallback } from 'react';
import { useCachedFetch } from './useCachedFetch';
import { Cache, KEY, TTL } from './cache';
import { API } from '../constants';

// ── Nearby Drivers ────────────────────────────────────────────────────────────
export function useNearbyDrivers(lat?: number | null, lng?: number | null) {
  const fetcher = useCallback(async () => {
    if (!lat || !lng) return null;
    const r = await fetch(`${API}/api/rides/nearby-drivers?lat=${lat}&lng=${lng}`);
    const d = await r.json();
    return Array.isArray(d.drivers) ? d.drivers : null;
  }, [lat, lng]);

  return useCachedFetch({
    cacheKey: lat && lng ? KEY.nearbyDrivers(lat, lng) : '__no_loc',
    ttlMs: TTL.NEARBY_DRIVERS,
    fetcher,
    enabled: !!(lat && lng),
    refetchInterval: 20_000,
  });
}

// ── Fare Estimate ─────────────────────────────────────────────────────────────
export function useFareEstimate(phone: string, pickup: string, drop: string, pickupCoords: any, dropCoords: any) {
  const fetcher = useCallback(async () => {
    if (!phone || !pickup || !drop || !pickupCoords || !dropCoords) return null;
    const r = await fetch(`${API}/api/rides/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, pickup, drop, pickup_lat: pickupCoords.lat, pickup_lng: pickupCoords.lng, drop_lat: dropCoords.lat, drop_lng: dropCoords.lng }),
    });
    const d = await r.json();
    return d._error ? null : d;
  }, [phone, pickup, drop, pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng]);

  return useCachedFetch({
    cacheKey: pickup && drop ? KEY.fareEstimate(pickup, drop) : '__no_route',
    ttlMs: TTL.FARE_ESTIMATE,
    fetcher,
    enabled: !!(phone && pickup && drop && pickupCoords && dropCoords),
  });
}

// ── Ride History ──────────────────────────────────────────────────────────────
export function useRideHistory(phone?: string) {
  const fetcher = useCallback(async () => {
    if (!phone) return null;
    const r = await fetch(`${API}/api/rides/history?phone=${phone}&limit=20`);
    const d = await r.json();
    return Array.isArray(d.rides) ? d.rides : null;
  }, [phone]);

  return useCachedFetch({
    cacheKey: KEY.rideHistory,
    ttlMs: TTL.RIDE_HISTORY,
    fetcher,
    enabled: !!phone,
    refetchInterval: 0,
  });
}

// ── Wallet Balance ────────────────────────────────────────────────────────────
export function useWalletBalance(phone?: string) {
  const fetcher = useCallback(async () => {
    if (!phone) return null;
    const r = await fetch(`${API}/api/wallet/balance?phone=${phone}`);
    const d = await r.json();
    return d.balance != null ? d : null;
  }, [phone]);

  return useCachedFetch({
    cacheKey: phone ? KEY.walletBalance(phone) : '__no_phone',
    ttlMs: TTL.WALLET_BALANCE,
    fetcher,
    enabled: !!phone,
    refetchInterval: 60_000,
  });
}

// ── App Config ────────────────────────────────────────────────────────────────
export function useAppConfig() {
  const fetcher = useCallback(async () => {
    const r = await fetch(`${API}/api/config`);
    const d = await r.json();
    return d._error ? null : d;
  }, []);

  return useCachedFetch({
    cacheKey: KEY.appConfig,
    ttlMs: TTL.APP_CONFIG,
    fetcher,
    refetchInterval: 0,
  });
}

// ── Promo List ────────────────────────────────────────────────────────────────
export function usePromoList(phone?: string) {
  const fetcher = useCallback(async () => {
    if (!phone) return null;
    const r = await fetch(`${API}/api/promos/available?phone=${phone}`);
    const d = await r.json();
    return Array.isArray(d.promos) ? d.promos : null;
  }, [phone]);

  return useCachedFetch({
    cacheKey: phone ? KEY.promoList(phone) : '__no_phone',
    ttlMs: TTL.PROMO_LIST,
    fetcher,
    enabled: !!phone,
  });
}

// ── Drop History (permanent, MMKV direct) ─────────────────────────────────────
export const DropHistoryCache = {
  get(): { text: string; coords: { lat: number; lng: number } | null }[] {
    return Cache.getStale(KEY.dropHistory) ?? [];
  },
  add(item: { text: string; coords: { lat: number; lng: number } | null }): void {
    const h = DropHistoryCache.get().filter(x => x.text !== item.text);
    h.unshift(item);
    Cache.set(KEY.dropHistory, h.slice(0, 10), TTL.DROP_HISTORY);
  },
};
