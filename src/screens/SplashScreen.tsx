import { View, Text, Animated } from 'react-native';
import { useApp } from '../context/AppContext';
import { FloatBubbles, GlowPulse } from '../components/ui';
import { C } from '../styles';

export function SplashScreen() {
  const { splashFade, splashLogo, splashScale, splashTag } = useApp();
  return (
    <Animated.View style={{ flex: 1, backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center', opacity: splashFade }}>
      <FloatBubbles />

      {/* Background decorative circles */}
      <View style={{ position: 'absolute', width: 480, height: 480, borderRadius: 240, backgroundColor: 'rgba(255,45,120,0.05)', top: -120, right: -120 }} />
      <View style={{ position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(5,150,105,0.05)', bottom: -60, left: -80 }} />
      <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(245,158,11,0.06)', top: '30%', right: -40 }} />

      {/* Logo section */}
      <Animated.View style={{ alignItems: 'center', opacity: splashLogo, transform: [{ scale: splashScale }] }}>
        {/* Outer glow ring */}
        <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,45,120,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
          <View style={{ width: 116, height: 116, borderRadius: 58, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center', elevation: 18, shadowColor: C.pink, shadowOpacity: 0.45, shadowRadius: 28, shadowOffset: { width: 0, height: 8 } }}>
            <Text style={{ fontSize: 54 }}>🚖</Text>
          </View>
        </View>

        {/* Brand name */}
        <Text style={{ fontSize: 50, fontWeight: '900', color: C.text, letterSpacing: -2, lineHeight: 52 }}>Sppero</Text>

        {/* Pink underline accent */}
        <View style={{ width: 56, height: 4, borderRadius: 2, backgroundColor: C.pink, marginTop: 10, marginBottom: 4 }} />
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={{ alignItems: 'center', marginTop: 18, opacity: splashTag, transform: [{ translateY: splashTag.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        <Text style={{ color: C.textMuted, fontSize: 15, letterSpacing: 1, fontWeight: '500' }}>India ka smartest ride</Text>
      </Animated.View>

      {/* Bottom indicator */}
      <View style={{ position: 'absolute', bottom: 64, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <GlowPulse color={C.pink} size={10} />
        <GlowPulse color={C.yellow} size={10} />
        <GlowPulse color={C.green} size={10} />
      </View>

      {/* Bottom brand text */}
      <View style={{ position: 'absolute', bottom: 30 }}>
        <Text style={{ color: C.textDim, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>Sppero · India</Text>
      </View>
    </Animated.View>
  );
}
