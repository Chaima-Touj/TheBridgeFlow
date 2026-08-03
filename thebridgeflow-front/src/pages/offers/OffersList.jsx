// src/pages/offers/OffersList.jsx
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiSearch, FiMapPin, FiClock, FiBookmark,
  FiChevronLeft, FiChevronRight, FiChevronDown,
  FiX, FiBriefcase, FiUsers, FiBell,
  FiCheck, FiStar, FiInbox, FiFilter,
} from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { useAuth }               from "../../context/AuthContext.jsx";
import { offersService }         from "../../services/offers.service.js";
import { favoritesService }      from "../../services/favorites.service.js";
import { applicationsService }   from "../../services/applications.service.js";
import "./Offers.css";

/* ── normalizer ──────────────────────────────────────────────────────────── */
const normalizeOffer = (o) => ({
  ...o,
  companyName: o.companyName || o.company || "Entreprise",
  description: o.description || o.desc || "",
  skills: Array.isArray(o.skills) && o.skills.length
    ? o.skills
    : Array.isArray(o.skillsRequired) && o.skillsRequired.length
      ? o.skillsRequired
      : Array.isArray(o.motsCles) ? o.motsCles : [],
  type:     o.type     || "stage",
  duration: o.duration || "",
  location: o.location || "",
  domain:   o.domain   || o.specialite || "",
});

const PAGE_SIZE = 6;

/* ── pagination ──────────────────────────────────────────────────────────── */
const getPaginationRange = (currentPage, totalPages) => {
  const delta = 1;
  const range = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta))
      range.push(i);
  }
  const out = [];
  let prev;
  for (const i of range) {
    if (prev) {
      if (i - prev === 2) out.push(prev + 1);
      else if (i - prev > 2) out.push("...");
    }
    out.push(i);
    prev = i;
  }
  return out;
};

/* ── helpers ─────────────────────────────────────────────────────────────── */
const timeAgo = (dateStr, t) => {
  if (!dateStr) return "";
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return t("offers.today");
  if (days === 1) return t("offers.yesterday");
  return t("offers.daysAgo", { count: days });
};

const isRecentOffer = (dateStr) => {
  if (!dateStr) return false;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000) < 7;
};

const LOGO_PALETTES = [
  { bg: "#fef3c7", color: "#d97706" },
  { bg: "#dbeafe", color: "#2563eb" },
  { bg: "#f3e8ff", color: "#7c3aed" },
  { bg: "#dcfce7", color: "#16a34a" },
  { bg: "#ffe4e6", color: "#e11d48" },
  { bg: "#e0f2fe", color: "#0284c7" },
];

const getLogoStyle = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const { bg, color } = LOGO_PALETTES[Math.abs(h) % LOGO_PALETTES.length];
  return { background: bg, color };
};

const getMatchScore = (offerSkills = [], userSkillSet) => {
  if (!userSkillSet.size || !offerSkills.length) return 0;
  return offerSkills.filter((s) => userSkillSet.has(s.toLowerCase())).length;
};

