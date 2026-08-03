import { useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiHome, FiBriefcase, FiBookOpen, FiCpu, FiFileText,
  FiCalendar, FiMessageSquare, FiBell, FiUser,
  FiSettings, FiLogOut, FiPlus, FiUpload,
  FiUsers, FiPieChart, FiCheckSquare, FiChevronLeft, FiMenu, FiX,
  FiClipboard, FiRss,
} from "react-icons/fi";
import { useAuth } from "../../context/AuthContext.jsx";
import "./Sidebar.css";

/* ─── Structure menus par rôle ────────────────────────────────────────────── */
const MENUS = {
  étudiant: [
    { to: "/dashboard/student",               Icon: FiHome,          labelKey: "sidebar.student.dashboard" },
    { to: "/dashboard/student/offers",        Icon: FiBriefcase,     labelKey: "sidebar.student.offers" },
    { to: "/dashboard/student/applications",  Icon: FiFileText,      labelKey: "sidebar.student.applications" },
    { to: "/dashboard/student/interviews",    Icon: FiCalendar,      labelKey: "sidebar.student.interviews" },
    { to: "/dashboard/student/formations",     Icon: FiBookOpen,      labelKey: "sidebar.student.formations" },
    { to: "/dashboard/student/demandes",      Icon: FiClipboard,     labelKey: "sidebar.student.demandes" },
    { to: "/dashboard/student/ai-assistant",  Icon: FiCpu,           labelKey: "sidebar.student.aiAssistant", badge: "NEW" },
    { to: "/dashboard/student/messages",      Icon: FiMessageSquare, labelKey: "sidebar.student.messages" },
    { to: "/dashboard/student/notifications", Icon: FiBell,          labelKey: "sidebar.student.notifications", badgeKey: "notif" },
  ],
  admin: [
    { to: "/dashboard/admin",              Icon: FiHome,          labelKey: "sidebar.admin.dashboard" },
    { to: "/dashboard/admin/users",        Icon: FiUsers,         labelKey: "sidebar.admin.users" },
    { to: "/dashboard/admin/formations",   Icon: FiBookOpen,      labelKey: "sidebar.admin.formations" },
    { to: "/dashboard/admin/offers",       Icon: FiBriefcase,     labelKey: "sidebar.admin.offers" },
    { to: "/dashboard/admin/news",         Icon: FiRss,           labelKey: "sidebar.admin.news" },
    { to: "/dashboard/admin/messages",     Icon: FiMessageSquare, labelKey: "sidebar.admin.messages" },
    { to: "/dashboard/admin/notifications",Icon: FiBell,          labelKey: "sidebar.admin.notifications", badgeKey: "notif" },
    { to: "/dashboard/admin/candidatures", Icon: FiFileText,      labelKey: "sidebar.admin.candidatures" },
    { to: "/dashboard/admin/demandes",     Icon: FiClipboard,     labelKey: "sidebar.admin.demandes" },
    { to: "/dashboard/admin/inscriptions", Icon: FiCheckSquare,   labelKey: "sidebar.admin.inscriptions" },
    { to: "/dashboard/admin/stats",        Icon: FiPieChart,      labelKey: "sidebar.admin.stats" },
    { to: "/dashboard/admin/settings",     Icon: FiSettings,      labelKey: "sidebar.settings" },
  ],
};

const QUICK_ACTIONS = {
  étudiant: [
    { Icon: FiPlus,    labelKey: "sidebar.student.applications", iconBg: "var(--primary-light)", iconColor: "var(--primary)", to: "/dashboard/student/applications" },
    { Icon: FiUpload,  labelKey: "sidebar.student.documents",    iconBg: "#DCFCE7",              iconColor: "#16A34A",        to: "/dashboard/student/profile" },
    { Icon: FiCalendar,labelKey: "sidebar.student.interviews",   iconBg: "#FEF3C7",              iconColor: "#D97706",        to: "/dashboard/student/interviews" },
  ],
  admin: [
    { Icon: FiPlus,   labelKey: "sidebar.admin.quickNewUser",    iconBg: "var(--primary-light)", iconColor: "var(--primary)", to: "/dashboard/admin/users?new=1" },
    { Icon: FiUpload, labelKey: "sidebar.admin.quickImportData", iconBg: "#DCFCE7",              iconColor: "#16A34A",        to: "/dashboard/admin/users" },
  ],
};

const COMPTE_ROUTES = {
  étudiant: { profile: "/dashboard/student/profile", settings: "/dashboard/student/settings" },
  admin:    { profile: "/dashboard/admin/profile",   settings: "/dashboard/admin/settings" },
};

