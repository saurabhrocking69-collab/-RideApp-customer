import { useState, useRef, useEffect } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Animated, useWindowDimensions, Linking, Image } from 'react-native';
import Svg, { Rect, Path, Circle, Ellipse, Defs, LinearGradient, RadialGradient, Stop, G, Polygon, Line, Text as SvgText } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Bouncy } from '../components/ui';
import { C, T, SP, R } from '../styles';
import { GOOGLE_WEB_CLIENT_ID } from '../constants';

export function OnboardingScreen() {
  const {
    onboardFade, onboardSlide,
    userName, setUserName,
    gender, setGender,
    result, setResult,
    loading,
    completeOnboarding,
    googleEmail,
  } = useApp();
  /* Naam Google se aaya hai, ye batana zaroori hai.

     Bina bataye ek bhara hua khaana dekh kar aadmi maan leta hai ki wo tay ho
     chuka hai aur aage badh jaata hai. Ek chhoti si line use ye batati hai ki
     naam kahan se aaya aur wo use badal sakta hai - kyoki yahi naam driver ko
     sadak par dikhega. */
  const fromGoogle = !!googleEmail && !!userName;

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

          {/* Bhara hua khaana bina bataye chhod dena aadmi ko ye maanne deta hai
              ki naam tay ho chuka hai. Ye line batati hai ki wo aaya kahan se
              aur badla ja sakta hai - aur kyu ye maayne rakhta hai. */}
          {fromGoogle ? (
            <Text style={{ fontSize: 11.5, color: C.textMuted, marginTop: -20, marginBottom: 22, lineHeight: 17 }}>
              Google se liya hai — badal sakte hain. Yahi naam aapka driver dhoondhega.
            </Text>
          ) : null}

          <Text style={{ fontSize: 10, fontWeight: '800', color: C.textMuted, marginBottom: 12, letterSpacing: 1.4 }}>GENDER (OPTIONAL)</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
            {/* `as const` keeps each id as its literal type — without it they
                widen to `string` and the tap handler no longer typechecks
                against the gender union. */}
            {([
              { id: 'male',   icon: 'male',   label: 'Male'   },
              { id: 'female', icon: 'female', label: 'Female' },
              { id: 'other',  icon: 'ellipsis-horizontal', label: 'Other' },
            ] as const).map(g => (
              <TouchableOpacity
                key={g.id}
                onPress={() => setGender(prev => prev === g.id ? '' : g.id)}
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
  const { loginHeroAnim, loginCardAnim, phone, setPhone, result, loading, sendOtp, rideType, setRideType,
          signInWithGoogle } = useApp();


  const { width: W } = useWindowDimensions();
  /* Hero ki unchai ab tasveer ke apne anupaat par (1170x653). Pehle ye
     476/390 thi kyoki wahan haath se banayi khadi SVG thi. Us naap me
     is chaudi rachna ko daalne par car aur auto dono kinare se kat
     jaate - yaani wahi teen cheezein jo dikhani hain. */
  const IH = W * (760 / 1170);
  const S  = W / 390;

  /* Yahan teen anant Animated.loop chalte the - ek udta hua pin, aur do
     phailti hui halka. Teenon us haath se banayi SVG ke hisse the. SVG ki
     jagah tasveer aa gayi, par loop chalte rah gaye the: kuch hilate nahi
     the, sirf har frame par kaam karte the. Login ka panna wahi hai jahan
     app khulte hi aata hai, to ye kharch har baar hota. */

  const TABS = [
    { id: 'auto',  emoji: '🛺', label: 'Auto'      },
    { id: 'bike',  emoji: '🏍️', label: 'Bike'      },
    { id: 'car',   emoji: '🚕', label: '5 Seater' },
    { id: 'car_7', emoji: '🚐', label: '7 Seater' },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FAFBFF' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Illustration ── */}
        <Animated.View style={{ opacity: loginHeroAnim }}>
          <View style={{ height: IH, overflow: 'hidden' }}>

            {/* Ek 3D gali, jisme teenon gaadiyan hain jo Sppero par milti
                hain - car, scooter aur auto. Pehle yahan haath se banayi ek
                SVG thi (390x476, khadi); ye rachna CHAUDI hai, isliye hero
                ki unchai bhi uske hisaab se hai - warna car aur auto dono
                kinare se kat jaate.

                Teen daag hataye gaye the: auto par do bemtlab shabd ("7UCCO",
                "TUCCO" - kisi aur brand jaise dikhte the) aur car par Tesla
                ka nishaan, jo kisi aur ka trademark hai. "SPPERO" jaisa tha
                waisa hai. */}
            <Image
              source={require('../../assets/login-hero.jpg')}
              style={{ width: W, height: IH }}
              resizeMode="cover"
              accessibilityLabel="A Sppero car, scooter and auto waiting on a city street"
            />

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

          {/* ── Which do you usually take ────────────────────────────────
              This row looked exactly like a picker and picked nothing: it set
              a local `activeTab` that only coloured itself in, and the choice
              died with the screen. Someone tapped Bike, watched it highlight,
              and got Auto on the booking screen a moment later.

              It is real now. `rideType` is the same sticky selection the
              booking screen reads, so the vehicle chosen here is the one that
              is already selected when the map opens. The ids and icons come
              from the app's own RIDES catalogue rather than a second private
              list — the old one offered "Sedan" and "SUV", which are not
              vehicles this platform has ever run. */}
          <Text style={{ fontSize: 11, color: '#8A94B0', fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
            WHICH DO YOU USUALLY TAKE?
          </Text>
          <View style={{ flexDirection: 'row', gap: 7, marginBottom: 18 }}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setRideType(tab.id)}
                activeOpacity={0.75}
                style={{
                  flex: 1, alignItems: 'center',
                  paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12,
                  backgroundColor: rideType === tab.id ? '#FFF0F4' : '#F8F8FD',
                  borderWidth: 1.5,
                  borderColor: rideType === tab.id ? 'rgba(255,45,107,0.28)' : 'transparent',
                }}>
                <Text style={{ fontSize: 20, lineHeight: 24 }}>{tab.emoji}</Text>
                <Text style={{ fontSize: 9, fontWeight: '600', letterSpacing: 0.3, marginTop: 3, color: rideType === tab.id ? C.pink : '#8A94B0' }}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Phone input */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 11, color: '#8A94B0', fontWeight: '700', letterSpacing: 0.5 }}>MOBILE NUMBER</Text>
            {phone.length === 10 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="checkmark-circle" size={13} color="#12B76A" />
                <Text style={{ fontSize: 10.5, color: '#12B76A', fontWeight: '700' }}>Looks right</Text>
              </View>
            ) : null}
          </View>
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
          {/* Google, OTP ke NEECHE - upar nahi.

              Number se aana abhi bhi mukhya rasta hai: wahi number driver
              call karta hai, aur wahi saabit hota hai. Google us aadmi ke
              liye hai jiske paas OTP nahi pahunch raha - aaj sab ke paas
              nahi pahunch raha, kyoki koi SMS provider hai hi nahi.

              Client id na hone par button dikhta hi nahi: ek button jo
              dabane par kuch na kare, na hone se bura hai. */}
          {!!GOOGLE_WEB_CLIENT_ID && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.10)' }} />
                <Text style={{ marginHorizontal: 12, fontSize: 12, color: '#8A8A8A', fontWeight: '600' }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.10)' }} />
              </View>
              <Bouncy
                onPress={signInWithGoogle}
                disabled={loading}
                style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 14, opacity: loading ? 0.6 : 1 }}>
                <View style={{ backgroundColor: '#fff', height: 54, borderRadius: 14, borderWidth: 1.5,
                               borderColor: 'rgba(0,0,0,0.12)', flexDirection: 'row',
                               alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#4285F4' }}>G</Text>
                  <Text style={{ color: '#1F1F1F', fontSize: 15.5, fontWeight: '700' }}>Continue with Google</Text>
                </View>
              </Bouncy>
            </>
          )}

          <Text style={{ fontSize: 10.5, color: '#8A94B0', textAlign: 'center', lineHeight: 18 }}>
            By continuing you agree to our{' '}
            <Text style={{ color: C.pink, fontWeight: '600' }} onPress={() => Linking.openURL('https://api.sppero.com/terms')}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={{ color: C.pink, fontWeight: '600' }} onPress={() => Linking.openURL('https://api.sppero.com/privacy')}>Privacy Policy</Text>
          </Text>
        </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── Verification ────────────────────────────────────────────────────────
   This screen used to be dark (C.night) while the login screen it follows is
   bright and hand-illustrated. Tapping a button on a sunlit screen and landing
   somewhere black reads as two different apps bolted together, and that break
   lands at the exact moment a first-time rider is deciding whether to trust
   this thing with their phone number. It is one continuous flow now: same
   ground, same type, same pink, with a compact header instead of a full second
   hero. */
export function OtpScreen() {
  const {
    phone,
    otpDigits, setOtpDigits, setOtp,
    otpRefs, otpShakeAnim,
    canResend, resendTimer, setCanResend, setResendTimer,
    result, setResult,
    loading,
    handleOtpChange, handleOtpKeyPress,
    verifyOtp, sendOtp,
    setScreen,
  } = useApp();

  const filled = otpDigits.filter((d: string) => d !== '').length;
  const complete = filled === 6;
  // 98765 43210 — the way the number is actually said out loud, so someone
  // checking they typed the right one can scan it in two glances, not ten.
  const pretty = phone.length === 10 ? phone.slice(0, 5) + ' ' + phone.slice(5) : phone;

  /* The keyboard should already be up. Every extra tap here is a tap on the
     one screen where the user has nothing to decide and only wants to be
     through it. */
  useEffect(() => {
    const t = setTimeout(() => otpRefs.current[0]?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const paste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && /^\d{6}$/.test(text)) {
        /* Bhara jaata hai, BHEJA nahi jaata - aur ye farq maayne rakhta hai.

           App ye jaan hi nahi sakti ki clipboard me pada 6-ank ka code aaj ka
           hai ya kal ka. Android ki OTP soochna me "copy" ka bataan hota hai,
           to purana code wahan pada reh jaata hai. Ek baar aisa hi hua: asli
           OTP 650838 tha, clipboard me 130621 pada tha, aur button ne use
           chupchaap bhej diya - ek koshish jal gayi ("2 attempts remaining").
           Teen galat par khaata aadhe ghante ke liye band ho jaata hai.

           Ab ank saamne dikhte hain aur bhejna aadmi ke haath me hai - wo SMS
           se milakar dekh sakta hai. Suvidha wahi rehti hai, nuksaan chala
           jaata hai. */
        setOtpDigits(text.split('')); setOtp(text);
        setResult('Pasted — check it matches the SMS, then tap Verify');
      } else {
        /* Pehle yahan sirf "No 6-digit code found in your clipboard" tha.
           Baat sach thi par bekaar: SMS ka code clipboard me jaata hi nahi
           jab tak koi use khud copy na kare, to ye button lagbhag hamesha
           yahi kehta tha - aur padhne wale ko lagta tha ki app kharab hai.
           Ab wo batata hai ki code asal me kahan milega. */
        setResult('Nothing copied yet — when the SMS arrives, tap the code shown just above your keyboard');
      }
    } catch (_e) {}
  };

  const resend = async () => {
    setOtpDigits(['', '', '', '', '', '']); setOtp(''); setResult('');
    setCanResend(false); setResendTimer(60);
    otpRefs.current[0]?.focus();
    await sendOtp();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FAFBFF' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Back, and where you are. Two dots rather than "Step 2 of 2" because
            the flow is short enough that the words cost more than they explain. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 52, paddingBottom: 4 }}>
          <TouchableOpacity
            onPress={() => setScreen('login')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEDF8', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={20} color="#1E2434" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 18, height: 5, borderRadius: 3, backgroundColor: '#DDE1F0' }} />
            <View style={{ width: 18, height: 5, borderRadius: 3, backgroundColor: C.pink }} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 26 }}>

          <View style={{
            width: 62, height: 62, borderRadius: 20, marginBottom: 20,
            backgroundColor: '#FFF0F5', borderWidth: 1.5, borderColor: 'rgba(255,45,120,0.20)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="chatbubble-ellipses" size={28} color={C.pink} />
          </View>

          <Text style={{ fontSize: 28, fontWeight: '900', color: '#1E2434', letterSpacing: -0.7 }}>
            Enter the code
          </Text>

          {/* The number and the way to fix it sit together. Someone who mistyped
              a digit should not have to guess that "back" is how you correct it. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 9, marginBottom: 26 }}>
            <Text style={{ fontSize: 13.5, color: '#8A94B0' }}>We sent 6 digits to </Text>
            <Text style={{ fontSize: 13.5, color: '#1E2434', fontWeight: '800' }}>+91 {pretty}</Text>
            <TouchableOpacity onPress={() => setScreen('login')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 13.5, color: C.pink, fontWeight: '800' }}>  Change</Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, transform: [{ translateX: otpShakeAnim }] }}>
            {otpDigits.map((digit: string, i: number) => {
              const active = !digit && i === filled;   // the box being typed into
              return (
                <TextInput
                  key={i}
                  ref={(ref) => { otpRefs.current[i] = ref; }}
                  style={{
                    flex: 1, height: 66, borderRadius: 16, textAlign: 'center',
                    fontSize: 27, fontWeight: '900' as const, color: '#1E2434',
                    backgroundColor: digit ? '#FFF0F5' : '#FFFFFF',
                    borderWidth: 2,
                    borderColor: digit ? C.pink : active ? 'rgba(255,45,120,0.45)' : '#E6E9F5',
                    shadowColor: digit || active ? C.pink : '#8A94B0',
                    shadowOpacity: digit ? 0.18 : active ? 0.12 : 0.05,
                    shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
                    elevation: digit ? 3 : 1,
                  }}
                  keyboardType="number-pad"
                  /* Pehla khaana poora code le sakta hai.

                     maxLength 1 rakhne par Android ka autofill jo 6 ank bhejta
                     hai wo pehle hi kat kar 1 ank ka reh jaata - onChangeText
                     tak poora code pahunchta hi nahi. Isliye pehle khaane ki
                     hadd 6 hai; handleOtpChange use chhah khaano me baant deta
                     hai. Baaki khaane waise hi ek-ank ke rehte hain. */
                  maxLength={i === 0 ? 6 : 1} value={digit}
                  /* Keyboard ke uper "628157" ka sujhaav - bina kisi permission
                     ke, aur kisi bhi SMS ke roop par chalta hai. Ek tap me
                     bhar jaata hai. Bilkul apne aap bharne (SMS Retriever) ke
                     liye app me ek native module aur SMS ke ant me app-hash
                     wala apna DLT template chahiye - wo alag kaam hai. */
                  autoComplete={i === 0 ? 'sms-otp' : 'off'}
                  textContentType={i === 0 ? 'oneTimeCode' : 'none'}
                  importantForAutofill={i === 0 ? 'yes' : 'no'}
                  onChangeText={(t) => handleOtpChange(t, i)}
                  onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                  selectTextOnFocus
                />
              );
            })}
          </Animated.View>

          {result ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16 }}>
              <Ionicons name="alert-circle" size={15} color={C.pink} />
              <Text style={{ flex: 1, color: C.pink, fontSize: 12.5, fontWeight: '700', lineHeight: 18 }}>
                {String(result).replace('❌ ', '')}
              </Text>
            </View>
          ) : null}

          {/* The button says what is missing rather than sitting there greyed
              and mute — "Enter 2 more digits" answers the only question a
              stuck user has. */}
          <Bouncy
            onPress={() => verifyOtp()}
            disabled={loading || !complete}
            style={{ borderRadius: 16, overflow: 'hidden', marginTop: 22, opacity: (loading || !complete) ? 0.45 : 1, elevation: complete ? 9 : 0, shadowColor: C.pink, shadowOpacity: complete ? 0.35 : 0, shadowRadius: 16 }}>
            <View style={{ backgroundColor: C.pink, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.2 }}>
                {loading ? 'Verifying…' : complete ? 'Verify & continue' : 'Enter ' + (6 - filled) + ' more digit' + (6 - filled === 1 ? '' : 's')}
              </Text>
            </View>
          </Bouncy>

          <View style={{ height: 1, backgroundColor: '#ECEDF8', marginTop: 26, marginBottom: 18 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 }}>
            <Text style={{ fontSize: 13, color: '#8A94B0' }}>Code not arrived?</Text>
            {canResend ? (
              <TouchableOpacity onPress={resend} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 13, color: C.pink, fontWeight: '800' }}>Send again</Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ fontSize: 13, color: '#1E2434', fontWeight: '700' }}>Send again in {resendTimer}s</Text>
            )}
          </View>

          <TouchableOpacity
            onPress={paste}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEDF8' }}>
            <Ionicons name="clipboard-outline" size={16} color="#8A94B0" />
            <Text style={{ fontSize: 13, color: '#1E2434', fontWeight: '700' }}>Paste from clipboard</Text>
          </TouchableOpacity>

          {/* Said here because this is the screen the fraud actually happens on:
              a caller pretending to be support asks for exactly these six
              digits. It costs one line and it is true. */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 22, marginBottom: 36, paddingHorizontal: 4 }}>
            <Ionicons name="lock-closed" size={13} color="#12B76A" style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 11, color: '#8A94B0', lineHeight: 17 }}>
              Never share this code. Sppero staff will never call and ask for it.
            </Text>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}


