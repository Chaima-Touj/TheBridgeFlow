import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  FiBell, FiChevronDown, FiSun, FiMoon,
  FiUser, FiLogOut, FiMenu, FiSettings,
} from "react-icons/fi";
import { useAuth }  from "../../context/AuthContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import LangFlags    from "../common/LangFlags.jsx";
import NotificationPanel from "./NotificationPanel.jsx";
import "./Topbar.css";

const AVATAR_COLORS = [
  "#4F46E5","#10B981","#F59E0B","#EF4444","#8B5CF6","#0EA5E9","#EC4899",
];

function getAvatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function Topbar({
  title,
  subtitle,
  // eslint-disable-next-line no-unused-vars
  sidebarOpen,
  onSidebarToggle,
  notifications = [],
  unreadCount   = 0,
  onMarkAsRead,
  onMarkAllRead,
  onDelete,
}) {
  const { t }                 = useTranslation();
  const { user, logout }       = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate               = useNavigate();

  const [showNotif, setShowNotif] = useState(false);
  const [showUser,  setShowUser]  = useState(false);

  const notifRef = useRef(null);
  const userRef  = useRef(null);

  /* Ferme tous les dropdowns si clic extérieur */
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (userRef.current  && !userRef.current.contains(e.target))  setShowUser(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getProfileRoute = () => ({
    étudiant: "/dashboard/student/profile",
    admin:    "/dashboard/admin/profile",
  })[user?.role] || "/dashboard/student/profile";

  const handleLogout = () => { logout(); navigate("/login"); };

  const avatarColor = getAvatarColor(user?.name || "");

  return (
    <header className="topbar">

      {/* ── Gauche : hamburger + titre ──────────────────────────────── */}
      <div className="topbar-left">
        {/* Hamburger mobile */}
        <button
          className="topbar-hamburger"
          onClick={onSidebarToggle}
          aria-label={t("topbar.navAriaLabel")}
          title={t("topbar.navTitle")}
        >
          <FiMenu size={18}/>
        </button>

        {title && (
          <div className="topbar-title-group">
            <h1 className="topbar-title">{title}</h1>
            {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
          </div>
        )}
        {/* Narrow phones show the brand mark instead of the (often long,
            personalized) page title — swapped purely via CSS below. Icon-only
            (same mark as the sidebar's collapsed state): the full wordmark
            plus emoji had no room left on ~390px screens once the hamburger,
            language flags and avatar took their share, and got hard-clipped
            by topbar-left's overflow:hidden (e.g. "TheBridgeFlow" → "TheBr"). */}
        <img src="/favicon.png" alt="TheBridgeFlow" className="topbar-mobile-brand" />
      </div>

      {/* ── Droite : actions ─────────────────────────────────────────── */}
      <div className="topbar-right">

        {/* Langue — 3 drapeaux */}
        <LangFlags/>

        {/* Thème */}
        <button className="topbar-icon-btn" onClick={toggleTheme} aria-label={t("landing.themeToggleAriaLabel")} title={theme === "light" ? t("topbar.themeDark") : t("topbar.themeLight")}>
          {theme === "light" ? <FiMoon size={15}/> : <FiSun size={15}/>}
        </button>

        {/* Notifications */}
        <div className="tb-dropdown" ref={notifRef}>
          <button
            className="topbar-icon-btn topbar-bell"
            onClick={() => setShowNotif((v) => !v)}
            aria-label={t("sidebar.student.notifications")}
            title={t("sidebar.student.notifications")}
          >
            <FiBell size={15}/>
            {unreadCount > 0 && (
              <span className="topbar-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          {showNotif && (
            <NotificationPanel
              notifications={notifications}
              onClose={() => setShowNotif(false)}
              onMarkAsRead={onMarkAsRead}
              onMarkAllRead={onMarkAllRead}
              onDelete={onDelete}
            />
          )}
        </div>

        {/* Divider */}
        <div className="topbar-divider"/>

        {/* Utilisateur */}
        <div className="tb-dropdown" ref={userRef}>
          <button className="topbar-user" onClick={() => setShowUser((v) => !v)}>
            <div className="topbar-avatar" style={{ background: avatarColor }}>
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt="" className="topbar-avatar__img"/>
                : (user?.name?.[0]?.toUpperCase() || "U")}
            </div>
            <div className="topbar-user-info">
              <span className="topbar-user-name">{user?.name || t("sidebar.defaultUserName")}</span>
              <span className="topbar-user-role">{t(`sidebar.roles.${user?.role}`) || user?.role}</span>
            </div>
            <FiChevronDown size={11} className={`tb-chevron ${showUser ? "tb-chevron--up" : ""}`}/>
          </button>

          {showUser && (
            <div className="tb-dropdown-menu tb-user-menu">
              <div className="tb-user-menu-header">
                <div className="tb-user-menu-avatar" style={{ background: avatarColor }}>
                  {user?.avatarUrl
                    ? <img src={user.avatarUrl} alt="" className="tb-user-menu-avatar__img"/>
                    : (user?.name?.[0]?.toUpperCase() || "U")}
                </div>
                <div>
                  <div className="tb-user-menu-name">{user?.name}</div>
                  <div className="tb-user-menu-email">{user?.email}</div>
                </div>
              </div>
              <div className="tb-dropdown-sep"/>
              <button
                className="tb-dropdown-item"
                onClick={() => { navigate(getProfileRoute()); setShowUser(false); }}
              >
                <FiUser size={14}/>
                {t("sidebar.student.profile")}
              </button>
              <button
                className="tb-dropdown-item"
                onClick={() => { navigate(getProfileRoute().replace("profile","settings")); setShowUser(false); }}
              >
                <FiSettings size={14}/>
                {t("settings.pageTitle")}
              </button>
              <div className="tb-dropdown-sep"/>
              <button className="tb-dropdown-item tb-dropdown-item--danger" onClick={handleLogout}>
                <FiLogOut size={14}/>
                {t("sidebar.logout")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
