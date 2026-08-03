// src/pages/notifications/NotificationsPage.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation }          from "react-i18next";
import {
  FiBell, FiSearch, FiX, FiTrash2, FiCheckCircle,
  FiAlertTriangle, FiInfo, FiXCircle, FiCheck,
  FiZap, FiCalendar, FiMessageSquare, FiAward,
} from "react-icons/fi";
import DashboardLayout              from "../../components/layout/DashboardLayout.jsx";
import { notificationsService }     from "../../services/notifications.service.js";
import "./NotificationsPage.css";

/* ── helpers ──────────────────────────────────────── */
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "À l'instant";
  if (mins  < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days  === 1) return "Hier";
  if (days  < 7)  return `Il y a ${days} j.`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

const startOfDay = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
const startOfWeek = () => startOfDay() - 6 * 86400000;

function getGroup(iso) {
  const t = new Date(iso).getTime();
  if (t >= startOfDay())  return "today";
  if (t >= startOfWeek()) return "thisWeek";
  return "older";
}

const isToday    = (iso) => new Date(iso).getTime() >= startOfDay();
const isThisWeek = (iso) => new Date(iso).getTime() >= startOfWeek();

const PAGE_SIZE = 50;

/* ── Type config ──────────────────────────────────── */
const TYPE_CONFIG = {
  success: { bg: "rgba(16,185,129,0.10)", color: "#059669", Icon: FiCheckCircle  },
  warning: { bg: "rgba(245,158,11,0.10)", color: "#D97706", Icon: FiAlertTriangle },
  error:   { bg: "rgba(239,68,68,0.10)",  color: "#DC2626", Icon: FiXCircle      },
  info:    { bg: "rgba(37,99,235,0.10)",  color: "#2563EB", Icon: FiInfo         },
};

/* smart icon: try to pick a richer icon from the title keywords */
function getSmartIcon(n) {
  const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
  const title = (n.title || "").toLowerCase();
  if (title.includes("entretien") || title.includes("interview")) return { ...cfg, Icon: FiCalendar };
  if (title.includes("message"))                                   return { ...cfg, Icon: FiMessageSquare };
  if (title.includes("acceptée") || title.includes("félicitation"))return { ...cfg, Icon: FiAward };
  if (title.includes("candidature"))                               return { ...cfg, Icon: FiZap };
  return cfg;
}

/* ── Skeleton card ────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="notif-card notif-card--skel">
      <div className="notif-skel notif-skel-icon" />
      <div className="notif-card-body">
        <div className="notif-skel" style={{ height: 16, width: "45%", marginBottom: 8 }} />
        <div className="notif-skel" style={{ height: 13, width: "70%", marginBottom: 8 }} />
        <div className="notif-skel" style={{ height: 11, width: "25%" }} />
      </div>
    </div>
  );
}

/* ── Stat card ────────────────────────────────────── */
function StatCard({ value, label, icon: Icon, color }) {
  return (
    <div className="notif-stat">
      <div className="notif-stat-icon" style={{ background: `${color}18`, color }}>
        <Icon size={18} />
      </div>
      <div>
        <div className="notif-stat-value">{value}</div>
        <div className="notif-stat-label">{label}</div>
      </div>
    </div>
  );
}

