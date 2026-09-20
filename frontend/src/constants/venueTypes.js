// The venue types, in display order. Every type <select> and filter reads this
// list and labels itself with t(`filters.types.${type}`) — the ONE label set
// (there used to be a second, differently-worded `venue.type.*`). The backend
// keeps its own copy in backend/utils/venueTypes.js; adminApi.test.js fails if
// they differ.
export const VENUE_TYPES = ['beer_garden', 'beer_hall', 'bar', 'restaurant'];
