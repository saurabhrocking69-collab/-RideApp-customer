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
  { icon: '🏧', label: 'ATM',            shortLabel: 'ATM',         q: 'ATM Bank' },
  { icon: '⛽', label: 'Petrol Pump',    shortLabel: 'Petrol Pump', q: 'Petrol Pump' },
  { icon: '🚉', label: 'Railway Station', shortLabel: 'Railway',    q: 'Railway Station' },
  { icon: '🚌', label: 'Bus Stand',      shortLabel: 'Bus Stand',   q: 'Bus Stop' },
  // Airport — the highest-value drop in the whole list: long trip, fixed
  // deadline, and getting the TERMINAL wrong costs a passenger their flight.
  // Querying "Terminal" alongside "Airport" surfaces the individual terminals
  // as their own suggestions, so the customer picks T1/T2/T3 directly instead
  // of being dropped at a generic airport centroid and walking.
  // 'travel_agency' is rejected deliberately: Indian listings are full of
  // "… Airport Travels" agencies that otherwise outrank the airport itself.
  // Verified live: querying 'Terminal' as its own variant is what surfaces the
  // individual terminals — 'Airport Terminal' as one phrase returns only the
  // airport. Terminals come back typed [geocode, premise], NOT 'airport', so
  // 'premise' has to be an ACCEPTED type and must not appear in rejectTypes,
  // or every terminal is filtered out and this is just an airport chip again.
  // Delhi returns airport + T1 / T1D / T2 / T3; single-terminal cities like
  // Lucknow simply return the airport.
  { icon: '✈️', label: 'Airport',        shortLabel: 'Airport',     q: ['Airport', 'Terminal'], wideSearch: true,
    acceptTypes: ['airport', 'premise'],
    rejectTypes: ['travel_agency', 'lodging', 'restaurant', 'food', 'store', 'route', 'car_rental',
                  'parking', 'beauty_salon', 'bar', 'night_club', 'shopping_mall'],
    rejectNamePrefixes: ['airport travels', 'airport taxi'] },
  // Metro — dense, unambiguous names ("Hazratganj Metro Station") make this
  // reliable in exactly the way "Mall"/"Park" were not, and it is the classic
  // last-mile leg an auto/bike actually gets booked for.
  // 'Metro' on its own would match "Metro Cash & Carry", hence the type gate.
  { icon: '🚇', label: 'Metro Station',  shortLabel: 'Metro',       q: ['Metro Station'],
    acceptTypes: ['subway_station', 'transit_station', 'train_station', 'light_rail_station', 'premise'],
    rejectTypes: ['store', 'supermarket', 'lodging', 'restaurant', 'food', 'route', 'shopping_mall'] },
];

// REMOVED — 'Mall' and 'Tourist Place'.
//
// Both were built on Places AUTOCOMPLETE, which matches a place's NAME text,
// never its type. So "Mall" ranked "Mallpur" (a locality, 12.5km) and "Mall
// Avenue" (a road, 10km) above any actual mall, and "Park" matched "Parking
// No. 5"; "Tourist Place" routinely returned nothing at all. The accept/reject
// type filters below could only ever clean up whatever the name match happened
// to return — they cannot make a name search behave like a type search.
//
// Genuinely fixing those two means Places NEARBY SEARCH
// (/place/nearbysearch/json?type=shopping_mall&rankby=distance), which queries
// by TYPE and is what "malls near me" actually means. That is not a tweak to
// this list — searchNearbyCategory() would need a second code path, because
// nearbysearch returns places + geometry rather than autocomplete predictions.
//
// It is entirely doable client-side though: BookingScreen already calls
// nearbysearch with type=shopping_mall / type=transit_station on the same
// MAPS_KEY for its nearby-places strip, so no backend proxy is required.
// Until that path exists these chips are withdrawn rather than left showing
// people a road called "Mall Avenue" when they asked for a mall.
