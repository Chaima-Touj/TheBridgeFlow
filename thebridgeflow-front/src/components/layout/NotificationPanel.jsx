import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FiX, FiCheckCircle, FiAlertTriangle, FiInfo, FiTrash2, FiBell } from "react-icons/fi";
import "./NotificationPanel.css";

const TYPE_CONFIG = {
  success: { Icon: FiCheckCircle, color: "#10B981", bg: "#DCFCE7" },
  warning: { Icon: FiAlertTriangle, color: "#F59E0B", bg: "#FEF9C3" },
  error:   { Icon: FiAlertTriangle, color: "#EF4444", bg: "#FEE2E2" },
  info:    { Icon: FiInfo,         color: "#2563EB", bg: "#DBEAFE" },
};

function timeAgo(dateStr, t) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return t("notificationPanel.timeJustNow");
  if (mins < 60)  return t("notificationPanel.timeMinutesAgo", { count: mins });
  if (hours < 24) return t("notificationPanel.timeHoursAgo", { count: hours });
  if (days < 7)   return t("dashboard.student.daysAgo", { count: days });
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function NotificationPanel({ notifications, onClose, onMarkAsRead, onMarkAllRead, onDelete }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleItemClick = (n) => {
    if (!n.isRead) onMarkAsRead(n._id);
    if (n.link) { navigate(n.link); onClose(); }
  };

  return (
    <div className="np" role="dialog" aria-label={t("sidebar.student.notifications")}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="np__header">
        <div className="np__header-left">
          <h3 className="np__title">{t("sidebar.student.notifications")}</h3>
          {unreadCount > 0 && (
            <span className="np__unread-badge">{unreadCount}</span>
          )}
        </div>
        <div className="np__header-actions">
          {unreadCount > 0 && (
            <button className="np__mark-all" onClick={onMarkAllRead} title={t("notifications.markAllRead")}>
              <FiCheckCircle size={13}/>
              {t("notificationPanel.markAllShort")}
            </button>
          )}
          <button className="np__close" onClick={onClose} aria-label={t("applications.closeModal")}>
            <FiX size={15}/>
          </button>
        </div>
      </div>

      {/* ── Liste ───────────────────────────────────────────────────── */}
      <div className="np__list">
        {notifications.length === 0 ? (
          <div className="np__empty">
            <div className="np__empty-ico"><FiBell size={24}/></div>
            <p className="np__empty-txt">{t("notificationPanel.emptyTitle")}</p>
            <span className="np__empty-sub">{t("notificationPanel.emptySub")}</span>
          </div>
        ) : (
          notifications.map((n) => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
            return (
              <div
                key={n._id}
                className={`np__item ${!n.isRead ? "np__item--unread" : ""}`}
                onClick={() => handleItemClick(n)}
                role="button"
                tabIndex={0}
              >
                <div className="np__item-icon" style={{ background: cfg.bg, color: cfg.color }}>
                  <cfg.Icon size={14}/>
                </div>
                <div className="np__item-body">
                  <div className="np__item-title">{n.title}</div>
                  <div className="np__item-msg">{n.message}</div>
                  <div className="np__item-time">{timeAgo(n.createdAt, t)}</div>
                </div>
                {!n.isRead && <div className="np__item-dot" aria-label={t("messages.unreadBadge")}/>}
                <button
                  className="np__item-del"
                  onClick={(e) => { e.stopPropagation(); onDelete(n._id); }}
                  aria-label={t("notifications.deleteLabel")}
                  title={t("notifications.deleteLabel")}
                >
                  <FiTrash2 size={13}/>
                </button>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
