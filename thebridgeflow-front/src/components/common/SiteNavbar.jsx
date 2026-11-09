import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiMoon, FiSun } from "react-icons/fi";
import { Home, Briefcase, Info, MessageSquare, Mail, CalendarDays, Newspaper, BadgeDollarSign, Code2 } from "lucide-react";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useLang } from "../../context/langContext.js";
import { useAuth } from "../../context/AuthContext.jsx";
import LangFlags from "./LangFlags.jsx";
import AnimatedNavBar, { AnimatedNavBarProbe } from "./AnimatedNavBar.jsx";
import { useAdaptiveNav } from "../../hooks/useAdaptiveNav.js";
import { scrollToSection } from "../../utils/scrollToSection.js";
import "./SiteNavbar.css";

/* Config canonique unique de navigation. Les entrées publiques principales
   ont chacune une route réelle afin que les liens soient aussi accessibles
   après actualisation ou ouverture directe de leur URL. */
const NAV_ITEMS = [
  { key: "home",         icon: Home,          to: "/",           anchorId: "hero" },
  { key: "pfePack",      icon: Code2,         to: "/pack-pfe" },
  { key: "offers",       icon: Briefcase,     to: "/offers" },
  { key: "events",       icon: CalendarDays,  to: "/events" },
  { key: "pricing",      icon: BadgeDollarSign,to: "/tarifs" },
  { key: "testimonials", icon: MessageSquare, to: "/testimonials" },
  { key: "news",         icon: Newspaper,     to: "/blog" },
  { key: "about",        icon: Info,          to: "/about" },
  { key: "contact",      icon: Mail,          to: "/contact" },
];
const ANCHOR_ITEMS = NAV_ITEMS.filter((i) => i.anchorId);
const AVATAR_COLORS = [
  "#4F46E5", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#0EA5E9", "#EC4899",
];

function getAvatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function SiteNavbar() {
  const { t }                  = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { lang }                = useLang();
  const { user, logout }        = useAuth();
  const location                = useLocation();
  const navigate                = useNavigate();

  const [menuOpen,      setMenuOpen]      = useState(false);
  const [userMenuOpen,  setUserMenuOpen]  = useState(false);
  const [scrollSpyKey,  setScrollSpyKey]  = useState("home");
  const navRef      = useRef(null);
  const userMenuRef = useRef(null);
  const navInnerRef = useRef(null);
  const navProbeRef = useRef(null);
  const navCollapsed = useAdaptiveNav(navInnerRef, navProbeRef, [lang]);

  const onLanding = location.pathname === "/";

  const navItems = useMemo(
    () => NAV_ITEMS.map((item) => ({ ...item, label: t(`nav.${item.key}`) })),
    [t]
  );

  /* Scroll-spy : uniquement pertinent sur la Landing Page elle-même — les
     sections observées (hero/about/testimonials/contact) n'existent nulle
     part ailleurs. Sur les autres pages, l'onglet actif est déterminé plus
     bas par la route réelle (useLocation), pas par ce scroll-spy. */
  useEffect(() => {
    if (!onLanding) return undefined;
    const sections = ANCHOR_ITEMS
      .map((item) => document.getElementById(item.anchorId))
      .filter(Boolean);
    if (sections.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length === 0) return;
        const match = ANCHOR_ITEMS.find((item) => item.anchorId === visible[0].target.id);
        if (match) setScrollSpyKey(match.key);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [onLanding]);

  /* Onglet actif : scroll-spy sur la Landing Page, sinon la route réelle
     (préfixe de pathname — couvre aussi /offers/:id et /formations/:slug). */
  const activeKey = onLanding
    ? scrollSpyKey
    : NAV_ITEMS.find((item) => item.to !== "/" && location.pathname.startsWith(item.to))?.key ?? null;

  /* Mobile nav menu: outside-click to close + body scroll lock while open */
  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const onClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [userMenuOpen]);

  const handleAnchorClick = (item, e) => {
    e.preventDefault();
    if (onLanding) {
      setScrollSpyKey(item.key); // retour visuel immédiat, avant même le scroll
      scrollToSection(item.anchorId);
    } else {
      navigate(item.to, { state: { scrollTo: item.anchorId } });
    }
    setMenuOpen(false);
  };

  const dashboardRoute = user?.role === "admin" ? "/dashboard/admin" : "/dashboard/student";
  const avatarColor = getAvatarColor(user?.name || "");
  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    setMenuOpen(false);
    navigate("/");
  };

  const userMenu = user && (
    <div className="lp-user-menu-wrapper" ref={userMenuRef}>
      <button
        type="button"
        className="lp-user-avatar"
        style={{ background: avatarColor }}
        onClick={() => setUserMenuOpen((v) => !v)}
        aria-label={user.name || "Utilisateur"}
        aria-expanded={userMenuOpen}
      >
        {user.avatarUrl
          ? <img src={user.avatarUrl} alt="" className="lp-user-avatar__img" />
          : (user.name?.[0]?.toUpperCase() || "U")}
      </button>
      {userMenuOpen && (
        <div className="lp-user-dropdown">
          <div className="lp-user-dropdown__identity">
            <strong>{user.name}</strong>
            {user.email && <span>{user.email}</span>}
          </div>
          <Link to={dashboardRoute} onClick={() => setUserMenuOpen(false)}>
            {t(user.role === "admin" ? "dashboard.admin.title" : "dashboard.student.title")}
          </Link>
          <button type="button" onClick={handleLogout}>
            {t("sidebar.logout")}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <nav className={`lp-nav${navCollapsed ? " lp-nav--collapsed" : ""}`} ref={navRef}>
      <div className="lp-nav__inner" ref={navInnerRef}>
        <Link to="/" className="lp-nav__logo">
          <img src="/favicon.png" alt="Logo" className="lp-nav__logo-icon" />
          <span>TheBridge<span className="lp-accent">Flow</span></span>
        </Link>

        <div className="lp-nav__links">
          <AnimatedNavBar items={navItems} activeKey={activeKey} onAnchorClick={handleAnchorClick} />
        </div>

        <div className="lp-nav__actions">
          <LangFlags/>

          <button onClick={toggleTheme} className="lp-theme-btn" aria-label={t("landing.themeToggleAriaLabel")}>
            {theme === "light" ? <FiMoon size={16} /> : <FiSun size={16} />}
          </button>

          {user ? (menuOpen ? null : userMenu) : (
            <>
              <Link to="/login"    className="btn btn-ghost   lp-btn-sm">{t("nav.signIn")}</Link>
              <Link to="/register" className="btn btn-primary lp-btn-sm">{t("nav.signUp")}</Link>
            </>
          )}

          <button
            className="fp-hamburger"
            aria-label={t("landing.menuAriaLabel")}
            aria-expanded={menuOpen}
            onClick={() => {
              setUserMenuOpen(false);
              setMenuOpen((v) => !v);
            }}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {/* Off-screen probe: an exact, unwrapped copy of the row above, used only
          to measure the width the desktop nav would need. Invisible (not
          display:none, so it still lays out) and inert — see useAdaptiveNav. */}
      <div className="lp-nav__probe" ref={navProbeRef} aria-hidden="true">
        <span className="lp-nav__logo">
          <img src="/favicon.png" alt="Logo" className="lp-nav__logo-icon" />
          <span>TheBridge<span className="lp-accent">Flow</span></span>
        </span>
        <div className="lp-nav__links">
          <AnimatedNavBarProbe items={navItems} />
        </div>
        <div className="lp-nav__actions">
          <LangFlags/>
          <span className="lp-theme-btn">{theme === "light" ? <FiMoon size={16} /> : <FiSun size={16} />}</span>
          {user
            ? <span className="lp-user-avatar lp-user-avatar--probe" style={{ background: avatarColor }}>{user.name?.[0]?.toUpperCase() || "U"}</span>
            : <>
                <span className="btn btn-ghost   lp-btn-sm">{t("nav.signIn")}</span>
                <span className="btn btn-primary lp-btn-sm">{t("nav.signUp")}</span>
              </>}
        </div>
      </div>

      {menuOpen && (
        <div className="fp-mobile-menu">
          {navItems.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className="fp-mobile-link"
              onClick={item.anchorId ? (e) => handleAnchorClick(item, e) : () => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="fp-mobile-actions">
            {user ? userMenu : (
              <>
                <Link to="/login"    className="btn btn-ghost   lp-btn-sm" onClick={() => setMenuOpen(false)}>{t("nav.signIn")}</Link>
                <Link to="/register" className="btn btn-primary lp-btn-sm" onClick={() => setMenuOpen(false)}>{t("nav.signUp")}</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
