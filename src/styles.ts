import { Platform, StatusBar, StyleSheet } from 'react-native';

// ═══════════════════════════════════════════════════════════════════════════════
// SPPERO DESIGN SYSTEM — Phase 01
// Single source of truth for all visual decisions.
// Import { C, T, SP, R, SHADOW, s } from '../styles'
// ═══════════════════════════════════════════════════════════════════════════════

// ── Color Tokens ──────────────────────────────────────────────────────────────
export const C = {
  // Brand
  pink:    '#FF2D78',   // Sppero primary — energetic, Indian
  plum:    '#2E1461',   // Premium depth — headers, hero sections, driver card BGs
  saffron: '#FF7A00',   // Indian warmth — buddy, special moments, commission
  green:   '#059669',   // Rupee green — success, money, completed
  red:     '#EF4444',
  purple:  '#7C3AED',

  // Backgrounds — lavender-tinted (premium, not generic white)
  bg:      '#F5F2FF',   // App base — very subtle lavender
  bgCard:  '#FFFFFF',   // Card surfaces — pure white pops on F5F2FF
  bgDeep:  '#EAE5FF',   // Hero sections, tinted areas
  bgPlum:  '#F0EBF8',   // Plum-tinted surface for premium cards
  bgDark:  '#1A0D2E',   // Deep plum — bill modal, dark overlays

  // Glass tokens — light-mode cards with subtle depth
  glass:       '#FFFFFF',
  glassMid:    '#F3F0FE',
  glassHigh:   '#E8E3FC',
  glassBorder: '#E2DCFF',
  glassB2:     '#D4CCFA',

  // Tinted fills — alpha layers on white cards
  pinkGlass:    'rgba(255,45,120,0.07)',
  pinkBorder:   'rgba(255,45,120,0.22)',
  yellowGlass:  'rgba(245,158,11,0.08)',
  yellowBorder: 'rgba(245,158,11,0.28)',
  greenGlass:   'rgba(5,150,105,0.08)',
  greenBorder:  'rgba(5,150,105,0.25)',
  redGlass:     'rgba(239,68,68,0.07)',
  redBorder:    'rgba(239,68,68,0.25)',
  purpleGlass:  'rgba(124,58,237,0.07)',
  purpleBorder: 'rgba(124,58,237,0.25)',
  plumGlass:    'rgba(46,20,97,0.06)',
  plumBorder:   'rgba(46,20,97,0.15)',
  saffGlass:    'rgba(255,122,0,0.07)',
  saffBorder:   'rgba(255,122,0,0.22)',

  // Text — purple-shifted neutrals (not generic slate)
  text:      '#1A0D2E',   // Near-black with plum warmth
  textMuted: '#6B6B8D',   // Mid-muted — purple-shifted
  textDim:   '#9B94B8',   // Dim — softer purple

  // Legacy alias so old code still compiles
  yellow: '#F59E0B',
};

// ── Typography Scale ──────────────────────────────────────────────────────────
// Use by spreading: <Text style={[T.display, { color: C.plum }]}>
export const T = {
  display:  { fontSize: 42, fontWeight: '900' as const, letterSpacing: -1.5, lineHeight: 48 },
  headline: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5, lineHeight: 32 },
  title:    { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 24 },
  body:     { fontSize: 14, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold: { fontSize: 14, fontWeight: '700' as const, lineHeight: 22 },
  caption:  { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.3, lineHeight: 16 },
  label:    { fontSize: 10, fontWeight: '800' as const, letterSpacing: 1.5, lineHeight: 14 },
  fare:     { fontSize: 32, fontWeight: '900' as const, letterSpacing: -1.0, lineHeight: 38 },
};

// ── Spacing (8-point grid) ────────────────────────────────────────────────────
export const SP = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

// ── Border Radius ─────────────────────────────────────────────────────────────
export const R = {
  xs:   8,    // tags, chips, badges
  sm:   14,   // inputs, small cards
  md:   20,   // standard cards, buttons
  lg:   28,   // large cards, bottom sheets
  xl:   36,   // hero cards, profile
  full: 100,  // pills, toggles, avatars
};

