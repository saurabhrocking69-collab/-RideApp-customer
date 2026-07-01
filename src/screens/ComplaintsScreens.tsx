import { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import { DotBG, ScreenIn, SlideUp } from '../components/ui';
import { s, C } from '../styles';
import { apiGet, apiPost } from '../../api';

// ─── Status / priority display maps ──────────────────────────────────────────
const STATUS_META: Record<string, { color: string; label: string; icon: string }> = {
  open:               { color: '#F59E0B', label: 'Open',             icon: '📬' },
  under_review:       { color: '#3B82F6', label: 'Under Review',     icon: '🔍' },
  awaiting_response:  { color: '#8B5CF6', label: 'Awaiting Reply',   icon: '💬' },
  evidence_requested: { color: '#EF4444', label: 'Evidence Needed',  icon: '📎' },
  escalated:          { color: '#DC2626', label: 'Escalated',        icon: '🚨' },
  resolved:           { color: '#059669', label: 'Resolved',         icon: '✅' },
  closed:             { color: '#6B7280', label: 'Closed',           icon: '📁' },
  appealed:           { color: '#EC4899', label: 'Appealed',         icon: '⚖️' },
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#DC2626', high: '#F59E0B', normal: '#3B82F6', low: '#9CA3AF',
};

// ─── Rapido-style categories ──────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'safety', icon: '🛡️', label: 'Safety Issue',
    color: '#DC2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.25)',
    sla: '2–4 ghante',
    types: [
      { id: 'harassment',     label: 'Harassment',       desc: 'Verbal abuse ya threatening behavior' },
      { id: 'physical_abuse', label: 'Physical Abuse',   desc: 'Physical harm ya attack' },
      { id: 'reckless_driving', label: 'Reckless Driving', desc: 'Dangerous driving, over-speeding' },
    ],
  },
  {
    id: 'payment', icon: '💰', label: 'Payment Problem',
    color: '#059669', bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.28)',
    sla: '24 ghante',
    types: [
      { id: 'overcharging', label: 'Extra Fare Manga', desc: 'Agreed fare se zyada charge kiya' },
    ],
  },
  {
    id: 'trip', icon: '🗺️', label: 'Trip Problem',
    color: '#D97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.28)',
    sla: '48 ghante',
    types: [
      { id: 'early_trip_end',  label: 'Drop se Pehle Trip Band', desc: 'Driver ne sahi jagah drop nahi kiya' },
      { id: 'route_deviation', label: 'Wrong / Long Route',      desc: 'Lamba ya galat route liya' },
      { id: 'driver_no_show',  label: 'Driver Nahi Aaya',        desc: 'Pickup pe nahi pahuncha' },
    ],
  },
  {
    id: 'behavior', icon: '😤', label: 'Driver Behavior',
    color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)',
    sla: '48 ghante',
    types: [
      { id: 'unprofessional', label: 'Rude / Unprofessional', desc: 'Bura behavior ya attitude' },
    ],
  },
  {
    id: 'vehicle', icon: '🚗', label: 'Vehicle Issue',
    color: '#FF2D78', bg: 'rgba(255,45,120,0.08)', border: 'rgba(255,45,120,0.25)',
    sla: '72 ghante',
    types: [
      { id: 'vehicle_condition', label: 'Dirty / Unsafe Vehicle', desc: 'Gaanda ya unsafe gaadi' },
    ],
  },
  {
    id: 'other', icon: '📝', label: 'Kuch Aur',
    color: '#6B7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.22)',
    sla: '72 ghante',
    types: [
      { id: 'other', label: 'Koi Aur Problem', desc: 'Upar mein nahi aata' },
    ],
  },
];

