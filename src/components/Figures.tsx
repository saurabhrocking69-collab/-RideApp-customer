import Svg, { Circle, Rect, Path, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { View } from 'react-native';

/**
 * Flat geometric illustration set.
 *
 * CONSTRUCTION RULE, and the whole reason this file exists: every shape here
 * is a circle, a rounded rectangle, or a straight line. No freehand bezier
 * curves. The older illustrations in Illustrations.tsx lean on 13–17
 * hand-written curve paths each, and curves authored blind — without ever
 * seeing them render — come out lumpy. Exact shapes on a fixed grid do not.
 *
 * Figures are deliberately FACELESS. That is a real, current illustration
 * style (unDraw, Meta's own marketing art), it reads as friendly and
 * inclusive, and it removes the single hardest thing to get right: a face
 * where being a few degrees off looks wrong rather than stylised.
 */

export const FIG = {
  pink:   '#FF2D78',
  pinkLt: '#FF7FA8',
  plum:   '#2E1461',
  plumLt: '#4C2A7A',
  mint:   '#10B981',
  mintLt: '#6EE7B7',
  amber:  '#F59E0B',
  cream:  '#FFE9D6',
  sky:    '#DDEBFF',
  skin:   '#F0C9A8',
  skinAlt:'#C98F63',
  ink:    '#241238',
};

/**
 * One person, built on a fixed grid so every figure in the app shares exact
 * proportions. Origin (x, y) is the point BETWEEN THE FEET, which makes
 * standing figures trivial to place on a ground line.
 *
 * Total height ≈ 57 units at s = 1.
 */
function Person({
  x, y, s = 1, body = FIG.pink, legs = FIG.plum, skin = FIG.skin, hair = FIG.ink,
  armRaise = false, flip = false,
}: {
  x: number; y: number; s?: number;
  body?: string; legs?: string; skin?: string; hair?: string;
  armRaise?: boolean; flip?: boolean;
}) {
  return (
    <G transform={`translate(${x},${y}) scale(${flip ? -s : s},${s})`}>
      {/* legs */}
      <Rect x={-8}   y={-16} width={6.5} height={16} rx={3.2} fill={legs} />
      <Rect x={1.5}  y={-16} width={6.5} height={16} rx={3.2} fill={legs} />
      {/* torso — fully rounded top doubles as shoulders */}
      <Rect x={-10}  y={-40} width={20}  height={26} rx={10}  fill={body} />
      {/* arms */}
      <Rect x={-14.5} y={-38} width={5} height={18} rx={2.5} fill={body} />
      {armRaise
        ? <Rect x={9.5} y={-50} width={5} height={18} rx={2.5} fill={body} />
        : <Rect x={9.5} y={-38} width={5} height={18} rx={2.5} fill={body} />}
      {/* head + hair cap */}
      <Circle cx={0} cy={-48} r={7.5} fill={skin} />
      <Path d={`M -7.5 -49 A 7.5 7.5 0 0 1 7.5 -49 L 7.5 -50.5 L -7.5 -50.5 Z`} fill={hair} />
      <Circle cx={0} cy={-52} r={7.5} fill={hair} />
      <Circle cx={0} cy={-47.5} r={6.6} fill={skin} />
    </G>
  );
}

/** Soft disc + ground line every scene sits on, so the set feels like a set. */
function Stage({ w, h, tint }: { w: number; h: number; tint: string }) {
  return (
    <G>
      <Circle cx={w / 2} cy={h * 0.52} r={Math.min(w, h) * 0.44} fill={tint} opacity={0.16} />
      <Rect x={w * 0.12} y={h - 22} width={w * 0.76} height={3} rx={1.5} fill={FIG.plum} opacity={0.12} />
    </G>
  );
}

// ── Waiting for a ride ──────────────────────────────────────────────────────
export function FigWaitingRide({ size = 190 }: { size?: number }) {
  const W = 200, H = 170;
  return (
    <View pointerEvents="none">
      <Svg width={size} height={size * (H / W)} viewBox={`0 0 ${W} ${H}`}>
        <Stage w={W} h={H} tint={FIG.pink} />
        {/* location pin, floating above */}
        <G>
          <Circle cx={140} cy={44} r={19} fill={FIG.pink} />
          <Circle cx={140} cy={44} r={7.5} fill="#fff" />
          <Path d="M 140 74 L 132 58 L 148 58 Z" fill={FIG.pink} />
        </G>
        {/* three waiting dots */}
        <Circle cx={104} cy={40} r={3.4} fill={FIG.pink} opacity={0.35} />
        <Circle cx={92}  cy={40} r={3.4} fill={FIG.pink} opacity={0.22} />
        <Circle cx={80}  cy={40} r={3.4} fill={FIG.pink} opacity={0.12} />
        {/* person + phone */}
        <Person x={66} y={148} s={1.25} body={FIG.pink} legs={FIG.plum} armRaise />
        <Rect x={70} y={92} width={13} height={20} rx={3} fill={FIG.plum} />
        <Rect x={72} y={95} width={9}  height={12} rx={1.6} fill={FIG.sky} />
      </Svg>
    </View>
  );
}

// ── Parcel handover ─────────────────────────────────────────────────────────
export function FigParcelHandover({ size = 210 }: { size?: number }) {
  const W = 220, H = 170;
  return (
    <View pointerEvents="none">
      <Svg width={size} height={size * (H / W)} viewBox={`0 0 ${W} ${H}`}>
        <Stage w={W} h={H} tint={FIG.mint} />
        {/* sender */}
        <Person x={58} y={148} s={1.2} body={FIG.plum} legs={FIG.ink} skin={FIG.skinAlt} armRaise />
        {/* receiver */}
        <Person x={162} y={148} s={1.2} body={FIG.mint} legs={FIG.plum} armRaise flip />
        {/* the parcel, mid-air between them */}
        <G>
          <Rect x={92} y={72} width={36} height={30} rx={5} fill={FIG.cream} />
          <Rect x={92} y={72} width={36} height={9}  rx={4} fill="#F6C177" />
          <Rect x={106} y={72} width={8} height={30} fill={FIG.pink} />
          <Circle cx={110} cy={72} r={5} fill={FIG.pink} />
        </G>
        {/* motion ticks */}
        <Rect x={78} y={64} width={10} height={3} rx={1.5} fill={FIG.mint} opacity={0.5} />
        <Rect x={134} y={64} width={10} height={3} rx={1.5} fill={FIG.mint} opacity={0.5} />
      </Svg>
    </View>
  );
}

// ── Safety / verified ───────────────────────────────────────────────────────
export function FigSafety({ size = 180 }: { size?: number }) {
  const W = 190, H = 170;
  return (
    <View pointerEvents="none">
      <Svg width={size} height={size * (H / W)} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="figShield" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={FIG.mintLt} />
            <Stop offset="1" stopColor={FIG.mint} />
          </LinearGradient>
        </Defs>
        <Stage w={W} h={H} tint={FIG.mint} />
        {/* shield — straight edges + one arc, no freehand curves */}
        <Path d="M 95 26 L 148 48 V 86 A 53 53 0 0 1 95 138 A 53 53 0 0 1 42 86 V 48 Z" fill="url(#figShield)" />
        <Path d="M 74 86 L 89 101 L 118 70" stroke="#fff" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* small figure standing in front, protected */}
        <Person x={95} y={150} s={0.62} body={FIG.plum} legs={FIG.ink} />
      </Svg>
    </View>
  );
}

