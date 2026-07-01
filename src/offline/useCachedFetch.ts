import { useCallback, useEffect, useRef, useState } from 'react';
import { Cache } from './cache';
import { useNetwork } from './useNetwork';

interface Options<T> {
  cacheKey: string;
  ttlMs: number;
  fetcher: () => Promise<T | null>;
  enabled?: boolean;           // default true
  refetchInterval?: number;    // auto-refresh ms (0 = disabled)
}

interface Result<T> {
  data: T | null;
  isStale: boolean;       // showing cached data, fresh fetch pending
  isLoading: boolean;     // no data at all yet
  isOffline: boolean;
  refetch: () => void;
  lastUpdated: number | null;
}

export function useCachedFetch<T>(opts: Options<T>): Result<T> {
  const { cacheKey, ttlMs, fetcher, enabled = true, refetchInterval = 0 } = opts;
  const { isOnline } = useNetwork();

  const [data, setData]           = useState<T | null>(() => Cache.getStale<T>(cacheKey));
  const [isStale, setIsStale]     = useState(() => Cache.isStale(cacheKey));
  const [isLoading, setIsLoading] = useState(!Cache.getStale<T>(cacheKey));
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const fetchingRef = useRef(false);

  const doFetch = useCallback(async () => {
    if (!isOnline || !enabled || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const fresh = await fetcher();
      if (fresh !== null && fresh !== undefined) {
        Cache.set(cacheKey, fresh, ttlMs);
        setData(fresh);
        setIsStale(false);
        setLastUpdated(Date.now());
      }
    } catch { /* network error — keep showing stale */ }
    finally { fetchingRef.current = false; setIsLoading(false); }
  }, [cacheKey, ttlMs, fetcher, isOnline, enabled]);

  // On mount: show stale immediately, fetch if stale or no data
  useEffect(() => {
    if (!enabled) return;
    const cached = Cache.get<T>(cacheKey);
    if (cached) {
      setData(cached); setIsStale(false); setIsLoading(false);
    } else if (Cache.getStale<T>(cacheKey)) {
      setIsStale(true); doFetch();
    } else {
      doFetch();
    }
  }, [cacheKey, enabled]);

  // Online restored → refetch if stale
  useEffect(() => {
    if (isOnline && isStale && enabled) doFetch();
  }, [isOnline]);

  // Auto-refresh interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;
    const id = setInterval(doFetch, refetchInterval);
    return () => clearInterval(id);
  }, [doFetch, refetchInterval, enabled]);

  return {
    data,
    isStale,
    isLoading: isLoading && !data,
    isOffline: !isOnline,
    refetch: doFetch,
    lastUpdated,
  };
}
