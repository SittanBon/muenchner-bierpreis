import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { formatEuro } from '../utils/price';

// Split out of VenueDetail so `recharts` (the heaviest dependency) is only downloaded
// when someone actually opens a venue that has a price history to draw — not by
// every first-time visitor who just wants to see the map.

// Same validated categorical order used for the Price Trends chart (dataviz
// skill's default palette) — assigned by the beer's position in the venue's
// (already cheapest-first) list, so a brand keeps its colour across renders.
const BRAND_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const DAY_MS = 24 * 60 * 60 * 1000;

// Per-brand history rows with "days at this price" — the days between a price
// taking effect and the next reported change for that SAME brand (or today, if
// it's still the current price).
function daysAtPriceRows(history) {
  const byBrand = {};
  (history || []).forEach((h) => { (byBrand[h.beer_brand] ||= []).push(h); });

  const today = new Date();
  const rows = [];
  for (const [brand, entries] of Object.entries(byBrand)) {
    const sorted = [...entries].sort((a, b) => a.visit_date.localeCompare(b.visit_date));
    sorted.forEach((h, i) => {
      const start = new Date(h.visit_date);
      const end = i < sorted.length - 1 ? new Date(sorted[i + 1].visit_date) : today;
      const days = Math.max(0, Math.round((end - start) / DAY_MS));
      rows.push({ ...h, brand, days, isCurrent: i === sorted.length - 1 });
    });
  }
  return rows.sort((a, b) => b.visit_date.localeCompare(a.visit_date));
}

export default function BrandHistoryChart({ history, beers }) {
  const { t, i18n } = useTranslation();
  const brands = useMemo(() => beers.map((b) => b.brand), [beers]);
  const [visible, setVisible] = useState(() => new Set(brands));

  useEffect(() => { setVisible(new Set(brands)); }, [brands]);

  const colorFor = (brand) => {
    const i = brands.indexOf(brand);
    return BRAND_COLORS[i >= 0 ? i % BRAND_COLORS.length : 0];
  };

  const chartData = useMemo(() => {
    if (!history?.length) return [];
    const byDate = {};
    [...history].sort((a, b) => a.visit_date.localeCompare(b.visit_date)).forEach((h) => {
      const row = byDate[h.visit_date] || (byDate[h.visit_date] = { date: h.visit_date });
      row[h.beer_brand] = h.price;
    });
    return Object.values(byDate);
  }, [history]);

  const rows = useMemo(() => daysAtPriceRows(history), [history]);

  const toggle = (brand) => {
    setVisible((v) => {
      const next = new Set(v);
      if (next.has(brand)) next.delete(brand); else next.add(brand);
      return next;
    });
  };

  if (!history?.length) {
    return <div className="vdp-history-empty">{t('venue.noHistory')}</div>;
  }

  return (
    <div className="brand-history">
      <div className="brand-history-toggles">
        {brands.map((brand) => (
          <button
            key={brand}
            type="button"
            className={`trends-toggle ${visible.has(brand) ? 'active' : ''}`}
            style={{ '--tc': colorFor(brand) }}
            onClick={() => toggle(brand)}
            aria-pressed={visible.has(brand)}
          >
            <span className="trends-swatch" />
            {brand}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }} title={t('priceHistory')}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={{ stroke: 'var(--border-md)' }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatEuro(v, i18n.language)}
            width={48}
          />
          <Tooltip
            formatter={(value, key) => [formatEuro(value, i18n.language), key]}
            contentStyle={{ background: 'var(--amber-900)', border: 'none', borderRadius: 10, color: 'var(--amber-100)' }}
            itemStyle={{ color: 'var(--amber-100)' }}
            labelStyle={{ color: 'var(--amber-200)', fontWeight: 600 }}
          />
          {brands.filter((b) => visible.has(b)).map((brand) => (
            <Line
              key={brand}
              type="monotone"
              dataKey={brand}
              name={brand}
              stroke={colorFor(brand)}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Days-at-price list */}
      <div className="days-at-price-list">
        {rows.map((r, i) => (
          <div key={i} className="dap-row">
            <span className="dap-swatch" style={{ background: colorFor(r.brand) }} />
            <span className="dap-brand">{r.brand}</span>
            <span className="dap-price">{formatEuro(r.price, i18n.language)}</span>
            <span className="dap-date">{new Date(r.visit_date).toLocaleDateString()}</span>
            <span className="dap-days">{t('venue.daysAtPrice', { count: r.days })}{r.isCurrent ? ` (${t('venue.current')})` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
