import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DotBG, SkeletonBox } from '../components/ui';
import { C, R, SHADOW, SP } from '../styles';
import { apiGet } from '../../api';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Analytics {
  total_rides: number;
  total_spent: number;
  avg_fare: number;
  total_savings: number;
  monthly: { label: string; rides: number; spent: number }[];
  vehicle: Record<string, number>;
  days7: { label: string; rides: number; spent: number }[];
  payment_methods: Record<string, number>;
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimNum({ to, prefix = '', suffix = '' }: { to: number; prefix?: string; suffix?: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [val, setVal] = useState(0);
  useEffect(() => {
    Animated.timing(anim, { toValue: to, duration: 1000, useNativeDriver: false }).start();
    const id = anim.addListener(({ value: v }) => setVal(Math.round(v)));
    return () => anim.removeListener(id);
  }, [to]);
  return <Text style={{ fontSize: 28, fontWeight: '900', color: C.text }}>{prefix}{val.toLocaleString('en-IN')}{suffix}</Text>;
}

// ─── Bar chart ────────────────────────────────────────────────────────────────
function BarChart({ bars, accent }: { bars: { label: string; value: number; sub?: string }[]; accent: string }) {
  const max = Math.max(...bars.map(b => b.value), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 88 }}>
      {bars.map((b, i) => {
        const isLast = i === bars.length - 1;
        const h = Math.max(4, Math.round((b.value / max) * 76));
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            {b.value > 0 && (
              <Text style={{ fontSize: 8, color: isLast ? accent : '#94A3B8', fontWeight: '800', marginBottom: 3 }}>
                {b.value >= 1000 ? `₹${(b.value / 1000).toFixed(1)}k` : b.sub ?? b.value}
              </Text>
            )}
            <View style={{
              width: '100%', height: h, borderRadius: 6,
              backgroundColor: isLast ? accent : b.value === 0 ? 'rgba(148,163,184,0.18)' : `${accent}55`,
            }} />
            <Text style={{ fontSize: 9, color: isLast ? accent : '#94A3B8', fontWeight: isLast ? '800' : '500', marginTop: 4 }}>
              {b.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Config ───────────────────────────────────────────────────────────────────
const VEHICLE_CFG: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  auto:          { label: 'Auto',          emoji: '🛺', color: C.saffron,  bg: C.saffGlass,   border: C.saffBorder   },
  bike:          { label: 'Bike',          emoji: '🏍️', color: C.pink,     bg: C.pinkGlass,   border: C.pinkBorder   },
  car:           { label: 'Car',           emoji: '🚗', color: '#1D4ED8',  bg: 'rgba(29,78,216,0.08)', border: 'rgba(29,78,216,0.25)' },
  hourly:        { label: 'By Hour',       emoji: '⏱️', color: C.purple,   bg: C.purpleGlass, border: C.purpleBorder },
  green_bike:    { label: 'E-Bike',        emoji: '⚡', color: C.green,    bg: C.greenGlass,  border: C.greenBorder  },
  electric_auto: { label: 'E-Auto',        emoji: '🌿', color: C.green,    bg: C.greenGlass,  border: C.greenBorder  },
};

const PAY_CFG: Record<string, { label: string; emoji: string }> = {
  cash:     { label: 'Cash',         emoji: '💵' },
  wallet:   { label: 'Wallet',       emoji: '👛' },
  upi_qr:   { label: 'UPI QR',       emoji: '📱' },
  online:   { label: 'UPI / Online', emoji: '📲' },
  upi:      { label: 'UPI',          emoji: '📲' },
  razorpay: { label: 'Razorpay',     emoji: '💳' },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <View style={{ padding: SP.md, gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[0, 1].map(i => <SkeletonBox key={i} style={{ flex: 1, height: 90, borderRadius: R.lg }} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[0, 1].map(i => <SkeletonBox key={i} style={{ flex: 1, height: 90, borderRadius: R.lg }} />)}
      </View>
      <SkeletonBox style={{ height: 160, borderRadius: R.lg }} />
      <SkeletonBox style={{ height: 130, borderRadius: R.lg }} />
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export function InsightsScreen() {
  const { setScreen, phone } = useApp();
  const { top } = useSafeAreaInsets();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = async () => {
    setLoading(true); setError(false);
    const r = await apiGet(`/api/rides/customer-analytics?phone=${encodeURIComponent(phone)}`);
    if (r && !r._error && typeof r.total_rides === 'number') {
      setData(r);
      Animated.timing(fadeAnim, { toValue: 1, duration: 480, useNativeDriver: true }).start();
    } else {
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalVehicleRides = data ? Object.values(data.vehicle).reduce((a, b) => a + b, 0) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <DotBG />

      {/* Header */}
      <View style={{
        paddingTop: (Platform.OS === 'android' ? 46 : top + 12),
        paddingBottom: 16,
        paddingHorizontal: SP.lg,
        backgroundColor: C.pink,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => setScreen('home')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'rgba(255,255,255,0.80)', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>SPPERO</Text>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>My Ride Insights</Text>
        </View>
        <TouchableOpacity onPress={load} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="refresh" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? <Skeleton /> : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>😕</Text>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 6 }}>Load nahi hua</Text>
          <Text style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 20 }}>Internet check karo aur dobara try karo</Text>
          <TouchableOpacity onPress={load} style={{ backgroundColor: C.pink, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Retry karo</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <Animated.ScrollView
          style={{ flex: 1, opacity: fadeAnim }}
          contentContainerStyle={{ padding: SP.md, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Stat tiles ── */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            {/* Total Rides */}
            <View style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: R.lg, padding: 14, borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.sm }}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>🛺</Text>
              <AnimNum to={data.total_rides} />
              <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '600', marginTop: 3 }}>Total Rides</Text>
            </View>
            {/* Total Spent */}
            <View style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: R.lg, padding: 14, borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.sm }}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>💸</Text>
              <AnimNum to={data.total_spent} prefix="₹" />
              <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '600', marginTop: 3 }}>Total Spent</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            {/* Avg Fare */}
            <View style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: R.lg, padding: 14, borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.sm }}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>📊</Text>
              <AnimNum to={data.avg_fare} prefix="₹" />
              <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '600', marginTop: 3 }}>Avg Per Ride</Text>
            </View>
            {/* Savings */}
            <View style={{ flex: 1, backgroundColor: C.greenGlass, borderRadius: R.lg, padding: 14, borderWidth: 1, borderColor: C.greenBorder, ...SHADOW.sm }}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>🎉</Text>
              <AnimNum to={data.total_savings} prefix="₹" />
              <Text style={{ color: C.green, fontSize: 11, fontWeight: '700', marginTop: 3 }}>Promo Savings</Text>
            </View>
          </View>

          {/* ── 6-Month Spending Chart ── */}
          {data.monthly.length > 0 && (
            <View style={{ backgroundColor: C.bgCard, borderRadius: R.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ fontSize: 15, marginRight: 8 }}>📅</Text>
                <Text style={{ fontSize: 14, fontWeight: '900', color: C.text, flex: 1 }}>Monthly Spending</Text>
                <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '600' }}>Last 6 months</Text>
              </View>
              <BarChart
                accent={C.pink}
                bars={data.monthly.map(m => ({ label: m.label, value: m.spent, sub: `${m.rides}r` }))}
              />
            </View>
          )}

          {/* ── 7-Day Activity ── */}
          <View style={{ backgroundColor: C.bgCard, borderRadius: R.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 15, marginRight: 8 }}>📈</Text>
              <Text style={{ fontSize: 14, fontWeight: '900', color: C.text, flex: 1 }}>This Week</Text>
              {(() => {
                const total7 = data.days7.reduce((a, d) => a + d.rides, 0);
                const spent7 = data.days7.reduce((a, d) => a + d.spent, 0);
                return total7 > 0 ? (
                  <View style={{ backgroundColor: C.pinkGlass, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.pinkBorder }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: C.pink }}>₹{spent7} · {total7} rides</Text>
                  </View>
                ) : null;
              })()}
            </View>
            <BarChart
              accent={C.saffron}
              bars={data.days7.map(d => ({ label: d.label, value: d.rides, sub: String(d.rides) }))}
            />
          </View>

          {/* ── Vehicle Breakdown ── */}
          {totalVehicleRides > 0 && (
            <View style={{ backgroundColor: C.bgCard, borderRadius: R.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ fontSize: 15, marginRight: 8 }}>🚦</Text>
                <Text style={{ fontSize: 14, fontWeight: '900', color: C.text }}>Vehicle Preference</Text>
              </View>
              <View style={{ gap: 10 }}>
                {Object.entries(data.vehicle)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => {
                    const cfg = VEHICLE_CFG[type] || { label: type, emoji: '🚗', color: C.textMuted, bg: C.glass, border: C.glassBorder };
                    const pct = Math.round((count / totalVehicleRides) * 100);
                    return (
                      <View key={type}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                          <View style={{ backgroundColor: cfg.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: cfg.border, flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 8 }}>
                            <Text style={{ fontSize: 13 }}>{cfg.emoji}</Text>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: cfg.color }}>{cfg.label}</Text>
                          </View>
                          <Text style={{ flex: 1, fontSize: 12, color: C.textMuted }}>{count} ride{count > 1 ? 's' : ''}</Text>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: cfg.color }}>{pct}%</Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: 'rgba(148,163,184,0.15)', borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{ height: '100%', width: `${pct}%`, backgroundColor: cfg.color, borderRadius: 3 }} />
                        </View>
                      </View>
                    );
                  })}
              </View>
            </View>
          )}

          {/* ── Payment Methods ── */}
          {Object.keys(data.payment_methods).length > 0 && (
            <View style={{ backgroundColor: C.bgCard, borderRadius: R.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ fontSize: 15, marginRight: 8 }}>💳</Text>
                <Text style={{ fontSize: 14, fontWeight: '900', color: C.text }}>How You Pay</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(data.payment_methods)
                  .sort(([, a], [, b]) => b - a)
                  .map(([method, count]) => {
                    const cfg = PAY_CFG[method] || { label: method, emoji: '💰' };
                    const totalPay = Object.values(data.payment_methods).reduce((a, b) => a + b, 0);
                    const pct = Math.round((count / totalPay) * 100);
                    return (
                      <View key={method} style={{ backgroundColor: C.glass, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.glassBorder, alignItems: 'center', minWidth: 80 }}>
                        <Text style={{ fontSize: 22, marginBottom: 4 }}>{cfg.emoji}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: C.text }}>{pct}%</Text>
                        <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{cfg.label}</Text>
                        <Text style={{ fontSize: 10, color: C.textDim }}>{count} rides</Text>
                      </View>
                    );
                  })}
              </View>
            </View>
          )}

          {/* ── Fun fact ── */}
          {data.total_rides > 0 && (
            <View style={{ backgroundColor: C.pinkGlass, borderRadius: R.lg, padding: 16, borderWidth: 1, borderColor: C.pinkBorder, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 28 }}>✨</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 3 }}>
                  {data.total_rides >= 100 ? `${data.total_rides} rides! Aap Sppero ke star rider hain 🌟` :
                   data.total_rides >= 50  ? `50+ rides — Sppero ka pakka fan!` :
                   data.total_rides >= 10  ? `${data.total_rides} rides aur counting — keep going!` :
                   `Pehle ${data.total_rides} ride${data.total_rides > 1 ? 's' : ''} ho gayi!`}
                </Text>
                {data.total_savings > 0 && (
                  <Text style={{ fontSize: 12, color: C.textMuted }}>Promos se ₹{data.total_savings} bachaye — smart rider!</Text>
                )}
              </View>
            </View>
          )}

          {data.total_rides === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ fontSize: 52, marginBottom: 12 }}>🛺</Text>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 6 }}>Pehli ride lo!</Text>
              <Text style={{ color: C.textMuted, fontSize: 13, textAlign: 'center' }}>Jaise hi ride complete hogi, yahan apni stats dekhna</Text>
            </View>
          )}

        </Animated.ScrollView>
      ) : null}
    </View>
  );
}
