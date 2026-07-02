import { useEffect, useRef } from 'react';
import { Animated, Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, ScreenIn } from '../components/ui';
import { C, T, SP, R, SHADOW } from '../styles';

const RULES = [
  {
    id: 'fare_over_100',
    icon: '💎',
    label: '₹100+ Ride',
    desc: 'Complete any ride above ₹100',
    cashback: 10,
    color: C.purple,
    bg: C.purpleGlass,
    border: C.purpleBorder,
    how: 'Automatic on every qualifying ride',
  },
  {
    id: 'second_ride_day',
    icon: '✌️',
    label: '2nd Ride Today',
    desc: 'Complete your 2nd ride of the day',
    cashback: 10,
    color: C.plum,
    bg: C.plumGlass,
    border: C.plumBorder,
    how: 'Credited after 2nd completed ride',
  },
  {
    id: 'third_ride_day',
    icon: '🔥',
    label: '3rd Ride Streak',
    desc: 'Complete your 3rd ride of the day',
    cashback: 15,
    color: C.saffron,
    bg: C.saffGlass,
    border: C.saffBorder,
    how: 'Credited after 3rd completed ride',
  },
  {
    id: 'wallet_pay',
    icon: '👛',
    label: 'Wallet Pay Bonus',
    desc: 'Pay with wallet on rides ₹50+',
    cashback: 5,
    color: C.green,
    bg: C.greenGlass,
    border: C.greenBorder,
    how: 'Auto-credited on wallet payment',
  },
];

