import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { C, R, SP, T, s } from '../styles';

const SURGE_OPTS = [
  {
    amount: 15, label: '+₹15',
    tag: 'Low boost',
    description: 'Thodi zyada chance',
    color: '#8BC34A', glass: 'rgba(139,195,74,0.10)', border: 'rgba(139,195,74,0.30)',
    speedBars: 2,
  },
  {
    amount: 25, label: '+₹25',
    tag: 'Good boost',
    description: 'Driver jaldi milega',
    color: '#F59E0B', glass: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)',
    speedBars: 3,
  },
  {
    amount: 40, label: '+₹40',
    tag: 'Strong boost',
    description: 'Zyada drivers attract honge',
    color: '#FF9800', glass: 'rgba(255,152,0,0.10)', border: 'rgba(255,152,0,0.30)',
    speedBars: 4,
  },
  {
    amount: 65, label: '+₹65',
    tag: 'High priority',
    description: 'Bahut fast matching',
    color: '#FF5722', glass: 'rgba(255,87,34,0.10)', border: 'rgba(255,87,34,0.30)',
    speedBars: 5,
  },
  {
    amount: 100, label: '+₹100',
    tag: 'Urgent',
    description: 'Maximum priority — sabse pehle aapki ride',
    color: '#E91E63', glass: 'rgba(233,30,99,0.10)', border: 'rgba(233,30,99,0.30)',
    speedBars: 6,
  },
];

function SpeedBars({ count, color }: { count: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3, alignItems: 'flex-end' }}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <View
          key={i}
          style={{
            width: 4,
            height: 6 + i * 3,
            borderRadius: 2,
            backgroundColor: i <= count ? color : 'rgba(255,255,255,0.12)',
          }}
        />
      ))}
    </View>
  );
}

