import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { SchedulePickerSheet, ScheduleResult } from '../components/SchedulePickerSheet';
import { apiPost } from '../../api';
import { C } from '../styles';

const BLUE    = '#2563EB';
const BLUE_BG = '#EFF6FF';
const BLUE_BD = '#BFDBFE';

const VEHICLE_EMOJI: Record<string, string> = { car: '🚕', luxury: '🚙' };

// Mirrors the backend's ADVANCE_THRESHOLD/ADVANCE_FRACTION (services/advance.js)
// — display-only math so the review screen can show the exact amounts before
// Razorpay opens; the server always recomputes and is the source of truth.
const ADVANCE_THRESHOLD = 3000;
const ADVANCE_FRACTION  = 1 / 3;

type TripKind = 'oneway' | 'round';

type EstOption = {
  vehicle_type: string; label: string; vehicle_desc: string; seats: number;
  fare: number; base_fare: number; dist_fare: number; per_km_rate: number;
  billed_km: number; driver_allowance: number; night_halt: number; trip_days: number;
};

export function IntercityScreen() {
  const insets = useSafeAreaInsets();
  const {
    setScreen, pickup, drop, intercityRoute, bookIntercity, loading,
  } = useApp() as any;

  const [tripKind, setTripKind]   = useState<TripKind>('oneway');
  const [leaveMode, setLeaveMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState<ScheduleResult | null>(null);
  const [returnAt, setReturnAt]       = useState<ScheduleResult | null>(null);
  const [showLeavePicker, setShowLeavePicker]   = useState(false);
  const [showReturnPicker, setShowReturnPicker] = useState(false);
  const [selVehicle, setSelVehicle] = useState<'car' | 'luxury'>('car');
  const [estimates, setEstimates]   = useState<Record<TripKind, EstOption[]>>({ oneway: [], round: [] });
  const [estLoading, setEstLoading] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const km     = intercityRoute?.km ?? 0;
  const durMin = intercityRoute?.durationMin ?? 0;
  const hrs    = Math.floor(durMin / 60);
  const mins   = Math.round(durMin % 60);

  const loadEstimates = useCallback(async () => {
    if (!km) return;
    setEstLoading(true);
    try {
      const [ow, rt] = await Promise.all([
        apiPost('/api/intercity/estimate', { distance: km, trip_kind: 'oneway' }),
        apiPost('/api/intercity/estimate', {
          distance: km, trip_kind: 'round',
          leave_at: scheduledAt?.iso || new Date().toISOString(),
          return_at: returnAt?.iso || null,
        }),
      ]);
      setEstimates({
        oneway: ow?.options || [],
        round:  rt?.options || [],
      });
    } catch (_e) {}
    setEstLoading(false);
  }, [km, scheduledAt?.iso, returnAt?.iso]);

  useEffect(() => { loadEstimates(); }, [loadEstimates]);

  const options = estimates[tripKind];
  const selOpt  = options.find(o => o.vehicle_type === selVehicle);
  const fromFare = (k: TripKind) => {
    const opts = estimates[k];
    return opts.length ? Math.min(...opts.map(o => o.fare)) : null;
  };

  const validateTimes = (): boolean => {
    if (leaveMode === 'later' && !scheduledAt) { Alert.alert('Pick departure time', 'Choose when your trip starts.'); return false; }
    if (tripKind === 'round' && !returnAt) { Alert.alert('Pick return time', 'Choose when your round trip ends.'); return false; }
    if (tripKind === 'round' && returnAt) {
      const leaveMs = leaveMode === 'later' && scheduledAt ? new Date(scheduledAt.iso).getTime() : Date.now();
      if (new Date(returnAt.iso).getTime() <= leaveMs) {
        Alert.alert('Invalid return time', 'Return must be after departure.'); return false;
      }
    }
    return true;
  };

  const handleBook = async () => {
    if (loading) return;
    if (!validateTimes()) return;
    await bookIntercity({
      vehicleType: selVehicle,
      tripKind,
      fare: selOpt?.fare,
      scheduledAt: leaveMode === 'later' ? scheduledAt?.iso : null,
      returnAt: tripKind === 'round' ? returnAt?.iso : null,
    });
  };

  if (!intercityRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🛣️</Text>
        <Text style={{ color: C.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
          Select a pickup and drop over 80 km apart to plan an intercity trip.
        </Text>
        <TouchableOpacity onPress={() => setScreen('booking')} style={{ backgroundColor: BLUE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Back to Booking</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#fff',
        paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20,
        borderBottomWidth: 1, borderBottomColor: C.glassBorder,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        elevation: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
      }}>
        <TouchableOpacity onPress={() => setScreen('booking')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>Plan your Intercity trip</Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {Math.round(km)} km · ~{hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`} · Cars only
          </Text>
        </View>
        <View style={{ backgroundColor: BLUE_BG, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: BLUE_BD }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: BLUE }}>🛣️ Intercity</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* One way / Round trip toggle */}
        <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.glassBorder, padding: 4, marginBottom: 14 }}>
          {(['oneway', 'round'] as TripKind[]).map(k => {
            const active = tripKind === k;
            const from = fromFare(k);
            return (
              <TouchableOpacity
                key={k}
                onPress={() => setTripKind(k)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center',
                  backgroundColor: active ? BLUE : 'transparent',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '900', color: active ? '#fff' : C.text }}>
                  {k === 'oneway' ? 'One way' : 'Round trip'}
                </Text>
                <Text style={{ fontSize: 10, fontWeight: '600', color: active ? 'rgba(255,255,255,0.85)' : C.textMuted, marginTop: 1 }}>
                  {from ? `Starting at ₹${from}` : '—'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Route card */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.glassBorder, padding: 14, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginTop: 5 }} />
            <Text style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: '700' }} numberOfLines={1}>{pickup}</Text>
          </View>
          <View style={{ width: 1.5, height: 14, backgroundColor: C.glassBorder, marginLeft: 3.5, marginVertical: 2 }} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: C.red, marginTop: 5 }} />
            <Text style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: '700' }} numberOfLines={1}>{drop}</Text>
          </View>
        </View>

        {/* Departure + return */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.glassBorder, marginBottom: 14, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
            <Ionicons name="time-outline" size={18} color={C.textMuted} />
            <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, fontWeight: '700', color: C.text }}>
              {leaveMode === 'now' ? 'Leave now' : (scheduledAt?.label || 'Pick departure time')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={() => { setLeaveMode('now'); setScheduledAt(null); }}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9, borderWidth: 1,
                  backgroundColor: leaveMode === 'now' ? BLUE_BG : '#fff',
                  borderColor: leaveMode === 'now' ? BLUE : C.glassBorder,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: leaveMode === 'now' ? BLUE : C.textMuted }}>Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowLeavePicker(true)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9, borderWidth: 1,
                  backgroundColor: leaveMode === 'later' ? BLUE_BG : '#fff',
                  borderColor: leaveMode === 'later' ? BLUE : C.glassBorder,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: leaveMode === 'later' ? BLUE : C.textMuted }}>📅 Later</Text>
              </TouchableOpacity>
            </View>
          </View>

          {tripKind === 'round' && (
            <TouchableOpacity
              onPress={() => setShowReturnPicker(true)}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: 1, borderTopColor: C.glassBorder }}
            >
              <Ionicons name="return-down-back-outline" size={18} color={C.textMuted} />
              <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, fontWeight: '700', color: returnAt ? C.text : C.textMuted }}>
                {returnAt ? `Return by ${returnAt.label}` : 'Pick return time'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={C.textDim} />
            </TouchableOpacity>
          )}
        </View>

        {/* Vehicle options */}
        <Text style={{ fontSize: 13, fontWeight: '900', color: C.text, marginBottom: 8, marginLeft: 2 }}>Choose your car</Text>
        {estLoading ? (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={BLUE} />
          </View>
        ) : options.map(o => {
          const active = selVehicle === o.vehicle_type;
          return (
            <TouchableOpacity
              key={o.vehicle_type}
              activeOpacity={0.85}
              onPress={() => { setSelVehicle(o.vehicle_type as 'car' | 'luxury'); setShowBreakdown(true); }}
              style={{
                backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
                borderWidth: active ? 2 : 1, borderColor: active ? BLUE : C.glassBorder,
                flexDirection: 'row', alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 30, marginRight: 12 }}>{VEHICLE_EMOJI[o.vehicle_type] || '🚗'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: C.text }}>{o.label}  <Text style={{ fontSize: 11, color: C.textMuted }}>👤 {o.seats}</Text></Text>
                <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{o.vehicle_desc}</Text>
                <Text style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
                  {o.billed_km} km included · ₹{o.per_km_rate}/km
                </Text>
              </View>
              <Text style={{ fontSize: 17, fontWeight: '900', color: C.text }}>₹{o.fare}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Price breakdown */}
        {selOpt && showBreakdown && (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.glassBorder, padding: 14, marginTop: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '900', color: C.text, marginBottom: 8 }}>Price breakdown</Text>
            {[
              ['Base price', `₹${selOpt.base_fare}`],
              [`Distance (${selOpt.billed_km} km × ₹${selOpt.per_km_rate})`, `₹${selOpt.dist_fare}`],
              [`Driver allowance${selOpt.trip_days > 1 ? ` (${selOpt.trip_days} days)` : ''}`, `₹${selOpt.driver_allowance}`],
              ...(selOpt.night_halt > 0 ? [['Night halt', `₹${selOpt.night_halt}`]] : []),
            ].map(([l, v]) => (
              <View key={l as string} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ fontSize: 12, color: C.textMuted }}>{l}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>{v}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: C.glassBorder, marginVertical: 8 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: C.text }}>Total price</Text>
              <Text style={{ fontSize: 15, fontWeight: '900', color: C.text }}>₹{selOpt.fare}</Text>
            </View>
            <View style={{ backgroundColor: BLUE_BG, borderRadius: 10, padding: 10, marginTop: 10 }}>
              {['🛂 Tolls & interstate charges extra — pay driver directly', '🅿️ Parking charges extra', '🧾 Taxes not included'].map(n => (
                <Text key={n} style={{ fontSize: 10.5, color: '#1E40AF', marginBottom: 2 }}>{n}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Payment & cancellation policy — shown once a vehicle is picked */}
        {selOpt && (() => {
          const highValue = selOpt.fare > ADVANCE_THRESHOLD;
          const advanceAmt = Math.round(selOpt.fare * ADVANCE_FRACTION);
          const remaining  = selOpt.fare - advanceAmt;
          return (
            <View style={{
              backgroundColor: '#fff', borderRadius: 14, borderWidth: 1,
              borderColor: highValue ? BLUE_BD : C.glassBorder,
              padding: 14, marginTop: 12, overflow: 'hidden',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Ionicons name={highValue ? 'shield-checkmark' : 'cash-outline'} size={16} color={highValue ? BLUE : C.textMuted} />
                <Text style={{ fontSize: 13, fontWeight: '900', color: C.text }}>
                  {highValue ? 'Advance payment required' : 'How you pay'}
                </Text>
              </View>

              {highValue ? (
                <>
                  <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 18, marginBottom: 10 }}>
                    This trip is over ₹{ADVANCE_THRESHOLD} — pay <Text style={{ fontWeight: '900', color: BLUE }}>₹{advanceAmt} now</Text> (1/3 of the fare) online to confirm your driver, and the remaining <Text style={{ fontWeight: '900', color: C.text }}>₹{remaining}</Text> to your driver in cash when the trip ends.
                  </Text>
                  <View style={{ backgroundColor: BLUE_BG, borderRadius: 10, padding: 10, gap: 4 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#1E40AF', marginBottom: 2 }}>Cancellation refund policy</Text>
                    {[
                      'Full refund if no driver is matched yet, or the driver cancels',
                      'Full refund if you cancel within 3 min of being matched',
                      '₹100 charge if you cancel after that grace period',
                      '₹300 charge if you cancel after the driver has arrived',
                    ].map(n => (
                      <View key={n} style={{ flexDirection: 'row', gap: 5 }}>
                        <Text style={{ fontSize: 10.5, color: '#1E40AF' }}>•</Text>
                        <Text style={{ flex: 1, fontSize: 10.5, color: '#1E40AF', lineHeight: 15 }}>{n}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 18 }}>
                  No advance needed for this trip — pay the full fare <Text style={{ fontWeight: '900', color: C.text }}>₹{selOpt.fare}</Text> directly to your driver in cash when the trip ends.
                </Text>
              )}
            </View>
          );
        })()}

        {/* Trust row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 }}>
          {[['⭐', 'Top-rated\ndrivers'], ['🎧', '24/7 live\nsupport'], ['⚡', 'Quick\nconfirmation']].map(([e, l]) => (
            <View key={l} style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 20 }}>{e}</Text>
              <Text style={{ fontSize: 10, color: C.textMuted, textAlign: 'center', marginTop: 3 }}>{l}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Book CTA */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff', padding: 16, paddingBottom: Math.max(insets.bottom, 16),
        borderTopWidth: 1, borderTopColor: C.glassBorder,
      }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { if (validateTimes()) setShowReview(true); }}
          disabled={loading || estLoading || !selOpt}
          style={{
            backgroundColor: loading || estLoading || !selOpt ? '#9CA3AF' : BLUE,
            borderRadius: 16, paddingVertical: 16, alignItems: 'center',
            elevation: 6, shadowColor: BLUE, shadowOpacity: 0.35, shadowRadius: 12,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>
              {selOpt ? `Review trip — ₹${selOpt.fare}` : 'Book Intercity'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Review trip — Uber-style confirm sheet, shown before the actual booking call ── */}
      <Modal visible={showReview} transparent animationType="slide" onRequestClose={() => setShowReview(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => !loading && setShowReview(false)} />
          <View style={{
            backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26,
            maxHeight: '86%', paddingBottom: Math.max(insets.bottom, 16),
          }}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassB2 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '900', color: C.text }}>Review your trip</Text>
                <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Check the details before you confirm</Text>
              </View>
              <TouchableOpacity onPress={() => !loading && setShowReview(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close-circle" size={26} color={C.textDim} />
              </TouchableOpacity>
            </View>
            <View style={{ height: 1, backgroundColor: C.glassBorder }} />

            {selOpt && (
              <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
                {/* Route */}
                <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.glassBorder, padding: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginTop: 5 }} />
                    <Text style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: '700' }} numberOfLines={2}>{pickup}</Text>
                  </View>
                  <View style={{ width: 1.5, height: 14, backgroundColor: C.glassBorder, marginLeft: 3.5, marginVertical: 2 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: C.red, marginTop: 5 }} />
                    <Text style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: '700' }} numberOfLines={2}>{drop}</Text>
                  </View>
                  <Text style={{ fontSize: 10.5, color: C.textDim, marginTop: 8 }}>
                    {Math.round(km)} km · ~{hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}
                  </Text>
                </View>

                {/* Trip details */}
                <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.glassBorder, padding: 14, gap: 10 }}>
                  {[
                    ['Trip type', tripKind === 'oneway' ? 'One way' : 'Round trip'],
                    ['Vehicle', `${VEHICLE_EMOJI[selOpt.vehicle_type] || '🚗'} ${selOpt.label} · ${selOpt.seats} seats`],
                    ['Departure', leaveMode === 'now' ? 'Now' : (scheduledAt?.label || '—')],
                    ...(tripKind === 'round' ? [['Return', returnAt?.label || '—']] : []),
                  ].map(([l, v]) => (
                    <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: C.textMuted }}>{l}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: C.text }}>{v}</Text>
                    </View>
                  ))}
                </View>

                {/* Fare breakdown */}
                <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.glassBorder, padding: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: C.text, marginBottom: 8 }}>Price breakdown</Text>
                  {[
                    ['Base price', `₹${selOpt.base_fare}`],
                    [`Distance (${selOpt.billed_km} km × ₹${selOpt.per_km_rate})`, `₹${selOpt.dist_fare}`],
                    [`Driver allowance${selOpt.trip_days > 1 ? ` (${selOpt.trip_days} days)` : ''}`, `₹${selOpt.driver_allowance}`],
                    ...(selOpt.night_halt > 0 ? [['Night halt', `₹${selOpt.night_halt}`]] : []),
                  ].map(([l, v]) => (
                    <View key={l as string} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={{ fontSize: 12, color: C.textMuted }}>{l}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>{v}</Text>
                    </View>
                  ))}
                  <View style={{ height: 1, backgroundColor: C.glassBorder, marginVertical: 8 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: C.text }}>Total price</Text>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: C.text }}>₹{selOpt.fare}</Text>
                  </View>
                </View>

                {/* Payment terms — same rule copy as the main screen, restated at the point of confirmation */}
                {(() => {
                  const highValue = selOpt.fare > ADVANCE_THRESHOLD;
                  const advanceAmt = Math.round(selOpt.fare * ADVANCE_FRACTION);
                  const remaining  = selOpt.fare - advanceAmt;
                  return (
                    <View style={{
                      backgroundColor: highValue ? BLUE_BG : '#fff', borderRadius: 14,
                      borderWidth: 1, borderColor: highValue ? BLUE_BD : C.glassBorder, padding: 14,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Ionicons name={highValue ? 'shield-checkmark' : 'cash-outline'} size={16} color={highValue ? BLUE : C.textMuted} />
                        <Text style={{ fontSize: 12.5, fontWeight: '900', color: highValue ? '#1E40AF' : C.text }}>
                          {highValue ? `Pay ₹${advanceAmt} advance now` : `Pay ₹${selOpt.fare} in cash`}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11.5, color: highValue ? '#1E40AF' : C.textMuted, lineHeight: 17 }}>
                        {highValue
                          ? `This trip is over ₹${ADVANCE_THRESHOLD}. Tapping confirm opens Razorpay to collect the ₹${advanceAmt} advance (1/3 of the fare); the remaining ₹${remaining} is paid to your driver in cash at drop.`
                          : 'No advance needed — the full fare is paid to your driver in cash when the trip ends.'}
                      </Text>
                    </View>
                  );
                })()}

                <View style={{ backgroundColor: BLUE_BG, borderRadius: 10, padding: 10 }}>
                  {['🛂 Tolls & interstate charges extra — pay driver directly', '🅿️ Parking charges extra', '🧾 Taxes not included'].map(n => (
                    <Text key={n} style={{ fontSize: 10.5, color: '#1E40AF', marginBottom: 2 }}>{n}</Text>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* Confirm footer */}
            <View style={{ padding: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.glassBorder }}>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={loading || !selOpt}
                onPress={handleBook}
                style={{
                  backgroundColor: loading || !selOpt ? '#9CA3AF' : BLUE,
                  borderRadius: 16, paddingVertical: 16, alignItems: 'center',
                  elevation: 6, shadowColor: BLUE, shadowOpacity: 0.35, shadowRadius: 12,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>
                    {selOpt && selOpt.fare > ADVANCE_THRESHOLD
                      ? `Confirm & Pay ₹${Math.round(selOpt.fare * ADVANCE_FRACTION)} Advance`
                      : `Confirm Booking — ₹${selOpt?.fare ?? ''}`}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Departure picker */}
      <SchedulePickerSheet
        visible={showLeavePicker}
        onClose={() => setShowLeavePicker(false)}
        onConfirm={(r) => { setScheduledAt(r); setLeaveMode('later'); setShowLeavePicker(false); }}
      />
      {/* Return picker */}
      <SchedulePickerSheet
        visible={showReturnPicker}
        onClose={() => setShowReturnPicker(false)}
        onConfirm={(r) => { setReturnAt(r); setShowReturnPicker(false); }}
      />
    </View>
  );
}
