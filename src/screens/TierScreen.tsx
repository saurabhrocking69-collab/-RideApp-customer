import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DotBG } from '../components/ui';
import { C, R, SHADOW, SP } from '../styles';
import { apiGet } from '../../api';

// ─── Tier definitions ────────────────────────────────────────────────────────
const TIERS = [
  {
    tier: 'starter', label: 'Starter', emoji: '🌱', min: 0, max: 4, color: '#059669',
    bg: 'rgba(5,150,105,0.10)', border: 'rgba(5,150,105,0.28)',
    tagline: 'Your journey begins here',
    perks: ['Sppero cashback rewards', 'Wallet payments', 'Real-time driver tracking', 'Emergency SOS'],
  },
  {
    tier: 'regular', label: 'Regular', emoji: '⭐', min: 5, max: 19, color: '#1D4ED8',
    bg: 'rgba(29,78,216,0.10)', border: 'rgba(29,78,216,0.28)',
    tagline: 'A trusted Sppero rider',
    perks: ['Everything in Starter', 'Priority customer support', '₹5 extra wallet cashback on rides ≥₹80', 'Saved places on all devices'],
  },
  {
    tier: 'expert', label: 'Expert', emoji: '🔥', min: 20, max: 49, color: '#FF7A00',
    bg: 'rgba(255,122,0,0.10)', border: 'rgba(255,122,0,0.28)',
    tagline: 'You know Sppero inside out',
    perks: ['Everything in Regular', '2× cashback on wallet payments', '1 free cancellation per week'],
  },
  {
    tier: 'elite', label: 'Elite', emoji: '👑', min: 50, max: null, color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)',
    tagline: 'The pinnacle of Sppero riding',
    perks: ['Everything in Expert', '3× cashback on every ride', 'Priority driver matching', '10% bonus on wallet top-ups', 'Exclusive Elite badge'],
  },
];

interface TierData {
  total_rides: number;
  tier: string;
  label: string;
  emoji: string;
  color: string;
  rides_to_next: number;
  next_tier: { tier: string; label: string; emoji: string; min: number } | null;
  progress_pct: number;
}

