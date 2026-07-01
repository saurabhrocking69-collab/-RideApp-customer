import { useEffect, useRef, useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, Linking,
  TextInput, Alert, Animated, Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Storage as AsyncStorage } from '../storage';
import { useApp } from '../context/AppContext';
import { DotBG, ScreenIn } from '../components/ui';
import { s, C } from '../styles';

const CONTACTS_KEY = 'sppero_emergency_contacts';

type Contact = { name: string; phone: string };

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

  const arcColor = progress.interpolate({ inputRange: [0, 1], outputRange: ['rgba(239,68,68,0.3)', '#EF4444'] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={startHold}
        onPressOut={cancelHold}
        style={{
          width: 130, height: 130, borderRadius: 65,
          backgroundColor: holding ? 'rgba(239,68,68,0.15)' : C.redGlass,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 3, borderColor: holding ? C.red : C.redBorder,
          elevation: 10, shadowColor: C.red, shadowOpacity: 0.45, shadowRadius: 16,
        }}>
        <Animated.View style={{
          position: 'absolute', inset: 0, borderRadius: 65,
          borderWidth: 4, borderColor: arcColor,
        }} />
        <Ionicons name="warning" size={38} color={C.red} />
        <Text style={{ color: C.red, fontWeight: '900', fontSize: 13, marginTop: 4 }}>
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
      backgroundColor: C.glass, borderRadius: 16, padding: 14,
      marginBottom: 10, borderWidth: 1, borderColor: C.glassBorder,
      flexDirection: 'row', alignItems: 'center', gap: 10,
      elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
    }}>
      <View style={{
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: C.purpleGlass, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: C.purpleBorder,
      }}>
        <Text style={{ fontSize: 18 }}>👤</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>{contact.name}</Text>
        <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{contact.phone}</Text>
      </View>
      <TouchableOpacity onPress={onCall} style={{ padding: 8 }}>
        <Ionicons name="call" size={18} color={C.green} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onWhatsApp} style={{ padding: 8 }}>
        <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} style={{ padding: 8 }}>
        <Ionicons name="trash-outline" size={18} color={C.red} />
      </TouchableOpacity>
    </View>
  );
}

