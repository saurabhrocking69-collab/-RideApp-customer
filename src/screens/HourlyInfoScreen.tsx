import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, ScreenIn } from '../components/ui';
import { s } from '../styles';

export function HourlyInfoScreen() {
  const { setScreen } = useApp();

  return (
    <ScreenIn style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>⏱️ Book by Hour — Guide</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
        <View style={{ backgroundColor: '#1a1a2e', borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <Text style={{ color: '#e94560', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>🚀 Kaise Kaam Karta Hai?</Text>
          {[
            ['1️⃣', 'Package select karo', '2h, 4h, 6h, 8h (same day) ya 1-3 din (multi-day)'],
            ['2️⃣', 'Pickup location daalo', 'Drop optional hai — driver aapke saath rahega'],
            ['3️⃣', 'Wallet se payment', 'Fare escrow mein hold hota hai (safe)'],
            ['4️⃣', 'Driver accept karta hai', 'OTP share karo trip start karne ke liye'],
            ['5️⃣', 'Trip enjoy karo', 'Timer chalta hai — driver sirf aapka hai poore package time tak'],
            ['6️⃣', 'Time khatam hone par', 'Driver Complete press karta hai — final payment auto settle'],
          ].map(([num, title, desc], i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 14 }}>
              <Text style={{ fontSize: 20, marginRight: 12 }}>{num}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{title}</Text>
                <Text style={{ color: '#aaa', fontSize: 12, marginTop: 2 }}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2 }}>
          <Text style={{ color: '#1a1a2e', fontSize: 15, fontWeight: 'bold', marginBottom: 12 }}>💰 Packages & Fares</Text>
          <View style={{ flexDirection: 'row', backgroundColor: '#f8f8f8', borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <Text style={{ flex: 1, color: '#666', fontSize: 12, fontWeight: '700' }}>Package</Text>
            <Text style={{ width: 50, color: '#666', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>Auto</Text>
            <Text style={{ width: 50, color: '#666', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>Car</Text>
            <Text style={{ width: 50, color: '#666', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>Bike</Text>
          </View>
          {[
            ['2 Hours (20km)', 180, 260, 120],
            ['4 Hours (40km)', 320, 460, 210],
            ['6 Hours (60km)', 460, 660, 300],
            ['8 Hours (80km)', 580, 840, 380],
            ['1 Day (200km)', 1500, 2200, 1000],
            ['2 Days (400km)', 2800, 4000, 1800],
            ['3 Days (600km)', 4000, 5800, 2600],
          ].map(([label, auto, car, bike], i) => (
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: i < 6 ? 1 : 0, borderColor: '#f5f5f5' }}>
              <Text style={{ flex: 1, color: '#333', fontSize: 12 }}>{label}</Text>
              <Text style={{ width: 50, color: '#e94560', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>₹{auto}</Text>
              <Text style={{ width: 50, color: '#e94560', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>₹{car}</Text>
              <Text style={{ width: 50, color: '#e94560', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>₹{bike}</Text>
            </View>
          ))}
          <Text style={{ color: '#999', fontSize: 11, marginTop: 10 }}>Extra KM: Auto ₹8/km · Car ₹12/km · Bike ₹5/km · E-Riksha ₹7/km</Text>
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 14, elevation: 2 }}>
          <Text style={{ color: '#1a1a2e', fontSize: 15, fontWeight: 'bold', marginBottom: 12 }}>📋 Important Rules</Text>
          {[
            ['✅', 'Escrow Payment', 'Aapka paisa trip complete hone par hi driver ko milega — 100% safe, koi risk nahi'],
            ['⏱️', 'Timer', 'OTP confirm hone par timer start. Package time khatam hone par driver Complete button press kar sakta hai'],
            ['🔒', 'Driver Time Lock', 'Driver package time khatam hone se pehle ride complete NAHI kar sakta — aapka poora time guaranteed hai'],
            ['🔄', 'Round Trip', 'Toggle on karo agar wapas pickup aana ho. Stay time bhi set kar sakte ho'],
            ['📍', 'Extra KM', 'Package KM se zyada chale to extra charge lagega — driver app pe live track hoga'],
            ['❌', 'Cancellation', 'Driver accept karne se pehle cancel = full refund. Baad mein cancel nahi ho sakta'],
          ].map(([icon, title, desc], i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, marginRight: 10, width: 30 }}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1a1a2e', fontWeight: '700', fontSize: 13 }}>{title}</Text>
                <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: '#fff3e0', borderRadius: 16, padding: 18, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: '#ff9800' }}>
          <Text style={{ color: '#e65100', fontSize: 15, fontWeight: 'bold', marginBottom: 10 }}>⏹️ Early End — Kaise Kaam Karta Hai?</Text>
          {[
            ['1️⃣', 'Request karo', 'Aap ya driver "Early End Request" bhejta hai app se'],
            ['2️⃣', 'Dono agree karein', 'Dusra party Accept kare — tabhi early end hoga'],
            ['3️⃣', 'Proportional payment', 'Actual time ke hisaab se fare calculate hoga — unused time refund wallet mein'],
            ['🚫', 'Driver shortcut nahi', 'Driver directly Complete nahi kar sakta — sirf mutual agreement se hi early end possible hai'],
            ['⚠️', 'Reject limit', 'Early end 2 baar reject karne par 15 min cooldown — 2 se zyada reject par support contact'],
          ].map(([icon, title, desc], i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 10 }}>
              <Text style={{ fontSize: 16, marginRight: 10, width: 30 }}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#bf360c', fontWeight: '700', fontSize: 13 }}>{title}</Text>
                <Text style={{ color: '#795548', fontSize: 12, marginTop: 2 }}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: '#e8eaf6', borderRadius: 16, padding: 18, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: '#3f51b5' }}>
          <Text style={{ color: '#283593', fontSize: 15, fontWeight: 'bold', marginBottom: 10 }}>🔄 Time Extension — Aur Time Chahiye?</Text>
          {[
            ['⏱️', 'Extend request', 'Active ride mein "+1h / +2h / +3h" option se request bhejein'],
            ['✅ Driver', 'Driver accept/reject kar sakta hai', 'Agar driver agree kare to extra hours add ho jaate hain'],
            ['💰 Extra fare', 'Auto-deducted wallet se', 'Extension ka additional fare wallet balance se instantly hold hoga'],
            ['🔒 Lock rule', 'Extension bhi same time-lock se cover', 'Extended time bhi poora karna hoga — early end ka option rahega'],
          ].map(([icon, title, desc], i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 10 }}>
              <Text style={{ fontSize: 16, marginRight: 10, width: 30 }}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1a237e', fontWeight: '700', fontSize: 13 }}>{title}</Text>
                <Text style={{ color: '#5c6bc0', fontSize: 12, marginTop: 2 }}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: '#e8f5e9', borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <Text style={{ color: '#2e7d32', fontSize: 15, fontWeight: 'bold', marginBottom: 10 }}>💡 Pro Tips</Text>
          {[
            'Zyada trips plan ho to multi-day book karo — per-day cost kam padega',
            'Round trip toggle karo agar ek jagah rukna hai aur wapas aana hai',
            'Wallet top-up karke rakho — booking instant hogi',
            'Kal subah ki ride? Aaj raat schedule karo — tension-free',
            'Driver se chat karo pickup exact location confirm karne ke liye',
            'OTP sirf driver ko batao — trip start hone par hi share karo',
          ].map((tip, i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ color: '#4CAF50', marginRight: 8, fontSize: 14, fontWeight: 'bold' }}>•</Text>
              <Text style={{ color: '#1b5e20', fontSize: 13, flex: 1 }}>{tip}</Text>
            </View>
          ))}
        </View>

        <Bouncy style={s.btn} onPress={() => setScreen('hourly')}>
          <Text style={s.btnTxt}>⏱️ Abhi Book Karo</Text>
        </Bouncy>
      </ScrollView>
    </ScreenIn>
  );
}
