import { useRef } from 'react';
import { Animated, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

export type GradientPalette = {
  colors: string[];
  bg: string;
  speed?: number;
};

function buildHtml({ colors, bg, speed = 1 }: GradientPalette): string {
  const blobs = colors.map((color, i) => ({
    color,
    cx:  0.15 + (i / colors.length) * 0.70,
    cy:  0.20 + ((i * 0.37) % 0.60),
    rx:  0.52 + ((i * 0.09) % 0.22),
    ry:  0.46 + ((i * 0.11) % 0.24),
    ph:  i * 1.26,
    sx:  0.38 + ((i * 0.07) % 0.22),
    sy:  0.32 + ((i * 0.05) % 0.18),
    ax:  0.21 + ((i * 0.04) % 0.09),
    ay:  0.19 + ((i * 0.03) % 0.09),
  }));
  const step = (0.0042 * Math.max(0.3, Math.min(2, speed))).toFixed(5);

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>*{margin:0;padding:0;overflow:hidden}html,body{width:100%;height:100%;background:${bg}}
canvas{display:block;width:100%;height:100%;filter:blur(24px) saturate(1.6)}</style>
</head><body><canvas id="c"></canvas><script>
var cv=document.getElementById('c'),ctx=cv.getContext('2d'),t=0,W=0,H=0;
var blobs=${JSON.stringify(blobs)};
function r(){cv.width=W=innerWidth*devicePixelRatio;cv.height=H=innerHeight*devicePixelRatio}
function hr(h,a){var n=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return 'rgba('+n+','+g+','+b+','+a+')'}
function d(){
  if(!W||!H){requestAnimationFrame(d);return}
  ctx.clearRect(0,0,W,H);ctx.fillStyle='${bg}';ctx.fillRect(0,0,W,H);
  blobs.forEach(function(b){
    var x=W*b.cx+Math.sin(t*b.sx+b.ph)*W*b.ax;
    var y=H*b.cy+Math.cos(t*b.sy+b.ph*0.73)*H*b.ay;
    var rx=W*b.rx,ry=H*b.ry;
    ctx.save();ctx.translate(x,y);ctx.scale(1,ry/rx);
    var g=ctx.createRadialGradient(0,0,0,0,0,rx);
    g.addColorStop(0,hr(b.color,0.92));
    g.addColorStop(0.5,hr(b.color,0.42));
    g.addColorStop(1,hr(b.color,0));
    ctx.beginPath();ctx.arc(0,0,rx,0,Math.PI*2);
    ctx.fillStyle=g;ctx.fill();ctx.restore();
  });
  t+=${step};requestAnimationFrame(d);
}
window.addEventListener('resize',r);r();d();
</script></body></html>`;
}

interface FluidGradientProps {
  palette: GradientPalette;
  style?: ViewStyle;
  children?: React.ReactNode;
}

export function FluidGradient({ palette, style, children }: FluidGradientProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {/* Gradient background — fades in after canvas is ready */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim, backgroundColor: palette.bg }]}
        pointerEvents="none"
      >
        <WebView
          source={{ html: buildHtml(palette) }}
          style={{ flex: 1 }}
          scrollEnabled={false}
          overScrollMode="never"
          javaScriptEnabled
          originWhitelist={['*']}
          androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
          onLoadEnd={() =>
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
          }
        />
      </Animated.View>
      {children}
    </View>
  );
}

// ── Preset palettes ─────────────────────────────────────────
export const GRADIENT = {
  pinkGold:      { colors: ['#FF2D78', '#F59E0B', '#FFAA5A', '#FFD580', '#FF6CAE'], bg: '#1A0010' },
  coralSunset:   { colors: ['#F43F5E', '#FB923C', '#F59E0B', '#FCD34D', '#FDA4AF'], bg: '#180500' },
  roseCream:     { colors: ['#E11D48', '#FB7185', '#FECDD3', '#FFE4E6'],           bg: '#200010' },
  hotLime:       { colors: ['#FF2D78', '#84CC16', '#FACC15', '#BEF264', '#FF6CAE'], bg: '#080F00' },
  mintAqua:      { colors: ['#FF2D78', '#2DD4BF', '#6EE7B7', '#FF6CAE', '#A7F3D0'], bg: '#001210' },
  neonFresh:     { colors: ['#D946EF', '#22D3EE', '#F0ABFC', '#67E8F9'],           bg: '#05000F' },
} satisfies Record<string, GradientPalette>;
