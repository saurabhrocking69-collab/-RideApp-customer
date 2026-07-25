import { useEffect, useRef, useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, Linking,
  TextInput, Alert, Animated, Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Storage as AsyncStorage } from '../storage';
import { useApp } from '../context/AppContext';
import { DotBG, ScreenIn, FadeIn, Bouncy } from '../components/ui';
import { apiGet, apiPost } from '../../api';
import { s, C, T, R, SP, SHADOW } from '../styles';

const CONTACTS_CACHE_KEY = 'sppero_emergency_contacts';

type Contact = { id?: number; name: string; phone: string };

// ── Hold-to-SOS button: press 2 s → triggers ─────────────────────────────────
function HoldSOSButton({ onActivate }: { onActivate: () => void }) {
  const progress   = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(1)).current;
  const holdRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef    = useRef<Animated.CompositeAnimation | null>(null);
  const [holding, setHolding]   = useState(false);
  const [seconds, setSeconds]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startHold = () => {
    setHolding(true);
    setSeconds(0);
    Vibration.vibrate(80);
    timerRef.current = setInterval(() => setSeconds(p => p + 1), 1000);

    animRef.current = Animated.parallel([
      Animated.timing(progress, { toValue: 1, duration: 2000, useNativeDriver: false }),
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.94, duration: 200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration: 200, useNativeDriver: true }),
      ]),
    ]);
    animRef.current.start();

    holdRef.current = setTimeout(() => {
      Vibration.vibrate([0, 120, 100, 120]);
      onActivate();
    }, 2000);
  };

  const cancelHold = () => {
    setHolding(false);
    setSeconds(0);
    if (holdRef.current)  clearTimeout(holdRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    animRef.current?.stop();
    Animated.timing(progress, { toValue: 0, duration: 300, useNativeDriver: false }).start();
    Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const arcColor = progress.interpolate({ inputRange: [0, 1], outputRange: ['rgba(239,68,68,0.3)', C.red] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={startHold}
        onPressOut={cancelHold}
        style={{
          width: 138, height: 138, borderRadius: R.full,
          backgroundColor: holding ? 'rgba(239,68,68,0.16)' : C.redGlass,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 3, borderColor: holding ? C.red : C.redBorder,
          ...SHADOW.lg, shadowColor: C.red, shadowOpacity: 0.4,
        }}>
        <Animated.View style={{
          position: 'absolute', inset: 0, borderRadius: R.full,
          borderWidth: 4, borderColor: arcColor,
        }} />
        <Ionicons name="warning" size={40} color={C.red} />
        <Text style={{ color: C.red, fontWeight: '900', fontSize: 13, marginTop: 5 }}>
          {holding ? `${2 - seconds}s...` : 'Hold for SOS'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Emergency contact row ─────────────────────────────────────────────────────
function ContactRow({ contact, onDelete, onCall, onWhatsApp }: {
  contact: Contact; onDelete: () => void;
  onCall: () => void; onWhatsApp: () => void;
}) {
  return (
    <View style={{
      backgroundColor: C.bgCard, borderRadius: R.md, padding: SP.md,
      marginBottom: SP.sm, borderWidth: 1, borderColor: C.glassBorder,
      flexDirection: 'row', alignItems: 'center', gap: SP.sm,
      ...SHADOW.sm,
    }}>
      <View style={{
        width: 42, height: 42, borderRadius: R.full,
        backgroundColor: C.purpleGlass, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: C.purpleBorder,
      }}>
        <Ionicons name="person" size={18} color={C.purple} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...T.bodyBold, color: C.text }}>{contact.name}</Text>
        <Text style={{ ...T.caption, color: C.textMuted, marginTop: 1 }}>{contact.phone}</Text>
      </View>
      <TouchableOpacity onPress={onCall} style={{ padding: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="call" size={18} color={C.green} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onWhatsApp} style={{ padding: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} style={{ padding: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="trash-outline" size={18} color={C.red} />
      </TouchableOpacity>
    </View>
  );
}

export function SafetyScreen() {
  const { setScreen, setTab, triggerSOS, userCoords, phone } = useApp();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showAdd, setShowAdd]   = useState(false);
  const [newName, setNewName]   = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [sosTriggered, setSosTriggered] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  // Show whatever's cached locally instantly, then refresh from the backend —
  // contacts now live server-side so they survive a reinstall/new device,
  // the local cache is just for instant paint on this screen.
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(CONTACTS_CACHE_KEY);
      if (raw) { try { setContacts(JSON.parse(raw)); } catch {} }
      if (phone) {
        const d = await apiGet(`/api/emergency-contacts?phone=${phone}`);
        if (d?.contacts) {
          const list: Contact[] = d.contacts.map((c: any) => ({ id: c.id, name: c.name, phone: c.contact_phone }));
          setContacts(list);
          AsyncStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify(list)).catch(() => {});
        }
      }
    })();
  }, [phone]);

  const addContact = async () => {
    if (!newName.trim() || !newPhone.trim()) { Alert.alert('', 'Name and number are required'); return; }
    const cleaned = newPhone.replace(/\D/g, '');
    if (cleaned.length < 10) { Alert.alert('', 'Enter a valid mobile number'); return; }
    if (contacts.length >= 3) { Alert.alert('', 'Maximum 3 contacts allowed'); return; }
    setSavingContact(true);
    const d = await apiPost('/api/emergency-contacts/save', { phone, name: newName.trim(), contact_phone: cleaned });
    setSavingContact(false);
    if (d?._error || d?.error) { Alert.alert('Could not save', d.error || 'Please try again'); return; }
    const list = [...contacts, { id: d.contact?.id, name: newName.trim(), phone: cleaned }];
    setContacts(list);
    AsyncStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify(list)).catch(() => {});
    setNewName(''); setNewPhone(''); setShowAdd(false);
  };

  const deleteContact = async (i: number) => {
    const target = contacts[i];
    const list = contacts.filter((_, idx) => idx !== i);
    setContacts(list);
    AsyncStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify(list)).catch(() => {});
    if (target?.id) apiPost('/api/emergency-contacts/delete', { id: target.id }).catch(() => {});
  };

  const handleSOS = async () => {
    setSosTriggered(true);
    await triggerSOS();
    setTimeout(() => setSosTriggered(false), 5000);
  };

  const callContact = (c: Contact) => Linking.openURL(`tel:${c.phone}`);

  const whatsappContact = (c: Contact) => {
    const loc = userCoords ? `https://maps.google.com/?q=${userCoords.latitude},${userCoords.longitude}` : '';
    const msg = encodeURIComponent(`🆘 Emergency! I need help!\n📍 My location: ${loc}`);
    const number = c.phone.startsWith('91') ? c.phone : `91${c.phone}`;
    Linking.openURL(`https://wa.me/${number}?text=${msg}`);
  };

  const emergencyNumbers = [
    { label: 'Police',             icon: 'shield',       number: '100',  textColor: '#1565C0', bg: 'rgba(21,101,192,0.08)',  border: 'rgba(21,101,192,0.2)'  },
    { label: 'Ambulance',          icon: 'medical',       number: '108',  textColor: C.red,    bg: C.redGlass,               border: C.redBorder              },
    { label: 'Fire Brigade',       icon: 'flame',         number: '101',  textColor: '#E64A19', bg: 'rgba(230,74,25,0.08)',  border: 'rgba(230,74,25,0.22)'   },
    { label: 'Women Helpline',     icon: 'woman',         number: '1091', textColor: C.purple,  bg: C.purpleGlass,            border: C.purpleBorder           },
    { label: 'National Emergency', icon: 'call',          number: '112',  textColor: C.green,   bg: C.greenGlass,             border: C.greenBorder            },
  ];

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setScreen('home'); setTab('profile'); }} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topTitle}>🛡️ Safety Centre</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SP.md, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>

        {/* ── SOS Hero ── */}
        <FadeIn>
          <View style={{
            backgroundColor: sosTriggered ? 'rgba(239,68,68,0.18)' : C.redGlass,
            borderRadius: R.xl, padding: SP.lg, alignItems: 'center', marginBottom: SP.lg,
            borderWidth: 2, borderColor: sosTriggered ? C.red : C.redBorder,
            ...SHADOW.lg, shadowColor: C.red, shadowOpacity: 0.35,
          }}>
            <Text style={{ color: C.red, ...T.title, marginBottom: 4 }}>
              🆘 Emergency SOS
            </Text>
            <Text style={{ color: C.textMuted, ...T.caption, textAlign: 'center', marginBottom: SP.lg, textTransform: 'none', letterSpacing: 0 }}>
              {contacts.length > 0
                ? `${contacts.length} emergency contact${contacts.length > 1 ? 's' : ''} set — hold 2 seconds to activate`
                : 'Add emergency contacts below first'}
            </Text>
            <HoldSOSButton onActivate={handleSOS} />
            {sosTriggered && (
              <View style={{ marginTop: SP.md, backgroundColor: C.red, borderRadius: R.sm, paddingHorizontal: 20, paddingVertical: 10 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>🆘 Alert sent! Police: 100</Text>
              </View>
            )}
          </View>
        </FadeIn>

        {/* ── Emergency Contacts ── */}
        <FadeIn delay={80}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SP.sm }}>
            <Text style={{ ...T.label, color: C.textMuted }}>
              EMERGENCY CONTACTS ({contacts.length}/3)
            </Text>
            {contacts.length < 3 && (
              <Bouncy onPress={() => setShowAdd(p => !p)}>
                <View style={{
                  backgroundColor: C.pink, borderRadius: R.full, paddingHorizontal: 14, paddingVertical: 6,
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                }}>
                  <Ionicons name={showAdd ? 'close' : 'add'} size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{showAdd ? 'Cancel' : 'Add'}</Text>
                </View>
              </Bouncy>
            )}
          </View>

          {contacts.length === 0 && !showAdd && (
            <TouchableOpacity onPress={() => setShowAdd(true)} style={{
              backgroundColor: C.pinkGlass, borderRadius: R.md, padding: SP.lg,
              alignItems: 'center', marginBottom: SP.sm, borderWidth: 1.5,
              borderColor: C.pinkBorder, borderStyle: 'dashed',
            }}>
              <Ionicons name="person-add" size={28} color={C.pink} />
              <Text style={{ color: C.pink, fontWeight: '800', fontSize: 14, marginTop: 8 }}>Add Emergency Contact</Text>
              <Text style={{ color: C.textMuted, ...T.caption, marginTop: 4, textAlign: 'center', textTransform: 'none', letterSpacing: 0 }}>
                They'll receive a WhatsApp & your location when you trigger SOS
              </Text>
            </TouchableOpacity>
          )}

          {showAdd && (
            <View style={{
              backgroundColor: C.bgCard, borderRadius: R.md, padding: SP.md,
              marginBottom: SP.md, borderWidth: 1, borderColor: C.glassBorder,
              ...SHADOW.sm,
            }}>
              <Text style={{ ...T.bodyBold, color: C.text, marginBottom: SP.sm }}>➕ New Contact</Text>
              <TextInput
                value={newName} onChangeText={setNewName}
                placeholder="Name (e.g. Mom, Brother)" placeholderTextColor={C.textDim}
                style={{
                  backgroundColor: C.glassMid, borderRadius: R.sm, padding: 13,
                  fontSize: 14, color: C.text, marginBottom: SP.sm,
                  borderWidth: 1, borderColor: C.glassBorder,
                }} />
              <TextInput
                value={newPhone} onChangeText={setNewPhone}
                placeholder="Mobile number (10 digits)" placeholderTextColor={C.textDim}
                keyboardType="phone-pad" maxLength={13}
                style={{
                  backgroundColor: C.glassMid, borderRadius: R.sm, padding: 13,
                  fontSize: 14, color: C.text, marginBottom: SP.md,
                  borderWidth: 1, borderColor: C.glassBorder,
                }} />
              <Bouncy onPress={savingContact ? undefined : addContact}>
                <View style={{
                  backgroundColor: C.pink, borderRadius: R.sm, padding: 14,
                  alignItems: 'center', ...SHADOW.pink,
                  opacity: savingContact ? 0.7 : 1,
                }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>{savingContact ? 'Saving…' : 'Save Contact'}</Text>
                </View>
              </Bouncy>
            </View>
          )}

          {contacts.map((c, i) => (
            <ContactRow
              key={c.id ?? i} contact={c}
              onDelete={() => deleteContact(i)}
              onCall={() => callContact(c)}
              onWhatsApp={() => whatsappContact(c)}
            />
          ))}
        </FadeIn>

        {/* ── Emergency Numbers ── */}
        <FadeIn delay={160}>
          <Text style={{ ...T.label, color: C.textMuted, marginTop: SP.sm, marginBottom: SP.sm }}>
            HELPLINE NUMBERS
          </Text>
          {emergencyNumbers.map((item, i) => (
            <Bouncy key={i} onPress={() => Linking.openURL(`tel:${item.number}`)}>
              <View
                style={{
                  backgroundColor: item.bg, borderRadius: R.md, padding: SP.md, marginBottom: SP.sm,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  borderWidth: 1, borderColor: item.border,
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 38, height: 38, borderRadius: R.full,
                    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: item.border,
                  }}>
                    <Ionicons name={item.icon as any} size={18} color={item.textColor} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{item.label}</Text>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: item.textColor, marginTop: 2 }}>{item.number}</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: item.textColor, borderRadius: R.sm, paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>📞 Call</Text>
                </View>
              </View>
            </Bouncy>
          ))}
        </FadeIn>

        {/* ── Safety Tips ── */}
        <FadeIn delay={240}>
          <Text style={{ ...T.label, color: C.textMuted, marginTop: SP.sm, marginBottom: SP.sm }}>
            SAFETY TIPS
          </Text>
          <View style={{
            backgroundColor: C.bgCard, borderRadius: R.md, overflow: 'hidden',
            borderWidth: 1, borderColor: C.glassBorder, ...SHADOW.sm,
          }}>
            {[
              'Verify driver name and vehicle number before boarding',
              'Share your location with family — send Live Location on WhatsApp',
              'At night, prefer the back seat for added safety',
              'Do not pay before the trip is complete',
              'If anything feels wrong — hold SOS, alert fires in 2 seconds',
            ].map((tip, i, arr) => (
              <View key={i} style={{
                flexDirection: 'row', gap: 10, padding: 14,
                borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: C.glassBorder,
              }}>
                <Ionicons name="checkmark-circle" size={16} color={C.green} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 13, color: C.textMuted, lineHeight: 20 }}>{tip}</Text>
              </View>
            ))}
          </View>
        </FadeIn>
      </ScrollView>
    </ScreenIn>
  );
}
