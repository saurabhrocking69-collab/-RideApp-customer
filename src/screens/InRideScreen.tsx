import { useRef, useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, Share, Text, TouchableOpacity, View, Animated, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useApp } from '../context/AppContext';
import { GlassPanel, MapOverlay, PulseView } from '../components/ui';
import { API } from '../constants';
import { LiveMap } from '../components/LiveMap';
import { s, C, T, SP, R } from '../styles';

function InlineSOSButton({ onActivate, active }: { onActivate: () => void; active: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;
  const scale    = useRef(new Animated.Value(1)).current;
  const holdRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef  = useRef<Animated.CompositeAnimation | null>(null);
  const [holding, setHolding] = useState(false);

  const startHold = () => {
    if (active) return;
    setHolding(true);
    Vibration.vibrate(60);
    animRef.current = Animated.parallel([
      Animated.timing(progress, { toValue: 1, duration: 2000, useNativeDriver: false }),
      Animated.timing(scale, { toValue: 0.97, duration: 200, useNativeDriver: true }),
    ]);
    animRef.current.start();
    holdRef.current = setTimeout(() => {
      Vibration.vibrate([0, 100, 80, 100]);
      onActivate();
    }, 2000);
  };

  const cancelHold = () => {
    if (active) return;
    setHolding(false);
    if (holdRef.current) clearTimeout(holdRef.current);
    animRef.current?.stop();
    Animated.timing(progress, { toValue: 0, duration: 250, useNativeDriver: false }).start();
    Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };

  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 10 }}>
      <TouchableOpacity activeOpacity={1} onPressIn={startHold} onPressOut={cancelHold}>
        <Animated.View style={{
          borderRadius: 18, flexDirection: 'row', alignItems: 'center',
          paddingVertical: 14, paddingHorizontal: 18, gap: 12, overflow: 'hidden',
          backgroundColor: active ? 'rgba(239,68,68,0.22)' : C.redGlass,
          borderWidth: 1.5, borderColor: C.red,
          elevation: active ? 12 : 5,
          shadowColor: C.red, shadowOpacity: active ? 0.55 : 0.28, shadowRadius: 12,
        }}>
          {holding && !active && (
            <Animated.View style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              backgroundColor: 'rgba(239,68,68,0.18)', width: fillWidth,
            }} />
          )}
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(239,68,68,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.red }}>
            <Ionicons name="warning" size={22} color={C.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.red, fontSize: 13, fontWeight: '900' }}>
              {active ? '🆘 Alert Sent!' : holding ? 'Sending SOS...' : 'Hold for Emergency SOS'}
            </Text>
            <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>
              {active ? 'Police: 100 · Ambulance: 108' : 'Hold 2s · Alerts police + emergency contacts'}
            </Text>
          </View>
          {!active && !holding && (
            <View style={{ backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>HOLD</Text>
            </View>
          )}
          {holding && !active && (
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(239,68,68,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.red }}>
              <Text style={{ color: C.red, fontWeight: '900', fontSize: 11 }}>2s</Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function formatElapsed(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const VEHICLE_EMOJI: Record<string, string> = {
  auto: '🛺', bike: '🏍️', car: '🚗', suv: '🚙', mini: '🚗',
};

const ISSUE_CHIPS = ['Demanded extra cash', 'Rash driving', 'Wrong vehicle', 'No issues'] as const;

export function InRideScreen() {
  const {
    pickup, drop,
    pickupCoords, dropCoords,
    driverLoc, driverEta, driverDist,
    rideData, rideType,
    sosActive, setSosActive, sosOutcome, triggerSOS, reportCancelRide, returnDecision, payReturnFare,
    reportParcelNotDelivered,
  } = useApp();

  // ── Reporting a parcel that isn't being delivered ────────────────────────
  // Reportable mid-trip, not just after completion: a driver deliberately
  // sitting on a package never completes the ride, so a completed-only report
  // was useless in exactly the case it exists for. Filing it freezes the
  // escrow so the driver can't collect while it's under review.
  const [parcelReportRes, setParcelReportRes] = useState<any>(null);
  const [reportingParcel, setReportingParcel] = useState(false);
  const PARCEL_PROBLEMS = [
    'Driver is not delivering my parcel',
    'Driver is not answering calls',
    'Driver went the wrong way',
    'I think my parcel is lost',
  ];
  const fileParcelReport = async (reason: string) => {
    if (!rideData?.ride_id || reportingParcel) return;
    setReportingParcel(true);
    try {
      const res = await reportParcelNotDelivered(rideData.ride_id, reason);
      if (res?.success) setParcelReportRes(res);
      else Alert.alert('Could not report', res?.error || 'Please try again.');
    } catch (_e) {
      Alert.alert('Network', 'Could not reach the server — please try again.');
    } finally { setReportingParcel(false); }
  };
  const promptParcelReport = () => {
    Alert.alert(
      '⚠️ Problem with this delivery?',
      "Our team will review it, and your payment is put on hold straight away so it can't be released to the driver while we look.",
      [
        { text: 'Cancel', style: 'cancel' },
        ...PARCEL_PROBLEMS.map(r => ({ text: r, onPress: () => fileParcelReport(r) })),
      ]
    );
  };

  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const handleReturnDecision = async (decision: 'retry' | 'return') => {
    if (!rideData?.ride_id || returnSubmitting) return;
    setReturnSubmitting(true);
    await returnDecision(rideData.ride_id, decision);
    setReturnSubmitting(false);
  };

  const [payingReturn, setPayingReturn] = useState(false);
  const [payReturnErr, setPayReturnErr] = useState('');
  // Guard set synchronously, before any await — `disabled` lags a render
  // behind, so a fast double-tap would otherwise fire two charges.
  const payingReturnRef = useRef(false);
  const handlePayReturn = async () => {
    if (!rideData?.ride_id || payingReturnRef.current) return;
    payingReturnRef.current = true;
    setPayingReturn(true); setPayReturnErr('');
    try {
      const res = await payReturnFare(rideData.ride_id, 'wallet');
      if (!res?.success) {
        setPayReturnErr(
          res?.error === 'Not enough wallet balance'
            ? `Not enough wallet balance — you need ₹${Math.round(res?.required || rideData?.returnFare || 0)}. Top up and try again.`
            : (res?.error || 'Payment failed — please try again.')
        );
      }
    } catch (_e) {
      setPayReturnErr('Could not reach the server — please try again.');
    } finally {
      payingReturnRef.current = false;
      setPayingReturn(false);
    }
  };

  const REPORT_REASONS = ['Medical emergency', 'Feeling unsafe', 'Driver misbehaviour', 'Wrong route / detour', 'Other emergency'];
  const promptReportCancel = () => {
    Alert.alert(
      '🛡️ Emergency — End Trip?',
      'This ends the trip now and reports it for review. Any advance you paid is held and refunded per our team\'s decision within 2 days. Use only in a genuine emergency.',
      [
        { text: 'Keep riding', style: 'cancel' },
        ...REPORT_REASONS.map(r => ({ text: r, onPress: () => reportCancelRide(r) })),
      ],
    );
  };

  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(
    rideData?.started_at ? new Date(rideData.started_at).getTime() : Date.now()
  );

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const etaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [etaMins, setEtaMins] = useState<number | null>(null);
  useEffect(() => {
    if (!driverEta) return;
    const m = parseInt((driverEta.match(/\d+/) || [])[0] || '0', 10);
    if (m <= 0) return;
    setEtaMins(m);
    if (etaIntervalRef.current) clearInterval(etaIntervalRef.current);
    let remaining = m;
    etaIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) setEtaMins(remaining);
      else clearInterval(etaIntervalRef.current!);
    }, 60000);
    return () => { if (etaIntervalRef.current) clearInterval(etaIntervalRef.current); };
  }, [driverEta]);

  const etaDisplay = etaMins !== null
    ? (etaMins <= 1 ? '< 1 min' : `${etaMins} min`)
    : driverEta;

  const [issueReported, setIssueReported] = useState(false);
  const [showFullRoute, setShowFullRoute] = useState(false);

  const handleSOS = async () => {
    setSosActive(true);
    await triggerSOS();
    setTimeout(() => setSosActive(false), 6000);
  };

  const handleIssue = useCallback((issue: string) => {
    if (issue === 'No issues') {
      setIssueReported(true);
      return;
    }
    Alert.alert(
      'Report Issue',
      `Report "${issue}" to Sppero support?`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Report', style: 'destructive', onPress: () => setIssueReported(true) },
      ]
    );
  }, []);

  const handleShare = useCallback(() => {
    const d = rideData?.driver;
    const trackUrl = `${API}/track/${rideData?.ride_id || ''}`;
    const msg = `🚖 *Sppero — Live Tracking*\n\nDriver: ${d?.name || 'Assigned'} | ${d?.vehicle_no || ''}\n📍 From: ${pickup}\n🎯 To: ${drop}\n\n📡 *Live track:*\n${trackUrl}`;
    Share.share({ message: msg, url: trackUrl, title: 'Sppero Live Tracking' }).catch(() => {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
    });
  }, [rideData, pickup, drop]);

  const driver = rideData?.driver;
  const vType  = (rideData?.vehicle_type || rideData?.ride_type || rideType || 'auto').toLowerCase();
  const vEmoji = VEHICLE_EMOJI[vType] || '🚗';

  return (
    <View style={s.screen}>

      {/* ── Compact header ── */}
      <View style={{
        backgroundColor: C.pinkDark,
        paddingTop: Platform.OS === 'android' ? 44 : 52,
        paddingBottom: 14, paddingHorizontal: SP.md,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{
            width: 34, height: 34, borderRadius: 17,
            backgroundColor: 'rgba(255,255,255,0.10)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 17 }}>{vEmoji}</Text>
          </View>
          <View>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{rideData?.is_parcel ? 'Delivery In Progress' : 'Ride In Progress'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.48)', fontSize: 11, marginTop: 1, textTransform: 'capitalize' }}>
              {vType}
            </Text>
          </View>
        </View>

        {/* Live elapsed timer */}
        <View style={{
          backgroundColor: 'rgba(0,212,168,0.14)', borderRadius: R.sm,
          paddingHorizontal: 11, paddingVertical: 6,
          flexDirection: 'row', alignItems: 'center', gap: 5,
          borderWidth: 1, borderColor: 'rgba(0,212,168,0.32)',
        }}>
          <PulseView>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }} />
          </PulseView>
          <Text style={{ color: C.green, fontWeight: '800', fontVariant: ['tabular-nums'], fontSize: 13 }}>
            {formatElapsed(elapsed)}
          </Text>
        </View>
      </View>

      {/* ── Map ── */}
      <View style={s.mapFit}>
        <LiveMap
          pickupCoords={pickupCoords}
          dropCoords={dropCoords}
          driverLat={driverLoc?.lat}
          driverLng={driverLoc?.lng}
          vehicleType={vType}
          height={260}
          mode="inride"
          showRoute={true}
          followDriver={true}
          showTraffic={true}
        />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} live={true} />
      </View>

      {/* ── Bottom Sheet ── */}
      <GlassPanel intensity={22} style={{
        flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        marginTop: -20, paddingTop: 0, paddingHorizontal: 0,
        elevation: 16, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 20,
        borderTopWidth: 1.5, borderTopColor: 'rgba(255,45,120,0.20)',
      }}>
        {/* Drag handle */}
        <View style={{
          width: 36, height: 4, borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.18)',
          alignSelf: 'center', marginTop: 10, marginBottom: 14,
        }} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
        >

          {/* ── ETA hero ── */}
          <View style={{
            backgroundColor: 'rgba(0,212,168,0.08)',
            borderRadius: R.md, padding: 16, marginBottom: 10,
            borderWidth: 1.5, borderColor: 'rgba(0,212,168,0.22)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <PulseView>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.green }} />
              </PulseView>
              <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: '600' }}>
                {rideData?.is_parcel ? `Reaching ${rideData?.receiver_name || 'the receiver'} in` : 'Reaching drop location in'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{
                color: C.green, fontSize: 38, fontWeight: '900',
                fontVariant: ['tabular-nums'], lineHeight: 42,
              }}>
                {etaDisplay ?? '—'}
              </Text>
              {driverDist ? (
                <View style={{
                  backgroundColor: 'rgba(0,200,83,0.12)', borderRadius: 20,
                  paddingHorizontal: 10, paddingVertical: 4,
                  borderWidth: 1, borderColor: 'rgba(0,200,83,0.25)',
                }}>
                  <Text style={{ color: C.green, fontSize: 12, fontWeight: '700' }}>
                    {driverDist} away
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ── Drop address card ── */}
          <View style={{
            backgroundColor: C.bgCard, borderRadius: R.md, marginBottom: 10,
            overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder,
          }}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowFullRoute(v => !v)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.pink }} />
              <Text style={{ flex: 1, color: C.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                {drop}
              </Text>
              <View style={{
                backgroundColor: C.plumGlass, borderRadius: R.xs,
                paddingHorizontal: 9, paddingVertical: 4,
                borderWidth: 1, borderColor: C.plumBorder,
                flexDirection: 'row', alignItems: 'center', gap: 3,
              }}>
                <Text style={{ color: C.plum, fontSize: 11, fontWeight: '700' }}>
                  Trip Details
                </Text>
                <Ionicons
                  name={showFullRoute ? 'chevron-up' : 'chevron-down'}
                  size={11} color={C.plum}
                />
              </View>
            </TouchableOpacity>

            {showFullRoute && (
              <View style={{
                paddingHorizontal: 14, paddingBottom: 14,
                borderTopWidth: 1, borderTopColor: C.glassBorder,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 }}>
                  <View style={{ alignItems: 'center', paddingTop: 2, width: 10 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.green }} />
                    <View style={{ width: 2, height: 20, backgroundColor: C.glassBorder, marginVertical: 3 }} />
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.pink }} />
                  </View>
                  <View style={{ flex: 1, gap: 16 }}>
                    <Text style={{ color: C.textMuted, fontSize: 12, lineHeight: 16 }} numberOfLines={2}>
                      {pickup}
                    </Text>
                    <Text style={{ color: C.text, fontSize: 12, fontWeight: '700', lineHeight: 16 }} numberOfLines={2}>
                      {drop}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* ── Report a delivery that isn't happening ─────────────────────── */}
          {rideData?.is_parcel && !parcelReportRes && (
            <TouchableOpacity onPress={promptParcelReport} disabled={reportingParcel}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginBottom: 8 }}>
              <Ionicons name="alert-circle-outline" size={14} color={C.textMuted} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.textMuted }}>
                {reportingParcel ? 'Reporting…' : 'Problem with this delivery?'}
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Report filed — escrow frozen, and the sender is told where
                 their parcel was last seen. They are entitled to know. ── */}
          {parcelReportRes && (
            <View style={{ backgroundColor: 'rgba(220,38,38,0.07)', borderRadius: R.md, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'rgba(220,38,38,0.28)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Ionicons name="shield-checkmark" size={16} color="#DC2626" />
                <Text style={{ fontSize: 12.5, fontWeight: '900', color: '#DC2626' }}>Under review by our team</Text>
              </View>
              <Text style={{ fontSize: 12, color: C.text, lineHeight: 17 }}>
                {parcelReportRes.escrow_frozen
                  ? "Your payment is on hold — it can't be released to the driver while we review this."
                  : 'Our team will get back to you about this delivery.'}
              </Text>

              {parcelReportRes.driver_last_location && (
                <View style={{ marginTop: 10, backgroundColor: '#fff', borderRadius: 12, padding: 11, borderWidth: 1, borderColor: C.glassBorder }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: C.textMuted, letterSpacing: 0.4 }}>
                    WHERE YOUR PARCEL WAS LAST SEEN
                  </Text>
                  <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: 4 }}>
                    {parcelReportRes.driver_last_location.lat.toFixed(5)}, {parcelReportRes.driver_last_location.lng.toFixed(5)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${parcelReportRes.driver_last_location.lat},${parcelReportRes.driver_last_location.lng}`)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 }}>
                    <Ionicons name="map-outline" size={14} color={C.pink} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: C.pink }}>Open in Maps</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── Delivery issue — driver couldn't reach the receiver, sender decides ── */}
          {rideData?.is_parcel && rideData?.returnStatus === 'pending_decision' && (
            <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: R.md, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.3)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={{ fontSize: 12.5, fontWeight: '900', color: '#DC2626' }}>Delivery Issue</Text>
              </View>
              <Text style={{ fontSize: 12, color: C.text, marginBottom: 4, lineHeight: 17 }}>
                Your delivery partner couldn't reach {rideData?.receiver_name || 'the receiver'}{rideData?.deliveryFailReason ? ` — ${rideData.deliveryFailReason}` : ''}. Do you want the package returned to you?
              </Text>
              {/* Price the return before they commit, not after. */}
              {rideData?.returnFare > 0 && (
                <Text style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 10, lineHeight: 16 }}>
                  Bringing it back is a second trip for your Buddy — ₹{Math.round(rideData.returnFare)}.
                </Text>
              )}
              <Text style={{ fontSize: 11, color: C.textDim, marginBottom: 10 }}>
                Please answer soon — your Buddy is holding your parcel and waiting on you.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => handleReturnDecision('retry')} disabled={returnSubmitting} style={{ flex: 1, backgroundColor: C.glassMid, borderRadius: 12, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: C.text }}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleReturnDecision('return')} disabled={returnSubmitting} style={{ flex: 1, backgroundColor: '#DC2626', borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#fff' }}>{returnSubmitting ? '...' : 'Send It Back'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Return awaiting payment ────────────────────────────────────
                 The sender asked for the parcel back but hasn't paid for that
                 trip yet. Until they do, the driver is NOT sent back and no
                 return OTP exists — so this step can't be skipped. */}
          {rideData?.is_parcel && rideData?.returnStatus === 'awaiting_payment' && (
            <View style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: R.md, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.32)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Ionicons name="wallet-outline" size={16} color="#B45309" />
                <Text style={{ fontSize: 12.5, fontWeight: '900', color: '#B45309' }}>Pay for the return trip</Text>
              </View>
              <Text style={{ fontSize: 12, color: C.text, lineHeight: 17 }}>
                Your Buddy will bring the parcel back to you. This is a second
                trip, so it's charged separately — and held safely until they
                hand it over.
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 10, marginBottom: 12 }}>
                <Text style={{ fontSize: 26, fontWeight: '900', color: C.text }}>₹{Math.round(rideData?.returnFare || 0)}</Text>
                <Text style={{ fontSize: 11.5, color: C.textMuted }}>return trip</Text>
              </View>

              {payReturnErr ? (
                <Text style={{ fontSize: 11.5, color: '#DC2626', marginBottom: 8 }}>{payReturnErr}</Text>
              ) : null}

              <TouchableOpacity
                onPress={handlePayReturn}
                disabled={payingReturn}
                activeOpacity={0.9}
                style={{
                  backgroundColor: payingReturn ? '#C9C4D8' : C.green, borderRadius: 13, paddingVertical: 13,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                {payingReturn
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="lock-closed" size={15} color="#fff" />}
                <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '900' }}>
                  {payingReturn ? 'Paying…' : `Pay ₹${Math.round(rideData?.returnFare || 0)} from wallet`}
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 10.5, color: C.textDim, textAlign: 'center', marginTop: 8 }}>
                Held by Sppero · released to your Buddy only on hand-over
              </Text>
            </View>
          )}

          {/* ── Return OTP — sender agreed to get the package back; give this
                 to the driver when they bring it. ── */}
          {rideData?.is_parcel && rideData?.returnStatus === 'accepted' && rideData?.returnOtp ? (
            <View style={{
              backgroundColor: C.plumGlass, borderRadius: R.md, padding: 14,
              marginBottom: 10, borderWidth: 1.5, borderColor: C.plumBorder,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Ionicons name="lock-closed-outline" size={14} color={C.plum} />
                <Text style={{ fontSize: 11, fontWeight: '900', color: C.textDim, letterSpacing: 1.2 }}>RETURN OTP</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {String(rideData.returnOtp).split('').slice(0, 4).map((d: string, i: number) => (
                  <View key={i} style={{ width: 36, height: 44, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.plumBorder, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: C.plum }}>{d}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 10.5, color: C.textMuted, marginTop: 8, lineHeight: 14 }}>
                Give this code to your delivery partner when they bring your package back.
              </Text>
            </View>
          ) : null}

          {/* ── Parcel delivery OTP — package is en route. Also shown earlier
                 in MatchingScreen once matched; repeated here since the trip
                 can run long and the sender may not have shared it yet. ── */}
          {rideData?.is_parcel && rideData?.deliveryOtp && !rideData?.returnStatus ? (
            <View style={{
              backgroundColor: C.plumGlass, borderRadius: R.md, padding: 14,
              marginBottom: 10, borderWidth: 1.5, borderColor: C.plumBorder,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Ionicons name="lock-closed-outline" size={14} color={C.plum} />
                <Text style={{ fontSize: 11, fontWeight: '900', color: C.textDim, letterSpacing: 1.2 }}>DELIVERY OTP</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {String(rideData.deliveryOtp).split('').slice(0, 4).map((d: string, i: number) => (
                    <View key={i} style={{ width: 36, height: 44, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.plumBorder, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 20, fontWeight: '900', color: C.plum }}>{d}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    const msg = `📦 Sppero delivery OTP: ${rideData.deliveryOtp}\n\nGive this code to the delivery partner when your package arrives.`;
                    Share.share({ message: msg }).catch(() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`));
                  }}
                  style={{ backgroundColor: C.plum, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' }}>
                  <Ionicons name="share-social-outline" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', marginTop: 2 }}>Share</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 10.5, color: C.textMuted, marginTop: 8, lineHeight: 14 }}>
                Share this with {rideData.receiver_name || 'the receiver'} so they can hand it to the driver on arrival.
              </Text>
            </View>
          ) : null}

          {/* ── Issue chips ── */}
          <View style={{ marginBottom: 14 }}>
            {issueReported ? (
              <View style={{
                backgroundColor: 'rgba(0,200,83,0.10)', borderRadius: R.md,
                paddingHorizontal: 14, paddingVertical: 10,
                borderWidth: 1, borderColor: 'rgba(0,200,83,0.25)',
                flexDirection: 'row', alignItems: 'center', gap: 8,
              }}>
                <Ionicons name="checkmark-circle" size={16} color={C.green} />
                <Text style={{ color: C.green, fontSize: 12, fontWeight: '700' }}>
                  Report received. Stay safe.
                </Text>
              </View>
            ) : (
              <>
                <Text style={{
                  color: C.textMuted, fontSize: 12, fontWeight: '700',
                  marginBottom: 9, letterSpacing: 0.2,
                }}>
                  {rideData?.is_parcel ? 'Any issues with this delivery?' : 'Any issues with your ride?'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {ISSUE_CHIPS.map(issue => (
                      <TouchableOpacity
                        key={issue}
                        activeOpacity={0.72}
                        onPress={() => handleIssue(issue)}
                        style={{
                          backgroundColor: issue === 'No issues'
                            ? 'rgba(0,212,168,0.10)'
                            : C.glass,
                          borderRadius: 20,
                          paddingHorizontal: 13, paddingVertical: 8,
                          borderWidth: 1,
                          borderColor: issue === 'No issues'
                            ? 'rgba(0,212,168,0.30)'
                            : C.glassBorder,
                        }}
                      >
                        <Text style={{
                          fontSize: 12, fontWeight: '700',
                          color: issue === 'No issues' ? C.green : C.text,
                        }}>
                          {issue}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
          </View>

          {/* ── Driver card ── */}
          {driver && (
            <View style={{
              backgroundColor: C.bgCard, borderRadius: R.md, padding: 14,
              marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12,
              borderWidth: 1, borderColor: C.glassBorder,
            }}>
              {/* Avatar */}
              <View style={{ position: 'relative' }}>
                {driver.photo ? (
                  <Image
                    source={{ uri: driver.photo }}
                    style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: C.pink }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{
                    width: 52, height: 52, borderRadius: 26,
                    backgroundColor: C.plum,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>
                      {(driver.name || 'D')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 14, height: 14, borderRadius: 7,
                  backgroundColor: C.green, borderWidth: 2, borderColor: C.bgCard,
                }} />
              </View>

              {/* Name + plate */}
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '800' }}>
                  {driver.name || 'Driver'}
                </Text>
                {rideData?.vehicle_no ? (
                  <View style={{
                    marginTop: 5, alignSelf: 'flex-start',
                    backgroundColor: C.yellowGlass, borderRadius: 6,
                    paddingHorizontal: 8, paddingVertical: 3,
                    borderWidth: 1, borderColor: C.yellowBorder,
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                  }}>
                    <Text style={{ fontSize: 10 }}>{vEmoji}</Text>
                    <Text style={{ color: C.yellow, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 }}>
                      {rideData.vehicle_no}
                    </Text>
                  </View>
                ) : null}
                {driver.language ? (
                  <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 4 }}>
                    Speaks {driver.language}
                  </Text>
                ) : null}
              </View>

              {/* Rating */}
              {driver.rating ? (
                <View style={{
                  backgroundColor: C.yellowGlass, borderRadius: R.xs,
                  paddingHorizontal: 9, paddingVertical: 7,
                  borderWidth: 1, borderColor: C.yellowBorder,
                  alignItems: 'center', gap: 1,
                }}>
                  <Text style={{ color: C.yellow, fontSize: 15, lineHeight: 17 }}>★</Text>
                  <Text style={{ color: C.yellow, fontSize: 12, fontWeight: '800' }}>
                    {Number(driver.rating).toFixed(1)}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* ── SOS ── */}
          <InlineSOSButton onActivate={handleSOS} active={sosActive} />

          {sosActive && (() => {
            /* This panel used to say "SOS Alert Sent — Emergency contacts
               notified" every single time, including when the rider had saved
               no contacts and nothing had been sent at all. Somebody reading
               that in a frightening situation stops looking for other help,
               which makes a reassuring lie the most dangerous string in the
               app. It now states what actually happened, and when nothing went
               out it says so first and loudest. */
            const o = sosOutcome;
            const nobody = o && o.contacts === 0;
            const failed = o && o.contacts > 0 && !o.opened;
            const bad = nobody || failed;
            return (
              <View style={{
                backgroundColor: C.redGlass, borderRadius: 14, padding: 12,
                flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                borderWidth: 1.5, borderColor: C.red, marginBottom: 10,
              }}>
                <Ionicons name="warning" size={16} color={C.red} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: C.red, fontWeight: '900' }}>
                    {nobody ? '🆘 No emergency contact saved'
                      : failed ? '🆘 Could not open your messages'
                      : '🆘 SOS Alert Sent!'}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2, lineHeight: 16 }}>
                    {nobody
                      ? 'Nobody was messaged. Call for help now — Police 100 · Ambulance 108. Add a contact in Safety so this is automatic next time.'
                      : failed
                        ? `Sppero has your alert${o!.logged ? '' : ' (still trying to reach our servers)'}, but your phone could not open WhatsApp or SMS. Call directly — Police 100 · Ambulance 108.`
                        : `${o ? o.alerted : 0} emergency contact${o && o.alerted === 1 ? '' : 's'} messaged${o && o.logged ? ' · Sppero alerted' : ''}. Police: 100 · Ambulance: 108`}
                  </Text>
                  {bad && (
                    <TouchableOpacity onPress={() => Linking.openURL('tel:100')} style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 }}>
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>Call 100 now</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })()}

          {/* ── Emergency: end trip & report (advance held for admin review) ──
              Saffron, not red — this is a "trip went wrong, end + report" action,
              not a life-threatening emergency. Keeping it visually distinct from
              SOS above avoids the two reading as equally urgent/alarming. ── */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={promptReportCancel}
            style={{
              backgroundColor: C.saffGlass, borderRadius: 14,
              paddingVertical: 12, paddingHorizontal: 16, marginBottom: 10,
              flexDirection: 'row', alignItems: 'center', gap: 10,
              borderWidth: 1, borderColor: C.saffron,
            }}
          >
            <Ionicons name="alert-circle" size={18} color={C.saffron} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: C.saffron, fontWeight: '900' }}>Emergency — End Trip & Report</Text>
              <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>Advance held · refund decided within 2 days</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={C.saffron} />
          </TouchableOpacity>

          {/* ── Share tracking ── */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleShare}
            style={{
              backgroundColor: C.glass, borderRadius: 16,
              paddingVertical: 13, paddingHorizontal: 16,
              flexDirection: 'row', alignItems: 'center', gap: 10,
              borderWidth: 1, borderColor: C.glassBorder,
            }}
          >
            <View style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: C.glassMid, alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="share-social-outline" size={18} color={C.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>Share Live Tracking</Text>
              <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 1 }}>
                Send ride link to family / friends
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={C.textDim} />
          </TouchableOpacity>

        </ScrollView>
      </GlassPanel>
    </View>
  );
}