// ─── ComplaintsScreen — list ──────────────────────────────────────────────────
export function ComplaintsScreen() {
  const { phone, setScreen, complaints, setComplaints, cmpLoading, setCmpLoading, setCmpDetail, setCmpType, setCmpDesc } = useApp();
  const [listRefreshing, setListRefreshing] = useState(false);

  const loadComplaints = useCallback(async (silent = false) => {
    if (!phone) return;
    if (!silent) setCmpLoading(true); else setListRefreshing(true);
    try {
      const d = await apiGet(`/api/complaints?phone=${encodeURIComponent(phone)}`);
      if (!d._error && Array.isArray(d.complaints)) setComplaints(d.complaints);
    } catch {}
    if (!silent) setCmpLoading(false); else setListRefreshing(false);
  }, [phone]);

  useEffect(() => { loadComplaints(); }, [phone]);

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topTitle}>📋 My Complaints</Text>
        <TouchableOpacity onPress={() => { setCmpType(''); setCmpDesc(''); setScreen('complaint-new'); }} style={{ padding: 4 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12, backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>+ New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, padding: 14 }} contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={listRefreshing} onRefresh={() => loadComplaints(true)} colors={[C.pink]} tintColor={C.pink} />}>
        {cmpLoading && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color={C.pink} />
            <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 14 }}>Complaints load ho rahi hain...</Text>
          </View>
        )}

        {!cmpLoading && complaints.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 52 }}>📭</Text>
            <Text style={{ fontSize: 17, fontWeight: '900', color: C.text, marginTop: 14 }}>Koi complaint nahi</Text>
            <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 6, textAlign: 'center' }}>Ride mein koi problem aayi? Complaint file karo</Text>
            <TouchableOpacity onPress={() => { setCmpType(''); setCmpDesc(''); setScreen('complaint-new'); }}
              style={{ backgroundColor: C.pink, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 22, elevation: 6, shadowColor: C.pink, shadowOpacity: 0.4, shadowRadius: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>Complaint File Karo</Text>
            </TouchableOpacity>
          </View>
        )}

        {complaints.map((c: any) => {
          const sm = STATUS_META[c.status] || { color: '#999', label: c.status, icon: '❓' };
          const isAuto = c.source === 'system_auto';
          return (
            <TouchableOpacity key={c.id} onPress={async () => {
              setCmpLoading(true);
              try {
                const r = await apiGet(`/api/complaints/${c.id}?phone=${encodeURIComponent(phone)}`);
                setCmpDetail(r); setScreen('complaint-detail');
              } catch {}
              setCmpLoading(false);
            }} style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 16, marginBottom: 12, elevation: 3, borderWidth: 1.5, borderColor: C.glassBorder, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 }}>

              {/* Status bar at top */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: sm.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 14 }}>{sm.icon}</Text>
                  </View>
                  <Text style={{ color: sm.color, fontWeight: '800', fontSize: 12 }}>{sm.label}</Text>
                  {isAuto && (
                    <View style={{ backgroundColor: 'rgba(124,58,237,0.10)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)' }}>
                      <Text style={{ color: C.purple, fontSize: 9, fontWeight: '800' }}>🤖 AUTO</Text>
                    </View>
                  )}
                </View>
                {c.priority !== 'normal' && (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRIORITY_COLOR[c.priority] }} />
                )}
              </View>

              <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 4 }} numberOfLines={2}>{c.title}</Text>
              <Text style={{ fontSize: 11, color: C.textDim }}>
                {c.complaint_type?.replace(/_/g, ' ')} · {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
              {c.resolution && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                  <Text style={{ fontSize: 11, color: C.green, fontWeight: '700' }}>✅ {c.resolution.replace(/_/g, ' ')}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </ScreenIn>
  );
}

