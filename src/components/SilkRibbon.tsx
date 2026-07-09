import { useRef } from 'react';
import { Animated, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

export type RibbonPalette = {
  bg: string;
  ribbons: Array<{
    yF:  number;   // y position (fraction of height)
    wF:  number;   // ribbon width (fraction of height)
    ph:  number;   // wave phase offset
    spd: number;   // wave animation speed
    amp: number;   // wave amplitude (fraction of height)
    lo:  string;   // shadow/edge colour
    mid: string;   // main body colour
    hi:  string;   // specular highlight colour
  }>;
};

function buildHtml(p: RibbonPalette): string {
  const bg  = p.bg;
  const rj  = JSON.stringify(p.ribbons);
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>*{margin:0;padding:0;overflow:hidden}html,body{width:100%;height:100%;background:${bg}}canvas{display:block;width:100%;height:100%}</style>
</head><body><canvas id="c"></canvas><script>
var cv=document.getElementById('c'),ctx=cv.getContext('2d'),W=0,H=0,t=0;
var ribs=${rj},bg='${bg}';
function resize(){var d=window.devicePixelRatio||1;cv.width=W=Math.round(innerWidth*d);cv.height=H=Math.round(innerHeight*d);}
function hx(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function lc(h1,h2,f){var a=hx(h1),b=hx(h2);return 'rgb('+Math.round(a[0]+(b[0]-a[0])*f)+','+Math.round(a[1]+(b[1]-a[1])*f)+','+Math.round(a[2]+(b[2]-a[2])*f)+')';}
function sy(xN,rb){return rb.yF*H+Math.sin(xN*Math.PI*1.6+rb.ph+t*rb.spd)*rb.amp*H+Math.sin(xN*Math.PI*0.7+rb.ph*0.55+t*rb.spd*0.7)*rb.amp*0.40*H;}
function drawRib(rb){
  var NS=46,hw=rb.wF*H*0.5,top=[],bot=[],i,xN,x,cy,dy,len,nx,ny,p,c,mx,my,g,sg,mcy,hy;
  for(i=0;i<=NS;i++){
    xN=i/NS;x=xN*W;cy=sy(xN,rb);
    dy=(sy(Math.min(1,(i+1)/NS),rb)-sy(Math.max(0,(i-1)/NS),rb))/(2*H/W);
    len=Math.sqrt(1+dy*dy);nx=-dy/len;ny=1/len;
    top.push([x+nx*hw,cy+ny*hw]);bot.push([x-nx*hw,cy-ny*hw]);
  }
  ctx.beginPath();ctx.moveTo(top[0][0],top[0][1]);
  for(i=1;i<top.length;i++){p=top[i-1];c=top[i];mx=(p[0]+c[0])/2;my=(p[1]+c[1])/2;ctx.quadraticCurveTo(p[0],p[1],mx,my);}
  ctx.lineTo(top[top.length-1][0],top[top.length-1][1]);
  for(i=bot.length-1;i>=0;i--){p=bot[Math.min(i+1,bot.length-1)];c=bot[i];mx=(p[0]+c[0])/2;my=(p[1]+c[1])/2;ctx.quadraticCurveTo(p[0],p[1],mx,my);}
  ctx.closePath();
  mcy=sy(0.5,rb);
  g=ctx.createLinearGradient(0,mcy-hw,0,mcy+hw);
  g.addColorStop(0,rb.lo);g.addColorStop(0.20,lc(rb.lo,rb.mid,0.60));
  g.addColorStop(0.44,rb.mid);g.addColorStop(0.52,rb.hi);
  g.addColorStop(0.66,rb.mid);g.addColorStop(0.82,lc(rb.lo,rb.mid,0.50));g.addColorStop(1,rb.lo);
  ctx.fillStyle=g;ctx.fill();
  ctx.save();ctx.clip();
  hy=mcy-hw*0.08;
  sg=ctx.createLinearGradient(0,hy,0,hy+5);
  sg.addColorStop(0,'rgba(255,255,255,0.34)');sg.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=sg;ctx.fillRect(0,hy,W,7);
  ctx.restore();
}
function draw(){
  if(!W||!H){requestAnimationFrame(draw);return;}
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  for(var i=0;i<ribs.length;i++) drawRib(ribs[i]);
  t+=0.0055;requestAnimationFrame(draw);
}
window.addEventListener('resize',resize);resize();draw();
</script></body></html>`;
}

interface SilkRibbonProps {
  palette: RibbonPalette;
  style?: ViewStyle;
  children?: React.ReactNode;
}

export function SilkRibbon({ palette, style, children }: SilkRibbonProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  return (
    <View style={[style, { overflow: 'hidden' }]}>
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
            Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start()
          }
        />
      </Animated.View>
      {children}
    </View>
  );
}

// ── Preset palettes ─────────────────────────────────────────────────
export const RIBBON = {
  // Original Coral + Mint — dark bg, white text on top
  coralMint: {
    bg: '#120A08',
    ribbons: [
      { yF: 0.12, wF: 0.30, ph: 0.0,  spd: 0.42, amp: 0.06, lo: '#701820', mid: '#D05060', hi: '#FAB8BC' },
      { yF: 0.35, wF: 0.28, ph: 2.1,  spd: 0.38, amp: 0.05, lo: '#2A5038', mid: '#559878', hi: '#B0D8C0' },
      { yF: 0.58, wF: 0.32, ph: 4.3,  spd: 0.44, amp: 0.06, lo: '#882030', mid: '#D85C6A', hi: '#F8C0C4' },
      { yF: 0.78, wF: 0.24, ph: 1.5,  spd: 0.40, amp: 0.05, lo: '#245030', mid: '#48906A', hi: '#A8D8BC' },
      { yF: 0.93, wF: 0.20, ph: 3.0,  spd: 0.36, amp: 0.04, lo: '#601020', mid: '#BF4850', hi: '#EFA8AC' },
    ],
  },
  // Rose + Aqua — light bg, dark text on top
  roseAqua: {
    bg: '#EAF2EE',
    ribbons: [
      { yF: 0.09, wF: 0.28, ph: 0.0,  spd: 0.42, amp: 0.05, lo: '#A01850', mid: '#E85890', hi: '#FFC8DF' },
      { yF: 0.30, wF: 0.32, ph: 2.3,  spd: 0.38, amp: 0.07, lo: '#007880', mid: '#22D3EE', hi: '#A8F0F8' },
      { yF: 0.53, wF: 0.30, ph: 4.0,  spd: 0.44, amp: 0.06, lo: '#B82060', mid: '#F070A8', hi: '#FFD8EC' },
      { yF: 0.74, wF: 0.26, ph: 1.6,  spd: 0.40, amp: 0.05, lo: '#008888', mid: '#5ADCE8', hi: '#C0F4F8' },
      { yF: 0.90, wF: 0.22, ph: 3.5,  spd: 0.36, amp: 0.04, lo: '#901040', mid: '#D84080', hi: '#FFC0D8' },
    ],
  },
  // Rose + Aqua — dark bg, white text on top
  roseAquaDark: {
    bg: '#060C14',
    ribbons: [
      { yF: 0.10, wF: 0.28, ph: 0.0,  spd: 0.42, amp: 0.05, lo: '#800030', mid: '#D04080', hi: '#FFA8C8' },
      { yF: 0.32, wF: 0.32, ph: 2.3,  spd: 0.38, amp: 0.07, lo: '#005060', mid: '#18B0C8', hi: '#88E8F8' },
      { yF: 0.55, wF: 0.30, ph: 4.0,  spd: 0.44, amp: 0.06, lo: '#980040', mid: '#E05890', hi: '#FFB8D8' },
      { yF: 0.75, wF: 0.24, ph: 1.6,  spd: 0.40, amp: 0.05, lo: '#006070', mid: '#48C8D8', hi: '#A8F0F8' },
      { yF: 0.91, wF: 0.20, ph: 3.5,  spd: 0.36, amp: 0.04, lo: '#700028', mid: '#C03070', hi: '#FFA0C0' },
    ],
  },
} satisfies Record<string, RibbonPalette>;
