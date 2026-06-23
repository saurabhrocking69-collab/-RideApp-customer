import { ScrollView, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy } from '../components/ui';

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
    <Animated.View style={{ flex: 1, backgroundColor: '#0D0D1A', opacity: onboardFade }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingTop: 56, paddingBottom: 32, position: 'relative' }}>
          <View style={{ position: 'absolute', top: -20, left: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(233,69,96,0.06)', borderWidth: 1, borderColor: 'rgba(233,69,96,0.12)' }} />
          <View style={{ position: 'absolute', top: 30, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(147,51,234,0.07)', borderWidth: 1, borderColor: 'rgba(147,51,234,0.14)' }} />
          <Animated.View style={{ transform: [{ translateY: onboardSlide.interpolate({ inputRange: [0, 60], outputRange: [0, 60] }) }] }}>
            <View style={{ width: 90, height: 90, borderRadius: 28, backgroundColor: 'rgba(233,69,96,0.15)', borderWidth: 1.5, borderColor: 'rgba(233,69,96,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Ionicons name="happy" size={44} color="#e94560" />
            </View>
          </Animated.View>
          <Animated.View style={{ transform: [{ translateY: onboardSlide.interpolate({ inputRange: [0, 60], outputRange: [0, 40] }) }], alignItems: 'center' }}>
            <Text style={{ fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.8, textAlign: 'center' }}>Aapka Swagat Hai!</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13.5, marginTop: 8, textAlign: 'center', lineHeight: 21 }}>Bas thodi si jaankari do{'\n'}aur Sppero pe chalte hain 🚀</Text>
          </Animated.View>
        </View>

        <Animated.View style={{ backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, flex: 1, padding: 28, transform: [{ translateY: onboardSlide }] }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#e94560', marginBottom: 10, letterSpacing: 1.4 }}>AAPKA NAAM *</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: userName.trim() ? '#e94560' : '#ebebeb', borderRadius: 18, paddingHorizontal: 16, backgroundColor: userName.trim() ? '#fff5f6' : '#fafafa', marginBottom: 28 }}>
            <Text style={{ fontSize: 20, marginRight: 10 }}>✍️</Text>
            <TextInput
              style={{ flex: 1, fontSize: 16, fontWeight: '600', color: '#1a1a2e', paddingVertical: 16 }}
              placeholder="Apna naam likho..."
              placeholderTextColor="#ccc"
              value={userName}
              onChangeText={t => { setUserName(t); if (result) setResult(''); }}
              autoCapitalize="words"
            />
            {userName.trim() ? <Text style={{ fontSize: 18 }}>✅</Text> : null}
          </View>

          <Text style={{ fontSize: 11, fontWeight: '800', color: '#bbb', marginBottom: 12, letterSpacing: 1.4 }}>GENDER (OPTIONAL)</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
            {[
              { id: 'male',   icon: '👨', label: 'Male'   },
              { id: 'female', icon: '👩', label: 'Female' },
              { id: 'other',  icon: '🌈', label: 'Other'  },
            ].map(g => (
              <TouchableOpacity
                key={g.id}
                onPress={() => setGender(prev => prev === g.id ? '' : g.id as any)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 18,
                  backgroundColor: gender === g.id ? '#0D0D1A' : '#f5f5f5',
                  borderWidth: 2, borderColor: gender === g.id ? '#e94560' : '#ebebeb',
                  elevation: gender === g.id ? 4 : 0, shadowColor: '#e94560', shadowOpacity: 0.2, shadowRadius: 6 }}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>{g.icon}</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: gender === g.id ? '#fff' : '#888' }}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ backgroundColor: '#f0fdf4', borderRadius: 16, padding: 16, marginBottom: 28, borderWidth: 1, borderColor: '#bbf7d0', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Text style={{ fontSize: 22, marginTop: 1 }}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#166534', marginBottom: 4 }}>Aapki information safe hai</Text>
              <Text style={{ fontSize: 12, color: '#15803d', lineHeight: 18 }}>Hum aapki personal information kabhi third-party ke saath share nahi karte. Aapka data 100% secure aur encrypted hai.</Text>
            </View>
          </View>

          {result ? <Text style={{ color: '#e94560', fontSize: 13, marginBottom: 12, textAlign: 'center', fontWeight: '600' }}>{result}</Text> : null}

          <Bouncy onPress={completeOnboarding} disabled={loading || !userName.trim()} style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 12, elevation: 6, shadowColor: '#e94560', shadowOpacity: 0.3, shadowRadius: 10 }}>
            <View style={{ backgroundColor: userName.trim() ? '#e94560' : '#ccc', paddingVertical: 18, alignItems: 'center', borderRadius: 18 }}>
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0D0D1A' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View style={{ alignItems: 'center', paddingTop: 68, paddingBottom: 36, opacity: loginHeroAnim, transform: [{ translateY: loginHeroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>
          <View style={{ width: 100, height: 100, borderRadius: 30, backgroundColor: 'rgba(233,69,96,0.12)', borderWidth: 1.5, borderColor: 'rgba(233,69,96,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 22, shadowColor: '#e94560', shadowOpacity: 0.4, shadowRadius: 20 }}>
            <Ionicons name="car" size={50} color="#e94560" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 }}>
            <Text style={{ fontSize: 22, fontWeight: '300', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>Welcome to </Text>
            <Text style={{ fontSize: 38, fontWeight: '900', letterSpacing: -1 }}>
              <Text style={{ color: '#e94560' }}>Spp</Text>
              <Text style={{ color: '#fff' }}>ero</Text>
            </Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, letterSpacing: 0.2, textAlign: 'center', lineHeight: 22 }}>Lucknow ka sabse fast aur safe ride{'\n'}Aapka safar, aapke rules</Text>
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 24, opacity: 0.85 }}>
            {['🛺', '🏍️', '🚗', '🚙'].map((v, i) => (
              <View key={i} style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ fontSize: 24 }}>{v}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View style={{ backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, flex: 1, padding: 28, paddingBottom: 40, transform: [{ translateY: loginCardAnim }] }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: '#1a1a2e', marginBottom: 6, letterSpacing: -0.3 }}>Apna number daalo 📱</Text>
          <Text style={{ color: '#aaa', fontSize: 13.5, marginBottom: 24, lineHeight: 20 }}>Hum aapko OTP bhejenge — koi password nahi</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: phone.length === 10 ? '#e94560' : '#ebebeb', borderRadius: 18, paddingHorizontal: 16, backgroundColor: phone.length === 10 ? '#fff5f6' : '#fafafa', marginBottom: 22 }}>
            <View style={{ paddingRight: 12, borderRightWidth: 1.5, borderRightColor: '#ebebeb', marginRight: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#555' }}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={{ flex: 1, fontSize: 20, fontWeight: '700', color: '#1a1a2e', paddingVertical: 16, letterSpacing: 1.5 }}
              placeholder="XXXXXXXXXX"
              placeholderTextColor="#ddd"
              keyboardType="numeric"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
            />
            {phone.length === 10 && <Text style={{ fontSize: 20 }}>✅</Text>}
          </View>

          {result ? <Text style={{ color: '#e94560', fontSize: 13, marginBottom: 14, textAlign: 'center', fontWeight: '600' }}>{result}</Text> : null}

          <Bouncy
            onPress={sendOtp}
            disabled={loading || phone.length < 10}
            style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 18, opacity: phone.length < 10 ? 0.45 : 1, elevation: phone.length === 10 ? 8 : 0, shadowColor: '#e94560', shadowOpacity: 0.35, shadowRadius: 12 }}
          >
            <View style={{ backgroundColor: '#e94560', paddingVertical: 18, alignItems: 'center', borderRadius: 18 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>
                {loading ? '⏳ OTP bhej raha hai...' : 'OTP Bhejo 📱'}
              </Text>
            </View>
          </Bouncy>

          <Text style={{ color: '#ccc', fontSize: 11.5, textAlign: 'center', lineHeight: 18 }}>
            Continue karke aap hamare{' '}
            <Text style={{ color: '#e94560', fontWeight: '700' }}>Terms of Service</Text>
            {' '}aur{' '}
            <Text style={{ color: '#e94560', fontWeight: '700' }}>Privacy Policy</Text>
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0D0D1A' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingTop: 64, paddingBottom: 32 }}>
          <Animated.View style={{ width: 90, height: 90, borderRadius: 28, backgroundColor: 'rgba(233,69,96,0.12)', borderWidth: 1.5, borderColor: 'rgba(233,69,96,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, transform: [{ scale: otpSuccessAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }}>
            <Ionicons name="shield-checkmark" size={46} color="#e94560" />
          </Animated.View>
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>OTP Verify Karo</Text>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13.5, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            6-digit code bheja gaya{'\n'}
            <Text style={{ color: '#e94560', fontWeight: '800' }}>+91 {phone}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.45)' }}> pe 📱</Text>
          </Text>
        </View>

        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, flex: 1, padding: 28, paddingBottom: 36 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#bbb', marginBottom: 16, letterSpacing: 1.4 }}>6-DIGIT OTP DAALO</Text>

          <Animated.View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22, transform: [{ translateX: otpShakeAnim }] }}>
            {otpDigits.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => { otpRefs.current[i] = ref; }}
                style={{
                  width: 46, height: 58, borderRadius: 16, textAlign: 'center', fontSize: 24, fontWeight: '900',
                  borderWidth: 2.5, borderColor: digit ? '#e94560' : '#f0f0f0',
                  backgroundColor: digit ? '#fff5f6' : '#fafafa', color: '#1a1a2e',
                }}
                keyboardType="number-pad" maxLength={1} value={digit}
                onChangeText={(t) => handleOtpChange(t, i)}
                onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
              />
            ))}
          </Animated.View>

          <TouchableOpacity style={{ backgroundColor: '#f0f7ff', borderRadius: 14, padding: 13, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#dbeafe' }} onPress={checkClipboard}>
            <Text style={{ fontSize: 18 }}>📋</Text>
            <Text style={{ fontSize: 13, color: '#1565c0', fontWeight: '700' }}>Clipboard se paste karo</Text>
          </TouchableOpacity>

          <View style={{ backgroundColor: '#fff8f0', borderRadius: 14, padding: 12, marginBottom: 18, borderWidth: 1, borderColor: '#fde68a' }}>
            {otpSent ? (
              <Text style={{ fontSize: 12, color: '#92400e', textAlign: 'center', marginBottom: 4 }}>🧪 Test OTP: <Text style={{ fontWeight: '900', letterSpacing: 5 }}>{otpSent}</Text></Text>
            ) : null}
            <Text style={{ fontSize: 11, color: '#b45309', textAlign: 'center' }}>Testing: <Text style={{ fontWeight: '800', letterSpacing: 3 }}>000000</Text> kisi bhi number pe kaam karta hai</Text>
          </View>

          {result ? <Text style={{ color: '#e94560', fontSize: 13, marginBottom: 14, textAlign: 'center', fontWeight: '600' }}>{result}</Text> : null}

          <Bouncy
            style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 16, opacity: (loading || otpDigits.join('').length < 6) ? 0.5 : 1, elevation: 6, shadowColor: '#e94560', shadowOpacity: 0.3, shadowRadius: 10 }}
            onPress={() => verifyOtp()} disabled={loading || otpDigits.join('').length < 6}>
            <View style={{ backgroundColor: '#e94560', paddingVertical: 18, alignItems: 'center', borderRadius: 18 }}>
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
                <Text style={{ color: '#e94560', fontWeight: '800', fontSize: 14 }}>🔄 OTP Dobara Bhejo</Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ color: '#bbb', fontSize: 13 }}><Text style={{ color: '#e94560', fontWeight: '700' }}>{resendTimer}s</Text> mein dobara bhej sakte ho</Text>
            )}
          </View>

          <TouchableOpacity onPress={() => setScreen('login')} style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Text style={{ color: '#bbb', fontSize: 13 }}>✏️ Number badalna hai? <Text style={{ color: '#e94560', fontWeight: '700' }}>Wapas jao</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
