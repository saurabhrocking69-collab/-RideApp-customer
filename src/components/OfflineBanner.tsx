import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { useNetwork } from '../offline/useNetwork';

export function OfflineBanner() {
  const { isOnline, strength } = useNetwork();
  const slideY = useRef(new Animated.Value(-40)).current;
  const wasOnline = useRef(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useAnimatedVisible(slideY);

  useEffect(() => {
    if (!isOnline) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setVisible(true);
    } else if (!wasOnline.current) {
      // Just came back online — show "connected" briefly then hide
      setVisible(true);
      hideTimer.current = setTimeout(() => setVisible(false), 2000);
    }
    wasOnline.current = isOnline;
  }, [isOnline]);

  if (!visible) return null;

  const bg    = !isOnline ? '#DC2626' : '#16A34A';
  const label = !isOnline
    ? (strength === 'weak' ? '⚠️ Weak signal — cached data dikh raha hai' : '📵 Offline — cached data dikh raha hai')
    : '✅ Wapas Online!';

  return (
    <Animated.View style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999,
      backgroundColor: bg,
      paddingTop: 46, paddingBottom: 8, paddingHorizontal: 16,
      transform: [{ translateY: slideY }],
      elevation: 20, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8,
    }}>
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', textAlign: 'center' }}>{label}</Text>
    </Animated.View>
  );
}

function useAnimatedVisible(slideY: Animated.Value): [boolean, (v: boolean) => void] {
  const [visible, setVisible] = require('react').useState(false);
  const set = (v: boolean) => {
    if (v) {
      setVisible(true);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    } else {
      Animated.timing(slideY, { toValue: -60, duration: 300, useNativeDriver: true }).start(() => setVisible(false));
    }
  };
  return [visible, set];
}
