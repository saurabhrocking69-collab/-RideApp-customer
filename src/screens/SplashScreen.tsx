import { View, Text, Animated } from 'react-native';
import { useApp } from '../context/AppContext';
import { C } from '../styles';

export function SplashScreen() {
  const { splashFade, splashLogo, splashScale, splashTag } = useApp();

  return (
    <Animated.View style={{ flex: 1, backgroundColor: C.night, alignItems: 'center', justifyContent: 'center', opacity: splashFade }}>

      {/* Ambient glow blobs */}
      <View style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,45,120,0.07)', top: -60, right: -80 }} />
      <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(46,20,97,0.5)', bottom: -40, left: -60 }} />

      {/* Logo + brand */}
      <Animated.View style={{ alignItems: 'center', opacity: splashLogo, transform: [{ scale: splashScale }] }}>
        {/* Rounded-square logomark */}
        <View style={{
          width: 96, height: 96, borderRadius: 28,
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 24,
          backgroundColor: C.pink,
          shadowColor: C.pink, shadowOpacity: 0.55, shadowRadius: 32, shadowOffset: { width: 0, height: 8 },
          elevation: 20,
        }}>
          <Text style={{ fontSize: 48, fontWeight: '900', color: '#fff', letterSpacing: -2, lineHeight: 52 }}>S</Text>
        </View>

        {/* Brand name */}
        <Text style={{ fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: 2, lineHeight: 48 }}>SPPERO</Text>

        {/* Saffron accent bar */}
        <View style={{ width: 40, height: 3, borderRadius: 2, backgroundColor: C.saffron, marginTop: 12 }} />
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={{
        alignItems: 'center', marginTop: 20,
        opacity: splashTag,
        transform: [{ translateY: splashTag.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
      }}>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, letterSpacing: 1.5, fontWeight: '500' }}>
          Your City. Your Ride.
        </Text>
      </Animated.View>

      {/* Loading bar */}
      <View style={{
        position: 'absolute', bottom: 56,
        width: 120, height: 2, borderRadius: 1,
        backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden',
      }}>
        <Animated.View style={{
          height: '100%', borderRadius: 1,
          backgroundColor: C.pink,
          width: splashTag.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }} />
      </View>

      <View style={{ position: 'absolute', bottom: 28 }}>
        <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' }}>Sppero · India</Text>
      </View>
    </Animated.View>
  );
}
