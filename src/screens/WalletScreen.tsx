import { useEffect } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DotBG, ScreenIn, CountUp, ShineCard } from '../components/ui';
import { s, C } from '../styles';

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

  const filteredTxns = walletTxns.filter((t: any) => {
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
      <View style={{ backgroundColor: C.pink, overflow: 'hidden', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 14 : 56, paddingBottom: 22, paddingHorizontal: 18 }}>
        <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.10)', top: -70, right: -50 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 0 }}>
          <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }}
            style={{ marginRight: 14, padding: 8, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)' }}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', flex: 1 }}>💰 My Wallet</Text>
          <TouchableOpacity onPress={() => loadWalletDetail(phone)} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 }}>
            <Text style={{ fontSize: 20 }}>⟳</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ backgroundColor: C.bgDeep, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 20, borderBottomWidth: 1, borderColor: C.glassBorder }}>
        <ShineCard style={{ backgroundColor: C.glass, borderRadius: 22, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: C.pinkBorder }}>
          <Text style={{ color: C.textMuted, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Available Balance</Text>
          <CountUp to={walletBalance} prefix="₹" style={{ color: C.text, fontSize: 52, fontWeight: '900' }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
            {[100, 200, 500, 1000, 2000].map(amt => (
              <TouchableOpacity key={amt} onPress={() => openRazorpayTopup(amt)}
                style={{ backgroundColor: amt === 1000 ? C.pink : C.glassMid, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: amt === 1000 ? C.pinkBorder : C.glassBorder, elevation: amt === 1000 ? 6 : 1, shadowColor: amt === 1000 ? C.pink : '#000', shadowOpacity: amt === 1000 ? 0.4 : 0 }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>+₹{amt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </ShineCard>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {[
            { label: 'Total Added', value: `₹${parseFloat(walletStats?.total_credited || 0).toFixed(0)}`, color: C.green },
            { label: 'Total Spent', value: `₹${parseFloat(walletStats?.total_spent || 0).toFixed(0)}`, color: C.pink },
            { label: 'Rewards', value: `₹${parseFloat(walletStats?.total_rewards || 0).toFixed(0)}`, color: C.yellow },
          ].map((stat, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: C.glassMid, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder }}>
              <Text style={{ color: stat.color, fontSize: 17, fontWeight: '800' }}>{stat.value}</Text>
              <Text style={{ color: C.textDim, fontSize: 10, marginTop: 3 }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {loyaltyPoints > 0 && (
          <View style={{ marginTop: 10, backgroundColor: C.yellowGlass, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.yellowBorder }}>
            <Text style={{ fontSize: 20, marginRight: 10 }}>⭐</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.yellow, fontWeight: '800', fontSize: 15 }}>{loyaltyPoints} Loyalty Points</Text>
              <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 1 }}>100 points = ₹10 cashback · Aapke paas: ₹{loyaltyCashback} cashback available</Text>
            </View>
          </View>
        )}

        <TouchableOpacity onPress={() => setScreen('rewards')}
          style={{ marginTop: 10, backgroundColor: C.pinkGlass, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.pinkBorder }}>
          <Text style={{ fontSize: 22, marginRight: 10 }}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.pink, fontWeight: '800', fontSize: 13 }}>Cashback Rewards Program</Text>
            <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>
              {rewardsDash ? `₹${(rewardsDash.total_cashback_earned || 0).toFixed(0)} earned so far · ` : ''}Har ride pe cashback!
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textDim} />
        </TouchableOpacity>
      </View>

      <View style={{ marginHorizontal: 14, marginTop: 14, marginBottom: 8, flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: C.glass, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: C.glassBorder }}>
        <TextInput
          style={{ flex: 1, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: C.text, backgroundColor: C.glassMid }}
          placeholder="Enter custom amount (₹)"
          keyboardType="numeric"
          value={walletAddInput}
          onChangeText={setWalletAddInput}
          placeholderTextColor={C.textDim}
        />
        <TouchableOpacity
          onPress={() => { const a = parseFloat(walletAddInput); if (a >= 1) { openRazorpayTopup(a); setWalletAddInput(''); } }}
          style={{ backgroundColor: C.pink, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11, elevation: 6, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>Add ›</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', marginHorizontal: 14, marginBottom: 10, gap: 8 }}>
        {(['all', 'earn', 'spend', 'reward'] as const).map(tab => (
          <TouchableOpacity key={tab} onPress={() => setWalletTxnTab(tab)}
            style={{ flex: 1, borderRadius: 20, paddingVertical: 8, alignItems: 'center', backgroundColor: walletTxnTab === tab ? C.pink : C.glassMid, borderWidth: 1, borderColor: walletTxnTab === tab ? C.pinkBorder : C.glassBorder, elevation: walletTxnTab === tab ? 4 : 0, shadowColor: C.pink, shadowOpacity: walletTxnTab === tab ? 0.4 : 0, shadowRadius: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: walletTxnTab === tab ? '#fff' : C.textMuted, textTransform: 'capitalize' }}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
        {filteredTxns.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Text style={{ fontSize: 36 }}>💸</Text>
            <Text style={{ color: C.textDim, marginTop: 10, fontSize: 14 }}>Koi transaction nahi mili</Text>
          </View>
        ) : filteredTxns.map((t: any, i: number) => (
          <View key={t.id || i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderRadius: 14, padding: 14, marginBottom: 8, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.type === 'credit' ? C.greenGlass : C.redGlass, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: t.type === 'credit' ? C.greenBorder : C.redBorder }}>
              <Text style={{ fontSize: 18, color: t.type === 'credit' ? C.green : C.red }}>{t.type === 'credit' ? '↓' : '↑'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: C.text, fontWeight: '600' }} numberOfLines={1}>{t.description || (t.type === 'credit' ? 'Credited' : 'Debited')}</Text>
              <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{fmtDate(t.created_at)}</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: t.type === 'credit' ? C.green : C.red }}>
              {t.type === 'credit' ? '+' : '-'}₹{parseFloat(t.amount).toFixed(0)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </ScreenIn>
  );
}