// ─── Animated progress bar ────────────────────────────────────────────────────
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 900, useNativeDriver: false }).start();
  }, [pct]);
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={{ height: 8, backgroundColor: 'rgba(148,163,184,0.20)', borderRadius: 4, overflow: 'hidden' }}>
      <Animated.View style={{ height: '100%', width, backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}

// ─── Tier step chip ───────────────────────────────────────────────────────────
function TierStep({ t, done, active }: { t: typeof TIERS[0]; done: boolean; active: boolean }) {
  return (
    <View style={{
      alignItems: 'center', flex: 1,
      opacity: done || active ? 1 : 0.38,
    }}>
      <View style={{
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: active ? t.bg : done ? t.bg : 'rgba(148,163,184,0.10)',
        borderWidth: active ? 2 : 1.5,
        borderColor: active ? t.color : done ? t.border : 'rgba(148,163,184,0.22)',
        alignItems: 'center', justifyContent: 'center',
        ...( active ? { elevation: 8, shadowColor: t.color, shadowOpacity: 0.45, shadowRadius: 10 } : {} ),
      }}>
        {done && !active ? (
          <Ionicons name="checkmark" size={20} color={t.color} />
        ) : (
          <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
        )}
      </View>
      <Text style={{ fontSize: 10, fontWeight: active ? '900' : '700', color: active ? t.color : done ? t.color : '#94A3B8', marginTop: 5 }}>
        {t.label}
      </Text>
      <Text style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>{t.min}{t.max ? `–${t.max}` : '+'}</Text>
    </View>
  );
}

export function TierScreen() {
  const { setScreen, phone, userName } = useApp();
  const { top } = useSafeAreaInsets();
  const [data, setData] = useState<TierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const heroScale = useRef(new Animated.Value(0.85)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(32)).current;

  const load = async () => {
    setLoading(true); setError(false);
    const r = await apiGet(`/api/customer/tier?phone=${encodeURIComponent(phone)}`);
    if (r && !r._error && r.tier) {
      setData(r);
      Animated.parallel([
        Animated.spring(heroScale, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }),
        Animated.timing(heroOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(cardAnim, { toValue: 0, friction: 6, tension: 120, useNativeDriver: true }),
      ]).start();
    } else {
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const currentTierCfg = data ? TIERS.find(t => t.tier === data.tier) || TIERS[0] : TIERS[0];
  const currentIdx = TIERS.indexOf(currentTierCfg);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <DotBG />

      {/* Header */}
      <View style={{
        paddingTop: Platform.OS === 'android' ? 46 : top + 12,
        paddingBottom: 16, paddingHorizontal: SP.lg,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: currentTierCfg.color,
      }}>
        <TouchableOpacity onPress={() => setScreen('home')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'rgba(255,255,255,0.80)', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>SPPERO</Text>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>Rider Tier</Text>
        </View>
        <TouchableOpacity onPress={load} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="refresh" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 42, marginBottom: 12 }}>⏳</Text>
          <Text style={{ color: C.textMuted, fontSize: 14 }}>Tier load ho raha hai...</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>😕</Text>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 16 }}>Load nahi hua</Text>
          <TouchableOpacity onPress={load} style={{ backgroundColor: C.pink, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Retry karo</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ── Tier Hero Card ── */}
          <Animated.View style={{
            margin: SP.md, borderRadius: R.xl,
            backgroundColor: currentTierCfg.bg,
            borderWidth: 2, borderColor: currentTierCfg.border,
            padding: 24, alignItems: 'center',
            transform: [{ scale: heroScale }], opacity: heroOpacity,
            ...SHADOW.md,
            elevation: 10, shadowColor: currentTierCfg.color, shadowOpacity: 0.35, shadowRadius: 18,
          }}>
            <Text style={{ fontSize: 64, marginBottom: 8 }}>{currentTierCfg.emoji}</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2, color: currentTierCfg.color, marginBottom: 4 }}>
              {(userName || 'Rider').toUpperCase()}
            </Text>
            <Text style={{ fontSize: 32, fontWeight: '900', color: currentTierCfg.color }}>{currentTierCfg.label}</Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4, marginBottom: 16 }}>{currentTierCfg.tagline}</Text>

            <View style={{ backgroundColor: 'rgba(148,163,184,0.12)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 18 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, textAlign: 'center' }}>
                {data.total_rides} ride{data.total_rides !== 1 ? 's' : ''} completed
              </Text>
            </View>

            {/* Progress to next tier */}
            {data.next_tier ? (
              <View style={{ width: '100%' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: currentTierCfg.color }}>{currentTierCfg.label} {currentTierCfg.emoji}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8' }}>{data.next_tier.label} {data.next_tier.emoji}</Text>
                </View>
                <ProgressBar pct={data.progress_pct} color={currentTierCfg.color} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ fontSize: 10, color: '#94A3B8' }}>{data.total_rides} rides</Text>
                  <Text style={{ fontSize: 10, color: '#94A3B8' }}>{data.next_tier.min} rides</Text>
                </View>
                <View style={{ backgroundColor: currentTierCfg.bg, borderRadius: 10, padding: 10, marginTop: 12, borderWidth: 1, borderColor: currentTierCfg.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 18 }}>🎯</Text>
                  <Text style={{ flex: 1, fontSize: 12, fontWeight: '800', color: currentTierCfg.color }}>
                    {data.rides_to_next} aur ride{data.rides_to_next !== 1 ? 's' : ''} → {data.next_tier.label} {data.next_tier.emoji}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20 }}>🏆</Text>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '900', color: '#F59E0B' }}>Maximum tier — aap Elite rider hain!</Text>
              </View>
            )}
          </Animated.View>

          {/* ── Tier Journey ── */}
          <Animated.View style={{
            marginHorizontal: SP.md, marginBottom: 14,
            backgroundColor: C.bgCard, borderRadius: R.lg, padding: 16,
            borderWidth: 1, borderColor: C.glassBorder,
            transform: [{ translateY: cardAnim }],
            ...SHADOW.sm,
          }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: C.text, marginBottom: 16 }}>🗺️ Your Journey</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>
              {TIERS.map((t, i) => (
                <TierStep key={t.tier} t={t} done={i < currentIdx} active={i === currentIdx} />
              ))}
            </View>
          </Animated.View>

          {/* ── Current Perks ── */}
          <Animated.View style={{
            marginHorizontal: SP.md, marginBottom: 14,
            backgroundColor: currentTierCfg.bg, borderRadius: R.lg, padding: 16,
            borderWidth: 1.5, borderColor: currentTierCfg.border,
            transform: [{ translateY: cardAnim }],
          }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: currentTierCfg.color, marginBottom: 12 }}>
              {currentTierCfg.emoji} {currentTierCfg.label} Benefits
            </Text>
            {currentTierCfg.perks.map((perk, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: i < currentTierCfg.perks.length - 1 ? 10 : 0 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: currentTierCfg.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
                <Text style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: '600' }}>{perk}</Text>
              </View>
            ))}
          </Animated.View>

          {/* ── Next tier preview ── */}
          {data.next_tier && (() => {
            const nextCfg = TIERS.find(t => t.tier === data.next_tier!.tier)!;
            return (
              <Animated.View style={{
                marginHorizontal: SP.md, marginBottom: 14,
                backgroundColor: C.bgCard, borderRadius: R.lg, padding: 16,
                borderWidth: 1, borderColor: C.glassBorder,
                transform: [{ translateY: cardAnim }],
                ...SHADOW.sm,
              }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: C.textMuted, marginBottom: 12 }}>
                  🔒 Unlock at {nextCfg.label} {nextCfg.emoji}
                </Text>
                {nextCfg.perks.filter(p => !currentTierCfg.perks.includes(p)).map((perk, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, opacity: 0.65 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: nextCfg.color, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="lock-closed" size={10} color="#fff" />
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, color: C.textMuted }}>{perk}</Text>
                  </View>
                ))}
              </Animated.View>
            );
          })()}

          {/* ── All tiers overview ── */}
          <Animated.View style={{
            marginHorizontal: SP.md, marginBottom: 14,
            backgroundColor: C.bgCard, borderRadius: R.lg, padding: 16,
            borderWidth: 1, borderColor: C.glassBorder,
            transform: [{ translateY: cardAnim }],
            ...SHADOW.sm,
          }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: C.text, marginBottom: 14 }}>📊 All Tiers</Text>
            {TIERS.map((t, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <View key={t.tier} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingVertical: 12,
                  borderBottomWidth: i < TIERS.length - 1 ? 1 : 0,
                  borderBottomColor: C.glassBorder,
                  opacity: done || active ? 1 : 0.45,
                }}>
                  <View style={{
                    width: 38, height: 38, borderRadius: 19,
                    backgroundColor: t.bg, borderWidth: 1.5, borderColor: t.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {done ? <Ionicons name="checkmark" size={18} color={t.color} /> : <Text style={{ fontSize: 18 }}>{t.emoji}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: active ? t.color : C.text }}>{t.label}</Text>
                    <Text style={{ fontSize: 11, color: C.textMuted }}>{t.min}{t.max ? `–${t.max}` : '+'} rides</Text>
                  </View>
                  {active && (
                    <View style={{ backgroundColor: t.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: t.border }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: t.color }}>CURRENT</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </Animated.View>

        </ScrollView>
      ) : null}
    </View>
  );
}
