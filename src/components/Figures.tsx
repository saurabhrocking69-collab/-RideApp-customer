import Svg, { Circle, Rect, Path, G, Ellipse, Defs, LinearGradient, Stop } from 'react-native-svg';
import { View } from 'react-native';

/**
 * Flat geometric illustration set.
 *
 * CONSTRUCTION RULE, and the whole reason this file exists: every shape is a
 * circle, ellipse, rounded rectangle, straight line or exact arc. No freehand
 * bezier curves. The older illustrations in Illustrations.tsx lean on 13–17
 * hand-written curve paths each, and curves authored blind — without ever
 * seeing them render — come out lumpy. Exact shapes on a fixed grid do not.
 *
 * Figures are deliberately FACELESS: a real current style (unDraw, Meta's own
 * marketing art), friendly and inclusive, and it removes the single hardest
 * thing to draw blind — a face, where a few degrees off reads as wrong rather
 * than stylised.
 */

export const FIG = {
  pink:   '#FF2D78',
  pinkLt: '#FF7FA8',
  pinkDk: '#C4155A',
  plum:   '#2E1461',
  plumLt: '#4C2A7A',
  mint:   '#10B981',
  mintLt: '#6EE7B7',
  mintDk: '#047857',
  amber:  '#F59E0B',
  cream:  '#FFE9D6',
  sky:    '#DDEBFF',
  ink:    '#241238',
};

// A little skin variety, so a scene with two people doesn't look like one
// person cloned.
const SKIN = ['#F0C9A8', '#D9A175', '#B87B4E', '#8D5524'];
const HAIR = ['#241238', '#3B2314', '#5A3A22', '#1A1A22'];

type Hair = 'short' | 'bun' | 'long';

/**
 * One person on a fixed grid, so every figure in the app shares exact
 * proportions. Origin (x, y) is the point BETWEEN THE FEET, which makes
 * standing figures trivial to place on a ground line.
 *
 * Height ≈ 62 units at s = 1, head ≈ 22% of that. The first version used 26%,
 * which read as a cartoon; this is still stylised but noticeably more adult.
 */
function Person({
  x, y, s = 1,
  body = FIG.pink, bodyDk, legs = FIG.plum,
  skin = 0, hair = 0, hairStyle = 'short' as Hair,
  armRaise = false, flip = false, bag = false, shadow = true,
}: {
  x: number; y: number; s?: number;
  body?: string; bodyDk?: string; legs?: string;
  skin?: number; hair?: number; hairStyle?: Hair;
  armRaise?: boolean; flip?: boolean; bag?: boolean; shadow?: boolean;
}) {
  const sk = SKIN[skin % SKIN.length];
  const hr = HAIR[hair % HAIR.length];
  const shade = bodyDk || FIG.plumLt;
  return (
    <G transform={`translate(${x},${y}) scale(${flip ? -s : s},${s})`}>
      {/* Contact shadow. The single biggest thing separating a figure that is
          STANDING somewhere from one that is floating in space. */}
      {shadow && <Ellipse cx={0} cy={1.5} rx={14} ry={3.4} fill={FIG.ink} opacity={0.13} />}

      {/* long hair sits behind the torso */}
      {hairStyle === 'long' && <Rect x={-8.5} y={-52} width={17} height={26} rx={8} fill={hr} />}

      {/* legs + feet */}
      <Rect x={-7.6} y={-19} width={6.2} height={19} rx={3.1} fill={legs} />
      <Rect x={1.4}  y={-19} width={6.2} height={19} rx={3.1} fill={legs} />
      <Rect x={-9}   y={-3.4} width={8} height={3.6} rx={1.8} fill={FIG.ink} opacity={0.85} />
      <Rect x={1}    y={-3.4} width={8} height={3.6} rx={1.8} fill={FIG.ink} opacity={0.85} />

      {/* torso — fully rounded top doubles as shoulders */}
      <Rect x={-9.5} y={-46} width={19} height={28} rx={9.5} fill={body} />
      {/* hem: a darker band reads as depth without any curve work */}
      <Rect x={-9.5} y={-24} width={19} height={6} rx={3} fill={shade} opacity={0.35} />

      {/* arms */}
      <Rect x={-14} y={-44} width={4.6} height={19} rx={2.3} fill={body} />
      {armRaise
        ? <Rect x={9.4} y={-56} width={4.6} height={19} rx={2.3} fill={body} />
        : <Rect x={9.4} y={-44} width={4.6} height={19} rx={2.3} fill={body} />}

      {/* shoulder bag — cheap character, one strap + one pouch */}
      {bag && (
        <G>
          <Rect x={-10} y={-45} width={20} height={2.4} rx={1.2} fill={FIG.amber} transform="rotate(-18)" />
          <Rect x={6} y={-31} width={9} height={8} rx={2.4} fill={FIG.amber} />
        </G>
      )}

      {/* head: hair circle first, face circle over it — the crescent that
          remains IS the hair. Simpler and more reliable than drawing a fringe. */}
      <Circle cx={0} cy={-54.5} r={7.6} fill={hr} />
      <Circle cx={0} cy={-52.6} r={6.6} fill={sk} />
      {hairStyle === 'bun' && <Circle cx={0} cy={-62} r={3.6} fill={hr} />}
    </G>
  );
}

