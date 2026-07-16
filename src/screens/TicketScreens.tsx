import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Platform,
  RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { DotBG, FadeIn, ScreenIn } from '../components/ui';
import { s, C } from '../styles';
import { API } from '../constants';

// ── Shared helpers ────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  urgent: C.red,
  high:   C.yellow,
  normal: '#3B82F6',
  low:    C.textDim,
};

const PRIORITY_BG: Record<string, string> = {
  urgent: 'rgba(239,68,68,0.10)',
  high:   'rgba(245,158,11,0.10)',
  normal: 'rgba(59,130,246,0.10)',
  low:    'rgba(148,163,184,0.10)',
};

const STATUS_COLOR: Record<string, string> = {
  open:        C.yellow,
  in_progress: '#3B82F6',
  resolved:    C.green,
};

const STATUS_BG: Record<string, string> = {
  open:        'rgba(245,158,11,0.10)',
  in_progress: 'rgba(59,130,246,0.10)',
  resolved:    'rgba(5,150,105,0.10)',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', resolved: 'Resolved',
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function fmtTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Category config ───────────────────────────────────────────────────────────

const CUSTOMER_CATEGORIES = [
  { key: 'safety_concern',    icon: '🚨', label: 'Safety\nConcern',     priority: 'urgent' },
  { key: 'driver_behavior',   icon: '😠', label: 'Driver\nBehavior',    priority: 'urgent' },
  { key: 'early_drop',        icon: '📍', label: 'Early Drop /\nWrong Route', priority: 'high' },
  { key: 'overcharge',        icon: '💸', label: 'Overcharge /\nRefund', priority: 'high' },
  { key: 'driver_cancelled',  icon: '🚫', label: 'Driver Didn\'t\nArrive', priority: 'high' },
  { key: 'vehicle_condition', icon: '🚗', label: 'Vehicle\nCondition',  priority: 'normal' },
  { key: 'wallet_issue',      icon: '💳', label: 'Wallet /\nPayment',   priority: 'normal' },
  { key: 'app_issue',         icon: '📱', label: 'App Issue',           priority: 'low' },
  { key: 'other',             icon: '📝', label: 'Other',               priority: 'low' },
];

// ═══════════════════════════════════════════════════════════════════════════
// NEW TICKET SCREEN
// ═══════════════════════════════════════════════════════════════════════════

export function NewTicketScreen() {
  const { phone, setScreen, setTab, historyRides } = useApp();

  const [category, setCategory]       = useState('');
  const [description, setDescription] = useState('');
  const [rideId, setRideId]           = useState('');
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState<{ ticket_no: string; sla_hours: number } | null>(null);

  const selectedCat = CUSTOMER_CATEGORIES.find(c => c.key === category);
  const canSubmit   = category && description.trim().length >= 10 && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, role: 'customer', category, description: description.trim(), ride_id: rideId || undefined }),
      });
      const d = await r.json();
      if (d.error) { Alert.alert('Error', d.error); return; }
      setSuccess({ ticket_no: d.ticket_no, sla_hours: d.sla_hours });
    } catch { Alert.alert('Error', 'Could not submit. Please try again.'); }
    finally { setLoading(false); }
  };

  const back = () => { setScreen('support'); setTab('profile'); };

  if (success) {
    return (
      <ScreenIn style={s.screen}>
        <DotBG />
        <View style={s.topBar}>
          <TouchableOpacity onPress={back} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.topTitle}>Ticket Filed</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <FadeIn>
            <View style={{ backgroundColor: C.bgCard, borderRadius: 24, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: C.glassBorder, elevation: 4 }}>
              <Text style={{ fontSize: 52, marginBottom: 16 }}>✅</Text>
              <Text style={{ fontSize: 18, fontWeight: '900', color: C.text, marginBottom: 8 }}>Ticket Submitted!</Text>
              <View style={{ backgroundColor: C.pinkGlass, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 16, borderWidth: 1, borderColor: C.pinkBorder }}>
                <Text style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: '900', color: C.pink, letterSpacing: 1 }}>{success.ticket_no}</Text>
              </View>
              <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
                We will respond within{' '}
                <Text style={{ fontWeight: '800', color: C.text }}>{success.sla_hours} hours</Text>.
                {'\n'}You'll get a notification when we reply.
              </Text>
              <TouchableOpacity
                onPress={() => setScreen('tickets')}
                style={{ backgroundColor: C.pink, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>View My Tickets</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={back} style={{ paddingVertical: 10 }}>
                <Text style={{ color: C.textMuted, fontWeight: '700', fontSize: 13 }}>Back to Support</Text>
              </TouchableOpacity>
            </View>
          </FadeIn>
        </View>
      </ScreenIn>
    );
  }

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={back} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topTitle}>Raise a Ticket</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          {/* Category grid */}
          <Text style={{ fontSize: 12, fontWeight: '800', color: C.textMuted, letterSpacing: 1.2, marginBottom: 12 }}>SELECT ISSUE TYPE</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            {CUSTOMER_CATEGORIES.map(cat => {
              const isSelected = category === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => setCategory(cat.key)}
                  style={{
                    width: '30%', minWidth: 100, flexGrow: 1,
                    backgroundColor: isSelected ? C.pinkGlass : C.bgCard,
                    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8,
                    alignItems: 'center', borderWidth: 1.5,
                    borderColor: isSelected ? C.pink : C.glassBorder,
                    elevation: isSelected ? 3 : 1,
                  }}>
                  <Text style={{ fontSize: 24, marginBottom: 6 }}>{cat.icon}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? C.pink : C.text, textAlign: 'center', lineHeight: 15 }}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Priority indicator when category selected */}
          {selectedCat && (
            <FadeIn>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, backgroundColor: PRIORITY_BG[selectedCat.priority], borderRadius: 10, padding: 10, borderWidth: 1, borderColor: PRIORITY_COLOR[selectedCat.priority] + '44' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRIORITY_COLOR[selectedCat.priority], marginRight: 8 }} />
                <Text style={{ fontSize: 12, color: PRIORITY_COLOR[selectedCat.priority], fontWeight: '800' }}>
                  {selectedCat.priority.toUpperCase()} PRIORITY
                </Text>
                <Text style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>
                  · We respond within {selectedCat.priority === 'urgent' ? '4h' : selectedCat.priority === 'high' ? '24h' : selectedCat.priority === 'normal' ? '48h' : '72h'}
                </Text>
              </View>
            </FadeIn>
          )}

          {/* Description */}
          <Text style={{ fontSize: 12, fontWeight: '800', color: C.textMuted, letterSpacing: 1.2, marginBottom: 10 }}>DESCRIBE THE ISSUE</Text>
          <View style={{ backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1.5, borderColor: C.glassBorder, marginBottom: 8, elevation: 1 }}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Tell us what happened in detail... (minimum 10 characters)"
              placeholderTextColor={C.textDim}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              style={{ padding: 14, fontSize: 14, color: C.text, minHeight: 120 }}
            />
          </View>
          <Text style={{ fontSize: 11, color: description.length < 10 ? C.textDim : C.green, fontWeight: '700', textAlign: 'right', marginBottom: 20 }}>
            {description.length} chars {description.length < 10 ? `(${10 - description.length} more needed)` : '✓'}
          </Text>

          {/* Optional ride link */}
          {(historyRides || []).length > 0 && (
            <>
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.textMuted, letterSpacing: 1.2, marginBottom: 10 }}>LINK A RIDE (OPTIONAL)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                <TouchableOpacity
                  onPress={() => setRideId('')}
                  style={{
                    marginRight: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                    backgroundColor: !rideId ? C.pinkGlass : C.bgCard,
                    borderWidth: 1.5, borderColor: !rideId ? C.pink : C.glassBorder,
                  }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: !rideId ? C.pink : C.textMuted }}>No ride</Text>
                </TouchableOpacity>
                {(historyRides || []).slice(0, 5).map((r: any) => {
                  const rid = String(r.id || r.ride_id);
                  const isSelected = rideId === rid;
                  return (
                    <TouchableOpacity
                      key={rid}
                      onPress={() => setRideId(isSelected ? '' : rid)}
                      style={{
                        marginRight: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                        backgroundColor: isSelected ? C.pinkGlass : C.bgCard,
                        borderWidth: 1.5, borderColor: isSelected ? C.pink : C.glassBorder,
                        maxWidth: 160,
                      }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: isSelected ? C.pink : C.text }} numberOfLines={1}>
                        {(r.drop_location || r.drop || '').split(',')[0] || 'Ride'}
                      </Text>
                      <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                        {fmtDate(r.created_at || '')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Submit */}
          <TouchableOpacity
            onPress={submit}
            disabled={!canSubmit}
            style={{
              backgroundColor: canSubmit ? C.pink : C.glassBorder,
              borderRadius: 16, paddingVertical: 16, alignItems: 'center', elevation: canSubmit ? 4 : 0,
            }}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Submit Ticket</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenIn>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TICKET LIST + DETAIL SCREEN
// ═══════════════════════════════════════════════════════════════════════════

export function TicketListScreen() {
  const { phone, setScreen, setTab } = useApp();

  const [tickets, setTickets]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [ticketDetail, setTicketDetail] = useState<{ ticket: any; messages: any[]; attachments: any[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply]               = useState('');
  const [replying, setReplying]         = useState(false);
  const activeTicketRef                 = useRef<any>(null);

  const back = () => { setScreen('support'); setTab('profile'); };

  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`${API}/api/support/tickets?phone=${encodeURIComponent(phone)}&role=customer`);
      const d = await r.json();
      setTickets(d.tickets || []);
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false); setRefreshing(false); }
  }, [phone]);

  const refreshDetail = useCallback(async (silent = false) => {
    const t = activeTicketRef.current;
    if (!t) return;
    if (!silent) setDetailLoading(true);
    try {
      const r = await fetch(`${API}/api/support/tickets/${t.id}?phone=${encodeURIComponent(phone)}`);
      const d = await r.json();
      setTicketDetail(d);
    } catch { /* silent */ }
    finally { if (!silent) setDetailLoading(false); }
  }, [phone]);

  // On mount: load list; on foreground return: refresh list or open ticket detail
  useEffect(() => {
    loadTickets();
    const sub = AppState.addEventListener('change', s => {
      if (s !== 'active') return;
      if (activeTicketRef.current) refreshDetail(true);
      else loadTickets(true);
    });
    return () => sub.remove();
  }, [loadTickets, refreshDetail]);

  // Keep ref in sync so AppState handler always sees current ticket
  useEffect(() => { activeTicketRef.current = activeTicket; }, [activeTicket]);

  const openDetail = async (t: any) => {
    setActiveTicket(t);
    setDetailLoading(true);
    setTicketDetail(null);
    try {
      const r = await fetch(`${API}/api/support/tickets/${t.id}?phone=${encodeURIComponent(phone)}`);
      const d = await r.json();
      setTicketDetail(d);
    } catch { /* silent */ }
    finally { setDetailLoading(false); }
  };

  const sendReply = async () => {
    if (!reply.trim() || !activeTicket || replying) return;
    setReplying(true);
    try {
      await fetch(`${API}/api/support/tickets/${activeTicket.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: reply.trim() }),
      });
      setReply('');
      await refreshDetail(true);
    } catch { Alert.alert('Error', 'Could not send reply. Try again.'); }
    finally { setReplying(false); }
  };

  // ── Detail view ────────────────────────────────────────────────────────────
  if (activeTicket) {
    const ticket = ticketDetail?.ticket ?? activeTicket;
    const messages = ticketDetail?.messages ?? [];

    return (
      <ScreenIn style={s.screen}>
        <DotBG />
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => { setActiveTicket(null); setTicketDetail(null); loadTickets(true); }} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.topTitle} numberOfLines={1}>{activeTicket.ticket_no || 'Ticket'}</Text>
          <TouchableOpacity onPress={() => refreshDetail(false)} style={{ padding: 4 }}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
            {/* Ticket info card */}
            <View style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.glassBorder, elevation: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                <Text style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: '800', color: C.pink }}>{ticket.ticket_no}</Text>
                <View style={{ backgroundColor: STATUS_BG[ticket.status], borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: STATUS_COLOR[ticket.status] }}>{STATUS_LABEL[ticket.status] || ticket.status}</Text>
                </View>
                <View style={{ backgroundColor: PRIORITY_BG[ticket.priority], borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: PRIORITY_COLOR[ticket.priority] }}>{(ticket.priority || '').toUpperCase()}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '900', color: C.text, marginBottom: 4 }}>{ticket.title}</Text>
              <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 18 }}>{ticket.description}</Text>
              <Text style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>Filed {fmtDate(ticket.created_at)}</Text>
              {ticket.status === 'resolved' && ticket.resolution_note && (
                <View style={{ marginTop: 12, backgroundColor: 'rgba(5,150,105,0.08)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(5,150,105,0.25)' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: C.green, marginBottom: 4 }}>RESOLVED</Text>
                  <Text style={{ fontSize: 12, color: C.text, lineHeight: 18 }}>{ticket.resolution_note}</Text>
                </View>
              )}
            </View>

            {/* Message thread */}
            <Text style={{ fontSize: 11, fontWeight: '800', color: C.textMuted, letterSpacing: 1.2, marginBottom: 12 }}>MESSAGE THREAD</Text>
            {detailLoading && (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <ActivityIndicator color={C.pink} />
              </View>
            )}
            {messages.map((msg: any, i: number) => {
              const isUser   = msg.sender === 'user';
              const isSystem = msg.sender === 'system';
              if (isSystem) {
                return (
                  <View key={i} style={{ alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, color: C.textDim, backgroundColor: C.glassMid, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>{msg.message}</Text>
                  </View>
                );
              }
              return (
                <View key={i} style={{ marginBottom: 12, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                  <View style={{
                    maxWidth: '80%',
                    backgroundColor: isUser ? C.pinkGlass : C.bgCard,
                    borderRadius: isUser ? '18px 18px 4px 18px' as any : '18px 18px 18px 4px' as any,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: isUser ? C.pinkBorder : C.glassBorder,
                    elevation: 1,
                  }}>
                    {!isUser && <Text style={{ fontSize: 10, fontWeight: '800', color: C.pink, marginBottom: 4 }}>Support Team</Text>}
                    <Text style={{ fontSize: 13, color: C.text, lineHeight: 19 }}>{msg.message}</Text>
                    <Text style={{ fontSize: 10, color: C.textDim, marginTop: 4, textAlign: isUser ? 'right' : 'left' }}>{fmtTimeAgo(msg.created_at)}</Text>
                  </View>
                </View>
              );
            })}
            {messages.length === 0 && !detailLoading && (
              <Text style={{ color: C.textDim, fontSize: 13, textAlign: 'center', paddingVertical: 10 }}>No messages yet. We'll reply soon.</Text>
            )}
          </ScrollView>

          {/* Reply input */}
          {ticket.status !== 'resolved' && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 10, backgroundColor: C.bgCard, borderTopWidth: 1, borderTopColor: C.glassBorder }}>
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder="Write a message..."
                placeholderTextColor={C.textDim}
                multiline
                style={{ flex: 1, backgroundColor: C.glassMid, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.text, maxHeight: 100, borderWidth: 1, borderColor: C.glassBorder }}
              />
              <TouchableOpacity
                onPress={sendReply}
                disabled={!reply.trim() || replying}
                style={{ backgroundColor: reply.trim() ? C.pink : C.glassBorder, borderRadius: 14, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                {replying
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="send" size={18} color="#fff" />
                }
              </TouchableOpacity>
            </View>
          )}
          {ticket.status === 'resolved' && (
            <View style={{ padding: 12, backgroundColor: 'rgba(5,150,105,0.06)', borderTopWidth: 1, borderTopColor: 'rgba(5,150,105,0.2)', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: C.green, fontWeight: '700' }}>This ticket has been resolved</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </ScreenIn>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={back} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topTitle}>My Tickets</Text>
        <TouchableOpacity onPress={() => setScreen('ticket-new')} style={{ padding: 4 }}>
          <Ionicons name="add-circle" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.pink} />
          <Text style={{ color: C.textMuted, marginTop: 12, fontSize: 13 }}>Loading tickets...</Text>
        </View>
      ) : tickets.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>🎫</Text>
          <Text style={{ fontSize: 17, fontWeight: '900', color: C.text, marginBottom: 8 }}>No tickets yet</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
            Have an issue? Raise a support ticket and our team will help you.
          </Text>
          <TouchableOpacity
            onPress={() => setScreen('ticket-new')}
            style={{ backgroundColor: C.pink, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Raise a Ticket</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTickets(); }} tintColor={C.pink} />}
        >
          {tickets.map((t: any) => {
            const unread = parseInt(t.unread_replies) || 0;
            return (
              <TouchableOpacity key={t.id} onPress={() => openDetail(t)}
                style={{ backgroundColor: C.bgCard, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: unread > 0 ? C.pink : C.glassBorder, elevation: unread > 0 ? 3 : 1 }}>
                {/* Top row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <Text style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: '800', color: C.pink }}>{t.ticket_no || `#${t.id}`}</Text>
                  <View style={{ backgroundColor: STATUS_BG[t.status], borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: STATUS_COLOR[t.status] }}>{STATUS_LABEL[t.status] || t.status}</Text>
                  </View>
                  <View style={{ backgroundColor: PRIORITY_BG[t.priority], borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: PRIORITY_COLOR[t.priority] }}>{(t.priority || '').toUpperCase()}</Text>
                  </View>
                  {unread > 0 && (
                    <View style={{ marginLeft: 'auto', backgroundColor: C.pink, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>{unread} new</Text>
                    </View>
                  )}
                </View>
                {/* Title */}
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 4 }}>{t.title}</Text>
                {/* Meta */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, color: C.textMuted }}>{fmtDate(t.created_at)}</Text>
                  {t.status === 'resolved'
                    ? <Text style={{ fontSize: 11, color: C.green, fontWeight: '700' }}>Resolved ✓</Text>
                    : <Ionicons name="chevron-forward" size={16} color={C.textDim} />
                  }
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </ScreenIn>
  );
}
