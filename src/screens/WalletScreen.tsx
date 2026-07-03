import { useEffect } from 'react';
import { Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { CountUp, DotBG, FadeIn, ScreenIn, ShineCard } from '../components/ui';
import { s, C, T, R, SP } from '../styles';

const SB_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0;

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

  useEffect(() => { loadWalletDetail(phone); loadRewardsDash(phone); }, []);

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

  const quickAmounts = [100, 200, 500, 1000, 2000];

  return (
    <ScreenIn style={s.screen}>
      <DotBG />

      {/* ── Header ── */}
      <View style={{ backgroundColor: C.night, paddingTop: SB_H + 14, paddingBottom: 22, paddingHorizontal: 18, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,45,120,0.10)', top: -80, right: -60 }} />
        <View style={{ position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -50, left: -20 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }}
            style={{ marginRight: 14, padding: 9, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: R.sm, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)' }}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ ...T.title, color: '#fff' }}>My Wallet</Text>
            <Text style={{ ...T.caption, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>Add money · Pay rides · Earn rewards</Text>
          </View>
          <TouchableOpacity onPress={() => loadWalletDetail(phone)}
            style={{ padding: 9, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: R.sm, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)' }}>
            <Ionicons name="refresh" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>

        {/* ── Balance card ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <ShineCard style={{ backgroundColor: C.glass, borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: C.pinkBorder, elevation: 8, shadowColor: C.pink, shadowOpacity: 0.15, shadowRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: C.textMuted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Available Balance</Text>
            <CountUp to={walletBalance} prefix="₹" style={{ color: C.text, fontSize: 58, fontWeight: '900', letterSpacing: -1 }} />
            <Text style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>Sppero Wallet · Instant payments</Text>

            {/* Quick add */}
            <View style={{ marginTop: 18, width: '100%' }}>
              <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center', marginBottom: 10, textTransform: 'uppercase' }}>Quick Add</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
                {quickAmounts.map(amt => (
                  <TouchableOpacity key={amt} onPress={() => openRazorpayTopup(amt)}
                    style={{
                      backgroundColor: amt === 500 ? C.pink : C.glassMid,
                      borderRadius: 22, paddingHorizontal: 16, paddingVertical: 9,
                      borderWidth: 1.5,
                      borderColor: amt === 500 ? C.pinkBorder : C.glassBorder,
                      elevation: amt === 500 ? 6 : 0,
                      shadowColor: C.pink, shadowOpacity: amt === 500 ? 0.4 : 0, shadowRadius: 8,
                    }}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>+₹{amt}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </ShineCard>
        </View>

        {/* ── Stats ── */}
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 }}>
          {[
            { label: 'Total Added', value: `₹${parseFloat(walletStats?.total_credited || 0).toFixed(0)}`, color: C.green, bg: C.greenGlass, border: C.greenBorder },
            { label: 'Total Spent', value: `₹${parseFloat(walletStats?.total_spent || 0).toFixed(0)}`, color: C.pink, bg: C.pinkGlass, border: C.pinkBorder },
            { label: 'Rewards', value: `₹${parseFloat(walletStats?.total_rewards || 0).toFixed(0)}`, color: C.yellow, bg: C.yellowGlass, border: C.yellowBorder },
          ].map((stat, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: stat.bg, borderRadius: R.md, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: stat.border }}>
              <Text style={{ color: stat.color, fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{stat.value}</Text>
              <Text style={{ ...T.label, color: stat.color, opacity: 0.7, marginTop: 4 }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Custom amount ── */}
        <View style={{ marginHorizontal: 16, marginTop: 14, backgroundColor: C.glassMid, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.glassBorder, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 20 }}>💸</Text>
          <TextInput
            style={{ flex: 1, borderWidth: 1, borderColor: C.glassBorder, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: C.text, backgroundColor: C.glass }}
            placeholder="Custom amount (₹)"
            keyboardType="numeric"
            value={walletAddInput}
            onChangeText={setWalletAddInput}
            placeholderTextColor={C.textDim}
          />
          <TouchableOpacity
            onPress={() => { const a = parseFloat(walletAddInput); if (a >= 1) { openRazorpayTopup(a); setWalletAddInput(''); } }}
            style={{ backgroundColor: C.pink, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, elevation: 6, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>Add ›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Loyalty points ── */}
        {loyaltyPoints > 0 && (
          <FadeIn style={{ marginHorizontal: 16, marginTop: 12 }}>
            <View style={{ backgroundColor: C.yellowGlass, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: C.yellowBorder }}>
              <Text style={{ fontSize: 22, marginRight: 12 }}>⭐</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.yellow, fontWeight: '900', fontSize: 15 }}>{loyaltyPoints} Loyalty Points</Text>
                <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>100 pts = ₹10 cashback · You have ₹{loyaltyCashback} available</Text>
              </View>
            </View>
          </FadeIn>
        )}

        {/* ── Rewards link ── */}
        <TouchableOpacity onPress={() => setScreen('rewards')}
          style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: C.pinkGlass, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: C.pinkBorder }}>
          <Text style={{ fontSize: 24, marginRight: 12 }}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.pink, fontWeight: '900', fontSize: 14 }}>Cashback Rewards</Text>
            <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>
              {rewardsDash ? `₹${(rewardsDash.total_cashback_earned || 0).toFixed(0)} earned so far · ` : ''}Cashback on every ride!
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.textDim} />
        </TouchableOpacity>

        {/* ── Transaction tabs ── */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 18, gap: 6 }}>
          {(['all', 'earn', 'spend', 'reward'] as const).map(tab => (
            <TouchableOpacity key={tab} onPress={() => setWalletTxnTab(tab)}
              style={{
                flex: 1, borderRadius: 22, paddingVertical: 9, alignItems: 'center',
                backgroundColor: walletTxnTab === tab ? C.pink : C.glassMid,
                borderWidth: 1.5, borderColor: walletTxnTab === tab ? C.pinkBorder : C.glassBorder,
                elevation: walletTxnTab === tab ? 4 : 0,
                shadowColor: C.pink, shadowOpacity: walletTxnTab === tab ? 0.4 : 0, shadowRadius: 6,
              }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: walletTxnTab === tab ? '#fff' : C.textMuted, textTransform: 'capitalize' }}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Transactions ── */}
        <View style={{ marginHorizontal: 16, marginTop: 12 }}>
          {filteredTxns.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Text style={{ fontSize: 40 }}>💸</Text>
              <Text style={{ color: C.textDim, marginTop: 10, fontSize: 14 }}>No transactions found</Text>
            </View>
          ) : filteredTxns.map((t: any, i: number) => (
            <View key={t.id || i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderRadius: 16, padding: 14, marginBottom: 8, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.type === 'credit' ? C.greenGlass : C.redGlass, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1.5, borderColor: t.type === 'credit' ? C.greenBorder : C.redBorder }}>
                <Text style={{ fontSize: 18, color: t.type === 'credit' ? C.green : C.red, fontWeight: '900' }}>{t.type === 'credit' ? '↓' : '↑'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: C.text, fontWeight: '700' }} numberOfLines={1}>{t.description || (t.type === 'credit' ? 'Credited' : 'Debited')}</Text>
                <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{fmtDate(t.created_at)}</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '900', color: t.type === 'credit' ? C.green : C.red }}>
                {t.type === 'credit' ? '+' : '–'}₹{parseFloat(t.amount).toFixed(0)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenIn>
  );
}