/* Google se aane ke baad: number.

   Google ne email saabit kiya, phone nahi - aur driver phone par hi call
   karta hai. Ye wahi ek cheez hai jo Google de nahi sakta, isliye maangi
   jaati hai.

   Server sirf wo number leta hai jo kisi ke paas na ho. Liya hua number
   mana kiya jaata hai, aur wo sandesh yahan poora dikhaya jaata hai - uska
   matlab "us number se OTP se aao" hai, "kuch tut gaya" nahi. */
export function GooglePhoneScreen() {
  const { phone, setPhone, result, loading, submitGooglePhone, googleEmail, setScreen,
          phoneTaken, signInWithGoogle } = useApp();
  const ok = String(phone || '').replace(/\D/g, '').length === 10;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 64 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => setScreen('login')} style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 15, color: C.pink, fontWeight: '700' }}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, marginBottom: 8 }}>
          One last thing
        </Text>
        <Text style={{ fontSize: 14.5, color: '#6A6A6A', lineHeight: 21, marginBottom: 6 }}>
          Your driver calls this number when they reach you, so we need it before your first ride.
        </Text>
        {!!googleEmail && (
          <Text style={{ fontSize: 13, color: '#8A8A8A', marginBottom: 20 }}>
            Signed in as {googleEmail}
          </Text>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14,
                       borderWidth: 1.5, borderColor: ok ? C.pink : 'rgba(0,0,0,0.12)', paddingHorizontal: 14,
                       height: 56, marginTop: 12, marginBottom: 14 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginRight: 8 }}>+91</Text>
          <TextInput
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="10-digit mobile number"
            placeholderTextColor="#B0B0B0"
            style={{ flex: 1, fontSize: 16.5, color: C.text, fontWeight: '600' }}
          />
        </View>

        {!!result && (
          <Text style={{ fontSize: 13.5, color: result.startsWith('❌') ? '#D33' : '#2A8', marginBottom: 14, lineHeight: 20 }}>
            {result.replace(/^❌ /, '')}
          </Text>
        )}

        {/* Number pehle se kisi ka hai. Uper laal me wajah likhi hai; yahan
            nikalne ka raasta - warna is panne se Google par wapas jaane ka
            koi tarika nahi bachta, aur wahi number dobara bhejte rehna hi
            ek matra kaam bacha rehta hai. */}
        {!!phoneTaken && (
          <TouchableOpacity onPress={signInWithGoogle} disabled={loading}
                            style={{ paddingVertical: 12, marginBottom: 6 }}>
            <Text style={{ color: '#4285F4', fontSize: 14.5, fontWeight: '800', textAlign: 'center' }}>
              Use a different Google account
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={submitGooglePhone}
          disabled={!ok || loading}
          style={{ borderRadius: 14, overflow: 'hidden', opacity: ok && !loading ? 1 : 0.5 }}>
          <View style={{ backgroundColor: C.pink, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              {loading ? 'Just a moment...' : 'Finish sign-in →'}
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
