import { useState, useRef, useEffect } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Animated, useWindowDimensions } from 'react-native';
import Svg, { Rect, Path, Circle, Ellipse, Defs, LinearGradient, RadialGradient, Stop, G, Polygon, Line, Text as SvgText } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy } from '../components/ui';
import { C, T, SP, R } from '../styles';

export function OnboardingScreen() {
  const {
    onboardFade, onboardSlide,
    userName, setUserName,
    gender, setGender,
    result, setResult,
    loading,
    completeOnboarding,
  } = useApp();

  return (
    <Animated.View style={{ flex: 1, backgroundColor: C.night, opacity: onboardFade }}>
      {/* Dark hero top */}
      <View style={{
        alignItems: 'center', paddingTop: 60, paddingBottom: 36,
        backgroundColor: C.night,
      }}>
        {/* Ambient glow */}
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,45,120,0.08)', top: -40, right: -30 }} />

        <Animated.View style={{ transform: [{ translateY: onboardSlide.interpolate({ inputRange: [0, 60], outputRange: [0, 60] }) }] }}>
          <View style={{
            width: 84, height: 84, borderRadius: 24,
            backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
            shadowColor: C.pink, shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 6 },
            elevation: 16,
          }}>
            <Ionicons name="happy" size={44} color="#fff" />
          </View>
        </Animated.View>

        <Animated.View style={{
          transform: [{ translateY: onboardSlide.interpolate({ inputRange: [0, 60], outputRange: [0, 40] }) }],
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5, textAlign: 'center' }}>
            Welcome to Sppero
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13.5, marginTop: 8, textAlign: 'center', lineHeight: 21 }}>
            Tell us a little about yourself{'\n'}to get started
          </Text>
        </Animated.View>
      </View>

      {/* White card sheet */}
      <Animated.View style={{
        backgroundColor: C.bgCard,
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        flex: 1, padding: 28,
        borderTopWidth: 1, borderColor: C.glassBorder,
        transform: [{ translateY: onboardSlide }],
      }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 10, fontWeight: '800', color: C.pink, marginBottom: 12, letterSpacing: 1.4 }}>YOUR NAME *</Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            borderWidth: 1.5, borderColor: userName.trim() ? C.pink : C.glassBorder,
            borderRadius: 16, paddingHorizontal: 16,
            backgroundColor: userName.trim() ? C.pinkGlass : C.glass,
            marginBottom: 28,
          }}>
            <Ionicons name="person-outline" size={18} color={C.textMuted} style={{ marginRight: 10 }} />
            <TextInput
              style={{ flex: 1, fontSize: 16, fontWeight: '600', color: C.text, paddingVertical: 16 }}
              placeholder="Enter your name..."
              placeholderTextColor={C.textDim}
              value={userName}
              onChangeText={t => { setUserName(t); if (result) setResult(''); }}
              autoCapitalize="words"
            />
            {userName.trim() ? <Ionicons name="checkmark-circle" size={20} color={C.pink} /> : null}
          </View>

          <Text style={{ fontSize: 10, fontWeight: '800', color: C.textMuted, marginBottom: 12, letterSpacing: 1.4 }}>GENDER (OPTIONAL)</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
            {[
              { id: 'male',   icon: 'male',   label: 'Male'   },
              { id: 'female', icon: 'female', label: 'Female' },
              { id: 'other',  icon: 'ellipsis-horizontal', label: 'Other' },
            ].map(g => (
              <TouchableOpacity
                key={g.id}
                onPress={() => setGender((prev: any) => prev === g.id ? '' : g.id)}
                style={{
                  flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 16,
                  backgroundColor: gender === g.id ? C.pinkGlass : C.glass,
                  borderWidth: 2, borderColor: gender === g.id ? C.pink : C.glassBorder,
                  elevation: gender === g.id ? 4 : 0,
                  shadowColor: C.pink, shadowOpacity: 0.28, shadowRadius: 8,
                }}>
                <Ionicons name={g.icon as any} size={26} color={gender === g.id ? C.pink : C.textMuted} style={{ marginBottom: 6 }} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: gender === g.id ? C.pink : C.textMuted }}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Privacy note */}
          <View style={{
            backgroundColor: 'rgba(0,212,168,0.07)', borderRadius: 14,
            padding: 14, marginBottom: 28,
            borderWidth: 1, borderColor: 'rgba(0,212,168,0.22)',
            flexDirection: 'row', alignItems: 'flex-start', gap: 12,
          }}>
            <Ionicons name="shield-checkmark" size={20} color={C.mint} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.mint, marginBottom: 4 }}>Your data is safe</Text>
              <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 18 }}>We never share your personal information with third parties. Your data is 100% secure and encrypted.</Text>
            </View>
          </View>

          {result ? <Text style={{ color: C.pink, fontSize: 13, marginBottom: 12, textAlign: 'center', fontWeight: '700' }}>{result}</Text> : null}

          <Bouncy
            onPress={completeOnboarding}
            disabled={loading || !userName.trim()}
            style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 12, elevation: 8, shadowColor: C.pink, shadowOpacity: 0.45, shadowRadius: 12 }}>
            <View style={{ backgroundColor: userName.trim() ? C.pink : C.glass, paddingVertical: 18, alignItems: 'center', borderRadius: 16, borderWidth: userName.trim() ? 0 : 1, borderColor: C.glassBorder }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 }}>
                {loading ? 'Saving...' : "Let's Go"}
              </Text>
            </View>
          </Bouncy>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

