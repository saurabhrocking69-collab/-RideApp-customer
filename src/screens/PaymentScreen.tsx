import { Animated, Image, Linking, Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, DotBG, ScreenIn } from '../components/ui';
import { s, C } from '../styles';
import { API } from '../constants';

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

  const driverUpiId = rideData?.driver?.upi_id || '';
  const fareNum = Math.round(parseFloat(String(rideData?.fare ?? '').replace(/[^0-9.]/g, '') || '0') || fareCount);
  const upiLink = driverUpiId
    ? `upi://pay?pa=${encodeURIComponent(driverUpiId)}&pn=${encodeURIComponent(rideData?.driver?.name || 'Driver')}&am=${fareNum}&cu=INR&tn=Sppero%20Trip`
    : '';
  const qrUrl = driverUpiId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(upiLink)}`
    : '';

  const confirmUpiQrPaid = async () => {
    try {
      await fetch(`${API}/api/rides/payment-complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, payment_method: 'upi_qr', phone: phone || '9999999999' }) });
    } catch (_e) {}
    setShowUpiQr(false);
    setPaymentDone(true); setScreen('postride'); createScratchCard();
  };

  const walletSufficient = walletBalance >= fareNum;
  const cashback = Math.max(5, Math.min(50, Math.round(fareNum * 0.05)));

  const payOptions = [
    {
      color: C.pink, glassColor: C.pinkGlass, border: C.pinkBorder,
      icon: '💰', title: 'Wallet se Pay',
      sub: `Balance: ₹${walletBalance}${walletSufficient ? '' : ' (Balance kam hai)'}`,
      badge: `🎁 ₹${cashback} scratch card milega`,
      badgeColor: C.green,
      recommended: walletSufficient,
      disabled: !walletSufficient,
      fn: payWithWallet,
    },
    ...(driverUpiId ? [{
      color: C.purple, glassColor: C.glassMid, border: C.glassBorder,
      icon: '📱', title: 'UPI QR Scan',
      sub: `Driver ka QR scan karo — ₹${fareNum}`,
      badge: null, badgeColor: null, recommended: false, disabled: false,
      fn: () => setShowUpiQr(true),
    }] : []),
    {
      color: C.bgCard, glassColor: C.glassMid, border: C.glassBorder,
      icon: '💳', title: 'Online Pay',
      sub: 'UPI / Card (Razorpay)',
      badge: null, badgeColor: null, recommended: false, disabled: false,
      fn: handlePayment,
    },
    {
      color: C.green, glassColor: C.greenGlass, border: C.greenBorder,
      icon: '💵', title: 'Cash Pay',
      sub: 'Driver ko haath mein cash do',
      badge: null, badgeColor: null, recommended: false, disabled: false,
      fn: async () => {
        try { await fetch(`${API}/api/rides/payment-complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, payment_method: 'cash', phone: phone || '9999999999' }) }); } catch (_e) {}
        setPaymentDone(true); setScreen('postride'); createScratchCard();
      },
    },
  ];

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      {showUpiQr && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.bg, zIndex: 999, justifyContent: 'space-between' }}>
          <DotBG />
          <View style={{ backgroundColor: C.pink, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 14 : 56, paddingBottom: 18, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}>
            <TouchableOpacity onPress={() => setShowUpiQr(false)} style={{ marginRight: 14, padding: 8, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 10 }}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', flex: 1 }}>UPI QR Se Pay Karo</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: C.pinkGlass, borderRadius: 20, paddingHorizontal: 28, paddingVertical: 12, marginBottom: 24, elevation: 4, shadowColor: C.pink, shadowOpacity: 0.15, shadowRadius: 8, borderWidth: 2, borderColor: C.pinkBorder }}>
              <Text style={{ color: C.pink, fontSize: 32, fontWeight: '900' }}>₹{fareNum}</Text>
            </View>
            {driverUpiId ? (
              <View style={{ backgroundColor: C.glassMid, borderRadius: 24, padding: 16, elevation: 8, borderWidth: 1, borderColor: C.glassBorder, alignItems: 'center' }}>
                <Image source={{ uri: qrUrl }} style={{ width: 250, height: 250, borderRadius: 16 }} resizeMode="contain" />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
                  <Text style={{ fontSize: 13, color: C.textMuted, fontWeight: '600' }}>Scan with any UPI app</Text>
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: C.yellowGlass, borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: C.yellowBorder }}>
                <Text style={{ fontSize: 36 }}>⚠️</Text>
                <Text style={{ fontSize: 14, color: C.yellow, textAlign: 'center', marginTop: 10, fontWeight: '600' }}>Driver ka UPI set nahi hai{'\n'}Cash ya Wallet use karo</Text>
              </View>
            )}
            <Text style={{ fontSize: 12, color: C.textDim, marginTop: 20, letterSpacing: 0.5 }}>GPay · PhonePe · Paytm · BHIM · Koi bhi UPI app</Text>
            <Text style={{ fontSize: 12, color: C.textDim, marginTop: 6 }}>{driverUpiId}</Text>
            {driverUpiId ? (
              <TouchableOpacity onPress={() => Linking.openURL(upiLink)}
                style={{ marginTop: 16, backgroundColor: C.bgCard, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.glassBorder }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>📱 UPI App Mein Kholo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={{ padding: 16, paddingBottom: 32, gap: 10 }}>
            <TouchableOpacity onPress={confirmUpiQrPaid}
              style={{ backgroundColor: C.green, borderRadius: 16, padding: 18, alignItems: 'center', elevation: 6, shadowColor: C.green, shadowOpacity: 0.4, shadowRadius: 10 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>✅ Maine Pay Kar Diya — ₹{fareNum}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowUpiQr(false)} style={{ borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: C.textMuted, fontSize: 13 }}>← Wapas Jao</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={[s.hero, { paddingTop: 40, paddingBottom: 16, backgroundColor: C.bgDeep, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }]}>
          <Text style={{ fontSize: 40 }}>🏁</Text>
          <Text style={[s.heroTitle, { color: C.text }]}>Trip Complete!</Text>
          <Text style={[s.heroSub, { color: C.textMuted }]} numberOfLines={1}>{pickup} → {drop}</Text>
          <Animated.Text style={{ color: C.yellow, fontSize: 36, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 }}>₹{fareCount}</Animated.Text>
          {walletSufficient && (
            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(22,163,74,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(22,163,74,0.3)' }}>
              <Text style={{ fontSize: 14 }}>🎁</Text>
              <Text style={{ color: C.green, fontSize: 11, fontWeight: '700' }}>Wallet se pay karo — scratch card milega!</Text>
            </View>
          )}
        </View>

        <View style={{ padding: 16, gap: 10 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 2, marginLeft: 2 }}>PAYMENT CHOOSE KARO</Text>
          {payOptions.map((p, i) => (
            <Bouncy key={i} onPress={p.disabled ? undefined : p.fn} style={{ opacity: p.disabled ? 0.45 : 1 }}>
              <View style={{
                backgroundColor: p.glassColor, borderRadius: 16, padding: 14,
                flexDirection: 'row', alignItems: 'center',
                borderWidth: p.recommended ? 1.5 : 1, borderColor: p.border,
                elevation: p.recommended ? 3 : 1,
                shadowColor: p.color, shadowOpacity: p.recommended ? 0.1 : 0.04, shadowRadius: 4,
              }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${p.color}18`, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 20 }}>{p.icon}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>{p.title}</Text>
                    {p.recommended && (
                      <View style={{ backgroundColor: C.greenGlass, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: C.greenBorder }}>
                        <Text style={{ fontSize: 9, color: C.green, fontWeight: '900' }}>RECOMMENDED</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{p.sub}</Text>
                  {p.badge && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Text style={{ fontSize: 11, color: p.badgeColor, fontWeight: '700' }}>{p.badge}</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
              </View>
            </Bouncy>
          ))}
          {result ? <Text style={s.err}>{result}</Text> : null}
        </View>
      </ScrollView>
    </ScreenIn>
  );
}
