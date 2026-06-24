import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { C } from '../styles';

/*
  SpperoLogo — Pure React Native (no external SVG lib needed)

  Usage:
    <SpperoLogo />                    → icon only (80×80)
    <SpperoLogo size={120} />         → icon only, larger
    <SpperoLogo wordmark />           → icon + "SPPERO" text
    <SpperoLogo wordmark size={48} />
    <SpperoLogo tagline />            → icon + text + tagline
*/

interface SpperoLogoProps {
  size?: number;
  wordmark?: boolean;
  tagline?: boolean;
  style?: ViewStyle;
}

export function SpperoLogo({ size = 80, wordmark = false, tagline = false, style }: SpperoLogoProps) {
  const r = size / 80;  // scale ratio

  return (
    <View style={[styles.wrapper, style]}>
      {/* ── Icon Mark ─────────────────────────── */}
      <View style={[styles.iconBox, {
        width: size, height: size,
        borderRadius: size * 0.22,
        elevation: 18,
        shadowColor: C.pink,
        shadowRadius: size * 0.35,
      }]}>
        {/* Ambient pink glow (top-right) */}
        <View style={[styles.blob, {
          width: size * 0.75, height: size * 0.65,
          borderRadius: size * 0.4, top: -size * 0.08, right: -size * 0.1,
          backgroundColor: C.pink, opacity: 0.10,
        }]} />
        {/* Ambient green glow (bottom-left) */}
        <View style={[styles.blob, {
          width: size * 0.65, height: size * 0.55,
          borderRadius: size * 0.35, bottom: -size * 0.05, left: -size * 0.08,
          backgroundColor: C.green, opacity: 0.09,
        }]} />
        {/* Ambient yellow glow (center) */}
        <View style={[styles.blob, {
          width: size * 0.55, height: size * 0.50,
          borderRadius: size * 0.3,
          top: size * 0.25, left: size * 0.22,
          backgroundColor: C.yellow, opacity: 0.07,
        }]} />

        {/* The "S" mark */}
        <View style={[styles.sContainer, { width: size, height: size }]}>
          {/* S letter — bold, with glow shadow */}
          <Text style={[styles.sLetter, {
            fontSize: size * 0.68,
            lineHeight: size * 0.78,
            color: C.pink,
            textShadowColor: C.pink,
            textShadowRadius: size * 0.22,
            marginTop: size * 0.06,
          }]}>
            S
          </Text>

          {/* Yellow top-right dot */}
          <View style={[styles.dot, {
            width: size * 0.17, height: size * 0.17,
            borderRadius: size * 0.085,
            backgroundColor: C.yellow,
            top: size * 0.11, right: size * 0.14,
            shadowColor: C.yellow,
            shadowRadius: size * 0.12,
            elevation: 6,
          }]} />
          {/* Green bottom-left dot */}
          <View style={[styles.dot, {
            width: size * 0.17, height: size * 0.17,
            borderRadius: size * 0.085,
            backgroundColor: C.green,
            bottom: size * 0.11, left: size * 0.14,
            shadowColor: C.green,
            shadowRadius: size * 0.12,
            elevation: 6,
          }]} />

          {/* Motion lines (left side) */}
          <View style={{ position: 'absolute', left: size * 0.06, top: size * 0.40, gap: size * 0.05 }}>
            <View style={{ width: size * 0.14, height: size * 0.028, borderRadius: size * 0.014, backgroundColor: C.pink, opacity: 0.55 }}/>
            <View style={{ width: size * 0.10, height: size * 0.022, borderRadius: size * 0.011, backgroundColor: C.yellow, opacity: 0.38 }}/>
            <View style={{ width: size * 0.12, height: size * 0.018, borderRadius: size * 0.009, backgroundColor: C.green, opacity: 0.25 }}/>
          </View>
        </View>

        {/* Glass border */}
        <View style={[StyleSheet.absoluteFillObject, {
          borderRadius: size * 0.22,
          borderWidth: 1.2,
          borderColor: 'rgba(255,255,255,0.09)',
        }]} />
        {/* Inner shine (top edge) */}
        <View style={{
          position: 'absolute', top: 0, left: size * 0.1, right: size * 0.1,
          height: size * 0.008, borderRadius: size * 0.004,
          backgroundColor: 'rgba(255,255,255,0.18)',
        }} />
      </View>

      {/* ── Wordmark ─────────────────────────────── */}
      {(wordmark || tagline) && (
        <View style={styles.wordmarkBlock}>
          <View style={styles.wordmarkRow}>
            <Text style={[styles.wordmarkText, {
              fontSize: size * 0.50,
              letterSpacing: size * 0.04,
              textShadowColor: 'rgba(255,45,120,0.25)',
              textShadowRadius: size * 0.1,
            }]}>
              SPPERO
            </Text>
          </View>
          {/* Pink underline bar */}
          <View style={[styles.pinkBar, {
            width: size * 0.44, height: size * 0.038,
            borderRadius: size * 0.02, marginTop: size * 0.02,
          }]} />
          {tagline && (
            <Text style={[styles.taglineText, {
              fontSize: size * 0.145,
              letterSpacing: size * 0.032,
              marginTop: size * 0.08,
            }]}>
              LUCKNOW KA SMARTEST RIDE
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

/* ── Compact inline version for navbars / headers ── */
export function SpperoLogoMini({ size = 28 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.25 }}>
      <View style={{
        width: size, height: size,
        borderRadius: size * 0.22,
        backgroundColor: C.bg,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: C.pinkBorder,
        elevation: 6, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: size * 0.3,
      }}>
        <Text style={{
          fontSize: size * 0.62,
          fontWeight: '900',
          color: C.pink,
          lineHeight: size * 0.72,
          marginTop: size * 0.04,
          textShadowColor: C.pink,
          textShadowRadius: size * 0.2,
        }}>S</Text>
      </View>
      <Text style={{
        fontSize: size * 0.52,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: size * 0.035,
      }}>SPPERO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBox: {
    backgroundColor: '#08081A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
  },
  blob: {
    position: 'absolute',
  },
  sContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sLetter: {
    fontWeight: '900',
    fontFamily: 'System',
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
  },
  dot: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
  },
  wordmarkBlock: {
    justifyContent: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmarkText: {
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'System',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  pinkBar: {
    backgroundColor: '#FF2D78',
  },
  taglineText: {
    color: 'rgba(255,255,255,0.42)',
    fontWeight: '500',
    fontFamily: 'System',
  },
});
