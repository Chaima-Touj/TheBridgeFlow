import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiMoon, FiSun } from "react-icons/fi";
import { Home, Briefcase, GraduationCap, Info, MessageSquare, Mail } from "lucide-react";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useLang } from "../../context/LangContext.jsx";
import LangFlags from "./LangFlags.jsx";
import AnimatedNavBar, { AnimatedNavBarProbe } from "./AnimatedNavBar.jsx";
import { useAdaptiveNav } from "../../hooks/useAdaptiveNav.js";
import { scrollToSection } from "../../utils/scrollToSection.js";
import "./SiteNavbar.css";

/* Config canonique unique — remplace les 5 copies (une par page) qui
   existaient avant. "to" est TOUJOURS une route réelle (React Router) ;
   "anchorId" marque en plus les items qui ciblent une section de la Landing
   Page : sur "/", ça scrolle sur place ; ailleurs, ça navigue vers "/" puis
   scrolle après montage (voir l'effet "location.state.scrollTo" dans
   LandingPage.jsx, qui reste propre à cette page puisque les sections n'y
   existent que là). */
const NAV_ITEMS = [
  { key: "home",         icon: Home,          to: "/",           anchorId: "hero" },
  { key: "offers",       icon: Briefcase,     to: "/offers" },
  { key: "formations",   icon: GraduationCap, to: "/formations" },
  { key: "about",        icon: Info,          to: "/",           anchorId: "about" },
  { key: "testimonials", icon: MessageSquare, to: "/",           anchorId: "testimonials" },
  { key: "contact",      icon: Mail,          to: "/",           anchorId: "contact" },
];
const ANCHOR_ITEMS = NAV_ITEMS.filter((i) => i.anchorId);

export default function SiteNavbar() {
  const { t }                  = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { lang }                = useLang();
  const location                = useLocation();
  const navigate                = useNavigate();

  const [menuOpen,      setMenuOpen]      = useState(false);
  const [scrollSpyKey,  setScrollSpyKey]  = useState("home");

  const navRef      = useRef(null);
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

          <Link to="/login"    className="btn btn-ghost   lp-btn-sm">{t("nav.signIn")}</Link>
          <Link to="/register" className="btn btn-primary lp-btn-sm">{t("nav.signUp")}</Link>

          <button
            className="fp-hamburger"
            aria-label={t("landing.menuAriaLabel")}
            onClick={() => setMenuOpen((v) => !v)}
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
          <span className="btn btn-ghost   lp-btn-sm">{t("nav.signIn")}</span>
          <span className="btn btn-primary lp-btn-sm">{t("nav.signUp")}</span>
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
            <Link to="/login"    className="btn btn-ghost   lp-btn-sm" onClick={() => setMenuOpen(false)}>{t("nav.signIn")}</Link>
            <Link to="/register" className="btn btn-primary lp-btn-sm" onClick={() => setMenuOpen(false)}>{t("nav.signUp")}</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
