import { MMKV } from 'react-native-mmkv';

const mmkv = new MMKV();

// Drop-in async-compatible replacement for AsyncStorage backed by MMKV.
// MMKV is synchronous and ~30x faster — critical for app startup on low-end phones.
export const Storage = {
  getItem(key: string): Promise<string | null> {
    return Promise.resolve(mmkv.getString(key) ?? null);
  },
  setItem(key: string, value: string): Promise<void> {
    mmkv.set(key, value);
    return Promise.resolve();
  },
  removeItem(key: string): Promise<void> {
    mmkv.delete(key);
    return Promise.resolve();
  },
};
