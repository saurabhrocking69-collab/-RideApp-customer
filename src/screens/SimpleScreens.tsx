import { ScrollView, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DotBG, ScreenIn, EmptyAnim, Bouncy } from '../components/ui';
import { s, C } from '../styles';

export function ReferralScreen() {
  const {
    referralData,
    referralInput, setReferralInput,
    result,
    setScreen,
    shareReferral, applyReferral,
  } = useApp();

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>🎁 Refer & Earn</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ backgroundColor: C.bgCard, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.glassBorder, elevation: 4 }}>
          <Text style={{ fontSize: 52 }}>🎁</Text>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '900', marginTop: 8 }}>Both of you get ₹10!</Text>
          <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 6, textAlign: 'center' }}>Share your code. When a friend completes 3 rides, both get ₹10 in wallet!</Text>
        </View>
        <View style={{ backgroundColor: C.glass, borderRadius: 18, padding: 20, marginBottom: 16, alignItems: 'center', elevation: 2, borderWidth: 1.5, borderColor: C.pinkBorder }}>
          <Text style={{ fontSize: 12, color: C.textDim, letterSpacing: 1 }}>YOUR REFERRAL CODE</Text>
          <Text style={{ fontSize: 36, fontWeight: '900', color: C.pink, letterSpacing: 5, marginVertical: 14, textShadowColor: C.pink, textShadowRadius: 8 }}>{referralData?.code || '...'}</Text>
          <Bouncy style={[s.btn, { marginTop: 0, marginBottom: 0, width: '100%' }]} onPress={shareReferral}>
            <Text style={s.btnTxt}>📤 Share</Text>
          </Bouncy>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: C.glass, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ color: C.pink, fontSize: 24, fontWeight: '900' }}>{referralData?.total_referrals || 0}</Text>
            <Text style={{ color: C.textDim, fontSize: 11, marginTop: 4 }}>Total Referrals</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: C.glass, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ color: C.green, fontSize: 24, fontWeight: '900' }}>₹{referralData?.total_earned || 0}</Text>
            <Text style={{ color: C.textDim, fontSize: 11, marginTop: 4 }}>Total Earned</Text>
          </View>
        </View>
        <View style={{ backgroundColor: C.glass, borderRadius: 18, padding: 18, marginTop: 4, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.textMuted, marginBottom: 10 }}>Have someone's code? Enter it here</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[s.input, { flex: 1, marginBottom: 0, backgroundColor: C.glassMid, color: C.text, borderColor: C.glassBorder }]} placeholder="Referral code" placeholderTextColor={C.textDim} autoCapitalize="characters" value={referralInput} onChangeText={setReferralInput} />
            <TouchableOpacity style={[s.applyBtn, { backgroundColor: C.pinkGlass, borderColor: C.pinkBorder, borderWidth: 1 }]} onPress={applyReferral}><Text style={{ color: C.pink, fontWeight: '800' }}>Apply</Text></TouchableOpacity>
          </View>
          {result ? <Text style={[s.err, { marginTop: 10, color: result.includes('✅') ? C.green : C.pink }]}>{result}</Text> : null}
        </View>
      </ScrollView>
    </ScreenIn>
  );
}

export function PolicyScreen() {
  const { setScreen } = useApp();

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>📋 Cancellation Policy</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ backgroundColor: C.greenGlass, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.greenBorder }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.green, marginBottom: 6 }}>✅ Free Cancellation</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 20 }}>Cancel within <Text style={{ fontWeight: '900', color: C.green }}>1 minute of booking</Text> — completely FREE! No charges.</Text>
        </View>
        <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 12 }}>💰 Cancel Fees (after 1 min)</Text>
          {[
            ['After driver assigned', '₹10'],
            ['After driver arrives', '₹15'],
          ].map(([label, fee], i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i === 0 ? 1 : 0, borderColor: C.glassBorder }}>
              <Text style={{ fontSize: 13, color: C.textMuted }}>{label}</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.pink }}>{fee}</Text>
            </View>
          ))}
        </View>
        <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 8 }}>🎯 Daily Free Cancels</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 20 }}>You get <Text style={{ fontWeight: '900', color: C.text }}>3 free cancellations</Text> every day. After that, ₹10 fee applies per cancel.</Text>
        </View>
        <View style={{ backgroundColor: C.yellowGlass, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.yellowBorder }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.yellow, marginBottom: 8 }}>⚠️ Trust Score</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 20 }}>Frequent cancellations lower your trust score. Customers with low trust scores may face difficulty booking. Please cancel only when necessary.</Text>
        </View>
        <View style={{ backgroundColor: C.glassMid, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 13, color: C.purple, lineHeight: 20 }}>💡 When you cancel, you'll always see the applicable fee and how many free cancels you have left.</Text>
        </View>
      </ScrollView>
    </ScreenIn>
  );
}

