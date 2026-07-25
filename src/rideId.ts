// Rides use a UUID primary key internally (rides.id) — never show that raw
// 36-char string to users. This is the one short, masked code shown across
// the app instead, e.g. "#SP3F66AFA6". Keep every display spot on this
// helper so the format never drifts out of sync between screens/apps.
export function shortRideId(id: string | number | null | undefined): string {
  return '#SP' + String(id || '').slice(-8).toUpperCase();
}
