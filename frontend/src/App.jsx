import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n/i18n.js';
import MunichMap from './components/MunichMap';
import VenuePanel from './components/VenuePanel';
import VenueDetail from './components/VenueDetail';
import SearchBar from './components/SearchBar';
import MissingBarModal from './components/MissingBarModal';
import AdminPage from './components/AdminPage';
import StatsBar from './components/StatsBar';
import PriceTrends from './components/PriceTrends';
import FreshnessLight from './components/FreshnessLight';
import { fetchNeighbourhoods, fetchVenues, fetchStats } from './hooks/useApi';

// Query params for GET /api/venues. Neighbourhood is deliberately NOT included —
// the focused-neighbourhood list is scoped client-side from the full venue set so
// the map, the sidebar and the stats bar can never drift out of sync.
function venueParams(filters, q) {
  const p = {};
  if (filters.type) p.type = filters.type;
  if (filters.brand) p.brand = filters.brand;
  if (filters.min_price) p.min_price = filters.min_price;
  if (filters.max_price) p.max_price = filters.max_price;
  if (q) p.q = q;
  return p;
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [neighbourhoods, setNeighbourhoods] = useState([]);
  const [allVenues, setAllVenues] = useState([]);       // every venue in the DB
  const [filteredVenues, setFilteredVenues] = useState([]); // type/brand/price/search applied
  const [stats, setStats] = useState(null);
  const [activeNeighbourhood, setActiveNeighbourhood] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [view, setView] = useState('map');
  const [showMissingBar, setShowMissingBar] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
  const [filters, setFilters] = useState({ type: '', brand: '', neighbourhood: '', min_price: '', max_price: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false); // mobile bottom-sheet expanded?

  // ─── Data loading ──────────────────────────────────────────────────────────
  // Snapshot = the things that mirror the whole database (used by the map + stats
  // bar + "all venues" list). Refetched on load and whenever the tab is refocused
  // so a re-seed on the backend shows up without a hard reload.
  const loadSnapshot = useCallback(() => {
    fetchNeighbourhoods().then(setNeighbourhoods).catch(() => {});
    fetchVenues().then(setAllVenues).catch(() => {});
    fetchStats().then(setStats).catch(() => {});
  }, []);

  const filtersRef = useRef(filters);
  const searchRef = useRef(searchQuery);
  useEffect(() => { filtersRef.current = filters; searchRef.current = searchQuery; });

  const loadFiltered = useCallback((f, q) => {
    return fetchVenues(venueParams(f, q)).then(setFilteredVenues).catch(() => {});
  }, []);

  // Initial load ( `loading` starts true )
  useEffect(() => {
    Promise.allSettled([
      fetchNeighbourhoods().then(setNeighbourhoods),
      fetchVenues().then(setAllVenues),
      fetchStats().then(setStats),
      loadFiltered(filtersRef.current, searchRef.current),
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run the filtered fetch whenever a non-neighbourhood filter or the search changes
  useEffect(() => {
    loadFiltered(filters, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, filters.brand, filters.min_price, filters.max_price, searchQuery, loadFiltered]);

  // Keep everything in step with the live DB when the tab regains focus
  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return;
      loadSnapshot();
      loadFiltered(filtersRef.current, searchRef.current);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadSnapshot, loadFiltered]);

  // ─── Neighbourhood selection (single source of truth) ──────────────────────
  // Every entry point — map click, stats-bar pill, filter dropdown — goes through
  // here. `filters.neighbourhood` is kept in sync only so the SearchBar UI reflects
  // the choice; it no longer drives the venue fetch.
  const selectNeighbourhood = useCallback((id) => {
    setActiveNeighbourhood(id || null);
    setFilters((f) => ({ ...f, neighbourhood: id || '' }));
    if (id) setSheetOpen(true);
    setView((v) => (v === 'venue' ? 'map' : v));
  }, []);

  // A global text search must always be reachable, even on mobile where the venue
  // list lives in a collapsible bottom sheet that otherwise only opens when a
  // neighbourhood polygon is tapped. Without this, typing a query with no
  // neighbourhood selected updated `filteredVenues` correctly but the results were
  // hidden behind the collapsed sheet — "search does nothing" from the user's POV.
  const handleSearch = useCallback((val) => {
    setSearchQuery(val);
    if (val.trim()) setSheetOpen(true);
  }, []);

  const handleVenueClick = (venue) => { setSelectedVenue(venue); setView('venue'); setSheetOpen(true); };
  const handleBack = () => { setView('map'); setSelectedVenue(null); };

  // Venues in the focused neighbourhood — always derived from the full DB set,
  // then narrowed by the active filters/search so the panel matches the map.
  const filteredIds = new Set(filteredVenues.map((v) => v.id));
  const anyFilterActive = !!(filters.type || filters.brand || filters.min_price || filters.max_price || searchQuery);
  const panelVenues = activeNeighbourhood
    ? allVenues
        .filter((v) => v.neighbourhood_id === activeNeighbourhood)
        .filter((v) => !anyFilterActive || filteredIds.has(v.id))
    : [];
  const activeNInfo = neighbourhoods.find((n) => n.id === activeNeighbourhood);

  if (view === 'admin') return <AdminPage onBack={() => setView('map')} />;

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand" onClick={() => { setView('map'); selectNeighbourhood(null); }}>
          <span className="nav-logo">🍺</span>
          <div>
            <div className="nav-title">{t('nav.title')}</div>
            <div className="nav-subtitle">{t('nav.subtitle')}</div>
          </div>
        </div>
        <div className="nav-actions">
          <button className="trends-link-btn" onClick={() => setShowTrends(true)}>
            📊 {t('trends.button')}
          </button>
          <button className="lang-btn" onClick={() => i18n.changeLanguage(i18n.language === 'de' ? 'en' : 'de')}>
            {t('nav.language')}
          </button>
          <button className="admin-link-btn" onClick={() => setView('admin')}>Admin</button>
        </div>
      </nav>

      <StatsBar
        stats={stats}
        neighbourhoods={neighbourhoods}
        activeNeighbourhood={activeNeighbourhood}
        onSelectNeighbourhood={selectNeighbourhood}
      />

      <div className="main-layout">
        <div className={`sidebar${sheetOpen ? ' sheet-open' : ''}`}>
          <button
            className="sheet-handle"
            onClick={() => setSheetOpen(o => !o)}
            aria-label={sheetOpen ? 'Collapse list' : 'Expand list'}
          >
            <span className="sheet-grip" />
            <span className="sheet-handle-text">
              {view === 'venue' && selectedVenue
                ? selectedVenue.name
                : activeNInfo
                  ? (i18n.language === 'de' ? activeNInfo.name_de : activeNInfo.name_en)
                  : (i18n.language === 'de' ? 'Lokale & Filter' : 'Venues & filters')}
            </span>
          </button>

          <SearchBar
            onSearch={handleSearch}
            onFocus={() => setSheetOpen(true)}
            onFilterChange={setFilters}
            filters={filters}
            onNeighbourhoodSelect={selectNeighbourhood}
          />

          {view === 'venue' && selectedVenue ? (
            <div className="sidebar-content scrollable">
              <VenueDetail venue={selectedVenue} onBack={handleBack} />
            </div>
          ) : activeNeighbourhood ? (
            <VenuePanel
              neighbourhood={activeNInfo}
              venues={panelVenues}
              onVenueClick={handleVenueClick}
              onClose={() => selectNeighbourhood(null)}
              onSubmitNew={() => setShowMissingBar(true)}
            />
          ) : (
            <div className="sidebar-hint">
              {loading ? (
                <div className="loading-state"><div className="loading-spinner">🍺</div><div>{t('loading')}</div></div>
              ) : (
                <div className="hint-content">
                  <div className="hint-icon">👆</div>
                  <div className="hint-text">
                    {i18n.language === 'de'
                      ? 'Klicke auf ein Viertel auf der Karte, um die Bierlokale zu sehen.'
                      : 'Click on a neighbourhood on the map to see its beer venues.'}
                  </div>
                  <div className="all-venues-section">
                    <div className="av-title">
                      {i18n.language === 'de' ? 'Alle Lokale' : 'All venues'}
                      {` (${filteredVenues.length})`}
                      {searchQuery && ` — "${searchQuery}"`}
                    </div>
                    <div className="av-list">
                      {[...filteredVenues]
                        .sort((a, b) => (a.beers[0]?.size_05 ?? 99) - (b.beers[0]?.size_05 ?? 99))
                        .map(v => (
                          <div key={v.id} className="av-item" onClick={() => handleVenueClick(v)}>
                            <span className="av-name">
                              {v.name}
                              {v.beers.length > 1 && (
                                <span className="av-brands-count"> · 🍺 {t('venue.brandsCount', { count: v.beers.length })}</span>
                              )}
                            </span>
                            <span className="av-right">
                              <FreshnessLight date={v.beers[0]?.updated} compact />
                              <span className="av-price">€{v.beers[0]?.size_05?.toFixed(2) ?? '—'}</span>
                            </span>
                          </div>
                        ))}
                      {filteredVenues.length === 0 && <div className="no-venues">{t('search.noResults')}</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="map-container">
          {!loading && (
            <MunichMap
              neighbourhoods={neighbourhoods}
              venues={filteredVenues}
              onNeighbourhoodClick={selectNeighbourhood}
              onVenueClick={handleVenueClick}
              activeId={activeNeighbourhood}
              highlight={searchQuery.trim().length > 0}
            />
          )}
          <button className="missing-bar-fab" onClick={() => setShowMissingBar(true)}>
            <span className="missing-bar-fab-icon">🍺</span>
            {t('missingBar.fab')}
          </button>
        </div>
      </div>

      {showMissingBar && (
        <MissingBarModal
          allVenues={allVenues}
          onClose={() => setShowMissingBar(false)}
          onCreated={loadSnapshot}
        />
      )}

      {showTrends && (
        <PriceTrends neighbourhoods={neighbourhoods} onClose={() => setShowTrends(false)} />
      )}
    </div>
  );
}
