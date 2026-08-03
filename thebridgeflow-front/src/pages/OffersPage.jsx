import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  FiSearch, FiMapPin, FiBriefcase, FiClock,
  FiCalendar, FiX, FiAlertCircle,
} from "react-icons/fi";
import { useLang } from "../context/LangContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import { offersService } from "../services/offers.service.js";
import "./OffersPage.css";

const OFFER_TYPES = ["stage", "PFE", "alternance", "formation", "vidéo"];
const SORT_OPTIONS = ["recent", "oldest", "relevance"];
const PAGE_SIZE = 9;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const LOGO_PALETTES = [
  { bg: "#4F46E5", color: "#fff" },
  { bg: "#0EA5E9", color: "#fff" },
  { bg: "#10B981", color: "#fff" },
  { bg: "#F59E0B", color: "#fff" },
  { bg: "#EF4444", color: "#fff" },
  { bg: "#8B5CF6", color: "#fff" },
  { bg: "#EC4899", color: "#fff" },
  { bg: "#6366F1", color: "#fff" },
];

function logoStyle(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return LOGO_PALETTES[Math.abs(h) % LOGO_PALETTES.length];
}

function formatDate(dateStr, lang) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const days = Math.floor((Date.now() - date) / 86400000);
  if (days === 0) return { fr: "Aujourd'hui", en: "Today", ar: "اليوم" }[lang] ?? "Today";
  if (days === 1) return { fr: "Hier",         en: "Yesterday", ar: "أمس" }[lang] ?? "Yesterday";
  if (days < 7)  return { fr: `Il y a ${days} j.`, en: `${days}d ago`, ar: `منذ ${days} أيام` }[lang] ?? `${days}d`;
  const localeMap = { fr: "fr-FR", en: "en-US", ar: "ar-TN" };
  return date.toLocaleDateString(localeMap[lang] ?? "fr-FR", { day: "numeric", month: "short" });
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="op-card op-card--skeleton" aria-hidden="true">
    <div className="op-sk-header">
      <div className="op-sk op-sk-logo" />
      <div className="op-sk-meta">
        <div className="op-sk op-sk-badge" />
        <div className="op-sk op-sk-company" />
      </div>
      <div className="op-sk op-sk-date" />
    </div>
    <div className="op-sk op-sk-title" />
    <div className="op-sk-chips">
      <div className="op-sk op-sk-chip" />
      <div className="op-sk op-sk-chip" />
      <div className="op-sk op-sk-chip" />
    </div>
    <div className="op-sk op-sk-desc" />
    <div className="op-sk op-sk-desc op-sk--short" />
    <div className="op-sk-row">
      <div className="op-sk op-sk-skill" />
      <div className="op-sk op-sk-skill" />
      <div className="op-sk op-sk-skill" />
    </div>
    <div className="op-sk-actions">
      <div className="op-sk op-sk-btn-outline" />
      <div className="op-sk op-sk-btn-primary" />
    </div>
  </div>
);

// ─── Card animation ───────────────────────────────────────────────────────────
const cardVariants = {
  hidden:  { opacity: 0, y: 18 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: "easeOut" },
  }),
};

// ─── Pagination window helper ─────────────────────────────────────────────────
function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: Math.min(5, total - start + 1) }, (_, i) => start + i);
}

