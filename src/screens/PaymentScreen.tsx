import { Animated, Image, Linking, Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, DotBG, ScreenIn } from '../components/ui';
import { s, C } from '../styles';
import { apiPost } from '../../api';

export function PaymentScreen() {
  const {
    phone,
    setScreen,
    pickup, drop,
    rideData,
    fareCount,
    walletBalance,
    showUpiQr, setShowUpiQr,
    paymentDone, setPaymentDone,
    result,
    handlePayment, payWithWallet, createScratchCard,
  } = useApp();

  const [cashConfirming, setCashConfirming] = useState(false);
  const [upiConfirming, setUpiConfirming]   = useState(false);

  const driverUpiId = rideData?.driver?.upi_id || '';
  const fareNum = Math.round(parseFloat(String(rideData?.fare ?? '').replace(/[^0-9.]/g, '') || '0') || fareCount);
  const upiLink = driverUpiId
    ? `upi://pay?pa=${encodeURIComponent(driverUpiId)}&pn=${encodeURIComponent(rideData?.driver?.name || 'Driver')}&am=${fareNum}&cu=INR&tn=Sppero%20Trip`
    : '';
  const qrUrl = driverUpiId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=12&data=${encodeURIComponent(upiLink)}`
    : '';

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

  const walletSufficient = walletBalance >= fareNum;
  const cashback = Math.max(5, Math.min(50, Math.round(fareNum * 0.05)));

  const payWithCash = async () => {
    if (cashConfirming) return;
    setCashConfirming(true);
    try {
      await apiPost('/api/rides/payment-complete', { ride_id: rideData.ride_id, payment_method: 'cash', phone: phone || '9999999999' });
    } catch (_e) {}
    setCashConfirming(false);
    setPaymentDone(true); setScreen('postride'); createScratchCard();
  };

  const SB_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0;

  // ─── UPI QR full-screen overlay ───
  if (showUpiQr) return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={{ backgroundColor: C.pink, paddingTop: SB_HEIGHT + 14, paddingBottom: 20, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}>
        <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.1)', top: -60, right: -40 }} />
        <TouchableOpacity onPress={() => setShowUpiQr(false)}
          style={{ marginRight: 14, padding: 9, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>UPI / QR Se Pay Karo</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 }}>Koi bhi UPI app use karo</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }}>
        {/* Amount chip */}
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
          <View style={{ backgroundColor: C.pinkGlass, borderRadius: 20, paddingHorizontal: 28, paddingVertical: 14, borderWidth: 2, borderColor: C.pinkBorder, elevation: 6, shadowColor: C.pink, shadowOpacity: 0.25, shadowRadius: 10 }}>
            <Text style={{ color: C.pink, fontSize: 42, fontWeight: '900', textAlign: 'center' }}>₹{fareNum}</Text>
            <Text style={{ color: C.textMuted, fontSize: 11, textAlign: 'center', marginTop: 2 }}>Driver: {rideData?.driver?.name || '–'}</Text>
          </View>
        </View>

        {driverUpiId ? (
          <View style={{ alignItems: 'center' }}>
            <View style={{ backgroundColor: C.glassMid, borderRadius: 24, padding: 18, elevation: 8, borderWidth: 1.5, borderColor: C.glassBorder, alignItems: 'center', width: '100%', maxWidth: 320, alignSelf: 'center' }}>
              <Image source={{ uri: qrUrl }} style={{ width: 252, height: 252, borderRadius: 16 }} resizeMode="contain" />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
                <Text style={{ fontSize: 12, color: C.textMuted, fontWeight: '600' }}>Scan with any UPI app</Text>
              </View>
              <Text style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{driverUpiId}</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map(app => (
                <View key={app} style={{ backgroundColor: C.glassMid, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: C.glassBorder }}>
                  <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: '600' }}>{app}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity onPress={() => Linking.openURL(upiLink)}
              style={{ marginTop: 14, backgroundColor: C.glass, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.glassBorder }}>
              <Text style={{ fontSize: 18 }}>📱</Text>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>UPI App Mein Seedha Kholo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ backgroundColor: C.yellowGlass, borderRadius: 18, padding: 24, alignItems: 'center', borderWidth: 1.5, borderColor: C.yellowBorder }}>
            <Text style={{ fontSize: 40 }}>⚠️</Text>
            <Text style={{ fontSize: 14, color: C.yellow, textAlign: 'center', marginTop: 10, fontWeight: '700' }}>Driver ka UPI set nahi hai</Text>
            <Text style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: 6 }}>Cash ya Wallet se pay karo</Text>
          </View>
        )}
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: 32, gap: 10 }}>
        <TouchableOpacity onPress={confirmUpiQrPaid} disabled={upiConfirming}
          style={{ backgroundColor: upiConfirming ? C.glass : C.green, borderRadius: 18, padding: 18, alignItems: 'center', elevation: upiConfirming ? 0 : 8, shadowColor: C.green, shadowOpacity: 0.4, shadowRadius: 12, borderWidth: upiConfirming ? 1 : 0, borderColor: C.glassBorder }}>
          <Text style={{ color: upiConfirming ? C.textMuted : '#fff', fontSize: 17, fontWeight: '900' }}>
            {upiConfirming ? '⏳ Confirm ho raha hai...' : `✅  Maine Pay Kar Diya — ₹${fareNum}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowUpiQr(false)} style={{ borderRadius: 12, padding: 12, alignItems: 'center' }}>
          <Text style={{ color: C.textMuted, fontSize: 14 }}>← Wapas Jao</Text>
        </TouchableOpacity>
      </View>
    </ScreenIn>
  );

  // ─── Main payment screen ───
  return (
    <ScreenIn style={s.screen}>
      <DotBG />

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}>

        {/* ── Hero: big fare + route ── */}
        <View style={{ backgroundColor: C.pink, paddingTop: SB_HEIGHT + 18, paddingBottom: 28, paddingHorizontal: 20, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.09)', top: -90, right: -70 }} />
          <View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -60, left: -30 }} />

          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 2, textAlign: 'center', marginBottom: 8, textTransform: 'uppercase' }}>Trip Complete · Payment Karo</Text>

          <Animated.Text style={{ color: '#fff', fontSize: 68, fontWeight: '900', textAlign: 'center', letterSpacing: -1 }}>
            ₹{fareCount}
          </Animated.Text>

          {/* Route */}
          <View style={{ backgroundColor: 'rgba(255,255,255,0.17)', borderRadius: 14, padding: 12, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 2 }}>FROM</Text>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{pickup}</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 20, marginHorizontal: 4 }}>→</Text>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 2 }}>TO</Text>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{drop}</Text>
            </View>
          </View>

          {/* Wallet promo chip */}
          {walletSufficient && (
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <View style={{ backgroundColor: 'rgba(22,163,74,0.9)', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 4, shadowColor: '#16a34a', shadowOpacity: 0.5, shadowRadius: 8 }}>
                <Text style={{ fontSize: 15 }}>💰</Text>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Wallet se pay karo · ₹{cashback} scratch milega!</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Payment Options ── */}
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: C.textDim, letterSpacing: 1.8, marginBottom: 2, textTransform: 'uppercase' }}>Payment Method</Text>

          {/* ── Wallet ── */}
          <Bouncy onPress={walletSufficient ? payWithWallet : undefined} style={{ opacity: walletSufficient ? 1 : 0.6 }}>
            <View style={{
              borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center',
              backgroundColor: walletSufficient ? 'rgba(22,163,74,0.10)' : C.glassMid,
              borderWidth: walletSufficient ? 2 : 1,
              borderColor: walletSufficient ? '#22c55e' : C.glassBorder,
              elevation: walletSufficient ? 6 : 1,
              shadowColor: '#22c55e', shadowOpacity: walletSufficient ? 0.25 : 0, shadowRadius: 10,
            }}>
              <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: walletSufficient ? 'rgba(22,163,74,0.2)' : C.glass, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <Text style={{ fontSize: 26 }}>💰</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <Text style={{ color: C.text, fontWeight: '900', fontSize: 16 }}>Wallet</Text>
                  {walletSufficient && (
                    <View style={{ backgroundColor: '#22c55e', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>BEST</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: walletSufficient ? '#86efac' : C.textMuted, fontSize: 12 }}>
                  Balance: ₹{walletBalance}{walletSufficient ? ` — covers ₹${fareNum}` : ' — balance kam hai'}
                </Text>
                {walletSufficient
                  ? <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700', marginTop: 3 }}>🎁 ₹{cashback} scratch card milega!</Text>
                  : <TouchableOpacity onPress={() => setScreen('wallet')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ color: C.pink, fontSize: 12, fontWeight: '800', marginTop: 4 }}>+ Recharge Karo →</Text>
                    </TouchableOpacity>
                }
              </View>
              <Ionicons
                name={walletSufficient ? 'arrow-forward-circle' : 'chevron-forward'}
                size={walletSufficient ? 30 : 20}
                color={walletSufficient ? '#22c55e' : C.textDim}
              />
            </View>
          </Bouncy>

          {/* ── UPI QR (only if driver has UPI) ── */}
          {driverUpiId ? (
            <Bouncy onPress={() => setShowUpiQr(true)}>
              <View style={{ borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: C.glassMid, borderWidth: 1, borderColor: C.glassBorder }}>
                <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(139,92,246,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Text style={{ fontSize: 26 }}>📱</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '900', fontSize: 16, marginBottom: 3 }}>UPI / QR Scan</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>GPay · PhonePe · Paytm · Any UPI app</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={C.textDim} />
              </View>
            </Bouncy>
          ) : null}

          {/* ── Online / Razorpay ── */}
          <Bouncy onPress={handlePayment}>
            <View style={{ borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: C.glassMid, borderWidth: 1, borderColor: C.glassBorder }}>
              <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(59,130,246,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <Text style={{ fontSize: 26 }}>💳</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '900', fontSize: 16, marginBottom: 3 }}>Online Pay</Text>
                <Text style={{ color: C.textMuted, fontSize: 12 }}>Razorpay · UPI · Debit / Credit Card</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.textDim} />
            </View>
          </Bouncy>

          {/* ── Cash ── */}
          <Bouncy onPress={payWithCash} style={{ opacity: cashConfirming ? 0.6 : 1 }}>
            <View style={{ borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: C.glassMid, borderWidth: 1, borderColor: C.glassBorder }}>
              <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(16,185,129,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <Text style={{ fontSize: 26 }}>💵</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '900', fontSize: 16, marginBottom: 3 }}>Cash</Text>
                <Text style={{ color: C.textMuted, fontSize: 12 }}>{cashConfirming ? '⏳ Confirming...' : `Driver ko haath mein ₹${fareNum} do`}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.textDim} />
            </View>
          </Bouncy>

          {result ? <Text style={s.err}>{result}</Text> : null}

          {/* Security note */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.glass, borderRadius: 14, padding: 12, marginTop: 4, borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ fontSize: 16 }}>🔒</Text>
            <Text style={{ color: C.textDim, fontSize: 11, flex: 1, lineHeight: 16 }}>
              Aapka payment 100% secure hai. Razorpay PCI-DSS compliant payment gateway use karta hai.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenIn>
  );
}
