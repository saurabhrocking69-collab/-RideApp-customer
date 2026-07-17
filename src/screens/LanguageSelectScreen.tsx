import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  ScrollView, StyleSheet, Platform, StatusBar, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Storage as AsyncStorage } from '../storage';
import { C, R, SP, SHADOW } from '../styles';
import type { Screen } from '../types';

const { width } = Dimensions.get('window');
const GAP  = SP.sm;   // 8  — gap between cards
const HPAD = SP.md;   // 16 — horizontal screen padding
const CARD_W = (width - HPAD * 2 - GAP) / 2;

type Lang = { code: string; flag: string; name: string; native: string };

const LANGS: Lang[] = [
  { code: 'en', flag: '🇬🇧', name: 'English',  native: 'English'   },
  { code: 'fr', flag: '🇫🇷', name: 'French',   native: 'Français'  },
  { code: 'es', flag: '🇪🇸', name: 'Spanish',  native: 'Español'   },
  { code: 'zh', flag: '🇨🇳', name: 'Mandarin', native: '普通话'     },
  { code: 'ne', flag: '🇳🇵', name: 'Nepali',   native: 'नेपाली'    },
  { code: 'hi', flag: '🇮🇳', name: 'Hindi',    native: 'हिंदी'     },
  { code: 'af', flag: '🌍',  name: 'African',  native: 'Kiswahili' },
];

const GRID_PAIRS: [Lang, Lang][] = [
  [LANGS[0], LANGS[1]],
  [LANGS[2], LANGS[3]],
  [LANGS[4], LANGS[5]],
];
const WIDE_LANG = LANGS[6];

