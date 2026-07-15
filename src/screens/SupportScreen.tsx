import { ScrollView, View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DotBG, ScreenIn } from '../components/ui';
import { s, C } from '../styles';

export function SupportScreen() {
  const {
    setScreen, setTab,
  } = useApp();

  const supportOptions = [
    { icon: '💬', label: 'WhatsApp', sub: 'Fastest response', color: '#25D366', bg: 'rgba(37,211,102,0.12)', border: 'rgba(37,211,102,0.35)', action: () => Linking.openURL('https://wa.me/919999999999?text=Hi%20Sppero%20Support') },
    { icon: '📞', label: 'Helpline Call', sub: '24/7 available', color: C.purple, bg: C.glassMid, border: C.glassBorder, action: () => Linking.openURL('tel:9999999999') },
    { icon: '📧', label: 'Email Support', sub: 'Response in 24 hrs', color: C.pink, bg: C.pinkGlass, border: C.pinkBorder, action: () => Linking.openURL('mailto:support@sppero.com') },
  ];

  const faqs = [
    ['How do I cancel a ride?', 'On the matching screen, press the "Cancel" button. Cancellation is free within 60 seconds.'],
    ['How do I pay?', 'Cash, Wallet, or UPI — settle with the driver at the end of the trip.'],
    ['No driver found?', 'After 90 seconds, the "Surge" option appears — increase the fare to attract more drivers.'],
    ['How do I recharge my wallet?', 'Profile → Wallet → tap the "+₹100/200/500" buttons.'],
    ['How do I delete my account?', 'Email support@sppero.com — it will be deleted within 7 days.'],
  ];

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }} style={{ padding: 4 }}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>📞 Support</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ backgroundColor: C.bgCard, borderRadius: 22, padding: 20, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder, elevation: 4 }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🎧</Text>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>Sppero Support</Text>
          <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>Contact us for 24/7 help</Text>
        </View>

        {supportOptions.map((item, i) => (
          <TouchableOpacity key={i} onPress={item.action}
            style={{ backgroundColor: item.bg, borderRadius: 18, padding: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2, borderWidth: 1, borderColor: item.border }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: `${item.color}22`, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1, borderColor: item.border }}>
              <Text style={{ fontSize: 24 }}>{item.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>{item.label}</Text>
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textDim} />
          </TouchableOpacity>
        ))}

        <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginTop: 8, marginBottom: 10 }}>FREQUENTLY ASKED QUESTIONS</Text>
        {faqs.map(([q, a], i) => (
          <View key={i} style={{ backgroundColor: C.glass, borderRadius: 16, padding: 16, marginBottom: 10, elevation: 1, borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 6 }}>❓ {q}</Text>
            <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 18 }}>{a}</Text>
          </View>
        ))}
      </ScrollView>
    </ScreenIn>
  );
}
