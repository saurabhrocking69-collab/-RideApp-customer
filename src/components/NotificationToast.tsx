import { useEffect, useRef } from 'react';
import { Animated, Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../styles';

export interface ToastNotif {
  id: string;
  title: string;
  body: string;
  type?: string;
  ts: number;
  imageUrl?: string;
}

interface Props {
  notif: ToastNotif | null;
  onDismiss: () => void;
  onTap: (notif: ToastNotif) => void;
}

const TYPE_ICON: Record<string, { icon: string; color: string }> = {
  ride_matched:       { icon: 'car',              color: C.green },
  driver_arrived:     { icon: 'location',          color: '#3B82F6' },
  trip_started:       { icon: 'navigate',          color: '#8B5CF6' },
  trip_completed:     { icon: 'checkmark-circle',  color: C.green },
  ride_cancelled:     { icon: 'close-circle',      color: C.red },
  no_driver_found:    { icon: 'alert-circle',      color: C.yellow },
  cashback_earned:    { icon: 'gift',              color: C.yellow },
  extension_accepted: { icon: 'refresh-circle',    color: C.green },
  payment_dispute:    { icon: 'warning',           color: C.red },
  account_restricted: { icon: 'ban',               color: C.red },
refund:             { icon: 'wallet',            color: C.green },
  wallet_topup:       { icon: 'wallet',            color: C.green },
  warning:            { icon: 'warning',           color: C.yellow },
  broadcast:          { icon: 'megaphone',         color: '#6366F1' },
  support_reply:      { icon: 'chatbubble-ellipses', color: '#3B82F6' },
  support_resolved:   { icon: 'checkmark-done-circle', color: C.green },
  default:            { icon: 'notifications',     color: C.pink },
};

export function NotificationToast({ notif, onDismiss, onTap }: Props) {
  const slideY  = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!notif) return;

    // Slide in
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0,   useNativeDriver: true, tension: 70, friction: 10 }),
      Animated.timing(opacity, { toValue: 1,   duration: 200, useNativeDriver: true }),
    ]).start();

    // Auto dismiss after 4.5s
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => dismiss(), 4500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [notif?.id]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideY,  { toValue: -120, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,    duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  if (!notif) return null;

  const cfg      = TYPE_ICON[notif.type || 'default'] || TYPE_ICON.default;
  const hasImage = !!notif.imageUrl;

  return (
    <Animated.View style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999,
      transform: [{ translateY: slideY }], opacity,
      paddingTop: 50, paddingHorizontal: 12, paddingBottom: 8,
      pointerEvents: 'box-none',
    }}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => { dismiss(); onTap(notif); }}
        style={{
          backgroundColor: C.bgDark,
          borderRadius: 18,
          overflow: 'hidden',
          borderWidth: 1.5, borderColor: cfg.color + '40',
          elevation: 20, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16,
        }}>

        {/* Header row — always shown */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
          <View style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: cfg.color + '20', alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: cfg.color + '40',
          }}>
            <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{notif.title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 }} numberOfLines={hasImage ? 1 : 2}>{notif.body}</Text>
          </View>
          <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.60)" />
          </TouchableOpacity>
        </View>

        {/* Banner image — only for promo/broadcast notifications with image */}
        {hasImage && (
          <Image
            source={{ uri: notif.imageUrl }}
            style={{ width: '100%', height: 140 }}
            resizeMode="cover"
          />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
