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
  // query prefix-matches "Mallpur" (a locality) or "Mall Avenue" (a road),
  // and a "Park" query matches "Parking No. 5" (a parking lot) — none of
  // which Google itself types as a real mall/tourist spot. Two-tier filter:
  // acceptTypes (strict — genuinely typed as the right category) is tried
  // first; if that comes back empty (real named malls/parks often don't
  // start with the query word at all, so nothing in range may qualify),
  // fall back to rejectTypes (loose — just excludes confirmed-wrong
  // categories like temple/hospital/parking/lodging/route) so the customer
  // sees *something* plausible instead of a dead "no results" screen.
  acceptTypes?: string[];
  rejectTypes?: string[];
  // Type-based rejection can't catch everything — "Parking No. 5" is typed
  // only as generic establishment/point_of_interest (no specific "parking"
  // type Google actually assigns), so it sails through any type-based
  // deny-list untouched. Verified live: this is a real, current false
  // positive for "Park", not a hypothetical. Matched case-insensitively
  // against the prediction's main name text.
  rejectNamePrefixes?: string[];
}

export const NEARBY_CATEGORIES: NearbyCategory[] = [
  { icon: '🏥', label: 'Hospital',       shortLabel: 'Hospital',    q: 'Hospital' },
  { icon: '🏨', label: 'Hotel',          shortLabel: 'Hotel',       q: ['Hotel', 'Guest House'] },
  { icon: '👮', label: 'Police Station', shortLabel: 'Police',      q: ['Police Station', 'Thana'] },
  { icon: '🏛️', label: 'Tourist Place',  shortLabel: 'Tourist',     q: 'Park', wideSearch: true,
    acceptTypes: ['tourist_attraction', 'park', 'museum', 'hindu_temple', 'place_of_worship', 'natural_feature', 'zoo', 'amusement_park', 'art_gallery'],
    rejectTypes: ['lodging', 'route', 'premise', 'real_estate_agency', 'school', 'hospital', 'parking'],
    rejectNamePrefixes: ['parking'] },
  { icon: '🏧', label: 'ATM',            shortLabel: 'ATM',         q: 'ATM Bank' },
  { icon: '⛽', label: 'Petrol Pump',    shortLabel: 'Petrol Pump', q: 'Petrol Pump' },
  { icon: '🚉', label: 'Railway Station', shortLabel: 'Railway',    q: 'Railway Station' },
  { icon: '🚌', label: 'Bus Stand',      shortLabel: 'Bus Stand',   q: 'Bus Stop' },
  { icon: '🛍️', label: 'Mall',           shortLabel: 'Mall',        q: 'Mall', wideSearch: true,
    acceptTypes: ['shopping_mall'],
    rejectTypes: ['hospital', 'health', 'doctor', 'pharmacy', 'police', 'place_of_worship', 'hindu_temple', 'mosque', 'church', 'lodging', 'school', 'university', 'route'] },
];