// ─── NewComplaintScreen — Rapido-style 4-step flow ───────────────────────────
export function NewComplaintScreen() {
  const {
    phone, setScreen, rideData,
    cmpType, setCmpType,
    cmpDesc, setCmpDesc,
    cmpLoading, setCmpLoading,
    cmpLinkedRide, setCmpLinkedRide,
    cmpShowRidePicker, setCmpShowRidePicker,
    cmpHistoryRides, setCmpHistoryRides,
    setComplaints,
  } = useApp();

  const [step, setStep] = useState(1);
  const [catId, setCatId] = useState('');

  const selectedCat = CATEGORIES.find(c => c.id === catId);
  const effectiveRide = cmpLinkedRide || (rideData?.ride_id ? rideData : null);
  const STEP_LABELS = ['Ride', 'Category', 'Issue', 'Details'];

  const goBack = () => {
    if (step === 1) { setCmpShowRidePicker(false); setScreen('complaints'); return; }
    if (step === 3) setCmpType('');
    setStep(s => s - 1);
  };

  return (
    <ScreenIn style={s.screen}>
      <DotBG />

      {/* Header */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={goBack} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topTitle}>⚠️ Complaint File Karo</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step progress indicator */}
      <View style={{ backgroundColor: C.bgCard, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: C.glassBorder }}>
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const done = step > n;
          const active = step === n;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', flexDirection: i < STEP_LABELS.length - 1 ? 'row' : 'column' }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: done ? C.green : active ? C.pink : C.glassMid, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: done ? C.green : active ? C.pink : C.glassBorder }}>
                  {done
                    ? <Ionicons name="checkmark" size={14} color="#fff" />
                    : <Text style={{ color: active ? '#fff' : C.textDim, fontSize: 11, fontWeight: '800' }}>{n}</Text>}
                </View>
                <Text style={{ fontSize: 9, fontWeight: '700', color: active ? C.pink : done ? C.green : C.textDim, marginTop: 2 }}>{label}</Text>
              </View>
              {i < STEP_LABELS.length - 1 && (
                <View style={{ flex: 1, height: 2, backgroundColor: step > n ? C.green : C.glassMid, marginBottom: 12, marginHorizontal: 4 }} />
              )}
            </View>
          );
        })}
      </View>

      {/* Ride picker modal */}
      {cmpShowRidePicker && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 99, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '72%', borderTopWidth: 1, borderColor: C.glassBorder }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderColor: C.glassBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '900', fontSize: 16, color: C.text }}>Ride Choose Karo</Text>
              <TouchableOpacity onPress={() => setCmpShowRidePicker(false)}>
                <Text style={{ color: C.pink, fontWeight: '800' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12 }}>
              {cmpHistoryRides.length === 0 && (
                <Text style={{ color: C.textDim, textAlign: 'center', paddingVertical: 24, fontSize: 13 }}>Koi completed rides nahi milein</Text>
              )}
              {cmpHistoryRides.map((r: any) => (
                <TouchableOpacity key={r.id} onPress={() => { setCmpLinkedRide(r); setCmpShowRidePicker(false); }}
                  style={{ backgroundColor: cmpLinkedRide?.id === r.id ? C.pinkGlass : C.glass, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: cmpLinkedRide?.id === r.id ? C.pinkBorder : C.glassBorder }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontWeight: '800', fontSize: 13, color: C.text }}>#{r.id?.toString().slice(-6)} · {r.driver_name || 'Driver'}</Text>
                    <Text style={{ fontWeight: '800', color: C.pink }}>₹{r.fare}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: C.textMuted }} numberOfLines={1}>{r.pickup} → {r.drop_location}</Text>
                  <Text style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>
                    {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {(r.ride_type || '').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>

        {/* ── STEP 1: Ride selection ─────────────────────────────────── */}
        {step === 1 && (
          <SlideUp delay={0}>
            <Text style={{ fontSize: 19, fontWeight: '900', color: C.text, marginBottom: 4 }}>Kaunsi ride pe problem aayi?</Text>
            <Text style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Complaint ke liye ride link karna zaroori hai</Text>

            {effectiveRide ? (
              <View style={{ backgroundColor: C.greenGlass, borderRadius: 18, padding: 16, borderWidth: 2, borderColor: C.greenBorder, marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.green + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20 }}>🔗</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '900', fontSize: 14, color: C.text }}>
                      Ride #{(effectiveRide.id || effectiveRide.ride_id)?.toString().slice(-6)}
                    </Text>
                    <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }} numberOfLines={2}>
                      {effectiveRide.pickup} → {effectiveRide.drop_location || effectiveRide.drop}
                    </Text>
                    {effectiveRide.driver_name && (
                      <Text style={{ fontSize: 11, color: C.green, fontWeight: '700', marginTop: 3 }}>
                        Driver: {effectiveRide.driver_name}
                      </Text>
                    )}
                  </View>
                  {!rideData?.ride_id && (
                    <TouchableOpacity onPress={() => setCmpLinkedRide(null)} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={22} color={C.red} />
                    </TouchableOpacity>
                  )}
                </View>
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
              }} style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 22, alignItems: 'center', gap: 10, borderWidth: 2, borderColor: C.pinkBorder, borderStyle: 'dashed', marginBottom: 20 }}>
                <Text style={{ fontSize: 36 }}>{cmpLoading ? '⏳' : '🔍'}</Text>
                <Text style={{ fontWeight: '900', fontSize: 14, color: C.pink }}>{cmpLoading ? 'Loading rides...' : 'Ride Select Karo'}</Text>
                <Text style={{ fontSize: 12, color: C.textDim }}>Pichli completed rides mein se</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => { if (!effectiveRide) { Alert.alert('Ride Required', 'Pehle ride select karo'); return; } setStep(2); }}
              style={[s.btn, { opacity: effectiveRide ? 1 : 0.45 }]}>
              <Text style={s.btnTxt}>Aage Badho →</Text>
            </TouchableOpacity>
          </SlideUp>
        )}

        {/* ── STEP 2: Category ──────────────────────────────────────── */}
        {step === 2 && (
          <SlideUp delay={0}>
            <Text style={{ fontSize: 19, fontWeight: '900', color: C.text, marginBottom: 4 }}>Kya problem aayi?</Text>
            <Text style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Category choose karo</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity key={cat.id}
                  onPress={() => {
                    setCatId(cat.id);
                    if (cat.types.length === 1) { setCmpType(cat.types[0].id); setStep(4); }
                    else setStep(3);
                  }}
                  style={{ width: '47%', backgroundColor: C.bgCard, borderRadius: 20, padding: 18, alignItems: 'center', gap: 10, borderWidth: 2, borderColor: cat.border, elevation: 4, shadowColor: cat.color, shadowOpacity: 0.15, shadowRadius: 8 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: cat.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 24 }}>{cat.icon}</Text>
                  </View>
                  <Text style={{ fontWeight: '900', fontSize: 12, color: cat.color, textAlign: 'center' }}>{cat.label}</Text>
                  <Text style={{ fontSize: 10, color: C.textDim }}>~{cat.sla}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </SlideUp>
        )}

        {/* ── STEP 3: Sub-issue ─────────────────────────────────────── */}
        {step === 3 && selectedCat && (
          <SlideUp delay={0}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, backgroundColor: selectedCat.bg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: selectedCat.border }}>
              <Text style={{ fontSize: 26 }}>{selectedCat.icon}</Text>
              <View>
                <Text style={{ fontSize: 17, fontWeight: '900', color: selectedCat.color }}>{selectedCat.label}</Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Specific issue choose karo</Text>
              </View>
            </View>
            {selectedCat.types.map(t => (
              <TouchableOpacity key={t.id} onPress={() => { setCmpType(t.id); setStep(4); }}
                style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 2, borderColor: cmpType === t.id ? selectedCat.border : C.glassBorder, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 2 }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: selectedCat.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 20 }}>{selectedCat.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', fontSize: 14, color: C.text }}>{t.label}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{t.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textDim} />
              </TouchableOpacity>
            ))}
          </SlideUp>
        )}

        {/* ── STEP 4: Description + Submit ─────────────────────────── */}
        {step === 4 && selectedCat && cmpType && (
          <SlideUp delay={0}>
            {/* Selected issue summary */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: selectedCat.bg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: selectedCat.border, marginBottom: 20 }}>
              <Text style={{ fontSize: 22 }}>{selectedCat.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '900', fontSize: 13, color: selectedCat.color }}>
                  {selectedCat.types.find(t => t.id === cmpType)?.label || cmpType.replace(/_/g, ' ')}
                </Text>
                <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>⏱️ Resolution ~{selectedCat.sla}</Text>
              </View>
            </View>

            <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 8 }}>Puri baat batao</Text>
            <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>Kya hua, kahan hua, kab hua — jitni detail ho utni do</Text>
            <TextInput
              value={cmpDesc} onChangeText={setCmpDesc}
              placeholder="Minimum 20 characters..."
              multiline
              style={[s.input, {
                height: 130, textAlignVertical: 'top', fontSize: 13,
                backgroundColor: C.bgCard, color: C.text,
                borderColor: cmpDesc.length > 0 && cmpDesc.length < 20 ? C.red : C.glassBorder,
                marginBottom: 4,
              }]}
              placeholderTextColor={C.textDim}
              maxLength={2000}
            />
            <Text style={{ fontSize: 11, textAlign: 'right', marginBottom: 20, color: cmpDesc.length === 0 ? C.textDim : cmpDesc.length < 20 ? C.red : C.green }}>
              {cmpDesc.length < 20 ? `${Math.max(0, 20 - cmpDesc.length)} aur characters chahiye` : `✓ ${cmpDesc.length} characters`}
            </Text>

            {/* SLA info card */}
            <View style={{ backgroundColor: C.bgDeep, borderRadius: 14, padding: 14, marginBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 22 }}>⏱️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', fontSize: 13, color: C.text }}>Expected Resolution Time</Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                  Sppero team ~{selectedCat.sla} mein review karegi
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={async () => {
                if (cmpDesc.trim().length < 20) { Alert.alert('Too Short', 'Kam se kam 20 characters likho'); return; }
                const linked = cmpLinkedRide || (rideData?.ride_id ? rideData : null);
                setCmpLoading(true);
                const data = await apiPost('/api/complaints', {
                  phone,
                  ride_id: linked?.id || linked?.ride_id || null,
                  complaint_type: cmpType,
                  description: cmpDesc.trim(),
                });
                setCmpLoading(false);
                if (data.complaint) {
                  const listData = await apiGet(`/api/complaints?phone=${encodeURIComponent(phone)}`);
                  if (!listData._error && Array.isArray(listData.complaints)) {
                    setComplaints(listData.complaints);
                  } else {
                    setComplaints((prev: any[]) => [data.complaint, ...prev]);
                  }
                  setCmpLinkedRide(null); setCmpType(''); setCmpDesc('');
                  setStep(1); setCatId('');
                  Alert.alert(
                    '✅ Complaint Submit Ho Gayi!',
                    `Sppero team ~${selectedCat.sla} mein review karegi.\n\nID: #${String(data.complaint.id).slice(-8).toUpperCase()}`,
                    [{ text: 'Track Karo', onPress: () => setScreen('complaints') }],
                  );
                } else {
                  Alert.alert('❌ Error', data.error || data.message || 'Submit fail hua — dobara try karo');
                }
              }}
              style={[s.btn, { opacity: cmpLoading || cmpDesc.trim().length < 20 ? 0.5 : 1 }]}
              disabled={cmpLoading || cmpDesc.trim().length < 20}>
              <Text style={s.btnTxt}>{cmpLoading ? 'Submitting...' : '📤 Complaint Submit Karo'}</Text>
            </TouchableOpacity>
          </SlideUp>
        )}
      </ScrollView>
    </ScreenIn>
  );
}

