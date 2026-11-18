# Bierpreis

**Faires Bier für Alle.** A bilingual (German/English) map of Helles beer prices across Munich.

**Live: [bierpreis.beer](https://bierpreis.beer/)**

![Bierpreis on a phone and desktop](https://sittanbon.github.io/bierpreis-live-screenshot.jpg)

## What it does

- **Price-first map and list.** Markers show the actual menu price, coloured by how recently it was confirmed. The map and list are two views of the same data, so filters, search and sorting carry over.
- **Around 180 venues across six Munich districts**, drawn from official OpenStreetMap district boundaries, with neighbourhood averages and a price-level legend.
- **Honest data.** A price's age comes only from when it was observed or verified. Unknown dates and unknown serving sizes are shown as unknown, never guessed. Prices for other sizes are converted to a per-0.5 L comparison but never shown as what you pay.
- **Community reports.** A stepped form for price changes, new beers, closed venues and other corrections, plus "Missing a bar?" with a duplicate check.
- **Admin tools.** Review queue for reports, price editor with history, one-click price verification, a data-quality dashboard that flags issues for human review, an audit log and Telegram notifications.
- **Mobile-first and accessible.** Draggable bottom sheet, 44 px touch targets, keyboard and screen-reader support, reduced-motion support and self-hosted fonts.

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React, Vite, Leaflet with OpenStreetMap, i18next, Recharts |
| Backend | Node.js, Express, JWT admin auth |
| Database | SQLite (better-sqlite3) |
| Tests | Node test runner (backend), Vitest (frontend) |
| Hosting | Railway, auto-deployed from `main`, persistent volume for the database |

## Run it locally

```bash
npm install
cd frontend && npm install && cd ..
cp .env.example .env      # then set your own admin password and JWT secret

node server.js            # API on http://localhost:3001 (creates and seeds the database)
cd frontend && npm run dev   # app on http://localhost:5173
```

Run the tests with `npm test`.

## Project structure

```
server.js            Express API
backend/             data-quality rules, notifications, tests
backend/db/          schema, migrations, seed and data scripts
frontend/src/        React app (components, hooks, shared constants, utils)
```

## Roadmap

- More districts (Haidhausen, Neuhausen, Bogenhausen, Sendling)
- Privacy-friendly analytics and error monitoring
- One-tap "still correct?" confirmation and photo upload for reports
- Other cities (Berlin, Hamburg, Vienna)

Built by [Sittan (Bon) Charoensuwan](https://sittanbon.github.io/).
