import { useState, useEffect, useRef } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, ScrollView, Share, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useApp } from '../context/AppContext';
import { Bouncy, Confetti, CountUp, DotBG, FadeIn, ScreenIn, TripSteps } from '../components/ui';
import { IlluRideComplete } from '../components/Illustrations';
import { s, C, T, SP, R, SHADOW } from '../styles';
import { apiGet, apiPost } from '../../api';
import { shortRideId } from '../rideId';

export function PostRideScreen() {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const {
    phone,
    setScreen, setTab,
    pickup, drop,
    rideData,
    paymentDone, setPaymentDone,
    setShowRatingModal,
    result, setResult,
    loadHistory, loadWallet,
    cashbackEarned,
  } = useApp();

  const [showBill, setShowBill] = useState(false);
  const [billData, setBillData] = useState<any>(null);
  const [billLoading, setBillLoading] = useState(false);

  // Buddy Fund nudge
  const [buddyPhase, setBuddyPhase]     = useState<'idle' | 'loading' | 'done'>('idle');
  const [buddyPaid, setBuddyPaid]       = useState(0);
  const buddyHeartScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(buddyHeartScale, { toValue: 1.22, duration: 700, useNativeDriver: true }),
        Animated.timing(buddyHeartScale, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const doQuickDonate = async (amt: number) => {
    setBuddyPhase('loading');
    try {
      let RazorpayCheckout: any = null;
      try { const _m = require('react-native-razorpay'); RazorpayCheckout = _m?.default || _m || null; } catch (_e) {}
      if (!RazorpayCheckout) { setBuddyPhase('idle'); return; }
      const orderRes = await apiPost('/api/buddy-fund/create-order', { phone, amount: amt });
      if (!orderRes.success) { setBuddyPhase('idle'); return; }
      const payData: any = await new Promise((resolve, reject) =>
        RazorpayCheckout.open({
          key: orderRes.key_id, amount: orderRes.amount, currency: 'INR',
          order_id: orderRes.order_id, name: 'Sppero Buddy Fund',
          description: `Driver Bonus — ₹${amt}`,
          prefill: { contact: phone }, theme: { color: '#F59E0B' },
        }).then(resolve).catch(reject)
      );
      await apiPost('/api/buddy-fund/verify', {
        phone,
        razorpay_order_id:   payData.razorpay_order_id,
        razorpay_payment_id: payData.razorpay_payment_id,
        razorpay_signature:  payData.razorpay_signature,
      });
      setBuddyPaid(amt);
      setBuddyPhase('done');
    } catch (_e) { setBuddyPhase('idle'); }
  };

  const fareNum = Math.round(parseFloat(String(rideData?.fare ?? billData?.fare ?? 0).replace(/[^0-9.]/g, '')) || 0);
  const gstAmt = Math.round((fareNum * 5 / 105) * 100) / 100;
  const baseAmt = Math.round((fareNum - gstAmt) * 100) / 100;

  // Auto-load ride details for trip stats card
  useEffect(() => {
    if (!rideData?.ride_id) return;
    apiGet(`/api/rides/status/${rideData.ride_id}`)
      .then(d => { if (d?.ride) setBillData(d.ride); })
      .catch(() => {});
  }, [rideData?.ride_id]);

  // 3-second auto-redirect to home — open rating modal there
  const [countdown, setCountdown] = useState(3);
  useEffect(() => {
    const interval = setInterval(() => setCountdown(c => c - 1), 1000);
    const timer = setTimeout(() => goHome(), 3000);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, []);

  const goHome = () => {
    setShowRatingModal(true);
    setScreen('home');
    setTab('home');
    setPaymentDone(false);
    setResult('');
    loadHistory(phone);
    loadWallet(phone);
  };

  const openBill = async () => {
    setBillLoading(true);
    try {
      const d = await apiGet(`/api/rides/status/${rideData?.ride_id}`);
      setBillData(d.ride);
    } catch (_e) {}
    setBillLoading(false);
    setShowBill(true);
  };

  const paymentLabel = () => {
    const m = billData?.payment_method || '';
    if (m === 'cash') return 'Cash';
    if (m === 'wallet') return 'Wallet';
    if (m === 'online' || m === 'upi') return 'Online / UPI';
    return 'Cash';
  };

  const billId = shortRideId(rideData?.ride_id);
  const nowStr = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const vehicleType = (rideData?.vehicle_type || billData?.ride_type || 'Auto').replace(/\b\w/g, (c: string) => c.toUpperCase());

  const shareBill = () => {
    const dist = billData?.distance ? `\n📏 Distance: ${billData.distance} km` : '';
    const text =
`🚖 *SPPERO — RIDE RECEIPT*
━━━━━━━━━━━━━━━━━━━

📋 *Booking ID:* ${billId}
📅 *Date:* ${nowStr}

📍 *Pickup:*  ${pickup}
🏁 *Drop:*    ${drop}
${dist}
🚗 *Vehicle:* ${vehicleType}
👤 *Driver:*  ${rideData?.driver?.name || 'N/A'}

━━━━━━━━━━━━━━━━━━━
       *FARE BREAKDOWN*
━━━━━━━━━━━━━━━━━━━
Base Fare:       ₹${baseAmt.toFixed(2)}
GST (5%):        ₹${gstAmt.toFixed(2)}
━━━━━━━━━━━━━━━━━━━
*TOTAL PAID:  ₹${fareNum}*
💳 *Payment:* ${paymentLabel()}
━━━━━━━━━━━━━━━━━━━

_GST is included in the fare — not charged separately._

🙏 Thank you for riding with *Sppero*!`;

    Share.share({ message: text });
  };

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <Confetti />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ backgroundColor: '#FF2D78', borderBottomLeftRadius: 36, borderBottomRightRadius: 36, elevation: 12, shadowColor: '#FF2D78', shadowOpacity: 0.45, shadowRadius: 20 }}>
        <View style={{ paddingTop: 52, paddingBottom: 28, alignItems: 'center' }}>
          <View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.08)', top: -80, right: -60 }} />
          <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -40, left: -40 }} />

          {/* Driver photo + completion emoji */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            {rideData?.driver?.photo ? (
              <Image source={{ uri: rideData.driver.photo }} style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' }} contentFit="cover" />
            ) : (
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 28 }}>👤</Text>
              </View>
            )}
            <View style={{ alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 24, fontWeight: '900', color: '#fff' }}>{paymentDone ? 'Payment Done!' : (rideData?.is_parcel ? 'Delivered! 🎉' : 'Trip Complete! 🎉')}</Text>
              {rideData?.driver?.name ? (
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>
                  Driver: {rideData.driver.name}
                </Text>
              ) : null}
            </View>
          </View>

          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 10, textAlign: 'center', paddingHorizontal: 24 }} numberOfLines={1}>{pickup} → {drop}</Text>

          <View style={{ marginTop: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: R.md, paddingHorizontal: SP.lg, paddingVertical: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.38)', alignItems: 'center' }}>
            <Text style={{ ...T.label, color: 'rgba(255,255,255,0.65)', marginBottom: 2 }}>TOTAL PAID</Text>
            <CountUp to={fareNum} prefix="₹" style={{ ...T.display, color: '#fff', letterSpacing: -1 }} />
          </View>

          <Bouncy
            onPress={openBill}
            style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' }}>
            <Text style={{ fontSize: 16 }}>🧾</Text>
            <Text style={{ ...T.bodyBold, color: '#fff' }}>{billLoading ? 'Loading...' : 'Full Bill & Share'}</Text>
          </Bouncy>
        </View>
        </View>

        <View style={{ paddingHorizontal: 14, paddingTop: 16 }}>
          <TripSteps step={3} />
        </View>

        {/* Ride complete illustration */}
        <FadeIn style={{ alignItems: 'center', marginTop: 4, marginBottom: -6 }}>
          <IlluRideComplete width={220} height={150} />
        </FadeIn>

        {/* Trip stats card — visible without opening modal */}
        <View style={{ marginHorizontal: 14, marginTop: 4, backgroundColor: C.bgCard, borderRadius: 18, padding: 14, borderWidth: 1.5, borderColor: C.glassBorder, elevation: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {[
              { icon: '📏', label: 'Distance', value: billData?.distance ? `${billData.distance} km` : rideData?.distance || '—' },
              { icon: '🚗', label: 'Vehicle', value: vehicleType },
              { icon: '💳', label: 'Payment', value: paymentLabel() },
            ].map(item => (
              <View key={item.label} style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 22 }}>{item.icon}</Text>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginTop: 4 }}>{item.value}</Text>
                <Text style={{ color: C.textDim, fontSize: 10, marginTop: 2 }}>{item.label}</Text>
              </View>
            ))}
          </View>
          {(billData?.vehicle_no || rideData?.vehicle_no) ? (
            <View style={{ marginTop: 12, borderTopWidth: 1, borderColor: C.glassBorder, paddingTop: 10, alignItems: 'center' }}>
              <Text style={{ color: C.textDim, fontSize: 11 }}>Vehicle No.  <Text style={{ color: C.text, fontWeight: '800', letterSpacing: 1 }}>{billData?.vehicle_no || rideData?.vehicle_no}</Text></Text>
            </View>
          ) : null}
        </View>

        {cashbackEarned.length > 0 && (
          <FadeIn style={{ marginHorizontal: 14, marginTop: 14 }}>
            <View style={{ backgroundColor: C.greenGlass, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: C.greenBorder }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 24, marginRight: 8 }}>🎉</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.green, flex: 1 }}>Cashback Earned!</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: C.green }}>
                  +₹{cashbackEarned.reduce((sum: number, c: any) => sum + c.amount, 0)}
                </Text>
              </View>
              {cashbackEarned.map((c: any, i: number) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, marginRight: 8 }} />
                  <Text style={{ fontSize: 12, color: C.textMuted, flex: 1 }}>{c.label}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.green }}>+₹{c.amount}</Text>
                </View>
              ))}
            </View>
          </FadeIn>
        )}

        {/* ── Buddy Fund nudge ── */}
        <FadeIn style={{ marginHorizontal: 14, marginTop: 14, marginBottom: 4 }}>
          <View style={{ backgroundColor: '#1A0A00', borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.35)', elevation: 6, shadowColor: '#F59E0B', shadowOpacity: 0.22, shadowRadius: 12 }}>
            {buddyPhase !== 'done' ? (
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Animated.Text style={{ fontSize: 24, transform: [{ scale: buddyHeartScale }] }}>💛</Animated.Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>Driver ko ek extra khushi do!</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 }}>Buddy Fund mein donate karo — seedha driver bonus milega</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {buddyPhase === 'loading' ? (
                    <View style={{ flex: 1, backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                      <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '800' }}>Processing…</Text>
                    </View>
                  ) : (
                    [2, 11, 51].map(amt => (
                      <TouchableOpacity key={amt} onPress={() => doQuickDonate(amt)}
                        style={{ flex: 1, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(245,158,11,0.28)' }}>
                        <Text style={{ color: '#FCD34D', fontSize: 15, fontWeight: '900' }}>₹{amt}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, marginTop: 2 }}>{amt === 2 ? 'Chai ☕' : amt === 11 ? 'Snack 🍱' : 'Bonus 🎁'}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </View>
            ) : (
              <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 28 }}>💛</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FCD34D', fontSize: 14, fontWeight: '900' }}>Shukriya! Driver khush hoga 🙏</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 }}>₹{buddyPaid} Buddy Fund mein add ho gaya</Text>
                </View>
              </View>
            )}
          </View>
        </FadeIn>

        <View style={{ marginHorizontal: 14, marginTop: 16, marginBottom: 10 }}>
          {/* Auto-redirect countdown */}
          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={{ fontSize: 13, color: C.textMuted }}>
              Going to home in <Text style={{ fontWeight: '900', color: C.pink }}>{countdown}</Text>s…
            </Text>
            <TouchableOpacity onPress={goHome} style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 13, color: C.pink, fontWeight: '800' }}>Go Now →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bill Modal */}
      <Modal visible={showBill} transparent animationType="slide" onRequestClose={() => setShowBill(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgDark, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, paddingBottom: 16 + bottomInset }}>

            {/* Handle */}
            <View style={{ width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>

              {/* Header */}
              <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                <Text style={{ fontSize: 28 }}>🧾</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 6, letterSpacing: 1 }}>SPPERO</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', letterSpacing: 2, marginTop: 2 }}>RIDE RECEIPT</Text>
              </View>

              {/* Divider dashed */}
              <View style={{ borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 16 }} />

              {/* Booking info */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Booking ID</Text>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{billId}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Date & Time</Text>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{nowStr}</Text>
              </View>

              {/* Route */}
              <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                  <Text style={{ fontSize: 16, marginRight: 10, marginTop: 1 }}>📍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginBottom: 2 }}>PICKUP</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{pickup}</Text>
                  </View>
                </View>
                <View style={{ width: 2, height: 16, backgroundColor: 'rgba(255,255,255,0.15)', marginLeft: 17, marginBottom: 10 }} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 16, marginRight: 10, marginTop: 1 }}>🏁</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginBottom: 2 }}>DROP</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{drop}</Text>
                  </View>
                </View>
              </View>

              {/* Vehicle & Driver */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginBottom: 4 }}>VEHICLE</Text>
                  <Text style={{ fontSize: 18, marginBottom: 2 }}>🚗</Text>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{vehicleType}</Text>
                  {billData?.vehicle_no ? <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{billData.vehicle_no}</Text> : null}
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginBottom: 4 }}>DRIVER</Text>
                  <Text style={{ fontSize: 18, marginBottom: 2 }}>👤</Text>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{rideData?.driver?.name || billData?.driver_name || 'N/A'}</Text>
                  {billData?.distance ? <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{billData.distance} km</Text> : null}
                </View>
              </View>

              {/* Fare breakdown */}
              <View style={{ borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 14 }} />

              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textAlign: 'center', marginBottom: 14 }}>FARE BREAKDOWN</Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>Base Fare</Text>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>₹{baseAmt.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, alignItems: 'flex-end' }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>GST (5%)</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>*Shown for transparency only</Text>
                </View>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>₹{gstAmt.toFixed(2)}</Text>
              </View>

              <View style={{ borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 14 }} />

              {/* Total */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>TOTAL PAID</Text>
                <Text style={{ color: C.pink, fontSize: 28, fontWeight: '900' }}>₹{fareNum}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>Payment Mode</Text>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{paymentLabel()}</Text>
              </View>

              <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 10, marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14 }}>ℹ️</Text>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 16, flex: 1 }}>
                  GST is included in the fare — not charged separately.
                </Text>
              </View>

              {/* Buttons */}
              <TouchableOpacity onPress={shareBill}
                style={{ backgroundColor: '#25D366', borderRadius: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 6, shadowColor: '#25D366', shadowOpacity: 0.4, shadowRadius: 10 }}>
                <Text style={{ fontSize: 20 }}>📤</Text>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Share on WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowBill(false)}
                style={{ marginTop: 12, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>Dismiss</Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenIn>
  );
}
