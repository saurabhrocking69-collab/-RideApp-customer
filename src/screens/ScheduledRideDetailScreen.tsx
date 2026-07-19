import { useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { C } from '../styles';

const AMBER    = '#F59E0B';
const AMBER_BG = '#FFFBEB';
const AMBER_BD = '#FDE68A';

const CANCEL_REASONS = [
  'Found better price elsewhere',
  'Change of plans',
  'Wrong pickup location',
  'Others',
];

const VEHICLE_EMOJI: Record<string, string> = {
  bike: '🏍️', auto: '🛺', car: '🚕', eriksha: '🛵',
  luxury: '🚙', green_bike: '⚡', electric_auto: '🌿',
};

function formatScheduledAt(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const time = d.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });
  return { date, time };
}

function statusLabel(status: string, srStatus: string) {
  if (status === 'scheduled_cancelled' || srStatus === 'cancelled')
    return { text: 'Cancelled', color: C.red };
  if (srStatus === 'failed')
    return { text: 'No Driver Found', color: C.red };
  if (srStatus === 'dispatched' || status === 'requested')
    return { text: 'Matching Driver…', color: C.green };
  if (['matched', 'arrived', 'started'].includes(status))
    return { text: 'Driver Assigned', color: C.green };
  if (status === 'completed')
    return { text: 'Completed', color: C.green };
  return { text: 'Scheduled', color: AMBER };
}

