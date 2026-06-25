import { ScrollView, View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DotBG, ScreenIn } from '../components/ui';
import { s, C } from '../styles';

export function SafetyScreen() {
  const { setScreen, setTab, triggerSOS } = useApp();

  const emergencyNumbers = [
    { label: '🚓 Police',             number: '100',  color: C.bgCard,  textColor: C.text },
    { label: '🚑 Ambulance',          number: '108',  color: C.redGlass, textColor: C.red },
    { label: '🚒 Fire Brigade',       number: '101',  color: 'rgba(255,87,34,0.15)', textColor: '#FF5722' },
    { label: '👩 Women Helpline',     number: '1091', color: 'rgba(124,58,237,0.10)', textColor: C.purple },
    { label: '📞 National Emergency', number: '112',  color: C.glassMid,              textColor: C.purple },
  ];

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }} style={{ padding: 4 }}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>🛡️ Safety</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ backgroundColor: C.redGlass, borderRadius: 22, padding: 24, alignItems: 'center', marginBottom: 16, elevation: 6, borderWidth: 2, borderColor: C.redBorder, shadowColor: C.red, shadowOpacity: 0.4, shadowRadius: 12 }}>
          <Ionicons name="warning" size={42} color={C.red} style={{ marginBottom: 10 }} />
          <Text style={{ color: C.red, fontSize: 20, fontWeight: '900', marginBottom: 4 }}>Emergency SOS</Text>
          <Text style={{ color: C.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 18 }}>Police, ambulance aur Sppero team ko alert bhejo</Text>
          <TouchableOpacity
            onPress={() => triggerSOS()}
            style={{ backgroundColor: C.red, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 16, elevation: 8, shadowColor: C.red, shadowOpacity: 0.5, shadowRadius: 12 }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>🆘 SOS Alert Bhejo</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 10 }}>EMERGENCY NUMBERS</Text>
        {emergencyNumbers.map((item, i) => (
          <TouchableOpacity key={i} onPress={() => Linking.openURL(`tel:${item.number}`)}
            style={{ backgroundColor: item.color, borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{item.label}</Text>
              <Text style={{ fontSize: 26, fontWeight: '900', color: item.textColor, marginTop: 2 }}>{item.number}</Text>
            </View>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.number}`)}
              style={{ backgroundColor: item.textColor, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, opacity: 0.9 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>Call</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginTop: 8, marginBottom: 10 }}>SAFETY TIPS</Text>
        <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 16, elevation: 1, borderWidth: 1, borderColor: C.glassBorder }}>
          {[
            '✅ Driver ka naam aur vehicle number verify karo boarding se pehle',
            '✅ Ride share — family ko location share karo',
            '✅ Raat ko front seat pe mat baitho, back seat prefer karo',
            '✅ Trip end hone se pehle payment mat karo',
            '✅ Kisi bhi problem pe SOS button press karo — help milegi',
          ].map((tip, i) => (
            <Text key={i} style={{ fontSize: 13, color: C.textMuted, paddingVertical: 9, borderBottomWidth: i < 4 ? 1 : 0, borderBottomColor: C.glassBorder }}>{tip}</Text>
          ))}
        </View>
      </ScrollView>
    </ScreenIn>
  );
}
