import { ScrollView, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Animated } from 'react-native';
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
  const {
    loginHeroAnim, loginCardAnim,
    phone, setPhone,
    result,
    loading,
    sendOtp,
  } = useApp();

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.night }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Dark hero zone */}
        <Animated.View style={{
          alignItems: 'center', paddingTop: 72, paddingBottom: 40,
          opacity: loginHeroAnim,
          transform: [{ translateY: loginHeroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        }}>
          {/* Ambient glow */}
          <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,45,120,0.07)', top: -40, right: -60 }} />

          {/* Logomark */}
          <View style={{
            width: 88, height: 88, borderRadius: 26,
            backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
            shadowColor: C.pink, shadowOpacity: 0.5, shadowRadius: 28, shadowOffset: { width: 0, height: 6 },
            elevation: 18,
          }}>
            <Text style={{ fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: -2 }}>S</Text>
          </View>

          <Text style={{ fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 8 }}>
            Welcome to <Text style={{ color: C.pink }}>Sppero</Text>
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, letterSpacing: 0.2, textAlign: 'center', lineHeight: 22 }}>
            India's fastest and safest ride
          </Text>

          {/* Vehicle chips */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 28 }}>
            {[
              { e: '🛺', bg: C.pinkGlass,   border: C.pinkBorder   },
              { e: '🏍️', bg: C.saffGlass,   border: C.saffBorder   },
              { e: '🚗', bg: C.plumGlass,   border: C.plumBorder   },
              { e: '🚙', bg: C.purpleGlass, border: C.purpleBorder },
            ].map(({ e, bg, border }, i) => (
              <View key={i} style={{
                flex: 1, backgroundColor: bg,
                borderRadius: R.md, paddingVertical: 12,
                alignItems: 'center', borderWidth: 1.5, borderColor: border,
              }}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Card sheet */}
        <Animated.View style={{
          backgroundColor: C.bgCard,
          borderTopLeftRadius: 32, borderTopRightRadius: 32,
          flex: 1, padding: 28, paddingBottom: 40,
          borderTopWidth: 1, borderColor: C.glassBorder,
          transform: [{ translateY: loginCardAnim }],
        }}>
          <Text style={{ ...T.headline, color: C.text, marginBottom: 6 }}>Enter your number</Text>
          <Text style={{ ...T.body, color: C.textMuted, marginBottom: SP.lg }}>We'll send you a one-time code — no password needed</Text>

          <View style={{
            flexDirection: 'row', alignItems: 'center',
            borderWidth: 2, borderColor: phone.length === 10 ? C.pink : C.glassBorder,
            borderRadius: 16, paddingHorizontal: 16,
            backgroundColor: phone.length === 10 ? C.pinkGlass : C.glass,
            marginBottom: 22,
          }}>
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
            {phone.length === 10 && <Ionicons name="checkmark-circle" size={22} color={C.pink} />}
          </View>

          {result ? <Text style={{ color: C.pink, fontSize: 13, marginBottom: 14, textAlign: 'center', fontWeight: '700' }}>{result}</Text> : null}

          <Bouncy
            onPress={sendOtp}
            disabled={loading || phone.length < 10}
            style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 18, opacity: phone.length < 10 ? 0.45 : 1, elevation: phone.length === 10 ? 6 : 0, shadowColor: C.pink, shadowOpacity: 0.25, shadowRadius: 8 }}>
            <View style={{ backgroundColor: C.pink, paddingVertical: 18, alignItems: 'center', borderRadius: 16 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </Text>
            </View>
          </Bouncy>

          <Text style={{ color: C.textDim, fontSize: 11.5, textAlign: 'center', lineHeight: 18 }}>
            By continuing you agree to our{' '}
            <Text style={{ color: C.pink, fontWeight: '700' }}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={{ color: C.pink, fontWeight: '700' }}>Privacy Policy</Text>
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
