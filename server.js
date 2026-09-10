require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const {
  initSchema,
  isEmpty,
  getVenues,
  getVenue,
  getNeighbourhoods,
  getStats,
  DB_PATH,
  statements: S,
} = require('./backend/db/database');

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'bierpreis-dev-secret-change-me';
const ADMIN = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'bierpreis2025',
};

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set — using an insecure development default. Set it in .env.');
}

// ─── Bootstrap DB ────────────────────────────────────────────────────────────
initSchema();
if (isEmpty()) {
  console.log('🍺 Empty database detected — seeding from backend/db/seedData.js …');
  require('./backend/db/seed');
}

const app = express();
app.set('etag', false); // API responses are always regenerated from the live DB
app.use(cors());
app.use(express.json());

// Never let a browser or proxy serve a stale API response.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ─── AUTH ────────────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN.username && password === ADMIN.password) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── NEIGHBOURHOODS ──────────────────────────────────────────────────────────
app.get('/api/neighbourhoods', (req, res) => {
  res.json(getNeighbourhoods());
});

// ─── STATS (public — powers the stats bar) ───────────────────────────────────
app.get('/api/stats', (req, res) => {
  res.json(getStats());
});

// ─── VENUES ──────────────────────────────────────────────────────────────────

// German + English words that should match each venue `type` in free-text search.
const TYPE_SEARCH_TERMS = {
  beer_garden: ['biergarten', 'beer garden', 'garden'],
  beer_hall: ['wirtshaus', 'bierhalle', 'bierhaus', 'beer hall', 'inn'],
  bar: ['bar', 'kneipe'],
  restaurant: ['restaurant', 'gaststätte', 'gaststaette'],
};

// Every string a free-text query (`q`) is matched against, lower-cased.
function venueSearchHaystack(v) {
  return [
    v.name,
    v.address,
    v.neighbourhood_id,
    v.neighbourhood_name_de,
    v.neighbourhood_name_en,
    ...v.beers.map((b) => b.brand),
    ...(TYPE_SEARCH_TERMS[v.type] || [v.type]),
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
}

app.get('/api/venues', (req, res) => {
  let result = getVenues();
  const { neighbourhood, type, brand, min_price, max_price, q } = req.query;

  if (neighbourhood) result = result.filter((v) => v.neighbourhood_id === neighbourhood);
  if (type) result = result.filter((v) => v.type === type);
  if (brand) {
    const bl = brand.toLowerCase();
    result = result.filter((v) => v.beers.some((b) => b.brand.toLowerCase().includes(bl)));
  }
  if (min_price) result = result.filter((v) => v.beers[0] && v.beers[0].size_05 >= parseFloat(min_price));
  if (max_price) result = result.filter((v) => v.beers[0] && v.beers[0].size_05 <= parseFloat(max_price));
  if (q && q.trim()) {
    const ql = q.trim().toLowerCase();
    result = result.filter((v) => venueSearchHaystack(v).some((s) => s.includes(ql)));
  }

  res.json(result);
});

app.get('/api/venues/:id', (req, res) => {
  const venue = getVenue(req.params.id);
  if (!venue) return res.status(404).json({ error: 'Not found' });

  const price_history = S.approvedHistoryForVenue.all(req.params.id);
  res.json({ ...venue, price_history });
});

// ─── SUBMISSIONS ─────────────────────────────────────────────────────────────
app.post('/api/submissions', (req, res) => {
  const {
    venue_id,
    venue_name,
    is_new_venue,
    beer_brand,
    size,
    price,
    visit_date,
    submitter_name,
    note,
  } = req.body || {};

  if (!price || !beer_brand || !size) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const numPrice = parseFloat(price);
  if (Number.isNaN(numPrice) || numPrice < 1 || numPrice > 30) {
    return res.status(400).json({ error: 'Invalid price' });
  }

  // Outlier check: >25% deviation from the current headline price.
  let isOutlier = false;
  let resolvedName = venue_name;
  if (venue_id) {
    const venue = getVenue(venue_id);
    if (venue) {
      resolvedName = resolvedName || venue.name;
      const beer = venue.beers[0];
      if (beer) {
        const currentPrice = size === '1L' ? beer.size_mass : beer.size_05;
        if (currentPrice && Math.abs(numPrice - currentPrice) / currentPrice > 0.25) {
          isOutlier = true;
        }
      }
    }
  }

  const seq = S.nextSubmissionSeq.get().n + 1;
  const submission = {
    id: `s${String(seq).padStart(3, '0')}`,
    venue_id: venue_id || null,
    venue_name: resolvedName || null,
    is_new_venue: is_new_venue ? 1 : 0,
    beer_brand,
    size,
    price: numPrice,
    visit_date: visit_date || new Date().toISOString().split('T')[0],
    submitter_name: submitter_name || 'Anonym',
    note: note || '',
    status: 'pending',
    is_outlier: isOutlier ? 1 : 0,
    created_at: new Date().toISOString(),
  };

  S.insertSubmission.run(submission);
  res.status(201).json({ message: 'Submitted successfully', id: submission.id, is_outlier: isOutlier });
});

// ─── ADMIN ROUTES ────────────────────────────────────────────────────────────
app.get('/api/admin/submissions', authMiddleware, (req, res) => {
  const { status } = req.query;
  const rows = status ? S.submissionsByStatus.all(status) : S.allSubmissions.all();
  res.json(rows);
});

app.patch('/api/admin/submissions/:id', authMiddleware, (req, res) => {
  const sub = S.submissionById.get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Not found' });

  const { status } = req.body || {};
  S.setSubmissionStatus.run(status, sub.id);

  // If approved for an existing venue, roll the headline price forward.
  if (status === 'approved' && sub.venue_id && !sub.is_new_venue) {
    S.updateHeadlinePrice.run({
      venue_id: sub.venue_id,
      size: sub.size,
      price: sub.price,
      visit_date: sub.visit_date,
    });
  }

  res.json({ message: 'Updated', submission: { ...sub, status } });
});

app.get('/api/admin/stats', authMiddleware, (req, res) => {
  const byStatus = {};
  for (const row of S.countSubmissionsByStatus.all()) byStatus[row.status] = row.n;
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

  res.json({
    total_venues: S.countVenues.get().n,
    total_submissions: total,
    pending: byStatus.pending || 0,
    approved: byStatus.approved || 0,
    rejected: byStatus.rejected || 0,
    outliers: S.countPendingOutliers.get().n,
  });
});

app.listen(PORT, () => {
  console.log(`🍺 Bierpreis API running on http://localhost:${PORT}`);
  console.log(`   DB: ${DB_PATH}`);
});
