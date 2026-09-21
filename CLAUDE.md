# Bierpreis — Project Briefing for Claude Code

## What this is
Bilingual (DE/EN) Munich beer price web app.
Users find Helles beer prices across bars, 
restaurants and beer gardens on an interactive map.
Live: https://bierpreis.beer
Repo: https://github.com/SittanBon/muenchner-bierpreis

## Tech Stack
- Frontend: React + Vite (frontend/ folder)
- Backend: Node.js + Express (server.js)
- Database: SQLite (dev: backend/db/bierpreis.db, prod: /app/data/bierpreis.db)
- Map: Leaflet + OpenStreetMap
- Hosting: Railway (auto-deploys from GitHub main)
- i18n: i18next (DE default, EN toggle)

## Credentials
Never commit real values — see ADMIN_USERNAME, ADMIN_PASSWORD,
JWT_SECRET, TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the local
.env file and in Railway's project variables.

## Database
- ~181 venues across 6 Munich Stadtteile as of 18 Sep 2026 (local dev) —
  grows via approved community submissions, so treat this as a snapshot;
  check GET /api/stats for the live count. Local dev's seed DB and
  production have diverged independently — don't assume they match, and
  re-run `npm run expand:ludwigsvorstadt` reasoning below against
  production's own count before trusting it there.
