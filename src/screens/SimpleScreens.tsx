import { ScrollView, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DotBG, ScreenIn, EmptyAnim, Bouncy } from '../components/ui';
import { s, C } from '../styles';

/* Earn with Sppero — the partner programme.
   Replaces the old in-app Refer & Earn, which paid ₹10 once after a friend's
   third ride. The programme now pays a share of the commission on every ride
   those people take, for as long as they keep riding — which is a real income
   rather than a one-off, and it needs a dashboard, bank details and payouts.
   All of that lives on sppero.com, so this screen's job is to explain it well
   and get out of the way. */
export function PartnerScreen() {
  const { setScreen } = useApp();
  const PORTAL = 'https://sppero.com/partner.html';
  const open = () => Linking.openURL(PORTAL).catch(() => {});

  const Step = ({ n, title, body }: { n: string; title: string; body: string }) => (
    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.pinkGlass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.pinkBorder }}>
        <Text style={{ color: C.pink, fontWeight: '900', fontSize: 12 }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontWeight: '800', fontSize: 14.5, marginBottom: 2 }}>{title}</Text>
        <Text style={{ color: C.textMuted, fontSize: 12.5, lineHeight: 18 }}>{body}</Text>
      </View>
    </View>
  );

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>🤝 Earn with Sppero</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ backgroundColor: C.bgCard, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.glassBorder, elevation: 4 }}>
          <Text style={{ fontSize: 48 }}>🤝</Text>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '900', marginTop: 8, textAlign: 'center', lineHeight: 27 }}>Bring people to Sppero. Earn from every ride.</Text>
          <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 19 }}>
            Get a driver or a customer onto Sppero and you earn a share of what Sppero makes on their rides — for as long as they keep riding.
          </Text>
        </View>

        <View style={{ backgroundColor: C.glass, borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: C.glassBorder }}>
          <Step n="1" title="Join free" body="Your name, your number, a password. No fee, ever." />
          <Step n="2" title="Get people on Sppero" body="Share your code, or add the numbers you installed for and Sppero verifies them." />
          <Step n="3" title="Earn on their rides" body="Every completed ride adds to your balance. Watch it ride by ride." />
          <Step n="4" title="Withdraw from ₹200" body="Straight to your UPI or bank account." />
        </View>

        <Bouncy style={[s.btn, { marginTop: 0 }]} onPress={open}>
          <Text style={s.btnTxt}>Open Partner Dashboard</Text>
        </Bouncy>
        <Text style={{ color: C.textDim, fontSize: 11.5, textAlign: 'center', marginTop: 10, lineHeight: 17 }}>
          Opens sppero.com — join, track your earnings and withdraw there.
        </Text>
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
    chatMsgs, chatInput, setChatInput, chatError,
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
      {/* A failed send used to leave nothing on screen — the box was already
          cleared and the message never appeared, because messages only show
          after the server has them. The words are put back in the box now, and
          this says why they are still sitting there. */}
      {chatError ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(239,68,68,0.10)' }}>
          <Ionicons name="alert-circle" size={15} color={C.red} />
          <Text style={{ flex: 1, color: C.red, fontSize: 12, fontWeight: '700' }}>{chatError}</Text>
        </View>
      ) : null}
      <View style={[s.chatInputRow, { backgroundColor: C.bgCard, borderTopWidth: 1, borderColor: C.glassBorder }]}>
        <TextInput style={[s.chatInput, { backgroundColor: C.glassMid, color: C.text, borderColor: C.glassBorder, borderWidth: 1 }]} placeholder="Type a message..." placeholderTextColor={C.textDim} value={chatInput} onChangeText={setChatInput} onSubmitEditing={() => sendChat()} />
        <TouchableOpacity style={[s.chatSend, { backgroundColor: C.pink, elevation: 6, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 6 }]} onPress={() => sendChat()}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>➤</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