export function SavedPlacesScreen() {
  const {
    pickup,
    savedPlaces,
    result,
    setScreen,
    savePlace, deletePlace,
  } = useApp();

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>📍 Saved Places</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ backgroundColor: C.glassMid, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 13, color: C.purple }}>💡 Set your pickup on the booking screen, then come here to save it.</Text>
        </View>
        {pickup ? (
          <View style={{ backgroundColor: C.glass, borderRadius: 14, padding: 14, marginBottom: 16, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ fontSize: 12, color: C.textDim, marginBottom: 4 }}>Current location:</Text>
            <Text style={{ fontSize: 14, color: C.text, marginBottom: 14, fontWeight: '600' }}>{pickup}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {['🏠 Home','💼 Office','📍 Other'].map((lbl, i) => (
                <TouchableOpacity key={i} style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder }} onPress={() => savePlace(lbl.split(' ')[1])}>
                  <Text style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <Text style={{ color: C.textDim, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>First set your pickup location from the booking screen</Text>
        )}
        {result ? <Text style={{ color: C.green, textAlign: 'center', marginBottom: 12, fontWeight: '700' }}>{result}</Text> : null}
        <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 10 }}>SAVED LOCATIONS</Text>
        {savedPlaces.length === 0
          ? <EmptyAnim icon="📍" title="No saved places" sub="Save Home and Office — your bookings will be even faster!" />
          : savedPlaces.map((p: any, i: number) => (
            <View key={i} style={[s.menuItem, { backgroundColor: C.glass, borderColor: C.glassBorder }]}>
              <View style={[s.menuIconBox, { backgroundColor: C.glassMid, borderColor: C.glassBorder }]}><Text style={{ fontSize: 18 }}>{p.label === 'Home' ? '🏠' : p.label === 'Office' ? '💼' : '📍'}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: C.text, fontWeight: '700' }}>{p.label}</Text><Text style={{ fontSize: 11, color: C.textDim }} numberOfLines={1}>{p.address}</Text></View>
              <TouchableOpacity onPress={() => deletePlace(p.id)}><Text style={{ fontSize: 18 }}>🗑️</Text></TouchableOpacity>
            </View>
          ))
        }
      </ScrollView>
    </ScreenIn>
  );
}

export function ChatScreen() {
  const {
    rideData,
    chatMsgs, chatInput, setChatInput,
    setScreen, chatOrigin,
    sendChat, callDriver,
  } = useApp();

  const quickReplies = ['Where are you? 🗺️', 'Please come fast 🙏', 'I am waiting', 'On my way!', 'How long will it take?'];

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen(chatOrigin)} style={s.backBtn}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>💬 {rideData?.driver?.name || 'Driver'}</Text>
        <TouchableOpacity onPress={callDriver} style={{ width: 36, alignItems: 'flex-end' }}><Ionicons name="call" size={20} color={C.green} /></TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1, padding: 14 }} contentContainerStyle={{ paddingBottom: 10 }}>
        {chatMsgs.length === 0 ? (
          <Text style={{ textAlign: 'center', color: C.textDim, marginTop: 20, fontSize: 13 }}>No messages yet — send the first one!</Text>
        ) : chatMsgs.map((m: any, i: number) => (
          <View key={i} style={[s.chatBubble, m.sender === 'customer' ? s.chatMine : { backgroundColor: C.glass, alignSelf: 'flex-start', borderWidth: 1, borderColor: C.glassBorder }]}>
            <Text style={{ color: m.sender === 'customer' ? '#fff' : C.text, fontSize: 14 }}>{m.message}</Text>
          </View>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 48, borderTopWidth: 1, borderTopColor: C.glassBorder, backgroundColor: C.bgCard }}
        contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 8, gap: 8 }}>
        {quickReplies.map(q => (
          <TouchableOpacity key={q} onPress={() => sendChat(q)}
            style={{ backgroundColor: C.pinkGlass, borderWidth: 1.5, borderColor: C.pinkBorder, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 }}>
            <Text style={{ fontSize: 12, color: C.pink, fontWeight: '700' }}>{q}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={[s.chatInputRow, { backgroundColor: C.bgCard, borderTopWidth: 1, borderColor: C.glassBorder }]}>
        <TextInput style={[s.chatInput, { backgroundColor: C.glassMid, color: C.text, borderColor: C.glassBorder, borderWidth: 1 }]} placeholder="Type a message..." placeholderTextColor={C.textDim} value={chatInput} onChangeText={setChatInput} onSubmitEditing={() => sendChat()} />
        <TouchableOpacity style={[s.chatSend, { backgroundColor: C.pink, elevation: 6, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 6 }]} onPress={() => sendChat()}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>➤</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