/* ── Notification card ────────────────────────────── */
function NotifCard({ n, t, onMarkRead, onDelete }) {
  const [removing, setRemoving] = useState(false);
  const cfg = getSmartIcon(n);

  const handleDelete = async (e) => {
    e.stopPropagation();
    setRemoving(true);
    await onDelete(n._id);
  };

  const handleClick = () => {
    if (!n.isRead) onMarkRead(n._id);
  };

  return (
    <div
      className={`notif-card${!n.isRead ? " notif-card--unread" : ""}${removing ? " notif-card--removing" : ""}`}
      onClick={handleClick}
      role={!n.isRead ? "button" : undefined}
      tabIndex={!n.isRead ? 0 : undefined}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      aria-label={!n.isRead ? t("notifications.markReadLabel") : undefined}
    >
      {/* Type icon */}
      <div className="notif-icon" style={{ background: cfg.bg, color: cfg.color }}>
        <cfg.Icon size={16} />
      </div>

      {/* Body */}
      <div className="notif-card-body">
        <div className="notif-card-header-row">
          <span className={`notif-card-title${!n.isRead ? " notif-card-title--bold" : ""}`}>
            {n.title}
          </span>
          {!n.isRead && (
            <span className="notif-unread-badge">{t("notifications.unreadBadge")}</span>
          )}
        </div>
        <p className="notif-card-msg">{n.message}</p>
        <div className="notif-card-footer">
          <span className="notif-card-time">{timeAgo(n.createdAt)}</span>
          {n.link && (
            <a
              href={n.link}
              className="notif-card-link"
              onClick={(e) => e.stopPropagation()}
            >
              {t("notifications.viewLink")} →
            </a>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="notif-card-actions">
        {!n.isRead && (
          <button
            type="button"
            className="notif-action-btn notif-action-btn--read"
            onClick={(e) => { e.stopPropagation(); onMarkRead(n._id); }}
            title={t("notifications.markReadLabel")}
            aria-label={t("notifications.markReadLabel")}
          >
            <FiCheck size={13} />
          </button>
        )}
        <button
          type="button"
          className="notif-action-btn notif-action-btn--del"
          onClick={handleDelete}
          title={t("notifications.deleteLabel")}
          aria-label={t("notifications.deleteLabel")}
        >
          <FiTrash2 size={13} />
        </button>
      </div>
    </div>
  );
}

/* ── Empty state ──────────────────────────────────── */
function EmptyState({ hasFilter, t }) {
  return (
    <div className="notif-empty">
      <div className="notif-empty-icon">
        <FiBell size={36} />
      </div>
      <h3 className="notif-empty-title">
        {hasFilter ? t("notifications.emptyFilterTitle") : t("notifications.emptyTitle")}
      </h3>
      <p className="notif-empty-desc">
        {hasFilter ? t("notifications.emptyFilterDesc") : t("notifications.emptyDesc")}
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════ */
export default function NotificationsPage() {
  const { t } = useTranslation();

  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [readFilter,    setReadFilter]    = useState("all"); // "all" | "unread" | "read"
  const [markingAll,    setMarkingAll]    = useState(false);
  const [page,          setPage]          = useState(1);
  const [totalCount,    setTotalCount]    = useState(0);
  const [loadingMore,   setLoadingMore]   = useState(false);

  /* load — first page */
  useEffect(() => {
    notificationsService.getAll({ page: 1, limit: PAGE_SIZE })
      .then(({ data }) => {
        setNotifications(data.notifications || []);
        setTotalCount(data.total ?? (data.notifications || []).length);
        setPage(1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* load — next page, appended */
  const handleLoadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { data } = await notificationsService.getAll({ page: nextPage, limit: PAGE_SIZE });
      setNotifications((prev) => [...prev, ...(data.notifications || [])]);
      setTotalCount(data.total ?? totalCount);
      setPage(nextPage);
    } catch { /* silent — le bouton reste visible, l'utilisateur peut réessayer */ }
    finally { setLoadingMore(false); }
  }, [page, loadingMore, totalCount]);

  const hasMore = notifications.length < totalCount;

  /* stats — le total reflète toutes les notifications côté serveur ; les
     autres compteurs portent sur les notifications déjà chargées (volume
     réel actuel très faible, ça reste représentatif en pratique). */
  const stats = useMemo(() => ({
    total:   totalCount,
    unread:  notifications.filter((n) => !n.isRead).length,
    today:   notifications.filter((n) => isToday(n.createdAt)).length,
    week:    notifications.filter((n) => isThisWeek(n.createdAt)).length,
  }), [notifications, totalCount]);

  /* filtered */
  const filtered = useMemo(() => {
    let list = notifications;

    if (readFilter === "unread") list = list.filter((n) => !n.isRead);
    if (readFilter === "read")   list = list.filter((n) => n.isRead);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (n) => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
      );
    }

    return list;
  }, [notifications, readFilter, search]);

  /* grouped */
  const grouped = useMemo(() => {
    const groups = { today: [], thisWeek: [], older: [] };
    filtered.forEach((n) => {
      groups[getGroup(n.createdAt)].push(n);
    });
    return groups;
  }, [filtered]);

  /* optimistic handlers */
  const handleMarkRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => n._id === id ? { ...n, isRead: true } : n)
    );
    try { await notificationsService.markAsRead(id); }
    catch { /* revert if needed — not critical */ }
  }, []);

  const handleDelete = useCallback(async (id) => {
    // Small delay to allow exit animation
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
    }, 200);
    try { await notificationsService.delete(id); }
    catch {
      // Revert on error — reload from server
      notificationsService.getAll({ page: 1, limit: PAGE_SIZE }).then(({ data }) => {
        setNotifications(data.notifications || []);
        setTotalCount(data.total ?? (data.notifications || []).length);
        setPage(1);
      }).catch(() => {});
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (stats.unread === 0 || markingAll) return;
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try { await notificationsService.markAllRead(); }
    catch {
      notificationsService.getAll({ page: 1, limit: PAGE_SIZE }).then(({ data }) => {
        setNotifications(data.notifications || []);
        setTotalCount(data.total ?? (data.notifications || []).length);
        setPage(1);
      }).catch(() => {});
    } finally { setMarkingAll(false); }
  }, [stats.unread, markingAll]);

  const GROUP_ORDER = ["today", "thisWeek", "older"];
  const GROUP_LABELS = {
    today:    t("notifications.groupToday"),
    thisWeek: t("notifications.groupThisWeek"),
    older:    t("notifications.groupOlder"),
  };

  const hasFilter = readFilter !== "all" || search.trim() !== "";
  const subtitle  = loading ? "" : t("notifications.subtitle_other", { count: totalCount });

  return (
    <DashboardLayout title={t("notifications.title")} subtitle={subtitle}>
      <div className="notif-page">

        {/* ── Stats ── */}
        <div className="notif-stats">
          <StatCard value={loading ? "—" : stats.total}  label={t("notifications.statTotal")}  icon={FiBell}          color="#6366F1" />
          <StatCard value={loading ? "—" : stats.unread} label={t("notifications.statUnread")} icon={FiZap}           color="#F59E0B" />
          <StatCard value={loading ? "—" : stats.today}  label={t("notifications.statToday")}  icon={FiCalendar}      color="#10B981" />
          <StatCard value={loading ? "—" : stats.week}   label={t("notifications.statWeek")}   icon={FiCheckCircle}   color="#3B82F6" />
        </div>

        {/* ── Toolbar ── */}
        <div className="notif-toolbar">

          {/* Search */}
          <div className="notif-search-wrap">
            <FiSearch size={14} className="notif-search-icon" />
            <input
              type="text"
              className="notif-search"
              placeholder={t("notifications.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="notif-search-clear"
                onClick={() => setSearch("")}
                aria-label={t("common.clearSearch")}
              >
                <FiX size={13} />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="notif-filter-tabs">
            {[
              { key: "all",    labelKey: "filterAll"    },
              { key: "unread", labelKey: "filterUnread" },
              { key: "read",   labelKey: "filterRead"   },
            ].map(({ key, labelKey }) => (
              <button
                key={key}
                type="button"
                className={`notif-filter-tab${readFilter === key ? " notif-filter-tab--active" : ""}`}
                onClick={() => setReadFilter(key)}
              >
                {t(`notifications.${labelKey}`)}
                {key === "unread" && stats.unread > 0 && (
                  <span className="notif-filter-count">{stats.unread}</span>
                )}
              </button>
            ))}
          </div>

          {/* Mark all as read */}
          {stats.unread > 0 && (
            <button
              type="button"
              className="notif-mark-all"
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              <FiCheck size={13} />
              {markingAll ? t("notifications.markingAll") : t("notifications.markAllRead")}
            </button>
          )}
        </div>

        {/* ── Results info ── */}
        {!loading && notifications.length > 0 && (
          <div className="notif-results-row">
            <span className="notif-results-count">
              {filtered.length} / {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
            </span>
            {hasFilter && (
              <button
                type="button"
                className="notif-reset"
                onClick={() => { setSearch(""); setReadFilter("all"); }}
              >
                <FiX size={11} /> Réinitialiser
              </button>
            )}
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div className="notif-list">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasFilter={hasFilter} t={t} />
        ) : (
          <div className="notif-grouped">
            {GROUP_ORDER.map((groupKey) => {
              const items = grouped[groupKey];
              if (!items || items.length === 0) return null;
              return (
                <div key={groupKey} className="notif-group">
                  <div className={`notif-group-header${groupKey === "today" ? " notif-group-header--today" : groupKey === "older" ? " notif-group-header--older" : ""}`}>
                    <span className="notif-group-dot" />
                    <span className="notif-group-label">{GROUP_LABELS[groupKey]}</span>
                    <span className="notif-group-count">{items.length}</span>
                  </div>
                  <div className="notif-list">
                    {items.map((n) => (
                      <NotifCard
                        key={n._id}
                        n={n}
                        t={t}
                        onMarkRead={handleMarkRead}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Charger plus ── */}
        {!loading && !hasFilter && hasMore && (
          <div className="notif-load-more-row">
            <button
              type="button"
              className="notif-load-more"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? t("notifications.loadingMore") : t("notifications.loadMore")}
            </button>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
