import { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Platform, StatusBar,
  StyleSheet, Text, TouchableOpacity, Vibration, View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Accelerometer, Magnetometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');
const FOV = 65; // typical phone camera horizontal field of view (degrees)
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 28) : 52;

// ── Math helpers ──────────────────────────────────────────────────────────────

function calcBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const rlat1 = lat1 * Math.PI / 180;
  const rlat2 = lat2 * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(rlat2);
  const x = Math.cos(rlat1) * Math.sin(rlat2) - Math.sin(rlat1) * Math.cos(rlat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeAngle(a: number): number {
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return a;
}

function fmtDist(m: number): string {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CompassOnly({
  relativeAngle, distance, driverName, onGrantCamera, onClose,
}: {
  relativeAngle: number; distance: number | null;
  driverName?: string; onGrantCamera: () => void; onClose: () => void;
}) {
  const rotAnim = useRef(new Animated.Value(relativeAngle)).current;

  useEffect(() => {
    Animated.spring(rotAnim, { toValue: relativeAngle, friction: 7, tension: 50, useNativeDriver: true }).start();
  }, [relativeAngle]);

  const spin = rotAnim.interpolate({ inputRange: [-180, 180], outputRange: ['-180deg', '180deg'] });

  return (
    <View style={[st.fill, { backgroundColor: '#0D0618', justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
      {/* Close */}
      <TouchableOpacity onPress={onClose} style={[st.closeBtn, { position: 'absolute', top: STATUS_H + 8, right: 16 }]}>
        <Ionicons name="close" size={20} color="#fff" />
      </TouchableOpacity>

      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 32, fontWeight: '700' }}>
        COMPASS MODE
      </Text>

      {/* Animated compass needle */}
      <View style={{ width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
        <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 1.5, borderColor: 'rgba(255,45,120,0.25)' }} />
        <View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} />
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 60, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#FF2D78' }} />
            <View style={{ width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 40, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: 'rgba(255,45,120,0.35)' }} />
          </View>
        </Animated.View>
        <View style={{ position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#FF2D78' }} />
      </View>

      <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', textAlign: 'center' }}>
        {distance !== null ? fmtDist(distance) : 'Locating…'}
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
        {driverName || 'Your Sppero Buddy'} is in that direction
      </Text>

      <TouchableOpacity onPress={onGrantCamera} style={st.grantBtn}>
        <Ionicons name="camera" size={16} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>Enable Camera for AR View</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  driverLat: number;
  driverLng: number;
  driverName?: string;
  onClose: () => void;
}

export function ARDriverFinder({ driverLat, driverLng, driverName, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();

  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [compassHeading, setCompassHeading] = useState(0);
  const [isFlat, setIsFlat] = useState(false);
  const [locationAge, setLocationAge] = useState(0);

  // For smooth arrow movement
  const arrowXAnim = useRef(new Animated.Value(W / 2)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const glowAnim   = useRef(new Animated.Value(0.5)).current;

  const lastDriverUpdateRef = useRef(Date.now());
  const compassRef = useRef(0); // for spike filter

  // Track driver location freshness
  useEffect(() => { lastDriverUpdateRef.current = Date.now(); }, [driverLat, driverLng]);
  useEffect(() => {
    const iv = setInterval(() => setLocationAge(Math.floor((Date.now() - lastDriverUpdateRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);

  // Get user GPS once
  useEffect(() => {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      .then(loc => { setUserLat(loc.coords.latitude); setUserLng(loc.coords.longitude); })
      .catch(() => {});
  }, []);

  // Magnetometer — compass heading with low-pass filter + spike rejection
  useEffect(() => {
    Magnetometer.setUpdateInterval(80);
    const sub = Magnetometer.addListener(({ x, y }) => {
      const raw = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      const diff = Math.abs(raw - compassRef.current);
      const normalDiff = diff > 180 ? 360 - diff : diff;
      if (normalDiff > 80) return; // spike — likely metal/interference
      compassRef.current = compassRef.current * 0.72 + raw * 0.28;
      setCompassHeading(compassRef.current);
    });
    return () => sub.remove();
  }, []);

  // Accelerometer — detect phone lying flat (bad for AR)
  useEffect(() => {
    Accelerometer.setUpdateInterval(400);
    const sub = Accelerometer.addListener(({ z }) => setIsFlat(Math.abs(z) > 0.88));
    return () => sub.remove();
  }, []);

  // Pulse animation
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.18, duration: 650, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  // Glow animation
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.35, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Derived geometry ─────────────────────────────────────────────────────────

  const hasLoc      = userLat !== null && userLng !== null;
  const distance    = hasLoc ? haversineM(userLat!, userLng!, driverLat, driverLng) : null;
  const bearing     = hasLoc ? calcBearing(userLat!, userLng!, driverLat, driverLng) : 0;
  const relAngle    = normalizeAngle(bearing - compassHeading);
  const arrowX      = W / 2 + (relAngle / (FOV / 2)) * (W / 2);
  const isInFOV     = Math.abs(relAngle) < FOV / 2 - 4;
  const isTooClose  = distance !== null && distance < 30;
  const isStale     = locationAge > 15;

  // Smooth arrow movement
  useEffect(() => {
    Animated.spring(arrowXAnim, { toValue: Math.max(20, Math.min(W - 20, arrowX)), friction: 6, tension: 80, useNativeDriver: true }).start();
  }, [arrowX]);

  // Color by distance
  const color = !distance ? '#FF2D78'
    : distance < 60 ? '#22C55E'
    : distance < 200 ? '#F59E0B'
    : '#FF2D78';

  // Vibrate when driver just entered "very close" zone
  const prevTooCloseRef = useRef(false);
  useEffect(() => {
    if (isTooClose && !prevTooCloseRef.current) Vibration.vibrate([0, 80, 60, 80]);
    prevTooCloseRef.current = isTooClose;
  }, [isTooClose]);

  // ── Permission states ────────────────────────────────────────────────────────

  if (!permission) return null; // still loading

  if (!permission.granted) {
    return (
      <CompassOnly
        relativeAngle={relAngle}
        distance={distance}
        driverName={driverName}
        onGrantCamera={requestPermission}
        onClose={onClose}
      />
    );
  }

  // ── Main AR render ───────────────────────────────────────────────────────────

  return (
    <View style={st.fill}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Live camera feed */}
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* Vignette overlays for readability */}
      <View style={st.vignetteTop} />
      <View style={st.vignetteBottom} />

      {/* ── Top bar ── */}
      <View style={[st.topBar, { paddingTop: STATUS_H + 8 }]}>
        <View style={st.liveChip}>
          <Animated.View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FF2D78', opacity: glowAnim }} />
          <Text style={st.liveText}>AR LIVE</Text>
        </View>

        {isStale && (
          <View style={st.staleChip}>
            <Ionicons name="refresh" size={11} color="#F59E0B" />
            <Text style={st.staleText}>Location updating…</Text>
          </View>
        )}

        <View style={{ flex: 1 }} />

        <TouchableOpacity onPress={onClose} style={st.closeBtn}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Phone flat warning ── */}
      {isFlat && (
        <View style={st.flatWarn}>
          <Text style={st.flatWarnText}>📱 Hold phone upright like a camera</Text>
        </View>
      )}

      {/* ── Too close state ── */}
      {isTooClose ? (
        <View style={st.tooCloseBox}>
          <Text style={{ fontSize: 52 }}>👀</Text>
          <Text style={st.tooCloseTitle}>Driver is right here!</Text>
          <Text style={st.tooCloseSubtitle}>
            {driverName || 'Your Sppero Buddy'} is within {distance !== null ? `${Math.round(distance)}m` : 'a few meters'}
          </Text>
          <View style={st.tooClosePill}>
            <Ionicons name="walk" size={14} color="#22C55E" />
            <Text style={{ color: '#22C55E', fontWeight: '800', fontSize: 13 }}>Look around — they're very close!</Text>
          </View>
        </View>

      ) : isInFOV ? (
        /* ── AR arrow — driver in camera FOV ── */
        <Animated.View style={[st.arrowWrap, { transform: [{ translateX: Animated.subtract(arrowXAnim, 35) }] }]}>
          <Animated.View style={[st.arrowBubble, {
            borderColor: color,
            shadowColor: color,
            transform: [{ scale: pulseAnim }],
          }]}>
            {/* Car target reticle */}
            <View style={[st.reticleOuter, { borderColor: color }]}>
              <View style={[st.reticleInner, { borderColor: color }]} />
            </View>
            <Text style={{ fontSize: 26, position: 'absolute' }}>🚗</Text>
          </Animated.View>

          {/* Distance badge */}
          {distance !== null && (
            <View style={[st.distBadge, { backgroundColor: color }]}>
              <Text style={st.distBadgeText}>{fmtDist(distance)}</Text>
            </View>
          )}

          {/* Down-tick line from bubble to "ground" */}
          <Animated.View style={[st.tickLine, { backgroundColor: color, opacity: glowAnim }]} />
        </Animated.View>

      ) : (
        /* ── Edge indicator — driver outside camera FOV ── */
        <View style={[st.edgeChip, relAngle > 0 ? st.edgeRight : st.edgeLeft]}>
          <Ionicons
            name={relAngle > 0 ? 'arrow-forward-circle' : 'arrow-back-circle'}
            size={28}
            color="#FF2D78"
          />
          <View style={{ marginLeft: 8 }}>
            <Text style={st.edgeTitle}>{relAngle > 0 ? 'Turn right' : 'Turn left'}</Text>
            {distance !== null && <Text style={st.edgeDist}>{fmtDist(distance)}</Text>}
          </View>
        </View>
      )}

      {/* ── Crosshair center guide ── */}
      {!isTooClose && (
        <View style={st.crosshair} pointerEvents="none">
          <View style={st.crosshairH} />
          <View style={st.crosshairV} />
        </View>
      )}

      {/* ── Bottom info panel ── */}
      <View style={st.bottomPanel}>
        <View style={st.driverRow}>
          <View style={[st.driverAvatar, { borderColor: color }]}>
            <Text style={{ fontSize: 24 }}>🚗</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={st.driverName}>{driverName || 'Your Sppero Buddy'}</Text>
            <Text style={st.driverSub}>
              {!hasLoc
                ? 'Getting your location…'
                : isTooClose
                  ? '✅ Driver is right here!'
                  : distance !== null
                    ? `${fmtDist(distance)} away · turn ${relAngle > 0 ? 'right' : relAngle < -5 ? 'left' : 'straight ahead'}`
                    : 'Calculating…'}
            </Text>
          </View>
          {isStale && (
            <View style={{ backgroundColor: 'rgba(245,158,11,0.2)', borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="refresh-circle" size={22} color="#F59E0B" />
            </View>
          )}
        </View>

        <Text style={st.calibHint}>
          {isFlat
            ? '📱 Tilt phone upright for AR to work'
            : isInFOV
              ? '🎯 Driver is in your camera view — walk toward the marker'
              : `🔄 Rotate ${relAngle > 0 ? 'right' : 'left'} to bring driver into view`}
        </Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  fill:          { flex: 1, backgroundColor: '#000' },
  vignetteTop:   { position: 'absolute', top: 0, left: 0, right: 0, height: 130, backgroundColor: 'rgba(0,0,0,0.50)' },
  vignetteBottom:{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, backgroundColor: 'rgba(0,0,0,0.58)' },

  topBar:  { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  liveChip:{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,45,120,0.22)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,45,120,0.45)' },
  liveText:{ color: '#FF2D78', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  staleChip:{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(245,158,11,0.18)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)' },
  staleText:{ color: '#F59E0B', fontSize: 10, fontWeight: '700' },
  closeBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },

  flatWarn:    { position: 'absolute', top: '38%', left: 0, right: 0, alignItems: 'center' },
  flatWarnText:{ color: '#fff', fontSize: 15, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.60)', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 24, overflow: 'hidden' },

  tooCloseBox:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  tooCloseTitle:  { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 18, textAlign: 'center', letterSpacing: -0.5 },
  tooCloseSubtitle:{ color: 'rgba(255,255,255,0.65)', fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  tooClosePill:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(34,197,94,0.18)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.4)', marginTop: 24 },

  arrowWrap:  { position: 'absolute', top: H * 0.34, width: 70, alignItems: 'center' },
  arrowBubble:{ width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, shadowOpacity: 0.85, shadowRadius: 20, elevation: 16 },
  reticleOuter:{ position: 'absolute', width: 58, height: 58, borderRadius: 29, borderWidth: 2, opacity: 0.6 },
  reticleInner:{ position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, opacity: 0.4 },
  distBadge:   { marginTop: 6, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 5 },
  distBadgeText:{ color: '#fff', fontWeight: '900', fontSize: 13 },
  tickLine:    { width: 2, height: 28, borderRadius: 1, marginTop: 2 },

  edgeChip:  { position: 'absolute', top: '44%', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.60)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1.5, borderColor: 'rgba(255,45,120,0.50)' },
  edgeRight: { right: 12 },
  edgeLeft:  { left: 12 },
  edgeTitle: { color: '#fff', fontWeight: '900', fontSize: 15 },
  edgeDist:  { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },

  crosshair: { position: 'absolute', top: H * 0.5 - 1, left: 0, right: 0, alignItems: 'center' },
  crosshairH:{ position: 'absolute', top: 0, width: 28, height: 1.5, backgroundColor: 'rgba(255,255,255,0.12)' },
  crosshairV:{ position: 'absolute', top: -13, width: 1.5, height: 28, backgroundColor: 'rgba(255,255,255,0.12)' },

  bottomPanel:{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 34, paddingTop: 8 },
  driverRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.60)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 10 },
  driverAvatar:{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,45,120,0.22)', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  driverName: { color: '#fff', fontSize: 15, fontWeight: '900' },
  driverSub:  { color: 'rgba(255,255,255,0.60)', fontSize: 12, marginTop: 4, lineHeight: 16 },
  calibHint:  { color: 'rgba(255,255,255,0.38)', fontSize: 11, textAlign: 'center', lineHeight: 16 },

  grantBtn:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FF2D78', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 28, marginTop: 32, elevation: 8, shadowColor: '#FF2D78', shadowOpacity: 0.5, shadowRadius: 16 },
});
