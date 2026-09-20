import { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n/i18n.js';
import MunichMap from './components/MunichMap';
import VenuePanel from './components/VenuePanel';
import VenueDetail from './components/VenueDetail';
import SearchBar from './components/SearchBar';
import MissingBarModal from './components/MissingBarModal';
import AdminPage from './components/AdminPage';
import StatsBar from './components/StatsBar';
import CitySelector from './components/CitySelector';
import ToastContainer from './components/ToastContainer';
import { ToastProvider } from './hooks/ToastProvider';
// Lazy-loaded: PriceTrends pulls in recharts, a sizeable dependency only
// needed when a user actually opens the trends modal (brief Section 12).
const PriceTrends = lazy(() => import('./components/PriceTrends'));
import FreshnessLight from './components/FreshnessLight';
import PriceSecondary from './components/PriceSecondary';
import Footer from './components/Footer';
import Impressum from './pages/Impressum';
import Datenschutz from './pages/Datenschutz';
import { fetchNeighbourhoods, fetchVenues, fetchStats } from './hooks/useApi';
import { formatEuro } from './utils/price';
import { createSequencedLoader } from './utils/sequencedLoader';

// Query params for GET /api/venues. Neighbourhood is deliberately NOT included —
// the focused-neighbourhood list is scoped client-side from the full venue set so
// the map, the sidebar and the stats bar can never drift out of sync.
function venueParams(filters, q) {
  const p = {};
  if (filters.type) p.type = filters.type;
  if (filters.brand) p.brand = filters.brand;
  if (filters.serve_type) p.serve_type = filters.serve_type;
  if (filters.min_price) p.min_price = filters.min_price;
  if (filters.max_price) p.max_price = filters.max_price;
  if (q) p.q = q;
  return p;
}

// Deliberately not a routing library — just two static legal pages need real
// URLs (/impressum, /datenschutz), so a minimal history-API router avoids
// pulling in react-router for two routes. Production's static-file server
// already falls back to index.html for any non-/api GET (so a hard refresh
// on /impressum works); Vite's dev server does the same SPA fallback by default.
function useRoute() {
  const [route, setRoute] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Pass the click event through so a modified click (cmd/ctrl/shift-click,
  // middle-click) still opens a new tab like a real link instead of being
  // hijacked into a same-tab client-side navigation.
  const navigate = (e, path) => {
    if (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
    }
    window.history.pushState({}, '', path);
    setRoute(path);
  };

  return [route, navigate];
}

export default function App() {
  const [route, navigate] = useRoute();

  let page;
  if (route === '/impressum') page = <Impressum onBack={(e) => navigate(e, '/')} navigate={navigate} />;
  else if (route === '/datenschutz') page = <Datenschutz onBack={(e) => navigate(e, '/')} navigate={navigate} />;
  else page = <AppContent navigate={navigate} />;

  return (
    <ToastProvider>
      {page}
      <ToastContainer />
    </ToastProvider>
  );
}

// The actual app — split out so ToastProvider wraps both the admin dashboard
// and the main map view (App used to `return <AdminPage/>` early, which would
// otherwise have skipped the provider entirely for that branch).
function AppContent({ navigate }) {
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
  const [filters, setFilters] = useState({ type: '', brand: '', serve_type: '', neighbourhood: '', min_price: '', max_price: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  // Mobile bottom sheet has 3 stops: 'collapsed' (~15%, just the handle),
  // 'half' (~60%, venue list), 'full' (~90%). No effect on desktop.
  const [sheetLevel, setSheetLevel] = useState('collapsed');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // ☰ dropdown (mobile navbar)
  const touchStartY = useRef(null);

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

  // Root cause of the "type/max-price filter ignored" reports: this effect
  // re-fires a fetch on every keystroke/dropdown change with no debounce and
  // no request sequencing, so a user changing a filter quickly (e.g. typing
  // a 2-digit price, or clicking through venue types) fires several
  // concurrent requests — and on real-world network latency (unlike an
  // instant localhost), an EARLIER, now-stale request can resolve AFTER a
  // later one and silently overwrite the correct result with wrong data.
  // Reproduced directly: delaying the intermediate "max_price=5" response
  // behind the final "max_price=5.20" one made the UI show the stale
  // (wrong) count even though the input/chip already read "5.20". Fixed with
  // createSequencedLoader (see its own tests) — only the response for the
  // MOST RECENTLY ISSUED request is ever applied to state.
  const sequencedFetchVenues = useMemo(() => createSequencedLoader(fetchVenues), []);
  const loadFiltered = useCallback((f, q) => {
    return sequencedFetchVenues(venueParams(f, q))
      .then((data) => { if (data !== undefined) setFilteredVenues(data); })
      .catch(() => {});
  }, [sequencedFetchVenues]);

  // Initial load ( `loading` starts true ). `loadAttempt` exists purely to
  // give the retry button something to change — bumping it re-runs this
  // effect. Previously every one of these four requests silently swallowed
  // its own error (`.catch(() => {})` inside loadFiltered; the other three
  // had none at all), so a failed/offline initial load just left the app on
  // "Loading…" forever with no feedback and no way to recover without a hard
  // refresh — exactly the "indefinite spinner" the brief calls out.
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState(false);
  // Clears any prior error synchronously (in the click handler, not the
  // effect) before bumping loadAttempt to re-trigger the fetch below.
  const retryInitialLoad = useCallback(() => {
    setLoadError(false);
    setLoadAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    Promise.allSettled([
      fetchNeighbourhoods().then(setNeighbourhoods),
      fetchVenues().then(setAllVenues),
      fetchStats().then(setStats),
      loadFiltered(filtersRef.current, searchRef.current),
    ]).then((results) => {
      // Any settled-but-undefined result (loadFiltered's own catch) or an
      // outright rejection both count as "this request failed".
      if (results.some((r) => r.status === 'rejected')) setLoadError(true);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAttempt]);

  // Re-run the filtered fetch whenever a non-neighbourhood filter or the search
  // changes — debounced (300ms) so typing a search query or a price value
  // doesn't fire a request per keystroke. This is on top of, not instead of,
  // the request-sequencing above: the debounce cuts down how OFTEN stale
  // requests can even happen; the sequencing guarantees correctness even
  // when they still do (e.g. two dropdown changes in quick succession).
  // Skipped on the very first render — the initial-load effect above already
  // issues that exact same (empty filters/search) request immediately;
  // without this guard every page load would fire it a redundant second time.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    const timer = setTimeout(() => {
      loadFiltered(filters, searchQuery);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, filters.brand, filters.serve_type, filters.min_price, filters.max_price, searchQuery, loadFiltered]);

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
    if (id) setSheetLevel('half'); // tapping a neighbourhood slides the sheet up to 60%
    setView((v) => (v === 'venue' ? 'map' : v));
  }, []);

  // A global text search must always be reachable, even on mobile where the venue
  // list lives in a collapsible bottom sheet that otherwise only opens when a
  // neighbourhood polygon is tapped. Without this, typing a query with no
  // neighbourhood selected updated `filteredVenues` correctly but the results were
  // hidden behind the collapsed sheet — "search does nothing" from the user's POV.
  const handleSearch = useCallback((val) => {
    setSearchQuery(val);
    if (val.trim()) setSheetLevel('half');
  }, []);

  // Enter still works as an immediate, undebounced trigger — search updates
  // live as you type either way, this just lets an impatient/keyboard user
  // skip the 300ms wait. Reads refs (not closed-over state) so it always
  // fires with whatever's actually in the fields right now.
  const handleSearchNow = useCallback(() => {
    loadFiltered(filtersRef.current, searchRef.current);
  }, [loadFiltered]);

  // The zero-results empty state's "Clear filters" action — deliberately
  // leaves the search query alone (SearchBar owns that as local, uncontrolled
  // state, so clearing it from outside the component isn't safe without a
  // bigger controlled-input refactor); loosening filters while keeping the
  // search term is usually what someone actually wants first anyway.
  const clearFiltersOnly = useCallback(() => {
    setFilters((f) => ({ ...f, type: '', brand: '', serve_type: '', min_price: '', max_price: '' }));
    selectNeighbourhood(null);
  }, [selectNeighbourhood]);

  const handleVenueClick = (venue) => { setSelectedVenue(venue); setView('venue'); setSheetLevel('full'); };
  const handleBack = () => { setView('map'); setSelectedVenue(null); };

  // Stats-bar cheapest/priciest tiles only carry a venue id — resolve it against
  // the already-loaded full venue list and open it exactly like any other click.
  const handleSelectVenueById = useCallback((id) => {
    const venue = allVenues.find((v) => v.id === id);
    if (venue) handleVenueClick(venue);
  }, [allVenues]);

  // Bottom sheet: tap the handle to step collapsed<->half; swipe up/down to move
  // one stop at a time (collapsed -> half -> full and back).
  const SHEET_STEPS = ['collapsed', 'half', 'full'];
  const stepSheet = (delta) => {
    setSheetLevel((level) => {
      const i = SHEET_STEPS.indexOf(level);
      const next = Math.min(SHEET_STEPS.length - 1, Math.max(0, i + delta));
      return SHEET_STEPS[next];
    });
  };
  const handleSheetTap = () => setSheetLevel((level) => (level === 'collapsed' ? 'half' : 'collapsed'));
  const handleSheetTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const handleSheetTouchEnd = (e) => {
    if (touchStartY.current == null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (deltaY < -40) stepSheet(1);       // swipe up -> expand one stop
    else if (deltaY > 40) stepSheet(-1);  // swipe down -> collapse one stop
    else handleSheetTap();                // small movement = a tap
  };

  // Venues in the focused neighbourhood — always derived from the full DB set,
  // then narrowed by the active filters/search so the panel matches the map.
  const filteredIds = new Set(filteredVenues.map((v) => v.id));
  const anyFilterActive = !!(filters.type || filters.brand || filters.serve_type || filters.min_price || filters.max_price || searchQuery);
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
        <div className="nav-left">
          <div className="nav-brand" onClick={() => { setView('map'); selectNeighbourhood(null); setMobileMenuOpen(false); }}>
            <span className="nav-logo">🍺</span>
            <div>
              {/* Site-wide H1 (brief Section 14) — the app is a single page with
                  no per-route document, so the brand name is the one page-level
                  heading; VenueDetail's own heading is an h2 under it. */}
              <h1 className="nav-title">{t('nav.title')}</h1>
              <div className="nav-subtitle">{t('nav.subtitle')}</div>
            </div>
          </div>
          <CitySelector />
        </div>

        {/* Desktop actions — hidden on mobile in favour of the ☰ menu below */}
        <div className="nav-actions">
          <button className="lang-btn" onClick={() => i18n.changeLanguage(i18n.language === 'de' ? 'en' : 'de')}>
            {t('nav.language')}
          </button>
          <button className="admin-link-btn" onClick={() => setView('admin')}>Admin</button>
        </div>

        {/* Mobile hamburger — hidden on desktop */}
        <div className="nav-mobile-menu">
          <button
            className="hamburger-btn"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            ☰
          </button>
          {mobileMenuOpen && (
            <>
              <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} />
              <div className="mobile-menu-dropdown">
                <button onClick={() => { setView('admin'); setMobileMenuOpen(false); }}>
                  🔐 Admin
                </button>
                <button onClick={() => { i18n.changeLanguage(i18n.language === 'de' ? 'en' : 'de'); setMobileMenuOpen(false); }}>
                  🌐 {i18n.language === 'de' ? 'DE / EN' : 'EN / DE'}
                </button>
              </div>
            </>
          )}
        </div>
      </nav>

      <StatsBar
        stats={stats}
        neighbourhoods={neighbourhoods}
        activeNeighbourhood={activeNeighbourhood}
        onSelectNeighbourhood={selectNeighbourhood}
        onSelectVenue={handleSelectVenueById}
        onShowTrends={() => setShowTrends(true)}
      />

      <div className="main-layout">
        <div className={`sidebar sheet-${sheetLevel}`}>
          <button
            className="sheet-handle"
            onClick={handleSheetTap}
            onTouchStart={handleSheetTouchStart}
            onTouchEnd={handleSheetTouchEnd}
            aria-label={sheetLevel === 'collapsed' ? 'Expand list' : 'Collapse list'}
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
            onSearchNow={handleSearchNow}
            onFocus={() => setSheetLevel('half')}
            onFilterChange={setFilters}
            filters={filters}
            onNeighbourhoodSelect={selectNeighbourhood}
            resultCount={filteredVenues.length}
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
              {loadError ? (
                <div className="load-error-state">
                  <div className="load-error-icon">⚠️</div>
                  <div className="load-error-text">{t('loadError')}</div>
                  <button className="load-error-retry" onClick={retryInitialLoad}>{t('retry')}</button>
                </div>
              ) : loading ? (
                <div className="loading-state">
                  <div className="loading-spinner">🍺</div>
                  <div>{t('loadingVenues')}</div>
                  <div className="venue-skeleton-list" aria-hidden="true">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="venue-skeleton-item">
                        <div className="skeleton-line skeleton-line-name" />
                        <div className="skeleton-line skeleton-line-price" />
                      </div>
                    ))}
                  </div>
                </div>
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
                        // cheapest per 0.5 L first; a price with no known serving size can't be compared, so it goes last
                        .sort((a, b) => (a.beers[0]?.normalized_500ml_price ?? Infinity) - (b.beers[0]?.normalized_500ml_price ?? Infinity))
                        .map(v => (
                          <div key={v.id} className="av-item" onClick={() => handleVenueClick(v)}>
                            <span className="av-name">
                              {v.name}
                              {v.beers.length > 1 && (
                                <span className="av-brands-count"> · 🍺 {t('venue.brandsCount', { count: v.beers.length })}</span>
                              )}
                            </span>
                            <span className="av-right">
                              <FreshnessLight beer={v.beers[0]} compact />
                              <span className="av-price-wrap">
                                <span className="av-price">{formatEuro(v.beers[0]?.size_05, i18n.language)}</span>
                                <PriceSecondary beer={v.beers[0]} />
                              </span>
                            </span>
                          </div>
                        ))}
                      {filteredVenues.length === 0 && (
                        <div className="no-venues-block">
                          <div className="no-venues">{t('search.noResults')}</div>
                          {(filters.type || filters.brand || filters.serve_type || filters.neighbourhood || filters.min_price || filters.max_price) && (
                            <button className="no-venues-clear-btn" onClick={clearFiltersOnly}>
                              {t('search.clear')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="map-container">
          {/* Mounts as soon as neighbourhood polygons exist — decoupled from
              the full `loading` flag (which also waits on venues + stats)
              so the map, the single most prominent element on the page,
              shows up as early as possible instead of behind a blank box
              for the duration of the slowest of four parallel requests.
              Venue pins simply pop in once filteredVenues arrives — MunichMap
              already reacts to that prop changing after mount. */}
          {neighbourhoods.length > 0 && (
            <MunichMap
              neighbourhoods={neighbourhoods}
              venues={filteredVenues}
              onNeighbourhoodClick={selectNeighbourhood}
              onVenueClick={handleVenueClick}
              activeId={activeNeighbourhood}
              selectedVenueId={view === 'venue' ? selectedVenue?.id : null}
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
        <Suspense fallback={null}>
          <PriceTrends neighbourhoods={neighbourhoods} onClose={() => setShowTrends(false)} />
        </Suspense>
      )}

      <Footer navigate={navigate} />
    </div>
  );
}
