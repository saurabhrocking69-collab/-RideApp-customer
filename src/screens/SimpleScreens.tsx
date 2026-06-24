import { ScrollView, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { ScreenIn, EmptyAnim, Bouncy } from '../components/ui';
import { s } from '../styles';

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
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>🎁 Refer & Earn</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ backgroundColor: '#1a1a2e', borderRadius: 18, padding: 24, alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 50 }}>🎁</Text>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 8 }}>Dono ko ₹50 milega!</Text>
          <Text style={{ color: '#aaa', fontSize: 13, marginTop: 6, textAlign: 'center' }}>Apna code share karo. Jab dost first ride karega, dono ko ₹50 wallet mein!</Text>
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center', elevation: 2 }}>
          <Text style={{ fontSize: 13, color: '#888' }}>Aapka Referral Code</Text>
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#e94560', letterSpacing: 3, marginVertical: 10 }}>{referralData?.code || '...'}</Text>
          <Bouncy style={[s.btn, { marginTop: 0, marginBottom: 0, width: '100%' }]} onPress={shareReferral}>
            <Text style={s.btnTxt}>📤 Share Karo</Text>
          </Bouncy>
        </View>
        <View style={s.row}>
          <View style={[s.statBox, { marginRight: 8 }]}><Text style={s.statNum}>{referralData?.total_referrals || 0}</Text><Text style={s.statLbl}>Total Referrals</Text></View>
          <View style={[s.statBox, { marginLeft: 8 }]}><Text style={s.statNum}>₹{referralData?.total_earned || 0}</Text><Text style={s.statLbl}>Total Earned</Text></View>
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, marginTop: 16, elevation: 2 }}>
          <Text style={s.secTitle}>Kisi ka code hai? Yahan daalo</Text>
          <View style={s.row}>
            <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Referral code" autoCapitalize="characters" value={referralInput} onChangeText={setReferralInput} />
            <TouchableOpacity style={s.applyBtn} onPress={applyReferral}><Text style={{ color: '#e94560', fontWeight: 'bold' }}>Apply</Text></TouchableOpacity>
          </View>
          {result ? <Text style={[s.err, { marginTop: 10, color: result.includes('✅') ? '#4CAF50' : '#e94560' }]}>{result}</Text> : null}
        </View>
      </ScrollView>
    </ScreenIn>
  );
}

export function PolicyScreen() {
  const { setScreen } = useApp();

  return (
    <ScreenIn style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>📋 Cancellation Policy</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ backgroundColor: '#e8f5e9', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#2e7d32', marginBottom: 6 }}>✅ Free Cancellation</Text>
          <Text style={{ fontSize: 13, color: '#388e3c', lineHeight: 20 }}>Ride book karne ke <Text style={{ fontWeight: 'bold' }}>1 minute ke andar</Text> cancel karo — bilkul FREE! Koi charge nahi.</Text>
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 12 }}>💰 Cancel Fees (1 min ke baad)</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' }}>
            <Text style={{ fontSize: 13, color: '#666' }}>Driver assign hone ke baad</Text>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#e94560' }}>₹10</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ fontSize: 13, color: '#666' }}>Driver pahunchne ke baad</Text>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#e94560' }}>₹15</Text>
          </View>
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 8 }}>🎯 Daily Free Cancels</Text>
          <Text style={{ fontSize: 13, color: '#666', lineHeight: 20 }}>Har din <Text style={{ fontWeight: 'bold', color: '#1a1a2e' }}>3 free cancellations</Text> milti hain. Uske baad har cancel pe ₹10 fee lagti hai.</Text>
        </View>
        <View style={{ backgroundColor: '#fff3e0', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#e65100', marginBottom: 8 }}>⚠️ Trust Score</Text>
          <Text style={{ fontSize: 13, color: '#ef6c00', lineHeight: 20 }}>Bar-bar cancel karne se aapka trust score girta hai. Kam trust score wale customers ko booking mein dikkat ho sakti hai. Kripya zaruri hone par hi cancel karein.</Text>
        </View>
        <View style={{ backgroundColor: '#e3f2fd', borderRadius: 14, padding: 16 }}>
          <Text style={{ fontSize: 13, color: '#1565c0', lineHeight: 20 }}>💡 Cancel karte waqt aapko hamesha dikhega ki kitni fee lagegi aur kitne free cancels bache hain.</Text>
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
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>📍 Saved Places</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ backgroundColor: '#e3f2fd', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, color: '#1565c0' }}>💡 Booking screen se pickup set karke yahan aao, phir save karo.</Text>
        </View>
        {pickup ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, elevation: 2 }}>
            <Text style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Current location:</Text>
            <Text style={{ fontSize: 14, color: '#1a1a2e', marginBottom: 12 }}>{pickup}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {['🏠 Home','💼 Office','📍 Other'].map((lbl, i) => (
                <TouchableOpacity key={i} style={{ flex: 1, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 10, alignItems: 'center' }} onPress={() => savePlace(lbl.split(' ')[1])}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <Text style={{ color: '#999', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>Pehle booking screen se pickup location set karo</Text>
        )}
        {result ? <Text style={{ color: '#4CAF50', textAlign: 'center', marginBottom: 12 }}>{result}</Text> : null}
        <Text style={s.secTitle}>Saved Locations</Text>
        {savedPlaces.length === 0
          ? <EmptyAnim icon="📍" title="Koi saved place nahi" sub="Home aur Office save karo — booking aur bhi fast ho jaayegi!" />
          : savedPlaces.map((p, i) => (
            <View key={i} style={s.menuItem}>
              <View style={s.menuIconBox}><Text style={{ fontSize: 18 }}>{p.label === 'Home' ? '🏠' : p.label === 'Office' ? '💼' : '📍'}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ fontSize: 14, color: '#1a1a2e', fontWeight: '600' }}>{p.label}</Text><Text style={{ fontSize: 11, color: '#999' }} numberOfLines={1}>{p.address}</Text></View>
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
    setScreen,
    sendChat, callDriver,
  } = useApp();

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('matching')} style={s.backBtn}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>💬 {rideData?.driver?.name || 'Driver'}</Text>
        <TouchableOpacity onPress={callDriver} style={{ width: 36, alignItems: 'flex-end' }}><Ionicons name="call" size={20} color="#fff" /></TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1, padding: 14 }} contentContainerStyle={{ paddingBottom: 10 }}>
        {chatMsgs.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 13 }}>Koi message nahi — pehla message bhejo!</Text>
        ) : chatMsgs.map((m, i) => (
          <View key={i} style={[s.chatBubble, m.sender === 'customer' ? s.chatMine : s.chatTheirs]}>
            <Text style={{ color: m.sender === 'customer' ? '#fff' : '#1a1a2e', fontSize: 14 }}>{m.message}</Text>
          </View>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' }} contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 7, gap: 8 }}>
        {['Where are you? 🗺️', 'Please come fast 🙏', 'Main wait kar raha hun', 'Ok, aata hun', 'Kitni der lagegi?'].map(q => (
          <TouchableOpacity key={q} onPress={() => sendChat(q)} style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e94560', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ fontSize: 12, color: '#e94560', fontWeight: '600' }}>{q}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={s.chatInputRow}>
        <TextInput style={s.chatInput} placeholder="Message likho..." value={chatInput} onChangeText={setChatInput} onSubmitEditing={() => sendChat()} />
        <TouchableOpacity style={s.chatSend} onPress={() => sendChat()}><Text style={{ color: '#fff', fontWeight: 'bold' }}>➤</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
