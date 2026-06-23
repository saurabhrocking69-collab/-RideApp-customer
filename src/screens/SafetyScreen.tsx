import { ScrollView, View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { ScreenIn } from '../components/ui';
import { s } from '../styles';

export function SafetyScreen() {
  const { setScreen, setTab, triggerSOS } = useApp();

  return (
    <ScreenIn style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }} style={{ padding: 4 }}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>🛡️ Safety</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ backgroundColor: '#e94560', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, elevation: 4 }}>
          <Ionicons name="warning" size={40} color="#fff" style={{ marginBottom: 8 }} />
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 4 }}>Emergency SOS</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>Police, ambulance aur Sppero team ko alert bhejo</Text>
          <TouchableOpacity
            onPress={() => triggerSOS()}
            style={{ backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 }}>
            <Text style={{ color: '#e94560', fontWeight: '900', fontSize: 16 }}>🆘 SOS Alert Bhejo</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 14, fontWeight: '800', color: '#1a1a2e', marginBottom: 10 }}>Emergency Numbers</Text>
        {[
          { label: '🚓 Police',             number: '100',  color: '#1a1a2e' },
          { label: '🚑 Ambulance',          number: '108',  color: '#e94560' },
          { label: '🚒 Fire Brigade',       number: '101',  color: '#FF5722' },
          { label: '👩 Women Helpline',     number: '1091', color: '#9C27B0' },
          { label: '📞 National Emergency', number: '112',  color: '#2196F3' },
        ].map((item, i) => (
          <TouchableOpacity key={i} onPress={() => Linking.openURL(`tel:${item.number}`)}
            style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 2 }}>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1a1a2e' }}>{item.label}</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: item.color, marginTop: 2 }}>{item.number}</Text>
            </View>
            <View style={{ backgroundColor: item.color, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Call Now</Text>
            </View>
          </TouchableOpacity>
        ))}

        <Text style={{ fontSize: 14, fontWeight: '800', color: '#1a1a2e', marginTop: 8, marginBottom: 10 }}>Safety Tips</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, elevation: 1 }}>
          {[
            '✅ Driver ka naam aur vehicle number verify karo boarding se pehle',
            '✅ Ride share — family ko location share karo',
            '✅ Raat ko front seat pe mat baitho, back seat prefer karo',
            '✅ Trip end hone se pehle payment mat karo',
            '✅ Kisi bhi problem pe SOS button press karo — help milegi',
          ].map((tip, i) => (
            <Text key={i} style={{ fontSize: 13, color: '#444', paddingVertical: 8, borderBottomWidth: i < 4 ? 1 : 0, borderBottomColor: '#f5f5f5' }}>{tip}</Text>
          ))}
        </View>
      </ScrollView>
    </ScreenIn>
  );
}
