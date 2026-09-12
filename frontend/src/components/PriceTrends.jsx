import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { fetchTrends } from '../hooks/useApi';

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

function monthLabel(month, locale) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'short', year: '2-digit' });
}

export default function PriceTrends({ neighbourhoods, onClose }) {
  const { t, i18n } = useTranslation();
  const [trends, setTrends] = useState(null);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(() => new Set([...NEIGHBOURHOOD_ORDER, 'city']));

  useEffect(() => {
    fetchTrends().then(setTrends).catch(() => setError(true));
  }, []);

  const nameById = useMemo(() => {
    const map = {};
    (neighbourhoods || []).forEach((n) => { map[n.id] = i18n.language === 'de' ? n.name_de : n.name_en; });
    return map;
  }, [neighbourhoods, i18n.language]);

  const chartData = useMemo(() => {
    if (!trends) return [];
    return trends.months.map((month) => {
      const row = { month, monthLabel: monthLabel(month, i18n.language === 'de' ? 'de-DE' : 'en-GB') };
      NEIGHBOURHOOD_ORDER.forEach((id) => { row[id] = trends.series[id]?.[month] ?? null; });
      row.city = trends.city[month] ?? null;
      return row;
    });
  }, [trends, i18n.language]);

  const toggle = (key) => {
    setVisible((v) => {
      const next = new Set(v);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const de = i18n.language === 'de';

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

        {/* Series toggles double as the legend's relief labels (contrast WARN on the
            categorical palette against a white surface requires visible labels). */}
        <div className="trends-toggles">
          {NEIGHBOURHOOD_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={`trends-toggle ${visible.has(id) ? 'active' : ''}`}
              style={{ '--tc': NEIGHBOURHOOD_COLORS[id] }}
              onClick={() => toggle(id)}
              aria-pressed={visible.has(id)}
            >
              <span className="trends-swatch" />
              {nameById[id] || id}
            </button>
          ))}
          <button
            type="button"
            className={`trends-toggle ${visible.has('city') ? 'active' : ''}`}
            style={{ '--tc': CITY_COLOR }}
            onClick={() => toggle('city')}
            aria-pressed={visible.has('city')}
          >
            <span className="trends-swatch trends-swatch-dashed" />
            {de ? 'München Ø' : 'Munich avg'}
          </button>
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
                  tickFormatter={(v) => `€${v.toFixed(2)}`}
                  width={52}
                />
                <Tooltip
                  formatter={(value, key) => [value == null ? '—' : `€${Number(value).toFixed(2)}`, key === 'city' ? (de ? 'München Ø' : 'Munich avg') : (nameById[key] || key)]}
                  labelFormatter={(label) => label}
                  contentStyle={{ background: 'var(--amber-900)', border: 'none', borderRadius: 10, color: 'var(--amber-100)' }}
                  itemStyle={{ color: 'var(--amber-100)' }}
                  labelStyle={{ color: 'var(--amber-200)', fontWeight: 600 }}
                />
                {NEIGHBOURHOOD_ORDER.map((id) => visible.has(id) && (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    name={nameById[id] || id}
                    stroke={NEIGHBOURHOOD_COLORS[id]}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
                {visible.has('city') && (
                  <Line
                    key="city"
                    type="monotone"
                    dataKey="city"
                    name={de ? 'München Ø' : 'Munich avg'}
                    stroke={CITY_COLOR}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
