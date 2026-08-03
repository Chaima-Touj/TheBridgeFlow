// src/pages/applications/MyApplications.jsx
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslation }    from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  FiSearch, FiFilter, FiBriefcase, FiMapPin, FiCalendar,
  FiFileText, FiExternalLink, FiX, FiDownload, FiChevronDown,
  FiCheckCircle, FiClock, FiXCircle, FiRefreshCw, FiArrowRight,
  FiInbox,
} from "react-icons/fi";
import DashboardLayout         from "../../components/layout/DashboardLayout.jsx";
import { applicationsService } from "../../services/applications.service.js";
import "./MyApplications.css";


/* ── helpers ─────────────────────────────────────────────────────── */
const LOGO_PALETTES = [
  "#4F46E5","#0EA5E9","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6",
];
function getLogoColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return LOGO_PALETTES[Math.abs(h) % LOGO_PALETTES.length];
}

function formatDate(iso, locale = "fr-FR") {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

const STATUS_CONFIG = {
  "en attente": {
    bg:    "rgba(245,158,11,0.10)",
    color: "#D97706",
    dot:   "#F59E0B",
    icon:  FiClock,
    labelKey: "filterPending",
  },
  "acceptée": {
    bg:    "rgba(16,185,129,0.10)",
    color: "#059669",
    dot:   "#10B981",
    icon:  FiCheckCircle,
    labelKey: "filterAccepted",
  },
  "refusée": {
    bg:    "rgba(239,68,68,0.10)",
    color: "#DC2626",
    dot:   "#EF4444",
    icon:  FiXCircle,
    labelKey: "filterRejected",
  },
  "en cours": {
    bg:    "rgba(37,99,235,0.10)",
    color: "#2563EB",
    dot:   "#3B82F6",
    icon:  FiRefreshCw,
    labelKey: "filterInProgress",
  },
};

const FILTER_TABS = [
  { key: "all",         labelKey: "filterAll"        },
  { key: "en attente",  labelKey: "filterPending"    },
  { key: "en cours",    labelKey: "filterInProgress" },
  { key: "acceptée",    labelKey: "filterAccepted"   },
  { key: "refusée",     labelKey: "filterRejected"   },
];

/* ── Timeline ──────────────────────────────────────────────────── */
function Timeline({ app, t }) {
  const steps = [
    {
      key:   "submitted",
      label: t("applications.timelineSubmitted"),
      date:  app.createdAt,
      done:  true,
      color: "#10B981",
    },
    {
      key:   "review",
      label: t("applications.timelineReview"),
      date:  app.status !== "en attente" ? app.updatedAt : null,
      done:  app.status !== "en attente",
      color: "#3B82F6",
    },
    {
      key:   "decision",
      label: t("applications.timelineDecision"),
      date:  (app.status === "acceptée" || app.status === "refusée") ? app.updatedAt : null,
      done:  app.status === "acceptée" || app.status === "refusée",
      color: app.status === "acceptée" ? "#10B981" : "#EF4444",
    },
  ];

  return (
    <div className="ma-timeline">
      {steps.map((step, idx) => (
        <div key={step.key} className={`ma-tl-step${step.done ? " ma-tl-step--done" : ""}`}>
          <div className="ma-tl-connector-wrap">
            <div
              className="ma-tl-dot"
              style={step.done ? { background: step.color, borderColor: step.color } : {}}
            >
              {step.done && <FiCheckCircle size={10} color="#fff" />}
            </div>
            {idx < steps.length - 1 && (
              <div className={`ma-tl-line${steps[idx + 1].done ? " ma-tl-line--done" : ""}`} />
            )}
          </div>
          <div className="ma-tl-body">
            <div className="ma-tl-label">{step.label}</div>
            {step.date && (
              <div className="ma-tl-date">{formatDate(step.date)}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Detail Modal ──────────────────────────────────────────────── */
function DetailModal({ app, t, onClose }) {
  const conf = STATUS_CONFIG[app.status] || STATUS_CONFIG["en attente"];
  const StatusIcon = conf.icon;
  const overlayRef = useRef(null);

  const handleOverlayClick = useCallback((e) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const logoColor = getLogoColor(app.offerId?.companyName || "");
  const initial   = (app.offerId?.companyName || "?")[0].toUpperCase();

  return (
    <div className="ma-overlay" ref={overlayRef} onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className="ma-modal">

        {/* Header */}
        <div className="ma-modal-header">
          <div className="ma-modal-logo" style={{ background: logoColor }}>
            {initial}
          </div>
          <div className="ma-modal-header-body">
            <h2 className="ma-modal-title">{app.offerId?.title || "Offre supprimée"}</h2>
            <span className="ma-modal-company">{app.offerId?.companyName}</span>
          </div>
          <button
            type="button"
            className="ma-modal-close"
            onClick={onClose}
            aria-label={t("applications.closeModal")}
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Status + date */}
        <div className="ma-modal-meta">
          <div
            className="ma-modal-status"
            style={{ background: conf.bg, color: conf.color }}
          >
            <StatusIcon size={13} />
            {t(`status.${app.status}`)}
          </div>
          <div className="ma-modal-date">
            <FiCalendar size={13} />
            {t("applications.appliedOn")} {formatDate(app.createdAt)}
          </div>
          {app.offerId?._id && (
            <Link
              to={`/dashboard/student/offers/${app.offerId._id}`}
              className="ma-modal-link"
            >
              <FiExternalLink size={13} />
              {t("applications.viewOffer")}
            </Link>
          )}
        </div>

        <div className="ma-modal-body">
          {/* Timeline */}
          <div className="ma-modal-section">
            <h4 className="ma-modal-section-title">{t("applications.timeline")}</h4>
            <Timeline app={app} t={t} />
          </div>

          {/* Cover letter */}
          <div className="ma-modal-section">
            <h4 className="ma-modal-section-title">{t("applications.coverLetterLabel")}</h4>
            {app.coverLetter ? (
              <p className="ma-modal-cl">{app.coverLetter}</p>
            ) : (
              <p className="ma-modal-empty-field">{t("applications.noCoverLetter")}</p>
            )}
          </div>

          {/* CV */}
          <div className="ma-modal-section">
            <h4 className="ma-modal-section-title">{t("applications.cvLabel")}</h4>
            {app.cvUrl ? (
              <a
                href={app.cvUrl}
                target="_blank"
                rel="noreferrer"
                className="ma-cv-btn"
              >
                <FiDownload size={14} />
                {t("applications.viewCv")}
              </a>
            ) : (
              <p className="ma-modal-empty-field">{t("applications.noCv")}</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Skeleton card ─────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="ma-card ma-card--skel">
      <div className="ma-skel ma-skel-logo" />
      <div className="ma-card-body">
        <div className="ma-skel" style={{ height: 18, width: "55%", marginBottom: 8 }} />
        <div className="ma-skel" style={{ height: 13, width: "35%", marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <div className="ma-skel" style={{ height: 24, width: 90 }} />
          <div className="ma-skel" style={{ height: 24, width: 80 }} />
        </div>
      </div>
      <div className="ma-card-right">
        <div className="ma-skel" style={{ height: 26, width: 90, marginBottom: 12 }} />
        <div className="ma-skel" style={{ height: 13, width: 70 }} />
      </div>
    </div>
  );
}

/* ── Stat card ─────────────────────────────────────────────────── */
function StatCard({ value, label, dotColor, icon: Icon }) {
  return (
    <div className="ma-stat">
      <div className="ma-stat-icon" style={{ background: `${dotColor}18`, color: dotColor }}>
        <Icon size={18} />
      </div>
      <div className="ma-stat-body">
        <div className="ma-stat-value">{value}</div>
        <div className="ma-stat-label">{label}</div>
      </div>
    </div>
  );
}

/* ── Application card ──────────────────────────────────────────── */
function AppCard({ app, t, onDetails }) {
  const conf  = STATUS_CONFIG[app.status] || STATUS_CONFIG["en attente"];
  const StatusIcon = conf.icon;
  const logoColor  = getLogoColor(app.offerId?.companyName || "");
  const initial    = (app.offerId?.companyName || "?")[0].toUpperCase();

  return (
    <div className="ma-card" data-status={app.status}>
      {/* Logo */}
      <div className="ma-card-logo" style={{ background: logoColor }}>
        {initial}
      </div>

      {/* Main info */}
      <div className="ma-card-body">
        <h3 className="ma-card-title">{app.offerId?.title || "Offre supprimée"}</h3>
        <span className="ma-card-company">{app.offerId?.companyName}</span>
        <div className="ma-card-chips">
          {app.offerId?.location && (
            <span className="ma-chip">
              <FiMapPin size={10} />
              {app.offerId.location}
            </span>
          )}
          {app.offerId?.type && (
            <span className="ma-chip">
              <FiBriefcase size={10} />
              {app.offerId.type}
            </span>
          )}
        </div>
      </div>

      {/* Right: status + date + actions */}
      <div className="ma-card-right">
        <div
          className="ma-status-badge"
          style={{ background: conf.bg, color: conf.color }}
        >
          <StatusIcon size={11} />
          {t(`status.${app.status}`)}
        </div>

        <div className="ma-card-date">
          <FiCalendar size={11} />
          {formatDate(app.createdAt)}
        </div>

        <div className="ma-card-actions">
          {app.offerId?._id && (
            <Link
              to={`/dashboard/student/offers/${app.offerId._id}`}
              className="ma-btn ma-btn--ghost"
              title={t("applications.viewOffer")}
            >
              <FiExternalLink size={13} />
              <span>{t("applications.viewOffer")}</span>
            </Link>
          )}
          <button
            type="button"
            className="ma-btn ma-btn--primary"
            onClick={() => onDetails(app)}
          >
            <FiFileText size={13} />
            <span>{t("applications.viewDetails")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────── */
function EmptyState({ hasFilters, t, navigate }) {
  return (
    <div className="ma-empty">
      <div className="ma-empty-icon">
        <FiInbox size={38} />
      </div>
      <h3 className="ma-empty-title">
        {hasFilters ? t("applications.noResults") : t("applications.emptyTitle")}
      </h3>
      {!hasFilters && (
        <>
          <p className="ma-empty-desc">{t("applications.emptyDesc")}</p>
          <button
            type="button"
            className="ma-empty-cta"
            onClick={() => navigate("/dashboard/student/offers")}
          >
            {t("applications.emptyCtaLabel")}
            <FiArrowRight size={15} />
          </button>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════════════ */
export default function MyApplications() {
  const { t }    = useTranslation();
  const navigate = useNavigate();

  const [applications,  setApplications]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [sortOrder,     setSortOrder]     = useState("newest");
  const [selectedApp,   setSelectedApp]   = useState(null);
  const [sortOpen,      setSortOpen]      = useState(false);
  const sortRef = useRef(null);

  /* load */
  useEffect(() => {
    applicationsService.getAll()
      .then(({ data }) => setApplications(data.applications || []))
      .finally(() => setLoading(false));
  }, []);

  /* close sort dropdown on outside click */
  useEffect(() => {
    const handle = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  /* stats — computed from real data */
  const stats = useMemo(() => ({
    total:      applications.length,
    pending:    applications.filter((a) => a.status === "en attente").length,
    inProgress: applications.filter((a) => a.status === "en cours").length,
    accepted:   applications.filter((a) => a.status === "acceptée").length,
    rejected:   applications.filter((a) => a.status === "refusée").length,
  }), [applications]);

  /* filtered + sorted */
  const filtered = useMemo(() => {
    let list = [...applications];

    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((a) =>
        (a.offerId?.title        || "").toLowerCase().includes(q) ||
        (a.offerId?.companyName  || "").toLowerCase().includes(q) ||
        (a.offerId?.location     || "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });

    return list;
  }, [applications, statusFilter, search, sortOrder]);

  const hasFilters = search.trim() !== "" || statusFilter !== "all";

  /* subtitle */
  const subtitle = loading
    ? ""
    : `${applications.length} candidature${applications.length !== 1 ? "s" : ""}`;

  return (
    <DashboardLayout title={t("applications.title")} subtitle={subtitle}>
      <div className="ma-page">

        {/* ── Stats bar ── */}
        <div className="ma-stats">
          <StatCard
            value={loading ? "—" : stats.total}
            label={t("applications.statTotal")}
            dotColor="#6366F1"
            icon={FiBriefcase}
          />
          <StatCard
            value={loading ? "—" : stats.pending}
            label={t("applications.statPending")}
            dotColor="#F59E0B"
            icon={FiClock}
          />
          <StatCard
            value={loading ? "—" : stats.inProgress}
            label={t("applications.statInProgress")}
            dotColor="#3B82F6"
            icon={FiRefreshCw}
          />
          <StatCard
            value={loading ? "—" : stats.accepted}
            label={t("applications.statAccepted")}
            dotColor="#10B981"
            icon={FiCheckCircle}
          />
          <StatCard
            value={loading ? "—" : stats.rejected}
            label={t("applications.statRejected")}
            dotColor="#EF4444"
            icon={FiXCircle}
          />
        </div>

        {/* ── Toolbar ── */}
        <div className="ma-toolbar">

          {/* Search */}
          <div className="ma-search-wrap">
            <FiSearch size={15} className="ma-search-icon" />
            <input
              type="text"
              className="ma-search"
              placeholder={t("applications.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="ma-search-clear"
                onClick={() => setSearch("")}
                aria-label={t("common.clearSearch")}
              >
                <FiX size={14} />
              </button>
            )}
          </div>

          {/* Status tabs */}
          <div className="ma-filter-tabs">
            {FILTER_TABS.map(({ key, labelKey }) => {
              const conf = STATUS_CONFIG[key];
              return (
                <button
                  key={key}
                  type="button"
                  className={`ma-filter-tab ${statusFilter === key ? "ma-filter-tab--active" : ""}`}
                  onClick={() => setStatusFilter(key)}
                  style={statusFilter === key && conf ? { color: conf.color, borderColor: conf.dot } : {}}
                >
                  {conf && <span className="ma-filter-dot" style={{ background: conf.dot }} />}
                  {t(`applications.${labelKey}`)}
                  {key !== "all" && (
                    <span className="ma-filter-count">
                      {key === "en attente"  ? stats.pending    :
                       key === "en cours"    ? stats.inProgress :
                       key === "acceptée"    ? stats.accepted   :
                       key === "refusée"     ? stats.rejected   : 0}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sort dropdown */}
          <div className="ma-sort-wrap" ref={sortRef}>
            <button
              type="button"
              className="ma-sort-btn"
              onClick={() => setSortOpen((v) => !v)}
            >
              <FiFilter size={13} />
              {sortOrder === "newest" ? t("applications.sortNewest") : t("applications.sortOldest")}
              <FiChevronDown size={12} className={sortOpen ? "ma-sort-arrow--open" : ""} />
            </button>
            {sortOpen && (
              <div className="ma-sort-dropdown">
                {["newest", "oldest"].map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`ma-sort-option${sortOrder === o ? " ma-sort-option--active" : ""}`}
                    onClick={() => { setSortOrder(o); setSortOpen(false); }}
                  >
                    {t(`applications.sort${o.charAt(0).toUpperCase() + o.slice(1)}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Results count ── */}
        {!loading && applications.length > 0 && (
          <div className="ma-results-info">
            {filtered.length} / {applications.length} candidature{applications.length !== 1 ? "s" : ""}
            {hasFilters && (
              <button
                type="button"
                className="ma-reset-filters"
                onClick={() => { setSearch(""); setStatusFilter("all"); }}
              >
                <FiX size={12} /> Réinitialiser
              </button>
            )}
          </div>
        )}

        {/* ── List ── */}
        <div className="ma-list">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          ) : filtered.length === 0 ? (
            <EmptyState hasFilters={hasFilters} t={t} navigate={navigate} />
          ) : (
            filtered.map((app) => (
              <AppCard
                key={app._id}
                app={app}
                t={t}
                onDetails={setSelectedApp}
              />
            ))
          )}
        </div>

      </div>

      {/* ── Detail modal ── */}
      {selectedApp && (
        <DetailModal
          app={selectedApp}
          t={t}
          onClose={() => setSelectedApp(null)}
        />
      )}
    </DashboardLayout>
  );
}
