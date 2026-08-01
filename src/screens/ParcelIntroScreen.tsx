import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop, Ellipse } from 'react-native-svg';
import { useApp } from '../context/AppContext';
import { Bouncy, ScreenIn, FadeIn, SlideUp } from '../components/ui';
import { s, C } from '../styles';
// MMKV-backed wrapper — NOT @react-native-async-storage/async-storage. They are
// separate stores, so writing the "seen" flag with one and reading it with the
// other would make this guide reappear on every single tap.
import { Storage } from '../storage';

// Marker for "this customer has already seen the parcel walkthrough". Read by
// HomeScreen so the guide auto-opens once and then gets out of the way — a
// repeat sender tapping Parcel goes straight to booking, and can re-open this
// any time from the ℹ️ in the parcel header (same pattern as Book-by-Hour).
export const PARCEL_INTRO_SEEN_KEY = 'parcelIntroSeen';

// ── Hero illustration — a parcel riding through the city ────────────────────
function ParcelHeroArt() {
  // No infinite animation here at all any more. It started as five concurrent
  // native loops, was cut to one, and the page STILL would not scroll — so the
  // last one goes too rather than leave a variable in play while the page is
  // unreadable. Entrance animations (FadeIn/SlideUp) are one-shot and stay.
  return (
    <View style={{ height: 210, alignItems: 'center', justifyContent: 'center' }}>
      {/* Static halo — was a 9s infinite rotation; it reads the same at rest. */}
      <View style={{ position: 'absolute' }}>
        <Svg width={220} height={220} viewBox="0 0 220 220">
          <Defs>
            <LinearGradient id="halo" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={C.pink} stopOpacity="0.20" />
              <Stop offset="1" stopColor={C.purple} stopOpacity="0.04" />
            </LinearGradient>
          </Defs>
          <Circle cx="110" cy="110" r="92" fill="none" stroke="url(#halo)" strokeWidth="16" strokeDasharray="34 22" strokeLinecap="round" />
        </Svg>
      </View>

      {/* the parcel itself */}
      <View>
        <Svg width={168} height={168} viewBox="0 0 168 168">
          <Defs>
            <LinearGradient id="boxFace" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#F6C177" />
              <Stop offset="1" stopColor="#D89B4E" />
            </LinearGradient>
            <LinearGradient id="ribbon" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={C.pink} />
              <Stop offset="1" stopColor="#FF6FA0" />
            </LinearGradient>
          </Defs>

          {/* soft ground shadow */}
          <Ellipse cx="84" cy="146" rx="44" ry="8" fill={C.plum} opacity="0.10" />

          {/* box body */}
          <Rect x="30" y="58" width="108" height="76" rx="8" fill="url(#boxFace)" />
          {/* lid */}
          <Rect x="24" y="44" width="120" height="24" rx="7" fill="#FFD9A0" />
          {/* ribbon vertical + knot */}
          <Rect x="76" y="44" width="16" height="90" fill="url(#ribbon)" opacity="0.95" />
          <Circle cx="84" cy="50" r="9" fill="url(#ribbon)" />
          <Circle cx="84" cy="50" r="3.4" fill="#fff" opacity="0.85" />
          {/* tape seam */}
          <Path d="M30 96 H138" stroke="#B9823B" strokeWidth="1.4" opacity="0.5" />
        </Svg>
      </View>

      {/* Trust chips — static. pointerEvents="none" so a drag that starts on
          one is never swallowed here and always reaches the ScrollView. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 8, top: 34 }}>
        <Chip icon="lock-closed" label="Escrow" tint={C.green} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', right: 6, top: 62 }}>
        <Chip icon="keypad" label="2 OTPs" tint={C.purple} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', right: 22, bottom: 20 }}>
        <Chip icon="navigate" label="Live track" tint={C.pink} />
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
      shadowColor: C.plum, shadowOpacity: 0.13, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
    }}>
      <Ionicons name={icon} size={12} color={tint} />
      <Text style={{ fontSize: 11, fontWeight: '800', color: C.text }}>{label}</Text>
    </View>
  );
}

// ── The escrow explainer — the single strongest reason to trust this ────────
function EscrowArt() {
  // Static halo. This was a second infinite loop that kept animating even when
  // the card was nowhere near the viewport — see the note in ParcelHeroArt.
  return (
    <View pointerEvents="none" style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 84, height: 84, borderRadius: 42, backgroundColor: C.green, opacity: 0.14 }} />
      <Svg width={62} height={62} viewBox="0 0 62 62">
        <Defs>
          <LinearGradient id="shield" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#10B981" />
            <Stop offset="1" stopColor="#047857" />
          </LinearGradient>
        </Defs>
        <Path d="M31 5 L54 14 V31 C54 44 43 54 31 58 C19 54 8 44 8 31 V14 Z" fill="url(#shield)" />
        <Path d="M21 31 l7 7 l14 -15" stroke="#fff" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </View>
  );
}

// The guide content, shared by the full-screen first-run version and the
// modal the ℹ️ opens from inside the booking screen. It exists in both shapes
// deliberately: ParcelScreen keeps pickup/drop/size in local state, so routing
// away to a separate screen would unmount it and throw away whatever the
// sender had already typed. The modal floats above it instead.
function GuideBody({ onCta, ctaLabel }: { onCta: () => void; ctaLabel: string }) {
  // Structure copied EXACTLY from SafetyScreen, which is long, shipped and
  // scrolls correctly: ScreenIn > topBar > a single ScrollView with flex:1 and
  // nothing else in the column.
  //
  // The previous version added two things on top of that pattern — an extra
  // flex:1 View around the ScrollView, and a sticky CTA absolutely pinned to
  // the bottom — and the page would not scroll. The CTA now simply lives at
  // the end of the content. A button you have to reach is a fair trade for a
  // page you can actually read.
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator
      overScrollMode="always"
    >

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <View style={{
          backgroundColor: C.plum, paddingTop: 6, paddingBottom: 26,
          borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden',
        }}>
          {/* decorative arcs */}
          <View style={{ position: 'absolute', top: -70, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,45,120,0.18)' }} />
          <View style={{ position: 'absolute', bottom: -60, left: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(124,58,237,0.20)' }} />

          <ParcelHeroArt />

          <FadeIn delay={120} style={{ paddingHorizontal: 22, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 25, fontWeight: '900', textAlign: 'center', lineHeight: 31 }}>
              Send anything{'\n'}across the city
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.80)', fontSize: 13.5, textAlign: 'center', marginTop: 9, lineHeight: 20 }}>
              Documents, keys, tiffin, gifts — picked up from your door and
              handed to the person you choose. Usually within the hour.
            </Text>
          </FadeIn>

          <FadeIn delay={260} style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16, paddingHorizontal: 16 }}>
            {[['⚡', 'Quick pickup'], ['🔒', 'Money held safe'], ['📍', 'Live tracking']].map(([e, t], i) => (
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

          <View style={{ marginTop: 4 }}>
            {([
              ['📝', 'Tell us what & where', 'Pickup, drop, package size, and the receiver\'s name + phone.', C.pink],
              ['💳', 'Pay upfront — safely', 'Wallet or UPI/card. We hold it; the driver is not paid yet.', C.green],
              ['🔑', 'Give the pickup OTP', 'Your Buddy arrives and you share a 4-digit code to hand it over.', C.purple],
              ['📍', 'Watch it move', 'Live location the whole way, plus your Buddy\'s number to call.', C.yellow],
              ['✅', 'Receiver\'s OTP unlocks it', 'Only after that code is entered is the driver paid. No code, no handover.', C.green],
            ] as const).map(([icon, title, desc, tint], i, arr) => (
              <SlideUp key={i} delay={80 + i * 90}>
                <View style={{ flexDirection: 'row' }}>
                  {/* rail */}
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
                      <View style={{ width: 2.5, flex: 1, minHeight: 26, backgroundColor: C.glassHigh, borderRadius: 2, marginVertical: 3 }} />
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
        </View>

        {/* ── ESCROW / TRUST ─────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <SlideUp delay={120}>
            <View style={{
              backgroundColor: '#fff', borderRadius: 22, padding: 18,
              borderWidth: 1.5, borderColor: C.greenBorder,
              flexDirection: 'row', alignItems: 'center', gap: 14,
              shadowColor: C.green, shadowOpacity: 0.13, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4,
            }}>
              <EscrowArt />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 }}>YOUR MONEY IS PROTECTED</Text>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '900', marginTop: 4 }}>Driver is paid only after delivery</Text>
                <Text style={{ color: C.textMuted, fontSize: 12.5, marginTop: 5, lineHeight: 18 }}>
                  What you pay is held by Sppero — not handed to the driver at pickup.
                  It is released the moment the receiver's OTP is confirmed.
                </Text>
              </View>
            </View>
          </SlideUp>
        </View>

        {/* ── SIZES & PRICING ────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginTop: 26 }}>
          <SectionLabel kicker="PICK A SIZE" title="What can you send?" />

          {([
            ['👜', 'Small', 'Fits in a bag · up to 2 kg', 'Bike & Green Bike', 'Lightest & quickest', C.pink],
            ['📦', 'Medium', 'A box · up to 10 kg', 'Auto, E-Rickshaw, E-Auto or Car', 'Needs a proper boot', C.purple],
            ['🗄️', 'Large', "Won't fit on a bike · up to 25 kg", 'Car only', 'Bulky or heavy items', C.yellow],
          ] as const).map(([icon, name, limit, vehicles, note, tint], i) => (
            <SlideUp key={i} delay={90 + i * 100}>
              <View style={{
                backgroundColor: '#fff', borderRadius: 18, padding: 15, marginBottom: 10,
                borderWidth: 1.5, borderColor: tint + '33',
                shadowColor: C.plum, shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{
                    width: 46, height: 46, borderRadius: 15, backgroundColor: tint + '14',
                    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tint + '33',
                  }}>
                    <Text style={{ fontSize: 22 }}>{icon}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '900' }}>{name}</Text>
                    <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{limit}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', marginTop: 11, gap: 8 }}>
                  <MiniFact icon="car-outline" text={vehicles} />
                  <MiniFact icon="information-circle-outline" text={note} />
                </View>
              </View>
            </SlideUp>
          ))}

          <FadeIn delay={340}>
            <View style={{
              backgroundColor: C.glassMid, borderRadius: 16, padding: 15,
              borderWidth: 1, borderColor: C.glassBorder,
            }}>
              <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '900', marginBottom: 10 }}>💰 What it costs</Text>
              {([
                ['Distance decides it', 'Your fare depends on how far the parcel travels and which vehicle can carry it.'],
                ['Bigger sizes cost a little more', 'Medium and Large add a small handling amount for the extra space and weight.'],
                ['You see the total first', 'The exact fare is shown on the booking screen before you pay. Nothing is added afterwards.'],
              ] as const).map(([t, d], i, arr) => (
                <View key={i} style={{
                  flexDirection: 'row', gap: 9, paddingVertical: 8,
                  borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderColor: C.glassBorder,
                }}>
                  <Ionicons name="checkmark-circle" size={15} color={C.green} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '800' }}>{t}</Text>
                    <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>{d}</Text>
                  </View>
                </View>
              ))}
            </View>
          </FadeIn>
        </View>

        {/* ── RULES / GOOD TO KNOW ───────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, marginTop: 26 }}>
          <SectionLabel kicker="THE RULES" title="Good to know" />
          {([
            ['person-outline', "Receiver's name & number are required", "We can't deliver without a way to reach them — it's how the OTP gets to the right person.", C.purple],
            ['swap-horizontal-outline', 'If the receiver refuses or is unreachable', 'Your Buddy tells you straight away and you choose: try again, or have it brought back (a return trip is chargeable). Answer quickly — your Buddy is holding your parcel and waiting on you.', C.yellow],
            ['time-outline', "If you don't reply for a few hours", 'The trip closes so your Buddy can work again — but your parcel is not lost. They keep it safe and we send you their number so you can arrange collection.', C.purple],
            ['cube-outline', 'Pick the honest size', 'The size decides which vehicle comes. A box booked as Small may not fit on the bike that arrives.', C.pink],
            ['shield-checkmark-outline', 'Pack it properly', 'Seal it well and cushion anything fragile. Sppero moves your parcel — it does not package it for you.', C.green],
          ] as const).map(([icon, title, desc, tint], i) => (
            <SlideUp key={i} delay={70 + i * 80}>
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

        {/* ── CLOSING LINE ───────────────────────────────────────────────── */}
        <FadeIn delay={200}>
          <View style={{ alignItems: 'center', paddingHorizontal: 30, marginTop: 20 }}>
            <Text style={{ fontSize: 26 }}>🛵💨</Text>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', marginTop: 8, textAlign: 'center' }}>
              Your Buddy is already nearby
            </Text>
            <Text style={{ color: C.textMuted, fontSize: 12.5, marginTop: 5, textAlign: 'center', lineHeight: 18 }}>
              Same riders you trust for your daily trips — now carrying your parcels.
            </Text>
          </View>
        </FadeIn>
      {/* ── CTA — inline, at the end of the content ──────────────────────── */}
      <View style={{ paddingHorizontal: 16, marginTop: 26 }}>
        <Bouncy onPress={onCta}>
          <View style={{
            backgroundColor: C.pink, borderRadius: 17, paddingVertical: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
            shadowColor: C.pink, shadowOpacity: 0.42, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 8,
          }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>{ctaLabel}</Text>
            <Ionicons name="arrow-forward" size={19} color="#fff" />
          </View>
        </Bouncy>
        <Text style={{ color: C.textDim, fontSize: 11.5, textAlign: 'center', marginTop: 9 }}>
          See the exact price before you pay · No hidden charges
        </Text>
      </View>
    </ScrollView>
  );
}

// First-run version — a real screen, shown once before a sender's first parcel.
export function ParcelIntroScreen() {
  const { setScreen } = useApp();
  return (
    <ScreenIn style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topTitle}>📦 Sppero Parcel</Text>
        <View style={{ width: 36 }} />
      </View>
      <GuideBody
        ctaLabel="Send a Package"
        onCta={() => {
          // Mark seen before navigating rather than awaiting it — the booking
          // screen shouldn't wait on a write, and a failed write only costs
          // the sender one extra look at the guide.
          Storage.setItem(PARCEL_INTRO_SEEN_KEY, '1').catch(() => {});
          setScreen('parcel');
        }}
      />
    </ScreenIn>
  );
}

// Re-open version — floats over the booking screen so nothing typed is lost.
export function ParcelGuideModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={[s.screen, { flex: 1 }]}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={onClose} style={s.backBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.topTitle}>📦 Sppero Parcel</Text>
          <View style={{ width: 36 }} />
        </View>
        <GuideBody ctaLabel="Got it" onCta={onClose} />
      </View>
    </Modal>
  );
}

function SectionLabel({ kicker, title }: { kicker: string; title: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: C.pink, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1 }}>{kicker}</Text>
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
