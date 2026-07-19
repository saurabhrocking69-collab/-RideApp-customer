import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../styles';

// ── Constants ─────────────────────────────────────────────────────────────────
const AMBER    = '#F59E0B';
const AMBER_BG = '#FFFBEB';
const ITEM_H   = 52;

// ── Helpers ───────────────────────────────────────────────────────────────────
function pad(n: number) { return n < 10 ? '0' + n : String(n); }

function buildSlots() {
  const slots: string[] = [];
  for (let h = 0; h < 12; h++) {
    for (let m = 0; m < 60; m += 10) {
      const h2 = h === 0 ? 12 : h;
      slots.push(`${pad(h2)}:${pad(m)} – ${pad(h2)}:${pad(m === 50 ? 0 : m + 10)}`.replace(
        /12:0 –/, '12:00 –'
      ));
    }
  }
  return slots;
}

const ALL_SLOTS = buildSlots(); // 72 slots per AM/PM half

// ── Snap-scroll wheel column ──────────────────────────────────────────────────
function SnapColumn({
  items,
  selectedIdx,
  onSelect,
  width,
  formatLabel,
}: {
  items: string[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  width: number;
  formatLabel?: (item: string, active: boolean) => React.ReactNode;
}) {
  const ref = useRef<ScrollView>(null);
  const initialScroll = useRef(false);

  useEffect(() => {
    if (!initialScroll.current) {
      initialScroll.current = true;
      setTimeout(() => {
        ref.current?.scrollTo({ y: selectedIdx * ITEM_H, animated: false });
      }, 80);
    }
  }, []);

  return (
    <View style={{ width, height: ITEM_H * 3, overflow: 'hidden' }}>
      {/* selection highlight */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: ITEM_H, left: 0, right: 0, height: ITEM_H,
          backgroundColor: AMBER_BG, borderRadius: 10,
          borderWidth: 1.5, borderColor: AMBER,
        }}
      />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        onMomentumScrollEnd={e => {
          const i = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
          onSelect(i);
        }}
      >
        {items.map((item, i) => {
          const active = i === selectedIdx;
          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              onPress={() => {
                onSelect(i);
                ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
              }}
              style={{ height: ITEM_H, justifyContent: 'center', alignItems: 'center' }}
            >
              {formatLabel ? formatLabel(item, active) : (
                <Text style={{
                  fontSize: active ? 17 : 14,
                  fontWeight: active ? '800' : '500',
                  color: active ? AMBER : C.textMuted,
                  letterSpacing: active ? -0.3 : 0,
                }}>
                  {item}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export interface ScheduleResult {
  iso: string;
  label: string;  // "Tue, 21 Jul · 1:00 PM"
}

interface Props {
  visible: boolean;
  onConfirm: (result: ScheduleResult) => void;
  onClose: () => void;
}

export function SchedulePickerSheet({ visible, onConfirm, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(500)).current;

  // ── Date options: today + tomorrow ──────────────────────────────────────────
  const dates = useMemo(() => {
    const today    = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return [
      { label: 'Today',    date: today    },
      { label: 'Tomorrow', date: tomorrow },
    ];
  }, []);

  // ── State ────────────────────────────────────────────────────────────────────
  const [dateIdx,  setDateIdx]  = useState(1);  // default tomorrow
  const [slotIdx,  setSlotIdx]  = useState(6);  // default ~1:00 AM slot
  const [ampmIdx,  setAmpmIdx]  = useState(1);  // 0=AM 1=PM
  const AMPM = ['AM', 'PM'];

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0, tension: 80, friction: 12, useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 500, duration: 220, useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // ── Derived: build "YOUR PICKUP WILL BE ON" label ───────────────────────────
  const previewLabel = useMemo(() => {
    const d = dates[dateIdx];
    const slot = ALL_SLOTS[slotIdx] || '12:00 – 12:10';
    const start = slot.split(' – ')[0];
    const ampm  = AMPM[ampmIdx];
    const dayStr = d.date.toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short',
    }).toUpperCase();
    // Check if < 1 hour from now
    const [hh, mm] = start.split(':').map(Number);
    const isPM = ampmIdx === 1;
    const hour24 = hh % 12 + (isPM ? 12 : 0);
    const target = new Date(d.date);
    target.setHours(hour24, mm, 0, 0);
    const tooSoon = (target.getTime() - Date.now()) < 60 * 60 * 1000;
    return { dayStr, time: `${start} ${ampm}`, tooSoon };
  }, [dateIdx, slotIdx, ampmIdx, dates]);

  // ── Build ISO datetime ───────────────────────────────────────────────────────
  function buildISO(): ScheduleResult {
    const d = dates[dateIdx].date;
    const slot  = ALL_SLOTS[slotIdx] || '12:00 – 12:10';
    const start = slot.split(' – ')[0]; // "01:00"
    const [hh, mm] = start.split(':').map(Number);
    const isPM = ampmIdx === 1;
    let hour24 = hh % 12 + (isPM ? 12 : 0);
    const result = new Date(d);
    result.setHours(hour24, mm, 0, 0);

    const prettyDate = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const prettyTime = `${hh}:${mm < 10 ? '0' + mm : mm} ${AMPM[ampmIdx]}`;
    return {
      iso: result.toISOString(),
      label: `${prettyDate} · ${prettyTime}`,
    };
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      </TouchableOpacity>

      <Animated.View
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: '#fff',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingBottom: Math.max(insets.bottom, 16),
          transform: [{ translateY: slideAnim }],
          elevation: 30,
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20,
        }}
      >
        {/* Handle */}
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', marginTop: 12 }} />

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>Schedule your ride</Text>
            <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              Up to 2 days ahead · Free cancellation before pickup
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={26} color={C.glassBorder} />
          </TouchableOpacity>
        </View>

        {/* "YOUR PICKUP WILL BE ON" banner */}
        <View style={{
          marginHorizontal: 16, marginBottom: 16,
          backgroundColor: previewLabel.tooSoon ? '#FEF2F2' : AMBER_BG,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: previewLabel.tooSoon ? '#FECACA' : '#FDE68A',
          paddingVertical: 12, paddingHorizontal: 16,
          alignItems: 'center',
        }}>
          <Text style={{
            fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4,
            color: previewLabel.tooSoon ? '#EF4444' : AMBER,
          }}>
            {previewLabel.tooSoon ? '⚠️ TOO SOON — MINIMUM 1 HOUR' : 'YOUR PICKUP WILL BE ON'}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '900', color: previewLabel.tooSoon ? '#991B1B' : '#92400E' }}>
            {previewLabel.dayStr}, {previewLabel.time}
          </Text>
        </View>

        {/* Three-column picker */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, gap: 8, marginBottom: 20,
        }}>
          {/* Date column */}
          <SnapColumn
            items={dates.map(d => d.label)}
            selectedIdx={dateIdx}
            onSelect={setDateIdx}
            width={100}
          />

          <View style={{ width: 1, height: ITEM_H * 2.5, backgroundColor: C.glassBorder }} />

          {/* Time slot column */}
          <SnapColumn
            items={ALL_SLOTS}
            selectedIdx={slotIdx}
            onSelect={setSlotIdx}
            width={160}
            formatLabel={(item, active) => (
              <Text style={{
                fontSize: active ? 15 : 13, fontWeight: active ? '800' : '500',
                color: active ? AMBER : C.textMuted,
              }}>
                {item}
              </Text>
            )}
          />

          <View style={{ width: 1, height: ITEM_H * 2.5, backgroundColor: C.glassBorder }} />

          {/* AM/PM column */}
          <SnapColumn
            items={AMPM}
            selectedIdx={ampmIdx}
            onSelect={setAmpmIdx}
            width={60}
          />
        </View>

        {/* Confirm button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (previewLabel.tooSoon) {
              Alert.alert('Time too soon', 'Please pick a time at least 1 hour from now.');
              return;
            }
            onConfirm(buildISO());
          }}
          style={{
            marginHorizontal: 16,
            backgroundColor: previewLabel.tooSoon ? '#D1D5DB' : AMBER,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            elevation: previewLabel.tooSoon ? 0 : 6,
            shadowColor: AMBER,
            shadowOpacity: previewLabel.tooSoon ? 0 : 0.35,
            shadowRadius: 12,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '900', color: previewLabel.tooSoon ? '#9CA3AF' : '#fff', letterSpacing: -0.2 }}>
            Confirm Pickup Time
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}
