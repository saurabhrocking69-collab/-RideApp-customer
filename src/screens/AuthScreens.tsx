import { ScrollView, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy, DotBG } from '../components/ui';
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
    <Animated.View style={{ flex: 1, backgroundColor: C.bg, opacity: onboardFade }}>
      <DotBG />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingTop: 56, paddingBottom: 32, position: 'relative' }}>
          <View style={{ position: 'absolute', top: -20, left: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: C.pinkGlass, borderWidth: 1, borderColor: C.pinkBorder }} />
          <View style={{ position: 'absolute', top: 30, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,215,0,0.07)', borderWidth: 1, borderColor: C.yellowBorder }} />
          <Animated.View style={{ transform: [{ translateY: onboardSlide.interpolate({ inputRange: [0, 60], outputRange: [0, 60] }) }] }}>
            <View style={{ width: 96, height: 96, borderRadius: 30, backgroundColor: C.pinkGlass, borderWidth: 1.5, borderColor: C.pinkBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 20, elevation: 8, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 20 }}>
              <Ionicons name="happy" size={48} color={C.pink} />
            </View>
          </Animated.View>
          <Animated.View style={{ transform: [{ translateY: onboardSlide.interpolate({ inputRange: [0, 60], outputRange: [0, 40] }) }], alignItems: 'center' }}>
            <Text style={{ fontSize: 30, fontWeight: '900', color: C.text, letterSpacing: -0.8, textAlign: 'center' }}>Aapka Swagat Hai!</Text>
            <Text style={{ color: C.textMuted, fontSize: 13.5, marginTop: 8, textAlign: 'center', lineHeight: 21 }}>Bas thodi si jaankari do{'\n'}aur Sppero pe chalte hain 🚀</Text>
          </Animated.View>
        </View>

        <Animated.View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 36, borderTopRightRadius: 36, flex: 1, padding: 28, borderTopWidth: 1, borderColor: C.glassBorder, transform: [{ translateY: onboardSlide }] }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: C.pink, marginBottom: 12, letterSpacing: 1.4 }}>AAPKA NAAM *</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: userName.trim() ? C.pink : C.glassBorder, borderRadius: 18, paddingHorizontal: 16, backgroundColor: userName.trim() ? C.pinkGlass : C.glass, marginBottom: 28 }}>
            <Text style={{ fontSize: 20, marginRight: 10 }}>✍️</Text>
            <TextInput
              style={{ flex: 1, fontSize: 16, fontWeight: '600', color: C.text, paddingVertical: 16 }}
              placeholder="Apna naam likho..."
              placeholderTextColor={C.textDim}
              value={userName}
              onChangeText={t => { setUserName(t); if (result) setResult(''); }}
              autoCapitalize="words"
            />
            {userName.trim() ? <Text style={{ fontSize: 18 }}>✅</Text> : null}
          </View>

          <Text style={{ fontSize: 11, fontWeight: '800', color: C.textMuted, marginBottom: 12, letterSpacing: 1.4 }}>GENDER (OPTIONAL)</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
            {[
              { id: 'male',   icon: '👨', label: 'Male'   },
              { id: 'female', icon: '👩', label: 'Female' },
              { id: 'other',  icon: '🌈', label: 'Other'  },
            ].map(g => (
              <TouchableOpacity
                key={g.id}
                onPress={() => setGender((prev: any) => prev === g.id ? '' : g.id)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 18,
                  backgroundColor: gender === g.id ? C.pinkGlass : C.glass,
                  borderWidth: 2, borderColor: gender === g.id ? C.pink : C.glassBorder,
                  elevation: gender === g.id ? 6 : 0, shadowColor: C.pink, shadowOpacity: 0.3, shadowRadius: 8 }}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>{g.icon}</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: gender === g.id ? C.pink : C.textMuted }}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ backgroundColor: C.greenGlass, borderRadius: 16, padding: 16, marginBottom: 28, borderWidth: 1, borderColor: C.greenBorder, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Text style={{ fontSize: 22, marginTop: 1 }}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.green, marginBottom: 4 }}>Aapki information safe hai</Text>
              <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 18 }}>Hum aapki personal information kabhi third-party ke saath share nahi karte. Aapka data 100% secure aur encrypted hai.</Text>
            </View>
          </View>

          {result ? <Text style={{ color: C.pink, fontSize: 13, marginBottom: 12, textAlign: 'center', fontWeight: '700' }}>{result}</Text> : null}

          <Bouncy onPress={completeOnboarding} disabled={loading || !userName.trim()} style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 12, elevation: 10, shadowColor: C.pink, shadowOpacity: 0.5, shadowRadius: 12 }}>
            <View style={{ backgroundColor: userName.trim() ? C.pink : C.glass, paddingVertical: 18, alignItems: 'center', borderRadius: 18, borderWidth: userName.trim() ? 0 : 1, borderColor: C.glassBorder }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 }}>
                {loading ? '⏳ Saving...' : '✨ Chalte Hain!'}
              </Text>
            </View>
          </Bouncy>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

