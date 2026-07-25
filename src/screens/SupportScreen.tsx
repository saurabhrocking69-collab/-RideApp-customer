import { useState } from 'react';
import { LayoutAnimation, Platform, ScrollView, UIManager, View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DotBG, ScreenIn, FadeIn, Bouncy } from '../components/ui';
import { s, C, T, R, SP, SHADOW } from '../styles';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function SupportScreen() {
  const { setScreen, setTab } = useApp();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // TODO: swap in the real support number/WhatsApp/email before launch —
  // these are still placeholder values.
  const supportOptions = [
    { icon: 'ticket',           label: 'Raise a Ticket', sub: 'Report an issue formally', color: C.pink,   bg: C.pinkGlass,               border: C.pinkBorder,               action: () => setScreen('ticket-new') },
    { icon: 'list',             label: 'My Tickets',     sub: 'Track existing issues',    color: '#3B82F6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)',    action: () => setScreen('tickets') },
    { icon: 'logo-whatsapp',    label: 'WhatsApp',       sub: 'Fastest response',         color: '#25D366', bg: 'rgba(37,211,102,0.12)',  border: 'rgba(37,211,102,0.35)',    action: () => Linking.openURL('https://wa.me/919999999999?text=Hi%20Sppero%20Support') },
    { icon: 'call',             label: 'Helpline Call',  sub: '24/7 available',           color: C.purple,  bg: C.glassMid,                border: C.glassBorder,              action: () => Linking.openURL('tel:9999999999') },
    { icon: 'mail',             label: 'Email Support',  sub: 'Response in 24 hrs',        color: C.pink,   bg: C.pinkGlass,               border: C.pinkBorder,               action: () => Linking.openURL('mailto:support@sppero.com') },
  ];

  const faqs = [
    ['How do I cancel a ride?', 'On the matching screen, press the "Cancel" button. Cancellation is free within 60 seconds.'],
    ['How do I pay?', 'Cash, Wallet, or UPI — settle with the driver at the end of the trip.'],
    ['No driver found?', 'After 90 seconds, the "Surge" option appears — increase the fare to attract more drivers.'],
    ['How do I recharge my wallet?', 'Profile → Wallet → tap the "+₹100/200/500" buttons.'],
    ['How do I delete my account?', 'Email support@sppero.com — it will be deleted within 7 days.'],
  ];

  const toggleFaq = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenFaq(p => (p === i ? null : i));
  };

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }} style={{ padding: 4 }}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>📞 Support</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SP.md, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        <FadeIn>
          <View style={{
            backgroundColor: C.bgCard, borderRadius: R.xl, padding: SP.lg, marginBottom: SP.md,
            alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.md,
          }}>
            <View style={{
              width: 60, height: 60, borderRadius: R.full, backgroundColor: C.pinkGlass,
              alignItems: 'center', justifyContent: 'center', marginBottom: SP.sm,
              borderWidth: 1.5, borderColor: C.pinkBorder,
            }}>
              <Ionicons name="headset" size={28} color={C.pink} />
            </View>
            <Text style={{ color: C.text, ...T.title }}>Sppero Support</Text>
            <Text style={{ color: C.textMuted, ...T.caption, marginTop: 4, textAlign: 'center', textTransform: 'none', letterSpacing: 0 }}>
              Contact us for 24/7 help
            </Text>
          </View>
        </FadeIn>

        <FadeIn delay={60}>
          {supportOptions.map((item, i) => (
            <Bouncy key={i} onPress={item.action}>
              <View style={{
                backgroundColor: item.bg, borderRadius: R.md, padding: SP.md, marginBottom: SP.sm,
                flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: item.border,
              }}>
                <View style={{
                  width: 48, height: 48, borderRadius: R.full, backgroundColor: `${item.color}1F`,
                  alignItems: 'center', justifyContent: 'center', marginRight: SP.md,
                  borderWidth: 1, borderColor: item.border,
                }}>
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...T.bodyBold, color: C.text }}>{item.label}</Text>
                  <Text style={{ ...T.caption, color: C.textMuted, marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textDim} />
              </View>
            </Bouncy>
          ))}
        </FadeIn>

        <FadeIn delay={120}>
          <Text style={{ ...T.label, color: C.textMuted, marginTop: SP.sm, marginBottom: SP.sm }}>
            FREQUENTLY ASKED QUESTIONS
          </Text>
          <View style={{
            backgroundColor: C.bgCard, borderRadius: R.md, overflow: 'hidden',
            borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.sm,
          }}>
            {faqs.map(([q, a], i) => {
              const open = openFaq === i;
              return (
                <View key={i} style={{ borderBottomWidth: i < faqs.length - 1 ? 1 : 0, borderBottomColor: C.glassBorder }}>
                  <TouchableOpacity
                    onPress={() => toggleFaq(i)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SP.md, gap: SP.sm }}
                  >
                    <Text style={{ flex: 1, ...T.bodyBold, fontSize: 13, color: C.text }}>{q}</Text>
                    <Ionicons name={open ? 'remove-circle' : 'add-circle'} size={20} color={open ? C.pink : C.textDim} />
                  </TouchableOpacity>
                  {open && (
                    <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 18, paddingHorizontal: SP.md, paddingBottom: SP.md }}>
                      {a}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </FadeIn>
      </ScrollView>
    </ScreenIn>
  );
}
