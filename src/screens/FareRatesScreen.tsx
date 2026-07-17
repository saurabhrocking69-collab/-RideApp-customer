import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { ScreenIn, DotBG } from '../components/ui';
import { s, C, SHADOW, R } from '../styles';
import { RIDES } from '../constants';

const VEHICLE_ORDER = ['bike', 'auto', 'car', 'eriksha', 'green_bike', 'electric_auto', 'luxury'];

function FareCard({ ride, fare }: { ride: typeof RIDES[0]; fare: any }) {
  if (!fare) return null;

  const t1 = fare.per_km_rate?.toFixed(1);
  const t2 = fare.per_km_rate_t2?.toFixed(1);
  const t3 = fare.per_km_rate_t3?.toFixed(1);
  const tiered = t2 !== t1 || t3 !== t2;

  return (
    <View style={{
      backgroundColor: C.bgCard, borderRadius: R.md, borderWidth: 1,
      borderColor: C.glassBorder, marginBottom: 14, overflow: 'hidden', ...SHADOW.sm,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 12, backgroundColor: C.bgDeep }}>
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 26 }}>{ride.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{ride.label}</Text>
          <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{ride.desc}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: C.pink }}>₹{fare.base_fare}</Text>
          <Text style={{ fontSize: 10, color: C.textDim }}>base fare</Text>
        </View>
      </View>

      {/* Rate Grid */}
      <View style={{ padding: 14, paddingTop: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <InfoChip label="Min Fare" value={`₹${fare.min_fare}`} color={C.purple} />
          <InfoChip label="Platform Fee" value={`₹${fare.platform_fee}`} color={C.saffron} />
          <InfoChip label="Wait Charge" value={`₹${fare.time_rate}/min`} color={C.green} />
        </View>

        {/* Per KM rates */}
        <View style={{ backgroundColor: C.glassMid, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.glassBorder }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: C.textDim, letterSpacing: 1, marginBottom: 8 }}>PER KM RATE</Text>
          {tiered ? (
            <View style={{ gap: 6 }}>
              <KmRow label="0 – 8 km" rate={t1} />
              <KmRow label="8 – 20 km" rate={t2} />
              <KmRow label="20 km +" rate={t3} />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, color: C.textMuted }}>All distances</Text>
              <Text style={{ fontSize: 16, fontWeight: '900', color: C.text }}>₹{t1}/km</Text>
            </View>
          )}
        </View>

        {/* Night info */}
        {fare.night_multiplier > 1 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: C.purpleGlass, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.purpleBorder }}>
            <Text style={{ fontSize: 13 }}>🌙</Text>
            <Text style={{ fontSize: 12, color: C.purple, flex: 1 }}>
              Night rates: <Text style={{ fontWeight: '800' }}>{fare.night_multiplier}× multiplier</Text> ({fare.night_start} – {fare.night_end})
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function InfoChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: `${color}11`, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: `${color}30` }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function KmRow({ label, rate }: { label: string; rate: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 12, color: C.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>₹{rate}/km</Text>
    </View>
  );
}

export function FareRatesScreen() {
  const { setScreen, appConfig } = useApp();
  const fares: Record<string, any> = appConfig?.fares || {};
  const hasData = Object.keys(fares).length > 0;

  return (
    <ScreenIn style={s.screen}>
      <DotBG />
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topTitle}>Fare Rates</Text>
        <View style={{ width: 36 }} />
      </View>

      {!hasData ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={C.pink} size="large" />
          <Text style={{ color: C.textMuted, fontSize: 14 }}>Loading fare rates...</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ backgroundColor: C.greenGlass, borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.greenBorder }}>
            <Text style={{ fontSize: 18 }}>✅</Text>
            <Text style={{ flex: 1, fontSize: 12, color: C.green, fontWeight: '600' }}>
              Rates update automatically when admin changes them. No app restart needed.
            </Text>
          </View>

          {VEHICLE_ORDER.map(id => {
            const ride = RIDES.find(r => r.id === id);
            if (!ride) return null;
            return <FareCard key={id} ride={ride} fare={fares[id]} />;
          })}

          <Text style={{ textAlign: 'center', color: C.textDim, fontSize: 11, marginTop: 4 }}>
            Fares are inclusive of all charges. Night surcharge applies {'\n'}between set hours as configured.
          </Text>
        </ScrollView>
      )}
    </ScreenIn>
  );
}
