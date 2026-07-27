// Shared "near me" category list for one-tap drop-location search — used by
// both the Home screen quick-access list and the booking screen's category
// chip row. Query text is tuned per-category (not just the English label)
// because Google Places Autocomplete matches literal name text, not a place
// type — e.g. Indian police stations are named "Thana" on Maps, not "Police
// Station", so a naive English query silently misses the actual nearest
// match. See AppContext.tsx's searchNearbyCategory() for how these are used.
export interface NearbyCategory {
  icon: string;
  label: string;      // full label — "Near {label}" on Home
  shortLabel: string;  // compact label — fits the booking screen's chip row
  q: string | string[];
  // Sparse categories (malls, tourist spots) can genuinely have zero real
  // matches within a tight radius — for these, searchNearbyCategory retries
  // at progressively wider radii (up to 30km) instead of giving up at 6km.
  wideSearch?: boolean;
  // Autocomplete matches literal name text, not a place "type" — a "Mall"
  // query prefix-matches "Mallikaarujana Temple" or "Mall Hospital" even
  // though Google's own place data types neither as a shopping mall. Each
  // prediction still carries its real `types` array, so we drop obviously
  // wrong-category matches client-side (no extra API calls/billing).
  rejectTypes?: string[];
}

export const NEARBY_CATEGORIES: NearbyCategory[] = [
  { icon: '🏥', label: 'Hospital',       shortLabel: 'Hospital',    q: 'Hospital' },
  { icon: '🏨', label: 'Hotel',          shortLabel: 'Hotel',       q: ['Hotel', 'Guest House'] },
  { icon: '👮', label: 'Police Station', shortLabel: 'Police',      q: ['Police Station', 'Thana'] },
  { icon: '🏛️', label: 'Tourist Place',  shortLabel: 'Tourist',     q: 'Park', wideSearch: true, rejectTypes: ['lodging', 'route', 'premise', 'real_estate_agency', 'school', 'hospital'] },
  { icon: '🏧', label: 'ATM',            shortLabel: 'ATM',         q: 'ATM Bank' },
  { icon: '⛽', label: 'Petrol Pump',    shortLabel: 'Petrol Pump', q: 'Petrol Pump' },
  { icon: '🚉', label: 'Railway Station', shortLabel: 'Railway',    q: 'Railway Station' },
  { icon: '🚌', label: 'Bus Stand',      shortLabel: 'Bus Stand',   q: 'Bus Stop' },
  { icon: '🛍️', label: 'Mall',           shortLabel: 'Mall',        q: 'Mall', wideSearch: true, rejectTypes: ['hospital', 'health', 'doctor', 'pharmacy', 'police', 'place_of_worship', 'hindu_temple', 'mosque', 'church', 'lodging', 'school', 'university', 'route'] },
];