- The Isarvorstadt polygon (frontend/src/data/neighbourhoodGeoJSON.js) was
  expanded from just the district's eastern half to the full official
  "Ludwigsvorstadt-Isarvorstadt" district — it now overlaps the older,
  hand-approximated Altstadt/Maxvorstadt polygons in places (those two
  weren't redrawn); the new polygon is ordered last so it wins the visual
  and click precedence in the overlap. See backend/db/expandLudwigsvorstadt.js
  for the full reasoning, including which venues were reassigned and which
  were deliberately left alone despite matching on paper (several turned
  out to be real Haidhausen/Untergiesing/Westend addresses — none of which
  are modelled neighbourhoods yet).
- Tables: cities, neighbourhoods, venues, beers,
  submissions, admin_logs (the price table is `beers` — there is no
  `venue_beers` table; older notes calling it that mean `beers`)
- Run locally: npm run seed
- Geocode: npm run geocode
- Production DB: /app/data/bierpreis.db
- Volume: muenchner-bierpreis-volume

## Price data trust model (P0 Phase 1 — READ BEFORE TOUCHING PRICES)
A price's age comes ONLY from two columns on `beers`:
- `verified_at` — someone confirmed the price is still correct
- `price_observed_at` — when the price was actually seen/reported
- Freshness = verified_at if set, else price_observed_at, else UNKNOWN
  ("Datum unbekannt"). FRESH ≤30 days, AGING 31–90, STALE >90
  (`FRESH_DAYS`/`AGING_DAYS` at the top of frontend/src/utils/freshness.js
  and backend/utils/priceUtils.js — keep them equal; the parity test
  enforces it).
- `beers.updated` is a TECHNICAL modification date only (the table has no
  `updated_at`). NEVER derive freshness from it — an unrelated edit would
  make an old price look new. It changes only when stored data changes.
- NEVER invent a date. Existing rows migrated with both dates NULL (the
  legacy `updated` was not proof of observation). Scripts that insert
  researched prices leave `price_observed_at` NULL; only an approved
  submission (its visit date) or an admin entering/changing a price today
  sets it.
- Admin "✓ Verify price" (POST /api/admin/venues/:id/beers/:beerId/verify)
  sets `verified_at` only — no price, no `updated`, no history entry.
  An admin Save that changes nothing writes nothing. A changed price
  clears `verified_at` (the old verification was of the old value).
- `serving_volume_ml` (250/330/400/500/1000; NULL = unknown) is the size
  `size_05` is quoted for (`size_mass` stays the secondary 1 L price).
  Actual menu price is ALWAYS primary in the UI; the per-0.5 L
  `normalized_500ml_price` (server-calculated: price / volume × 500) is
  secondary, shown only when the size is known and isn't 0.5 L, and is
  never presented as what the customer pays. Unknown size → no normalized
  price. Averages, stats, sorting and price filters all use the
  normalized price.
- Every API beer carries: price_observed_at, verified_at,
  serving_volume_ml, normalized_500ml_price, freshness_state. The public
  `price_history` is an allow-list (no submitter/notes).
- Submissions: `size` must be one of 0.25L/0.33L/0.4L/0.5L/1L and
  `visit_date` a real, non-future date (it becomes price_observed_at on
  approval). Approving an unrecognised size writes nothing.
- The DB migration takes a `VACUUM INTO` backup (`<db>.pre-phase1-<ts>.bak`,
  gitignored) once, before adding the columns — restore it to roll back.

## Public UI layout (P0 Phase 3)
One DOM, two layouts (`.pub` in `index.css`, "PHASE 3" block at the end):
- **Mobile + tablet (<1024px)**: header (56px + safe-area top) → intro → search
  (54px) → amber CTA (58px) → map (fills the rest, ≈45–55vh) → filter chips →
  fixed bottom nav (56px + safe-area bottom). Tabs `Karte` / `Liste` are two views
  of ONE dataset (`displayVenues` in App.jsx); the map stays laid out but
  invisible on the Liste tab (a `display:none` map made Leaflet's flyTo throw
  `Invalid LatLng (NaN, NaN)`). `viewport-fit=cover` in index.html is what makes
  `env(safe-area-inset-*)` work on iOS.
- **Desktop (≥1024px)**: CSS grid — stats row, then a 400px left panel (intro,
  search, CTA, chips, list/detail) and the map. No bottom nav / sheet there.
- **Bottom sheet** (`.pub-panel--detail|--hood`) is only for a venue's details or a
  neighbourhood's venues (default stop "half"); the intro/search/CTA step aside
  while it is open and the map pans so the selected pill stays visible above it.
- **Price-first markers** (`MunichMap.jsx`, model in `utils/markerModel.js`): a pill
  with the ACTUAL headline price ("€4.20", or "€3.50·0.33L" when the size isn't
  0.5 L, "·?" when unknown), left border = venue type, tint = freshness
  (FRESH #fff / AGING #fffbeb / STALE #fff5f5 / UNKNOWN #f5f5f5) plus a "!" / "?"
  glyph so freshness is never colour alone; aria-label spells everything out. The
  marker layer is rebuilt only when the venue set, zoom or language changes —
  selection/hover just toggle a class (callbacks live in refs). Clusters keep the
  amber circle; overlap is a pill-sized rectangle test.
- **"Günstiges Bier in der Nähe"** (`hooks/useNearby.js`, `utils/geo.js`): there was NO
  prior geolocation code. The position is used only in the browser: venues within
  1 km, cheapest per 0.5 L first, each with a real distance (never shown when
  unknown). Denied/unavailable/timeout → "Standort konnte nicht ermittelt werden."
  + [Erneut versuchen] [München anzeigen]. Nothing is faked.
- **Filter chips** (`utils/quickFilters.js`, `FilterChips.jsx`): ≤€4 → max_price
  4.00, ≤€5 → 5.00, Biergarten, Wirtshaus (beer_hall), Vom Fass (tap) all write into
  the same `filters` object as the full panel; "Mehr ↓" opens that panel (bottom
  sheet on mobile, inline on desktop). "Jetzt geöffnet" is shown disabled ("Demnächst")
  because there is no reliable opening-hours data.
- **Skeletons, not spinners** for the map and the list; `AdminPage`,
  `MissingBarModal` and the venue price-history chart (`recharts`) are lazy chunks
  (first-load JS 806 kB → 415 kB).
- Header on mobile: language toggle visible (small), Admin + Impressum /
  Datenschutz / Kontakt in the ☰ menu (the footer strip is desktop-only).
- Accessibility: every public control is ≥44px (chips are 44px boxes with a 36px
  painted pill; pills have a 44px hit area), visible `:focus-visible` rings, markers are
  keyboard-focusable, `prefers-reduced-motion` switches transitions/animations off.
- **Known follow-ups**: (1) the CTA / active chips use white on #e8a020 as
  specified — only 2.2:1 contrast (fails WCAG AA); `--cta-fg` / `--cta-bg` in
  `:root` make the fix one line (dark brown #3d2200 on #e8a020 = 6.6:1).
  (2) "+ Preis melden" opens the existing "Missing a bar" modal — Phase 7 builds the
  pick-a-venue flow. (3) No analytics exist, so no events were added.

## Shared constants & consistency rules (READ BEFORE ADDING A FORM OR LABEL)
Each of these has ONE source; components import it and never re-type it. Tests
fail if a copy drifts.
- **Serving sizes** — `frontend/src/constants/servingSizes.js` (`SERVING_SIZES`:
  ml/label/size/name_de/name_en: 250 0.25L Kleines · 330 0.33L Flasche · 400
  0.40L Kleines Helles · 500 0.50L Halbe · 1000 1.00L Maß). Every size dropdown
  is `<ServingSizeSelect>` ("0.50L — Halbe (500ml)"; DE shows a decimal comma).
  `size` is the API wire value ('0.4L', not '0.40L') so stored rows stay valid.
  Backend mirror: `SIZE_TO_ML` in `backend/utils/priceUtils.js` (parity-tested).
  `serving_volume_ml` outside [250,330,400,500,1000] is a 400 on EVERY route that
  takes one (PATCH beer, POST venues, POST venues/:id/beers). Create/add forms have
  a size selector; omitted = 500 (older clients). "Missing a bar?" sends `size`
  for the first beer and per extra beer; approval uses it (default 0.5L).
- **Serving-size text in translations** is generated (`${REF_DE}` etc. in
  `translations.js`) — never type "0,5L"/"1L" into a string
  (`translations.test.js` fails on it). DE/EN key parity is tested there too.
- **Brands** — `constants/brands.js` (`BRANDS`, `BRAND_GROUPS`, `TREND_BRANDS`);
  every brand input is `<BrandCombobox>`. `TREND_BRANDS` must equal the backend's.
- **Venue types** — `constants/venueTypes.js` ⇄ `backend/utils/venueTypes.js`;
  labels are `t('filters.types.<type>')` only. Invalid type = 400 on create,
  edit and "Missing a bar?".
- **Neighbourhood names** — the DB (`neighbourhoods.name_de/name_en` via
  GET /api/neighbourhoods) is the only source; use `neighbourhoodName(n, lang)`
  (`utils/neighbourhoods.js`). No component keeps its own list.
- **Freshness** — only `FreshnessLight` → `getFreshness` (`utils/freshness.js`).
- **Price display** — one function: `formatPrice` in `utils/priceUtils.js`
  (`formatEuro` in `utils/price.js` is just an alias); `parsePrice` for input.
- **Normalised 0.5 L price** — `normalizePrice` (JS, multiplies BEFORE dividing
  and rounds a true half-cent UP: €2.90 @ 400 ml = €3.63). The SQL copies
  (`BEER_PRICE_500_SQL`, `SUBMISSION_PRICE_500_SQL`) are tested against it
  (`normalizationParity.test.js`); SQLite's ROUND may differ by 1 cent at an exact
  half-cent, but it only rounds AVG()s, never a displayed price.
- **UI text** — everything user-facing goes through `t()`; no inline
  `de ? '…' : '…'` ternaries. (Language-neutral: "Admin", "Lat"/"Lng", URLs.)
- **Admin buttons are ≥44px tall** — one rule in `index.css`
  (`.admin-page button { min-height: 44px }`), so new admin buttons comply
  automatically. Form fields (inputs/selects) are not covered by it.

## Admin data-quality tooling (P0 Phase 2)
- **Data Quality tab** (admin): automatic flags for HUMAN REVIEW ONLY —
  nothing is auto-fixed or deleted. Rules live in `backend/dataQuality.js`
  (pure, tested): MISSING_SERVING_SIZE, MISSING_PRICE, MISSING_OBSERVATION_DATE,
  STALE_PRICE, INVALID_PRICE (<€0.50 or >€20), VENUE_WITHOUT_ACTIVE_PRICE,
  DUPLICATE_VENUE (same name + neighbourhood), EXTREME_NORMALIZED_PRICE (>€15
  per 0.5 L). Only ACTIVE venues are checked. Per flag: Edit (opens the venue
  editor), ✓ Verify (only offered where confirming the price resolves it),
  Dismiss (hides that one flag for 7 days via `flag_dismissals`; reappears by
  itself). Endpoints: GET /api/admin/data-quality, POST
  /api/admin/data-quality/dismiss. Every admin venue response also carries its
  `flags` (attachFlags in server.js) — that is what the badges/flag-search use.
- **Price editor** (`BeerPriceEditor.jsx`, per beer in the venue editor):
  actual price, serving size, live read-only per-0.5 L price, "price observed
  on" date, source (ADMIN/COMMUNITY/VENUE/MENU_PHOTO/OTHER), internal notes.
  `source_type` and `notes` are ADMIN-ONLY columns on `beers` — deliberately
  absent from `beersForVenue`, so they can never reach a public response.
  Saving NEVER sets `verified_at` (a changed price clears it); the separate
  "✓ Verify price" button does (and is disabled while there are unsaved edits).
  The client only sends `price_observed_at` / `source_type` if the admin touched
  them, so an untouched field can't pin an old date onto a new price.
- **Price history** = table `price_history` (one row per REAL price change or
  observation: an admin create/change, or an applied submission approval).
  Verify, a no-op save, notes/source-only saves and rejections write NOTHING.
  No backfill — legacy prices have no rows. The admin history viewer
  (`GET .../beers/:beerId/history`) merges those rows with pending/rejected
  submissions and pre-Phase-2 approved ones, and labels the fabricated
  `seeded price-trend history` submissions as "Seeded estimate" (no attribution).
  The public Price Trends chart still reads submissions only (unchanged).
- **Telegram**: one-click verify sends `✓ Price verified: <venue> €<price> —
  <admin>` (`notifyPriceVerified`); audit log actions VERIFY_PRICE, DISMISS_FLAG.
- **Bulk Verify All Prices** (Data Quality tab, "before Phase 3"): one click
  (behind a `window.confirm` that states the count and what it does NOT do)
  stamps `verified_at = today` (Europe/Berlin) on every priced (`size_05 > 0`),
  active beer on an active venue that has no `verified_at`
  (`bulkVerifyPrices` in `backend/db/database.js`, one transaction).
  `POST /api/admin/bulk-verify` needs `{ "confirm": true }` (400 otherwise).
  ONLY `verified_at` changes — never price, `updated`, `price_observed_at` or
  history; already-verified beers keep their earlier date. Audit action
  `BULK_VERIFY` {count, verified_at}; Telegram `✓ Bulk verify: N prices verified —
  <admin>` (`notifyBulkVerified`); nothing is logged/sent when the count is 0.
  The tab's `unverified_count` previews the same scope. CAVEAT: this vouches
  for prices nobody individually observed — it makes them FRESH for 30 days on
  the public site, so use it deliberately (it is the one place "verified" does
  not mean "someone looked at this price").
- **Seeded-submission cleanup** (`backend/db/removeSeededSubmissions.js`, runs on
  every boot, idempotent): deletes submissions whose `note` contains
  `seeded price-trend history` (the fabricated Price Trends data; `submissions`
  has NO `source_type` column, `SEED_ESTIMATE` was never a stored value). Writes
  `<db>.pre-remove-seeded-submissions-<ts>.bak` first (nothing is deleted if that
  fails) and one `DELETE_SEEDED_SUBMISSIONS` audit entry (performed_by `system`).
  Submission ids are now `s` + (highest existing s-number + 1), NOT a row count —
  the count-based id would have collided with existing ids after this delete.
- **Telegram**: one-click verify sends `✓ Price verified: <venue> €<price> —
  <admin>` (`notifyPriceVerified`); audit log actions VERIFY_PRICE, DISMISS_FLAG.
  NOTE: the project `.env` configures a REAL bot. Tests and scratch servers must
  blank `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` (backend/adminApi.test.js does).
- **Submission queue**: GET /api/admin/submissions is enriched (submitted price +
  size, per-0.5 L price, the venue's CURRENT price + freshness, difference %, a
  live >25% outlier flag, source COMMUNITY). Approve = observation on the visit
  date, NOT verified, one history entry, source COMMUNITY. Reject touches no
  price data. The queue is re-fetched whenever its tab is reopened so the
  "current price" is never a stale snapshot.
- **Admin search** (`frontend/src/utils/adminSearch.js`): name, address,
  neighbourhood, brand, serving size ("0.33L"/"0,33l"/"330ml"/"Maß"), and flag
  words ("stale", "duplicate", "unverified"…), every word must match.

## Tier 1 Stadtteile
Altstadt-Lehel, Maxvorstadt, Schwabing-West, Schwabing-Freimann,
Ludwigsvorstadt-Isarvorstadt, Schwanthalerhöhe
(matches Munich's official Stadtbezirk structure — Altstadt+Lehel are one
district, Schwabing-West/Schwabing-Freimann are two separate ones)

## Cities (future expansion)
München (active), Berlin/Hamburg/Wien (coming soon)

## How to run locally
Terminal 1: node server.js (port 3001)
Terminal 2: cd frontend && npm run dev (port 5173)

## How to deploy
git add -A && git commit -m "msg" && git push origin main
Railway auto-deploys from main branch.

## Design
- Fonts (self-hosted in frontend/public/fonts): DM Sans (headings; the header
  tagline uses its italic file) + Inter (body)
- Colours: amber/brown Bavarian palette
- Brand: "BIERPREIS" + the tagline "Faires Bier für Alle." — the tagline is part
  of the brand, always visible in the header, and shown in German in BOTH
  languages. The 🍺 mark is the existing logo; don't swap it.
- Mobile-first (390×844 is the design target): see "Public UI layout (P0 Phase 3)".

## Global Rules (ALWAYS follow)
1. Check duplicates before adding any venue
2. Price inputs accept 4.80 AND 4,80 (comma/dot)
3. Display: DE → €4,80 / EN → €4.80
4. Never hardcode credentials — always use .env
5. Always npm run build before pushing
6. Always wrap Telegram calls in try/catch
7. Nominatim: 1100ms delay between API calls
8. User-Agent: Bierpreis/1.0 on Nominatim calls
9. Never auto-generate descriptions — descriptions are written by
   humans only (admin edit form, or a user submission an admin
   approves); a venue with none stays empty, never a filler blurb

## Features Completed ✅
- Interactive map with colour-coded pins by type
- Stats bar (avg, cheapest, priciest, area pills)
- Search (name, address, brand, type, neighbourhood)
- Filters (type, brand, serve type, price range, neighbourhood)
- Venue detail (price, brand, serve type, freshness)
- Price history with days at each price
- Unified report button (4 topics)
- Missing bar modal (multi-beer, OSM search)
- Admin dashboard (full venue CRUD)
- Admin review queue (approve/reject)
- Telegram notifications (all submission types)
- Toast notifications (user + admin)
- City selector (München + coming soon cities)
- Searchable brand combobox (93 brands, 6 groups)
- Serve type (tap/bottle/can/unknown)
- Bilingual DE/EN throughout
- Mobile responsive (bottom sheet, clusters)
- Geocoded coordinates for all 170 venues
- Disclaimer on venue detail page
- Navbar: Admin de-emphasised
- Report button prominent below price block
- Admin audit log (table + Activity Log tab + CSV)
- Fixed 14 venue coordinates (real addresses, geocoded)
- Impressum + Datenschutzerklärung (legal)
- Custom domain bierpreis.beer connected to Railway
- Persistent database (Railway volume — survives redeploys)
- SEO metadata (canonical URL, full Open Graph + Twitter Card, JSON-LD, single page H1)
- Self-hosted fonts (Playfair Display + Source Sans 3 — no third-party Google Fonts requests)
- Complete admin audit log coverage (every admin mutation logged, incl. direct beer-price edits)
- Serve type filter (tap/bottle/can/unknown, filter panel + GET /api/venues?serve_type=)
- Price Trends in stats bar (amber pill after the neighbourhood pills, replacing the old sidebar button)
- Price Trends dual view (By Area + By Brand, top-10 fixed brands, per-line no-history fallback)
- Lehel + Schwanthalerhöhe added as Stadtteile (6 total)
- Isarvorstadt polygon expanded to the full Ludwigsvorstadt-Isarvorstadt boundary
- Neighbourhood polygons replaced with real OpenStreetMap admin boundaries
  (Overpass API), venue coordinates verified against Nominatim
- Altstadt + Lehel merged into one "Altstadt-Lehel" district; Schwabing split
  into "Schwabing-West" + "Schwabing-Freimann" — now matches Munich's real
  Stadtbezirk structure (still 6 Stadtteile total)

## P0 roadmap (spec: Bierpreis_P0_Master_Implementation_Prompt.pdf)
- ✅ Phase 0 — audit
- ✅ Phase 1 — data foundation (this section's trust model): verified_at /
  price_observed_at added, serving_volume_ml added, freshness thresholds
  corrected to 30/90 days, fake seed data removed (seed.js no longer
  staggers dates or generates trend-history submissions)
- ✅ Phase 2 — admin foundation (see "Admin data-quality tooling" above): data
  quality dashboard, price editor, one-click verify + Telegram, price history
  viewer, admin search, enriched submission queue
- ✅ Phase 3 — public mobile-first redesign (see "Public UI layout" above). The
  prompt for this phase also covered parts of the spec's phases 4, 6 and 8, so
  these are DONE: price-first markers + selected/freshness states + clusters,
  filter chips, list view, bottom navigation, desktop sidebar + map/list sync.
- ⬜ Still open from the spec: 4 price COLOUR scale + centralised thresholds and
  "Diesen Bereich durchsuchen" · 5 venue bottom sheet content (ROUTE/DETAILS,
  distance, normalised price line) · 6 list sorting (Nähe/Preis/Aktualität) ·
  7 contribution ("Preis falsch?", pick-a-venue report flow) · 9 QA on real
  iOS/Android devices
- Known remaining data-trust debt: seed-invented `reports` counts (the "N reports"
  badge) are still in the data. Every price shows "Datum unbekannt" until
  verified, re-reported or bulk-verified. The fabricated Price Trends
  submissions are removed on the next boot of each environment (see
  "Seeded-submission cleanup"); the Price Trends chart then shows only real
  approved reports, so it stays sparse until people submit prices.

## Still To Do ❌
- Venue descriptions DE+EN for all venues
  (human-written only — see Global Rules)
- Post in r/munich for first real users
- Analytics (Plausible — GDPR compliant)
- Sentry error monitoring
- Tier 2 neighbourhoods
  (Haidhausen, Neuhausen, Bogenhausen, Sendling)
- "Still correct?" one-tap confirmation button
- Photo upload for price reports
- Venue owner claim feature
- QR code campaign for bars
- City expansion (Berlin, Hamburg, Wien)
- Monetisation (venue advertising €29-99/month)

## Beer Brands
93 brands in 6 groups stored in:
frontend/src/constants/brands.js

## Monetisation (future — after 1000 users)
- Ko-fi donations
- Venue advertising €29-99/month
- Patreon tiers
- Affiliate booking links