export function LoginScreen() {
  const {
    loginHeroAnim, loginCardAnim,
    phone, setPhone,
    result,
    loading,
    sendOtp,
  } = useApp();

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DotBG />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View style={{ alignItems: 'center', paddingTop: 68, paddingBottom: 36, opacity: loginHeroAnim, transform: [{ translateY: loginHeroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>
          <View style={{ width: 104, height: 104, borderRadius: 32, backgroundColor: C.pinkGlass, borderWidth: 1.5, borderColor: C.pinkBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 22, elevation: 5, shadowColor: C.pink, shadowOpacity: 0.18, shadowRadius: 10 }}>
            <Ionicons name="car" size={52} color={C.pink} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 }}>
            <Text style={{ fontSize: 22, fontWeight: '300', color: C.textMuted, letterSpacing: 0.5 }}>Welcome to </Text>
            <Text style={{ fontSize: 38, fontWeight: '900', letterSpacing: -1 }}>
              <Text style={{ color: C.pink }}>Spp</Text>
              <Text style={{ color: C.text }}>ero</Text>
            </Text>
          </View>
          <Text style={{ color: C.textMuted, fontSize: 14, letterSpacing: 0.2, textAlign: 'center', lineHeight: 22 }}>India ka sabse fast aur safe ride 🇮🇳{'\n'}Aapka safar, aapke rules</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
            {[
              { e: '🛺', bg: C.pinkGlass,   border: C.pinkBorder   },
              { e: '🏍️', bg: C.saffGlass,   border: C.saffBorder   },
              { e: '🚗', bg: C.plumGlass,   border: C.plumBorder   },
              { e: '🚙', bg: C.purpleGlass, border: C.purpleBorder },
            ].map(({ e, bg, border }, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: bg, borderRadius: R.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: border, elevation: 3, shadowColor: C.plum, shadowOpacity: 0.08, shadowRadius: 6 }}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 36, borderTopRightRadius: 36, flex: 1, padding: 28, paddingBottom: 40, borderTopWidth: 1, borderColor: C.glassBorder, transform: [{ translateY: loginCardAnim }] }}>
          <Text style={{ ...T.headline, color: C.text, marginBottom: 6 }}>Apna number daalo 📱</Text>
          <Text style={{ ...T.body, color: C.textMuted, marginBottom: SP.lg }}>Hum aapko OTP bhejenge — koi password nahi</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: phone.length === 10 ? C.pink : C.glassBorder, borderRadius: 18, paddingHorizontal: 16, backgroundColor: phone.length === 10 ? C.pinkGlass : C.glass, marginBottom: 22 }}>
            <View style={{ paddingRight: 12, borderRightWidth: 1.5, borderRightColor: C.glassBorder, marginRight: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.textMuted }}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={{ flex: 1, fontSize: 20, fontWeight: '700', color: C.text, paddingVertical: 16, letterSpacing: 1.5 }}
              placeholder="XXXXXXXXXX"
              placeholderTextColor={C.textDim}
              keyboardType="numeric"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
            />
            {phone.length === 10 && <Text style={{ fontSize: 20 }}>✅</Text>}
          </View>

          {result ? <Text style={{ color: C.pink, fontSize: 13, marginBottom: 14, textAlign: 'center', fontWeight: '700' }}>{result}</Text> : null}

          <Bouncy
            onPress={sendOtp}
            disabled={loading || phone.length < 10}
            style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 18, opacity: phone.length < 10 ? 0.45 : 1, elevation: phone.length === 10 ? 6 : 0, shadowColor: C.pink, shadowOpacity: 0.25, shadowRadius: 8 }}
          >
            <View style={{ backgroundColor: C.pink, paddingVertical: 18, alignItems: 'center', borderRadius: 18 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>
                {loading ? '⏳ OTP bhej raha hai...' : 'OTP Bhejo 📱'}
              </Text>
            </View>
          </Bouncy>

          <Text style={{ color: C.textDim, fontSize: 11.5, textAlign: 'center', lineHeight: 18 }}>
            Continue karke aap hamare{' '}
            <Text style={{ color: C.pink, fontWeight: '700' }}>Terms of Service</Text>
            {' '}aur{' '}
            <Text style={{ color: C.pink, fontWeight: '700' }}>Privacy Policy</Text>
            {' '}se agree karte hain
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DotBG />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingTop: 64, paddingBottom: 32 }}>
          <Animated.View style={{ width: 96, height: 96, borderRadius: 30, backgroundColor: C.pinkGlass, borderWidth: 1.5, borderColor: C.pinkBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 20, elevation: 10, shadowColor: C.pink, shadowOpacity: 0.45, shadowRadius: 18, transform: [{ scale: otpSuccessAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }}>
            <Ionicons name="shield-checkmark" size={48} color={C.pink} />
          </Animated.View>
          <Text style={{ fontSize: 28, fontWeight: '900', color: C.text, letterSpacing: -0.5 }}>OTP Verify Karo</Text>
          <Text style={{ color: C.textMuted, fontSize: 13.5, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            6-digit code bheja gaya{'\n'}
            <Text style={{ color: C.pink, fontWeight: '800' }}>+91 {phone}</Text>
            <Text style={{ color: C.textMuted }}> pe 📱</Text>
          </Text>
        </View>

        <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 36, borderTopRightRadius: 36, flex: 1, padding: 28, paddingBottom: 36, borderTopWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ ...T.label, color: C.textMuted, marginBottom: SP.md }}>6-DIGIT OTP DAALO</Text>

          <Animated.View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22, gap: 6, transform: [{ translateX: otpShakeAnim }] }}>
            {otpDigits.map((digit: string, i: number) => (
              <TextInput
                key={i}
                ref={(ref) => { otpRefs.current[i] = ref; }}
                style={{
                  flex: 1, height: 68, borderRadius: R.sm, textAlign: 'center', fontSize: 28, fontWeight: '900' as const,
                  borderWidth: 2.5, borderColor: digit ? C.pink : C.glassBorder,
                  backgroundColor: digit ? C.pinkGlass : C.glassMid, color: C.text,
                  elevation: digit ? 4 : 0, shadowColor: C.pink, shadowOpacity: digit ? 0.22 : 0, shadowRadius: 8,
                }}
                keyboardType="number-pad" maxLength={1} value={digit}
                onChangeText={(t) => handleOtpChange(t, i)}
                onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
              />
            ))}
          </Animated.View>

          <TouchableOpacity style={{ backgroundColor: C.glass, borderRadius: 14, padding: 13, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.glassBorder }} onPress={checkClipboard}>
            <Text style={{ fontSize: 18 }}>📋</Text>
            <Text style={{ fontSize: 13, color: C.text, fontWeight: '700' }}>Clipboard se paste karo</Text>
          </TouchableOpacity>

          <View style={{ backgroundColor: C.yellowGlass, borderRadius: 14, padding: 12, marginBottom: 18, borderWidth: 1, borderColor: C.yellowBorder }}>
            {otpSent ? (
              <Text style={{ fontSize: 12, color: C.yellow, textAlign: 'center', marginBottom: 4 }}>🧪 Test OTP: <Text style={{ fontWeight: '900', letterSpacing: 5 }}>{otpSent}</Text></Text>
            ) : null}
            <Text style={{ fontSize: 11, color: C.textMuted, textAlign: 'center' }}>Testing: <Text style={{ fontWeight: '800', letterSpacing: 3, color: C.yellow }}>000000</Text> kisi bhi number pe kaam karta hai</Text>
          </View>

          {result ? <Text style={{ color: C.pink, fontSize: 13, marginBottom: 14, textAlign: 'center', fontWeight: '700' }}>{result}</Text> : null}

          <Bouncy
            style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 16, opacity: (loading || otpDigits.join('').length < 6) ? 0.5 : 1, elevation: 10, shadowColor: C.pink, shadowOpacity: 0.5, shadowRadius: 12 }}
            onPress={() => verifyOtp()} disabled={loading || otpDigits.join('').length < 6}>
            <View style={{ backgroundColor: C.pink, paddingVertical: 18, alignItems: 'center', borderRadius: 18 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>
                {loading ? '⏳ Verify ho raha hai...' : '✅ OTP Verify Karo'}
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
                <Text style={{ color: C.pink, fontWeight: '800', fontSize: 14 }}>🔄 OTP Dobara Bhejo</Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ color: C.textMuted, fontSize: 13 }}><Text style={{ color: C.pink, fontWeight: '700' }}>{resendTimer}s</Text> mein dobara bhej sakte ho</Text>
            )}
          </View>

          <TouchableOpacity onPress={() => setScreen('login')} style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Text style={{ color: C.textMuted, fontSize: 13 }}>✏️ Number badalna hai? <Text style={{ color: C.pink, fontWeight: '700' }}>Wapas jao</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
