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
- 153 venues across 4 Munich Stadtteile as of the last health check
  (17 Sep 2026) — grows via approved community submissions, so treat
  this as a snapshot; check GET /api/stats for the live count. Local
  dev's seed DB and production have diverged independently — don't
  assume they match.
- Tables: cities, neighbourhoods, venues, beers,
  venue_beers, submissions, admin_logs
- Run locally: npm run seed
- Geocode: npm run geocode
- Production DB: /app/data/bierpreis.db
- Volume: muenchner-bierpreis-volume

## Tier 1 Stadtteile
Altstadt, Maxvorstadt, Schwabing, Isarvorstadt

## Cities (future expansion)
München (active), Berlin/Hamburg/Wien (coming soon)

## How to run locally
Terminal 1: node server.js (port 3001)
Terminal 2: cd frontend && npm run dev (port 5173)

## How to deploy
git add -A && git commit -m "msg" && git push origin main
Railway auto-deploys from main branch.

## Design
- Fonts: Playfair Display + Source Sans 3
- Colours: amber/brown Bavarian palette
- Brand: "Bierpreis — Faires Bier für Alle"
- Mobile: bottom sheet, cluster pins, 44px targets

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
- Filters (type, brand, price range, neighbourhood)
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
- Navbar: Admin de-emphasised, Price Trends in sidebar
- Report button prominent below price block
- Admin audit log (table + Activity Log tab + CSV)
- Fixed 14 venue coordinates (real addresses, geocoded)
- Impressum + Datenschutzerklärung (legal)
- Custom domain bierpreis.beer connected to Railway
- Persistent database (Railway volume — survives redeploys)
- SEO metadata (canonical URL, full Open Graph + Twitter Card, JSON-LD, single page H1)
- Self-hosted fonts (Playfair Display + Source Sans 3 — no third-party Google Fonts requests)
- Complete admin audit log coverage (every admin mutation logged, incl. direct beer-price edits)

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
