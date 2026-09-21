import { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n/i18n.js';
import MunichMap from './components/MunichMap';
import VenuePanel from './components/VenuePanel';
import VenueDetail from './components/VenueDetail';
import SearchInput from './components/SearchInput';
import FilterChips from './components/FilterChips';
import FilterPanel from './components/FilterPanel';
import NearbyCta from './components/NearbyCta';
import BottomNav from './components/BottomNav';
import VenueList, { VenueListSkeleton } from './components/VenueList';
import EmptyState from './components/EmptyState';
import StatsBar from './components/StatsBar';
import CitySelector from './components/CitySelector';
import ToastContainer from './components/ToastContainer';
import { ToastProvider } from './hooks/ToastProvider';
// Lazy-loaded: none of these is needed to show the map. PriceTrends pulls in recharts
// (brief Section 12); the admin dashboard and the report modal are only ever opened
// on demand, so a first-time visitor never downloads them.
const PriceTrends = lazy(() => import('./components/PriceTrends'));
const AdminPage = lazy(() => import('./components/AdminPage'));
const MissingBarModal = lazy(() => import('./components/MissingBarModal'));
import Footer from './components/Footer';
import Impressum from './pages/Impressum';
import Datenschutz from './pages/Datenschutz';
import { fetchNeighbourhoods, fetchVenues, fetchStats } from './hooks/useApi';
import { useNearby } from './hooks/useNearby';
import { useToast } from './hooks/useToast';
import { useIsMobileLayout } from './hooks/useMediaQuery';
import { useSheetDrag } from './hooks/useSheetDrag';
import { createSequencedLoader } from './utils/sequencedLoader';
import { emptyFilters, countActiveFilters } from './utils/quickFilters';
import { nearbyVenues, comparablePrice, NEARBY_RADIUS_M } from './utils/geo';
import { formatPrice } from './utils/priceUtils';

const MUNICH_VIEW = { lat: 48.145, lng: 11.578, zoom: 13 };
const NEARBY_ZOOM = 15; // ~1 km around the user fits a phone-width map

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
  const showToast = useToast();
  const isMobile = useIsMobileLayout();
  const [neighbourhoods, setNeighbourhoods] = useState([]);
  const [allVenues, setAllVenues] = useState([]);       // every venue in the DB
  const [filteredVenues, setFilteredVenues] = useState([]); // type/brand/price/search applied
  const [stats, setStats] = useState(null);
  const [activeNeighbourhood, setActiveNeighbourhood] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [view, setView] = useState('map');
  const [showMissingBar, setShowMissingBar] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
  const [filters, setFilters] = useState(emptyFilters());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  // Mobile/tablet: the two views of ONE dataset. 'map' (default) or 'list'.
  const [mobileTab, setMobileTab] = useState('map');
  const [showFilters, setShowFilters] = useState(false); // "Mehr ↓": the full filter panel
  // The bottom sheet now only carries a venue's details or a neighbourhood's venues
  // (the plain list has its own tab). 3 stops: 'collapsed' (handle only), 'half', 'full'.
  const [sheetLevel, setSheetLevel] = useState('half');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // ☰ dropdown (mobile header)
  const [highlightId, setHighlightId] = useState(null);       // venue emphasised on the map <-> list
  const [viewCommand, setViewCommand] = useState(null);       // one-off "fly the map here"
  const nearby = useNearby();
  const { request: requestNearby, clear: clearNearby } = nearby;

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
  // here. `filters.neighbourhood` is kept in sync only so the filter UI reflects
  // the choice; it no longer drives the venue fetch.
  const selectNeighbourhood = useCallback((id) => {
    setActiveNeighbourhood(id || null);
    setFilters((f) => ({ ...f, neighbourhood: id || '' }));
    if (id) setSheetLevel('half'); // a neighbourhood's venues open in the sheet at 60%
    setView((v) => (v === 'venue' ? 'map' : v));
  }, []);

  // Typing filters the map and list live (debounced upstream); nothing else to do.
  const handleSearch = useCallback((val) => { setSearchQuery(val); }, []);

  // Enter is an immediate, undebounced trigger. Reads refs (not closed-over state) so
  // it always fires with whatever is in the field right now.
  const handleSearchNow = useCallback(() => {
    loadFiltered(filtersRef.current, searchRef.current);
  }, [loadFiltered]);

  // "Reset": every filter AND the search text (the search field is controlled now, so
  // it can be cleared from here), plus the focused neighbourhood.
  const clearAll = useCallback(() => {
    setFilters(emptyFilters());
    setSearchQuery('');
    selectNeighbourhood(null);
  }, [selectNeighbourhood]);

  const handleVenueClick = useCallback((venue) => {
    setSelectedVenue(venue); setView('venue'); setSheetLevel('half'); setHighlightId(venue.id);
  }, []);
  const handleBack = () => { setView('map'); setSelectedVenue(null); };

  // Stats-bar cheapest/priciest tiles only carry a venue id — resolve it against
  // the already-loaded full venue list and open it exactly like any other click.
  const handleSelectVenueById = useCallback((id) => {
    const venue = allVenues.find((v) => v.id === id);
    if (venue) handleVenueClick(venue);
  }, [allVenues, handleVenueClick]);

  // ─── "Günstiges Bier in der Nähe" ──────────────────────────────────────────
  // Asks for the position; on success the venue set becomes "within 1 km of me,
  // cheapest first" for BOTH the map and the list, and the map flies there. Nothing
  // is faked: a refusal or failure leaves everything as it was and offers a retry.
  const handleNearby = useCallback(async () => {
    const coords = await requestNearby();
    if (!coords) return;
    setViewCommand({ id: Date.now(), lat: coords.lat, lng: coords.lng, zoom: NEARBY_ZOOM });
    setSelectedVenue(null); setView('map'); selectNeighbourhood(null);
    setMobileTab('list'); // the sorted results; "Karte" shows the same venues as pills
  }, [requestNearby, selectNeighbourhood]);

  const handleShowMunich = useCallback(() => {
    clearNearby();
    setViewCommand({ id: Date.now(), ...MUNICH_VIEW });
    setMobileTab('map');
  }, [clearNearby]);

  // ─── What both views show ──────────────────────────────────────────────────
  // ONE dataset for map and list: the filtered/searched venues — or, after "nearby",
  // only those within 1 km, each with its distance. Cheapest per 0.5 L first; a venue
  // whose serving size is unknown can't be compared, so it goes last.
  const displayVenues = useMemo(() => {
    if (nearby.status === 'ok') return nearbyVenues(filteredVenues, nearby.coords);
    return [...filteredVenues].sort((a, b) => comparablePrice(a) - comparablePrice(b));
  }, [filteredVenues, nearby.status, nearby.coords]);
  const nearbyActive = nearby.status === 'ok';
  const radiusLabel = `${NEARBY_RADIUS_M / 1000} km`;

  // Venues in the focused neighbourhood — always derived from the full DB set,
  // then narrowed by the active filters/search so the panel matches the map.
  const filteredIds = new Set(filteredVenues.map((v) => v.id));
  const anyFilterActive = !!(countActiveFilters(filters) || searchQuery);
  const panelVenues = activeNeighbourhood
    ? allVenues
        .filter((v) => v.neighbourhood_id === activeNeighbourhood)
        .filter((v) => !anyFilterActive || filteredIds.has(v.id))
    : [];
  const activeNInfo = neighbourhoods.find((n) => n.id === activeNeighbourhood);

  // What the panel shows: a venue's details, a neighbourhood's venues, or the list.
  const panelMode = view === 'venue' && selectedVenue ? 'detail' : activeNeighbourhood ? 'hood' : 'list';

  const handleVenueFocus = useCallback((v) => setHighlightId(v.id), []);
  // Leaving the sheet: a venue closes back to the map, a neighbourhood deselects.
  const dismissSheet = useCallback(() => {
    if (panelMode === 'detail') { setView('map'); setSelectedVenue(null); }
    else selectNeighbourhood(null);
  }, [panelMode, selectNeighbourhood]);
  const { sheetRef, handleProps } = useSheetDrag({ level: sheetLevel, onLevel: setSheetLevel, onDismiss: dismissSheet });

  // Escape closes the sheet / detail (mobile and desktop).
  useEffect(() => {
    if (panelMode === 'list') return undefined;
    const onKey = (e) => { if (e.key === 'Escape') dismissSheet(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelMode, dismissSheet]);

  const openReport = useCallback(() => setShowMissingBar(true), []);
  const showListFromSearch = useCallback(() => setMobileTab('list'), []);
  const closeFilters = useCallback(() => setShowFilters(false), []);

  if (view === 'admin') {
    return (
      <Suspense fallback={<div className="loading" role="status">{t('loading')}</div>}>
        <AdminPage onBack={() => setView('map')} />
      </Suspense>
    );
  }

  const noVenues = !loading && !loadError && displayVenues.length === 0;
  const emptyVariant = nearbyActive ? 'nearby' : 'filters';
  const emptyState = (
    <EmptyState
      variant={emptyVariant} radiusLabel={radiusLabel}
      onReport={openReport} onShowMunich={handleShowMunich}
      onReset={anyFilterActive ? clearAll : undefined}
    />
  );

  return (
    <div className="app" data-mtab={mobileTab} data-sheet={panelMode === 'list' ? 'closed' : 'open'} data-nearby={nearbyActive ? 'on' : 'off'}>
      <nav className="navbar">
        <div className="nav-left">
          <a
            className="nav-brand" href="/"
            onClick={(e) => { e.preventDefault(); setView('map'); selectNeighbourhood(null); setMobileMenuOpen(false); }}
          >
            {/* The existing Bierpreis mark, kept as is (not swapped for a generic icon). */}
            <span className="nav-logo" aria-hidden="true">🍺</span>
            <div className="nav-brand-text">
              {/* Site-wide H1 (brief Section 14) — the app is a single page with no
                  per-route document, so the brand name is the one page-level heading. */}
              <h1 className="nav-title">{t('nav.title')}</h1>
              <div className="nav-subtitle">{t('nav.subtitle')}</div>
            </div>
          </a>
          <CitySelector />
        </div>

        {/* Language toggle stays visible (small) on every size; Admin sits in ☰ on mobile */}
        <div className="nav-actions">
          <button className="lang-btn" onClick={() => i18n.changeLanguage(i18n.language === 'de' ? 'en' : 'de')}>
            {t('nav.language')}
          </button>
          <button className="admin-link-btn" onClick={() => setView('admin')}>Admin</button>
        </div>

        {/* Mobile/tablet menu — hidden on desktop */}
        <div className="nav-mobile-menu">
          <button
            className="hamburger-btn"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label={mobileMenuOpen ? t('app.closeMenu') : t('app.openMenu')}
            aria-expanded={mobileMenuOpen}
          >
            ☰
          </button>
          {mobileMenuOpen && (
            <>
              <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} />
              <div className="mobile-menu-dropdown">
                <button onClick={() => { setView('admin'); setMobileMenuOpen(false); }}>🔐 Admin</button>
                <a href="/impressum" onClick={(e) => { navigate(e, '/impressum'); setMobileMenuOpen(false); }}>{t('footer.impressum')}</a>
                <a href="/datenschutz" onClick={(e) => { navigate(e, '/datenschutz'); setMobileMenuOpen(false); }}>{t('footer.datenschutz')}</a>
                <a href="mailto:charoensuwan.s@gmail.com">{t('footer.kontakt')}</a>
              </div>
            </>
          )}
        </div>
      </nav>

      {/* Desktop: full-width stats row under the header (unchanged). */}
      <div className="stats-slot stats-slot--desktop">
        <StatsBar
          stats={stats} neighbourhoods={neighbourhoods} activeNeighbourhood={activeNeighbourhood}
          onSelectNeighbourhood={selectNeighbourhood} onSelectVenue={handleSelectVenueById}
          onShowTrends={() => setShowTrends(true)}
        />
      </div>

      {/* Mobile: [intro] [search] [CTA] [map] [chips] — desktop re-arranges the SAME
          elements into a left panel + map (CSS grid), so state exists exactly once. */}
      <main className="pub">
        <section className="pub-intro">
          <h2 className="pub-intro-title">{t('home.introLine1')}<br />{t('home.introLine2')}</h2>
        </section>

        <div className="pub-search">
          <SearchInput
            value={searchQuery} onChange={handleSearch} onSearchNow={handleSearchNow}
            resultCount={filteredVenues.length}
            onShowList={isMobile && mobileTab === 'map' ? showListFromSearch : undefined}
          />
        </div>

        <div className="pub-cta">
          <NearbyCta status={nearby.status} onRequest={handleNearby} onShowMunich={handleShowMunich} />
        </div>

        <div className="map-container">
          {/* Mounts as soon as neighbourhood polygons exist — decoupled from the full
              `loading` flag so the map, the most prominent element, shows up as early
              as possible; until then a skeleton holds its place (no spinner). */}
          {neighbourhoods.length > 0 ? (
            <MunichMap
              neighbourhoods={neighbourhoods}
              venues={displayVenues}
              onNeighbourhoodClick={selectNeighbourhood}
              onVenueClick={handleVenueClick}
              onVenueFocus={handleVenueFocus}
              activeId={activeNeighbourhood}
              selectedVenueId={view === 'venue' ? selectedVenue?.id : null}
              highlightId={highlightId}
              highlight={searchQuery.trim().length > 0}
              userLocation={nearbyActive ? nearby.coords : null}
              viewCommand={viewCommand}
            />
          ) : (
            <div className="map-skeleton" role="status">
              <span className="sr-only">{t('loadingVenues')}</span>
            </div>
          )}
          {noVenues && <div className="map-empty">{emptyState}</div>}
          <button className="missing-bar-fab" onClick={openReport}>
            <span className="missing-bar-fab-icon">🍺</span>
            {t('missingBar.fab')}
          </button>
        </div>

        <div className="pub-filters">
          {nearbyActive && (
            <div className="nearby-banner" role="status">
              <span>{t('nearby.banner', { count: displayVenues.length, radius: radiusLabel })}</span>
              <button type="button" className="nearby-banner-btn" onClick={handleShowMunich}>{t('nearby.showMunich')}</button>
            </div>
          )}
          <FilterChips
            filters={filters} onFilterChange={setFilters} neighbourhoods={neighbourhoods}
            moreOpen={showFilters} onToggleMore={() => setShowFilters((o) => !o)}
            onSoon={() => showToast('warning', `${t('chips.open')} — ${t('chips.soon')}`)}
            onClearAll={clearAll}
          />
          {showFilters && (
            <>
              <div className="filter-backdrop" onClick={closeFilters} />
              <div
                id="filter-sheet" className="filter-sheet" role={isMobile ? 'dialog' : 'region'} aria-modal={isMobile || undefined}
                aria-label={t('filterSheet.title')}
                onKeyDown={(e) => { if (e.key === 'Escape') closeFilters(); }}
              >
                <div className="filter-sheet-head">
                  <h3 className="filter-sheet-title">{t('filterSheet.title')}</h3>
                  <button type="button" className="filter-sheet-close" onClick={closeFilters} autoFocus={isMobile}>{t('filterSheet.done')}</button>
                </div>
                <FilterPanel
                  filters={filters} onFilterChange={setFilters} neighbourhoods={neighbourhoods}
                  onNeighbourhoodSelect={selectNeighbourhood}
                />
                <button type="button" className="btn-amber filter-sheet-show" onClick={closeFilters}>
                  {t('filterSheet.show', { count: displayVenues.length })}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Mobile list tab: the same stats/area pills, above the list (desktop has them
            in the full-width row under the header). */}
        <div className="stats-slot stats-slot--mobile">
          <StatsBar
            stats={stats} neighbourhoods={neighbourhoods} activeNeighbourhood={activeNeighbourhood}
            onSelectNeighbourhood={selectNeighbourhood} onSelectVenue={handleSelectVenueById}
            onShowTrends={() => setShowTrends(true)}
          />
        </div>

        {/* Tap outside the sheet (on the map above it) to dismiss — only while it is up
            at half/full height; the collapsed peek leaves the map fully usable. */}
        {isMobile && panelMode !== 'list' && sheetLevel !== 'collapsed' && (
          <div className="sheet-backdrop" onClick={dismissSheet} aria-hidden="true" />
        )}

        <section
          ref={sheetRef}
          className={`pub-panel pub-panel--${panelMode} sheet-${sheetLevel}`}
          aria-label={panelMode === 'detail' ? selectedVenue.name : undefined}
        >
          {panelMode !== 'list' && (
            <button
              className="sheet-handle" {...handleProps}
              aria-label={sheetLevel === 'collapsed' ? t('app.expandList') : t('app.collapseList')}
            >
              <span className="sheet-grip" />
              {/* The collapsed peek (~120px): just the name and the price. */}
              <span className="sheet-peek">
                {panelMode === 'detail' ? (
                  <>
                    <span className="sheet-peek-name">{selectedVenue.name}</span>
                    <span className="sheet-peek-price">
                      {selectedVenue.beers?.[0]?.size_05 > 0 ? formatPrice(selectedVenue.beers[0].size_05, i18n.language) : '—'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="sheet-peek-name">{i18n.language === 'de' ? activeNInfo?.name_de : activeNInfo?.name_en}</span>
                    <span className="sheet-peek-price sheet-peek-count">{panelVenues.length}</span>
                  </>
                )}
              </span>
            </button>
          )}

          {panelMode === 'detail' ? (
            <div className="sidebar-content scrollable">
              <VenueDetail venue={selectedVenue} onBack={handleBack} userLocation={nearbyActive ? nearby.coords : null} />
            </div>
          ) : panelMode === 'hood' ? (
            <VenuePanel
              neighbourhood={activeNInfo}
              venues={panelVenues}
              onVenueClick={handleVenueClick}
              onClose={() => selectNeighbourhood(null)}
              onSubmitNew={openReport}
            />
          ) : (
            <div className="pub-list">
              <p className="pub-hint">{t('app.mapHint')}</p>
              <div className="av-title">
                {t('app.allVenues')}{` (${displayVenues.length})`}{searchQuery && ` — "${searchQuery}"`}
              </div>
              {loadError ? (
                <div className="load-error-state">
                  <div className="load-error-icon">⚠️</div>
                  <div className="load-error-text">{t('loadError')}</div>
                  <button className="load-error-retry" onClick={retryInitialLoad}>{t('retry')}</button>
                </div>
              ) : loading ? (
                <VenueListSkeleton />
              ) : noVenues ? (
                emptyState
              ) : (
                <VenueList venues={displayVenues} highlightId={highlightId} onVenueClick={handleVenueClick} onHover={setHighlightId} />
              )}
            </div>
          )}
        </section>
      </main>

      <BottomNav tab={mobileTab} onTab={setMobileTab} onReport={openReport} />
      <Footer navigate={navigate} />

      {showMissingBar && (
        <Suspense fallback={null}>
          <MissingBarModal
            allVenues={allVenues}
            neighbourhoods={neighbourhoods}
            onClose={() => setShowMissingBar(false)}
            onCreated={loadSnapshot}
          />
        </Suspense>
      )}

      {showTrends && (
        <Suspense fallback={null}>
          <PriceTrends neighbourhoods={neighbourhoods} onClose={() => setShowTrends(false)} />
        </Suspense>
      )}
    </div>
  );
}
