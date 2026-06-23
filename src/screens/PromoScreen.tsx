import { ScrollView, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { ScreenIn } from '../components/ui';
import { s } from '../styles';
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
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }} style={{ padding: 4 }}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>🎫 Promo Codes</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a2e', marginBottom: 4 }}>Code Apply Karo</Text>
          <Text style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>Booking se pehle code daalo — discount automatically lagega</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={{ flex: 1, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#1a1a2e', fontWeight: '700', letterSpacing: 1 }}
              placeholder="RIDE50, FLAT20..."
              placeholderTextColor="#ccc"
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
              style={{ backgroundColor: '#1a1a2e', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11, justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Apply</Text>
            </TouchableOpacity>
          </View>
          {promoCode ? <Text style={{ fontSize: 12, color: '#2e7d32', marginTop: 6 }}>✅ Code saved: <Text style={{ fontWeight: '800' }}>{promoCode}</Text> — next booking pe lagega</Text> : null}
          {promoScreenMsg ? <Text style={{ fontSize: 12, color: promoScreenMsg.startsWith('✅') ? '#2e7d32' : '#e94560', marginTop: 6 }}>{promoScreenMsg}</Text> : null}
        </View>

        <Text style={{ fontSize: 14, fontWeight: '800', color: '#1a1a2e', marginBottom: 10 }}>Available Offers</Text>
        {availablePromos.length === 0 ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 20, alignItems: 'center', elevation: 1 }}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>🎫</Text>
            <Text style={{ color: '#999', fontSize: 13 }}>Abhi koi active promo nahi — jaldi aayenge!</Text>
          </View>
        ) : availablePromos.map((p, i) => (
          <View key={i} style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#e94560' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#1a1a2e', letterSpacing: 1 }}>{p.code}</Text>
              <View style={{ backgroundColor: '#e94560', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
                  {p.discount_type === 'percent' ? `${p.discount_value}% OFF` : `₹${p.discount_value} OFF`}
                </Text>
              </View>
            </View>
            {p.description ? <Text style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{p.description}</Text> : null}
            <Text style={{ fontSize: 11, color: '#999' }}>
              Max discount: ₹{p.max_discount} · Min ride: ₹{p.min_fare}
              {p.expires_at ? ` · Expires: ${new Date(p.expires_at).toLocaleDateString('en-IN')}` : ''}
            </Text>
            <TouchableOpacity
              onPress={() => { setPromoCode(p.code); setPromoScreenCode(p.code); setPromoScreenMsg(`✅ ${p.code} saved — next booking pe lagega`); }}
              style={{ marginTop: 10, backgroundColor: '#1a1a2e', borderRadius: 8, padding: 10, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Use This Code</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </ScreenIn>
  );
}
