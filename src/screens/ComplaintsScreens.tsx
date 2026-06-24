import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DotBG, ScreenIn } from '../components/ui';
import { s, C } from '../styles';
import { apiGet, apiPost } from '../../api';

const statusColor: any = { open:'#ff9800', under_review:'#2196F3', awaiting_response:'#9c27b0', evidence_requested:'#ff5722', resolved:'#4CAF50', closed:'#9e9e9e', appealed:'#e91e63', escalated:'#f44336' };
const priorityColor: any = { urgent: C.red, high:'#ff9800', normal:'#2196F3', low:'#9e9e9e' };

export function ComplaintsScreen() {
  const {
    phone,
    setScreen,
    complaints,
    cmpLoading, setCmpLoading,
    setCmpDetail,
    setCmpType, setCmpDesc,
  } = useApp();

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('support')} style={{ padding: 4 }}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>📋 My Complaints</Text>
        <TouchableOpacity onPress={() => { setCmpType(''); setCmpDesc(''); setScreen('complaint-new'); }} style={{ padding: 4 }}>
          <Text style={{ color: C.pink, fontWeight: '900', fontSize: 13 }}>+ New</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1, padding: 14 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {complaints.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 48 }}>📭</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.text, marginTop: 12 }}>Koi complaint nahi</Text>
            <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 6, textAlign: 'center' }}>Koi ride issue tha? Complaint file karo</Text>
            <TouchableOpacity onPress={() => { setCmpType(''); setCmpDesc(''); setScreen('complaint-new'); }}
              style={{ backgroundColor: C.pink, borderRadius: 14, padding: 14, paddingHorizontal: 28, marginTop: 20, elevation: 6, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '900' }}>Complaint File Karo</Text>
            </TouchableOpacity>
          </View>
        )}
        {complaints.map((c: any) => (
          <TouchableOpacity key={c.id} onPress={async () => {
            setCmpLoading(true);
            try { const r = await apiGet(`/api/complaints/${c.id}?phone=${encodeURIComponent(phone)}`); setCmpDetail(r); setScreen('complaint-detail'); } catch{}
            setCmpLoading(false);
          }} style={{ backgroundColor: C.glass, borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 }}>{c.title}</Text>
              <View style={{ backgroundColor: statusColor[c.status] || '#999', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{c.status.replace('_',' ').toUpperCase()}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>{c.complaint_type.replace(/_/g,' ')} · {new Date(c.created_at).toLocaleDateString('en-IN')}</Text>
            {c.priority !== 'normal' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: priorityColor[c.priority] || '#999' }} />
                <Text style={{ fontSize: 11, color: priorityColor[c.priority] || '#999', fontWeight: '700' }}>{c.priority.toUpperCase()} PRIORITY</Text>
              </View>
            )}
            {c.resolution && <Text style={{ fontSize: 12, color: C.green, marginTop: 4, fontWeight: '700' }}>✅ {c.resolution.replace(/_/g,' ')}</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ScreenIn>
  );
}

export function NewComplaintScreen() {
  const {
    phone,
    setScreen,
    rideData,
    cmpType, setCmpType,
    cmpDesc, setCmpDesc,
    cmpLoading, setCmpLoading,
    cmpLinkedRide, setCmpLinkedRide,
    cmpShowRidePicker, setCmpShowRidePicker,
    cmpHistoryRides, setCmpHistoryRides,
    setComplaints,
  } = useApp();

  const customerTypes = [
    { id: 'early_trip_end', label: '🛑 Trip Beech Mein Band', desc: 'Driver ne drop se pehle trip complete kiya' },
    { id: 'reckless_driving', label: '🚗 Reckless Driving', desc: 'Dangerous driving, over-speeding' },
    { id: 'route_deviation', label: '🗺️ Route Deviation', desc: 'Longer/wrong route liya' },
    { id: 'overcharging', label: '💸 Overcharging', desc: 'Extra fare mang raha tha' },
    { id: 'unprofessional', label: '😤 Unprofessional Behavior', desc: 'Rude ya unprofessional tha' },
    { id: 'vehicle_condition', label: '🚙 Vehicle Condition', desc: 'Dirty ya unsafe vehicle' },
    { id: 'driver_no_show', label: '🚫 Driver No Show', desc: 'Driver pickup pe nahi aaya' },
    { id: 'harassment', label: '⚠️ Harassment', desc: 'Verbal ya physical harassment' },
    { id: 'physical_abuse', label: '🆘 Physical Abuse', desc: 'Physical harm ya attack' },
    { id: 'other', label: '📝 Other Issue', desc: 'Koi aur problem' },
  ];

  const effectiveRide = cmpLinkedRide || (rideData?.ride_id ? rideData : null);

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setCmpShowRidePicker(false); setScreen('complaints'); }} style={{ padding: 4 }}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>⚠️ File Complaint</Text>
        <View style={{ width: 40 }} />
      </View>

      {cmpShowRidePicker && (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 99, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', borderTopWidth: 1, borderColor: C.glassBorder }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderColor: C.glassBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '900', fontSize: 15, color: C.text }}>Ride Select Karo</Text>
              <TouchableOpacity onPress={() => setCmpShowRidePicker(false)}><Text style={{ color: C.pink, fontWeight: '800' }}>Cancel</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12 }}>
              {cmpHistoryRides.length === 0 && <Text style={{ color: C.textDim, textAlign: 'center', paddingVertical: 20 }}>Koi recent rides nahi milein</Text>}
              {cmpHistoryRides.map((r: any) => (
                <TouchableOpacity key={r.id} onPress={() => { setCmpLinkedRide(r); setCmpShowRidePicker(false); }}
                  style={{ backgroundColor: cmpLinkedRide?.id === r.id ? C.pinkGlass : C.glass, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: cmpLinkedRide?.id === r.id ? C.pinkBorder : C.glassBorder }}>
                  <Text style={{ fontWeight: '800', fontSize: 13, color: C.text }}>#{r.id} · {r.driver_name || 'Unknown Driver'}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }} numberOfLines={1}>{r.pickup} → {r.drop_location}</Text>
                  <Text style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>₹{r.fare} · {new Date(r.created_at).toLocaleDateString('en-IN')} · {r.ride_type?.toUpperCase()}</Text>
                  {r.driver_phone && <Text style={{ fontSize: 11, color: C.pink, marginTop: 2 }}>Driver: {r.driver_phone}</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      <ScrollView style={{ flex: 1, padding: 14 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 14, marginBottom: 16, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 10 }}>Ride Link karo (zaroori)</Text>
          {effectiveRide ? (
            <View style={{ backgroundColor: C.greenGlass, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.greenBorder }}>
              <Text style={{ fontSize: 18 }}>🔗</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', fontSize: 13, color: C.text }}>
                  {effectiveRide.driver_name || 'Driver'} · Ride #{effectiveRide.id || effectiveRide.ride_id}
                </Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }} numberOfLines={1}>
                  {effectiveRide.pickup} → {effectiveRide.drop_location || effectiveRide.drop}
                </Text>
                {effectiveRide.driver_phone && <Text style={{ fontSize: 11, color: C.pink, marginTop: 2 }}>{effectiveRide.driver_phone}</Text>}
              </View>
              {!rideData?.ride_id && (
                <TouchableOpacity onPress={() => { setCmpLinkedRide(null); }} style={{ padding: 4 }}>
                  <Text style={{ color: C.red, fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity onPress={async () => {
              setCmpLoading(true);
              try {
                const d = await apiGet(`/api/rides/history?phone=${phone}`);
                setCmpHistoryRides((d.rides || []).filter((r: any) => r.status === 'completed'));
              } catch {}
              setCmpLoading(false);
              setCmpShowRidePicker(true);
            }} style={{ backgroundColor: C.glassMid, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: C.pinkBorder, borderStyle: 'dashed' }}>
              <Text style={{ fontSize: 20 }}>🔍</Text>
              <View>
                <Text style={{ fontWeight: '800', fontSize: 13, color: C.pink }}>{cmpLoading ? 'Loading rides...' : 'Ride Select Karo'}</Text>
                <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Pichli rides mein se jis pe problem aayi</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 12 }}>ISSUE TYPE SELECT KARO</Text>
        {customerTypes.map(t => (
          <TouchableOpacity key={t.id} onPress={() => setCmpType(t.id)}
            style={{ backgroundColor: cmpType === t.id ? C.bgCard : C.glass, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: cmpType === t.id ? C.pinkBorder : C.glassBorder, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, marginRight: 10 }}>{t.label.split(' ')[0]}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', fontSize: 13, color: cmpType === t.id ? C.text : C.textMuted }}>{t.label.substring(t.label.indexOf(' ')+1)}</Text>
              <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{t.desc}</Text>
            </View>
            {cmpType === t.id && <Text style={{ color: C.pink, fontSize: 20, fontWeight: '900' }}>✓</Text>}
          </TouchableOpacity>
        ))}

        <Text style={{ fontSize: 13, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginTop: 16, marginBottom: 8 }}>DETAILS (PURI BAAT BATAO)</Text>
        <TextInput value={cmpDesc} onChangeText={setCmpDesc} placeholder="Kya hua, kahan hua, kitne baje hua — puri detail mein batao (kam se kam 20 characters)..."
          multiline style={[s.input, { height: 130, textAlignVertical: 'top', fontSize: 13, backgroundColor: C.glassMid, color: C.text, borderColor: C.glassBorder }]} placeholderTextColor={C.textDim} maxLength={2000} />
        <Text style={{ fontSize: 11, color: cmpDesc.length < 20 ? C.red : C.green, textAlign: 'right', marginTop: 4 }}>{cmpDesc.length}/2000</Text>

        <TouchableOpacity
          onPress={async () => {
            const linked = cmpLinkedRide || (rideData?.ride_id ? rideData : null);
            if (!linked) return Alert.alert('Ride Required', 'Pehle ride select karo jis pe problem aayi');
            if (!cmpType) return Alert.alert('Issue Type', 'Complaint type select karo');
            if (cmpDesc.trim().length < 20) return Alert.alert('Description', 'Kam se kam 20 characters likho');
            setCmpLoading(true);
            const data = await apiPost('/api/complaints', {
              phone,
              ride_id: linked.id || linked.ride_id || null,
              complaint_type: cmpType,
              description: cmpDesc.trim(),
            });
            setCmpLoading(false);
            if (data.complaint) {
              const listData = await apiGet(`/api/complaints?phone=${encodeURIComponent(phone)}`);
              setComplaints(listData.complaints || []);
              setCmpLinkedRide(null); setCmpType(''); setCmpDesc('');
              Alert.alert('✅ Complaint Submit Ho Gayi', 'Sppero team 24-48 ghante mein review karegi. Complaint ID: ' + data.complaint.id.slice(0, 8).toUpperCase(), [{ text: 'Track Karo', onPress: () => setScreen('complaints') }]);
            } else {
              Alert.alert('❌ Error', data.error || data.message || 'Submit fail hua — dobara try karo');
            }
          }}
          style={[s.btn, { marginTop: 20, opacity: cmpLoading ? 0.6 : 1 }]}
          disabled={cmpLoading}>
          <Text style={s.btnTxt}>{cmpLoading ? 'Submitting...' : '📤 Submit Complaint'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenIn>
  );
}

export function ComplaintDetailScreen() {
  const {
    phone,
    setScreen,
    cmpDetail, setCmpDetail,
    cmpMsg, setCmpMsg,
    setComplaints,
  } = useApp();

  if (!cmpDetail) return null;
  const c = cmpDetail.complaint;
  const msgs = cmpDetail.messages || [];
  const evidence = cmpDetail.evidence || [];
  const timeline = cmpDetail.timeline || [];
  const isClosed = ['resolved','closed'].includes(c?.status);

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('complaints')} style={{ padding: 4 }}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.topTitle}>Complaint Detail</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        <View style={{ backgroundColor: statusColor[c.status] || '#999', borderRadius: 14, padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 24 }}>{c.status === 'resolved' ? '✅' : c.status === 'closed' ? '📁' : '🔍'}</Text>
          <View>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>{c.status.replace(/_/g,' ').toUpperCase()}</Text>
            {c.assigned_admin && <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>Assigned: {c.assigned_admin}</Text>}
          </View>
        </View>

        <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 17, fontWeight: '900', color: C.text }}>{c.title}</Text>
          <Text style={{ fontSize: 12, color: C.pink, fontWeight: '700', marginTop: 4 }}>{c.complaint_type?.replace(/_/g,' ')} · Filed: {new Date(c.created_at).toLocaleDateString('en-IN')}</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 10, lineHeight: 20 }}>{c.description}</Text>
          {c.filed_against_name && <Text style={{ fontSize: 12, color: C.textDim, marginTop: 8 }}>Against: {c.filed_against_name}</Text>}
          {c.pickup && <Text style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Ride: {c.pickup} → {c.drop_location}</Text>}
        </View>

        {c.resolution && (
          <View style={{ backgroundColor: C.greenGlass, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.greenBorder }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: C.green, marginBottom: 6 }}>✅ Resolution</Text>
            <Text style={{ fontSize: 13, color: C.green, fontWeight: '700' }}>{c.resolution?.replace(/_/g,' ')}</Text>
            {c.resolution_note && <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 6, lineHeight: 18 }}>{c.resolution_note}</Text>}
            {c.action_taken && <Text style={{ fontSize: 12, color: C.green, marginTop: 4, opacity: 0.8 }}>Action: {c.action_taken}</Text>}
          </View>
        )}

        {evidence.length > 0 && (
          <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 10 }}>📎 Evidence ({evidence.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {evidence.map((e: any, i: number) => (
                <Image key={i} source={{ uri: e.file_url }} style={{ width: 90, height: 90, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: C.glassBorder }} />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 10 }}>💬 Messages ({msgs.length})</Text>
          {msgs.length === 0 && <Text style={{ fontSize: 12, color: C.textDim, textAlign: 'center', paddingVertical: 10 }}>Koi message nahi abhi</Text>}
          {msgs.map((m: any, i: number) => (
            <View key={i} style={{ marginBottom: 12, padding: 12, backgroundColor: m.sender_role === 'admin' ? 'rgba(33,150,243,0.15)' : m.sender_role === 'customer' ? C.pinkGlass : C.yellowGlass, borderRadius: 12, borderWidth: 1, borderColor: m.sender_role === 'admin' ? 'rgba(33,150,243,0.35)' : m.sender_role === 'customer' ? C.pinkBorder : C.yellowBorder }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: m.sender_role === 'admin' ? '#90CAF9' : m.sender_role === 'customer' ? C.pink : C.yellow, marginBottom: 4 }}>{m.sender_name || m.sender_role} · {new Date(m.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</Text>
              <Text style={{ fontSize: 13, color: C.text, lineHeight: 18 }}>{m.message}</Text>
            </View>
          ))}
        </View>

        {!isClosed && (
          <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 8 }}>Reply karein</Text>
            <TextInput value={cmpMsg} onChangeText={setCmpMsg} placeholder="Message type karo..." multiline placeholderTextColor={C.textDim}
              style={[s.input, { height: 80, textAlignVertical: 'top', fontSize: 13, backgroundColor: C.glassMid, color: C.text, borderColor: C.glassBorder }]} />
            <TouchableOpacity onPress={async () => {
              if (!cmpMsg.trim()) return;
              try {
                await apiPost(`/api/complaints/${c.id}/messages`, { phone, message: cmpMsg.trim() });
                setCmpMsg('');
                const r = await apiGet(`/api/complaints/${c.id}?phone=${encodeURIComponent(phone)}`);
                setCmpDetail(r);
              } catch { Alert.alert('Error', 'Message nahi bheja'); }
            }} style={[s.btn, { marginTop: 10, paddingVertical: 12 }]}>
              <Text style={s.btnTxt}>📤 Bhejo</Text>
            </TouchableOpacity>
          </View>
        )}

        {timeline.length > 0 && (
          <View style={{ backgroundColor: C.glass, borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 10 }}>📅 Timeline</Text>
            {timeline.map((t: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 10 }}>
                <View style={{ width: 28, alignItems: 'center' }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.pink, marginTop: 3 }} />
                  {i < timeline.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: C.glassBorder, marginTop: 4 }} />}
                </View>
                <View style={{ flex: 1, paddingLeft: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>{t.description}</Text>
                  <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{new Date(t.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {c.status === 'resolved' && (
          <TouchableOpacity onPress={() => Alert.prompt('Appeal', 'Aap kyun disagree karte hain? (20+ characters)', async (reason) => {
            if (!reason || reason.length < 20) { Alert.alert('Too short', 'Reason 20+ characters ka likho'); return; }
            try {
              await apiPost(`/api/complaints/${c.id}/appeal`, { phone, reason });
              const r = await apiGet(`/api/complaints/${c.id}?phone=${encodeURIComponent(phone)}`);
              setCmpDetail(r);
              Alert.alert('Appeal Submit', 'Dobara review hoga');
            } catch {}
          })} style={{ backgroundColor: C.yellowGlass, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.yellowBorder, alignItems: 'center' }}>
            <Text style={{ color: C.yellow, fontWeight: '800' }}>⚖️ Resolution se Disagree? Appeal Karo</Text>
          </TouchableOpacity>
        )}

        {!isClosed && c.status !== 'resolved' && (
          <TouchableOpacity onPress={() => Alert.alert('Withdraw', 'Complaint withdraw karna chahte ho?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Withdraw', style: 'destructive', onPress: async () => {
              try {
                await apiPost(`/api/complaints/${c.id}/withdraw`, { phone });
                const listRes = await apiGet(`/api/complaints?phone=${encodeURIComponent(phone)}`);
                setComplaints(listRes.complaints || []);
                setScreen('complaints');
              } catch {}
            }},
          ])} style={{ backgroundColor: C.redGlass, borderRadius: 14, padding: 14, marginBottom: 14, alignItems: 'center', borderWidth: 1, borderColor: C.redBorder }}>
            <Text style={{ color: C.red, fontWeight: '800' }}>🗑️ Complaint Withdraw Karo</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenIn>
  );
}
