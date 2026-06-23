import { useEffect } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { ScreenIn, CountUp } from '../components/ui';
import { s } from '../styles';

export function WalletScreen() {
  const {
    phone,
    walletBalance,
    walletTxns,
    walletStats,
    walletTxnTab, setWalletTxnTab,
    walletAddInput, setWalletAddInput,
    loyaltyPoints, loyaltyCashback,
    setScreen, setTab,
    loadWalletDetail,
    openRazorpayTopup,
    rewardsDash, loadRewardsDash,
  } = useApp();

  useEffect(() => { loadRewardsDash(phone); }, []);

  const filteredTxns = walletTxns.filter(t => {
    if (walletTxnTab === 'all') return true;
    if (walletTxnTab === 'earn') return t.type === 'credit' && !(t.description || '').toLowerCase().includes('reward') && !(t.description || '').toLowerCase().includes('referral');
    if (walletTxnTab === 'spend') return t.type === 'debit';
    if (walletTxnTab === 'reward') return t.type === 'credit' && ((t.description || '').toLowerCase().includes('reward') || (t.description || '').toLowerCase().includes('referral') || (t.description || '').toLowerCase().includes('refund'));
    return true;
  });

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
  };

  return (
    <ScreenIn style={s.screen}>
      <View style={{ backgroundColor: '#1a1a2e', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 14 : 52, paddingBottom: 20, paddingHorizontal: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
          <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }} style={{ marginRight: 14, padding: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10 }}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', flex: 1 }}>My Wallet</Text>
          <TouchableOpacity onPress={() => loadWalletDetail(phone)} style={{ padding: 8 }}>
            <Text style={{ fontSize: 18 }}>⟳</Text>
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 20, alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>Available Balance</Text>
          <CountUp to={walletBalance} prefix="₹" style={{ color: '#fff', fontSize: 48, fontWeight: '900', marginTop: 4 }} />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            {[100, 200, 500, 1000, 2000].map(amt => (
              <TouchableOpacity key={amt} onPress={() => openRazorpayTopup(amt)}
                style={{ backgroundColor: amt === 1000 ? '#e94560' : 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+₹{amt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
            <Text style={{ color: '#4CAF50', fontSize: 17, fontWeight: '800' }}>₹{parseFloat(walletStats?.total_credited || 0).toFixed(0)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 }}>Total Added</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
            <Text style={{ color: '#e94560', fontSize: 17, fontWeight: '800' }}>₹{parseFloat(walletStats?.total_spent || 0).toFixed(0)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 }}>Total Spent</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
            <Text style={{ color: '#FFD700', fontSize: 17, fontWeight: '800' }}>₹{parseFloat(walletStats?.total_rewards || 0).toFixed(0)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 }}>Rewards</Text>
          </View>
        </View>

        {loyaltyPoints > 0 && (
          <View style={{ marginTop: 10, backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 20, marginRight: 10 }}>⭐</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFD700', fontWeight: '800', fontSize: 15 }}>{loyaltyPoints} Loyalty Points</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 }}>100 points = ₹10 cashback · Aapke paas: ₹{loyaltyCashback} cashback available</Text>
            </View>
          </View>
        )}

        {/* Cashback Rewards teaser */}
        <TouchableOpacity onPress={() => setScreen('rewards')}
          style={{ marginTop: 10, backgroundColor: 'rgba(233,69,96,0.18)', borderRadius: 12, padding: 13, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(233,69,96,0.35)' }}>
          <Text style={{ fontSize: 22, marginRight: 10 }}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ff6b84', fontWeight: '800', fontSize: 13 }}>Cashback Rewards Program</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 }}>
              {rewardsDash ? `₹${(rewardsDash.total_cashback_earned || 0).toFixed(0)} earned so far · ` : ''}Har ride pe cashback!
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </View>

      <View style={{ backgroundColor: '#fff', margin: 14, borderRadius: 14, padding: 14, elevation: 2, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <TextInput
          style={{ flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: '#1a1a2e' }}
          placeholder="Enter custom amount (₹)"
          keyboardType="numeric"
          value={walletAddInput}
          onChangeText={setWalletAddInput}
          placeholderTextColor="#bbb"
        />
        <TouchableOpacity
          onPress={() => { const a = parseFloat(walletAddInput); if (a >= 1) { openRazorpayTopup(a); setWalletAddInput(''); } }}
          style={{ backgroundColor: '#e94560', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Add ›</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', marginHorizontal: 14, marginBottom: 8, gap: 8 }}>
        {(['all', 'earn', 'spend', 'reward'] as const).map(tab => (
          <TouchableOpacity key={tab} onPress={() => setWalletTxnTab(tab)}
            style={{ flex: 1, borderRadius: 20, paddingVertical: 7, alignItems: 'center', backgroundColor: walletTxnTab === tab ? '#1a1a2e' : '#f0f0f0' }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: walletTxnTab === tab ? '#fff' : '#888', textTransform: 'capitalize' }}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
        {filteredTxns.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Text style={{ fontSize: 36 }}>💸</Text>
            <Text style={{ color: '#bbb', marginTop: 10, fontSize: 14 }}>Koi transaction nahi mili</Text>
          </View>
        ) : filteredTxns.map((t: any, i: number) => (
          <View key={t.id || i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, elevation: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.type === 'credit' ? '#e8f5e9' : '#ffebee', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ fontSize: 18 }}>{t.type === 'credit' ? '↓' : '↑'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: '#1a1a2e', fontWeight: '600' }} numberOfLines={1}>{t.description || (t.type === 'credit' ? 'Credited' : 'Debited')}</Text>
              <Text style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{fmtDate(t.created_at)}</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: t.type === 'credit' ? '#2e7d32' : '#c62828' }}>
              {t.type === 'credit' ? '+' : '-'}₹{parseFloat(t.amount).toFixed(0)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </ScreenIn>
  );
}
