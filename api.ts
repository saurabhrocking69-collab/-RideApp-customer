// ═══════════════════════════════════════════════
//  SMART API LAYER — timeout + retry + error handling
//  File: api.ts (App.tsx ke saath same folder mein)
// ═══════════════════════════════════════════════

export const API = 'https://api.sppero.com';

// ─── Fetch with timeout (10 sec default) ───
const fetchWithTimeout = async (url: string, options: any = {}, timeout = 10000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
};

// ─── Smart API call: timeout + 2 retries + JSON parse ───
// Kabhi hang nahi hoga — max 10s + retry, phir error return
export const apiGet = async (path: string, retries = 2): Promise<any> => {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchWithTimeout(`${API}${path}`, {}, 10000);
      return await res.json();
    } catch (err) {
      if (i === retries) return { _error: true, message: 'Network error' };
      await new Promise(r => setTimeout(r, 800)); // 800ms gap, phir retry
    }
  }
  return { _error: true, message: 'Network error' };
};

export const apiPost = async (path: string, body: any, retries = 1): Promise<any> => {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchWithTimeout(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, 10000);
      return await res.json();
    } catch (err) {
      if (i === retries) return { _error: true, message: 'Network error — dobara try karo' };
      await new Promise(r => setTimeout(r, 800));
    }
  }
  return { _error: true, message: 'Network error — dobara try karo' };
};

// ─── Auth-aware helpers (include Bearer token from AsyncStorage) ───
// Use these for JWT-protected endpoints like /api/complaints, /api/wallet, etc.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const apiAuthGet = async (path: string, token: string, retries = 2): Promise<any> => {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchWithTimeout(`${API}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 12000);
      return await res.json();
    } catch (err) {
      if (i === retries) return { _error: true, message: 'Network error' };
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return { _error: true, message: 'Network error' };
};

export const apiAuthPost = async (path: string, body: any, token: string, retries = 2): Promise<any> => {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchWithTimeout(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }, 12000);
      return await res.json();
    } catch (err) {
      if (i === retries) return { _error: true, message: 'Network error — dobara try karo' };
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return { _error: true, message: 'Network error — dobara try karo' };
};

// ─── External API (Google Maps etc) with timeout ───
export const externalGet = async (url: string): Promise<any> => {
  try {
    const res = await fetchWithTimeout(url, {}, 8000);
    return await res.json();
  } catch (err) {
    return { _error: true };
  }
};