/* ── CustomSelect ────────────────────────────────────────────────────────── */
function CustomSelect({ value, onChange, options, compact = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <div className={`cs-wrap ${compact ? "cs-wrap--compact" : ""}`} ref={ref}>
      <button
        type="button"
        className={`cs-trigger ${open ? "cs-trigger--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cs-label">{selected?.label}</span>
        <FiChevronDown size={14} className={`cs-arrow ${open ? "cs-arrow--up" : ""}`} />
      </button>
      {open && (
        <ul className="cs-menu" role="listbox">
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`cs-option ${opt.value === value ? "cs-option--active" : ""}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── SkeletonCard ────────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="offer-skeleton card">
      <div className="skel skel-logo" />
      <div className="offer-skeleton-body">
        <div className="offer-skeleton-main">
          <div className="skel skel-title" />
          <div className="skel skel-company" />
          <div className="skel skel-meta" />
          <div className="skel-tags-row">
            <div className="skel skel-tag" />
            <div className="skel skel-tag" />
            <div className="skel skel-tag" />
          </div>
        </div>
        <div className="offer-skeleton-right">
          <div className="skel skel-badge" />
          <div className="skel skel-btn" />
        </div>
      </div>
    </div>
  );
}

/* ── EmptyState ──────────────────────────────────────────────────────────── */
function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return (
    <div className="offers-empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      {actionLabel && (
        <button type="button" className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function OffersList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [urlParams] = useSearchParams();

  /* state ────────────────────────────────────────────────────────────────── */
  const [offers,             setOffers]            = useState([]);
  const [savedOffers,        setSavedOffers]       = useState([]);
  const [recommendedOffers,  setRecommendedOffers] = useState([]);
  const [pagination,         setPagination]        = useState({ page: 1, totalPages: 1, total: 0 });
  const [domains,            setDomains]           = useState([]);
  const [locations,          setLocations]         = useState([]);
  const [durations,          setDurations]         = useState([]);
  const [newOffersCount,     setNewOffersCount]    = useState(0);
  const [favoriteIds,        setFavoriteIds]       = useState(new Set());
  const [appliedIds,         setAppliedIds]        = useState(new Set());
  const [loading,            setLoading]           = useState(true);
  const [loadingFavs,        setLoadingFavs]       = useState(true);

  const [search,             setSearch]            = useState(urlParams.get("search") || "");
  const [typeFilter,         setTypeFilter]        = useState("");
  const [domainFilter,       setDomainFilter]      = useState("");
  const [locationFilter,     setLocationFilter]    = useState("");
  const [durationFilter,     setDurationFilter]    = useState("");
  const [levelFilter,        setLevelFilter]       = useState("");
  const [sortFilter,         setSortFilter]        = useState("recent");
  const [page,               setPage]              = useState(1);
  const [activeTab,          setActiveTab]         = useState("all");

  /* computed ─────────────────────────────────────────────────────────────── */
  const userSkillSet = new Set(
    (user?.skills || []).map((s) => (s.name || s).toLowerCase())
  );
  const hasRecommended = recommendedOffers.length > 0;

  /* initial load ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    // Domains for filter
    offersService.getDomains()
      .then(({ data }) => setDomains(data.domains))
      .catch(() => {});

    // All offers for metadata + recommendations
    offersService.getAll({ limit: 300 })
      .then(({ data }) => {
        const all = data.offers.map(normalizeOffer);
        setLocations([...new Set(all.map((o) => o.location).filter(Boolean))].sort());
        setDurations([...new Set(all.map((o) => o.duration).filter(Boolean))]);
        setNewOffersCount(all.filter((o) => isRecentOffer(o.createdAt)).length);

        // Recommended — only if user has skills
        if (userSkillSet.size > 0) {
          const scored = all
            .map((o) => ({ ...o, _score: getMatchScore(o.skills, userSkillSet) }))
            .filter((o) => o._score > 0)
            .sort((a, b) => b._score - a._score)
            .slice(0, 5);
          setRecommendedOffers(scored);
        }
      })
      .catch(() => {});

    // Favorites
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingFavs(true);
    favoritesService.getAll()
      .then(({ data }) => {
        const favs = (data.favorites || []).map(normalizeOffer);
        setFavoriteIds(new Set(favs.map((f) => f._id)));
        setSavedOffers(favs);
      })
      .catch(() => {})
      .finally(() => setLoadingFavs(false));

    // Applied offers — to show "Déjà postulé" badge
    applicationsService.getAll()
      .then(({ data }) => {
        const apps = data.applications || [];
        setAppliedIds(new Set(apps.map((a) => String(a.offerId?._id || a.offerId))));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* paginated offers ──────────────────────────────────────────────────────── */
  useEffect(() => {
    let active = true;
    const params = { page, limit: PAGE_SIZE };
    if (search)                                params.search   = search;
    if (typeFilter)                            params.type     = typeFilter;
    if (domainFilter)                          params.domain   = domainFilter;
    if (locationFilter)                        params.location = locationFilter;
    if (durationFilter)                        params.duration = durationFilter;
    if (levelFilter)                           params.level    = levelFilter;
    if (sortFilter && sortFilter !== "recent") params.sort     = sortFilter;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    offersService.getAll(params)
      .then(({ data }) => {
        if (!active) return;
        setOffers(data.offers.map(normalizeOffer));
        setPagination(data.pagination);
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [search, typeFilter, domainFilter, locationFilter, durationFilter, levelFilter, sortFilter, page]);

  /* toggle favorite ───────────────────────────────────────────────────────── */
  const handleToggleFavorite = async (offerId) => {
    const isFav = favoriteIds.has(offerId);

    setFavoriteIds((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(offerId) : next.add(offerId);
      return next;
    });
    if (isFav) {
      setSavedOffers((prev) => prev.filter((o) => o._id !== offerId));
    } else {
      const offerToAdd = offers.find((o) => o._id === offerId);
      if (offerToAdd) {
        setSavedOffers((prev) =>
          prev.some((o) => o._id === offerId) ? prev : [...prev, offerToAdd]
        );
      }
    }

    try {
      await favoritesService.toggle(offerId);
    } catch {
      // rollback
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        isFav ? next.add(offerId) : next.delete(offerId);
        return next;
      });
      if (isFav) {
        const offerToRestore = offers.find((o) => o._id === offerId);
        if (offerToRestore) setSavedOffers((prev) => [...prev, offerToRestore]);
      } else {
        setSavedOffers((prev) => prev.filter((o) => o._id !== offerId));
      }
    }
  };

  /* filter helpers ────────────────────────────────────────────────────────── */
  const updateFilter = (setter) => (value) => { setter(value); setPage(1); };

  const resetFilters = () => {
    setSearch(""); setTypeFilter(""); setDomainFilter("");
    setLocationFilter(""); setDurationFilter(""); setLevelFilter("");
    setSortFilter("recent"); setPage(1);
  };

  /* derived ───────────────────────────────────────────────────────────────── */
  const hasActiveFilters = !!(search || typeFilter || domainFilter || locationFilter || durationFilter || levelFilter);
  const paginationRange  = getPaginationRange(pagination.page, pagination.totalPages);

  const visibleOffers =
    activeTab === "saved"       ? savedOffers :
    activeTab === "new"         ? offers.filter((o) => isRecentOffer(o.createdAt)) :
    activeTab === "recommended" ? recommendedOffers :
    offers;

  const isLoadingCurrent =
    activeTab === "saved"       ? loadingFavs :
    activeTab === "recommended" ? false :
    loading;

  const TABS = [
    { key: "all",   label: t("offers.allOffers") },
    { key: "new",   label: t("offers.newOffersTab") },
    ...(hasRecommended ? [{
      key: "recommended",
      label: t("offers.recommendedTab"),
      star: true,
    }] : []),
    {
      key: "saved",
      label: `${t("offers.savedTab")}${favoriteIds.size > 0 ? ` (${favoriteIds.size})` : ""}`,
    },
  ];

  const LEVEL_OPTIONS = [
    { label: t("offers.allLevels"),        value: ""          },
    { label: t("offers.levelLicence"),     value: "licence"   },
    { label: t("offers.levelMaster"),      value: "master"    },
    { label: t("offers.levelIngenieur"),   value: "ingenieur" },
    { label: t("offers.levelDoctorat"),    value: "doctorat"  },
  ];

  /* card renderer ─────────────────────────────────────────────────────────── */
  const renderCard = (o) => {
    const isFav     = favoriteIds.has(o._id);
    const isApplied = appliedIds.has(String(o._id));
    const isNew     = isRecentOffer(o.createdAt);
    const logoStyle = getLogoStyle(o.companyName);
    const datePosted = timeAgo(o.createdAt, t);

    return (
      <article
        key={o._id}
        className={`offer-list-item card ${isApplied ? "offer-list-item--applied" : ""}`}
      >
        {isApplied && (
          <span className="offer-applied-badge">
            <FiCheck size={10} /> {t("offers.alreadyApplied")}
          </span>
        )}
        {isNew && !isApplied && (
          <span className="offer-new-badge">{t("offers.newBadge")}</span>
        )}

        <div className="offer-list-logo" style={logoStyle}>
          {o.companyName?.[0]?.toUpperCase()}
        </div>

        <div className="offer-list-body">
          <div className="offer-list-main">
            <h3 className="offer-list-title">{o.title}</h3>
            <span className="offer-list-company">{o.companyName}</span>
            <div className="offer-list-meta">
              {o.location && <span><FiMapPin size={11} /> {o.location}</span>}
              {o.duration && <span><FiClock size={11} /> {o.duration}</span>}
            </div>
            <div className="offer-list-skills">
              {(o.skills || []).slice(0, 5).map((s) => (
                <span
                  key={s}
                  className={`offer-skill-tag${userSkillSet.has(s.toLowerCase()) ? " offer-skill-tag--match" : ""}`}
                >
                  {userSkillSet.has(s.toLowerCase()) && <FiCheck size={9} />}
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="offer-list-right">
            {datePosted && <span className="offer-list-date">{datePosted}</span>}
            <span className="badge badge-purple offer-list-type">{o.type}</span>
            <div className="offer-list-actions">
              <Link
                to={`/dashboard/student/offers/${o._id}`}
                className="btn btn-primary btn-sm"
              >
                {t("offers.viewOffer")}
              </Link>
              <button
                type="button"
                aria-label={isFav ? t("offers.savedOffer") : t("offers.saveOffer")}
                className={`offer-bookmark ${isFav ? "active" : ""}`}
                onClick={() => handleToggleFavorite(o._id)}
              >
                <FiBookmark size={16} fill={isFav ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  /* render ────────────────────────────────────────────────────────────────── */
  return (
    <DashboardLayout
      title={t("offers.title")}
      subtitle={t("offers.available", { count: pagination.total })}
    >
      {/* Stats bar */}
      <div className="offers-stats-bar offers-stats-bar--3">
        <div className="stat-card card">
          <div className="stat-card-icon stat-icon--indigo"><FiBriefcase size={20} /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{pagination.total || "—"}</div>
            <div className="stat-card-label">{t("offers.availableOffers")}</div>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-card-icon stat-icon--emerald"><FiUsers size={20} /></div>
          <div className="stat-card-body">
            <div className="stat-card-value-row">
              <span className="stat-card-value">{newOffersCount}</span>
              {newOffersCount > 0 && <span className="stat-new-badge">NEW</span>}
            </div>
            <div className="stat-card-label">{t("offers.newThisWeek")}</div>
            <div className="stat-card-sub">{t("offers.newThisWeekSub")}</div>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-card-icon stat-icon--amber"><FiBookmark size={20} /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{favoriteIds.size}</div>
            <div className="stat-card-label">{t("offers.savedOffersCount")}</div>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="offers-page-layout">
        <div className="offers-main-col">

          {/* Tabs + sort */}
          <div className="offers-tabs-bar">
            <div className="offers-tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`offers-tab ${activeTab === tab.key ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.star && <FiStar size={12} className="tab-star" />}
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab !== "saved" && activeTab !== "recommended" && (
              <div className="offers-sort-row">
                <span className="sort-label">{t("offers.sortBy")}</span>
                <CustomSelect
                  compact
                  value={sortFilter}
                  onChange={(val) => { setSortFilter(val); setPage(1); }}
                  options={[
                    { label: t("offers.sort_recent"),    value: "recent"    },
                    { label: t("offers.sort_oldest"),    value: "oldest"    },
                    { label: t("offers.sort_relevance"), value: "relevance" },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Recommended header */}
          {activeTab === "recommended" && (
            <div className="recommended-header">
              <FiStar size={15} />
              <span>{t("offers.recommendedSub", { count: recommendedOffers.length })}</span>
            </div>
          )}

          {/* Active filter chips */}
          {hasActiveFilters && activeTab === "all" && (
            <div className="active-filters-row">
              {search && (
                <span className="active-filter-tag">
                  <FiSearch size={11} /> {search}
                  <button type="button" onClick={() => updateFilter(setSearch)("")}><FiX size={10} /></button>
                </span>
              )}
              {locationFilter && (
                <span className="active-filter-tag">
                  <FiMapPin size={11} /> {locationFilter}
                  <button type="button" onClick={() => updateFilter(setLocationFilter)("")}><FiX size={10} /></button>
                </span>
              )}
              {durationFilter && (
                <span className="active-filter-tag">
                  <FiClock size={11} /> {durationFilter}
                  <button type="button" onClick={() => updateFilter(setDurationFilter)("")}><FiX size={10} /></button>
                </span>
              )}
              {domainFilter && (
                <span className="active-filter-tag">
                  {domainFilter}
                  <button type="button" onClick={() => updateFilter(setDomainFilter)("")}><FiX size={10} /></button>
                </span>
              )}
              {typeFilter && (
                <span className="active-filter-tag">
                  {typeFilter}
                  <button type="button" onClick={() => updateFilter(setTypeFilter)("")}><FiX size={10} /></button>
                </span>
              )}
              {levelFilter && (
                <span className="active-filter-tag">
                  {levelFilter}
                  <button type="button" onClick={() => updateFilter(setLevelFilter)("")}><FiX size={10} /></button>
                </span>
              )}
              <button type="button" className="filter-clear-all" onClick={resetFilters}>
                {t("offers.reset")}
              </button>
            </div>
          )}

          {/* List */}
          {isLoadingCurrent ? (
            <div className="offers-list">
              {Array.from({ length: PAGE_SIZE }, (_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <>
              <div className="offers-list">
                {visibleOffers.length === 0 ? (
                  activeTab === "saved" ? (
                    <EmptyState
                      icon={<FiBookmark size={36} />}
                      title={t("offers.noSaved")}
                      description={t("offers.noSavedDesc")}
                    />
                  ) : activeTab === "new" ? (
                    <EmptyState
                      icon={<FiUsers size={36} />}
                      title={t("offers.noNew")}
                      description={t("offers.noNewDesc")}
                    />
                  ) : activeTab === "recommended" ? (
                    <EmptyState
                      icon={<FiStar size={36} />}
                      title={t("offers.noRecommended")}
                      description={t("offers.noRecommendedDesc")}
                      actionLabel={t("offers.addSkills")}
                      onAction={() => navigate("/dashboard/student/profile")}
                    />
                  ) : (
                    <EmptyState
                      icon={<FiInbox size={36} />}
                      title={t("offers.noResults")}
                      description={t("offers.noResultsDesc")}
                      actionLabel={t("offers.reset")}
                      onAction={resetFilters}
                    />
                  )
                ) : (
                  visibleOffers.map(renderCard)
                )}
              </div>

              {activeTab === "all" && pagination.totalPages > 1 && (
                <div className="offers-pagination">
                  <span className="pagination-info">
                    {t("offers.showingRange", {
                      from:  (pagination.page - 1) * PAGE_SIZE + 1,
                      to:    Math.min(pagination.page * PAGE_SIZE, pagination.total),
                      total: pagination.total,
                    })}
                  </span>
                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="btn btn-ghost pagination-nav"
                      disabled={!pagination.hasPrev}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <FiChevronLeft size={14} />
                    </button>
                    <div className="pagination-pages">
                      {paginationRange.map((p, idx) =>
                        p === "..." ? (
                          <span key={`dots-${idx}`} className="pagination-dots">...</span>
                        ) : (
                          <button
                            key={`page-${p}`}
                            type="button"
                            className={`pagination-page ${p === pagination.page ? "active" : ""}`}
                            onClick={() => setPage(p)}
                          >
                            {p}
                          </button>
                        )
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost pagination-nav"
                      disabled={!pagination.hasNext}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <FiChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "saved" && savedOffers.length > 0 && (
                <div className="offers-pagination">
                  <span className="pagination-info">
                    {savedOffers.length === 1
                      ? t("offers.savedCount",       { count: savedOffers.length })
                      : t("offers.savedCountPlural", { count: savedOffers.length })}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Filter sidebar */}
        {activeTab !== "saved" && (
          <aside className="offers-filter-sidebar card">
            <div className="filter-sidebar-head">
              <h4 className="filter-sidebar-title">
                <FiFilter size={14} /> {t("offers.filterTitle")}
              </h4>
              {hasActiveFilters && (
                <button type="button" className="filter-reset-btn" onClick={resetFilters}>
                  <FiX size={12} /> {t("offers.reset")}
                </button>
              )}
            </div>

            <div className="filter-group">
              <label className="filter-label">{t("common.search")}</label>
              <div className="offers-search-bar">
                <FiSearch size={14} />
                <input
                  placeholder={t("offers.searchPlaceholder")}
                  value={search}
                  onChange={(e) => updateFilter(setSearch)(e.target.value)}
                />
              </div>
            </div>

            <div className="filter-group">
              <label className="filter-label">{t("offers.locationLabel")}</label>
              <CustomSelect
                value={locationFilter}
                onChange={(val) => updateFilter(setLocationFilter)(val)}
                options={[
                  { label: t("offers.allLocations"), value: "" },
                  ...locations.map((l) => ({ label: l, value: l })),
                ]}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">{t("offers.stageTypeLabel")}</label>
              <div className="filter-checkboxes">
                <label className="filter-checkbox-row">
                  <input
                    type="checkbox"
                    checked={typeFilter === "stage PFE"}
                    onChange={() =>
                      updateFilter(setTypeFilter)(typeFilter === "stage PFE" ? "" : "stage PFE")
                    }
                  />
                  <span>{t("offers.typeStagePFE")}</span>
                </label>
              </div>
            </div>

            <div className="filter-group">
              <label className="filter-label">{t("offers.durationLabel")}</label>
              <CustomSelect
                value={durationFilter}
                onChange={(val) => updateFilter(setDurationFilter)(val)}
                options={[
                  { label: t("offers.allDurations"), value: "" },
                  ...durations.map((d) => ({ label: d, value: d })),
                ]}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">{t("offers.allDomains")}</label>
              <CustomSelect
                value={domainFilter}
                onChange={(val) => updateFilter(setDomainFilter)(val)}
                options={[
                  { label: t("offers.allDomains"), value: "" },
                  ...domains.map((d) => ({ label: d, value: d })),
                ]}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">{t("offers.levelLabel")}</label>
              <CustomSelect
                value={levelFilter}
                onChange={(val) => updateFilter(setLevelFilter)(val)}
                options={LEVEL_OPTIONS}
              />
            </div>

            <div className="offers-notif-card">
              <div className="offers-notif-icon"><FiBell size={22} /></div>
              <h5 className="offers-notif-title">{t("offers.alertTitle")}</h5>
              <p className="offers-notif-text">{t("offers.alertText")}</p>
              <button type="button" className="offers-notif-btn">{t("offers.alertBtn")}</button>
            </div>
          </aside>
        )}
      </div>
    </DashboardLayout>
  );
}
