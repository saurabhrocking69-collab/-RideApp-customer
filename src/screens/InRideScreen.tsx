import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { MapOverlay, MapWebView, PulseView, TripSteps, DotBG } from '../components/ui';
import { s, C } from '../styles';

export function InRideScreen() {
  const {
    setScreen,
    pickup, drop,
    pickupCoords, dropCoords,
    driverLoc,
    userCoords,
    rideData,
    unreadChat, setUnreadChat,
    sosActive,
    callDriver, triggerSOS,
  } = useApp();

  return (
    <View style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <Text style={s.topTitle}>🚗 Ride Chal Rahi Hai</Text>
      </View>
      <View style={s.mapFit}>
        <MapWebView pickupCoords={pickupCoords} dropCoords={dropCoords} driverLat={driverLoc?.lat} driverLng={driverLoc?.lng} customerLat={userCoords?.latitude} customerLng={userCoords?.longitude} height={220} />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} live={true} />
      </View>
      <View style={{ flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, paddingTop: 16, paddingHorizontal: 16, borderTopWidth: 1, borderColor: C.glassBorder }}>
        <TripSteps step={2} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={{ backgroundColor: C.greenGlass, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: C.greenBorder }}>
            <PulseView><Text style={{ color: C.green, fontSize: 15, fontWeight: '800' }}>🚗 Ride Chal Rahi Hai</Text></PulseView>
            <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>{rideData?.distance} · {rideData?.fare}</Text>
          </View>
          <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ fontSize: 13, color: C.green, fontWeight: '700' }}>📍 {pickup}</Text>
            <Text style={{ fontSize: 16, textAlign: 'center', color: C.textDim, marginVertical: 6 }}>↓</Text>
            <Text style={{ fontSize: 13, color: C.pink, fontWeight: '700' }}>🎯 {drop}</Text>
          </View>
          <View style={s.actionRow}>
            <TouchableOpacity style={s.actionBtn} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
              <View>
                <Ionicons name="chatbubble" size={22} color={C.textMuted} />
                {unreadChat > 0 && <View style={s.chatBadge}><Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{unreadChat}</Text></View>}
              </View>
              <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={callDriver}><Ionicons name="call" size={22} color={C.green} /><Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>Call</Text></TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={triggerSOS}><Ionicons name="warning" size={22} color={C.red} /><Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>SOS</Text></TouchableOpacity>
          </View>
          {unreadChat > 0 && (
            <TouchableOpacity style={s.chatAlert} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>💬 Driver ne {unreadChat} message bheja — dekho</Text>
            </TouchableOpacity>
          )}
          {sosActive && <View style={[s.infoBox, { backgroundColor: C.redGlass, borderColor: C.redBorder }]}><Text style={{ fontSize: 13, color: C.red, fontWeight: '800' }}>🆘 Alert bheja! Police: 100</Text></View>}
        </ScrollView>
      </View>
    </View>
  );
}