// ─────────────────────────────────────────────────────────────────────────────
const OffersPage = () => {
  const { t }                  = useTranslation();
  const { lang } = useLang();
  const { user }               = useAuth();
  const navigate               = useNavigate();
  const location               = useLocation();

  const [searchInput, setSearchInput] = useState("");
  const searchTimer = useRef(null);

  const [apiQuery, setApiQuery] = useState({
    search: "", domain: "", type: "", location: "", sort: "recent", page: 1,
  });

  const [offers,   setOffers]   = useState([]);
  const [domains,  setDomains]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [pages,    setPages]    = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // Load distinct domains once
  useEffect(() => {
    offersService.getDomains()
      .then(res => setDomains(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  // Single fetch effect — fires whenever apiQuery changes
  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    offersService.getAll({
      page:  apiQuery.page,
      limit: PAGE_SIZE,
      sort:  apiQuery.sort,
      ...(apiQuery.search   && { search:   apiQuery.search }),
      ...(apiQuery.domain   && { domain:   apiQuery.domain }),
      ...(apiQuery.type     && { type:     apiQuery.type }),
      ...(apiQuery.location && { location: apiQuery.location }),
    }).then(res => {
      if (!active) return;
      const data = res.data;
      setOffers(Array.isArray(data) ? data : (data.offers ?? []));
      setTotal(data.total  ?? (Array.isArray(data) ? data.length : 0));
      setPages(data.pages  ?? 1);
    }).catch(err => {
      if (!active) return;
      setError(err?.response?.data?.message ?? t("offers.error"));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiQuery, t]);

  // Debounced search
  const handleSearchChange = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setApiQuery(q => ({ ...q, search: val, page: 1 }));
    }, 400);
  };

  const handleFilterChange = (key, val) =>
    setApiQuery(q => ({ ...q, [key]: val, page: 1 }));

  const handleSortChange = (val) =>
    setApiQuery(q => ({ ...q, sort: val, page: 1 }));

  const handlePageChange = (p) =>
    setApiQuery(q => ({ ...q, page: p }));

  const handleReset = () => {
    clearTimeout(searchTimer.current);
    setSearchInput("");
    setApiQuery({ search: "", domain: "", type: "", location: "", sort: "recent", page: 1 });
  };

  const handleApply = (offerId) => {
    if (!user) {
      navigate("/login", { state: { from: location.pathname, offerId } });
    } else {
      navigate(`/dashboard/student/offers/${offerId}/apply`);
    }
  };

  const hasActiveFilters = searchInput || apiQuery.domain || apiQuery.type || apiQuery.location;

  return (
    <div className="op-page">

      <SiteNavbar />

      {/* ─── HERO ────────────────────────────────────────────────────────── */}
      <section className="op-hero">
        <div className="op-hero__inner">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <span className="op-hero__badge">{t("nav.offers")}</span>
            <h1 className="op-hero__title">{t("offers.hero_title")}</h1>
            <p className="op-hero__subtitle">{t("offers.hero_subtitle")}</p>
            {!loading && total > 0 && (
              <p className="op-hero__count">{t("offers.available", { count: total })}</p>
            )}
          </motion.div>
        </div>
      </section>

      {/* ─── MAIN ────────────────────────────────────────────────────────── */}
      <main className="op-main">

        {/* ─── Filter bar ──────────────────────────────────────────────── */}
        <div className="op-filters">
          <div className="op-search">
            <FiSearch className="op-search__icon" size={15} />
            <input
              type="search"
              className="op-search__input"
              placeholder={t("offers.searchPlaceholder")}
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
            />
            {searchInput && (
              <button
                className="op-search__clear"
                onClick={() => {
                  clearTimeout(searchTimer.current);
                  setSearchInput("");
                  setApiQuery(q => ({ ...q, search: "", page: 1 }));
                }}
              >
                <FiX size={13} />
              </button>
            )}
          </div>

          <select
            className="op-select"
            value={apiQuery.domain}
            onChange={e => handleFilterChange("domain", e.target.value)}
          >
            <option value="">{t("offers.allDomains")}</option>
            {domains.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select
            className="op-select"
            value={apiQuery.type}
            onChange={e => handleFilterChange("type", e.target.value)}
          >
            <option value="">{t("offers.allTypes")}</option>
            {OFFER_TYPES.map(tp => (
              <option key={tp} value={tp}>{tp.charAt(0).toUpperCase() + tp.slice(1)}</option>
            ))}
          </select>

          <div className="op-location">
            <FiMapPin className="op-location__icon" size={14} />
            <input
              type="text"
              className="op-location__input"
              placeholder={t("offers.cityPlaceholder")}
              value={apiQuery.location}
              onChange={e => handleFilterChange("location", e.target.value)}
            />
          </div>

          <select
            className="op-select op-select--sort"
            value={apiQuery.sort}
            onChange={e => handleSortChange(e.target.value)}
          >
            {SORT_OPTIONS.map(s => (
              <option key={s} value={s}>{t(`offers.sort_${s}`)}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <button className="op-reset" onClick={handleReset}>
              <FiX size={13} /> {t("offers.reset")}
            </button>
          )}
        </div>

        {/* ─── Content ─────────────────────────────────────────────────── */}
        {error ? (
          <div className="op-error">
            <FiAlertCircle size={36} className="op-error__icon" />
            <p className="op-error__msg">{error}</p>
            <button
              className="op-btn op-btn--outline"
              onClick={() => setApiQuery(q => ({ ...q }))}
            >
              {t("offers.retry")}
            </button>
          </div>
        ) : loading ? (
          <div className="op-grid">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : offers.length === 0 ? (
          <div className="op-empty">
            <div className="op-empty__icon">🔍</div>
            <h3 className="op-empty__title">{t("offers.noResults")}</h3>
            {hasActiveFilters && (
              <button className="op-btn op-btn--outline" onClick={handleReset}>
                {t("offers.reset")}
              </button>
            )}
          </div>
        ) : (
          <motion.div className="op-grid" initial="hidden" animate="visible">
            {offers.map((offer, index) => {
              const ls     = logoStyle(offer.companyName ?? "");
              const skills = Array.isArray(offer.skills) ? offer.skills : [];
              const desc   = offer.description ?? offer.desc ?? "";

              return (
                <motion.article
                  key={offer._id}
                  custom={index}
                  variants={cardVariants}
                  className="op-card"
                >
                  <div className="op-card__header">
                    <div className="op-card__logo" style={{ background: ls.bg, color: ls.color }}>
                      {(offer.companyName ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="op-card__company-block">
                      {offer.type && <span className="op-card__type">{offer.type}</span>}
                    </div>
                    <span className="op-card__date">
                      <FiCalendar size={11} />
                      {formatDate(offer.createdAt, lang)}
                    </span>
                  </div>

                  <h2 className="op-card__title">{offer.title}</h2>

                  <div className="op-card__meta">
                    {offer.location && (
                      <span className="op-chip"><FiMapPin size={11} />{offer.location}</span>
                    )}
                    {offer.duration && (
                      <span className="op-chip"><FiClock size={11} />{offer.duration}</span>
                    )}
                    {offer.domain && (
                      <span className="op-chip"><FiBriefcase size={11} />{offer.domain}</span>
                    )}
                  </div>

                  <p className="op-card__desc">
                    {desc
                      ? desc.slice(0, 130) + (desc.length > 130 ? "…" : "")
                      : t("offers.noDescription")}
                  </p>

                  {skills.length > 0 && (
                    <div className="op-card__skills">
                      {skills.slice(0, 4).map(s => (
                        <span key={s} className="op-skill">{s}</span>
                      ))}
                      {skills.length > 4 && (
                        <span className="op-skill op-skill--more">+{skills.length - 4}</span>
                      )}
                    </div>
                  )}

                  <div className="op-card__actions">
                    <Link to={`/offers/${offer._id}`} className="op-btn op-btn--outline">
                      {t("offers.viewDetails")}
                    </Link>
                    <button
                      className="op-btn op-btn--primary"
                      onClick={() => handleApply(offer._id)}
                    >
                      {user ? t("offers.applyNow") : t("offers.loginToApply")}
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        )}

        {/* ─── Pagination ──────────────────────────────────────────────── */}
        {!loading && !error && pages > 1 && (
          <nav className="op-pagination" aria-label={t("offers.paginationAriaLabel")}>
            <button
              className="op-pg-btn"
              disabled={apiQuery.page <= 1}
              onClick={() => handlePageChange(apiQuery.page - 1)}
            >
              ‹ {t("offers.previous")}
            </button>

            <div className="op-pg-numbers">
              {apiQuery.page > 3 && pages > 7 && (
                <>
                  <button className="op-pg-num" onClick={() => handlePageChange(1)}>1</button>
                  <span className="op-pg-ellipsis">…</span>
                </>
              )}
              {pageWindow(apiQuery.page, pages).map(p => (
                <button
                  key={p}
                  className={`op-pg-num${apiQuery.page === p ? " op-pg-num--active" : ""}`}
                  onClick={() => handlePageChange(p)}
                >
                  {p}
                </button>
              ))}
              {apiQuery.page < pages - 2 && pages > 7 && (
                <>
                  <span className="op-pg-ellipsis">…</span>
                  <button className="op-pg-num" onClick={() => handlePageChange(pages)}>{pages}</button>
                </>
              )}
            </div>

            <button
              className="op-pg-btn"
              disabled={apiQuery.page >= pages}
              onClick={() => handlePageChange(apiQuery.page + 1)}
            >
              {t("offers.next")} ›
            </button>
          </nav>
        )}

      </main>
    </div>
  );
};

export default OffersPage;
