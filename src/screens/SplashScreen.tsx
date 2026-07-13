import { useRef, useEffect } from 'react';
import { View, Text, Animated, Dimensions, StyleSheet, Easing } from 'react-native';
import { C } from '../styles';

const { width: W, height: H } = Dimensions.get('window');
// Circle radius must cover the farthest screen corner from center (= half the diagonal)
const DIAG   = Math.ceil(Math.sqrt(W * W + H * H));
const CIRCLE = DIAG + 60; // diameter >= diagonal guarantees full coverage

export function SplashScreen() {
  // Sppero text entrance
  const textOpacity  = useRef(new Animated.Value(0)).current;
  const textScale    = useRef(new Animated.Value(0.68)).current;
  const textTranslateY = useRef(new Animated.Value(24)).current;

  // Plum flood circle — starts at 2s
  const circleScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Phase 1: "Sppero" springs up from slightly below
    Animated.parallel([
      Animated.spring(textOpacity,    { toValue: 1, tension: 52, friction: 9, useNativeDriver: true }),
      Animated.spring(textScale,      { toValue: 1, tension: 52, friction: 9, useNativeDriver: true }),
      Animated.spring(textTranslateY, { toValue: 0, tension: 52, friction: 9, useNativeDriver: true }),
    ]).start();

    // Phase 2: plum circle floods from center at exactly 2s
    const flood = setTimeout(() => {
      Animated.timing(circleScale, {
        toValue: 1,
        duration: 720,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94), // ease-out-quad — fast start, graceful finish
        useNativeDriver: true,
      }).start();
    }, 2000);

    return () => clearTimeout(flood);
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>

      {/* Phase 2: Plum ripple — expands from center, covers pink */}
      <Animated.View style={[styles.circle, { transform: [{ scale: circleScale }] }]} />

      {/* "Sppero" — floats above both backgrounds */}
      <Animated.View style={{
        opacity: textOpacity,
        transform: [{ scale: textScale }, { translateY: textTranslateY }],
      }}>
        <Text style={styles.brand}>Sppero</Text>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: C.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: C.plum,
    left: W / 2 - CIRCLE / 2,
    top:  H / 2 - CIRCLE / 2,
  },
  brand: {
    fontSize: 62,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2.5,
    includeFontPadding: false,
  },
});
