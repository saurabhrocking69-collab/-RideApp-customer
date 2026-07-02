import { Animated, Dimensions, Linking, Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, DotBG, ScreenIn } from '../components/ui';
import { s, C } from '../styles';
import { apiPost } from '../../api';

const { width: W } = Dimensions.get('window');
const SB_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0;

// ── UPI App tiles config ──────────────────────────────────────────────────────
const UPI_APPS = [
  { id: 'phonepe', name: 'PhonePe',    icon: '🟣', color: '#6B21A8', bg: '#F3E8FF', border: '#A855F7' },
  { id: 'gpay',    name: 'Google Pay', icon: '🔵', color: '#1D4ED8', bg: '#EFF6FF', border: '#3B82F6' },
  { id: 'paytm',   name: 'Paytm',      icon: '🔷', color: '#0369A1', bg: '#E0F2FE', border: '#0EA5E9' },
  { id: 'bhim',    name: 'BHIM UPI',   icon: '🟠', color: '#B45309', bg: '#FFF7ED', border: '#F59E0B' },
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
  const fareNum = Math.round(
    parseFloat(String(rideData?.fare ?? '').replace(/[^0-9.]/g, '') || '0') || fareCount
  );
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
    <ScreenIn style={{ flex: 1, backgroundColor: '#0A0A14' }}>
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
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 1 }}>Koi bhi UPI app se scan karo</Text>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, backgroundColor: '#F0FDF4', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#16A34A' }} />
                <Text style={{ color: '#15803D', fontSize: 11, fontWeight: '700' }}>Secure UPI Payment</Text>
              </View>
              <Text style={{ color: '#94A3B8', fontSize: 10, marginTop: 6 }}>{driverUpiId}</Text>
            </View>

            {/* UPI App row */}
            <View style={{ marginTop: 22, marginBottom: 8 }}>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700', textAlign: 'center', letterSpacing: 1, marginBottom: 12 }}>
                IN CASE UN APPS SE SCAN KARO
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
                UPI App Mein Seedha Kholo
              </Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          </>
        ) : (
          <View style={{ backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.3)' }}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>⚠️</Text>
            <Text style={{ color: '#F59E0B', fontSize: 15, fontWeight: '800', textAlign: 'center' }}>Driver ka UPI ID set nahi hai</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', marginTop: 6 }}>Cash ya Wallet se pay karo</Text>
          </View>
        )}
      </ScrollView>

      {/* Confirm button */}
      <View style={{ padding: 16, paddingBottom: 32, gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' }}>
        <TouchableOpacity
          onPress={confirmUpiQrPaid}
          disabled={upiConfirming}
          style={{
            backgroundColor: upiConfirming ? 'rgba(255,255,255,0.08)' : '#16A34A',
            borderRadius: 20, padding: 18, alignItems: 'center',
            elevation: upiConfirming ? 0 : 10,
            shadowColor: '#16A34A', shadowOpacity: 0.45, shadowRadius: 14,
            borderWidth: upiConfirming ? 1 : 0, borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>
            {upiConfirming ? '⏳ Confirm ho raha hai...' : `✅  Maine Pay Kar Diya — ₹${fareNum}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowUpiQr(false)} style={{ alignItems: 'center', padding: 10 }}>
          <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>← Wapas Jao</Text>
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
            <View style={{ marginTop: 12, backgroundColor: 'rgba(22,163,74,0.88)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 4, shadowColor: '#16a34a', shadowOpacity: 0.5, shadowRadius: 8 }}>
              <Text style={{ fontSize: 16 }}>💰</Text>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12, flex: 1 }}>Wallet se pay karo · ₹{cashback} scratch card milega!</Text>
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
                <Text style={{ color: C.text, fontSize: 17, fontWeight: '900', flex: 1 }}>UPI Se Pay Karo</Text>
                <View style={{ backgroundColor: '#16A34A', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
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
                      borderWidth: 2, borderColor: app.border + '55',
                      elevation: 3, shadowColor: app.color, shadowOpacity: 0.12, shadowRadius: 8,
                    }}
                  >
                    <Text style={{ fontSize: 34, marginBottom: 8 }}>{app.icon}</Text>
                    <Text style={{ color: app.color, fontSize: 15, fontWeight: '900', marginBottom: 3 }}>{app.name}</Text>
                    <Text style={{ color: app.color + 'BB', fontSize: 11, fontWeight: '600' }}>₹{fareNum} tap karo</Text>
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
                  <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>Kisi bhi UPI app se scan karo</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 12, padding: 8 }}>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </View>
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.25)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 28 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#B45309', fontSize: 14, fontWeight: '800' }}>UPI Available Nahi</Text>
                <Text style={{ color: '#92400E', fontSize: 12, marginTop: 2 }}>Driver ka UPI nahi hai — Wallet ya Cash use karo</Text>
              </View>
            </View>
          )}

          {/* ── Divider ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>DUSRE TARIKE</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
          </View>

          {/* ── Wallet — highlighted card ── */}
          <Bouncy onPress={walletSufficient ? payWithWallet : undefined} style={{ marginBottom: 12 }}>
            <View style={{ borderRadius: 22, overflow: 'hidden', elevation: walletSufficient ? 8 : 2, shadowColor: '#16A34A', shadowOpacity: walletSufficient ? 0.28 : 0, shadowRadius: 12 }}>
              {/* Cashback banner — always visible */}
              <View style={{ backgroundColor: walletSufficient ? '#16A34A' : '#94A3B8', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, gap: 6 }}>
                <Text style={{ fontSize: 14 }}>🎁</Text>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900', flex: 1 }}>
                  ₹5 Cashback Instantly — Wallet se pay karo!
                </Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>BEST DEAL</Text>
                </View>
              </View>

              {/* Card body */}
              <View style={{
                padding: 16, flexDirection: 'row', alignItems: 'center',
                backgroundColor: walletSufficient ? '#F0FDF4' : '#F8FAFC',
                borderWidth: walletSufficient ? 2 : 1,
                borderTopWidth: 0,
                borderColor: walletSufficient ? '#22C55E' : '#E2E8F0',
              }}>
                {/* Wallet icon */}
                <View style={{
                  width: 54, height: 54, borderRadius: 18, marginRight: 14,
                  backgroundColor: walletSufficient ? '#DCFCE7' : '#F1F5F9',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: walletSufficient ? '#86EFAC' : '#E2E8F0',
                }}>
                  <Text style={{ fontSize: 24 }}>💰</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ color: C.text, fontWeight: '900', fontSize: 16 }}>Sppero Wallet</Text>
                    {walletSufficient && (
                      <View style={{ backgroundColor: '#22C55E', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>TAP TO PAY</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: walletSufficient ? '#15803D' : '#94A3B8', fontSize: 13, fontWeight: '700' }}>
                    Balance: ₹{walletBalance}
                    {walletSufficient ? ` · Covers ₹${fareNum} ✓` : ' — balance kam hai'}
                  </Text>
                  {walletSufficient ? (
                    <Text style={{ color: '#16A34A', fontSize: 12, marginTop: 3, fontWeight: '600' }}>
                      + ₹5 scratch card turant milega 🎉
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={() => setScreen('wallet')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ color: C.pink, fontSize: 13, fontWeight: '900', marginTop: 4 }}>
                        + Recharge Karo & ₹5 Cashback Pao →
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Ionicons
                  name={walletSufficient ? 'arrow-forward-circle' : 'chevron-forward'}
                  size={walletSufficient ? 32 : 22}
                  color={walletSufficient ? '#22C55E' : '#CBD5E1'}
                />
              </View>
            </View>
          </Bouncy>

          {/* ── Online / Razorpay ── */}
          <Bouncy onPress={handlePayment} style={{ marginBottom: 10 }}>
            <View style={{ borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }}>
              <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 22 }}>💳</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '900', fontSize: 15, marginBottom: 2 }}>Online Payment</Text>
                <Text style={{ color: '#94A3B8', fontSize: 11 }}>Razorpay · Card · Net Banking</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </View>
          </Bouncy>

          {/* ── Cash ── */}
          <Bouncy onPress={payWithCash} style={{ opacity: cashConfirming ? 0.6 : 1, marginBottom: 10 }}>
            <View style={{ borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }}>
              <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 22 }}>💵</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '900', fontSize: 15, marginBottom: 2 }}>Cash</Text>
                <Text style={{ color: '#94A3B8', fontSize: 11 }}>
                  {cashConfirming ? '⏳ Confirming...' : `Driver ko ₹${fareNum} naqdh do`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </View>
          </Bouncy>

          {result ? <Text style={[s.err, { marginTop: 6 }]}>{result}</Text> : null}

          {/* Security footer */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
            <Ionicons name="shield-checkmark" size={18} color="#16A34A" />
            <Text style={{ color: '#64748B', fontSize: 11, flex: 1, lineHeight: 16 }}>
              Sppero ka payment system 100% secure hai · Razorpay PCI-DSS compliant
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenIn>
  );
}
