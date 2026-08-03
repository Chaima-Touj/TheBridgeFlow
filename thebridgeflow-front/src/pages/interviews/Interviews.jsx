// src/pages/interviews/Interviews.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation }    from "react-i18next";
import {
  FiVideo, FiMapPin, FiCalendar, FiClock, FiCheck, FiX,
  FiExternalLink, FiAlertCircle, FiCheckCircle, FiXCircle,
  FiActivity, FiAward, FiMessageSquare,
} from "react-icons/fi";
import DashboardLayout         from "../../components/layout/DashboardLayout.jsx";
import { interviewsService }   from "../../services/interviews.service.js";
import "./Interviews.css";

/* ── helpers ──────────────────────────────────────── */
const LOGO_PALETTES = [
  "#4F46E5","#0EA5E9","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6",
];
function getLogoColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return LOGO_PALETTES[Math.abs(h) % LOGO_PALETTES.length];
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function getCountdown(scheduledAt, t) {
  const diff = new Date(scheduledAt) - Date.now();
  if (diff <= 0) return null;
  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const days       = Math.floor(totalHours / 24);
  if (days === 0 && totalHours === 0) return t("interviews.countdownToday");
  if (days === 0)   return t("interviews.countdownHours", { count: totalHours });
  if (days === 1)   return t("interviews.countdownTomorrow");
  return t("interviews.countdown", { count: days });
}

// Time comparison helpers
const startOfDay = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

