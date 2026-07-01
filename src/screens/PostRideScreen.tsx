import { useState } from 'react';
import { Animated, Modal, ScrollView, Share, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Storage as AsyncStorage } from '../storage';
import { useApp } from '../context/AppContext';
import { Bouncy, Confetti, DotBG, FadeIn, ScreenIn, TripSteps } from '../components/ui';
import { s, C } from '../styles';
import { API } from '../constants';
import { apiGet } from '../../api';

export function PostRideScreen() {
  const {
    phone,
    setScreen, setTab,
    pickup, drop,
    rideData, setRideData,
    paymentDone, setPaymentDone,
    rating, setRating,
    review, setReview,
    tip, setTip,
    scratchCard, setScratchCard,
    scratched, setScratched,
    scratchAnim,
    starAnims,
    animateStar, scratchNow,
    result, setResult,
    favouriteBuddy, addFavouriteBuddy,
    setPickup, setDrop, setEta,
    setPromoDiscount, setPromoCode,
    setDriverLoc, setDriverEta, setDriverDist,
    setUnreadChat,
    setCmpType, setCmpDesc,
    loadHistory, loadWallet,
    cashbackEarned, setCashbackEarned,
  } = useApp();

  const { useRideStore } = require('../../store');
  const ride = useRideStore();

  const [showBill, setShowBill] = useState(false);
  const [billData, setBillData] = useState<any>(null);
  const [billLoading, setBillLoading] = useState(false);

  const fareNum = Math.round(parseFloat(String(rideData?.fare ?? billData?.fare ?? 0).replace(/[^0-9.]/g, '')) || 0);
  const gstAmt = Math.round((fareNum * 5 / 105) * 100) / 100;
  const baseAmt = Math.round((fareNum - gstAmt) * 100) / 100;

  const openBill = async () => {
    setBillLoading(true);
    try {
      const d = await apiGet(`/api/rides/status/${rideData?.ride_id}`);
      setBillData(d.ride);
    } catch (_e) {
      setBillData(null);
    }
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

  const billId = '#SP' + String(rideData?.ride_id || '').slice(-8).toUpperCase();
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

_GST fare mein included hai — alag se charge nahi hota._

🙏 *Sppero* mein safar karne ka shukriya!`;

    Share.share({ message: text });
  };

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <Confetti />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ paddingTop: 52, paddingBottom: 36, backgroundColor: C.pink, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, alignItems: 'center', overflow: 'hidden' }}>
          <View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.10)', top: -80, right: -60 }} />
          <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)', bottom: -40, left: -40 }} />
          <Text style={{ fontSize: 60 }}>{paymentDone ? '✅' : '🎉'}</Text>
          <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff', marginTop: 10 }}>{paymentDone ? 'Payment Done!' : 'Pahunch Gaye!'}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 }}>{pickup} → {drop}</Text>
          <View style={{ marginTop: 12, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)' }}>
            <Text style={{ color: '#fff', fontSize: 32, fontWeight: '900' }}>{rideData?.fare}</Text>
          </View>

          <TouchableOpacity
            onPress={openBill}
            style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
            <Text style={{ fontSize: 16 }}>🧾</Text>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{billLoading ? 'Loading...' : 'Bill Dekho & Share'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 14, paddingTop: 16 }}>
          <TripSteps step={3} />
        </View>

        {scratchCard && (
          <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
            <Animated.View style={{ transform: [{ scale: scratched ? 1 : scratchAnim }] }}>
              <TouchableOpacity activeOpacity={0.85} onPress={scratchNow}
                style={[s.scratchCard, { backgroundColor: scratched ? C.greenGlass : C.yellow, borderWidth: 2, borderColor: scratched ? C.greenBorder : C.yellow, borderRadius: 20 }]}>
                {scratched ? (
                  <FadeIn style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 40 }}>🎉</Text>
                    <Text style={{ fontSize: 14, color: C.textMuted, marginTop: 6 }}>Aapko mila reward!</Text>
                    <Text style={{ fontSize: 42, fontWeight: '900', color: C.green, marginTop: 4, textShadowColor: C.green, textShadowRadius: 10 }}>₹{scratchCard.reward}</Text>
                    <Text style={{ fontSize: 12, color: C.green, marginTop: 4, fontWeight: '700' }}>✅ Wallet mein add ho gaya!</Text>
                  </FadeIn>
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 40 }}>🎟️</Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#000', marginTop: 6 }}>Scratch Card Jeeta!</Text>
                    <Text style={{ fontSize: 13, color: 'rgba(0,0,0,0.7)', marginTop: 4 }}>👆 Tap karke scratch karo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {cashbackEarned.length > 0 && (
          <FadeIn style={{ marginHorizontal: 14, marginTop: 14 }}>
            <View style={{ backgroundColor: C.greenGlass, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: C.greenBorder }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 24, marginRight: 8 }}>🎉</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.green, flex: 1 }}>Cashback Mila!</Text>
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
              <TouchableOpacity onPress={() => setScreen('rewards')}
                style={{ marginTop: 12, backgroundColor: C.green, borderRadius: 10, paddingVertical: 9, alignItems: 'center', elevation: 4, shadowColor: C.green, shadowOpacity: 0.35, shadowRadius: 8 }}>
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>View All Rewards →</Text>
              </TouchableOpacity>
            </View>
          </FadeIn>
        )}

        <View style={{ marginHorizontal: 14, marginTop: 16, backgroundColor: C.glass, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 14 }}>Driver ko Rate Karo</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16, gap: 4 }}>
            {[1,2,3,4,5].map(star => (
              <TouchableOpacity key={star} onPress={() => { setRating(star); animateStar(star - 1); }} style={{ padding: 3 }}>
                <Animated.Text style={{ fontSize: 38, color: star <= rating ? C.yellow : C.glassMid, transform: [{ scale: starAnims[star - 1] }] }}>★</Animated.Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[s.input, { height: 70, textAlignVertical: 'top', backgroundColor: C.glassMid, color: C.text, borderColor: C.glassBorder }]}
            placeholder="Comment (optional)..." placeholderTextColor={C.textDim}
            multiline value={review} onChangeText={setReview} />

          {rideData?.driver?.phone && (() => {
            const alreadyBuddy = favouriteBuddy?.driver_phone === rideData.driver.phone;
            return (
              <TouchableOpacity
                onPress={async () => {
                  if (alreadyBuddy) return;
                  const res = await addFavouriteBuddy(rideData.driver.phone);
                  if (res?.error) alert('⚠️ ' + res.error);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: alreadyBuddy ? C.greenGlass : C.yellowGlass, borderRadius: 14, padding: 12, marginVertical: 10, borderWidth: 1.5, borderColor: alreadyBuddy ? C.greenBorder : C.yellowBorder }}>
                <Text style={{ fontSize: 18, marginRight: 8 }}>{alreadyBuddy ? '✅' : '⭐'}</Text>
                <View>
                  <Text style={{ fontWeight: '800', fontSize: 13, color: alreadyBuddy ? C.green : C.yellow }}>
                    {alreadyBuddy ? 'Yeh aapka Sppero Buddy hai!' : `${rideData.driver.name} ko Sppero Buddy banao`}
                  </Text>
                  {!alreadyBuddy && <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Seedha inhe request bhej sakoge</Text>}
                </View>
              </TouchableOpacity>
            );
          })()}

          <Text style={{ fontSize: 14, fontWeight: '800', color: C.textMuted, marginTop: 8, marginBottom: 10 }}>💰 Tip do (optional)</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {[0, 10, 20, 50].map(t => (
              <TouchableOpacity key={t}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, alignItems: 'center',
                  backgroundColor: tip === t ? C.pinkGlass : C.glass,
                  borderColor: tip === t ? C.pinkBorder : C.glassBorder }}
                onPress={() => setTip(t)}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: tip === t ? C.pink : C.textMuted }}>{t === 0 ? 'Skip' : '₹' + t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={() => { setCmpType(''); setCmpDesc(''); setScreen('complaint-new'); }}
            style={{ backgroundColor: C.redGlass, borderRadius: 14, padding: 14, marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.redBorder }}>
            <Text style={{ fontSize: 18 }}>⚠️</Text>
            <Text style={{ color: C.red, fontWeight: '700', fontSize: 14 }}>Ride Issue? Complaint File Karo</Text>
          </TouchableOpacity>

          <Bouncy style={[s.btn, { marginTop: 14 }]} onPress={async () => {
            if (rating > 0 && rideData?.ride_id) {
              try { await fetch(`${API}/api/rides/rate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ride_id: rideData.ride_id, rating, review, tip }) }); } catch (_e) {}
            }
            setScreen('home'); setPickup(''); setDrop(''); setRating(0); setTab('home');
            setRideData(null); setPaymentDone(false); setResult(''); setScratchCard(null); setScratched(false); setEta(''); setPromoDiscount(0); setPromoCode(''); setUnreadChat(0); setCashbackEarned([]);
            setDriverLoc(null); setDriverEta(''); setDriverDist('');
            ride.clearRide();
            AsyncStorage.removeItem('activeStdRideId').catch(() => {});
            loadHistory(phone); loadWallet(phone);
          }}>
            <Text style={s.btnTxt}>Done 🏠 Home Jao</Text>
          </Bouncy>
        </View>
      </ScrollView>

      {/* Bill Modal */}
      <Modal visible={showBill} transparent animationType="slide" onRequestClose={() => setShowBill(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#0d0d1a', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 32 }}>

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
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>*Transparency ke liye only</Text>
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
                  GST fare mein included hai — alag se charge nahi hota.
                </Text>
              </View>

              {/* Buttons */}
              <TouchableOpacity onPress={shareBill}
                style={{ backgroundColor: '#25D366', borderRadius: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 6, shadowColor: '#25D366', shadowOpacity: 0.4, shadowRadius: 10 }}>
                <Text style={{ fontSize: 20 }}>📤</Text>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>WhatsApp par Share Karo</Text>
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
