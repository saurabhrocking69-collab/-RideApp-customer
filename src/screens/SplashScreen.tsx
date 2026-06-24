import { View, Text, Animated } from 'react-native';
import { useApp } from '../context/AppContext';
import { DotBG, PulseView } from '../components/ui';
import { C } from '../styles';

export function SplashScreen() {
  const { splashFade, splashLogo, splashScale, splashTag } = useApp();
  return (
    <Animated.View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', opacity: splashFade }}>
      <DotBG />
      <View style={{ position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: C.pinkGlass, top: -80, right: -80 }} />
      <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: C.yellowGlass, bottom: 40, left: -60 }} />

      <Animated.View style={{ alignItems: 'center', opacity: splashLogo, transform: [{ scale: splashScale }] }}>
        <View style={{ width: 112, height: 112, borderRadius: 34, backgroundColor: C.pinkGlass, borderWidth: 1.5, borderColor: C.pinkBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: C.pink, shadowOpacity: 0.55, shadowRadius: 24, elevation: 14 }}>
          <Text style={{ fontSize: 52 }}>🚖</Text>
        </View>
        <Text style={{ fontSize: 48, fontWeight: '900', color: C.text, letterSpacing: -1.5 }}>Sppero</Text>
      </Animated.View>

      <Animated.View style={{ alignItems: 'center', marginTop: 14, opacity: splashTag, transform: [{ translateY: splashTag.interpolate({ inputRange: [0,1], outputRange: [16, 0] }) }] }}>
        <Text style={{ color: C.textMuted, fontSize: 15, letterSpacing: 0.5 }}>Lucknow ka smartest ride</Text>
      </Animated.View>

      <View style={{ position: 'absolute', bottom: 60, flexDirection: 'row', gap: 10 }}>
        {[C.pink, C.yellow, C.green].map((col, i) => (
          <PulseView key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col }} />
        ))}
      </View>
    </Animated.View>
  );
}
