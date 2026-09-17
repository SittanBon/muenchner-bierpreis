import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { fetchTrends } from '../hooks/useApi';
import { formatEuro } from '../utils/price';

// ── By Area (existing) ───────────────────────────────────────────────────────
// Fixed categorical order (validated for CVD-safety via the dataviz skill's
// validator — worst adjacent ΔE 9.1 CVD / 22.9 normal-vision, all PASS). Assigned
// by entity (neighbourhood id), never by rank, so toggling a line off never
// repaints the survivors.
const NEIGHBOURHOOD_COLORS = {
  altstadt: '#2a78d6',      // blue
  maxvorstadt: '#eb6834',   // orange
  schwabing: '#1baf7a',     // aqua
  isarvorstadt: '#eda100',  // yellow
};
const CITY_COLOR = '#5a3d1e'; // muted, dashed reference line — distinct from the categorical set
const NEIGHBOURHOOD_ORDER = ['altstadt', 'maxvorstadt', 'schwabing', 'isarvorstadt'];

// ── By Brand (new) ────────────────────────────────────────────────────────────
// Fixed order + colours, exactly as specified — not a dynamically-computed
// "most common right now" ranking, same reasoning as NEIGHBOURHOOD_COLORS: a
// brand's colour must never shift just because a new submission changed its
// rank. Must match backend/db/database.js's TREND_BRANDS list exactly (that's
// what buckets everything else into 'others' server-side).
const BRAND_ORDER = [
  'Augustiner', 'Paulaner', 'Hofbräu München', 'Hacker-Pschorr', 'Löwenbräu',
  'Spaten', 'Tegernseer', 'Weihenstephaner', 'Giesinger Bräu', 'Ayinger', 'others',
];
const BRAND_COLORS = {
  'Augustiner': '#e8a020',
  'Paulaner': '#1a6eb5',
  'Hofbräu München': '#2d7a2d',
  'Hacker-Pschorr': '#8b0000',
  'Löwenbräu': '#5bc0eb',
  'Spaten': '#7a4a06',
  'Tegernseer': '#6b4226',
  'Weihenstephaner': '#4a7c59',
  'Giesinger Bräu': '#e07020',
  'Ayinger': '#6a0dad',
  others: '#8a8a8a', // grey, dashed — same "collapsed catch-all" treatment as the city-avg reference line
};

function monthLabel(month, locale) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'short', year: '2-digit' });
}

