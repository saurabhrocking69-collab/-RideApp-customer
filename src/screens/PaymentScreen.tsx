import { Animated, Image, Linking, Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, ScreenIn } from '../components/ui';
import { s } from '../styles';
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
  const fareNum = parseInt(String(rideData?.fare).replace(/[^0-9]/g, '')) || fareCount;
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

  return (
    <ScreenIn style={s.screen}>
      {showUpiQr && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', zIndex: 999, justifyContent: 'space-between' }}>
          <View style={{ backgroundColor: '#1a1a2e', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 14 : 52, paddingBottom: 18, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setShowUpiQr(false)} style={{ marginRight: 14, padding: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10 }}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 }}>UPI QR Se Pay Karo</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#e94560', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, marginBottom: 24 }}>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>₹{fareNum}</Text>
            </View>
            {driverUpiId ? (
              <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 16, elevation: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, alignItems: 'center' }}>
                <Image source={{ uri: qrUrl }} style={{ width: 250, height: 250 }} resizeMode="contain" />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' }} />
                  <Text style={{ fontSize: 13, color: '#666', fontWeight: '600' }}>Scan with any UPI app</Text>
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: '#fff3e0', borderRadius: 16, padding: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 36 }}>⚠️</Text>
                <Text style={{ fontSize: 14, color: '#e65100', textAlign: 'center', marginTop: 10, fontWeight: '600' }}>Driver ka UPI set nahi hai{'\n'}Cash ya Wallet use karo</Text>
              </View>
            )}
            <Text style={{ fontSize: 12, color: '#bbb', marginTop: 20, letterSpacing: 0.5 }}>GPay · PhonePe · Paytm · BHIM · Koi bhi UPI app</Text>
            <Text style={{ fontSize: 12, color: '#999', marginTop: 6 }}>{driverUpiId}</Text>
            {driverUpiId ? (
              <TouchableOpacity onPress={() => Linking.openURL(upiLink)}
                style={{ marginTop: 16, backgroundColor: '#1a1a2e', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>📱 UPI App Mein Kholo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={{ padding: 16, paddingBottom: 32, gap: 10 }}>
            <TouchableOpacity onPress={confirmUpiQrPaid}
              style={{ backgroundColor: '#4CAF50', borderRadius: 16, padding: 18, alignItems: 'center', elevation: 4 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>✅ Maine Pay Kar Diya — ₹{fareNum}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowUpiQr(false)}
              style={{ borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: '#bbb', fontSize: 13 }}>← Wapas Jao</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={[s.hero, { paddingTop: 50 }]}>
          <Text style={{ fontSize: 55 }}>🎉</Text>
          <Text style={s.heroTitle}>Trip Complete!</Text>
          <Text style={s.heroSub}>{pickup} → {drop}</Text>
          <Animated.Text style={{ color: '#e94560', fontSize: 42, fontWeight: 'bold', marginTop: 6 }}>₹{fareCount}</Animated.Text>
        </View>
        <View style={s.card}>
          <Text style={[s.secTitle, { textAlign: 'center' }]}>Payment Method Choose Karo</Text>
          {[
            { color: '#e94560', icon: '💰', title: 'Wallet se Pay', sub: `Balance: ₹${walletBalance}`, fn: payWithWallet },
            ...(driverUpiId ? [{ color: '#1565c0', icon: '📱', title: 'UPI QR Scan', sub: `Driver ka QR scan karo — ₹${fareNum}`, fn: () => setShowUpiQr(true) }] : []),
            { color: '#1a1a2e', icon: '💳', title: 'Online Pay', sub: 'UPI / Card (Razorpay)', fn: handlePayment },
            { color: '#4CAF50', icon: '💵', title: 'Cash Pay', sub: 'Driver ko haath mein cash do', fn: async () => {
              try { await fetch(`${API}/api/rides/payment-complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, payment_method: 'cash', phone: phone || '9999999999' }) }); } catch (_e) {}
              setPaymentDone(true); setScreen('postride'); createScratchCard();
            }},
          ].map((p, i) => (
            <Bouncy key={i} style={[s.payBtn, { backgroundColor: p.color }]} onPress={p.fn}>
              <Text style={{ fontSize: 20 }}>{p.icon}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}><Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{p.title}</Text><Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 }}>{p.sub}</Text></View>
              <Text style={{ color: '#fff', fontSize: 18 }}>→</Text>
            </Bouncy>
          ))}
          {result ? <Text style={s.err}>{result}</Text> : null}
        </View>
      </ScrollView>
    </ScreenIn>
  );
}
