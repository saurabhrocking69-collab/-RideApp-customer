import { Animated, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { Bouncy, Confetti, FadeIn, ScreenIn, TripSteps } from '../components/ui';
import { s } from '../styles';
import { API } from '../constants';

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

  return (
    <ScreenIn style={s.screen}>
      <Confetti />
      <View style={{ flex: 1 }}>
        <View style={[s.hero, { paddingTop: 44 }]}>
          <Text style={{ fontSize: 50 }}>{paymentDone ? '✅' : '🎉'}</Text>
          <Text style={s.heroTitle}>{paymentDone ? 'Payment Done!' : 'Pahunch Gaye!'}</Text>
          <Text style={s.heroSub}>{pickup} → {drop}</Text>
          <Text style={{ color: '#e94560', fontSize: 26, fontWeight: 'bold', marginTop: 6 }}>{rideData?.fare}</Text>
        </View>
        <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
          <TripSteps step={3} />
        </View>
        {scratchCard && (
          <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
            <Animated.View style={{ transform: [{ scale: scratched ? 1 : scratchAnim }] }}>
              <TouchableOpacity activeOpacity={0.85} onPress={scratchNow} style={[s.scratchCard, { backgroundColor: scratched ? '#fff' : '#f0a500' }]}>
                {scratched ? (
                  <FadeIn style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 40 }}>🎉</Text>
                    <Text style={{ fontSize: 14, color: '#888', marginTop: 6 }}>Aapko mila reward!</Text>
                    <Text style={{ fontSize: 40, fontWeight: 'bold', color: '#4CAF50', marginTop: 4 }}>₹{scratchCard.reward}</Text>
                    <Text style={{ fontSize: 12, color: '#4CAF50', marginTop: 4, fontWeight: '600' }}>✅ Wallet mein add ho gaya!</Text>
                  </FadeIn>
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 40 }}>🎟️</Text>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 6 }}>Scratch Card Jeeta!</Text>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>👆 Tap karke scratch karo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
        {cashbackEarned.length > 0 && (
          <FadeIn style={{ marginHorizontal: 14, marginTop: 14 }}>
            <View style={{ backgroundColor: '#E8F5E9', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#4CAF50' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 24, marginRight: 8 }}>🎉</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#2E7D32', flex: 1 }}>Cashback Mila!</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#2E7D32' }}>
                  +₹{cashbackEarned.reduce((s, c) => s + c.amount, 0)}
                </Text>
              </View>
              {cashbackEarned.map((c, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50', marginRight: 8 }} />
                  <Text style={{ fontSize: 12, color: '#2E7D32', flex: 1 }}>{c.label}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#2E7D32' }}>+₹{c.amount}</Text>
                </View>
              ))}
              <TouchableOpacity onPress={() => setScreen('rewards')}
                style={{ marginTop: 12, backgroundColor: '#4CAF50', borderRadius: 10, paddingVertical: 9, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>View All Rewards →</Text>
              </TouchableOpacity>
            </View>
          </FadeIn>
        )}
        <View style={[s.card, { marginTop: 14 }]}>
          <Text style={[s.secTitle, { textAlign: 'center' }]}>Driver ko Rate Karo</Text>
          <View style={[s.row, { justifyContent: 'center', marginBottom: 14 }]}>
            {[1,2,3,4,5].map(star => (
              <TouchableOpacity key={star} onPress={() => { setRating(star); animateStar(star-1); }} style={{ padding: 3 }}>
                <Animated.Text style={{ fontSize: 36, color: star<=rating ? '#f0a500' : '#e0e0e0', transform: [{ scale: starAnims[star-1] }] }}>★</Animated.Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]} placeholder="Comment (optional)..." multiline value={review} onChangeText={setReview} />

          {rideData?.driver?.phone && (() => {
            const alreadyBuddy = favouriteBuddy?.driver_phone === rideData.driver.phone;
            return (
              <TouchableOpacity
                onPress={async () => {
                  if (alreadyBuddy) return;
                  const res = await addFavouriteBuddy(rideData.driver.phone);
                  if (res?.error) alert('⚠️ ' + res.error);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: alreadyBuddy ? '#e8f5e9' : '#fff8e1', borderRadius: 12, padding: 12, marginVertical: 10, borderWidth: 1.5, borderColor: alreadyBuddy ? '#4CAF50' : '#f0a500' }}>
                <Text style={{ fontSize: 18, marginRight: 8 }}>{alreadyBuddy ? '✅' : '⭐'}</Text>
                <View>
                  <Text style={{ fontWeight: '800', fontSize: 13, color: alreadyBuddy ? '#2e7d32' : '#b8860b' }}>
                    {alreadyBuddy ? 'Yeh aapka Sppero Buddy hai!' : `${rideData.driver.name} ko Sppero Buddy banao`}
                  </Text>
                  {!alreadyBuddy && <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Seedha inhe request bhej sakoge</Text>}
                </View>
              </TouchableOpacity>
            );
          })()}

          <Text style={s.secTitle}>💰 Tip do (optional)</Text>
          <View style={[s.row, { gap: 8, marginBottom: 14 }]}>
            {[0,10,20,50].map(t => (
              <TouchableOpacity key={t} style={[s.tipBtn, tip===t && { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' }]} onPress={() => setTip(t)}>
                <Text style={[{ fontSize: 13, fontWeight: '600', color: '#555' }, tip===t && { color: '#fff' }]}>{t===0 ? 'Skip' : '₹'+t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={() => { setCmpType(''); setCmpDesc(''); setScreen('complaint-new'); }}
            style={{ backgroundColor: '#fff8f8', borderRadius: 12, padding: 14, marginTop: 10, marginHorizontal: 0, borderWidth: 1.5, borderColor: '#e94560', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Text style={{ fontSize: 18 }}>⚠️</Text>
            <Text style={{ color: '#e94560', fontWeight: '700', fontSize: 14 }}>Ride Issue? Complaint File Karo</Text>
          </TouchableOpacity>

          <Bouncy style={[s.btn, { marginTop: 8 }]} onPress={async () => {
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
        <View style={{ height: 24 }} />
      </View>
    </ScreenIn>
  );
}
