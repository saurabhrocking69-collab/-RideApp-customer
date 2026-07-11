import { Animated, Dimensions, Linking, Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, DotBG, ScreenIn } from '../components/ui';
import { s, C, T, R, SP, SHADOW } from '../styles';
import { apiPost } from '../../api';

const { width: W } = Dimensions.get('window');
const SB_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0;

// ── UPI App tiles config ──────────────────────────────────────────────────────
const UPI_APPS = [
  { id: 'phonepe', name: 'PhonePe',    icon: '🟣', color: '#C084FC', bg: 'rgba(168,85,247,0.14)', border: '#A855F7' },
  { id: 'gpay',    name: 'Google Pay', icon: '🔵', color: '#60A5FA', bg: 'rgba(59,130,246,0.14)',  border: '#3B82F6' },
  { id: 'paytm',   name: 'Paytm',      icon: '🔷', color: '#38BDF8', bg: 'rgba(14,165,233,0.14)', border: '#0EA5E9' },
  { id: 'bhim',    name: 'BHIM UPI',   icon: '🟠', color: '#FBBF24', bg: 'rgba(245,158,11,0.14)', border: '#F59E0B' },
];

export function PaymentScreen() {
  const {
    phone, setScreen, pickup, drop, rideData, fareCount,
    walletBalance, showUpiQr, setShowUpiQr,
    paymentDone, setPaymentDone, result,
    handlePayment, payWithWallet, createScratchCard,
  } = useApp();

  const [cashConfirming, setCashConfirming] = useState(false);
  const [upiConfirming, setUpiConfirming]   = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const driverUpiId = rideData?.driver?.upi_id || '';
  const rawFareNum  = Math.round(parseFloat(String(rideData?.fare ?? '').replace(/[^0-9.]/g, '') || '0') || 0);
  const discountAmt = Math.round(parseFloat(String(rideData?.discount    ?? '0')) || 0);
  const platFeeAmt  = Math.round(parseFloat(String(rideData?.platform_fee ?? '2')) || 2);
  const fareNum     = (rideData?.net_fare != null ? Math.round(rideData.net_fare) : Math.max(0, rawFareNum - discountAmt)) || fareCount;
  const tripSubtotal = Math.max(0, fareNum - platFeeAmt);
  const upiLink = driverUpiId
    ? `upi://pay?pa=${encodeURIComponent(driverUpiId)}&pn=${encodeURIComponent(rideData?.driver?.name || 'Driver')}&am=${fareNum}&cu=INR&tn=Sppero%20Trip`
    : '';
  const qrUrl = driverUpiId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=14&data=${encodeURIComponent(upiLink)}`
    : '';

  const walletSufficient = walletBalance >= fareNum;
  const cashback = Math.max(5, Math.min(50, Math.round(fareNum * 0.05)));

  const confirmUpiQrPaid = async () => {
    if (upiConfirming) return;
    setUpiConfirming(true);
    try {
      await apiPost('/api/rides/payment-complete', { ride_id: rideData.ride_id, payment_method: 'upi_qr', phone: phone || '9999999999' });
    } catch (_e) {}
    setUpiConfirming(false);
    setShowUpiQr(false);
    setPaymentDone(true); setScreen('postride'); createScratchCard();
  };

  const payWithCash = async () => {
    if (cashConfirming) return;
    setCashConfirming(true);
    try {
      await apiPost('/api/rides/payment-complete', { ride_id: rideData.ride_id, payment_method: 'cash', phone: phone || '9999999999' });
    } catch (_e) {}
    setCashConfirming(false);
    setPaymentDone(true); setScreen('postride'); createScratchCard();
  };

  // ── QR Full-screen Overlay ──────────────────────────────────────────────────
  if (showUpiQr) return (
    <ScreenIn style={{ flex: 1, backgroundColor: C.bgDark }}>
      {/* QR Header */}
      <View style={{
        paddingTop: SB_HEIGHT + 14, paddingBottom: 18, paddingHorizontal: 18,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
      }}>
        <TouchableOpacity
          onPress={() => setShowUpiQr(false)}
          style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>Scan & Pay</Text>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 1 }}>Scan with any UPI app</Text>
        </View>
        {/* Sppero brand chip */}
        <View style={{ backgroundColor: C.pink + '22', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.pink + '55' }}>
          <Text style={{ color: C.pink, fontSize: 11, fontWeight: '900' }}>SPPERO</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        {/* Fare pill */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{
            backgroundColor: C.pink, borderRadius: 24, paddingHorizontal: 36, paddingVertical: 16,
            elevation: 10, shadowColor: C.pink, shadowOpacity: 0.45, shadowRadius: 16,
          }}>
            <Text style={{ color: '#fff', fontSize: 46, fontWeight: '900', textAlign: 'center', letterSpacing: -1 }}>₹{fareNum}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', marginTop: 2, fontWeight: '600' }}>
              Driver: {rideData?.driver?.name || '—'}
            </Text>
          </View>
        </View>

        {driverUpiId ? (
          <>
            {/* QR Card */}
            <View style={{
              backgroundColor: '#fff',
              borderRadius: 28, padding: 20, alignItems: 'center',
              elevation: 12, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20,
              alignSelf: 'center', width: '100%', maxWidth: 320,
            }}>
              {/* Brand watermark inside QR card */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.pink }} />
                <Text style={{ color: C.pink, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }}>SPPERO SECURE PAY</Text>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.pink }} />
              </View>
              <Image
                source={{ uri: qrUrl }}
                style={{ width: 256, height: 256, borderRadius: 12 }}
                contentFit="contain"
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, backgroundColor: C.greenGlass, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.green }} />
                <Text style={{ color: C.green, fontSize: 11, fontWeight: '700' }}>Secure UPI Payment</Text>
              </View>
              <Text style={{ color: C.textDim, fontSize: 10, marginTop: 6 }}>{driverUpiId}</Text>
            </View>

            {/* UPI App row */}
            <View style={{ marginTop: 22, marginBottom: 8 }}>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700', textAlign: 'center', letterSpacing: 1, marginBottom: 12 }}>
                OR SCAN WITH THESE APPS
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
                {UPI_APPS.map(app => (
                  <TouchableOpacity
                    key={app.id}
                    onPress={() => Linking.openURL(upiLink).catch(() => {})}
                    style={{
                      flex: 1, backgroundColor: app.bg, borderRadius: 16,
                      paddingVertical: 12, alignItems: 'center',
                      borderWidth: 1.5, borderColor: app.border + '60',
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{app.icon}</Text>
                    <Text style={{ color: app.color, fontSize: 9, fontWeight: '800', marginTop: 4 }}>{app.name.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Open in app */}
            <TouchableOpacity
              onPress={() => Linking.openURL(upiLink).catch(() => {})}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14,
                backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
                padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <Ionicons name="open-outline" size={18} color="rgba(255,255,255,0.6)" />
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700', flex: 1 }}>
                Open Directly in UPI App
              </Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          </>
        ) : (
          <View style={{ backgroundColor: C.yellowGlass, borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1.5, borderColor: C.yellowBorder }}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>⚠️</Text>
            <Text style={{ color: C.yellow, fontSize: 15, fontWeight: '800', textAlign: 'center' }}>Driver's UPI ID not set</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', marginTop: 6 }}>Use Cash or Wallet instead</Text>
          </View>
        )}
      </ScrollView>

      {/* Confirm button */}
      <View style={{ padding: 16, paddingBottom: 32, gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' }}>
        <TouchableOpacity
          onPress={confirmUpiQrPaid}
          disabled={upiConfirming}
          style={{
            backgroundColor: upiConfirming ? 'rgba(255,255,255,0.08)' : C.green,
            borderRadius: R.md, padding: 18, alignItems: 'center',
            elevation: upiConfirming ? 0 : 10,
            shadowColor: C.green, shadowOpacity: 0.45, shadowRadius: 14,
            borderWidth: upiConfirming ? 1 : 0, borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Text style={{ ...T.title, color: '#fff' }}>
            {upiConfirming ? '⏳ Confirming...' : `✅  I've Paid — ₹${fareNum}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowUpiQr(false)} style={{ alignItems: 'center', padding: 10 }}>
          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    </ScreenIn>
  );

  // ── Main Payment Selection Screen ───────────────────────────────────────────
  return (
    <ScreenIn style={s.screen}>
      <DotBG />

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* ── Branded Hero ── */}
        <View style={{
          backgroundColor: C.pink, overflow: 'hidden',
          paddingTop: SB_HEIGHT + 22, paddingBottom: 32, paddingHorizontal: 20,
        }}>
          {/* Decorative circles */}
          <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(255,255,255,0.07)', top: -100, right: -60 }} />
          <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -70, left: -40 }} />

          {/* Sppero badge */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' }} />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>SPPERO · TRIP COMPLETE</Text>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' }} />
            </View>
          </View>

          {/* Fare */}
          <Text style={{ color: '#fff', fontSize: 72, fontWeight: '900', textAlign: 'center', letterSpacing: -2, lineHeight: 76 }}>
            ₹{fareNum}
          </Text>

          {/* Final fare breakdown card */}
          {fareNum > 0 && (() => {
            // Reverse-calculate actual trip fare from net fare
            const actualGross   = fareNum + discountAmt;           // gross (before coupon, after recalc)
            const actualTrip    = Math.max(0, actualGross - platFeeAmt); // trip fare excl. platform fee
            return (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 16, marginTop: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 10 }}>FARE DETAILS</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Trip Fare</Text>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>₹{actualTrip}</Text>
                </View>
                {platFeeAmt > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Platform Fee</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>₹{platFeeAmt}</Text>
                  </View>
                )}
                {discountAmt > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }}>
                    <Text style={{ color: '#4ADE80', fontSize: 13, fontWeight: '700' }}>Coupon Discount</Text>
                    <Text style={{ color: '#4ADE80', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>−₹{discountAmt}</Text>
                  </View>
                )}
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 8 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Total</Text>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] }}>₹{fareNum}</Text>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 8, textAlign: 'center' }}>
                  Final fare based on actual trip distance &amp; time
                </Text>
              </View>
            );
          })()}

          {/* Route pill */}
          <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 12, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 3 }}>FROM</Text>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{pickup}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.5)" />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 3 }}>TO</Text>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{drop}</Text>
            </View>
          </View>

          {/* Wallet promo bar */}
          {walletSufficient && (
            <View style={{ marginTop: 12, backgroundColor: C.green, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 4, shadowColor: C.green, shadowOpacity: 0.5, shadowRadius: 8 }}>
              <Text style={{ fontSize: 16 }}>💰</Text>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12, flex: 1 }}>Pay with Wallet · Get ₹{cashback} scratch card!</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
            </View>
          )}
        </View>

        <View style={{ padding: 16, gap: 0 }}>

          {/* ── UPI Hero Section ── */}
          {driverUpiId ? (
            <>
              {/* Section header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, marginTop: 4 }}>
                <View style={{ width: 4, height: 22, backgroundColor: C.pink, borderRadius: 3 }} />
                <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', flex: 1 }}>Pay via UPI</Text>
                <View style={{ backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' }} />
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>FASTEST</Text>
                </View>
              </View>

              {/* 2×2 UPI App Grid */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                {UPI_APPS.map(app => (
                  <TouchableOpacity
                    key={app.id}
                    onPress={() => Linking.openURL(upiLink).catch(() => {})}
                    activeOpacity={0.82}
                    style={{
                      width: (W - 42) / 2,
                      backgroundColor: app.bg,
                      borderRadius: 22, paddingVertical: 20, paddingHorizontal: 14,
                      alignItems: 'center',
                      borderWidth: 1.5, borderColor: app.border + '66',
                      elevation: 4, shadowColor: app.border, shadowOpacity: 0.28, shadowRadius: 10,
                    }}
                  >
                    <Text style={{ fontSize: 34, marginBottom: 8 }}>{app.icon}</Text>
                    <Text style={{ color: app.color, fontSize: 15, fontWeight: '900', marginBottom: 3 }}>{app.name}</Text>
                    <Text style={{ color: app.color + 'BB', fontSize: 11, fontWeight: '600' }}>Tap to pay ₹{fareNum}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Scan QR — Big prominent button */}
              <TouchableOpacity
                onPress={() => setShowUpiQr(true)}
                activeOpacity={0.87}
                style={{
                  backgroundColor: C.pink,
                  borderRadius: 22, padding: 20,
                  flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20,
                  elevation: 10, shadowColor: C.pink, shadowOpacity: 0.45, shadowRadius: 16,
                }}
              >
                <View style={{
                  width: 60, height: 60, borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
                }}>
                  <Ionicons name="qr-code-outline" size={32} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900', marginBottom: 3 }}>Scan QR Code</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>Scan with any UPI app</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 12, padding: 8 }}>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </View>
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ backgroundColor: C.yellowGlass, borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1.5, borderColor: C.yellowBorder, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 28 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.yellow, fontSize: 14, fontWeight: '800' }}>UPI Not Available</Text>
                <Text style={{ color: C.yellow, fontSize: 12, marginTop: 2, opacity: 0.75 }}>Driver has no UPI — use Wallet or Cash</Text>
              </View>
            </View>
          )}

          {/* ── Divider ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: C.glassBorder }} />
            <Text style={{ ...T.label, color: C.textDim }}>OTHER OPTIONS</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: C.glassBorder }} />
          </View>

          {/* ── Wallet — highlighted card ── */}
          <Bouncy onPress={walletSufficient ? payWithWallet : undefined} style={{ marginBottom: 12 }}>
            <View style={{ borderRadius: 22, overflow: 'hidden', elevation: walletSufficient ? 8 : 2, shadowColor: C.green, shadowOpacity: walletSufficient ? 0.28 : 0, shadowRadius: 12 }}>
              {/* Cashback banner — always visible */}
              <View style={{ backgroundColor: walletSufficient ? C.green : C.textDim, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, gap: 6 }}>
                <Text style={{ fontSize: 14 }}>🎁</Text>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900', flex: 1 }}>
                  ₹5 Cashback Instantly — Pay with Wallet!
                </Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>BEST DEAL</Text>
                </View>
              </View>

              {/* Card body */}
              <View style={{
                padding: SP.md, flexDirection: 'row', alignItems: 'center',
                backgroundColor: walletSufficient ? C.greenGlass : C.glassMid,
                borderWidth: walletSufficient ? 2 : 1,
                borderTopWidth: 0,
                borderColor: walletSufficient ? C.greenBorder : C.glassBorder,
              }}>
                {/* Wallet icon */}
                <View style={{
                  width: 54, height: 54, borderRadius: R.sm, marginRight: 14,
                  backgroundColor: walletSufficient ? C.greenGlass : C.glassHigh,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: walletSufficient ? C.greenBorder : C.glassBorder,
                }}>
                  <Text style={{ fontSize: 24 }}>💰</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ ...T.bodyBold, color: C.text }}>Sppero Wallet</Text>
                    {walletSufficient && (
                      <View style={{ backgroundColor: C.green, borderRadius: R.xs, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ ...T.label, color: '#fff' }}>TAP TO PAY</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ ...T.caption, color: walletSufficient ? C.green : C.textDim, fontWeight: '700' as const }}>
                    Balance: ₹{walletBalance}
                    {walletSufficient ? ` · Covers ₹${fareNum} ✓` : ' — insufficient balance'}
                  </Text>
                  {walletSufficient ? (
                    <Text style={{ ...T.caption, color: C.green, marginTop: 3 }}>
                      + ₹5 scratch card instantly 🎉
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={() => setScreen('wallet')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ ...T.caption, color: C.pink, fontWeight: '900' as const, marginTop: 4 }}>
                        + Recharge & Earn ₹5 Cashback →
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Ionicons
                  name={walletSufficient ? 'arrow-forward-circle' : 'chevron-forward'}
                  size={walletSufficient ? 32 : 22}
                  color={walletSufficient ? C.green : C.textDim}
                />
              </View>
            </View>
          </Bouncy>

          {/* ── Online / Razorpay ── */}
          <Bouncy onPress={handlePayment} style={{ marginBottom: 10 }}>
            <View style={{ borderRadius: R.md, padding: SP.md, flexDirection: 'row', alignItems: 'center', backgroundColor: C.glassMid, borderWidth: 1.5, borderColor: C.glassBorder, ...SHADOW.sm }}>
              <View style={{ width: 48, height: 48, borderRadius: R.sm, backgroundColor: C.plumGlass, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1.5, borderColor: C.plumBorder }}>
                <Text style={{ fontSize: 22 }}>💳</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...T.bodyBold, color: C.text, marginBottom: 2 }}>Online Payment</Text>
                <Text style={{ ...T.caption, color: C.textDim }}>Razorpay · Card · Net Banking</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.textDim} />
            </View>
          </Bouncy>

          {/* ── Cash ── */}
          <Bouncy onPress={payWithCash} style={{ opacity: cashConfirming ? 0.6 : 1, marginBottom: 10 }}>
            <View style={{ borderRadius: R.md, padding: SP.md, flexDirection: 'row', alignItems: 'center', backgroundColor: C.glassMid, borderWidth: 1.5, borderColor: C.glassBorder, ...SHADOW.sm }}>
              <View style={{ width: 48, height: 48, borderRadius: R.sm, backgroundColor: C.greenGlass, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1.5, borderColor: C.greenBorder }}>
                <Text style={{ fontSize: 22 }}>💵</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...T.bodyBold, color: C.text, marginBottom: 2 }}>Cash</Text>
                <Text style={{ ...T.caption, color: C.textDim }}>
                  {cashConfirming ? '⏳ Confirming...' : `Give ₹${fareNum} cash to driver`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.textDim} />
            </View>
          </Bouncy>

          {result ? <Text style={[s.err, { marginTop: 6 }]}>{result}</Text> : null}

          {/* Security footer */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.greenGlass, borderRadius: R.sm, padding: 12, marginTop: 8, borderWidth: 1.5, borderColor: C.greenBorder }}>
            <Ionicons name="shield-checkmark" size={18} color={C.green} />
            <Text style={{ ...T.caption, color: C.textMuted, flex: 1, lineHeight: 16 }}>
              Sppero's payment system is 100% secure · Razorpay PCI-DSS compliant
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenIn>
  );
}
