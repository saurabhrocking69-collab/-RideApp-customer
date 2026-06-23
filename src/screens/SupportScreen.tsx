import { ScrollView, View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiGet } from '../../api';
import { useApp } from '../context/AppContext';
import { ScreenIn } from '../components/ui';
import { s } from '../styles';

export function SupportScreen() {
  const {
    phone,
    setScreen, setTab,
    setComplaints, setCmpLoading,
  } = useApp();

  return (
    <ScreenIn style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }} style={{ padding: 4 }}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>📞 Support</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ backgroundColor: '#1a1a2e', borderRadius: 20, padding: 20, marginBottom: 16, alignItems: 'center' }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🎧</Text>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>Sppero Support</Text>
          <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4, textAlign: 'center' }}>24x7 help ke liye humse contact karo</Text>
        </View>

        {[
          { icon: '📋', label: 'My Complaints', sub: 'File or track complaints', color: '#e94560',
            action: async () => {
              setCmpLoading(true);
              try { const r = await apiGet(`/api/complaints?phone=${encodeURIComponent(phone)}`); setComplaints(r.complaints||[]); } catch {}
              setCmpLoading(false); setScreen('complaints');
            }
          },
          { icon: '💬', label: 'WhatsApp', sub: 'Sabse fast response', color: '#25D366', action: () => Linking.openURL('https://wa.me/919999999999?text=Hi%20Sppero%20Support') },
          { icon: '📞', label: 'Helpline Call', sub: '24x7 available', color: '#2196F3', action: () => Linking.openURL('tel:9999999999') },
          { icon: '📧', label: 'Email Support', sub: 'Response in 24 hrs', color: '#e94560', action: () => Linking.openURL('mailto:support@sppero.com') },
        ].map((item, i) => (
          <TouchableOpacity key={i} onPress={item.action}
            style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: item.color, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
              <Text style={{ fontSize: 24 }}>{item.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1a1a2e' }}>{item.label}</Text>
              <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{item.sub}</Text>
            </View>
            <Text style={{ fontSize: 20, color: '#ddd' }}>›</Text>
          </TouchableOpacity>
        ))}

        <Text style={{ fontSize: 14, fontWeight: '800', color: '#1a1a2e', marginTop: 8, marginBottom: 10 }}>Aksar Pooche Jane Wale Sawaal</Text>
        {[
          ['Ride cancel kaise karein?', 'Matching screen pe "Cancel" button press karo. 60 seconds tak free cancellation milti hai.'],
          ['Payment kaise karein?', 'Cash, Wallet ya UPI — driver aapke saath settle karega trip end pe.'],
          ['Driver nahi mila?', '100 seconds baad "Surge" option aata hai — fare badhao aur zyada drivers attract karo.'],
          ['Wallet recharge kaise karein?', 'Profile → Wallet → "+₹100/200/500" buttons pe tap karo.'],
          ['Apna account kaise delete karein?', 'support@sppero.com pe email karo — 7 din me delete ho jayega.'],
        ].map(([q, a], i) => (
          <View key={i} style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 }}>❓ {q}</Text>
            <Text style={{ fontSize: 12, color: '#666', lineHeight: 18 }}>{a}</Text>
          </View>
        ))}
      </ScrollView>
    </ScreenIn>
  );
}
