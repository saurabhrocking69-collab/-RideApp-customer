import { ScrollView, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DotBG, ScreenIn } from '../components/ui';
import { s, C } from '../styles';
import { API } from '../constants';

export function PromoScreen() {
  const {
    phone,
    promoCode, setPromoCode,
    promoScreenCode, setPromoScreenCode,
    promoScreenMsg, setPromoScreenMsg,
    availablePromos,
    setScreen, setTab,
  } = useApp();

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }} style={{ padding: 4 }}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>🎫 Promo Codes</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ backgroundColor: C.glass, borderRadius: 18, padding: 18, marginBottom: 16, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 4 }}>Code Apply Karo</Text>
          <Text style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>Booking se pehle code daalo — discount automatically lagega</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={{ flex: 1, borderWidth: 1.5, borderColor: C.glassBorder, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: C.text, fontWeight: '700', letterSpacing: 1, backgroundColor: C.glassMid }}
              placeholder="RIDE50, FLAT20..."
              placeholderTextColor={C.textDim}
              autoCapitalize="characters"
              value={promoScreenCode}
              onChangeText={t => { setPromoScreenCode(t.toUpperCase()); setPromoScreenMsg(''); }}
            />
            <TouchableOpacity
              onPress={async () => {
                if (!promoScreenCode.trim()) return;
                setPromoScreenMsg('Checking...');
                try {
                  const res = await fetch(`${API}/api/promo/validate`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: promoScreenCode, fare: 100, phone }),
                  });
                  const d = await res.json();
                  if (d.valid) {
                    setPromoCode(promoScreenCode);
                    setPromoScreenMsg(`✅ ${d.message} — Booking pe apply hoga`);
                  } else {
                    setPromoScreenMsg('❌ ' + (d.message || 'Invalid code'));
                  }
                } catch (_e) { setPromoScreenMsg('❌ Network error'); }
              }}
              style={{ backgroundColor: C.pink, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11, justifyContent: 'center', elevation: 4, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>Apply</Text>
            </TouchableOpacity>
          </View>
          {promoCode ? <Text style={{ fontSize: 12, color: C.green, marginTop: 8, fontWeight: '600' }}>✅ Code saved: <Text style={{ fontWeight: '900' }}>{promoCode}</Text> — next booking pe lagega</Text> : null}
          {promoScreenMsg ? <Text style={{ fontSize: 12, color: promoScreenMsg.startsWith('✅') ? C.green : C.pink, marginTop: 6, fontWeight: '600' }}>{promoScreenMsg}</Text> : null}
        </View>

        <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 10 }}>AVAILABLE OFFERS</Text>
        {availablePromos.length === 0 ? (
          <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 24, alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ fontSize: 32, marginBottom: 10 }}>🎫</Text>
            <Text style={{ color: C.textDim, fontSize: 13 }}>Abhi koi active promo nahi — jaldi aayenge!</Text>
          </View>
        ) : availablePromos.map((p: any, i: number) => (
          <View key={i} style={{ backgroundColor: C.glass, borderRadius: 16, padding: 16, marginBottom: 10, elevation: 2, borderLeftWidth: 4, borderLeftColor: C.pink, borderWidth: 1, borderColor: C.glassBorder }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: C.text, letterSpacing: 1 }}>{p.code}</Text>
              <View style={{ backgroundColor: C.pink, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, elevation: 3, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 6 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>
                  {p.discount_type === 'percent' ? `${p.discount_value}% OFF` : `₹${p.discount_value} OFF`}
                </Text>
              </View>
            </View>
            {p.description ? <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>{p.description}</Text> : null}
            <Text style={{ fontSize: 11, color: C.textDim }}>
              Max discount: ₹{p.max_discount} · Min ride: ₹{p.min_fare}
              {p.expires_at ? ` · Expires: ${new Date(p.expires_at).toLocaleDateString('en-IN')}` : ''}
            </Text>
            <TouchableOpacity
              onPress={() => { setPromoCode(p.code); setPromoScreenCode(p.code); setPromoScreenMsg(`✅ ${p.code} saved — next booking pe lagega`); }}
              style={{ marginTop: 10, backgroundColor: C.bgCard, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: C.pinkBorder }}>
              <Text style={{ color: C.pink, fontWeight: '800', fontSize: 12 }}>Use This Code</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </ScreenIn>
  );
}