/** Soft disc + ground line every scene sits on, so the set feels like a set. */
function Stage({ w, h, tint }: { w: number; h: number; tint: string }) {
  return (
    <G>
      <Circle cx={w / 2} cy={h * 0.5} r={Math.min(w, h) * 0.46} fill={tint} opacity={0.13} />
      <Circle cx={w / 2} cy={h * 0.5} r={Math.min(w, h) * 0.33} fill={tint} opacity={0.10} />
      <Rect x={w * 0.1} y={h - 20} width={w * 0.8} height={3} rx={1.5} fill={FIG.plum} opacity={0.13} />
    </G>
  );
}

// ── Waiting for a ride ──────────────────────────────────────────────────────
export function FigWaitingRide({ size = 190 }: { size?: number }) {
  const W = 200, H = 175;
  return (
    <View pointerEvents="none">
      <Svg width={size} height={size * (H / W)} viewBox={`0 0 ${W} ${H}`}>
        <Stage w={W} h={H} tint={FIG.pink} />
        {/* destination pin */}
        <G>
          <Circle cx={146} cy={46} r={18} fill={FIG.pink} />
          <Circle cx={146} cy={46} r={7} fill="#fff" />
          <Path d="M 146 74 L 138.5 59 L 153.5 59 Z" fill={FIG.pink} />
          <Ellipse cx={146} cy={80} rx={9} ry={2.4} fill={FIG.ink} opacity={0.12} />
        </G>
        {/* waiting dots, fading toward the pin */}
        <Circle cx={112} cy={44} r={3.6} fill={FIG.pink} opacity={0.38} />
        <Circle cx={99}  cy={44} r={3.2} fill={FIG.pink} opacity={0.24} />
        <Circle cx={87}  cy={44} r={2.8} fill={FIG.pink} opacity={0.13} />
        {/* rider, checking phone */}
        <Person x={62} y={152} s={1.22} body={FIG.pink} bodyDk={FIG.pinkDk} legs={FIG.plum}
                skin={1} hair={0} hairStyle="bun" armRaise bag />
        <Rect x={66} y={84} width={13} height={20} rx={3} fill={FIG.plum} />
        <Rect x={68} y={87} width={9}  height={12} rx={1.6} fill={FIG.sky} />
      </Svg>
    </View>
  );
}

