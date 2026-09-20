// Valid venue types — mirror of frontend/src/constants/venueTypes.js (a test
// keeps them equal). Used to validate every route that creates or edits a venue.
const VENUE_TYPES = ['beer_garden', 'beer_hall', 'bar', 'restaurant'];

module.exports = { VENUE_TYPES, isValidVenueType: (t) => typeof t === 'string' && VENUE_TYPES.includes(t) };
