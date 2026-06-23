import { useEffect, useRef } from 'react';
import { Animated, Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { ScreenIn } from '../components/ui';

const RULES = [
  {
    id: 'fare_over_100',
    icon: '💎',
    label: '₹100+ Ride',
    desc: 'Complete any ride above ₹100',
    cashback: 10,
    color: '#7B1FA2',
    bg: '#F3E5F5',
    how: 'Automatic on every qualifying ride',
  },
  {
    id: 'second_ride_day',
    icon: '✌️',
    label: '2nd Ride Today',
    desc: 'Complete your 2nd ride of the day',
    cashback: 10,
    color: '#1976D2',
    bg: '#E3F2FD',
    how: 'Credited after 2nd completed ride',
  },
  {
    id: 'third_ride_day',
    icon: '🔥',
    label: '3rd Ride Streak',
    desc: 'Complete your 3rd ride of the day',
    cashback: 15,
    color: '#E64A19',
    bg: '#FBE9E7',
    how: 'Credited after 3rd completed ride',
  },
  {
    id: 'wallet_pay',
    icon: '👛',
    label: 'Wallet Pay Bonus',
    desc: 'Pay with wallet on rides ₹50+',
    cashback: 5,
    color: '#2E7D32',
    bg: '#E8F5E9',
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

  return (
    <ScreenIn style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <Animated.View style={{
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        backgroundColor: '#1a1a2e',
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 12 : 52,
        paddingBottom: 24,
        paddingHorizontal: 18,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }}
            style={{ marginRight: 14, padding: 7, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10 }}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', flex: 1 }}>🎁 Cashback Rewards</Text>
          <TouchableOpacity onPress={() => loadRewardsDash(phone)} style={{ padding: 8 }}>
            <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: '#FFD700', fontSize: 26, fontWeight: '900' }}>₹{totalCashback.toFixed(0)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 3, textAlign: 'center' }}>Total Cashback{'\n'}Earned</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: '#4CAF50', fontSize: 26, fontWeight: '900' }}>₹{walletBal.toFixed(0)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 3, textAlign: 'center' }}>Wallet{'\n'}Balance</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: '#e94560', fontSize: 26, fontWeight: '900' }}>{ridesT}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 3, textAlign: 'center' }}>Rides{'\n'}Today</Text>
          </View>
        </View>

        {/* Today's progress bar */}
        <View style={{ marginTop: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600' }}>Today's Ride Progress</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{ridesT}/3 rides</Text>
          </View>
          <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
            <View style={{
              height: 8,
              borderRadius: 4,
              width: `${Math.min(100, (ridesT / 3) * 100)}%`,
              backgroundColor: ridesT >= 3 ? '#FFD700' : ridesT >= 2 ? '#4CAF50' : '#e94560',
            }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            {[1, 2, 3].map(n => (
              <View key={n} style={{ alignItems: 'center' }}>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: ridesT >= n ? '#FFD700' : 'rgba(255,255,255,0.15)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: ridesT >= n ? '#1a1a2e' : 'rgba(255,255,255,0.4)' }}>{n}</Text>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, marginTop: 3 }}>
                  {n === 1 ? '' : n === 2 ? '₹10' : '₹15'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* How to earn */}
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a2e', marginHorizontal: 16, marginTop: 20, marginBottom: 12 }}>
          How to Earn Cashback
        </Text>
        {RULES.map((rule, i) => {
          const claimed = ruleMap[rule.id] ?? false;
          return (
            <Animated.View key={rule.id} style={{
              opacity: cardAnims[i],
              transform: [{ translateX: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
              marginHorizontal: 16, marginBottom: 10,
              backgroundColor: '#fff',
              borderRadius: 16,
              elevation: 2,
              shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4,
              overflow: 'hidden',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
                <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: rule.bg, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Text style={{ fontSize: 26 }}>{rule.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#1a1a2e', flex: 1 }}>{rule.label}</Text>
                    <View style={{ backgroundColor: claimed ? '#E8F5E9' : rule.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: claimed ? '#2E7D32' : rule.color }}>
                        {claimed ? '✓ Earned' : `+₹${rule.cashback}`}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: '#666', lineHeight: 17 }}>{rule.desc}</Text>
                  <Text style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>{rule.how}</Text>
                </View>
              </View>
              {claimed && (
                <View style={{ height: 3, backgroundColor: '#4CAF50' }} />
              )}
            </Animated.View>
          );
        })}

        {/* Wallet pay motivation */}
        <View style={{
          marginHorizontal: 16, marginTop: 8, marginBottom: 16,
          backgroundColor: '#1a1a2e',
          borderRadius: 16,
          padding: 18,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
            <Text style={{ fontSize: 24 }}>👛</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFD700', fontWeight: '800', fontSize: 14 }}>Pay with Wallet = More Savings</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 3, lineHeight: 18 }}>
              Wallet se pay karo aur ₹5 extra cashback pao on every ride ₹50+
            </Text>
          </View>
          <TouchableOpacity onPress={() => setScreen('wallet')}
            style={{ backgroundColor: '#e94560', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Add{'\n'}Money</Text>
          </TouchableOpacity>
        </View>

        {/* Cashback History */}
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a2e', marginHorizontal: 16, marginBottom: 12 }}>
          Cashback History
        </Text>
        {history.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 32, backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16 }}>
            <Text style={{ fontSize: 40 }}>🎁</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginTop: 12 }}>Koi cashback abhi nahi mila</Text>
            <Text style={{ fontSize: 12, color: '#999', marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
              Pehli ride karo aur cashback earn karna shuru karo!
            </Text>
          </View>
        ) : history.map((h: any, i: number) => (
          <View key={i} style={{
            marginHorizontal: 16, marginBottom: 8,
            backgroundColor: '#fff',
            borderRadius: 14,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            elevation: 1,
          }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ fontSize: 18 }}>💚</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a2e' }}>
                {ruleLabel[h.rule_type] || h.rule_type}
              </Text>
              <Text style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                {h.fare ? `Ride fare ₹${parseFloat(h.fare).toFixed(0)} · ` : ''}{fmtDate(h.created_at)}
              </Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#2E7D32' }}>+₹{parseFloat(h.amount).toFixed(0)}</Text>
          </View>
        ))}
      </ScrollView>
    </ScreenIn>
  );
}