/* ─── Composant principal ────────────────────────────────────────────────── */
export default function Sidebar({ isOpen, onToggle, onNavigate, unreadNotifCount = 0 }) {
  const { t }           = useTranslation();
  const { user, logout } = useAuth();
  const navigate         = useNavigate();

  const role    = user?.role || "étudiant";
  const rawItems = MENUS[role] || MENUS.étudiant;
  const actions  = QUICK_ACTIONS[role] || QUICK_ACTIONS.étudiant;
  const compte   = COMPTE_ROUTES[role]  || COMPTE_ROUTES.étudiant;

  /* Injecte le badge de notifications réel */
  const items = rawItems.map((item) => {
    if (item.badgeKey === "notif") {
      return {
        ...item,
        badgeLive: unreadNotifCount > 0
          ? (unreadNotifCount > 99 ? "99+" : String(unreadNotifCount))
          : null,
      };
    }
    return item;
  });

  /* Sync localStorage quand isOpen change (depuis Layout) */
  useEffect(() => {
    localStorage.setItem("sb_main", JSON.stringify(isOpen));
  }, [isOpen]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const avatarColor = () => {
    const colors = ["#4F46E5","#10B981","#F59E0B","#EF4444","#8B5CF6","#0EA5E9","#EC4899"];
    const n = user?.name || "";
    let h = 0;
    for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  };

  return (
    <aside className={`msb ${isOpen ? "msb--open" : "msb--closed"}`}>

      {/* ── Header : logo + toggle ──────────────────────────────────────── */}
      <div className="msb__head">
        <Link to="/" className="msb__logo">
          <img src="/favicon.png" alt="Logo" className="msb__logo-ico" />
          {isOpen && (
            <span className="msb__logo-txt">
              TheBridge<span className="msb__logo-accent">Flow</span>
            </span>
          )}
        </Link>
        <button
          className="msb__toggle"
          onClick={onToggle}
          title={isOpen ? t("sidebar.collapse") : t("sidebar.expand")}
          aria-label={t("sidebar.toggleAriaLabel")}
        >
          {isOpen ? (
            <>
              <FiChevronLeft size={16} className="msb__toggle-icon msb__toggle-icon--desktop" />
              <FiX size={18} className="msb__toggle-icon msb__toggle-icon--mobile" />
            </>
          ) : <FiMenu size={16}/>}
        </button>
      </div>

      {/* ── Navigation principale ───────────────────────────────────────── */}
      <nav className="msb__nav" aria-label={t("sidebar.mainNavAriaLabel")}>
        {items.map((item) => {
          const label = item.labelKey ? t(item.labelKey) : item.label;
          const badge = item.badgeLive ?? (item.badge || null);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.split("/").length <= 3}
              title={!isOpen ? label : undefined}
              className={({ isActive }) => `msb__item${isActive ? " msb__item--on" : ""}`}
              onClick={onNavigate}
            >
              <span className="msb__item-ico"><item.Icon size={18}/></span>
              {isOpen && <span className="msb__item-lbl">{label}</span>}
              {badge && isOpen && (
                <span className={`msb__badge ${badge === "NEW" ? "msb__badge--new" : "msb__badge--count"}`}>
                  {badge}
                </span>
              )}
              {badge && !isOpen && (
                <span className="msb__badge msb__badge--dot"/>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Séparateur ──────────────────────────────────────────────────── */}
      {isOpen && <div className="msb__sep"/>}

      {/* ── Actions rapides ─────────────────────────────────────────────── */}
      {isOpen && (
        <div className="msb__section">
          <p className="msb__section-ttl">{t("sidebar.quickActionsHeading")}</p>
          {actions.map((a, i) => {
            const aLabel = a.labelKey ? t(a.labelKey) : a.label;
            return (
              <button key={i} className="msb__action" onClick={() => { navigate(a.to); onNavigate?.(); }} title={aLabel}>
                <span className="msb__action-ico" style={{ background: a.iconBg, color: a.iconColor }}>
                  <a.Icon size={14}/>
                </span>
                <span className="msb__action-lbl">{aLabel}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Spacer (pousse le profil vers le bas) ───────────────────────── */}
      <div className="msb__spacer"/>

      {/* ── Section Compte (lien profil + paramètres) ───────────────────── */}
      {isOpen && (
        <>
          <div className="msb__sep"/>
          <div className="msb__section msb__section--account">
            <p className="msb__section-ttl">{t("sidebar.accountHeading")}</p>
            <NavLink to={compte.profile} className={({ isActive }) => `msb__item${isActive ? " msb__item--on" : ""}`} onClick={onNavigate}>
              <span className="msb__item-ico"><FiUser size={18}/></span>
              <span className="msb__item-lbl">{t("sidebar.student.profile")}</span>
            </NavLink>
            <NavLink to={compte.settings} className={({ isActive }) => `msb__item${isActive ? " msb__item--on" : ""}`} onClick={onNavigate}>
              <span className="msb__item-ico"><FiSettings size={18}/></span>
              <span className="msb__item-lbl">{t("sidebar.settings")}</span>
            </NavLink>
          </div>
        </>
      )}

      {/* ── Profil utilisateur ──────────────────────────────────────────── */}
      {isOpen ? (
        <div className="msb__profile">
          <div className="msb__profile-avatar" style={{ background: avatarColor() }}>
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="msb__profile-avatar__img"/>
              : (user?.name?.[0]?.toUpperCase() || "U")}
          </div>
          <div className="msb__profile-body">
            <span className="msb__profile-name">{user?.name || t("sidebar.defaultUserName")}</span>
            <span className="msb__profile-role">{t(`sidebar.roles.${user?.role}`) || role}</span>
          </div>
          <button className="msb__logout-inline" onClick={handleLogout} title={t("sidebar.logout")}>
            <FiLogOut size={15}/>
          </button>
        </div>
      ) : (
        <div className="msb__profile-mini">
          <div
            className="msb__profile-avatar msb__profile-avatar--sm"
            style={{ background: avatarColor() }}
            title={user?.name}
          >
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="msb__profile-avatar__img"/>
              : (user?.name?.[0]?.toUpperCase() || "U")}
          </div>
          <button className="msb__logout-mini" onClick={handleLogout} title={t("sidebar.logout")}>
            <FiLogOut size={15}/>
          </button>
        </div>
      )}

    </aside>
  );
}
