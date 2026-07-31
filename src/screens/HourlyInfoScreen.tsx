import { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop, G, Ellipse, Line } from 'react-native-svg';
import { useApp } from '../context/AppContext';
import { Bouncy, ScreenIn, FadeIn, SlideUp } from '../components/ui';
import { s, C } from '../styles';
// MMKV-backed wrapper — NOT @react-native-async-storage/async-storage. Two
// different stores; mixing them makes a "seen once" flag never read back.
import { Storage } from '../storage';

export const HOURLY_INFO_SEEN_KEY = 'hourlyIntroSeen';

// ── ONE looping value drives every bit of motion on this screen ─────────────
// The parcel guide originally ran five concurrent infinite loops and the page
// became unscrollable on mid-range Android — native-driven loops compete with
// the scroll gesture on the UI thread. So: a single 0→1 loop, interpolated
// into each animated property. Entrance animations (FadeIn/SlideUp) are
// one-shot and don't count against this.
function useMasterLoop(durationMs = 6000) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: durationMs, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [v, durationMs]);
  return v;
}

// ── Hero: a clock whose hand actually sweeps, with the car waiting below ────
function HourlyHeroArt() {
  const t = useMasterLoop(6000);

  // Same driver, three different readings of it.
  const sweep = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const bob   = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -7, 0] });

  return (
    <View style={{ height: 222, alignItems: 'center', justifyContent: 'center' }}>
      {/* soft aura */}
      <View pointerEvents="none" style={{ position: 'absolute', width: 178, height: 178, borderRadius: 89, backgroundColor: 'rgba(124,58,237,0.22)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', width: 132, height: 132, borderRadius: 66, backgroundColor: 'rgba(255,255,255,0.07)' }} />

      {/* clock face */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={150} height={150} viewBox="0 0 150 150">
          <Defs>
            <LinearGradient id="dial" x1="0" y1="0" x2="0.6" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="1" stopColor="#E7E3F5" />
            </LinearGradient>
            <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#A78BFA" />
              <Stop offset="1" stopColor="#6D28D9" />
            </LinearGradient>
          </Defs>
          <Circle cx="75" cy="75" r="62" fill="url(#ring)" />
          <Circle cx="75" cy="75" r="53" fill="url(#dial)" />
          {/* hour ticks */}
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            const r1 = i % 3 === 0 ? 40 : 45;
            return (
              <Line
                key={i}
                x1={75 + Math.sin(a) * r1} y1={75 - Math.cos(a) * r1}
                x2={75 + Math.sin(a) * 49} y2={75 - Math.cos(a) * 49}
                stroke={i % 3 === 0 ? '#4C1D95' : '#B9AEE0'}
                strokeWidth={i % 3 === 0 ? 3.4 : 1.8}
                strokeLinecap="round"
              />
            );
          })}
          {/* hour hand — parked at 2 o'clock */}
          <Line x1="75" y1="75" x2="97" y2="56" stroke="#4C1D95" strokeWidth="5.2" strokeLinecap="round" />
        </Svg>

        {/* minute hand — the only genuinely moving part, on the shared loop */}
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', width: 150, height: 150, transform: [{ rotate: sweep }] }}>
          <Svg width={150} height={150} viewBox="0 0 150 150">
            <Line x1="75" y1="75" x2="75" y2="30" stroke={C.pink} strokeWidth="3.4" strokeLinecap="round" />
            <Circle cx="75" cy="75" r="6" fill={C.pink} />
            <Circle cx="75" cy="75" r="2.4" fill="#fff" />
          </Svg>
        </Animated.View>
      </View>

      {/* the car, waiting — gently bobbing on the same loop */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: 6, transform: [{ translateY: bob }] }}>
        <Svg width={126} height={54} viewBox="0 0 126 54">
          <Defs>
            <LinearGradient id="body" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FF7FA8" />
              <Stop offset="1" stopColor="#FF2D78" />
            </LinearGradient>
          </Defs>
          <Ellipse cx="63" cy="47" rx="46" ry="6" fill="#1A0D2E" opacity="0.22" />
          <Path d="M18 38 q2 -13 10 -14 l10 -9 q4 -3 9 -3 h20 q6 0 10 4 l9 8 q10 2 12 14 q1 5 -5 5 H23 q-6 0 -5 -5 Z" fill="url(#body)" />
          <Path d="M44 15 h17 q4 0 6 3 l6 6 H40 Z" fill="#FFE0EC" opacity="0.92" />
          <Circle cx="38" cy="42" r="7.5" fill="#241238" /><Circle cx="38" cy="42" r="3.2" fill="#B9AEE0" />
          <Circle cx="88" cy="42" r="7.5" fill="#241238" /><Circle cx="88" cy="42" r="3.2" fill="#B9AEE0" />
        </Svg>
      </Animated.View>

      {/* static trust chips — pointerEvents off so a drag never gets swallowed */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 4, top: 30 }}>
        <Chip icon="hourglass-outline" label="Driver waits" tint={C.purple} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', right: 2, top: 54 }}>
        <Chip icon="lock-closed" label="Time locked" tint={C.green} />
      </View>
    </View>
  );
}