// ─── ComplaintDetailScreen ────────────────────────────────────────────────────
export function ComplaintDetailScreen() {
  const { phone, setScreen, cmpDetail, setCmpDetail, cmpMsg, setCmpMsg, setComplaints } = useApp();

  // hooks must be at the top — before any early returns
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // auto-refresh on mount to get latest status & messages from server
  useEffect(() => {
    const id = cmpDetail?.complaint?.id;
    if (!id || !phone) return;
    setRefreshing(true);
    apiGet(`/api/complaints/${id}?phone=${encodeURIComponent(phone)}`)
      .then(r => { if (r && !r._error && !r.error) setCmpDetail(r); })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  if (!cmpDetail) return null;
  const c = cmpDetail.complaint;
  if (!c) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ fontSize: 32, marginBottom: 12 }}>⚠️</Text>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 8 }}>Complaint load nahi hui</Text>
      <Text style={{ fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 20 }}>{cmpDetail?.error || 'Server se data nahi mila'}</Text>
      <TouchableOpacity onPress={() => setScreen('complaints')} style={{ backgroundColor: '#e94560', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 }}>
        <Text style={{ color: '#fff', fontWeight: '800' }}>← Wapas Jao</Text>
      </TouchableOpacity>
    </View>
  );
  const msgs: any[] = cmpDetail.messages || [];
  const evidence: any[] = cmpDetail.evidence || [];
  const timeline: any[] = cmpDetail.timeline || [];
  const isClosed = ['resolved', 'closed'].includes(c?.status);
  const sm = STATUS_META[c?.status] || { color: '#999', label: c?.status, icon: '❓' };
  const isAuto = c?.source === 'system_auto';

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await apiGet(`/api/complaints/${c.id}?phone=${encodeURIComponent(phone)}`);
      if (r && !r._error && !r.error) setCmpDetail(r);
    } catch {}
    setRefreshing(false);
  };

  const uploadEvidence = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission', 'Gallery access chahiye'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.6 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const dataUri = `data:image/jpeg;base64,${asset.base64}`;
    setUploading(true);
    try {
      const r = await apiPost(`/api/complaints/${c.id}/evidence`, { phone, image: dataUri, caption: 'User evidence' });
      if (r.url) {
        await refresh();
        Alert.alert('✅ Uploaded', 'Evidence submit ho gaya!');
      } else { Alert.alert('Error', r.error || 'Upload fail hua'); }
    } catch { Alert.alert('Error', 'Upload fail hua — retry karo'); }
    setUploading(false);
  };

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('complaints')} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topTitle}>Complaint Detail</Text>
        <TouchableOpacity onPress={refresh} disabled={refreshing} style={{ padding: 4, opacity: refreshing ? 0.5 : 1 }}>
          {refreshing
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="refresh" size={20} color="#fff" />}
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>

        {/* Status card */}
        <View style={{ backgroundColor: sm.color, borderRadius: 16, padding: 16, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 26 }}>{sm.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{sm.label}</Text>
            {c.assigned_admin && <Text style={{ color: 'rgba(255,255,255,0.80)', fontSize: 12, marginTop: 2 }}>Assigned: {c.assigned_admin}</Text>}
          </View>
          {c.priority !== 'normal' && (
            <View style={{ backgroundColor: 'rgba(0,0,0,0.20)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{c.priority?.toUpperCase()}</Text>
            </View>
          )}
        </View>
        <Text style={{ color: C.textDim, fontSize: 10, textAlign: 'right', marginBottom: 10 }}>
          🕐 Updated: {new Date(c.updated_at || c.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </Text>

        {/* Auto-detected badge */}
        {isAuto && (
          <View style={{ backgroundColor: 'rgba(124,58,237,0.10)', borderRadius: 14, padding: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)' }}>
            <Text style={{ fontSize: 20 }}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', fontSize: 13, color: C.purple }}>System ne Auto-Detect Kiya</Text>
              <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Yeh complaint system ne automatically raise ki — aapko manually file nahi karna pada</Text>
            </View>
          </View>
        )}

        {c.status === 'evidence_requested' && (
          <View style={{ backgroundColor: '#FFF7ED', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 2, borderColor: '#FB923C', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Text style={{ fontSize: 26 }}>📎</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#EA580C', marginBottom: 4 }}>Admin ne Proof Manga Hai!</Text>
              <Text style={{ fontSize: 12, color: '#9A3412', lineHeight: 18 }}>Apni complaint prove karne ke liye screenshot ya photo upload karo. Bina proof ke complaint close ho sakti hai.</Text>
              <TouchableOpacity onPress={uploadEvidence} disabled={uploading}
                style={{ backgroundColor: '#EA580C', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, marginTop: 12, alignItems: 'center', opacity: uploading ? 0.6 : 1 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>{uploading ? '⏳ Uploading...' : '📸 Photo/Screenshot Upload Karo'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Main complaint info */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 17, fontWeight: '900', color: C.text, marginBottom: 6 }}>{c.title}</Text>
          <Text style={{ fontSize: 12, color: C.pink, fontWeight: '700', marginBottom: 10 }}>
            {c.complaint_type?.replace(/_/g, ' ')} · {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 20 }}>{c.description}</Text>
          {c.filed_against_name && <Text style={{ fontSize: 12, color: C.textDim, marginTop: 8 }}>Driver: {c.filed_against_name}</Text>}
          {c.pickup && <Text style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Route: {c.pickup} → {c.drop_location}</Text>}
        </View>

        {/* Resolution */}
        {c.resolution && (
          <View style={{ backgroundColor: C.greenGlass, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.greenBorder }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: C.green, marginBottom: 6 }}>✅ Resolution</Text>
            <Text style={{ fontSize: 13, color: C.green, fontWeight: '700' }}>{c.resolution?.replace(/_/g, ' ')}</Text>
            {c.resolution_note && <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 6, lineHeight: 18 }}>{c.resolution_note}</Text>}
            {c.action_taken && <Text style={{ fontSize: 12, color: C.green, marginTop: 4, opacity: 0.8 }}>Action: {c.action_taken}</Text>}
            {(c.refund_amount > 0) && (
              <View style={{ marginTop: 10, backgroundColor: 'rgba(22,163,74,0.12)', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(22,163,74,0.3)' }}>
                <Text style={{ fontSize: 18 }}>💰</Text>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: C.green }}>₹{parseFloat(c.refund_amount).toFixed(0)} Refund Mila!</Text>
                  <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Aapke wallet mein credit ho gaya hai</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Evidence */}
        {evidence.length > 0 && (
          <View style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 10 }}>📎 Evidence ({evidence.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {evidence.map((e: any, i: number) => (
                <Image key={i} source={{ uri: e.file_url }} style={{ width: 90, height: 80, borderRadius: 12, marginRight: 10, borderWidth: 1.5, borderColor: C.glassBorder }} />
              ))}
            </ScrollView>
          </View>
        )}

        {!isClosed && (
          <View style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: c.status === 'evidence_requested' ? '#FB923C' : C.glassBorder }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 8 }}>📎 Evidence Upload Karo</Text>
            <Text style={{ fontSize: 12, color: C.textMuted, marginBottom: 12, lineHeight: 18 }}>Screenshot, photo, ya koi bhi proof upload karo jo aapki complaint support kare (max 5)</Text>
            <TouchableOpacity onPress={uploadEvidence} disabled={uploading}
              style={{ backgroundColor: c.status === 'evidence_requested' ? '#EA580C' : C.pink, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: uploading ? 0.6 : 1 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{uploading ? '⏳ Uploading...' : '📸 Photo Upload Karo'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Messages */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12 }}>💬 Messages ({msgs.length})</Text>
          {msgs.length === 0 && <Text style={{ fontSize: 12, color: C.textDim, textAlign: 'center', paddingVertical: 8 }}>Koi message nahi abhi</Text>}
          {msgs.map((m: any, i: number) => {
            const isAdmin = m.sender_role === 'admin';
            const isDriver = m.sender_role === 'driver';
            return (
              <View key={i} style={{ marginBottom: 10, padding: 12, backgroundColor: isAdmin ? C.glassMid : isDriver ? C.yellowGlass : C.pinkGlass, borderRadius: 12, borderWidth: 1, borderColor: isAdmin ? C.glassBorder : isDriver ? C.yellowBorder : C.pinkBorder }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: isAdmin ? C.purple : isDriver ? C.yellow : C.pink, marginBottom: 4 }}>
                  {m.sender_name || m.sender_role} · {new Date(m.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={{ fontSize: 13, color: C.text, lineHeight: 18 }}>{m.message}</Text>
              </View>
            );
          })}
        </View>

        {/* Reply box */}
        {!isClosed && (
          <View style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 8 }}>Reply Karo</Text>
            <TextInput value={cmpMsg} onChangeText={setCmpMsg} placeholder="Message type karo..." multiline
              placeholderTextColor={C.textDim}
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

        {/* Timeline */}
        {timeline.length > 0 && (
          <View style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, borderWidth: 1, borderColor: C.glassBorder }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12 }}>📅 Timeline</Text>
            {timeline.map((t: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 10 }}>
                <View style={{ width: 28, alignItems: 'center' }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.pink, marginTop: 3 }} />
                  {i < timeline.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: C.glassBorder, marginTop: 4 }} />}
                </View>
                <View style={{ flex: 1, paddingLeft: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>{t.description}</Text>
                  <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                    {new Date(t.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Appeal */}
        {c.status === 'resolved' && (
          <TouchableOpacity onPress={() => Alert.prompt('Appeal', 'Aap kyun disagree karte hain? (20+ characters)', async (reason) => {
            if (!reason || reason.length < 20) { Alert.alert('Too short', 'Reason 20+ characters ka likho'); return; }
            try {
              await apiPost(`/api/complaints/${c.id}/appeal`, { phone, reason });
              const r = await apiGet(`/api/complaints/${c.id}?phone=${encodeURIComponent(phone)}`);
              setCmpDetail(r);
              Alert.alert('Appeal Submit', 'Dobara review hoga');
            } catch {}
          })} style={{ backgroundColor: C.yellowGlass, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.yellowBorder, alignItems: 'center' }}>
            <Text style={{ color: C.yellow, fontWeight: '800' }}>⚖️ Resolution se Disagree? Appeal Karo</Text>
          </TouchableOpacity>
        )}

        {/* Withdraw */}
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