// Last 12 calendar months ending with the current one, oldest first —
// independent of which months actually have data, so the x-axis stays a
// fixed, predictable window (brief: "X axis: last 12 months") rather than
// silently shrinking on a quiet month.
function last12Months() {
  const out = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d);
    m.setUTCMonth(m.getUTCMonth() - i);
    out.push(`${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

// One line's 12 points, each either a real (month, avg, n) triple or — when
// this id has NO submission history at all across the whole window — a flat
// fallback at its current live average with no `n` (brief: "If no submission
// history for a line: show flat line at current average").
function buildLinePoints(monthlySeries, currentAvg, months) {
  const hasAnyHistory = monthlySeries && Object.keys(monthlySeries).length > 0;
  const points = {};
  for (const m of months) {
    if (hasAnyHistory) {
      const point = monthlySeries[m];
      points[m] = { value: point ? point.avg : null, n: point ? point.n : null, fallback: false };
    } else {
      points[m] = { value: currentAvg ?? null, n: null, fallback: true };
    }
  }
  return points;
}

// Custom tooltip, declared at module scope (not inside PriceTrends) so its
// component identity stays stable across renders — a declarative
// formatter/labelFormatter pair can't easily show a DIFFERENT second line
// (data-point count vs. the "no historical data yet" note) per series, so
// this reads each visible series' own {value, n, fallback} triple straight
// off the hovered row instead. Everything it needs from the parent (how to
// label/translate a line id, the active locale) comes in as props.
function TrendsTooltip({ active, payload, label, labelFor, locale, t }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="trends-tooltip">
      <div className="trends-tooltip-date">{label}</div>
      {payload.map((entry) => {
        const id = entry.dataKey;
        const row = entry.payload;
        const n = row[`${id}__n`];
        const fallback = row[`${id}__fallback`];
        if (entry.value == null) return null;
        return (
          <div key={id} className="trends-tooltip-row">
            <span className="trends-tooltip-swatch" style={{ background: entry.color }} />
            <span className="trends-tooltip-name">{labelFor(id)}</span>
            <span className="trends-tooltip-price">{formatEuro(entry.value, locale)}</span>
            <span className="trends-tooltip-meta">
              {fallback ? t('trends.noHistoryTooltip') : t('trends.dataPoints', { count: n ?? 0 })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function PriceTrends({ neighbourhoods, onClose }) {
  const { t, i18n } = useTranslation();
  const [trends, setTrends] = useState(null);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState('area'); // 'area' | 'brand' — By Area is the default view
  const [visible, setVisible] = useState(() => new Set([...NEIGHBOURHOOD_ORDER, 'city']));

  useEffect(() => {
    fetchTrends().then(setTrends).catch(() => setError(true));
  }, []);

  // Each view mode has its own set of line ids — switching modes starts that
  // mode fresh with everything visible rather than carrying over stale ids
  // (or an empty set) from whichever lines the other mode's legend had
  // toggled. Set synchronously in the click handler itself (see
  // switchViewMode below), not in an effect keyed on viewMode.
  const switchViewMode = (mode) => {
    setViewMode(mode);
    setVisible(new Set(mode === 'area' ? [...NEIGHBOURHOOD_ORDER, 'city'] : BRAND_ORDER));
  };

  const nameById = useMemo(() => {
    const map = {};
    (neighbourhoods || []).forEach((n) => { map[n.id] = i18n.language === 'de' ? n.name_de : n.name_en; });
    return map;
  }, [neighbourhoods, i18n.language]);

  const de = i18n.language === 'de';
  const labelFor = (id) => {
    if (id === 'city') return de ? 'München Ø' : 'Munich avg';
    if (id === 'others') return t('trends.others');
    if (viewMode === 'brand') return id; // brand names are already display-ready, no translation
    return nameById[id] || id;
  };
  const colorFor = (id) => (viewMode === 'area' ? (id === 'city' ? CITY_COLOR : NEIGHBOURHOOD_COLORS[id]) : BRAND_COLORS[id]);
  const activeIds = viewMode === 'area' ? [...NEIGHBOURHOOD_ORDER, 'city'] : BRAND_ORDER;

  const months = useMemo(() => last12Months(), []);

  const chartData = useMemo(() => {
    if (!trends) return [];
    const locale = de ? 'de-DE' : 'en-GB';

    // Pre-compute each line's 12 points once, keyed by id, before flattening
    // into per-month rows — every line needs the SAME fixed months array
    // regardless of which months it actually has data for.
    const lines = {};
    if (viewMode === 'area') {
      for (const id of NEIGHBOURHOOD_ORDER) {
        lines[id] = buildLinePoints(trends.series?.[id], trends.currentByNeighbourhood?.[id], months);
      }
      lines.city = buildLinePoints(trends.city, null, months); // no single "current" city fallback source is meaningful here — the city line has always had full history in practice
    } else {
      for (const id of BRAND_ORDER) {
        lines[id] = buildLinePoints(trends.brandSeries?.[id], trends.currentByBrand?.[id], months);
      }
    }

    return months.map((month) => {
      const row = { month, monthLabel: monthLabel(month, locale) };
      for (const id of Object.keys(lines)) {
        row[id] = lines[id][month].value;
        row[`${id}__n`] = lines[id][month].n;
        row[`${id}__fallback`] = lines[id][month].fallback;
      }
      return row;
    });
  }, [trends, viewMode, months, de]);

  const toggle = (key) => {
    setVisible((v) => {
      const next = new Set(v);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card trends-card" onClick={(e) => e.stopPropagation()}>
        <div className="trends-header">
          <div>
            <div className="trends-title">📊 {t('trends.title')}</div>
            <div className="trends-subtitle">{t('trends.subtitle')}</div>
          </div>
          <button className="panel-close" onClick={onClose}>✕</button>
        </div>

        {/* View-mode switch — a different question from the legend toggles
            below it (which line to show), so it's its own row. */}
        <div className="trends-mode-toggle" role="group" aria-label={t('trends.title')}>
          <button
            type="button"
            className={`trends-mode-btn ${viewMode === 'area' ? 'active' : ''}`}
            aria-pressed={viewMode === 'area'}
            onClick={() => switchViewMode('area')}
          >
            🗺️ {t('trends.byArea')}
          </button>
          <button
            type="button"
            className={`trends-mode-btn ${viewMode === 'brand' ? 'active' : ''}`}
            aria-pressed={viewMode === 'brand'}
            onClick={() => switchViewMode('brand')}
          >
            🍻 {t('trends.byBrand')}
          </button>
        </div>

        {/* Series toggles double as the legend's relief labels (contrast WARN on the
            categorical palette against a white surface requires visible labels). */}
        <div className="trends-toggles">
          {activeIds.map((id) => (
            <button
              key={id}
              type="button"
              className={`trends-toggle ${visible.has(id) ? 'active' : ''}`}
              style={{ '--tc': colorFor(id) }}
              onClick={() => toggle(id)}
              aria-pressed={visible.has(id)}
            >
              <span className={`trends-swatch ${id === 'city' || id === 'others' ? 'trends-swatch-dashed' : ''}`} />
              {labelFor(id)}
            </button>
          ))}
        </div>

        <div className="trends-chart">
          {error && <div className="no-venues">{t('trends.error')}</div>}
          {!error && !trends && <div className="loading-state"><div className="loading-spinner">🍺</div></div>}
          {!error && trends && chartData.length === 0 && (
            <div className="no-venues">{t('trends.noData')}</div>
          )}
          {!error && trends && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={{ stroke: 'var(--border-md)' }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                  axisLine={false}
                  tickLine={false}
                  domain={['dataMin - 0.3', 'dataMax + 0.3']}
                  tickFormatter={(v) => formatEuro(v, i18n.language)}
                  width={52}
                />
                <Tooltip content={<TrendsTooltip labelFor={labelFor} locale={i18n.language} t={t} />} />
                {activeIds.map((id) => visible.has(id) && (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    name={labelFor(id)}
                    stroke={colorFor(id)}
                    strokeWidth={2}
                    strokeDasharray={(id === 'city' || id === 'others') ? '6 4' : undefined}
                    dot={(id === 'city' || id === 'others') ? false : { r: 3, strokeWidth: 0 }}
                    activeDot={{ r: (id === 'city' || id === 'others') ? 5 : 6 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