// ── Empty state: no trips yet ───────────────────────────────────────────────
export function FigNoTrips({ size = 190 }: { size?: number }) {
  const W = 200, H = 150;
  return (
    <View pointerEvents="none">
      <Svg width={size} height={size * (H / W)} viewBox={`0 0 ${W} ${H}`}>
        <Stage w={W} h={H} tint={FIG.plum} />
        {/* dashed route between two pins, drawn as discrete ticks */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Rect key={i} x={62 + i * 15} y={82} width={9} height={3.5} rx={1.75} fill={FIG.plum} opacity={0.28} />
        ))}
        <Circle cx={52} cy={84} r={11} fill={FIG.plum} opacity={0.9} />
        <Circle cx={52} cy={84} r={4.5} fill="#fff" />
        <Circle cx={158} cy={84} r={11} fill={FIG.pink} />
        <Circle cx={158} cy={84} r={4.5} fill="#fff" />
        {/* a quiet little car parked at the start */}
        <G>
          <Rect x={78} y={104} width={54} height={17} rx={7} fill={FIG.pink} opacity={0.9} />
          <Rect x={90} y={95}  width={30} height={13} rx={6} fill={FIG.pinkLt} />
          <Circle cx={92}  cy={122} r={7} fill={FIG.ink} />
          <Circle cx={118} cy={122} r={7} fill={FIG.ink} />
          <Circle cx={92}  cy={122} r={2.6} fill="#fff" />
          <Circle cx={118} cy={122} r={2.6} fill="#fff" />
        </G>
      </Svg>
    </View>
  );
}