export function RewardsScreen() {
  const { phone, setScreen, setTab, rewardsDash, loadRewardsDash } = useApp();

  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef(RULES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    loadRewardsDash(phone);
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    RULES.forEach((_, i) => {
      Animated.timing(cardAnims[i], {
        toValue: 1,
        duration: 400,
        delay: 150 + i * 80,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  const ridesT = rewardsDash?.rides_today ?? 0;
  const totalCashback = rewardsDash?.total_cashback_earned ?? 0;
  const walletBal = rewardsDash?.wallet_balance ?? 0;
  const history: any[] = rewardsDash?.cashback_history ?? [];

  const ruleMap: Record<string, boolean> = {};
  (rewardsDash?.rules ?? []).forEach((r: any) => { ruleMap[r.id] = r.claimed_today; });

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const ruleLabel: Record<string, string> = {
    fare_over_100: '₹100+ Ride Cashback',
    second_ride_day: '2nd Ride Cashback',
    third_ride_day: '3rd Ride Cashback',
    wallet_pay: 'Wallet Pay Bonus',
  };

  const progressColor = ridesT >= 3 ? C.yellow : ridesT >= 2 ? C.green : C.pink;

  return (
    <ScreenIn style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── Plum header ── */}
      <Animated.View style={{
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        backgroundColor: C.plum,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 12 : 52,
        paddingBottom: SP.lg,
        paddingHorizontal: SP.md,
        overflow: 'hidden',
      }}>
        <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,45,120,0.08)', top: -100, right: -70 }} />
        <View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.03)', bottom: -50, left: -30 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SP.lg }}>
          <Bouncy onPress={() => { setScreen('home'); setTab('profile'); }}
            style={{ marginRight: 14, padding: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: R.sm, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)' }}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Bouncy>
          <View style={{ flex: 1 }}>
            <Text style={{ ...T.title, color: '#fff' }}>Cashback Rewards</Text>
            <Text style={{ ...T.caption, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Har ride pe automatic cashback</Text>
          </View>
          <Bouncy onPress={() => loadRewardsDash(phone)}
            style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: R.sm, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' }}>
            <Ionicons name="refresh" size={18} color="#fff" />
          </Bouncy>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: SP.md }}>
          {[
            { val: `₹${totalCashback.toFixed(0)}`, label: 'Total Earned', color: C.yellow, bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.35)' },
            { val: `₹${walletBal.toFixed(0)}`,     label: 'Wallet Bal',   color: C.green,  bg: 'rgba(5,150,105,0.18)',  border: 'rgba(5,150,105,0.35)'  },
            { val: `${ridesT}`,                     label: 'Rides Today',  color: C.pink,   bg: 'rgba(255,45,120,0.18)', border: 'rgba(255,45,120,0.35)' },
          ].map((s, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: s.bg, borderRadius: R.md, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: s.border }}>
              <Text style={{ color: s.color, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{s.val}</Text>
              <Text style={{ ...T.label, color: 'rgba(255,255,255,0.55)', marginTop: 4, textAlign: 'center' }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Today's progress */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ ...T.caption, color: 'rgba(255,255,255,0.65)' }}>Today's Ride Progress</Text>
            <Text style={{ ...T.caption, color: 'rgba(255,255,255,0.4)' }}>{ridesT}/3 rides</Text>
          </View>
          <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: R.full, overflow: 'hidden' }}>
            <View style={{ height: 8, borderRadius: R.full, width: `${Math.min(100, (ridesT / 3) * 100)}%`, backgroundColor: progressColor }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            {[1, 2, 3].map(n => (
              <View key={n} style={{ alignItems: 'center' }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: ridesT >= n ? progressColor : 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: ridesT >= n ? progressColor : 'rgba(255,255,255,0.2)' }}>
                  <Text style={{ ...T.label, color: ridesT >= n ? C.plum : 'rgba(255,255,255,0.35)' }}>{n}</Text>
                </View>
                <Text style={{ ...T.label, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                  {n === 1 ? '—' : n === 2 ? '₹10' : '₹15'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingTop: SP.md }}>

        {/* ── How to earn ── */}
        <Text style={{ ...T.bodyBold, color: C.text, marginHorizontal: SP.md, marginBottom: SP.sm }}>How to Earn Cashback</Text>
        {RULES.map((rule, i) => {
          const claimed = ruleMap[rule.id] ?? false;
          return (
            <Animated.View key={rule.id} style={{
              opacity: cardAnims[i],
              transform: [{ translateX: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
              marginHorizontal: SP.md, marginBottom: SP.sm,
              backgroundColor: C.bgCard, borderRadius: R.md,
              borderWidth: 1.5, borderColor: claimed ? C.greenBorder : rule.border,
              overflow: 'hidden', ...SHADOW.sm,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: SP.md }}>
                <View style={{ width: 52, height: 52, borderRadius: R.sm, backgroundColor: rule.bg, alignItems: 'center', justifyContent: 'center', marginRight: 14, borderWidth: 1.5, borderColor: rule.border }}>
                  <Text style={{ fontSize: 26 }}>{rule.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ ...T.bodyBold, color: C.text, flex: 1 }}>{rule.label}</Text>
                    <View style={{ backgroundColor: claimed ? C.greenGlass : rule.bg, borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: claimed ? C.greenBorder : rule.border }}>
                      <Text style={{ ...T.caption, color: claimed ? C.green : rule.color, fontWeight: '900' as const }}>
                        {claimed ? '✓ Earned' : `+₹${rule.cashback}`}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ ...T.caption, color: C.textMuted, lineHeight: 18 }}>{rule.desc}</Text>
                  <Text style={{ fontSize: 10, color: C.textDim, marginTop: 3 }}>{rule.how}</Text>
                </View>
              </View>
              {claimed && <View style={{ height: 3, backgroundColor: C.green }} />}
            </Animated.View>
          );
        })}

        {/* ── Wallet pay motivation ── */}
        <View style={{ marginHorizontal: SP.md, marginTop: SP.xs, marginBottom: SP.md, backgroundColor: C.plum, borderRadius: R.md, padding: SP.md, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', ...SHADOW.md }}>
          <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,45,120,0.10)', top: -40, right: -20 }} />
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)' }}>
            <Text style={{ fontSize: 24 }}>👛</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...T.bodyBold, color: C.yellow }}>Wallet se pay = zyada savings</Text>
            <Text style={{ ...T.caption, color: 'rgba(255,255,255,0.6)', marginTop: 3, lineHeight: 18 }}>
              Har ₹50+ ride pe wallet se pay karo aur ₹5 extra cashback pao
            </Text>
          </View>
          <Bouncy onPress={() => setScreen('wallet')}
            style={{ backgroundColor: C.pink, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 9, elevation: 6, shadowColor: C.pink, shadowOpacity: 0.45, shadowRadius: 8 }}>
            <Text style={{ ...T.label, color: '#fff' }}>ADD{'\n'}MONEY</Text>
          </Bouncy>
        </View>

        {/* ── Cashback History ── */}
        <Text style={{ ...T.bodyBold, color: C.text, marginHorizontal: SP.md, marginBottom: SP.sm }}>Cashback History</Text>
        {history.length === 0 ? (
          <View style={{ alignItems: 'center', padding: SP.xxl, backgroundColor: C.bgCard, marginHorizontal: SP.md, borderRadius: R.md, borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ fontSize: 40 }}>🎁</Text>
            <Text style={{ ...T.bodyBold, color: C.text, marginTop: 12 }}>Koi cashback abhi nahi mila</Text>
            <Text style={{ ...T.caption, color: C.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
              Pehli ride karo aur cashback earn karna shuru karo!
            </Text>
          </View>
        ) : history.map((h: any, i: number) => (
          <View key={i} style={{ marginHorizontal: SP.md, marginBottom: SP.sm, backgroundColor: C.bgCard, borderRadius: R.md, padding: SP.md, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.sm }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.greenGlass, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1.5, borderColor: C.greenBorder }}>
              <Text style={{ color: C.green, fontSize: 18, fontWeight: '900' }}>₹</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...T.bodyBold, color: C.text }}>
                {ruleLabel[h.rule_type] || h.rule_type}
              </Text>
              <Text style={{ ...T.caption, color: C.textDim, marginTop: 2 }}>
                {h.fare ? `Ride ₹${parseFloat(h.fare).toFixed(0)} · ` : ''}{fmtDate(h.created_at)}
              </Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '900' as const, color: C.green }}>+₹{parseFloat(h.amount).toFixed(0)}</Text>
          </View>
        ))}
      </ScrollView>
    </ScreenIn>
  );
}
