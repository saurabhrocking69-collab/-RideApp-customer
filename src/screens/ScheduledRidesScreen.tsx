import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { C } from '../styles';

const AMBER    = '#F59E0B';
const AMBER_BG = '#FFFBEB';
const AMBER_BD = '#FDE68A';

const VEHICLE_EMOJI: Record<string, string> = {
  bike: '🏍️', auto: '🛺', car: '🚕', eriksha: '🛵',
  luxury: '🚙', green_bike: '⚡', electric_auto: '🌿',
};

function statusLabel(status: string, srStatus: string) {
  if (status === 'scheduled_cancelled' || srStatus === 'cancelled') return { text: 'Cancelled', color: C.red };
  if (srStatus === 'failed') return { text: 'No Driver', color: C.red };
  if (srStatus === 'dispatched' || status === 'requested') return { text: 'Matching…', color: C.green };
  if (['matched', 'arrived', 'started', 'completed', 'payment'].includes(status))
    return { text: status.charAt(0).toUpperCase() + status.slice(1), color: C.green };
  return { text: 'Scheduled', color: AMBER };
}

function formatScheduledAt(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  return { date, time };
}

function RideCard({ ride, onTap }: { ride: any; onTap: () => void }) {
  const sl   = statusLabel(ride.status, ride.sr_status);
  const { date, time } = formatScheduledAt(ride.scheduled_at);
  const emoji = VEHICLE_EMOJI[ride.ride_type] || '🚗';
  const upcoming = new Date(ride.scheduled_at) > new Date();

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onTap}
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: sl.color === AMBER ? AMBER_BD : C.glassBorder,
        elevation: 3,
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Top color strip for upcoming rides */}
      {upcoming && sl.color === AMBER && (
        <View style={{ height: 3, backgroundColor: AMBER }} />
      )}

      <View style={{ padding: 16 }}>
        {/* Row 1: vehicle + status badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ fontSize: 28, marginRight: 8 }}>{emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.text, textTransform: 'capitalize' }}>
              {ride.ride_type.replace('_', ' ')}
            </Text>
            <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
              {(parseFloat(ride.distance_km) || 0).toFixed(1)} km
            </Text>
          </View>
          <View style={{
            backgroundColor: sl.color + '18', borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 4,
            borderWidth: 1, borderColor: sl.color + '40',
          }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: sl.color }}>
              {sl.text}
            </Text>
          </View>
        </View>

        {/* Row 2: scheduled time */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: AMBER_BG, borderRadius: 8, padding: 10,
          borderWidth: 1, borderColor: AMBER_BD, marginBottom: 10,
        }}>
          <Ionicons name="calendar-outline" size={14} color={AMBER} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E' }}>{date}</Text>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#92400E', opacity: 0.4 }} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E' }}>{time}</Text>
        </View>

        {/* Row 3: route */}
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginTop: 4 }} />
            <Text style={{ flex: 1, fontSize: 12, color: C.text, fontWeight: '600' }} numberOfLines={1}>
              {ride.pickup}
            </Text>
          </View>
          <View style={{ width: 1.5, height: 10, backgroundColor: C.glassBorder, marginLeft: 3.5 }} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: C.red, marginTop: 4 }} />
            <Text style={{ flex: 1, fontSize: 12, color: C.text, fontWeight: '600' }} numberOfLines={1}>
              {ride.drop_location}
            </Text>
          </View>
        </View>

        {/* Row 4: fare */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: C.text }}>₹{Math.round(ride.fare - (ride.discount || 0))}</Text>
          {ride.discount > 0 && (
            <Text style={{ fontSize: 11, color: C.textDim, textDecorationLine: 'line-through', marginLeft: 6 }}>
              ₹{ride.fare}
            </Text>
          )}
          <Ionicons name="chevron-forward" size={16} color={C.textDim} style={{ marginLeft: 6 }} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function ScheduledRidesScreen() {
  const { phone, setScreen, setSelectedScheduledRide, setScheduleIntent } = useApp() as any;
  const insets = useSafeAreaInsets();
  const [rides, setRides]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { apiGet } = await import('../../api');
      const data = await apiGet(`/api/scheduled/my-rides?phone=${phone}`);
      setRides(data.scheduled_rides || []);
    } catch (_e) {
      setError('Could not load scheduled rides');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => { load(); }, [load]);

  const upcoming  = rides.filter(r => r.status === 'scheduled' && new Date(r.scheduled_at) > new Date());
  const past      = rides.filter(r => !upcoming.includes(r));

  return (
    <View style={{ flex: 1, backgroundColor: '#F0F2F5' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#fff',
        paddingTop: insets.top + 8, paddingBottom: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1, borderBottomColor: C.glassBorder,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        elevation: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
      }}>
        <TouchableOpacity onPress={() => setScreen('home')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>Scheduled Rides</Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>Book up to 2 days in advance</Text>
        </View>
        <View style={{ backgroundColor: AMBER_BG, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: AMBER_BD }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: AMBER }}>📅 Schedule</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={AMBER} />
          <Text style={{ marginTop: 12, color: C.textMuted, fontSize: 13 }}>Loading rides…</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠️</Text>
          <Text style={{ color: C.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>{error}</Text>
          <TouchableOpacity onPress={load} style={{ backgroundColor: AMBER, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : rides.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Text style={{ fontSize: 56, marginBottom: 16 }}>📅</Text>
          <Text style={{ fontSize: 18, fontWeight: '900', color: C.text, marginBottom: 8 }}>No Scheduled Rides</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 }}>
            Book a ride in advance from the Booking screen using the schedule option.
          </Text>
          <TouchableOpacity
            onPress={() => { setScheduleIntent(true); setScreen('booking'); }}
            style={{ marginTop: 24, backgroundColor: AMBER, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>Book a Scheduled Ride</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {upcoming.length > 0 && (
            <>
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.textMuted, letterSpacing: 0.8, marginBottom: 10 }}>
                UPCOMING
              </Text>
              {upcoming.map(ride => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  onTap={() => {
                    setSelectedScheduledRide(ride);
                    setScreen('scheduled-detail');
                  }}
                />
              ))}
            </>
          )}

          {past.length > 0 && (
            <>
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.textMuted, letterSpacing: 0.8, marginTop: 8, marginBottom: 10 }}>
                PAST
              </Text>
              {past.map(ride => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  onTap={() => {
                    setSelectedScheduledRide(ride);
                    setScreen('scheduled-detail');
                  }}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