// ── Cancel reason modal ───────────────────────────────────────────────────────
function CancelModal({
  visible,
  onCancel,
  onConfirm,
  loading,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [selected, setSelected] = useState('');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 8, paddingBottom: 32, paddingHorizontal: 20,
        }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', marginBottom: 20 }} />
          <Text style={{ fontSize: 18, fontWeight: '900', color: C.text, marginBottom: 4 }}>
            Why do you want to cancel?
          </Text>
          <Text style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>
            Please provide the reason for cancellation
          </Text>

          {CANCEL_REASONS.map(reason => (
            <TouchableOpacity
              key={reason}
              onPress={() => setSelected(reason)}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingVertical: 16, paddingHorizontal: 16,
                borderRadius: 12, marginBottom: 8,
                backgroundColor: selected === reason ? '#FEF3C7' : '#F9FAFB',
                borderWidth: 1.5,
                borderColor: selected === reason ? AMBER : '#E5E7EB',
              }}
            >
              <View style={{
                width: 20, height: 20, borderRadius: 10,
                borderWidth: 2, borderColor: selected === reason ? AMBER : '#D1D5DB',
                alignItems: 'center', justifyContent: 'center', marginRight: 12,
              }}>
                {selected === reason && (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: AMBER }} />
                )}
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: C.text }}>
                {reason}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={C.textDim} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            activeOpacity={selected ? 0.85 : 1}
            onPress={() => selected && onConfirm(selected)}
            style={{
              marginTop: 8,
              backgroundColor: selected ? C.red : '#E5E7EB',
              borderRadius: 14, paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: '900', color: selected ? '#fff' : C.textMuted }}>
                Cancel Ride
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onCancel} style={{ marginTop: 12, alignItems: 'center' }}>
            <Text style={{ color: C.textMuted, fontSize: 14, fontWeight: '600' }}>Keep my ride</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export function ScheduledRideDetailScreen() {
  const { phone, setScreen, selectedScheduledRide, setSelectedScheduledRide } = useApp() as any;
  const insets = useSafeAreaInsets();
  const ride   = selectedScheduledRide;

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling,      setCancelling]      = useState(false);

  if (!ride) {
    setScreen('scheduled-rides');
    return null;
  }

  const sl     = statusLabel(ride.status, ride.sr_status);
  const { date, time } = formatScheduledAt(ride.scheduled_at);
  const emoji  = VEHICLE_EMOJI[ride.ride_type] || '🚗';
  const netFare = Math.round(ride.fare - (ride.discount || 0));
  const canCancel = ['scheduled'].includes(ride.status) && ride.sr_status !== 'cancelled' && ride.sr_status !== 'failed';

  async function handleCancel(reason: string) {
    setCancelling(true);
    try {
      const { apiPost } = await import('../../api');
      await apiPost(`/api/scheduled/${ride.id}`, { phone, reason }, 'DELETE');
      setSelectedScheduledRide({ ...ride, status: 'scheduled_cancelled', sr_status: 'cancelled' });
      setShowCancelModal(false);
      Alert.alert('Cancelled', 'Your scheduled ride has been cancelled.');
    } catch (_e) {
      Alert.alert('Error', 'Could not cancel ride. Please try again.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F0F2F5' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#fff', paddingTop: insets.top + 8, paddingBottom: 14,
        paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.glassBorder,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        elevation: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
      }}>
        <TouchableOpacity onPress={() => setScreen('scheduled-rides')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '900', color: C.text }}>Ride Details</Text>
        <View style={{
          backgroundColor: sl.color + '18', borderRadius: 10,
          paddingHorizontal: 10, paddingVertical: 5,
          borderWidth: 1, borderColor: sl.color + '40',
        }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: sl.color }}>{sl.text}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>

        {/* "You will get captain details 15 mins before" info strip */}
        {canCancel && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: '#EFF6FF', borderRadius: 12,
            padding: 14, borderWidth: 1, borderColor: '#BFDBFE',
          }}>
            <Ionicons name="information-circle" size={20} color="#3B82F6" />
            <Text style={{ flex: 1, fontSize: 12, color: '#1E40AF', fontWeight: '600', lineHeight: 17 }}>
              You will get driver details{' '}
              <Text style={{ color: '#3B82F6', fontWeight: '800' }}>15 mins before</Text>
              {' '}the scheduled pickup time
            </Text>
          </View>
        )}

        {/* Scheduled time card */}
        <View style={{
          backgroundColor: '#fff', borderRadius: 16,
          borderWidth: 1, borderColor: AMBER_BD,
          elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
          overflow: 'hidden',
        }}>
          <View style={{ height: 4, backgroundColor: AMBER }} />
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Text style={{ fontSize: 32 }}>{emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: C.text, textTransform: 'capitalize' }}>
                  {ride.ride_type.replace('_', ' ')}
                </Text>
                <Text style={{ fontSize: 11, color: C.textMuted }}>
                  {(parseFloat(ride.distance_km) || 0).toFixed(1)} km · {Math.round((parseFloat(ride.distance_km) || 5) / 20 * 60)} mins est.
                </Text>
              </View>
              <View style={{ backgroundColor: AMBER_BG, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: AMBER_BD }}>
                <Text style={{ fontSize: 10, color: AMBER, fontWeight: '900' }}>📅 Scheduled</Text>
              </View>
            </View>

            {/* Time */}
            <View style={{
              backgroundColor: AMBER_BG, borderRadius: 10, padding: 12,
              borderWidth: 1, borderColor: AMBER_BD,
            }}>
              <Text style={{ fontSize: 10, color: AMBER, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 }}>YOUR PICKUP WILL BE ON</Text>
              <Text style={{ fontSize: 15, fontWeight: '900', color: '#92400E' }}>{date}</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#92400E', marginTop: 2 }}>{time}</Text>
            </View>
          </View>
        </View>

        {/* Address details card */}
        <View style={{
          backgroundColor: '#fff', borderRadius: 16,
          borderWidth: 1, borderColor: C.glassBorder,
          elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
          padding: 16,
        }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: C.textMuted, letterSpacing: 0.8, marginBottom: 12 }}>
            ADDRESS DETAILS
          </Text>
          <Text style={{ fontSize: 10, color: C.textDim, marginBottom: 8 }}>
            Ride ID #{ride.id}
          </Text>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.green, marginTop: 3 }} />
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: C.text, lineHeight: 19 }}>
                {ride.pickup}
              </Text>
            </View>
            <View style={{ width: 1.5, height: 14, backgroundColor: C.glassBorder, marginLeft: 4 }} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: C.red, marginTop: 3 }} />
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: C.text, lineHeight: 19 }}>
                {ride.drop_location}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.glassBorder }}>
            <Text style={{ fontSize: 11, color: C.textMuted }}>
              {(parseFloat(ride.distance_km) || 0).toFixed(1)} kms
            </Text>
          </View>
        </View>

        {/* Fare card */}
        <View style={{
          backgroundColor: '#fff', borderRadius: 16,
          borderWidth: 1, borderColor: C.glassBorder,
          elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
          padding: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="cash-outline" size={16} color={C.textMuted} />
              <Text style={{ fontSize: 13, color: C.textMuted, fontWeight: '600' }}>Cash</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: C.text }}>₹{netFare}</Text>
              {ride.discount > 0 && (
                <Text style={{ fontSize: 11, color: C.textDim, textDecorationLine: 'line-through' }}>
                  ₹{ride.fare}
                </Text>
              )}
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: C.glassBorder, marginVertical: 10 }} />
          <View style={{ gap: 6 }}>
            {[
              'Surge charges may apply due to traffic & weather',
              'Coupon benefits may vary depending on validity',
              'Wait time charges apply after driver arrival',
            ].map((note, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                <Text style={{ color: C.textDim, fontSize: 11, marginTop: 1 }}>•</Text>
                <Text style={{ flex: 1, fontSize: 11, color: C.textDim, lineHeight: 16 }}>{note}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Cancel button */}
        {canCancel && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowCancelModal(true)}
            style={{
              backgroundColor: '#FEF2F2', borderRadius: 14,
              paddingVertical: 16, alignItems: 'center',
              borderWidth: 1.5, borderColor: '#FECACA',
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.red }}>Cancel Scheduled Ride</Text>
          </TouchableOpacity>
        )}

        {ride.cancel_reason && (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FECACA' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.red, marginBottom: 4 }}>Cancellation Reason</Text>
            <Text style={{ fontSize: 13, color: C.text }}>{ride.cancel_reason}</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <CancelModal
        visible={showCancelModal}
        onCancel={() => setShowCancelModal(false)}
        onConfirm={handleCancel}
        loading={cancelling}
      />
    </View>
  );
}