export function SafetyScreen() {
  const { setScreen, setTab, triggerSOS, userCoords } = useApp();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showAdd, setShowAdd]   = useState(false);
  const [newName, setNewName]   = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [sosTriggered, setSosTriggered] = useState(false);

  useEffect(() => { loadContacts(); }, []);

  const loadContacts = async () => {
    const raw = await AsyncStorage.getItem(CONTACTS_KEY);
    if (raw) setContacts(JSON.parse(raw));
  };

  const saveContacts = async (list: Contact[]) => {
    setContacts(list);
    await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
  };

  const addContact = async () => {
    if (!newName.trim() || !newPhone.trim()) { Alert.alert('', 'Naam aur number dono chahiye'); return; }
    const cleaned = newPhone.replace(/\D/g, '');
    if (cleaned.length < 10) { Alert.alert('', 'Valid mobile number daalo'); return; }
    if (contacts.length >= 3) { Alert.alert('', 'Maximum 3 contacts add ho sakte hain'); return; }
    const list = [...contacts, { name: newName.trim(), phone: cleaned }];
    await saveContacts(list);
    setNewName(''); setNewPhone(''); setShowAdd(false);
  };

  const deleteContact = async (i: number) => {
    const list = contacts.filter((_, idx) => idx !== i);
    await saveContacts(list);
  };

  const handleSOS = async () => {
    setSosTriggered(true);
    await triggerSOS();
    setTimeout(() => setSosTriggered(false), 5000);
  };

  const callContact = (c: Contact) => Linking.openURL(`tel:${c.phone}`);

  const whatsappContact = (c: Contact) => {
    const loc = userCoords ? `https://maps.google.com/?q=${userCoords.latitude},${userCoords.longitude}` : '';
    const msg = encodeURIComponent(`🆘 Emergency! Mujhe madad chahiye.\n📍 Meri location: ${loc}`);
    const number = c.phone.startsWith('91') ? c.phone : `91${c.phone}`;
    Linking.openURL(`https://wa.me/${number}?text=${msg}`);
  };

  const emergencyNumbers = [
    { label: '🚓 Police',             number: '100',  textColor: '#1565C0', bg: 'rgba(21,101,192,0.08)',  border: 'rgba(21,101,192,0.2)'  },
    { label: '🚑 Ambulance',          number: '108',  textColor: C.red,    bg: C.redGlass,               border: C.redBorder              },
    { label: '🚒 Fire Brigade',       number: '101',  textColor: '#E64A19', bg: 'rgba(230,74,25,0.08)',  border: 'rgba(230,74,25,0.22)'   },
    { label: '👩 Women Helpline',     number: '1091', textColor: C.purple,  bg: C.purpleGlass,            border: C.purpleBorder           },
    { label: '📞 National Emergency', number: '112',  textColor: C.green,   bg: C.greenGlass,             border: C.greenBorder            },
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>

        {/* ── SOS Hero ── */}
        <View style={{
          backgroundColor: sosTriggered ? 'rgba(239,68,68,0.18)' : C.redGlass,
          borderRadius: 28, padding: 24, alignItems: 'center', marginBottom: 20,
          elevation: 8, borderWidth: 2,
          borderColor: sosTriggered ? C.red : C.redBorder,
          shadowColor: C.red, shadowOpacity: 0.35, shadowRadius: 16,
        }}>
          <Text style={{ color: C.red, fontSize: 20, fontWeight: '900', marginBottom: 4 }}>
            🆘 Emergency SOS
          </Text>
          <Text style={{ color: C.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 22 }}>
            {contacts.length > 0
              ? `${contacts.length} emergency contact${contacts.length > 1 ? 's' : ''} set — hold 2 seconds to activate`
              : 'Neeche emergency contacts add karo pehle'}
          </Text>
          <HoldSOSButton onActivate={handleSOS} />
          {sosTriggered && (
            <View style={{ marginTop: 16, backgroundColor: C.red, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>🆘 Alert bheja! Police: 100</Text>
            </View>
          )}
        </View>

        {/* ── Emergency Contacts ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, letterSpacing: 1 }}>
            EMERGENCY CONTACTS ({contacts.length}/3)
          </Text>
          {contacts.length < 3 && (
            <TouchableOpacity onPress={() => setShowAdd(p => !p)} style={{
              backgroundColor: C.pink, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}>
              <Ionicons name={showAdd ? 'close' : 'add'} size={14} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{showAdd ? 'Cancel' : 'Add'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {contacts.length === 0 && !showAdd && (
          <TouchableOpacity onPress={() => setShowAdd(true)} style={{
            backgroundColor: C.pinkGlass, borderRadius: 16, padding: 20,
            alignItems: 'center', marginBottom: 12, borderWidth: 1.5,
            borderColor: C.pinkBorder, borderStyle: 'dashed',
          }}>
            <Ionicons name="person-add" size={28} color={C.pink} />
            <Text style={{ color: C.pink, fontWeight: '800', fontSize: 14, marginTop: 8 }}>Add Emergency Contact</Text>
            <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
              SOS bhejte waqt inhe WhatsApp aur location milegi
            </Text>
          </TouchableOpacity>
        )}

        {showAdd && (
          <View style={{
            backgroundColor: C.glass, borderRadius: 20, padding: 16,
            marginBottom: 14, borderWidth: 1, borderColor: C.glassBorder,
            elevation: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
          }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12 }}>➕ Naya Contact</Text>
            <TextInput
              value={newName} onChangeText={setNewName}
              placeholder="Naam (e.g. Mummy, Bhai)" placeholderTextColor={C.textDim}
              style={{
                backgroundColor: C.glassMid, borderRadius: 12, padding: 13,
                fontSize: 14, color: C.text, marginBottom: 10,
                borderWidth: 1, borderColor: C.glassBorder,
              }} />
            <TextInput
              value={newPhone} onChangeText={setNewPhone}
              placeholder="Mobile number (10 digits)" placeholderTextColor={C.textDim}
              keyboardType="phone-pad" maxLength={13}
              style={{
                backgroundColor: C.glassMid, borderRadius: 12, padding: 13,
                fontSize: 14, color: C.text, marginBottom: 14,
                borderWidth: 1, borderColor: C.glassBorder,
              }} />
            <TouchableOpacity onPress={addContact} style={{
              backgroundColor: C.pink, borderRadius: 14, padding: 14,
              alignItems: 'center', elevation: 4, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 8,
            }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>Save Contact</Text>
            </TouchableOpacity>
          </View>
        )}

        {contacts.map((c, i) => (
          <ContactRow
            key={i} contact={c}
            onDelete={() => deleteContact(i)}
            onCall={() => callContact(c)}
            onWhatsApp={() => whatsappContact(c)}
          />
        ))}

        {/* ── Emergency Numbers ── */}
        <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginTop: 8, marginBottom: 12 }}>
          HELPLINE NUMBERS
        </Text>
        {emergencyNumbers.map((item, i) => (
          <TouchableOpacity key={i} onPress={() => Linking.openURL(`tel:${item.number}`)}
            style={{
              backgroundColor: item.bg, borderRadius: 16, padding: 14, marginBottom: 10,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              elevation: 2, borderWidth: 1, borderColor: item.border,
            }}>
            <View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{item.label}</Text>
              <Text style={{ fontSize: 24, fontWeight: '900', color: item.textColor, marginTop: 2 }}>{item.number}</Text>
            </View>
            <View style={{ backgroundColor: item.textColor, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>📞 Call</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* ── Safety Tips ── */}
        <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginTop: 8, marginBottom: 12 }}>
          SAFETY TIPS
        </Text>
        <View style={{
          backgroundColor: C.glass, borderRadius: 20, overflow: 'hidden',
          elevation: 2, borderWidth: 1, borderColor: C.glassBorder,
        }}>
          {[
            '✅ Driver ka naam aur vehicle number verify karo boarding se pehle',
            '✅ Family ko location share karo — WhatsApp pe Live Location bhejo',
            '✅ Raat ko front seat prefer mat karo, back seat safer hai',
            '✅ Trip complete hone se pehle payment mat karo',
            '✅ Koi bhi problem ho — SOS hold karo, 2 seconds mein alert jayega',
          ].map((tip, i, arr) => (
            <Text key={i} style={{
              fontSize: 13, color: C.textMuted, padding: 14,
              borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: C.glassBorder,
              lineHeight: 20,
            }}>{tip}</Text>
          ))}
        </View>
      </ScrollView>
    </ScreenIn>
  );
}
