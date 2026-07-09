import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, ScrollView, Text, TouchableOpacity, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../styles';
import { Cache, KEY, TTL } from '../offline';
import { API } from '../constants';

export interface InAppNotif {
  id: string;
  title: string;
  body: string;
  type?: string;
  ts: number;
  read: boolean;
}

const CACHE_KEY = 'notif:center';

// ── Persist helpers ───────────────────────────────────────────────────────────
export function saveNotification(n: Omit<InAppNotif, 'read'>): void {
  const list = getStoredNotifications();
  const exists = list.find(x => x.id === n.id);
  if (exists) return;
  const updated = [{ ...n, read: false }, ...list].slice(0, 50);
  Cache.set(CACHE_KEY, updated, TTL.USER_PROFILE); // 24h
}

export function getStoredNotifications(): InAppNotif[] {
  return Cache.getStale<InAppNotif[]>(CACHE_KEY) ?? [];
}

export function markAllRead(): void {
  const list = getStoredNotifications().map(n => ({ ...n, read: true }));
  Cache.set(CACHE_KEY, list, TTL.USER_PROFILE);
}

export function getUnreadCount(): number {
  return getStoredNotifications().filter(n => !n.read).length;
}

// ── Time formatting ───────────────────────────────────────────────────────────
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min  = Math.floor(diff / 60000);
  if (min < 1)   return 'just now';
  if (min < 60)  return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)   return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ── Icon config ───────────────────────────────────────────────────────────────
const ICON_CFG: Record<string, { icon: string; color: string; bg: string }> = {
  ride_matched:       { icon: 'car',             color: C.green,     bg: C.greenGlass },
  driver_arrived:     { icon: 'location',         color: '#3B82F6',  bg: '#3B82F615' },
  trip_started:       { icon: 'navigate',         color: '#8B5CF6',  bg: '#8B5CF615' },
  trip_completed:     { icon: 'checkmark-circle', color: C.green,     bg: C.greenGlass },
  ride_cancelled:     { icon: 'close-circle',     color: C.red,       bg: C.redGlass },
  no_driver_found:    { icon: 'alert-circle',     color: C.yellow,    bg: C.yellowGlass },
  cashback_earned:    { icon: 'gift',             color: C.yellow,    bg: C.yellowGlass },
  extension_accepted: { icon: 'refresh-circle',   color: C.green,     bg: C.greenGlass },
  payment_dispute:    { icon: 'warning',          color: C.red,       bg: C.redGlass },
  account_restricted: { icon: 'ban',              color: C.red,       bg: C.redGlass },
  complaint_update:   { icon: 'document-text',    color: '#6366F1',  bg: '#6366F115' },
  refund:             { icon: 'wallet',           color: C.green,     bg: C.greenGlass },
  wallet_topup:       { icon: 'wallet',           color: C.green,     bg: C.greenGlass },
  warning:            { icon: 'warning',          color: C.yellow,    bg: C.yellowGlass },
  broadcast:          { icon: 'megaphone',        color: '#6366F1',   bg: '#6366F115' },
  default:            { icon: 'notifications',    color: C.pink,      bg: C.pinkGlass },
};

// ── Bell button (used in HomeScreen header) ───────────────────────────────────
interface BellProps { onPress: () => void; unread: number }
export function NotifBell({ onPress, unread }: BellProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (unread === 0) return;
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.22, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [unread]);

  return (
    <TouchableOpacity onPress={onPress} style={{ position: 'relative', padding: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Animated.View style={{ transform: [{ scale: unread > 0 ? pulse : 1 }] }}>
        <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={24} color="#fff" />
      </Animated.View>
      {unread > 0 && (
        <View style={{
          position: 'absolute', top: 0, right: 0,
          minWidth: 16, height: 16, borderRadius: 8,
          backgroundColor: C.red, alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.pink,
        }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Notification center modal ─────────────────────────────────────────────────
interface CenterProps {
  visible: boolean;
  onClose: () => void;
  phone?: string;
}

export function NotificationCenter({ visible, onClose, phone }: CenterProps) {
  const [notifs, setNotifs] = useState<InAppNotif[]>([]);
  const slideY = useRef(new Animated.Value(800)).current;

  useEffect(() => {
    if (!visible) return;
    const local = getStoredNotifications();
    setNotifs(local);
    markAllRead();

    // Also fetch backend in-app notifications and merge
    if (phone) {
      fetch(`${API}/api/notifications?target=${phone}`)
        .then(r => r.json())
        .then(d => {
          if (!Array.isArray(d.notifications)) return;
          const backend: InAppNotif[] = d.notifications.map((n: any, i: number) => ({
            id: `be-${n.created_at}-${i}`,
            title: n.title,
            body: n.message || n.body || '',
            type: n.type || 'default',
            ts: new Date(n.created_at).getTime(),
            read: true,
          }));
          setNotifs(prev => {
            const ids = new Set(prev.map(x => x.id));
            const merged = [...prev, ...backend.filter(b => !ids.has(b.id))];
            return merged.sort((a, b) => b.ts - a.ts).slice(0, 50);
          });
        })
        .catch(() => {});
    }
  }, [visible, phone]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(slideY, { toValue: 800, duration: 260, useNativeDriver: true }).start();
    }
  }, [visible]);

  const clearAll = () => {
    Cache.set(CACHE_KEY, [], TTL.USER_PROFILE);
    setNotifs([]);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <Animated.View style={{
          backgroundColor: C.bg || C.bgDark,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          maxHeight: '80%',
          transform: [{ translateY: slideY }],
          paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', position: 'absolute', top: 8, left: '50%', marginLeft: -19 }} />
            <Text style={{ flex: 1, color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 8 }}>Notifications</Text>
            {notifs.length > 0 && (
              <TouchableOpacity onPress={clearAll} style={{ marginTop: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.pinkGlass, borderRadius: 10, borderWidth: 1, borderColor: C.pinkBorder }}>
                <Text style={{ color: C.pink, fontSize: 11, fontWeight: '800' }}>Clear All</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={{ marginTop: 8, marginLeft: 8, padding: 4 }}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            {notifs.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Text style={{ fontSize: 40 }}>🔔</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 12, fontWeight: '600' }}>No notifications yet</Text>
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 4 }}>Book a ride to see updates here</Text>
              </View>
            ) : (
              notifs.map(n => {
                const cfg = ICON_CFG[n.type || 'default'] || ICON_CFG.default;
                return (
                  <View key={n.id} style={{
                    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
                    backgroundColor: n.read ? 'rgba(255,255,255,0.04)' : C.pinkGlass,
                    borderRadius: 16, padding: 14, marginBottom: 8,
                    borderWidth: 1,
                    borderColor: n.read ? 'rgba(255,255,255,0.07)' : C.pinkBorder,
                  }}>
                    <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: cfg.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: cfg.color + '30' }}>
                      <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ flex: 1, color: '#fff', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{n.title}</Text>
                        {!n.read && <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.pink }} />}
                      </View>
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 3, lineHeight: 17 }} numberOfLines={3}>{n.body}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 5, fontWeight: '600' }}>{timeAgo(n.ts)}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
