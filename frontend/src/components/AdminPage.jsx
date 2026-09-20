import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminLogin, adminFetchSubmissions, adminUpdateSubmission, adminFetchStats } from '../hooks/useApi';
import VenueManager from './VenueManager';
import CityManager from './CityManager';
import ActivityLog from './ActivityLog';
import DataQualityPanel from './DataQualityPanel';
import SubmissionPriceInfo from './SubmissionPriceInfo';
import MiniMapPreview from './MiniMapPreview';
import { formatEuro } from '../utils/price';
import { servingSizeByWire, servingLabel } from '../constants/servingSizes';
import { useToast } from '../hooks/useToast';

const REPORT_TYPE_META = {
  new_venue: { icon: '🆕', label: 'New Venue' },
  price_change: { icon: '💶', label: 'Price change' },
  new_beer: { icon: '🍺', label: 'New beer' },
  closed: { icon: '🔒', label: 'Closed' },
  other_info: { icon: 'ℹ️', label: 'Other info' },
  suggest_description: { icon: '📝', label: 'Description suggested' },
};

export default function AdminPage({ onBack }) {
  const { t, i18n } = useTranslation();
  const showToast = useToast();
  const [token, setToken] = useState(localStorage.getItem('bp_admin_token') || '');
  const [creds, setCreds] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState('submissions'); // 'submissions' | 'venues' | 'quality' | 'cities' | 'logs'
  const [venuesQuery, setVenuesQuery] = useState(''); // seeded by "jump to venue" from the Activity Log / Data Quality
  const [venuesEditId, setVenuesEditId] = useState(null); // Data Quality's "Edit" also opens that venue's editor
  const openVenueInManager = (name, id = null) => { setVenuesQuery(name || ''); setVenuesEditId(id); setSection('venues'); };

  const handleLogin = async () => {
    const res = await adminLogin(creds.username, creds.password);
    if (res.token) {
      setToken(res.token);
      localStorage.setItem('bp_admin_token', res.token);
      setLoginError('');
    } else {
      setLoginError('Invalid credentials');
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('bp_admin_token');
  };

  // Re-fetched every time the Submissions tab is (re)opened, not just once: each
  // card shows the venue's CURRENT price for comparison, and an admin who has
  // since verified or edited a price on another tab must not review against a
  // stale snapshot of it.
  useEffect(() => {
    if (!token || section !== 'submissions') return;
    setLoading(true);
    Promise.all([
      adminFetchSubmissions(token, filter),
      adminFetchStats(token)
    ]).then(([subs, st]) => {
      setSubmissions(subs);
      setStats(st);
      setLoading(false);
    }).catch(() => { setToken(''); setLoading(false); });
  }, [token, filter, section]);

  const handleAction = async (id, status, reject_reason) => {
    // Captured before the row disappears from `submissions` below — the toast
    // needs the venue name and report_type of the row that was just actioned.
    const sub = submissions.find((s) => s.id === id);
    let result;
    try {
      result = await adminUpdateSubmission(token, id, status, reject_reason);
    } catch {
      // Token likely expired/invalid mid-session — drop back to the login screen
      // rather than leaving the button silently doing nothing.
      handleLogout();
      return;
    }
    setSubmissions(s => s.filter(sub => sub.id !== id));
    setStats(st => st ? {
      ...st,
      pending: st.pending - 1,
      [status]: (st[status] || 0) + 1
    } : st);

    const venueName = sub?.venue_name || '';
    if (status === 'approved' && result?.price_applied === false) {
      // Approved, but the submission's serving size wasn't a recognised one,
      // so the public price was deliberately left untouched — say so, rather
      // than leaving the admin to assume it changed.
      showToast('warning', t('admin.toast.priceNotApplied'));
    } else if (status === 'approved') {
      if (sub?.report_type === 'closed') {
        showToast('warning', t('admin.toast.markedClosed', { venue: venueName }));
      } else if (sub?.report_type === 'other_info' || sub?.report_type === 'suggest_description') {
        showToast('success', t('admin.toast.approvedGeneric'));
      } else {
        showToast('success', t('admin.toast.approved', { venue: venueName }));
      }
    } else if (status === 'rejected') {
      showToast('warning', t('admin.toast.rejected'));
    }
  };

  const handleReject = (id) => {
    const reason = window.prompt(t('admin.rejectReasonPrompt'));
    if (reason === null) return; // cancelled
    handleAction(id, 'rejected', reason || null);
  };

  if (!token) {
    return (
      <div className="admin-login-page">
        <button className="back-btn" onClick={onBack}>{t('admin.back')}</button>
        <div className="login-card">
          <div className="login-logo">🍺</div>
          <h2>{t('admin.login')}</h2>
          <div className="login-field">
            <label>{t('admin.username')}</label>
            <input type="text" value={creds.username} onChange={e => setCreds(c => ({ ...c, username: e.target.value }))} />
          </div>
          <div className="login-field">
            <label>{t('admin.password')}</label>
            <input type="password" value={creds.password} onChange={e => setCreds(c => ({ ...c, password: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          {loginError && <div className="login-error">{loginError}</div>}
          <button className="login-btn" onClick={handleLogin}>{t('admin.signin')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <button className="back-btn" onClick={onBack}>{t('admin.back')}</button>
        <h2>🍺 {t('admin.dashboard')}</h2>
        <button className="logout-btn" onClick={handleLogout}>{t('admin.logout')}</button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="admin-stats">
          <div className="stat-card"><div className="stat-num">{stats.total_venues}</div><div className="stat-label">{t('admin.totalVenues')}</div></div>
          <div className="stat-card highlight"><div className="stat-num">{stats.pending}</div><div className="stat-label">{t('admin.pending')}</div></div>
          <div className="stat-card"><div className="stat-num">{stats.approved}</div><div className="stat-label">{t('admin.approved')}</div></div>
          <div className="stat-card"><div className="stat-num">{stats.outliers}</div><div className="stat-label">{t('admin.outliers')}</div></div>
        </div>
      )}

      {/* Section switcher */}
      <div className="admin-section-tabs">
        <button className={`admin-section-tab ${section === 'submissions' ? 'active' : ''}`} onClick={() => setSection('submissions')}>
          📋 {t('admin.submissions')}
        </button>
        <button className={`admin-section-tab ${section === 'venues' ? 'active' : ''}`} onClick={() => setSection('venues')}>
          🍺 {t('admin.venues.tab')}
        </button>
        <button className={`admin-section-tab ${section === 'quality' ? 'active' : ''}`} onClick={() => setSection('quality')}>
          🩺 {t('admin.quality.tab')}
        </button>
        <button className={`admin-section-tab ${section === 'cities' ? 'active' : ''}`} onClick={() => setSection('cities')}>
          🌍 {t('admin.cities.tab')}
        </button>
        <button className={`admin-section-tab ${section === 'logs' ? 'active' : ''}`} onClick={() => setSection('logs')}>
          📋 {t('admin.logs.tab')}
        </button>
      </div>

      {section === 'venues' ? (
        <VenueManager token={token} initialQuery={venuesQuery} initialEditVenueId={venuesEditId} />
      ) : section === 'quality' ? (
        <DataQualityPanel token={token} onEditVenue={(g) => openVenueInManager(g.name, g.venue_id)} />
      ) : section === 'cities' ? (
        <CityManager token={token} />
      ) : section === 'logs' ? (
        <ActivityLog token={token} onSelectVenue={openVenueInManager} />
      ) : (
        <>
          {/* Filter tabs */}
          <div className="admin-tabs">
            {['pending', 'approved', 'rejected'].map(s => (
              <button key={s} className={`admin-tab ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
                {t(`admin.${s}`)}
              </button>
            ))}
          </div>

          {/* Submissions list */}
          {loading ? (
            <div className="loading">{t('loading')}</div>
          ) : submissions.length === 0 ? (
            <div className="no-items">{t('admin.noSubmissions')}</div>
          ) : (
            <div className="submissions-list">
          {submissions.map(sub => {
            const meta = REPORT_TYPE_META[sub.report_type] || REPORT_TYPE_META.price_change;
            // price_change / new_beer get the full comparison (size, per-0.5 L
            // price, current price, difference, source); their outlier flag is
            // recomputed live against the CURRENT price by the server.
            const isPriceReport = sub.report_type === 'price_change' || sub.report_type === 'new_beer';
            const outlier = isPriceReport ? sub.outlier : sub.is_outlier;
            return (
            <div key={sub.id} className={`submission-card ${outlier ? 'outlier' : ''}`}>
              <div className="sub-top">
                <span className="report-type-badge">{meta.icon} {meta.label}</span>
                <strong>{sub.venue_name || t('admin.newVenueFallback')}</strong>
                {outlier && <span className="outlier-badge">{t('admin.outlierBadge')}</span>}
              </div>
              {isPriceReport ? (
                <>
                  <div className="sub-details">{sub.beer_brand && <span>🍻 {sub.beer_brand}</span>}</div>
                  <SubmissionPriceInfo sub={sub} pending={filter === 'pending'} />
                </>
              ) : (
              <div className="sub-details">
                {sub.beer_brand && <span>🍻 {sub.beer_brand}</span>}
                {sub.size && <span>📏 {servingLabel(servingSizeByWire(sub.size)?.ml, i18n.language) || sub.size}</span>}
                {sub.price != null && <span>💶 {formatEuro(sub.price, i18n.language)}</span>}
                {sub.report_type === 'new_venue' && sub.size_mass != null && <span>💶 {formatEuro(sub.size_mass, i18n.language)} ({servingSizeByWire('1L')[i18n.language === 'de' ? 'name_de' : 'name_en']})</span>}
                {sub.report_type === 'new_venue' && sub.address && <span>📍 {sub.address}</span>}
                {sub.visit_date && <span>📅 {sub.visit_date}</span>}
                <span>👤 {sub.submitter_name}</span>
              </div>
              )}
              {sub.note && <div className="sub-note">💬 {sub.note}</div>}
              {sub.report_type === 'new_venue' && sub.lat != null && sub.lng != null && (
                <MiniMapPreview lat={sub.lat} lng={sub.lng} className="sub-map-preview" />
              )}
              {sub.status === 'rejected' && sub.reject_reason && (
                <div className="sub-reject-reason">✕ {sub.reject_reason}</div>
              )}
              {filter === 'pending' && (
                <div className="sub-actions">
                  <button className="approve-btn" onClick={() => handleAction(sub.id, 'approved')}>
                    ✓ {t('admin.approve')}
                  </button>
                  <button className="reject-btn" onClick={() => handleReject(sub.id)}>
                    ✕ {t('admin.reject')}
                  </button>
                </div>
              )}
            </div>
            );
          })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
