import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { MapOverlay, MapWebView, PulseView, TripSteps } from '../components/ui';
import { s } from '../styles';

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
      <View style={s.topBar}>
        <Text style={s.topTitle}>🚗 Ride Chal Rahi Hai</Text>
      </View>
      <View style={s.mapFit}>
        <MapWebView pickupCoords={pickupCoords} dropCoords={dropCoords} driverLat={driverLoc?.lat} driverLng={driverLoc?.lng} customerLat={userCoords?.latitude} customerLng={userCoords?.longitude} height={220} />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} live={true} />
      </View>
      <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, paddingTop: 16, paddingHorizontal: 16 }}>
        <TripSteps step={2} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={{ backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 }}>
            <PulseView><Text style={{ color: '#4CAF50', fontSize: 15, fontWeight: 'bold' }}>🚗 Ride Chal Rahi Hai</Text></PulseView>
            <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>{rideData?.distance} · {rideData?.fare}</Text>
          </View>
          <View style={{ backgroundColor: '#f9f9f9', borderRadius: 14, padding: 14, marginBottom: 10 }}>
            <Text style={{ fontSize: 13, color: '#4CAF50', fontWeight: '600' }}>📍 {pickup}</Text>
            <Text style={{ fontSize: 16, textAlign: 'center', color: '#ddd', marginVertical: 6 }}>↓</Text>
            <Text style={{ fontSize: 13, color: '#e94560', fontWeight: '600' }}>🎯 {drop}</Text>
          </View>
          <View style={s.actionRow}>
            <TouchableOpacity style={s.actionBtn} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
              <View>
                <Ionicons name="chatbubble" size={22} color="#555" />
                {unreadChat > 0 && <View style={s.chatBadge}><Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{unreadChat}</Text></View>}
              </View>
              <Text style={{ fontSize: 10, color: '#555', marginTop: 3 }}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={callDriver}><Ionicons name="call" size={22} color="#555" /><Text style={{ fontSize: 10, color: '#555', marginTop: 3 }}>Call</Text></TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={triggerSOS}><Ionicons name="warning" size={22} color="#555" /><Text style={{ fontSize: 10, color: '#555', marginTop: 3 }}>SOS</Text></TouchableOpacity>
          </View>
          {unreadChat > 0 && (
            <TouchableOpacity style={s.chatAlert} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>💬 Driver ne {unreadChat} message bheja — dekho</Text>
            </TouchableOpacity>
          )}
          {sosActive && <View style={[s.infoBox, { backgroundColor: '#ffeeee' }]}><Text style={{ fontSize: 13, color: '#c62828', fontWeight: 'bold' }}>🆘 Alert bheja! Police: 100</Text></View>}
        </ScrollView>
      </View>
    </View>
  );
}