export function LoginScreen() {
  const { loginHeroAnim, loginCardAnim, phone, setPhone, result, loading, sendOtp } = useApp();
  const [activeTab, setActiveTab] = useState('auto');

  const pinY     = useRef(new Animated.Value(0)).current;
  const p1Op     = useRef(new Animated.Value(0.7)).current;
  const p1Sc     = useRef(new Animated.Value(1)).current;
  const p2Op     = useRef(new Animated.Value(0.7)).current;
  const p2Sc     = useRef(new Animated.Value(1)).current;

  const { width: W } = useWindowDimensions();
  const IH = W * (476 / 390);
  const S  = W / 390;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pinY, { toValue: -8, duration: 600, useNativeDriver: true }),
      Animated.timing(pinY, { toValue: 0,  duration: 600, useNativeDriver: true }),
    ])).start();

    const pulse = (op: Animated.Value, sc: Animated.Value) =>
      Animated.loop(Animated.parallel([
        Animated.timing(op, { toValue: 0,   duration: 2000, useNativeDriver: true }),
        Animated.timing(sc, { toValue: 2.5, duration: 2000, useNativeDriver: true }),
      ]));

    pulse(p1Op, p1Sc).start();
    const t = setTimeout(() => pulse(p2Op, p2Sc).start(), 720);
    return () => clearTimeout(t);
  }, []);

  const TABS = [
    { id: 'auto',  emoji: '🛺',  label: 'Auto'  },
    { id: 'bike',  emoji: '🏍️', label: 'Bike'  },
    { id: 'sedan', emoji: '🚗',  label: 'Sedan' },
    { id: 'suv',   emoji: '🚙',  label: 'SUV'   },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FAFBFF' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Illustration ── */}
        <Animated.View style={{ opacity: loginHeroAnim }}>
          <View style={{ height: IH, overflow: 'hidden' }}>

            <Svg width={W} height={IH} viewBox="0 0 390 476">
              <Defs>
                <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%"   stopColor="#B0D8FF"/>
                  <Stop offset="100%" stopColor="#E4F4FF"/>
                </LinearGradient>
                <RadialGradient id="sungr" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%"   stopColor="#FFE87A"/>
                  <Stop offset="60%"  stopColor="#FFCA45"/>
                  <Stop offset="100%" stopColor="#FFB020" stopOpacity={0}/>
                </RadialGradient>
                <RadialGradient id="skinM" cx="42%" cy="32%" r="60%">
                  <Stop offset="0%"   stopColor="#FFCFA0"/>
                  <Stop offset="100%" stopColor="#D08A50"/>
                </RadialGradient>
                <RadialGradient id="skinF" cx="42%" cy="32%" r="60%">
                  <Stop offset="0%"   stopColor="#F8C498"/>
                  <Stop offset="100%" stopColor="#C07840"/>
                </RadialGradient>
                <LinearGradient id="mJkt" x1="0" y1="0" x2="0.25" y2="1">
                  <Stop offset="0%"   stopColor="#6090E8"/>
                  <Stop offset="100%" stopColor="#3460C0"/>
                </LinearGradient>
                <LinearGradient id="mLeg" x1="0" y1="0" x2="0.2" y2="1">
                  <Stop offset="0%"   stopColor="#3E5898"/>
                  <Stop offset="100%" stopColor="#243070"/>
                </LinearGradient>
                <LinearGradient id="wTop" x1="0" y1="0" x2="0.25" y2="1">
                  <Stop offset="0%"   stopColor="#FFD040"/>
                  <Stop offset="100%" stopColor="#D49010"/>
                </LinearGradient>
                <LinearGradient id="wLeg" x1="0" y1="0" x2="0.2" y2="1">
                  <Stop offset="0%"   stopColor="#3A5290"/>
                  <Stop offset="100%" stopColor="#222E68"/>
                </LinearGradient>
                <LinearGradient id="gnd2" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%"   stopColor="#BEE8AC"/>
                  <Stop offset="28%"  stopColor="#D4EFC4"/>
                  <Stop offset="58%"  stopColor="#EEF8EA"/>
                  <Stop offset="100%" stopColor="#FAFBFF"/>
                </LinearGradient>
              </Defs>

              {/* Sky */}
              <Rect width={390} height={302} fill="url(#sky)"/>

              {/* Sun */}
              <Circle cx={334} cy={72} r={46} fill="#FFE000" opacity={0.18}/>
              <Circle cx={334} cy={72} r={28} fill="url(#sungr)"/>
              <Line x1={334} y1={36}  x2={334} y2={28}  stroke="#FFD040" strokeWidth={2.5} strokeLinecap="round" opacity={0.5}/>
              <Line x1={356} y1={50}  x2={362} y2={44}  stroke="#FFD040" strokeWidth={2.5} strokeLinecap="round" opacity={0.5}/>
              <Line x1={370} y1={72}  x2={378} y2={72}  stroke="#FFD040" strokeWidth={2.5} strokeLinecap="round" opacity={0.5}/>
              <Line x1={356} y1={94}  x2={362} y2={100} stroke="#FFD040" strokeWidth={2.5} strokeLinecap="round" opacity={0.5}/>
              <Line x1={312} y1={50}  x2={306} y2={44}  stroke="#FFD040" strokeWidth={2.5} strokeLinecap="round" opacity={0.5}/>

              {/* Clouds */}
              <G><Ellipse cx={68}  cy={64}  rx={42} ry={17} fill="white" opacity={0.84}/><Ellipse cx={50}  cy={70}  rx={28} ry={14} fill="white" opacity={0.84}/><Ellipse cx={88}  cy={70}  rx={26} ry={14} fill="white" opacity={0.84}/></G>
              <G><Ellipse cx={208} cy={46}  rx={34} ry={14} fill="white" opacity={0.76}/><Ellipse cx={192} cy={52}  rx={22} ry={11} fill="white" opacity={0.76}/><Ellipse cx={226} cy={52}  rx={20} ry={11} fill="white" opacity={0.76}/></G>
              <G><Ellipse cx={22}  cy={118} rx={22} ry={9}  fill="white" opacity={0.65}/><Ellipse cx={10}  cy={123} rx={14} ry={8}  fill="white" opacity={0.65}/><Ellipse cx={32}  cy={124} rx={14} ry={8}  fill="white" opacity={0.65}/></G>

              {/* B1 glass tower */}
              <Rect x={0} y={152} width={52} height={150} fill="#A4C4F0"/><Rect x={0} y={148} width={52} height={6} fill="#80A8E0"/>
              {[162,175,188,201,214,227,240,253,266,279].map((y,i) => [6,21,36].map(x => (
                <Rect key={`w${i}${x}`} x={x} y={y} width={11} height={7} rx={1} fill="white" opacity={i%2===0?0.45:0.38}/>
              )))}

              {/* B2 heritage dome */}
              <Rect x={55} y={220} width={46} height={82} fill="#FFCF96"/>
              <Ellipse cx={78} cy={220} rx={20} ry={13} fill="#FFB870"/>
              <Rect x={75} y={200} width={6} height={22} rx={3} fill="#FF9840"/>
              <Ellipse cx={78} cy={200} rx={6} ry={5} fill="#FF7820"/>
              <Path d="M63 248 C63 240 73 240 73 248 L73 268 L63 268 Z" fill="#88C8F0" opacity={0.75}/>
              <Path d="M82 248 C82 240 92 240 92 248 L92 268 L82 268 Z" fill="#88C8F0" opacity={0.75}/>
              <Rect x={66} y={275} width={24} height={18} rx={2} fill="#88C8F0" opacity={0.5}/>

              {/* B3 teal */}
              <Rect x={104} y={240} width={36} height={62} fill="#9EEBD4"/><Rect x={104} y={236} width={36} height={6} rx={1} fill="#7ACFB4"/>
              {[248,257,266,275,284].map(y => <Rect key={y} x={108} y={y} width={28} height={3} rx={1} fill="white" opacity={0.55}/>)}
              <Rect x={114} y={228} width={10} height={10} rx={2} fill="#7ACFB4"/>

              {/* India Gate */}
              <Rect x={148} y={296} width={94} height={6} rx={1} fill="#D8C070"/>
              <Rect x={152} y={292} width={86} height={6} rx={1} fill="#E8D080"/>
              <Rect x={157} y={180} width={20} height={114} fill="#F5E8C0"/>
              <Rect x={213} y={180} width={20} height={114} fill="#F5E8C0"/>
              {[192,204,216,228,240,252,264,276].map(y => [
                <Rect key={`lp${y}`} x={159} y={y} width={16} height={2} fill="#E8D090" opacity={0.7}/>,
                <Rect key={`rp${y}`} x={215} y={y} width={16} height={2} fill="#E8D090" opacity={0.7}/>,
              ])}
              <Rect x={151} y={166} width={88} height={17} rx={1} fill="#F0DFA8"/>
              <Rect x={151} y={166} width={88} height={5}  fill="#F5EAC0"/>
              <Rect x={160} y={154} width={70} height={14} rx={1} fill="#F0DFA8"/>
              <Rect x={183} y={132} width={24} height={24} rx={1} fill="#EED880"/>
              <Polygon points="195,118 183,136 207,136" fill="#E0C860"/>
              <Ellipse cx={195} cy={116} rx={4.5} ry={7} fill="#FF8C30" opacity={0.9}/>
              <Ellipse cx={195} cy={114} rx={2.5} ry={4.5} fill="#FFC830" opacity={0.85}/>
              <Path d="M177 294 L177 230 A18 18 0 0 1 213 230 L213 294 Z" fill="#C4E0FF"/>
              <Path d="M177 230 A18 18 0 0 1 213 230" fill="none" stroke="#E0D080" strokeWidth={2.2}/>
              <Rect x={194}   y={104} width={1.5} height={16} fill="#8B7040"/>
              <Rect x={195.5} y={104} width={11}  height={3.5} fill="#FF6020"/>
              <Rect x={195.5} y={107.5} width={11} height={3.5} fill="white"/>
              <Rect x={195.5} y={111} width={11}  height={3.5} fill="#1A8C40"/>

              {/* B4 pink */}
              <Rect x={246} y={196} width={44} height={106} fill="#F8C0E0"/><Rect x={246} y={190} width={44} height={8} fill="#EAA0C8"/>
              {[208,223,238,253,268,283].map((y,i) => [252,270].map(x => (
                <Rect key={`b4${y}${x}`} x={x} y={y} width={14} height={9} rx={1} fill="white" opacity={i%2===0?0.55:0.48}/>
              )))}
              <Rect x={256} y={182} width={22} height={10} rx={3} fill="#EAA0C8"/>

              {/* B5 lavender */}
              <Rect x={293} y={162} width={50} height={140} fill="#C4B4F8"/><Rect x={293} y={156} width={50} height={8} fill="#A898E8"/>
              <Rect x={301} y={144} width={34} height={14} rx={1} fill="#A898E8"/><Rect x={311} y={132} width={14} height={14} rx={1} fill="#9080D8"/>
              {[301,313,325,337].map(x => <Rect key={x} x={x} y={170} width={2} height={128} fill="white" opacity={0.28}/>)}

              {/* B6 amber */}
              <Rect x={346} y={226} width={44} height={76} fill="#FFE09A"/><Rect x={346} y={220} width={44} height={8} fill="#F0C870"/>
              {[238,252,266].map(y => [352,370].map(x => <Rect key={`b6${y}${x}`} x={x} y={y} width={14} height={8} rx={1} fill="white" opacity={0.52}/>))}
              <Ellipse cx={368} cy={220} rx={9} ry={6} fill="#F0C870"/>

              {/* Trees */}
              <Rect x={100} y={286} width={4} height={16} fill="#7A5430"/>
              <Circle cx={102} cy={280} r={12} fill="#52A842"/><Circle cx={98}  cy={284} r={9}  fill="#46963A"/><Circle cx={108} cy={285} r={8}  fill="#5AB848"/>
              <Rect x={242} y={286} width={4} height={16} fill="#7A5430"/>
              <Circle cx={244} cy={280} r={11} fill="#5AB848"/><Circle cx={240} cy={284} r={8}  fill="#46963A"/><Circle cx={250} cy={285} r={8}  fill="#52A842"/>

              {/* Ground */}
              <Rect x={0} y={302} width={390} height={174} fill="url(#gnd2)"/>
              <Rect x={0} y={302} width={390} height={3}   fill="rgba(255,255,255,0.18)"/>

              {/* Ground shadows */}
              <Ellipse cx={115} cy={304} rx={26} ry={4} fill="rgba(0,0,0,0.09)"/>
              <Ellipse cx={268} cy={304} rx={24} ry={4} fill="rgba(0,0,0,0.09)"/>

              {/* ═══ MAN — navy jacket, x=115 ═══ */}
              <Path d="M96 298 L95 305 Q95 308 102 308 L116 308 Q120 308 119 304 L118 298Z" fill="#1A2030"/>
              <Path d="M118 298 L119 304 Q119 308 125 308 L139 308 Q143 308 142 305 L140 298Z" fill="#1A2030"/>
              <Path d="M100 264 L97 299 Q96 303 101 303 L115 303 Q119 303 118 299 L118 264Z" fill="url(#mLeg)"/>
              <Path d="M118 264 L118 299 Q118 303 123 303 L137 303 Q141 303 139 299 L137 264Z" fill="url(#mLeg)"/>
              <Rect x={102} y={270} width={2.5} height={30} rx={1} fill="rgba(255,255,255,0.07)"/>
              <Path d="M102 227 C99 241 97 255 96 264 L134 264 C133 255 131 241 128 227 Q125 224 115 224 Q105 224 102 227Z" fill="url(#mJkt)"/>
              <Path d="M102 227 C99 241 97 255 96 264 L101 264 C102 257 103 245 106 234Z" fill="rgba(255,255,255,0.09)"/>
              <Path d="M110 225 L115 238 L120 225" fill="none" stroke="#2A50B0" strokeWidth={1.4}/>
              <Path d="M102 230 C98 243 95 256 93 263" stroke="#4968CC" strokeWidth={10} strokeLinecap="round" fill="none"/>
              <Path d="M93 263 C91 271 90 279 89 284" stroke="#CC9460" strokeWidth={7} strokeLinecap="round" fill="none"/>
              <Ellipse cx={89} cy={287} rx={5} ry={4} fill="#CC9460"/>
              <Path d="M128 230 C131 243 134 254 136 263" stroke="#4968CC" strokeWidth={10} strokeLinecap="round" fill="none"/>
              <Path d="M136 263 C138 270 139 277 140 282" stroke="#CC9460" strokeWidth={7} strokeLinecap="round" fill="none"/>
              <Ellipse cx={140} cy={285} rx={5} ry={4} fill="#CC9460"/>
              <Rect x={135} y={264} width={11} height={18} rx={2.5} fill="#1A1828"/>
              <Rect x={136.5} y={265.5} width={8} height={15} rx={2} fill="#252240"/>
              <Rect x={137.5} y={267} width={6} height={6} rx={1.5} fill="#FF2D6B"/>
              <SvgText x={140.5} y={271.5} fontSize={3.5} fill="white" textAnchor="middle" fontWeight="900" fontFamily="System">S</SvgText>
              <Circle cx={138} cy={276} r={1.1} fill="#22C55E"/>
              <Path d="M138 276 Q140.5 275 143 276" fill="none" stroke="#22C55E" strokeWidth={0.8}/>
              <Circle cx={143} cy={276} r={1.1} fill="#FF2D6B"/>
              <Rect x={111} y={218} width={8} height={8} rx={2.5} fill="#CC9460"/>
              <Ellipse cx={102} cy={207} rx={2.2} ry={3} fill="#C08050"/>
              <Ellipse cx={128} cy={207} rx={2.2} ry={3} fill="#C08050"/>
              <Ellipse cx={115} cy={207} rx={13} ry={14} fill="url(#skinM)"/>
              <Path d="M102 207 C102 192 107 186 115 186 C123 186 128 192 128 207 L127 200 C126 190 122 187 115 187 C108 187 104 190 103 200Z" fill="#1C1018"/>
              <Path d="M102 207 L101 218 Q100 221 103 221" fill="#1C1018"/>
              <Path d="M128 207 L129 218 Q130 221 127 221" fill="#1C1018"/>
              <Circle cx={110} cy={205} r={2.2} fill="#1C1020"/><Circle cx={120} cy={205} r={2.2} fill="#1C1020"/>
              <Circle cx={109.2} cy={204.2} r={1} fill="white" opacity={0.75}/><Circle cx={119.2} cy={204.2} r={1} fill="white" opacity={0.75}/>
              <Path d="M109 213 C111 217 119 217 121 213" fill="none" stroke="#9A7040" strokeWidth={1.5} strokeLinecap="round"/>
              <Ellipse cx={104} cy={209} rx={4} ry={2.5} fill="#FF9050" opacity={0.18}/>
              <Ellipse cx={126} cy={209} rx={4} ry={2.5} fill="#FF9050" opacity={0.18}/>

              {/* ═══ WOMAN — yellow top, raised arm, x=268 ═══ */}
              <Path d="M251 298 L250 305 Q250 308 257 308 L270 308 Q274 308 273 304 L271 298Z" fill="#FF6880"/>
              <Path d="M271 298 L273 304 Q273 308 279 308 L291 308 Q295 308 294 305 L292 298Z" fill="#FF6880"/>
              <Path d="M255 268 L252 299 Q251 303 256 303 L269 303 Q272 303 272 299 L271 268Z" fill="url(#wLeg)"/>
              <Path d="M271 268 L272 299 Q272 303 277 303 L289 303 Q293 303 292 299 L289 268Z" fill="url(#wLeg)"/>
              <Rect x={257} y={274} width={2.5} height={27} rx={1} fill="rgba(255,255,255,0.07)"/>
              <Path d="M254 237 C251 250 248 262 247 268 L289 268 C288 262 285 250 282 237 Q279 234 268 234 Q257 234 254 237Z" fill="url(#wTop)"/>
              <Path d="M254 237 C251 250 248 262 247 268 L252 268 C253 262 255 252 258 244Z" fill="rgba(255,255,255,0.1)"/>
              <Ellipse cx={268} cy={234} rx={7} ry={3.5} fill="#B88010"/>
              <Rect x={247} y={263} width={42} height={5} rx={1.5} fill="#B07E08"/>
              <Path d="M282 241 C286 228 290 213 292 203" stroke="#C8980E" strokeWidth={10} strokeLinecap="round" fill="none"/>
              <Path d="M292 203 C294 195 296 188 297 183" stroke="#C08040" strokeWidth={7} strokeLinecap="round" fill="none"/>
              <Ellipse cx={297} cy={180} rx={5} ry={4} fill="#C08040" transform="rotate(-18, 297, 180)"/>
              <Path d="M294 177 C292 172 294 168 297 170" fill="none" stroke="#C08040" strokeWidth={3} strokeLinecap="round"/>
              <Path d="M299 176 C298 171 301 168 303 171" fill="none" stroke="#C08040" strokeWidth={3} strokeLinecap="round"/>
              <Path d="M254 241 C250 253 247 263 246 268" stroke="#C8980E" strokeWidth={10} strokeLinecap="round" fill="none"/>
              <Path d="M246 268 C244 276 243 284 243 291" stroke="#C08040" strokeWidth={7} strokeLinecap="round" fill="none"/>
              <Ellipse cx={243} cy={294} rx={5} ry={4} fill="#C08040"/>
              <Rect x={264} y={228} width={8} height={8} rx={2.5} fill="#C08040"/>
              <Ellipse cx={256} cy={218} rx={2.2} ry={3} fill="#B07030"/>
              <Ellipse cx={280} cy={218} rx={2.2} ry={3} fill="#B07030"/>
              <Circle cx={280} cy={220} r={2.5} fill="#F0C030"/><Circle cx={280} cy={223} r={1.5} fill="#E0A820"/>
              <Circle cx={268} cy={202} r={9} fill="#1C1018"/><Circle cx={268} cy={202} r={6} fill="#241820"/>
              <Path d="M256 218 C256 203 261 197 268 197 C275 197 280 203 280 218 L279 211 C278 202 273 199 268 199 C263 199 258 202 257 211Z" fill="#1C1018"/>
              <Path d="M256 218 L254 229 Q253 232 256 232" fill="#1C1018"/>
              <Path d="M280 218 L282 229 Q283 232 280 232" fill="#1C1018"/>
              <Ellipse cx={268} cy={218} rx={12} ry={13} fill="url(#skinF)"/>
              <Circle cx={263} cy={215} r={2.2} fill="#1C1020"/><Circle cx={273} cy={215} r={2.2} fill="#1C1020"/>
              <Circle cx={262.2} cy={214.2} r={1} fill="white" opacity={0.75}/><Circle cx={272.2} cy={214.2} r={1} fill="white" opacity={0.75}/>
              <Path d="M262 224 C264 228 272 228 274 224" fill="none" stroke="#8A5020" strokeWidth={1.5} strokeLinecap="round"/>
              <Ellipse cx={258} cy={220} rx={4} ry={2.5} fill="#FF9050" opacity={0.2}/>
              <Ellipse cx={278} cy={220} rx={4} ry={2.5} fill="#FF9050" opacity={0.2}/>

              {/* Route line pin→balloon */}
              <Circle cx={182} cy={264} r={3} fill="#22C55E" opacity={0.75}/>
              <Path d="M182 264 Q122 292 62 318" fill="none" stroke="#22C55E" strokeWidth={2.2} strokeDasharray="4.5 3.5" strokeLinecap="round" opacity={0.82}/>
              <Circle cx={62} cy={318} r={3} fill="#22C55E" opacity={0.85}/>

              {/* Sparkles */}
              <G transform="translate(306,52)"><Path d="M0-8 2-2 8 0 2 2 0 8-2 2-8 0-2-2Z" fill="#FFE060" opacity={0.7}/></G>
              <G transform="translate(352,118)"><Path d="M0-6 1.5-1.5 6 0 1.5 1.5 0 6-1.5 1.5-6 0-1.5-1.5Z" fill="#FFB0D8" opacity={0.55}/></G>
              <G transform="translate(28,148)"><Path d="M0-5 1.2-1.2 5 0 1.2 1.2 0 5-1.2 1.2-5 0-1.2-1.2Z" fill="#A8D8FF" opacity={0.6}/></G>
            </Svg>

            {/* Pickup balloon */}
            <View style={{ position: 'absolute', left: 20 * S, top: 322 * S }} pointerEvents="none">
              <View style={{
                position: 'absolute', top: -6, left: 28,
                width: 0, height: 0,
                borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 6,
                borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#22C55E',
              }}/>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#22C55E',
                paddingVertical: 5, paddingLeft: 8, paddingRight: 11, borderRadius: 12,
                shadowColor: '#22C55E', shadowOpacity: 0.5, shadowRadius: 8, elevation: 4,
              }}>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'white', marginRight: 5 }}/>
                <Text style={{ color: 'white', fontSize: 10, fontWeight: '700', letterSpacing: 0.4 }}>Pickup</Text>
              </View>
            </View>

            {/* Location pin (animated) */}
            <Animated.View style={{
              position: 'absolute', left: 178 * S, top: 248 * S,
              transform: [{ translateY: pinY }],
            }} pointerEvents="none">
              <Animated.View style={{
                position: 'absolute', width: 34, height: 34, top: 1, left: 0,
                borderRadius: 17, borderWidth: 2, borderColor: '#FF2D6B',
                opacity: p1Op, transform: [{ scale: p1Sc }],
              }}/>
              <Animated.View style={{
                position: 'absolute', width: 34, height: 34, top: 1, left: 0,
                borderRadius: 17, borderWidth: 2, borderColor: '#FF2D6B',
                opacity: p2Op, transform: [{ scale: p2Sc }],
              }}/>
              <Svg width={34} height={48} viewBox="0 0 34 48">
                <Ellipse cx={17} cy={46} rx={8} ry={3.5} fill="rgba(255,45,107,0.18)"/>
                <Path d="M17 2C8.2 2 1 9.2 1 18c0 10.5 16 30 16 30s16-19.5 16-30C33 9.2 25.8 2 17 2Z" fill="#FF2D6B"/>
                <Path d="M17 4C9.3 4 3 10.3 3 18c0 9.8 14 28 14 28S31 27.8 31 18C31 10.3 24.7 4 17 4Z" fill="#FF5C8A"/>
                <Circle cx={17} cy={18} r={7.5} fill="white" opacity={0.95}/>
                <Circle cx={17} cy={18} r={4.2} fill="#FF2D6B"/>
              </Svg>
            </Animated.View>

            {/* Bottom fade into card */}
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: IH * 0.22 }} pointerEvents="none">
              <View style={{ flex: 1 }}/>
              <View style={{ height: IH * 0.07, backgroundColor: 'rgba(250,251,255,0.45)' }}/>
              <View style={{ height: IH * 0.07, backgroundColor: 'rgba(250,251,255,0.82)' }}/>
              <View style={{ height: IH * 0.05, backgroundColor: '#FAFBFF' }}/>
            </View>
          </View>
        </Animated.View>

        {/* ── Login card ── */}
        <Animated.View style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 30, borderTopRightRadius: 30,
          paddingTop: 10, paddingHorizontal: 24, paddingBottom: 36,
          borderTopWidth: 1, borderColor: C.glassBorder,
          marginTop: -2,
          transform: [{ translateY: loginCardAnim }],
          flex: 1,
        }}>
          {/* Handle */}
          <View style={{ width: 36, height: 4, backgroundColor: '#EEEEF4', borderRadius: 2, alignSelf: 'center', marginBottom: 18 }}/>

          {/* Brand row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center',
              shadowColor: C.pink, shadowOpacity: 0.35, shadowRadius: 14, elevation: 6,
            }}>
              <Text style={{ fontSize: 21, fontWeight: '900', color: '#fff', letterSpacing: -1 }}>S</Text>
            </View>
            <Text style={{ fontSize: 21, fontWeight: '800', color: '#1E2434', letterSpacing: -0.5 }}>
              Welcome to <Text style={{ color: C.pink, fontStyle: 'italic' }}>Sppero</Text>
            </Text>
          </View>
          <Text style={{ fontSize: 11.5, color: '#8A94B0', marginBottom: 16 }}>
            India's fastest & safest ride · 24/7 available
          </Text>

          {/* Vehicle tabs */}
          <View style={{ flexDirection: 'row', gap: 7, marginBottom: 18 }}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.75}
                style={{
                  flex: 1, alignItems: 'center',
                  paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12,
                  backgroundColor: activeTab === tab.id ? '#FFF0F4' : '#F8F8FD',
                  borderWidth: 1.5,
                  borderColor: activeTab === tab.id ? 'rgba(255,45,107,0.28)' : 'transparent',
                }}>
                <Text style={{ fontSize: 20, lineHeight: 24 }}>{tab.emoji}</Text>
                <Text style={{ fontSize: 9, fontWeight: '600', letterSpacing: 0.3, marginTop: 3, color: activeTab === tab.id ? C.pink : '#8A94B0' }}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Phone input */}
          <Text style={{ fontSize: 11, color: '#8A94B0', fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>MOBILE NUMBER</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#F8F8FD', borderWidth: 1.5, borderColor: '#ECEDF8', borderRadius: 12, paddingHorizontal: 13, height: 52 }}>
              <Text style={{ fontSize: 19 }}>🇮🇳</Text>
              <Text style={{ color: '#D4D8E8', fontSize: 17, fontWeight: '300' }}>|</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E2434' }}>+91</Text>
            </View>
            <TextInput
              style={{
                flex: 1, height: 52,
                backgroundColor: phone.length === 10 ? '#FFF5F8' : '#F8F8FD',
                borderWidth: 1.5,
                borderColor: phone.length === 10 ? 'rgba(255,45,107,0.4)' : '#ECEDF8',
                borderRadius: 12, paddingHorizontal: 16,
                fontSize: 16, fontWeight: '500', color: '#1E2434',
              }}
              placeholder="Enter 10-digit number"
              placeholderTextColor="#C4C8DC"
              keyboardType="numeric"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
            />
          </View>

          {result ? <Text style={{ color: C.pink, fontSize: 13, marginBottom: 10, textAlign: 'center', fontWeight: '700' }}>{result}</Text> : null}

          <Bouncy
            onPress={sendOtp}
            disabled={loading || phone.length < 10}
            style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 14, opacity: phone.length < 10 ? 0.5 : 1, elevation: phone.length === 10 ? 8 : 0, shadowColor: C.pink, shadowOpacity: 0.32, shadowRadius: 22 }}>
            <View style={{ backgroundColor: C.pink, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 }}>
                {loading ? 'Sending OTP...' : 'Send OTP →'}
              </Text>
            </View>
          </Bouncy>

          <Text style={{ fontSize: 10.5, color: '#8A94B0', textAlign: 'center', lineHeight: 18 }}>
            By continuing you agree to our{' '}
            <Text style={{ color: C.pink, fontWeight: '600' }}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={{ color: C.pink, fontWeight: '600' }}>Privacy Policy</Text>
          </Text>
        </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function OtpScreen() {
  const {
    phone,
    otp, setOtp,
    otpDigits, setOtpDigits,
    otpRefs,
    otpShakeAnim, otpSuccessAnim,
    otpSent,
    canResend, resendTimer,
    setCanResend, setResendTimer,
    result, setResult,
    loading,
    handleOtpChange, handleOtpKeyPress,
    verifyOtp, sendOtp,
    setScreen,
  } = useApp();

  const checkClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && /^\d{6}$/.test(text)) {
        const digits = text.split('');
        setOtpDigits(digits);
        setOtp(text);
        setTimeout(() => verifyOtp(text), 300);
      }
    } catch (_e) {}
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.night }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Dark hero */}
        <View style={{ alignItems: 'center', paddingTop: 64, paddingBottom: 32 }}>
          <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,45,120,0.06)', top: -20, left: -40 }} />
          <Animated.View style={{
            width: 84, height: 84, borderRadius: 24,
            backgroundColor: 'rgba(255,45,120,0.15)', borderWidth: 1.5, borderColor: C.pinkBorder,
            alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            shadowColor: C.pink, shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
            transform: [{ scale: otpSuccessAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
          }}>
            <Ionicons name="shield-checkmark" size={44} color={C.pink} />
          </Animated.View>
          <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>Verify OTP</Text>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13.5, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            6-digit code sent to{'\n'}
            <Text style={{ color: C.pink, fontWeight: '800' }}>+91 {phone}</Text>
          </Text>
        </View>

        {/* Card */}
        <View style={{
          backgroundColor: C.bgCard,
          borderTopLeftRadius: 32, borderTopRightRadius: 32,
          flex: 1, padding: 28, paddingBottom: 36,
          borderTopWidth: 1, borderColor: C.glassBorder,
        }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: C.textMuted, marginBottom: SP.md, letterSpacing: 1.5 }}>ENTER 6-DIGIT CODE</Text>

          <Animated.View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22, gap: 6, transform: [{ translateX: otpShakeAnim }] }}>
            {otpDigits.map((digit: string, i: number) => (
              <TextInput
                key={i}
                ref={(ref) => { otpRefs.current[i] = ref; }}
                style={{
                  flex: 1, height: 64, borderRadius: R.sm, textAlign: 'center', fontSize: 26, fontWeight: '900' as const,
                  borderWidth: 2.5, borderColor: digit ? C.pink : C.glassBorder,
                  backgroundColor: digit ? C.pinkGlass : C.glassMid, color: C.text,
                  elevation: digit ? 4 : 0, shadowColor: C.pink, shadowOpacity: digit ? 0.2 : 0, shadowRadius: 8,
                }}
                keyboardType="number-pad" maxLength={1} value={digit}
                onChangeText={(t) => handleOtpChange(t, i)}
                onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
              />
            ))}
          </Animated.View>

          <TouchableOpacity
            style={{ backgroundColor: C.glass, borderRadius: 12, padding: 13, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.glassBorder }}
            onPress={checkClipboard}>
            <Ionicons name="clipboard-outline" size={18} color={C.textMuted} />
            <Text style={{ fontSize: 13, color: C.text, fontWeight: '700' }}>Paste from clipboard</Text>
          </TouchableOpacity>

          {otpSent ? (
            <View style={{ backgroundColor: C.yellowGlass, borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.yellowBorder }}>
              <Text style={{ fontSize: 12, color: C.yellow, textAlign: 'center', marginBottom: 3 }}>Test OTP: <Text style={{ fontWeight: '900', letterSpacing: 5 }}>{otpSent}</Text></Text>
              <Text style={{ fontSize: 11, color: C.textMuted, textAlign: 'center' }}>Testing: <Text style={{ fontWeight: '800', letterSpacing: 3, color: C.yellow }}>000000</Text> works on any number</Text>
            </View>
          ) : null}

          {result ? <Text style={{ color: C.pink, fontSize: 13, marginBottom: 14, textAlign: 'center', fontWeight: '700' }}>{result}</Text> : null}

          <Bouncy
            style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 16, opacity: (loading || otpDigits.join('').length < 6) ? 0.5 : 1, elevation: 10, shadowColor: C.pink, shadowOpacity: 0.45, shadowRadius: 12 }}
            onPress={() => verifyOtp()} disabled={loading || otpDigits.join('').length < 6}>
            <View style={{ backgroundColor: C.pink, paddingVertical: 18, alignItems: 'center', borderRadius: 16 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </Text>
            </View>
          </Bouncy>

          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            {canResend ? (
              <TouchableOpacity onPress={async () => {
                setOtpDigits(['','','','','','']); setOtp(''); setResult('');
                setCanResend(false); setResendTimer(60);
                await sendOtp();
              }}>
                <Text style={{ color: C.pink, fontWeight: '800', fontSize: 14 }}>Resend OTP</Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ color: C.textMuted, fontSize: 13 }}>Resend in <Text style={{ color: C.pink, fontWeight: '700' }}>{resendTimer}s</Text></Text>
            )}
          </View>

          <TouchableOpacity onPress={() => setScreen('login')} style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Text style={{ color: C.textMuted, fontSize: 13 }}>Wrong number? <Text style={{ color: C.pink, fontWeight: '700' }}>Go back</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
