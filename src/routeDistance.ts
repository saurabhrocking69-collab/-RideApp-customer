import { MAPS_KEY } from './constants';

/* Google's TWO_WHEELER distance for a pair, or null if it can't be had.
 *
 * The legacy Distance Matrix / Directions APIs have no two-wheeler mode at
 * all — only the newer Routes API does. Everything that prices or shows a
 * bike/auto/e-riksha trip has to come through here, otherwise it silently
 * gets the car's detour: on a real Lucknow pair that is 4.22 km instead of
 * 2.82 km, and fare is base + per_km × distance.
 *
 * Origin and destination accept either coordinates or a plain address string,
 * because the estimate paths have one of each.
 *
 * Returns null rather than throwing. Every caller is expected to fall back to
 * the car figure — a slightly high number beats a blank screen, and a
 * two-wheeler route being unavailable (quota, billing) must never stop someone
 * from booking.
 */
export type Dist = { km: number; durationMin: number };
export type Place = { lat: number; lng: number } | string;

export async function nimbleDistance(origin: Place, dest: Place): Promise<Dist | null> {
  const place = (p: Place) => typeof p === 'string'
    ? { address: p }
    : { location: { latLng: { latitude: p.lat, longitude: p.lng } } };
  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': MAPS_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify({
        origin: place(origin), destination: place(dest),
        travelMode: 'TWO_WHEELER',
        // Without a language the API has answered in Assamese for a Lucknow
        // trip. Nothing here is read aloud, but the same request shape is
        // reused where it is.
        languageCode: 'en-IN', regionCode: 'IN',
      }),
    });
    const d = await res.json();
    const r = d.routes?.[0];
    if (!r?.distanceMeters) return null;
    return { km: r.distanceMeters / 1000, durationMin: parseFloat(String(r.duration || '0')) / 60 };
  } catch {
    return null;
  }
}