// ── Shadow System (3 levels + brand-tinted) ───────────────────────────────────
// Using plum as base shadow color — more sophisticated than pure black
export const SHADOW = {
  // Subtle lift — recent items, menu rows
  sm: {
    elevation: 3,
    shadowColor: C.plum,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  // Standard card — most cards
  md: {
    elevation: 6,
    shadowColor: C.plum,
    shadowOpacity: 0.10,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  // Heavy lift — modals, bottom sheets
  lg: {
    elevation: 14,
    shadowColor: C.plum,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  // Pink CTA shadow — primary buttons, wallet card
  pink: {
    elevation: 8,
    shadowColor: C.pink,
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  // Plum hero shadow — for plum-background sections
  plum: {
    elevation: 12,
    shadowColor: C.plum,
    shadowOpacity: 0.30,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
  },
};

// ── StyleSheet ────────────────────────────────────────────────────────────────
export const s = StyleSheet.create({

  // ── Screen ────────────────────────────────────────────────────────────────
  screen: { flex: 1, backgroundColor: C.bg },

  // ── Top bar ───────────────────────────────────────────────────────────────
  topBar: {
    backgroundColor: C.plum,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 54,
    paddingBottom: SP.md,
    paddingHorizontal: SP.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...SHADOW.plum,
  },
  topTitle: { color: '#fff', fontSize: 17, fontWeight: '900', flex: 1, textAlign: 'center', letterSpacing: 0.2 },
  greeting: { color: C.text, fontSize: 15, fontWeight: '700' },
  subTxt:   { color: C.textMuted, fontSize: 11, marginTop: 2 },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    margin: SP.sm + SP.xs,
    backgroundColor: C.bgCard,
    borderRadius: R.lg,
    padding: SP.md + SP.xs,
    borderWidth: 1,
    borderColor: C.glassBorder,
    ...SHADOW.md,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: C.bgCard,
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: SP.md + SP.xs,
    borderBottomWidth: 1,
    borderBottomColor: C.glassBorder,
  },
  heroTitle: { ...T.headline, color: C.text, marginTop: SP.sm },
  heroSub:   { ...T.caption,  color: C.textMuted, marginTop: 5, textAlign: 'center' },

  // ── Input ─────────────────────────────────────────────────────────────────
  input: {
    borderWidth: 1.5,
    borderColor: C.glassBorder,
    borderRadius: R.sm,
    padding: SP.sm + SP.xs,
    fontSize: 14,
    backgroundColor: C.bgCard,
    marginBottom: 10,
    color: C.text,
  },
  label: { fontSize: 13, fontWeight: '600', color: C.textMuted, marginBottom: 6 },
  flag: {
    fontSize: 13,
    padding: 12,
    backgroundColor: C.glassMid,
    borderRadius: R.xs,
    borderWidth: 1.5,
    borderColor: C.glassBorder,
    marginRight: 8,
    color: C.text,
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  btn: {
    backgroundColor: C.pink,
    borderRadius: R.md,
    padding: 17,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
    ...SHADOW.pink,
  },
  btnTxt:   { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  err:      { textAlign: 'center', color: C.red, fontWeight: '700', marginBottom: 8 },
  back:     { textAlign: 'center', color: C.purple, marginTop: 14, fontSize: 13, fontWeight: '600' },
  applyBtn: {
    padding: 12,
    borderWidth: 1.5,
    borderColor: C.pink,
    borderRadius: R.xs + 2,
    justifyContent: 'center',
    marginLeft: 8,
    backgroundColor: C.pinkGlass,
  },

  // ── Layout ────────────────────────────────────────────────────────────────
  row:         { flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 36, alignItems: 'flex-start' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassBorder, alignSelf: 'center', marginBottom: 12 },
  navFloat:    { position: 'absolute', bottom: 0, left: 0, right: 0 },

  // ── Avatar ────────────────────────────────────────────────────────────────
  avatar:    { width: 40, height: 40, borderRadius: R.full, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: '800', fontSize: 17 },

  // ── Search ────────────────────────────────────────────────────────────────
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderRadius: R.md,
    padding: SP.md,
    marginBottom: SP.sm + SP.xs,
    borderWidth: 1.5,
    borderColor: C.glassBorder,
    ...SHADOW.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderRadius: R.sm,
    paddingHorizontal: SP.sm + SP.xs,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  searchIcon: { fontSize: 18, marginRight: 10 },
  searchPh:   { color: C.textMuted, fontSize: 14, flex: 1 },
  mapFit:     { height: 260, width: '100%', backgroundColor: '#E0EEFF' },

  // ── Quick actions ─────────────────────────────────────────────────────────
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: SP.sm + SP.xs },
  quickBtn: {
    flex: 1,
    backgroundColor: C.bgCard,
    borderRadius: R.md,
    padding: SP.sm + SP.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.glassBorder,
    ...SHADOW.sm,
  },
  quickIcon: { fontSize: 22 },
  quickLbl:  { fontSize: 10, color: C.textMuted, marginTop: 5, fontWeight: '600' },

  // ── Section title ─────────────────────────────────────────────────────────
  secTitle: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 10, marginTop: 4 },

  // ── History ───────────────────────────────────────────────────────────────
  histCard: {
    backgroundColor: C.bgCard,
    borderRadius: R.md,
    padding: SP.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.glassBorder,
    ...SHADOW.sm,
  },
  histIcon: {
    width: 40,
    height: 40,
    borderRadius: R.full,
    backgroundColor: C.pinkGlass,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: C.pinkBorder,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderRadius: R.sm,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.glassBorder,
    ...SHADOW.sm,
  },
  recentRoute: { fontSize: 13, fontWeight: '700', color: C.text },
  recentDate:  { fontSize: 11, color: C.textMuted, marginTop: 2 },
  recentFare:  { fontSize: 14, fontWeight: '800', color: C.yellow },

  // ── Profile ───────────────────────────────────────────────────────────────
  profileHero: {
    backgroundColor: C.bgCard,
    borderRadius: R.xl,
    padding: SP.lg,
    alignItems: 'center',
    marginBottom: SP.sm + SP.xs,
    borderWidth: 1,
    borderColor: C.glassBorder,
    ...SHADOW.md,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: R.full,
    backgroundColor: C.pink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 3,
    borderColor: 'rgba(255,45,120,0.3)',
    ...SHADOW.pink,
  },
  profileName:  { ...T.headline, color: C.text },
  profilePhone: { ...T.caption,  color: C.textMuted, marginTop: 3 },
  badge: {
    backgroundColor: C.yellowGlass,
    borderRadius: R.xs,
    paddingVertical: 5,
    paddingHorizontal: SP.sm + SP.xs,
    marginTop: SP.sm,
    borderWidth: 1,
    borderColor: C.yellowBorder,
  },

  // ── Promo ─────────────────────────────────────────────────────────────────
  promoBanner: {
    backgroundColor: C.pinkGlass,
    borderRadius: R.md,
    padding: SP.sm + SP.xs,
    marginBottom: SP.sm + SP.xs,
    borderWidth: 1,
    borderColor: C.pinkBorder,
    ...SHADOW.sm,
  },
  promoTxt: { color: C.text, fontSize: 13, textAlign: 'center', fontWeight: '600' },

  // ── Bottom nav ────────────────────────────────────────────────────────────
  nav: {
    flexDirection: 'row',
    paddingBottom: Platform.OS === 'android' ? 44 : 16,
    paddingTop: 10,
    ...SHADOW.lg,
  },
  navItem:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIcon:   { fontSize: 22, color: C.textDim },
  navLbl:    { fontSize: 10, color: C.textDim, marginTop: 3, letterSpacing: 0.3 },
  navActive: { color: C.pink, fontWeight: '800' },

  // ── Wallet ────────────────────────────────────────────────────────────────
  walletCard: {
    backgroundColor: C.pink,
    borderRadius: R.lg,
    padding: SP.md + SP.xs,
    marginBottom: 12,
    ...SHADOW.pink,
  },

  // ── Menu ──────────────────────────────────────────────────────────────────
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderRadius: R.md,
    padding: SP.sm + SP.xs,
    marginBottom: SP.sm,
    borderWidth: 1,
    borderColor: C.glassBorder,
    ...SHADOW.sm,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: R.xs + 2,
    backgroundColor: C.pinkGlass,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: C.pinkBorder,
  },
  logoutBtn: {
    borderWidth: 1.5,
    borderColor: C.red,
    borderRadius: R.sm,
    padding: SP.sm + SP.xs,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: SP.lg,
    backgroundColor: C.redGlass,
  },

  // ── Suggestions ───────────────────────────────────────────────────────────
  suggBox: {
    backgroundColor: C.bgCard,
    borderRadius: R.sm,
    marginTop: 4,
    borderWidth: 1,
    borderColor: C.glassBorder,
    zIndex: 99,
    ...SHADOW.lg,
  },
  suggItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.glassBorder,
  },

  // ── Driver card ───────────────────────────────────────────────────────────
  driverCard: {
    backgroundColor: C.bgCard,
    borderRadius: R.md,
    padding: SP.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.glassBorder,
    ...SHADOW.sm,
  },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: R.full,
    backgroundColor: C.glassMid,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: C.pink,
  },
  driverName: { fontSize: 15, fontWeight: '800', color: C.text },

  // ── OTP card ──────────────────────────────────────────────────────────────
  otpCard: {
    backgroundColor: C.bgCard,
    borderRadius: R.md,
    padding: SP.md + SP.xs,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: C.pinkBorder,
    ...SHADOW.md,
  },

  // ── Fare / info ───────────────────────────────────────────────────────────
  fareCard: {
    backgroundColor: C.bgCard,
    borderRadius: R.md,
    padding: SP.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.glassBorder,
    ...SHADOW.sm,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: C.bgCard,
    borderRadius: R.md,
    padding: SP.sm + SP.xs,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.glassBorder,
    ...SHADOW.sm,
  },
  actionBtn: { alignItems: 'center', padding: 4, flex: 1 },

  // ── Chat ──────────────────────────────────────────────────────────────────
  chatBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: C.pink,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chatAlert: {
    backgroundColor: C.pinkGlass,
    borderRadius: R.xs,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.pinkBorder,
  },
  infoBox: {
    backgroundColor: C.greenGlass,
    borderRadius: R.xs,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.greenBorder,
  },
  chatBubble: { maxWidth: '75%', borderRadius: R.md, padding: 12, marginBottom: 8 },
  chatMine:   { backgroundColor: C.pink, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  chatTheirs: {
    backgroundColor: C.glassMid,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingBottom: 28,
    backgroundColor: C.bgCard,
    borderTopWidth: 1,
    borderTopColor: C.glassBorder,
  },
  chatInput: {
    flex: 1,
    backgroundColor: C.glassMid,
    borderRadius: R.full,
    paddingHorizontal: SP.md,
    paddingVertical: 10,
    fontSize: 14,
    marginRight: SP.sm,
    color: C.text,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  chatSend: {
    width: 44,
    height: 44,
    borderRadius: R.full,
    backgroundColor: C.pink,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.pink,
  },

  // ── Payment ───────────────────────────────────────────────────────────────
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: R.md,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: C.glassBorder,
    backgroundColor: C.bgCard,
    ...SHADOW.sm,
  },
  scratchCard: { borderRadius: R.lg, padding: SP.lg, alignItems: 'center', marginBottom: 4, elevation: 6 },
  tipBtn: {
    flex: 1,
    padding: 10,
    borderRadius: R.xs,
    borderWidth: 1.5,
    borderColor: C.glassBorder,
    alignItems: 'center',
    backgroundColor: C.bgCard,
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statBox: {
    flex: 1,
    backgroundColor: C.bgCard,
    borderRadius: R.md,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.glassBorder,
    ...SHADOW.sm,
  },
  statNum: { fontSize: 24, fontWeight: '800', color: C.yellow },
  statLbl: { fontSize: 11, color: C.textMuted, marginTop: 4 },
});