export function LanguageSelectScreen() {
  const { setScreen } = useApp();
  const insets = useSafeAreaInsets();
  const [comingSoon, setComingSoon] = useState<Lang | null>(null);
  const [going, setGoing] = useState(false);

  const tapLang = (lang: Lang) => {
    if (lang.code !== 'en') setComingSoon(lang);
  };

  const proceed = async () => {
    if (going) return;
    setGoing(true);
    await AsyncStorage.setItem('userLanguage', 'en');
    const dest = (await AsyncStorage.getItem('_postLangDest')) ?? 'home';
    await AsyncStorage.removeItem('_postLangDest');
    setScreen(dest as Screen);
  };

  const topPad = insets.top || (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44);
  const botPad = Math.max(insets.bottom, SP.md);

  return (
    <View style={[s.root, { paddingTop: topPad }]}>

      {/* Decorative ambient blobs */}
      <View style={s.blobA} />
      <View style={s.blobB} />

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.globeRing}>
          <Text style={s.globeEmoji}>🌐</Text>
        </View>
        <Text style={s.brand}>SPPERO</Text>
        <Text style={s.headline}>Choose Your Language</Text>
        <Text style={s.sub}>Select how you'd like to ride with us</Text>
      </View>

      {/* ── Language Grid ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.grid}
        showsVerticalScrollIndicator={false}
      >
        {GRID_PAIRS.map(([a, b], i) => (
          <View key={i} style={s.row}>
            {([a, b] as Lang[]).map(lang => {
              const isEn = lang.code === 'en';
              return (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => tapLang(lang)}
                  style={[s.card, isEn ? s.cardEn : s.cardOther]}
                  activeOpacity={isEn ? 0.92 : 0.72}
                >
                  <Text style={s.cardFlag}>{lang.flag}</Text>
                  <Text style={[s.cardName, isEn && s.cardNameEn]}>{lang.name}</Text>
                  <Text style={s.cardNative}>{lang.native}</Text>

                  {isEn ? (
                    <View style={s.checkBadge}>
                      <Text style={s.checkTxt}>✓</Text>
                    </View>
                  ) : (
                    <View style={s.soonBadge}>
                      <Text style={s.soonTxt}>SOON</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* 7th language — wide centred card */}
        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => tapLang(WIDE_LANG)}
            style={[s.card, s.cardWide, s.cardOther]}
            activeOpacity={0.72}
          >
            <Text style={s.cardFlag}>{WIDE_LANG.flag}</Text>
            <View style={s.wideTextBlock}>
              <Text style={s.cardName}>{WIDE_LANG.name}</Text>
              <Text style={s.cardNative}>{WIDE_LANG.native}</Text>
            </View>
            <View style={s.soonTag}>
              <Text style={s.soonTxt}>SOON</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: SP.lg }} />
      </ScrollView>

      {/* ── Footer CTA ── */}
      <View style={[s.footer, { paddingBottom: botPad + SP.sm }]}>
        <TouchableOpacity
          style={[s.btn, going && { opacity: 0.65 }]}
          onPress={proceed}
          activeOpacity={0.85}
        >
          <Text style={s.btnTxt}>{going ? 'Loading…' : 'Continue with English  →'}</Text>
        </TouchableOpacity>
        <Text style={s.footNote}>More languages arriving soon  🌏</Text>
      </View>

      {/* ── Coming Soon Modal ── */}
      <Modal
        transparent
        visible={!!comingSoon}
        animationType="fade"
        onRequestClose={() => setComingSoon(null)}
      >
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => setComingSoon(null)}
        >
          {/* Inner touchable prevents tap-through to overlay dismiss */}
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={s.modal}>
              <Text style={s.mIcon}>🚧</Text>
              <Text style={s.mTitle}>Coming Soon!</Text>
              <Text style={s.mLang}>{comingSoon?.flag}  {comingSoon?.name}</Text>
              <Text style={s.mBody}>
                We're building {comingSoon?.name} support for Sppero.{'\n\n'}
                Please continue in English for now — we'll notify you when {comingSoon?.name} is ready!
              </Text>
              <TouchableOpacity
                style={s.mBtn}
                onPress={() => setComingSoon(null)}
                activeOpacity={0.85}
              >
                <Text style={s.mBtnTxt}>Got it, continue in English</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bgDark,   // #1A0D2E — deep dark plum
    overflow: 'hidden',
  },

  // ── Decorative blobs ───────────────────────────
  blobA: {
    position: 'absolute', top: -90, right: -90,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(255,45,120,0.07)',
  },
  blobB: {
    position: 'absolute', bottom: 120, left: -110,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(124,58,237,0.08)',
  },

  // ── Header ─────────────────────────────────────
  header: {
    alignItems: 'center',
    paddingHorizontal: HPAD,
    paddingBottom: SP.lg,
  },
  globeRing: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SP.sm,
  },
  globeEmoji: { fontSize: 38 },
  brand: {
    color: C.pink,
    fontSize: 11, fontWeight: '900', letterSpacing: 5,
    marginBottom: SP.xs,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 24, fontWeight: '800', letterSpacing: -0.4,
    textAlign: 'center',
  },
  sub: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 13, marginTop: 6,
    textAlign: 'center', lineHeight: 20,
  },

  // ── Grid ───────────────────────────────────────
  grid: {
    paddingHorizontal: HPAD,
    gap: GAP,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },

  // ── Cards ──────────────────────────────────────
  card: {
    width: CARD_W,
    borderRadius: R.md,
    padding: SP.md,
    alignItems: 'center',
    position: 'relative',
    gap: 4,
  },
  cardEn: {
    backgroundColor: 'rgba(255,45,120,0.15)',
    borderWidth: 1.5,
    borderColor: C.pink,
    ...SHADOW.pink,
  },
  cardOther: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    opacity: 0.8,
  },
  // African wide card overrides
  cardWide: {
    width: CARD_W * 2 + GAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
  },

  // Card content
  cardFlag:   { fontSize: 34 },
  cardName:   { color: 'rgba(255,255,255,0.68)', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  cardNameEn: { color: '#FFFFFF' },
  cardNative: { color: 'rgba(255,255,255,0.30)', fontSize: 11, textAlign: 'center' },
  wideTextBlock: { flex: 1 },

  // Badges
  checkBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.pink,
    alignItems: 'center', justifyContent: 'center',
  },
  checkTxt: { color: '#fff', fontSize: 12, fontWeight: '900' },
  soonBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: R.xs, paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  // Inline version for the wide card (not absolute)
  soonTag: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: R.xs, paddingHorizontal: 6, paddingVertical: 3,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  soonTxt: { color: 'rgba(255,255,255,0.38)', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },

  // ── Footer ─────────────────────────────────────
  footer: {
    paddingHorizontal: HPAD,
    paddingTop: SP.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  btn: {
    backgroundColor: C.pink,
    borderRadius: R.md,
    paddingVertical: 17,
    alignItems: 'center',
    ...SHADOW.pink,
  },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  footNote: {
    color: 'rgba(255,255,255,0.26)',
    fontSize: 11, textAlign: 'center', marginTop: SP.sm,
  },

  // ── Modal ──────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SP.lg,
  },
  modal: {
    backgroundColor: C.bgCard,
    borderRadius: R.xl,
    padding: SP.xl,
    alignItems: 'center',
    width: '100%',
    ...SHADOW.lg,
  },
  mIcon:  { fontSize: 52 },
  mTitle: { color: C.text, fontSize: 22, fontWeight: '800', marginTop: SP.md },
  mLang:  { fontSize: 18, color: C.textMuted, fontWeight: '600', marginTop: 6 },
  mBody:  { color: C.textMuted, fontSize: 14, textAlign: 'center', marginTop: SP.sm, lineHeight: 22 },
  mBtn: {
    backgroundColor: C.pink,
    borderRadius: R.md,
    paddingVertical: 14,
    paddingHorizontal: SP.xl,
    marginTop: SP.lg,
    width: '100%',
    alignItems: 'center',
    ...SHADOW.pink,
  },
  mBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
