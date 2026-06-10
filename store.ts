// ═══════════════════════════════════════════════
//  RIDE STORE — Zustand (single source of truth)
//  File: store.ts (App.tsx ke saath same folder mein)
//  - Saara ride state ek jagah
//  - SINGLE polling engine (4-5 intervals nahi, sirf 1)
//  - Stale data auto-clear
// ═══════════════════════════════════════════════
import { create } from 'zustand';
import { apiGet } from './api';

type RideState = {
  // Ride data
  rideId: string | null;
  rideStatus: string;          // idle | requested | matched | arrived | started | completed | cancelled
  rideData: any;
  driverInfo: any;
  driverLoc: any;
  startOtp: string;
  cancelMessage: string;

  // Polling engine
  _pollTimer: any;

  // Actions
  setRide: (data: any) => void;
  clearRide: () => void;
  startPolling: (phone: string) => void;
  stopPolling: () => void;
};

export const useRideStore = create<RideState>((set, get) => ({
  rideId: null,
  rideStatus: 'idle',
  rideData: null,
  driverInfo: null,
  driverLoc: null,
  startOtp: '',
  cancelMessage: '',
  _pollTimer: null,

  // ─── Naya ride set karo (purana sab clear) ───
  setRide: (data: any) => {
    get().stopPolling();
    set({
      rideId: data.ride_id,
      rideStatus: 'requested',
      rideData: data,
      driverInfo: null,
      driverLoc: null,
      startOtp: '',
      cancelMessage: '',
    });
  },

  // ─── Sab clear (stale data fix) ───
  clearRide: () => {
    get().stopPolling();
    set({
      rideId: null,
      rideStatus: 'idle',
      rideData: null,
      driverInfo: null,
      driverLoc: null,
      startOtp: '',
      cancelMessage: '',
    });
  },

  // ─── SINGLE POLLING ENGINE ───
  // Ek hi interval — ride status + driver location dono
  // 4 second mein ek baar, koi overlap nahi
  startPolling: (phone: string) => {
    const state = get();
    if (state._pollTimer) clearInterval(state._pollTimer);

    let polling = false; // overlap guard — ek call complete hone tak dusri nahi

    const timer = setInterval(async () => {
      if (polling) return; // pichli call abhi chal rahi hai — skip
      polling = true;
      try {
        const { rideId } = get();
        if (!rideId) { polling = false; return; }

        // Ride status
        const data = await apiGet(`/api/rides/status/${rideId}`);
        if (data._error || !data.ride) { polling = false; return; }
        const st = data.ride.status;

        // Driver location (sirf matched/arrived/started mein)
        if (['matched', 'arrived', 'started'].includes(st)) {
          const ld = await apiGet(`/api/rides/driver-location/${rideId}`);
          if (!ld._error && ld.location) set({ driverLoc: ld.location });
        }

        // Status transitions
        if (st === 'matched' || st === 'arrived') {
          set({
            rideStatus: st,
            startOtp: data.ride.start_otp || '',
            driverInfo: {
              name: data.ride.driver_name,
              phone: data.ride.driver_phone,
              vehicle_no: data.ride.vehicle_no,
            },
          });
        } else if (st === 'started') {
          set({ rideStatus: 'started' });
        } else if (st === 'completed') {
          set({ rideStatus: 'completed' });
          get().stopPolling();
        } else if (st === 'cancelled') {
          set({ rideStatus: 'cancelled', cancelMessage: 'Ride cancel ho gayi' });
          get().stopPolling();
        }
      } catch (_e) {}
      polling = false;
    }, 4000);

    set({ _pollTimer: timer });
  },

  stopPolling: () => {
    const t = get()._pollTimer;
    if (t) clearInterval(t);
    set({ _pollTimer: null });
  },
}));