function getGroup(scheduledAt) {
  const d    = new Date(scheduledAt);
  const now  = new Date();
  const sod  = startOfDay();
  const eow  = new Date(sod.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (d < sod)  return "past";
  if (d.toDateString() === now.toDateString()) return "today";
  if (d < eow)  return "thisWeek";
  return "later";
}

const STATUS_CONFIG = {
  "proposé":  { bg: "rgba(245,158,11,0.10)", color: "#D97706", icon: FiAlertCircle,  labelKey: "statUpcoming"  },
  "confirmé": { bg: "rgba(16,185,129,0.10)", color: "#059669", icon: FiCheckCircle,  labelKey: "statConfirmed" },
  "annulé":   { bg: "rgba(239,68,68,0.10)",  color: "#DC2626", icon: FiXCircle,      labelKey: "statCancelled" },
  "terminé":  { bg: "rgba(99,102,241,0.10)", color: "#6366F1", icon: FiAward,        labelKey: "statDone"      },
};

const FILTER_TABS = [
  { key: "all",       labelKey: "filterAll",       statKey: null           },
  { key: "upcoming",  labelKey: "filterUpcoming",  statKey: "upcoming"     },
  { key: "confirmé",  labelKey: "filterConfirmed", statKey: "confirmed"    },
  { key: "annulé",    labelKey: "filterCancelled", statKey: "cancelled"    },
  { key: "terminé",   labelKey: "filterDone",      statKey: "done"         },
];

const GROUP_ORDER = ["today", "thisWeek", "later", "past"];

/* ── SkeletonCard ─────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="iv-card iv-card--skel">
      <div className="iv-skel iv-skel-icon" />
      <div className="iv-card-body">
        <div className="iv-skel" style={{ height: 18, width: "50%", marginBottom: 8 }} />
        <div className="iv-skel" style={{ height: 13, width: "32%", marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <div className="iv-skel" style={{ height: 22, width: 120 }} />
          <div className="iv-skel" style={{ height: 22, width: 80  }} />
        </div>
      </div>
      <div className="iv-card-right">
        <div className="iv-skel" style={{ height: 26, width: 80, marginBottom: 8 }} />
        <div className="iv-skel" style={{ height: 30, width: 100 }} />
      </div>
    </div>
  );
}

/* ── StatCard ─────────────────────────────────────── */
function StatCard({ value, label, icon: Icon, dotColor }) {
  return (
    <div className="iv-stat">
      <div className="iv-stat-icon" style={{ background: `${dotColor}18`, color: dotColor }}>
        <Icon size={18} />
      </div>
      <div>
        <div className="iv-stat-value">{value}</div>
        <div className="iv-stat-label">{label}</div>
      </div>
    </div>
  );
}

/* ── InterviewCard ────────────────────────────────── */
function InterviewCard({ iv, t, onAction }) {
  const [busy, setBusy] = useState(false);
  const conf        = STATUS_CONFIG[iv.status] || STATUS_CONFIG["proposé"];
  const StatusIcon  = conf.icon;
  const isOnline    = iv.mode === "en ligne";
  const ModeIcon    = isOnline ? FiVideo : FiMapPin;
  const isJoinable  = isOnline
    && (iv.status === "proposé" || iv.status === "confirmé")
    && new Date(iv.scheduledAt) >= new Date();
  const logoColor   = getLogoColor(iv.applicationId?.offerId?.companyName || "");
  const initial     = (iv.applicationId?.offerId?.companyName || "?")[0].toUpperCase();
  const countdown   = getCountdown(iv.scheduledAt, t);
  const isPast      = new Date(iv.scheduledAt) < new Date();

  const handleAction = async (status) => {
    if (busy) return;
    setBusy(true);
    await onAction(iv._id, status);
    setBusy(false);
  };

  return (
    <div className={`iv-card${isPast ? " iv-card--past" : ""}`} data-status={iv.status}>
      {/* Mode icon */}
      <div
        className="iv-mode-icon"
        title={isOnline ? t("interviews.modeOnline") : t("interviews.modeOnsite")}
        style={{ background: `${logoColor}18`, color: logoColor }}
      >
        <ModeIcon size={20} />
      </div>

      {/* Company logo + body */}
      <div className="iv-card-body">
        <div className="iv-card-offer-row">
          <div className="iv-company-logo" style={{ background: logoColor }}>
            {initial}
          </div>
          <div className="iv-card-title-block">
            <h3 className="iv-card-title">
              {iv.applicationId?.offerId?.title || "Offre"}
            </h3>
            <span className="iv-card-company">
              {iv.companyId?.name || iv.applicationId?.offerId?.companyName}
            </span>
          </div>
        </div>

        {/* Date + time */}
        <div className="iv-card-meta">
          <span className="iv-meta-item">
            <FiCalendar size={12} />
            {formatDate(iv.scheduledAt)}
          </span>
          <span className="iv-meta-item">
            <FiClock size={12} />
            {formatTime(iv.scheduledAt)}
          </span>
          <span
            className="iv-mode-chip"
            style={{ background: `${logoColor}14`, color: logoColor }}
          >
            <ModeIcon size={10} />
            {isOnline ? t("interviews.modeOnline") : t("interviews.modeOnsite")}
          </span>
        </div>

        {/* Location / link */}
        {iv.location && (
          <div className="iv-card-location">
            {isJoinable ? (
              <a href={iv.location} target="_blank" rel="noreferrer" className="iv-join-link">
                <FiExternalLink size={12} />
                {t("interviews.joinLink")}
              </a>
            ) : isOnline ? (
              <span className="iv-location-text">
                <FiVideo size={12} />
                {t("interviews.modeOnline")}
              </span>
            ) : (
              <span className="iv-location-text">
                <FiMapPin size={12} />
                {iv.location}
              </span>
            )}
          </div>
        )}

        {/* Notes */}
        {iv.notes && (
          <div className="iv-notes">
            <FiMessageSquare size={11} />
            <span>{iv.notes}</span>
          </div>
        )}
      </div>

      {/* Right: status + countdown + actions */}
      <div className="iv-card-right">
        {/* Status badge */}
        <div
          className="iv-status-badge"
          style={{ background: conf.bg, color: conf.color }}
        >
          <StatusIcon size={11} />
          {t(`status.${iv.status}`)}
        </div>

        {/* Countdown */}
        {countdown && iv.status !== "annulé" && iv.status !== "terminé" && (
          <div className={`iv-countdown${countdown === t("interviews.countdownToday") ? " iv-countdown--today" : ""}`}>
            {countdown}
          </div>
        )}

        {/* Actions for "proposé" */}
        {iv.status === "proposé" && (
          <div className="iv-actions">
            <button
              type="button"
              className="iv-btn iv-btn--confirm"
              onClick={() => handleAction("confirmé")}
              disabled={busy}
            >
              {busy ? <span className="iv-spinner" /> : <FiCheck size={13} />}
              {t("interviews.confirm")}
            </button>
            <button
              type="button"
              className="iv-btn iv-btn--decline"
              onClick={() => handleAction("annulé")}
              disabled={busy}
            >
              <FiX size={13} />
              {t("interviews.decline")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── EmptyState ───────────────────────────────────── */
function EmptyState({ hasFilter, t }) {
  return (
    <div className="iv-empty">
      <div className="iv-empty-icon">
        <FiCalendar size={36} />
      </div>
      <h3 className="iv-empty-title">
        {hasFilter ? t("interviews.emptyFilterDesc") : t("interviews.emptyTitle")}
      </h3>
      {!hasFilter && (
        <p className="iv-empty-desc">{t("interviews.emptyDesc")}</p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════ */
export default function Interviews() {
  const { t } = useTranslation();

  const [interviews,   setInterviews]  = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(() => {
    interviewsService.getAll()
      .then(({ data }) => setInterviews(data.interviews || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  /* optimistic update: change local state first, revert on error */
  const handleAction = useCallback(async (id, status) => {
    setInterviews((prev) =>
      prev.map((iv) => iv._id === id ? { ...iv, status } : iv)
    );
    try {
      await interviewsService.updateStatus(id, status);
    } catch {
      load();
    }
  }, [load]);

  /* stats */
  const stats = useMemo(() => {
    const upcoming = interviews.filter(
      (iv) => (iv.status === "proposé" || iv.status === "confirmé") && new Date(iv.scheduledAt) >= new Date()
    ).length;
    return {
      total:     interviews.length,
      upcoming,
      confirmed: interviews.filter((iv) => iv.status === "confirmé").length,
      cancelled: interviews.filter((iv) => iv.status === "annulé").length,
      done:      interviews.filter((iv) => iv.status === "terminé").length,
    };
  }, [interviews]);

  /* filter */
  const filtered = useMemo(() => {
    if (statusFilter === "all") return interviews;
    if (statusFilter === "upcoming") {
      return interviews.filter(
        (iv) => (iv.status === "proposé" || iv.status === "confirmé") && new Date(iv.scheduledAt) >= new Date()
      );
    }
    return interviews.filter((iv) => iv.status === statusFilter);
  }, [interviews, statusFilter]);

  /* group */
  const grouped = useMemo(() => {
    const groups = { today: [], thisWeek: [], later: [], past: [] };
    filtered.forEach((iv) => {
      groups[getGroup(iv.scheduledAt)].push(iv);
    });
    // Sort each group
    groups.today.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    groups.thisWeek.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    groups.later.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    groups.past.sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));
    return groups;
  }, [filtered]);

  const subtitle = loading
    ? ""
    : `${interviews.length} entretien${interviews.length !== 1 ? "s" : ""}`;

  const GROUP_LABELS = {
    today:    t("interviews.groupToday"),
    thisWeek: t("interviews.groupThisWeek"),
    later:    t("interviews.groupLater"),
    past:     t("interviews.groupPast"),
  };

  const hasFilter    = statusFilter !== "all";
  const totalVisible = filtered.length;

  return (
    <DashboardLayout title={t("interviews.title")} subtitle={subtitle}>
      <div className="iv-page">

        {/* ── Stats ── */}
        <div className="iv-stats">
          <StatCard value={loading ? "—" : stats.total}     label={t("interviews.statTotal")}     icon={FiActivity}     dotColor="#6366F1" />
          <StatCard value={loading ? "—" : stats.upcoming}  label={t("interviews.statUpcoming")}  icon={FiAlertCircle}  dotColor="#F59E0B" />
          <StatCard value={loading ? "—" : stats.confirmed} label={t("interviews.statConfirmed")} icon={FiCheckCircle}  dotColor="#10B981" />
          <StatCard value={loading ? "—" : stats.cancelled} label={t("interviews.statCancelled")} icon={FiXCircle}      dotColor="#EF4444" />
          <StatCard value={loading ? "—" : stats.done}      label={t("interviews.statDone")}      icon={FiAward}        dotColor="#8B5CF6" />
        </div>

        {/* ── Filter tabs ── */}
        <div className="iv-filter-tabs">
          {FILTER_TABS.map(({ key, labelKey, statKey }) => {
            const count = statKey ? stats[statKey] : stats.total;
            return (
              <button
                key={key}
                type="button"
                className={`iv-filter-tab${statusFilter === key ? " iv-filter-tab--active" : ""}`}
                onClick={() => setStatusFilter(key)}
              >
                {t(`interviews.${labelKey}`)}
                <span className="iv-filter-count">{loading ? "—" : count}</span>
              </button>
            );
          })}
        </div>

        {/* ── List ── */}
        {loading ? (
          <div className="iv-list">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : totalVisible === 0 ? (
          <EmptyState hasFilter={hasFilter} t={t} />
        ) : (
          <div className="iv-grouped-list">
            {GROUP_ORDER.map((groupKey) => {
              const items = grouped[groupKey];
              if (!items || items.length === 0) return null;
              return (
                <div key={groupKey} className="iv-group">
                  <div className={`iv-group-header${groupKey === "past" ? " iv-group-header--past" : groupKey === "today" ? " iv-group-header--today" : ""}`}>
                    <span className="iv-group-dot" />
                    <span className="iv-group-label">{GROUP_LABELS[groupKey]}</span>
                    <span className="iv-group-count">{items.length}</span>
                  </div>
                  <div className="iv-list">
                    {items.map((iv) => (
                      <InterviewCard
                        key={iv._id}
                        iv={iv}
                        t={t}
                        onAction={handleAction}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
