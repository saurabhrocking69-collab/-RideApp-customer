import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { GlassPanel, MapOverlay, PulseView, TripSteps, DotBG } from '../components/ui';
import { LiveMap } from '../components/LiveMap';
import { s, C } from '../styles';

export function InRideScreen() {
  const {
    setScreen,
    pickup, drop,
    pickupCoords, dropCoords,
    driverLoc,
    userCoords,
    rideData, rideType,
    unreadChat, setUnreadChat,
    chatToast, setChatToast,
    sosActive,
    callDriver, triggerSOS,
  } = useApp();

  return (
    <View style={s.screen}>
      <View style={{ backgroundColor: C.pink, overflow: 'hidden', paddingTop: Platform.OS === 'android' ? 46 : 52, paddingBottom: 20, paddingHorizontal: 16 }}>
        <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.10)', top: -60, right: -40 }} />
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>🚗 Ride Chal Rahi Hai</Text>
      </View>
      <View style={s.mapFit}>
        <LiveMap
          pickupCoords={pickupCoords}
          dropCoords={dropCoords}
          driverLat={driverLoc?.lat}
          driverLng={driverLoc?.lng}
          vehicleType={rideData?.vehicle_type || rideData?.ride_type || rideType || 'auto'}
          height={220}
          mode="inride"
          showRoute={true}
        />
        <MapOverlay hasRoute={!!(pickupCoords && dropCoords)} pickup={pickup} drop={drop} live={true} />
      </View>
      <GlassPanel intensity={20} style={{ flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, paddingTop: 16, paddingHorizontal: 16, elevation: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16 }}>
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
          {chatToast && (
            <TouchableOpacity
              style={{ backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(233,69,96,0.45)', elevation: 8 }}
              onPress={() => { setChatToast(null); setUnreadChat(0); setScreen('chat'); }}>
              <Ionicons name="chatbubble" size={16} color={C.pink} />
              <Text style={{ color: '#fff', fontSize: 13, flex: 1, fontWeight: '600' }} numberOfLines={1}>{chatToast}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>Reply</Text>
            </TouchableOpacity>
          )}
          {!chatToast && unreadChat > 0 && (
            <TouchableOpacity style={s.chatAlert} onPress={() => { setUnreadChat(0); setScreen('chat'); }}>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>💬 Driver ke {unreadChat} message — tap to read</Text>
            </TouchableOpacity>
          )}
          {sosActive && <View style={[s.infoBox, { backgroundColor: C.redGlass, borderColor: C.redBorder }]}><Text style={{ fontSize: 13, color: C.red, fontWeight: '800' }}>🆘 Alert bheja! Police: 100</Text></View>}
        </ScrollView>
      </GlassPanel>
    </View>
  );
}
