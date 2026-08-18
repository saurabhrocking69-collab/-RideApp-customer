import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authGet, authPost } from '../../api';
import { C } from '../styles';

/* A second number for the driver to call, separate from the login number.
 *
 * Your account number is the one you verified and log in with. It is not
 * necessarily the one you want a stranger dialling — a shared family phone, a
 * work SIM, or simply the number you don't hand out. This lets the account
 * stay on one number while calls go to another.
 *
 * Blank means "use my account number", which is exactly what happened before
 * this existed, so leaving it alone changes nothing.
 *
 * It does NOT outrank booking for someone else: if a ride was booked for
 * another person, the driver reaches THAT person for that ride. The order the
 * server resolves is  ride.rider_phone > users.call_phone > users.phone.
 */
export function CallNumberSheet({ visible, onClose, phone }: {
  visible: boolean; onClose: () => void; phone: string;
}) {
  const [value, setValue]   = useState('');
  const [saved, setSaved]   = useState<string | null>(null);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoad]  = useState(false);

  useEffect(() => {
    if (!visible || !phone) return;
    setError(''); setLoad(true);
    authGet(`/api/auth/call-phone?phone=${encodeURIComponent(phone)}`)
      .then(r => {
        const v = r && !r._error ? (r.call_phone || '') : '';
        setSaved(v || null); setValue(v);
      })
      .finally(() => setLoad(false));
  }, [visible, phone]);

  const submit = async (clear = false) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const r = await authPost('/api/auth/call-phone', { phone, call_phone: clear ? '' : value });
      if (r?.error) { setError(r.error); setBusy(false); return; }
      setSaved(r?.call_phone || null);
      if (clear) setValue('');
      setBusy(false);
      onClose();
    } catch {
      setError('Network error — please try again');
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose} />
      <View style={{
        backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: 20, paddingBottom: 32,
      }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.glassBorder, marginBottom: 16 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Ionicons name="call-outline" size={20} color={C.green} />
          <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>Number for driver calls</Text>
        </View>
        <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 19, marginBottom: 16 }}>
          Your driver will call this number instead of your account number.
          Leave it blank to keep using {phone || 'your account number'}.
        </Text>

        {loading ? (
          <ActivityIndicator color={C.green} style={{ marginVertical: 20 }} />
        ) : (
          <>
            <TextInput
              value={value}
              onChangeText={t => { setValue(t); setError(''); }}
              placeholder="10-digit mobile number"
              placeholderTextColor={C.textDim}
              keyboardType="phone-pad"
              maxLength={14}
              style={{
                backgroundColor: C.glassMid, borderWidth: 1,
                borderColor: error ? C.red : C.glassBorder,
                borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
                fontSize: 16, fontWeight: '700', color: C.text, letterSpacing: 0.5,
              }}
            />
            {!!error && <Text style={{ color: C.red, fontSize: 12, fontWeight: '700', marginTop: 7 }}>{error}</Text>}

            <TouchableOpacity
              onPress={() => submit(false)}
              disabled={busy}
              style={{
                backgroundColor: C.green, borderRadius: 14, paddingVertical: 15,
                alignItems: 'center', marginTop: 16, opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Save</Text>}
            </TouchableOpacity>

            {/* Only offered when something is actually set — a "remove" button
                that removes nothing just makes the sheet look broken. */}
            {!!saved && (
              <TouchableOpacity onPress={() => submit(true)} disabled={busy} style={{ paddingVertical: 13, alignItems: 'center' }}>
                <Text style={{ color: C.textMuted, fontWeight: '700', fontSize: 13.5 }}>
                  Use my account number instead
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}