function Chip({ icon, label, tint }: { icon: any; label: string; tint: string }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
      borderWidth: 1, borderColor: C.glassBorder,
      shadowColor: C.plum, shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
    }}>
      <Ionicons name={icon} size={12} color={tint} />
      <Text style={{ fontSize: 11, fontWeight: '800', color: C.text }}>{label}</Text>
    </View>
  );
}

// ── The headline guarantee: a padlock wrapped around a clock ────────────────
function TimeLockArt() {
  return (
    <View pointerEvents="none" style={{ width: 94, height: 94, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 86, height: 86, borderRadius: 43, backgroundColor: C.green, opacity: 0.13 }} />
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Defs>
          <LinearGradient id="lockG" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#10B981" />
            <Stop offset="1" stopColor="#047857" />
          </LinearGradient>
        </Defs>
        {/* shackle */}
        <Path d="M20 27 v-7 a12 12 0 0 1 24 0 v7" fill="none" stroke="url(#lockG)" strokeWidth="6" strokeLinecap="round" />
        {/* body */}
        <Rect x="13" y="27" width="38" height="30" rx="8" fill="url(#lockG)" />
        {/* tiny clock on the lock face */}
        <Circle cx="32" cy="42" r="10" fill="#fff" opacity="0.95" />
        <Line x1="32" y1="42" x2="32" y2="36.5" stroke="#047857" strokeWidth="2.4" strokeLinecap="round" />
        <Line x1="32" y1="42" x2="36" y2="44" stroke="#047857" strokeWidth="2.4" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

// ── Packages, drawn as a ladder of increasing blocks ────────────────────────
function PackageLadderArt() {
  const bars = [
    { h: 26, label: '2h', c: '#C4B5FD' },
    { h: 38, label: '4h', c: '#A78BFA' },
    { h: 50, label: '6h', c: '#8B5CF6' },
    { h: 62, label: '8h', c: '#7C3AED' },
    { h: 76, label: 'Days', c: '#5B21B6' },
  ];
  return (
    <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, height: 96, marginBottom: 4 }}>
      {bars.map((b, i) => (
        <View key={i} style={{ alignItems: 'center' }}>
          <View style={{
            width: 40, height: b.h, borderRadius: 11, backgroundColor: b.c,
            shadowColor: C.purple, shadowOpacity: 0.28, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 3,
          }} />
          <Text style={{ fontSize: 11, fontWeight: '900', color: C.textMuted, marginTop: 6 }}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Early end = both sides agree. Two rings meeting on a tick. ──────────────
function MutualAgreeArt() {
  return (
    <View pointerEvents="none" style={{ alignItems: 'center', marginBottom: 4 }}>
      <Svg width={168} height={72} viewBox="0 0 168 72">
        <Defs>
          <LinearGradient id="youG" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FBBF24" /><Stop offset="1" stopColor="#F59E0B" />
          </LinearGradient>
          <LinearGradient id="drvG" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#A78BFA" /><Stop offset="1" stopColor="#7C3AED" />
          </LinearGradient>
        </Defs>
        <Circle cx="58" cy="36" r="27" fill="url(#youG)" opacity="0.9" />
        <Circle cx="110" cy="36" r="27" fill="url(#drvG)" opacity="0.9" />
        {/* overlap tick */}
        <Circle cx="84" cy="36" r="17" fill="#fff" />
        <Path d="M76 36 l6 6 l11 -12" stroke={C.green} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <G>
          <Path d="M50 30 a6 6 0 1 1 0.01 0" fill="#fff" opacity="0.85" />
          <Path d="M42 47 q8 -9 16 0" fill="#fff" opacity="0.85" />
        </G>
        <G>
          <Path d="M118 30 a6 6 0 1 1 0.01 0" fill="#fff" opacity="0.85" />
          <Path d="M110 47 q8 -9 16 0" fill="#fff" opacity="0.85" />
        </G>
      </Svg>
      <View style={{ flexDirection: 'row', gap: 46, marginTop: -4 }}>
        <Text style={{ fontSize: 11, fontWeight: '900', color: C.yellow }}>You</Text>
        <Text style={{ fontSize: 11, fontWeight: '900', color: C.purple }}>Driver</Text>
      </View>
    </View>
  );
}

function GuideBody({ onCta, ctaLabel }: { onCta: () => void; ctaLabel: string }) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 128 }}
        showsVerticalScrollIndicator
        overScrollMode="always"
        alwaysBounceVertical
      >
        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <View style={{
          backgroundColor: C.plum, paddingTop: 4, paddingBottom: 26,
          borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden',
        }}>
          <View pointerEvents="none" style={{ position: 'absolute', top: -80, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(124,58,237,0.26)' }} />
          <View pointerEvents="none" style={{ position: 'absolute', bottom: -70, left: -50, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,45,120,0.16)' }} />

          <HourlyHeroArt />

          <FadeIn delay={120} style={{ paddingHorizontal: 22, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 25, fontWeight: '900', textAlign: 'center', lineHeight: 31 }}>
              Keep a driver{'\n'}for as long as you need
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.80)', fontSize: 13.5, textAlign: 'center', marginTop: 9, lineHeight: 20 }}>
              Shopping, a wedding, site visits, a whole day of errands — one
              Buddy stays with you and waits at every stop. No re-booking, no
              haggling at each halt.
            </Text>
          </FadeIn>

          <FadeIn delay={260} style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16, paddingHorizontal: 16 }}>
            {[['🚗', 'Same driver'], ['⏸️', 'Waiting is free'], ['📅', 'Up to 3 days']].map(([e, t], i) => (
              <View key={i} style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
                paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20,
              }}>
                <Text style={{ fontSize: 12 }}>{e}</Text>
                <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '800' }}>{t}</Text>
              </View>
            ))}
          </FadeIn>
        </View>

        {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 26 }}>
          <SectionLabel kicker="STEP BY STEP" title="How it works" />
          {([
            ['📦', 'Pick a package', 'Same day — 2, 4, 6 or 8 hours. Or go multi-day, 1 to 3 days.', C.purple],
            ['📍', 'Set your pickup', 'Drop is optional. The Buddy stays with you, so there is nowhere fixed to be.', C.pink],
            ['💳', 'Pay upfront — safely', 'Held by Sppero, not handed over. The driver is not paid yet.', C.green],
            ['🔑', 'Share the OTP', 'Your Buddy arrives, you share a 4-digit code, and the timer starts.', C.yellow],
            ['🛍️', 'Go do your thing', 'Stop wherever, for as long as you like. Waiting time is already yours.', C.purple],
            ['✅', 'Time ends, done', 'The driver closes the trip and the payment settles automatically.', C.green],
          ] as const).map(([icon, title, desc, tint], i, arr) => (
            <SlideUp key={i} delay={70 + i * 80}>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ width: 44, alignItems: 'center' }}>
                  <View style={{
                    width: 38, height: 38, borderRadius: 13, backgroundColor: '#fff',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5, borderColor: tint + '55',
                    shadowColor: tint, shadowOpacity: 0.22, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 3,
                  }}>
                    <Text style={{ fontSize: 17 }}>{icon}</Text>
                  </View>
                  {i < arr.length - 1 && (
                    <View style={{ width: 2.5, flex: 1, minHeight: 24, backgroundColor: C.glassHigh, borderRadius: 2, marginVertical: 3 }} />
                  )}
                </View>
                <View style={{ flex: 1, paddingBottom: 14, paddingTop: 3 }}>
                  <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{title}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12.5, marginTop: 3, lineHeight: 18 }}>{desc}</Text>
                </View>
              </View>
            </SlideUp>
          ))}
        </View>

        {/* ── THE GUARANTEE ──────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <SlideUp delay={100}>
            <View style={{
              backgroundColor: '#fff', borderRadius: 22, padding: 18,
              borderWidth: 1.5, borderColor: C.greenBorder,
              flexDirection: 'row', alignItems: 'center', gap: 14,
              shadowColor: C.green, shadowOpacity: 0.13, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4,
            }}>
              <TimeLockArt />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 }}>YOUR TIME IS LOCKED</Text>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginTop: 4 }}>The driver can't cut it short</Text>
                <Text style={{ color: C.textMuted, fontSize: 12.5, marginTop: 5, lineHeight: 18 }}>
                  Your Buddy cannot end the booking before your hours are up —
                  the app won't let them. And your money is held by Sppero until
                  the trip actually finishes.
                </Text>
              </View>
            </View>
          </SlideUp>
        </View>

        {/* ── PACKAGES ───────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginTop: 26 }}>
          <SectionLabel kicker="CHOOSE YOUR LENGTH" title="Packages" />
          <SlideUp delay={80}>
            <View style={{
              backgroundColor: '#fff', borderRadius: 20, padding: 16,
              borderWidth: 1, borderColor: C.glassBorder,
              shadowColor: C.plum, shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
            }}>
              <PackageLadderArt />
              <Text style={{ color: C.textMuted, fontSize: 12.5, lineHeight: 19, textAlign: 'center' }}>
                Every package includes a set number of kilometres. Go past it and
                the extra distance is charged per km — tracked live, never a
                surprise at the end.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <MiniFact icon="calendar-outline" text="Same day or 1–3 days" />
                <MiniFact icon="pricetag-outline" text="Full price shown before you pay" />
              </View>
            </View>
          </SlideUp>
        </View>

        {/* ── EARLY END ──────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginTop: 26 }}>
          <SectionLabel kicker="FINISHED EARLY?" title="Ending before time" />
          <SlideUp delay={80}>
            <View style={{
              backgroundColor: C.yellowGlass, borderRadius: 20, padding: 16,
              borderWidth: 1.5, borderColor: C.yellowBorder,
            }}>
              <MutualAgreeArt />
              <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', textAlign: 'center', marginBottom: 10 }}>
                Only when you BOTH agree
              </Text>
              {([
                ['Either side can ask', 'You or your Buddy sends an early-end request.'],
                ['The other must accept', 'Nothing happens until they do — a driver can never just close it.'],
                ['You pay for time used', 'The unused portion comes back to your wallet.'],
                ['Fair-use limit', 'After two rejected requests there is a short cooldown. Support can step in.'],
              ] as const).map(([t, d], i, arr) => (
                <View key={i} style={{
                  flexDirection: 'row', gap: 9, paddingVertical: 8,
                  borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderColor: C.yellowBorder,
                }}>
                  <Ionicons name="checkmark-circle" size={15} color={C.yellow} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800' }}>{t}</Text>
                    <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>{d}</Text>
                  </View>
                </View>
              ))}
            </View>
          </SlideUp>
        </View>

        {/* ── EXTEND ─────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginTop: 26 }}>
          <SectionLabel kicker="RUNNING LATE?" title="Need more time" />
          {([
            ['add-circle-outline', 'Add 1, 2 or 3 hours', 'Ask for an extension right from the live trip screen.', C.purple],
            ['person-outline', 'Your Buddy accepts', 'If they can stay on, the hours are added instantly.', C.pink],
            ['wallet-outline', 'Paid from your wallet', 'The extra amount is held straight away, same as the original booking.', C.green],
            ['lock-closed-outline', 'Same protection', 'Extended time is locked too — and you can still end early by agreement.', C.yellow],
          ] as const).map(([icon, title, desc, tint], i) => (
            <SlideUp key={i} delay={60 + i * 70}>
              <View style={{
                flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16,
                padding: 14, marginBottom: 9, borderWidth: 1, borderColor: C.glassBorder,
              }}>
                <View style={{
                  width: 34, height: 34, borderRadius: 11, backgroundColor: tint + '14',
                  alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tint + '30',
                }}>
                  <Ionicons name={icon} size={17} color={tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>{title}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12.5, marginTop: 3, lineHeight: 18 }}>{desc}</Text>
                </View>
              </View>
            </SlideUp>
          ))}
        </View>

        {/* ── RULES ──────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <SectionLabel kicker="THE RULES" title="Good to know" />
          {([
            ['play-circle-outline', 'The clock starts at the OTP', 'Not when you book — when your Buddy actually reaches you and you share the code.', C.purple],
            ['repeat-outline', 'Round trip is a toggle', 'Turn it on if you need bringing back to where you started, and set how long you will be.', C.pink],
            ['speedometer-outline', 'Extra kilometres are charged', 'Only if you go beyond what the package includes. The driver app tracks it live.', C.yellow],
            ['close-circle-outline', 'Cancelling', 'Free before a Buddy accepts. Once accepted, the booking cannot be cancelled.', C.textMuted],
          ] as const).map(([icon, title, desc, tint], i) => (
            <SlideUp key={i} delay={60 + i * 70}>
              <View style={{
                flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16,
                padding: 14, marginBottom: 9, borderWidth: 1, borderColor: C.glassBorder,
              }}>
                <View style={{
                  width: 34, height: 34, borderRadius: 11, backgroundColor: tint + '14',
                  alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tint + '30',
                }}>
                  <Ionicons name={icon} size={17} color={tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800' }}>{title}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12.5, marginTop: 3, lineHeight: 18 }}>{desc}</Text>
                </View>
              </View>
            </SlideUp>
          ))}
        </View>

        {/* ── TIPS ───────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <FadeIn delay={140}>
            <View style={{ backgroundColor: C.greenGlass, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.greenBorder }}>
              <Text style={{ color: C.green, fontSize: 13.5, fontWeight: '900', marginBottom: 10 }}>💡 Worth knowing</Text>
              {[
                'A lot of stops planned? Multi-day works out cheaper per day.',
                'Keep your wallet topped up and booking is instant.',
                'Early start tomorrow? Book tonight and sleep easy.',
                'Message your Buddy to pin down the exact pickup spot.',
                'Only share the OTP once you are actually ready to leave.',
              ].map((tip, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 7 }}>
                  <Text style={{ color: C.green, fontSize: 14, fontWeight: '900' }}>•</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12.5, flex: 1, lineHeight: 18 }}>{tip}</Text>
                </View>
              ))}
            </View>
          </FadeIn>
        </View>

        {/* ── CLOSING ────────────────────────────────────────────────────── */}
        <FadeIn delay={180}>
          <View style={{ alignItems: 'center', paddingHorizontal: 30, marginTop: 22 }}>
            <Text style={{ fontSize: 26 }}>⏱️🚗</Text>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', marginTop: 8, textAlign: 'center' }}>
              One Buddy. Your whole day.
            </Text>
            <Text style={{ color: C.textMuted, fontSize: 12.5, marginTop: 5, textAlign: 'center', lineHeight: 18 }}>
              No re-booking between stops, no explaining your plan twice.
            </Text>
          </View>
        </FadeIn>
      </ScrollView>

      {/* ── STICKY CTA ──────────────────────────────────────────────────── */}
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: 22,
        backgroundColor: 'rgba(255,255,255,0.97)',
        borderTopWidth: 1, borderColor: C.glassBorder,
      }}>
        <Bouncy onPress={onCta}>
          <View style={{
            backgroundColor: C.purple, borderRadius: 17, paddingVertical: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
            shadowColor: C.purple, shadowOpacity: 0.42, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 8,
          }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>{ctaLabel}</Text>
            <Ionicons name="arrow-forward" size={19} color="#fff" />
          </View>
        </Bouncy>
        <Text style={{ color: C.textDim, fontSize: 11.5, textAlign: 'center', marginTop: 9 }}>
          Full price shown before you pay · Money held until the trip ends
        </Text>
      </View>
    </View>
  );
}

export function HourlyInfoScreen() {
  const { setScreen } = useApp();
  return (
    <ScreenIn style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topTitle}>⏱️ Book by Hour</Text>
        <View style={{ width: 36 }} />
      </View>
      <GuideBody
        ctaLabel="Book by the Hour"
        onCta={() => {
          // Marked before navigating rather than awaited — a failed write only
          // costs one extra look at the guide, and booking shouldn't wait on it.
          Storage.setItem(HOURLY_INFO_SEEN_KEY, '1').catch(() => {});
          setScreen('hourly');
        }}
      />
    </ScreenIn>
  );
}

function SectionLabel({ kicker, title }: { kicker: string; title: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: C.purple, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1 }}>{kicker}</Text>
      <Text style={{ color: C.text, fontSize: 19, fontWeight: '900', marginTop: 3 }}>{title}</Text>
    </View>
  );
}

function MiniFact({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={{
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.glassMid, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7,
    }}>
      <Ionicons name={icon} size={12} color={C.textMuted} />
      <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '600', flex: 1 }} numberOfLines={2}>{text}</Text>
    </View>
  );
}
