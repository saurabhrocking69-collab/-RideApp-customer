import { View, Text, Animated } from 'react-native';
import { useApp } from '../context/AppContext';
import { PulseView } from '../components/ui';

export function SplashScreen() {
  const { splashFade, splashLogo, splashScale, splashTag } = useApp();
  return (
    <Animated.View style={{ flex: 1, backgroundColor: '#0D0D1A', alignItems: 'center', justifyContent: 'center', opacity: splashFade }}>
      <View style={{ position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: 'rgba(147,51,234,0.08)', top: -80, right: -80 }} />
      <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(233,69,96,0.06)', bottom: 40, left: -60 }} />

      <Animated.View style={{ alignItems: 'center', opacity: splashLogo, transform: [{ scale: splashScale }] }}>
        <View style={{ width: 110, height: 110, borderRadius: 32, backgroundColor: 'rgba(147,51,234,0.18)', borderWidth: 1.5, borderColor: 'rgba(147,51,234,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: '#9333ea', shadowOpacity: 0.5, shadowRadius: 20, elevation: 12 }}>
          <Text style={{ fontSize: 52 }}>🚖</Text>
        </View>
        <Text style={{ fontSize: 46, fontWeight: '900', color: '#fff', letterSpacing: -1.5 }}>Sppero</Text>
      </Animated.View>

      <Animated.View style={{ alignItems: 'center', marginTop: 14, opacity: splashTag, transform: [{ translateY: splashTag.interpolate({ inputRange: [0,1], outputRange: [16, 0] }) }] }}>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, letterSpacing: 0.5 }}>Lucknow ka smartest ride</Text>
      </Animated.View>

      <View style={{ position: 'absolute', bottom: 60, flexDirection: 'row', gap: 8 }}>
        {[0,1,2].map(i => (
          <PulseView key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: i === 0 ? '#9333ea' : 'rgba(255,255,255,0.2)' }} />
        ))}
      </View>
    </Animated.View>
  );
}
