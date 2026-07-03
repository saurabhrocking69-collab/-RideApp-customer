import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, DotBG, ScreenIn } from '../components/ui';
import { s, C } from '../styles';

export function HourlyInfoScreen() {
  const { setScreen } = useApp();

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>⏱️ Book by Hour — Guide</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
        <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ color: C.plum, fontSize: 16, fontWeight: '900', marginBottom: 14 }}>🚀 How Does It Work?</Text>
          {[
            ['1️⃣', 'Select a package', '2h, 4h, 6h, 8h (same day) or 1–3 days (multi-day)'],
            ['2️⃣', 'Enter pickup location', 'Drop is optional — driver stays with you'],
            ['3️⃣', 'Pay via Wallet', 'Fare is held in escrow (safe)'],
            ['4️⃣', 'Driver accepts', 'Share OTP to start the trip'],
            ['5️⃣', 'Enjoy your trip', 'Timer runs — the driver is exclusively yours for the package duration'],
            ['6️⃣', 'When time is up', 'Driver presses Complete — final payment auto-settled'],
          ].map(([num, title, desc], i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 14 }}>
              <Text style={{ fontSize: 20, marginRight: 12 }}>{num}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{title}</Text>
                <Text style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: C.glass, borderRadius: 18, padding: 18, marginBottom: 16, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginBottom: 12 }}>💰 Packages & Fares</Text>
          <View style={{ flexDirection: 'row', backgroundColor: C.glassMid, borderRadius: 10, padding: 8, marginBottom: 8 }}>
            <Text style={{ flex: 1, color: C.textMuted, fontSize: 12, fontWeight: '800' }}>Package</Text>
            <Text style={{ width: 52, color: C.textMuted, fontSize: 12, fontWeight: '800', textAlign: 'center' }}>Auto</Text>
            <Text style={{ width: 52, color: C.textMuted, fontSize: 12, fontWeight: '800', textAlign: 'center' }}>Car</Text>
            <Text style={{ width: 52, color: C.textMuted, fontSize: 12, fontWeight: '800', textAlign: 'center' }}>Bike</Text>
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
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: i < 6 ? 1 : 0, borderColor: C.glassBorder }}>
              <Text style={{ flex: 1, color: C.textMuted, fontSize: 12 }}>{label}</Text>
              <Text style={{ width: 52, color: C.yellow, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>₹{auto}</Text>
              <Text style={{ width: 52, color: C.yellow, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>₹{car}</Text>
              <Text style={{ width: 52, color: C.yellow, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>₹{bike}</Text>
            </View>
          ))}
          <Text style={{ color: C.textDim, fontSize: 11, marginTop: 10 }}>Extra KM: Auto ₹8/km · Car ₹12/km · Bike ₹5/km · E-Riksha ₹7/km</Text>
        </View>

        <View style={{ backgroundColor: C.glass, borderRadius: 18, padding: 18, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginBottom: 14 }}>📋 Important Rules</Text>
          {[
            ['✅', 'Escrow Payment', 'Your money reaches the driver only after trip completion — 100% safe, zero risk'],
            ['⏱️', 'Timer', 'Timer starts on OTP confirm. Driver can press Complete when the package time ends'],
            ['🔒', 'Driver Time Lock', 'Driver CANNOT complete the ride before package time ends — your full time is guaranteed'],
            ['🔄', 'Round Trip', 'Toggle on if you need the driver to return to pickup. You can also set a stay duration'],
            ['📍', 'Extra KM', 'Exceeding package KM incurs extra charges — tracked live on the driver app'],
            ['❌', 'Cancellation', 'Cancel before driver accepts = full refund. Cannot cancel after acceptance'],
          ].map(([icon, title, desc], i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, marginRight: 10, width: 30 }}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{title}</Text>
                <Text style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: C.yellowGlass, borderRadius: 18, padding: 18, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: C.yellow, borderWidth: 1, borderColor: C.yellowBorder }}>
          <Text style={{ color: C.yellow, fontSize: 15, fontWeight: '900', marginBottom: 12 }}>⏹️ Early End — How It Works</Text>
          {[
            ['1️⃣', 'Send a request', 'You or the driver sends an "Early End Request" from the app'],
            ['2️⃣', 'Both must agree', 'The other party must Accept — only then the early end happens'],
            ['3️⃣', 'Proportional payment', 'Fare is calculated for actual time used — unused time refunded to wallet'],
            ['🚫', 'No driver shortcuts', 'Driver CANNOT press Complete directly — early end only by mutual agreement'],
            ['⚠️', 'Reject limit', '15-min cooldown after 2 early-end rejections — contact support if rejected more than twice'],
          ].map(([icon, title, desc], i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 10 }}>
              <Text style={{ fontSize: 16, marginRight: 10, width: 30 }}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.yellow, fontWeight: '800', fontSize: 13 }}>{title}</Text>
                <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: C.glassMid, borderRadius: 18, padding: 18, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: C.purple, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ color: C.purple, fontSize: 15, fontWeight: '900', marginBottom: 12 }}>🔄 Time Extension — Need More Time?</Text>
          {[
            ['⏱️', 'Send request', 'During an active ride, use the "+1h / +2h / +3h" option to request more time'],
            ['✅ Driver', 'Driver can accept or reject', 'If driver agrees, extra hours are added instantly'],
            ['💰 Extra fare', 'Auto-deducted from wallet', 'Additional fare for the extension is held from wallet balance instantly'],
            ['🔒 Lock rule', 'Extension covered by same time-lock', 'Extended time must also be completed — early end option remains available'],
          ].map(([icon, title, desc], i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 10 }}>
              <Text style={{ fontSize: 16, marginRight: 10, width: 30 }}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.purple, fontWeight: '800', fontSize: 13 }}>{title}</Text>
                <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: C.greenGlass, borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: C.greenBorder }}>
          <Text style={{ color: C.green, fontSize: 15, fontWeight: '900', marginBottom: 12 }}>💡 Pro Tips</Text>
          {[
            'Planning many trips? Book multi-day — lower cost per day',
            'Toggle round trip if you need to stop somewhere and return',
            'Keep your wallet topped up — booking will be instant',
            'Morning ride tomorrow? Schedule tonight — stress-free',
            'Chat with the driver to confirm the exact pickup location',
            'Share OTP only with the driver — only share when ready to start',
          ].map((tip, i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ color: C.green, marginRight: 8, fontSize: 14, fontWeight: '900' }}>•</Text>
              <Text style={{ color: C.textMuted, fontSize: 13, flex: 1 }}>{tip}</Text>
            </View>
          ))}
        </View>

        <Bouncy style={s.btn} onPress={() => setScreen('hourly')}>
          <Text style={s.btnTxt}>⏱️ Book Now</Text>
        </Bouncy>
      </ScrollView>
    </ScreenIn>
  );
}