export function SurgePricingScreen() {
  const {
    serverSurgeOffer, setServerSurgeOffer,
    surgeFareNow, surging,
    surgeFare, rideData, surgeCount,
    setScreen,
    rideIcon, rideType,
    pickup, drop,
  } = useApp();

  const baseFare = parseInt((surgeFare || rideData?.fare || '0').replace(/[^0-9]/g, '')) || 0;
  const recommended = serverSurgeOffer?.amt ?? 25;

  const [selected, setSelected] = useState<number>(recommended);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState(serverSurgeOffer?.timeout_sec ?? 20);
  useEffect(() => {
    if (timeLeft <= 0) return;
    const iv = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(iv);
  }, []);

  // Timer bar animation
  const timerAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(timerAnim, {
      toValue: 0,
      duration: (serverSurgeOffer?.timeout_sec ?? 20) * 1000,
      useNativeDriver: false,
    }).start();
  }, []);

  // Fade-in entrance
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleConfirm = () => {
    if (surging) return;
    setServerSurgeOffer(null);
    setScreen('matching');
    surgeFareNow(selected);
  };

  const handleCancel = () => {
    // Don't cancel the ride — just go back to matching screen (search continues as-is)
    setServerSurgeOffer(null);
    setScreen('matching');
  };

  const timerPct = timerAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const timerColor = timerAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [C.red, C.yellow, C.mint],
  });

  const opts = SURGE_OPTS.filter(o => [15, 25, 40, 65, 100].includes(o.amount));
  const selectedOpt = opts.find(o => o.amount === selected)!;

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, backgroundColor: C.bg }}>

      {/* ── Header ── */}
      <View style={{
        paddingTop: Platform.OS === 'android' ? 46 : 52,
        paddingBottom: 16, paddingHorizontal: SP.md,
        backgroundColor: C.bgCard,
        borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,152,0,0.20)',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: 'rgba(255,152,0,0.14)', borderWidth: 2, borderColor: 'rgba(255,152,0,0.35)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 20 }}>⚡</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>Driver dhundh rahe hain</Text>
            <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Fare badhao — driver jaldi milega</Text>
          </View>
          {/* Timer badge */}
          <View style={{
            backgroundColor: timeLeft <= 5 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)',
            borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
            borderWidth: 1.5, borderColor: timeLeft <= 5 ? C.red : C.yellow,
            minWidth: 52, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: timeLeft <= 5 ? C.red : C.yellow, fontVariant: ['tabular-nums'] }}>
              {timeLeft}s
            </Text>
          </View>
        </View>

        {/* Timer bar */}
        <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 14, overflow: 'hidden' }}>
          <Animated.View style={{ height: 4, width: timerPct, borderRadius: 2, backgroundColor: timerColor }} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SP.md, paddingTop: 16, paddingBottom: 32 }}
        bounces={false}
      >
        {/* ── Current fare row ── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: C.bgCard, borderRadius: R.md, padding: 14,
          borderWidth: 1.5, borderColor: C.glassBorder, marginBottom: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 22 }}>{rideIcon(rideType)}</Text>
            <View>
              <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Current fare
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: C.text }}>₹{baseFare}</Text>
            </View>
          </View>
          <Ionicons name="arrow-forward" size={20} color={C.textDim} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              New fare
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '900', color: selectedOpt?.color || C.yellow }}>
              ₹{baseFare + selected}
            </Text>
          </View>
        </View>

        {/* ── Route mini-card ── */}
        <View style={{
          backgroundColor: C.glass, borderRadius: R.sm, padding: 12,
          borderWidth: 1, borderColor: C.glassBorder, marginBottom: 18, gap: 6,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 12 }}>📍</Text>
            <Text style={{ fontSize: 11, color: C.textMuted, flex: 1 }} numberOfLines={1}>{pickup}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 12 }}>🎯</Text>
            <Text style={{ fontSize: 11, color: C.textDim, flex: 1 }} numberOfLines={1}>{drop}</Text>
          </View>
        </View>

        {/* ── Boost amount cards ── */}
        <Text style={{ fontSize: 12, fontWeight: '800', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>
          Boost amount select karein
        </Text>

        <Animated.View style={{ transform: [{ translateY: slideAnim }], gap: 10 }}>
          {opts.map(opt => {
            const isSelected = opt.amount === selected;
            const isRec = opt.amount === recommended;
            return (
              <TouchableOpacity
                key={opt.amount}
                activeOpacity={0.78}
                onPress={() => setSelected(opt.amount)}
                style={{
                  backgroundColor: isSelected ? opt.glass : C.bgCard,
                  borderRadius: R.md,
                  borderWidth: isSelected ? 2 : 1.5,
                  borderColor: isSelected ? opt.color : C.glassBorder,
                  padding: 14,
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                }}>
                {/* Radio indicator */}
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: 2, borderColor: isSelected ? opt.color : C.glassMid,
                  backgroundColor: isSelected ? opt.color : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSelected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                </View>

                {/* Fare info */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: isSelected ? opt.color : C.text }}>
                      {opt.label}
                    </Text>
                    {isRec && (
                      <View style={{ backgroundColor: opt.color + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: opt.color + '55' }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: opt.color, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                          ⭐ Suggested
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{opt.description}</Text>
                </View>

                {/* Right side: total + speed bars */}
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <SpeedBars count={opt.speedBars} color={opt.color} />
                  <Text style={{ fontSize: 12, color: C.textMuted, fontWeight: '700' }}>₹{baseFare + opt.amount}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* ── Info note ── */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, backgroundColor: C.glass, borderRadius: R.sm, padding: 12, borderWidth: 1, borderColor: C.glassBorder }}>
          <Ionicons name="information-circle-outline" size={16} color={C.textMuted} style={{ marginTop: 1 }} />
          <Text style={{ fontSize: 11, color: C.textMuted, flex: 1, lineHeight: 16 }}>
            Surge amount directly driver ko milta hai. Agar driver nahi mila toh paise wapas aa jayenge.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Bottom CTA — fixed ── */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: SP.md, paddingBottom: Platform.OS === 'android' ? 20 : 34,
        paddingTop: 14, backgroundColor: C.bgCard,
        borderTopWidth: 1.5, borderTopColor: C.glassBorder,
        gap: 10,
      }}>
        <TouchableOpacity
          activeOpacity={0.84}
          onPress={handleConfirm}
          disabled={surging}
          style={{
            backgroundColor: selectedOpt?.color || C.yellow,
            borderRadius: R.md, paddingVertical: 16,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 10,
            opacity: surging ? 0.6 : 1,
            elevation: 6, shadowColor: selectedOpt?.color, shadowOpacity: 0.45, shadowRadius: 12,
          }}>
          <Text style={{ fontSize: 17, fontWeight: '900', color: '#fff' }}>
            {surging ? 'Dhundh raha hai...' : `+₹${selected} boost karein — ₹${baseFare + selected} total`}
          </Text>
          {!surging && <Ionicons name="flash" size={18} color="#fff" />}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleCancel}
          style={{ alignItems: 'center', paddingVertical: 10 }}>
          <Text style={{ fontSize: 13, color: C.textMuted, fontWeight: '700' }}>
            Abhi nahi — matching screen par wapas jao
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
