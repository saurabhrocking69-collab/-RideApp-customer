import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Storage as AsyncStorage } from '../storage';
import { useApp } from '../context/AppContext';
import { DotBG, ScreenIn } from '../components/ui';
import { s, C } from '../styles';

const HIST_KEY   = 'sppero_fare_history';
const BUDGET_KEY = 'sppero_monthly_budget';

type HistEntry = { pickup: string; drop: string; fare: number; rideType: string; date: string };

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const RIDE_EMOJI: Record<string,string> = {
  auto: '🛺', bike: '🏍️', car: '🚕', eriksha: '🛵',
  luxury: '🚙', green_bike: '⚡', electric_auto: '🌿',
};

function monthKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}`; }
function monthLabel(d: Date) { return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }

// ── Animated number counter ───────────────────────────────────────────────────
function AnimCount({ value, prefix = '₹' }: { value: number; prefix?: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 900, useNativeDriver: false }).start();
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => anim.removeListener(id);
  }, [value]);
  return <Text style={{ fontSize: 40, fontWeight: '900', color: C.text }}>{prefix}{display.toLocaleString('en-IN')}</Text>;
}

// ── Mini bar chart ────────────────────────────────────────────────────────────
function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 80 }}>
      {data.map((d, i) => {
        const isLast = i === data.length - 1;
        const heightPct = (d.value / max) * 70;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: isLast ? C.pink : C.textMuted, marginBottom: 4 }}>
              {d.value > 0 ? `₹${(d.value / 1000).toFixed(1)}k` : '—'}
            </Text>
            <View style={{
              width: '100%', height: Math.max(heightPct, 4), borderRadius: 8,
              backgroundColor: isLast ? C.pink : C.glassMid,
              borderWidth: isLast ? 0 : 1, borderColor: C.glassBorder,
            }} />
            <Text style={{ fontSize: 9, color: isLast ? C.pink : C.textDim, marginTop: 5, fontWeight: isLast ? '800' : '600' }}>
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Route chip ───────────────────────────────────────────────────────────────
function RouteRow({ rank, pickup, drop, count, total }: {
  rank: number; pickup: string; drop: string; count: number; total: number;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: C.glassBorder,
    }}>
      <View style={{
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: rank === 1 ? C.yellow : rank === 2 ? C.glassMid : C.bgDeep,
        alignItems: 'center', justifyContent: 'center', marginRight: 12,
      }}>
        <Text style={{ fontSize: 12, fontWeight: '900', color: rank === 1 ? '#fff' : C.textMuted }}>
          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }} numberOfLines={1}>
          {pickup.length > 22 ? pickup.slice(0, 22) + '…' : pickup}
        </Text>
        <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }} numberOfLines={1}>
          → {drop.length > 24 ? drop.slice(0, 24) + '…' : drop}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: C.text }}>₹{Math.round(total / count)}</Text>
        <Text style={{ fontSize: 10, color: C.textMuted }}>{count} ride{count > 1 ? 's' : ''}</Text>
      </View>
    </View>
  );
}

export function BudgetScreen() {
  const { setScreen } = useApp();
  const [history, setHistory]     = useState<HistEntry[]>([]);
  const [budget, setBudget]       = useState(0);
  const [editBudget, setEditBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(HIST_KEY),
      AsyncStorage.getItem(BUDGET_KEY),
    ]).then(([h, b]) => {
      if (h) setHistory(JSON.parse(h));
      if (b) setBudget(parseFloat(b) || 0);
    });
  }, []);

  const saveBudget = async () => {
    const val = parseFloat(budgetInput.replace(/[^0-9.]/g, '')) || 0;
    setBudget(val);
    await AsyncStorage.setItem(BUDGET_KEY, String(val));
    setEditBudget(false);
  };

  // ── Derive analytics ────────────────────────────────────────────────────────
  const now = new Date();
  const thisMonthKey = monthKey(now);

  const thisMonth  = history.filter(h => monthKey(new Date(h.date)) === thisMonthKey);
  const thisTotal  = thisMonth.reduce((s, h) => s + h.fare, 0);
  const rideCount  = thisMonth.length;
  const avgFare    = rideCount > 0 ? thisTotal / rideCount : 0;

  // Most-used ride type this month
  const typeCount: Record<string,number> = {};
  thisMonth.forEach(h => { typeCount[h.rideType] = (typeCount[h.rideType] || 0) + 1; });
  const topType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0];

  // Last 3 months chart data
  const chartData = [-2, -1, 0].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const mk = monthKey(d);
    const total = history.filter(h => monthKey(new Date(h.date)) === mk).reduce((s, h) => s + h.fare, 0);
    return { label: MONTHS[d.getMonth()], value: total };
  });

  // Top 3 routes this month
  const routeMap: Record<string, { pickup: string; drop: string; count: number; total: number }> = {};
  thisMonth.forEach(h => {
    const k = `${h.pickup}||${h.drop}`;
    if (!routeMap[k]) routeMap[k] = { pickup: h.pickup, drop: h.drop, count: 0, total: 0 };
    routeMap[k].count++;
    routeMap[k].total += h.fare;
  });
  const topRoutes = Object.values(routeMap).sort((a, b) => b.count - a.count).slice(0, 3);

  // Budget progress
  const budgetUsed = budget > 0 ? Math.min(thisTotal / budget, 1) : 0;
  const budgetLeft = budget > 0 ? Math.max(budget - thisTotal, 0) : null;
  const overBudget = budget > 0 && thisTotal > budget;

  // Day-by-day spending this month (last 7 unique days with rides)
  const dayMap: Record<string, number> = {};
  thisMonth.forEach(h => {
    const dk = h.date.split('T')[0];
    dayMap[dk] = (dayMap[dk] || 0) + h.fare;
  });
  const recentDays = Object.entries(dayMap).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topTitle}>💰 Ride Budget</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>

        {/* ── Hero: This month total ── */}
        <View style={{
          backgroundColor: C.bgCard, borderRadius: 28, padding: 24,
          marginBottom: 14, elevation: 6, borderWidth: 1.5, borderColor: C.glassBorder,
          shadowColor: C.pink, shadowOpacity: 0.08, shadowRadius: 14,
        }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 8 }}>
            {monthLabel(now).toUpperCase()} SPENDING
          </Text>
          <AnimCount value={thisTotal} />
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 14 }}>
            <View style={{ flex: 1, backgroundColor: C.glassMid, borderRadius: 14, padding: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>{rideCount}</Text>
              <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>Rides</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: C.glassMid, borderRadius: 14, padding: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>₹{Math.round(avgFare)}</Text>
              <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>Avg Fare</Text>
            </View>
            {topType && (
              <View style={{ flex: 1, backgroundColor: C.pinkGlass, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: C.pinkBorder }}>
                <Text style={{ fontSize: 22 }}>{RIDE_EMOJI[topType[0]] || '🚗'}</Text>
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>Fav Ride</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Budget goal ── */}
        <View style={{
          backgroundColor: overBudget ? C.redGlass : C.bgCard,
          borderRadius: 20, padding: 18, marginBottom: 14,
          elevation: 4, borderWidth: 1.5,
          borderColor: overBudget ? C.redBorder : C.glassBorder,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: C.text }}>
              {overBudget ? '🚨 Budget Cross!' : '🎯 Monthly Budget'}
            </Text>
            <TouchableOpacity onPress={() => { setBudgetInput(String(budget || '')); setEditBudget(p => !p); }}
              style={{ backgroundColor: C.pinkGlass, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: C.pinkBorder }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.pink }}>{editBudget ? 'Cancel' : budget > 0 ? 'Edit' : 'Set Goal'}</Text>
            </TouchableOpacity>
          </View>

          {editBudget ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={budgetInput} onChangeText={setBudgetInput}
                placeholder="Monthly limit (e.g. 2000)" placeholderTextColor={C.textDim}
                keyboardType="numeric"
                style={{
                  flex: 1, backgroundColor: C.glassMid, borderRadius: 12, padding: 12,
                  fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.glassBorder,
                }} />
              <TouchableOpacity onPress={saveBudget} style={{
                backgroundColor: C.pink, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : budget > 0 ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: C.textMuted }}>
                  ₹{Math.round(thisTotal)} spent / ₹{budget} budget
                </Text>
                {budgetLeft !== null && (
                  <Text style={{ fontSize: 12, fontWeight: '700', color: overBudget ? C.red : C.green }}>
                    {overBudget ? `₹${Math.round(thisTotal - budget)} over` : `₹${Math.round(budgetLeft)} left`}
                  </Text>
                )}
              </View>
              <View style={{ backgroundColor: C.glassMid, borderRadius: 8, height: 10, overflow: 'hidden' }}>
                <View style={{
                  height: '100%', borderRadius: 8,
                  width: `${Math.min(budgetUsed * 100, 100)}%`,
                  backgroundColor: overBudget ? C.red : budgetUsed > 0.8 ? C.yellow : C.pink,
                }} />
              </View>
            </>
          ) : (
            <Text style={{ fontSize: 13, color: C.textMuted }}>
              Set a monthly budget to track how much you're spending 📊
            </Text>
          )}
        </View>

        {/* ── 3-month chart ── */}
        <View style={{
          backgroundColor: C.bgCard, borderRadius: 20, padding: 18,
          marginBottom: 14, elevation: 4, borderWidth: 1, borderColor: C.glassBorder,
        }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 14 }}>📊 3-Month Trend</Text>
          {chartData.some(d => d.value > 0)
            ? <BarChart data={chartData} />
            : <Text style={{ color: C.textDim, fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>No data yet</Text>
          }
        </View>

        {/* ── Top routes ── */}
        {topRoutes.length > 0 && (
          <View style={{
            backgroundColor: C.bgCard, borderRadius: 20, padding: 18,
            marginBottom: 14, elevation: 4, borderWidth: 1, borderColor: C.glassBorder,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 4 }}>🏆 Top Routes This Month</Text>
            {topRoutes.map((r, i) => (
              <RouteRow key={i} rank={i + 1} pickup={r.pickup} drop={r.drop} count={r.count} total={r.total} />
            ))}
          </View>
        )}

        {/* ── Recent days ── */}
        {recentDays.length > 0 && (
          <View style={{
            backgroundColor: C.bgCard, borderRadius: 20, padding: 18,
            marginBottom: 14, elevation: 4, borderWidth: 1, borderColor: C.glassBorder,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 12 }}>📅 Day-by-Day Spending</Text>
            {recentDays.map(([dk, amt], i) => {
              const d = new Date(dk);
              return (
                <View key={i} style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  paddingVertical: 10, borderBottomWidth: i < recentDays.length - 1 ? 1 : 0, borderBottomColor: C.glassBorder,
                }}>
                  <Text style={{ fontSize: 13, color: C.text }}>
                    {d.getDate()} {MONTHS[d.getMonth()]}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ height: 4, borderRadius: 4, width: Math.max((amt / (recentDays[0][1] || 1)) * 80, 8), backgroundColor: C.pinkGlass, borderWidth: 1, borderColor: C.pinkBorder }} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.text, width: 52, textAlign: 'right' }}>₹{Math.round(amt)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {history.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 50 }}>
            <Text style={{ fontSize: 40 }}>📊</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.text, marginTop: 12 }}>No rides yet</Text>
            <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', marginTop: 6 }}>
              Book a ride — your spending will be automatically tracked here
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenIn>
  );
}
