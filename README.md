# 🍺 MünchnerBierpreis — v3

**Find your Helles. Know what you pay.**

A full-stack web app showing Helles beer prices across Munich's key neighbourhoods.
v3 adds a real SQLite database, a city-wide stats bar, price-freshness traffic
lights, and a mobile bottom-sheet layout.

## Quick Start

```bash
# 1. Install dependencies (once)
npm install
cd frontend && npm install && cd ..

# 2. Backend  →  http://localhost:3001
node server.js

# 3. Frontend →  http://localhost:5173
cd frontend && npm run dev
```

`node server.js` creates `backend/db/bierpreis.db` and seeds it automatically on
first run. Nothing else to do.

## Configuration — `.env`

Copy `.env.example` to `.env` (a working `.env` is already included). Keys:

| Key              | Default                    | Purpose                              |
| ---------------- | -------------------------- | ------------------------------------ |
| `PORT`           | `3001`                     | API port                            |
| `JWT_SECRET`     | dev placeholder            | signs admin JWTs — change for prod  |
| `ADMIN_USERNAME` | `admin`                    | admin dashboard login               |
| `ADMIN_PASSWORD` | `bierpreis2025`            | admin dashboard login               |
| `DATABASE_PATH`  | `./backend/db/bierpreis.db`| SQLite file (relative to repo root) |

The frontend API base can be overridden with `VITE_API_URL`.

## Database

SQLite via **better-sqlite3**. Schema in `backend/db/schema.sql`:

- **neighbourhoods** — id, names (de/en), centre coords, descriptions
- **venues** — id, name, type, neighbourhood_id, address, coords, hours, website, descriptions
- **beers** — one row per beer at a venue; `size_05` / `size_mass` prices, `updated` (last confirmed), `reports`
- **submissions** — community price reports; `status` (pending/approved/rejected), `is_outlier`

Seed / re-seed manually:

```bash
npm run seed          # seed only if empty
npm run seed:force    # wipe and re-seed
```

Seed data: 13 venues across **Altstadt, Maxvorstadt, Schwabing, Isarvorstadt**
with their 2025 Helles prices. Each price's "last confirmed" date is spread
across recent months so the freshness traffic light shows a realistic mix.

## Features (v3)

- 🗺️ Interactive Munich map with 4 Stadtteile, price-coloured polygons
- 📊 **Stats bar** — city-wide average, cheapest & most-expensive venue,
  per-neighbourhood average toggle pills (click to focus a neighbourhood)
- 🚦 **Price-freshness traffic light** on every venue card —
  🟢 &lt; 3 months · 🟡 3–6 months · 🔴 &gt; 6 months
- 📱 **Mobile** — full-screen map with a draggable bottom sheet for the venue list
- 🔍 Search + filters (type, brand, price range, neighbourhood)
- 💬 Community price reporting with outlier detection
- 🔒 Admin dashboard: review / approve / reject submissions
- 🌐 Bilingual: German & English

## Admin Dashboard

Click **Admin** in the nav bar. Credentials come from `.env`
(`admin` / `bierpreis2025` by default).

## API

| Method | Route                        | Notes                              |
| ------ | ---------------------------- | ---------------------------------- |
| GET    | `/api/neighbourhoods`        | with `avg_price`, `venue_count`   |
| GET    | `/api/stats`                 | powers the stats bar              |
| GET    | `/api/venues`                | filters: `neighbourhood,type,brand,min_price,max_price,q` |
| GET    | `/api/venues/:id`            | includes approved `price_history` |
| POST   | `/api/submissions`           | community price report            |
| POST   | `/api/admin/login`           | → `{ token }`                     |
| GET    | `/api/admin/submissions`     | auth; `?status=`                  |
| PATCH  | `/api/admin/submissions/:id` | auth; `{ status }`                |
| GET    | `/api/admin/stats`           | auth                              |

## Next Steps

- Add Haidhausen, Neuhausen, Bogenhausen, Sendling
- Photo upload for price reports
- Hash the admin password (bcryptjs is already a dependency)
