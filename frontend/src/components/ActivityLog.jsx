import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { adminFetchLogs, adminExportLogsCsv } from '../hooks/useApi';
import { formatEuro } from '../utils/price';

const ACTION_TYPES = [
  'APPROVE', 'REJECT', 'EDIT_VENUE', 'ADD_VENUE', 'DELETE_VENUE',
  'ADD_BEER', 'DELETE_BEER', 'EDIT_BEER', 'VERIFY_PRICE', 'DISMISS_FLAG', 'TOGGLE_ACTIVE', 'MARK_CLOSED',
];
const BADGE_COLOR = {
  APPROVE: 'green', ADD_VENUE: 'green', ADD_BEER: 'green', VERIFY_PRICE: 'green',
  REJECT: 'red', DELETE_VENUE: 'red', DELETE_BEER: 'red',
  EDIT_VENUE: 'amber', TOGGLE_ACTIVE: 'amber', MARK_CLOSED: 'amber', EDIT_BEER: 'amber', DISMISS_FLAG: 'amber',
};
const EMPTY_FILTERS = { action_type: '', venue: '', from: '', to: '' };

function formatLogTimestamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

// One field key -> a readable label for the EDIT_VENUE "field: old -> new" line.
const FIELD_LABELS = {
  name: 'Name', type: 'Type', neighbourhood_id: 'Neighbourhood', address: 'Address',
  lat: 'Lat', lng: 'Lng', opening_hours: 'Hours', website: 'Website',
  description_de: 'Description (DE)', description_en: 'Description (EN)',
};

// Turns each action_type's `details` JSON into the one-line summary the table
// shows, e.g. "Price: €5,20 → €5,80" — every shape is exactly what server.js's
// logAdminAction() calls attach for that action_type.
function formatDetails(log, lang, t) {
  const d = log.details;
  if (!d) return '—';
  const eur = (n) => (n == null ? '—' : formatEuro(n, lang));
  switch (log.action_type) {
    case 'APPROVE':
      return d.old_price != null
        ? `${d.brand ? d.brand + ' — ' : ''}${eur(d.old_price)} → ${eur(d.new_price)}`
        : `${d.brand ? d.brand + ' — ' : ''}${eur(d.new_price)}`;
    case 'REJECT':
      return d.reason ? `${t('admin.logs.columnDetails')}: ${d.reason}` : t('admin.logs.noReason');
    case 'EDIT_VENUE':
      return `${FIELD_LABELS[d.field] || d.field}: ${d.old_value ?? '—'} → ${d.new_value ?? '—'}`;
    case 'ADD_VENUE':
      return [d.type, d.neighbourhood].filter(Boolean).join(' · ') || '—';
    case 'DELETE_VENUE':
      return d.neighbourhood || '—';
    case 'ADD_BEER':
      return `${d.brand || ''} — ${eur(d.price)}${d.size ? ` (${d.size})` : ''}`;
    case 'DELETE_BEER':
      return d.brand || '—';
    case 'EDIT_BEER': {
      const head = d.brand ? d.brand + ' — ' : '';
      // A price change reads "€5,20 → €5,80"; an edit that left the price alone
      // (size, date, source, notes…) lists what changed instead.
      if (d.old_price !== d.new_price || !d.changed_fields) return `${head}${eur(d.old_price)} → ${eur(d.new_price)}`;
      return `${head}${eur(d.new_price)} (${d.changed_fields.join(', ')})`;
    }
    case 'DISMISS_FLAG':
      return `${d.flag}${d.brand ? ` — ${d.brand}` : ''}`;
    case 'VERIFY_PRICE':
      return `${d.brand ? d.brand + ' — ' : ''}${eur(d.price)}`;
    case 'TOGGLE_ACTIVE':
      return `${t('admin.logs.active')}: ${d.old_state ? '✓' : '✕'} → ${d.new_state ? '✓' : '✕'}`;
    case 'MARK_CLOSED':
      return t('admin.logs.permanentlyClosed');
    default:
      return JSON.stringify(d);
  }
}

export default function ActivityLog({ token, onSelectVenue }) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    adminFetchLogs(token, { ...filters, page })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, filters, page]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setPage(1); };
  const filtersActive = Object.values(filters).some(Boolean);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await adminExportLogsCsv(token, filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bierpreis-admin-logs.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
    setExporting(false);
  };

  return (
    <div className="activity-log">
      <div className="vm-header">
        <div className="vm-count">{t('admin.logs.total', { count: data?.total ?? 0 })}</div>
        <button className="vm-add-btn" onClick={exportCsv} disabled={exporting}>
          {exporting ? '...' : t('admin.logs.exportCsv')}
        </button>
      </div>

      <div className="log-filters">
        <select value={filters.action_type} onChange={(e) => setFilter('action_type', e.target.value)}>
          <option value="">{t('admin.logs.allActions')}</option>
          {ACTION_TYPES.map((a) => <option key={a} value={a}>{t(`admin.logs.actions.${a}`)}</option>)}
        </select>
        <input
          type="text" placeholder={t('admin.logs.filterVenue')}
          value={filters.venue} onChange={(e) => setFilter('venue', e.target.value)}
        />
        <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} aria-label="from" />
        <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} aria-label="to" />
        <button className="log-clear-btn" onClick={clearFilters} disabled={!filtersActive}>
          {t('admin.logs.clearFilters')}
        </button>
      </div>

      {error && <div className="sf-error">{error}</div>}

      {loading ? (
        <div className="loading">{t('loading')}</div>
      ) : (
        <>
          <div className="vm-table-wrap">
            <table className="vm-table log-table">
              <thead>
                <tr>
                  <th>{t('admin.logs.columnTime')}</th>
                  <th>{t('admin.logs.columnAction')}</th>
                  <th>{t('admin.logs.columnVenue')}</th>
                  <th>{t('admin.logs.columnDetails')}</th>
                  <th>{t('admin.logs.columnBy')}</th>
                </tr>
              </thead>
              <tbody>
                {(data?.logs || []).map((log) => (
                  <tr key={log.id}>
                    <td>{formatLogTimestamp(log.created_at)}</td>
                    <td>
                      <span className={`log-badge log-badge-${BADGE_COLOR[log.action_type] || 'amber'}`}>
                        {t(`admin.logs.actions.${log.action_type}`, log.action_type)}
                      </span>
                    </td>
                    <td>
                      {log.venue_name ? (
                        <button type="button" className="log-venue-link" onClick={() => onSelectVenue?.(log.venue_name)}>
                          {log.venue_name}
                        </button>
                      ) : '—'}
                    </td>
                    <td className="log-details">{formatDetails(log, i18n.language, t)}</td>
                    <td>{log.performed_by}</td>
                  </tr>
                ))}
                {(data?.logs || []).length === 0 && (
                  <tr><td colSpan={5} className="vm-no-results">{t('admin.logs.noLogs')}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="log-pagination">
              <button className="log-page-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t('admin.logs.prev')}
              </button>
              <span>{t('admin.logs.pageInfo', { page: data.page, total: data.totalPages })}</span>
              <button className="log-page-btn" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                {t('admin.logs.next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
