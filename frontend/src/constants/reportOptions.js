// The limits and choices of the report form. Dependency-free on purpose: the backend test
// (backend/adminApi.test.js) imports THIS file and checks the API enforces exactly these
// values, so the form and the server cannot drift apart.
export const NOTE_MAX = 300;   // longest note / description; the API rejects longer ones
export const PRICE_MIN = 1;    // a reported price must be within the API's €1–30 bounds
export const PRICE_MAX = 30;
// "Andere falsche Info" → "which field is wrong?" (server maps each to its German label)
export const WRONG_FIELDS = ['name', 'address', 'hours', 'brand', 'other'];