// ── Parcel handover ─────────────────────────────────────────────────────────
export function FigParcelHandover({ size = 210 }: { size?: number }) {
  const W = 230, H = 175;
  return (
    <View pointerEvents="none">
      <Svg width={size} height={size * (H / W)} viewBox={`0 0 ${W} ${H}`}>
        <Stage w={W} h={H} tint={FIG.mint} />
        <Person x={56} y={152} s={1.16} body={FIG.plum} bodyDk={FIG.ink} legs={FIG.ink}
                skin={2} hair={1} hairStyle="short" armRaise />
        <Person x={174} y={152} s={1.16} body={FIG.mint} bodyDk={FIG.mintDk} legs={FIG.plum}
                skin={0} hair={3} hairStyle="long" armRaise flip />
        {/* the parcel, mid-handover */}
        <G>
          <Rect x={97} y={70} width={36} height={31} rx={5} fill={FIG.cream} />
          <Rect x={97} y={70} width={36} height={9}  rx={4} fill="#F6C177" />
          <Rect x={111} y={70} width={8} height={31} fill={FIG.pink} />
          <Circle cx={115} cy={70} r={5} fill={FIG.pink} />
          <Ellipse cx={115} cy={107} rx={19} ry={3.2} fill={FIG.ink} opacity={0.12} />
        </G>
        <Rect x={81} y={62} width={10} height={3} rx={1.5} fill={FIG.mint} opacity={0.45} />
        <Rect x={139} y={62} width={10} height={3} rx={1.5} fill={FIG.mint} opacity={0.45} />
      </Svg>
    </View>
  );
}

// ── Safety / verified ───────────────────────────────────────────────────────
export function FigSafety({ size = 180 }: { size?: number }) {
  const W = 190, H = 175;
  return (
    <View pointerEvents="none">
      <Svg width={size} height={size * (H / W)} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="figShieldG" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={FIG.mintLt} />
            <Stop offset="1" stopColor={FIG.mint} />
          </LinearGradient>
        </Defs>
        <Stage w={W} h={H} tint={FIG.mint} />
        {/* shield: straight edges + one exact arc per side */}
        <Path d="M 95 24 L 148 46 V 84 A 53 53 0 0 1 95 136 A 53 53 0 0 1 42 84 V 46 Z" fill="url(#figShieldG)" />
        <Path d="M 74 84 L 89 99 L 118 68" stroke="#fff" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Person x={95} y={155} s={0.6} body={FIG.plum} bodyDk={FIG.ink} legs={FIG.ink}
                skin={3} hair={0} hairStyle="short" />
      </Svg>
    </View>
  );
}

// ── Empty state: no trips yet ───────────────────────────────────────────────
export function FigNoTrips({ size = 190 }: { size?: number }) {
  const W = 200, H = 155;
  return (
    <View pointerEvents="none">
      <Svg width={size} height={size * (H / W)} viewBox={`0 0 ${W} ${H}`}>
        <Stage w={W} h={H} tint={FIG.plum} />
        {/* route ticks between two pins */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Rect key={i} x={64 + i * 14} y={64} width={8} height={3.4} rx={1.7} fill={FIG.plum} opacity={0.26} />
        ))}
        <Circle cx={52} cy={66} r={10.5} fill={FIG.plum} opacity={0.9} />
        <Circle cx={52} cy={66} r={4.2}  fill="#fff" />
        <Circle cx={156} cy={66} r={10.5} fill={FIG.pink} />
        <Circle cx={156} cy={66} r={4.2}  fill="#fff" />
        {/* parked car, waiting for a first trip */}
        <G>
          <Ellipse cx={104} cy={130} rx={40} ry={4.5} fill={FIG.ink} opacity={0.12} />
          <Rect x={88}  y={92}  width={32} height={15} rx={6} fill={FIG.pinkLt} />
          <Rect x={93}  y={96}  width={9}  height={8}  rx={2} fill={FIG.sky} />
          <Rect x={106} y={96}  width={9}  height={8}  rx={2} fill={FIG.sky} />
          <Rect x={76}  y={104} width={56} height={18} rx={7} fill={FIG.pink} />
          <Rect x={76}  y={115} width={56} height={7}  rx={3.5} fill={FIG.pinkDk} opacity={0.35} />
          <Circle cx={90}  cy={124} r={7.5} fill={FIG.ink} />
          <Circle cx={118} cy={124} r={7.5} fill={FIG.ink} />
          <Circle cx={90}  cy={124} r={2.8} fill="#fff" />
          <Circle cx={118} cy={124} r={2.8} fill="#fff" />
        </G>
      </Svg>
    </View>
  );
}
