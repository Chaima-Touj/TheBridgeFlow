import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  FiClock, FiMonitor, FiUsers, FiCpu, FiLock, FiTrendingUp, FiMessageCircle,
  FiBookOpen, FiAward, FiTarget, FiSearch, FiArrowRight,
  FiFacebook, FiLinkedin, FiInstagram, FiYoutube,
} from "react-icons/fi";
import { FaChartBar, FaRobot } from "react-icons/fa";
import { SiFlutter, SiSpringboot, SiAngular, SiReact, SiNodedotjs, SiDocker, SiKubernetes } from "react-icons/si";
import { useAuth } from "../context/AuthContext.jsx";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import Loader from "../components/common/Loader.jsx";
import api from "../services/api.js";
import "./FormationsPage.css";

// ─── Icon map (keyed by slug for exact matching) ──────────────────────────────
const ICON_MAP = {
  "fullstack-spring-angular": [
    { Comp: SiSpringboot, color: "#6DB33F" },
    { Comp: SiAngular,    color: "#DD0031" },
  ],
  "mern-stack": [
    { Comp: SiReact,     color: "#61DAFB" },
    { Comp: SiNodedotjs, color: "#339933" },
  ],
  "mobile-flutter": [
    { Comp: SiFlutter,    color: "#54C5F8" },
    { Comp: SiNodedotjs,  color: "#339933" },
    { Comp: SiSpringboot, color: "#6DB33F" },
  ],
  "bi":                [{ Comp: FaChartBar,   color: "#F59E0B" }],
  "devops": [
    { Comp: SiDocker,     color: "#2496ED" },
    { Comp: SiKubernetes, color: "#326CE5" },
  ],
  "ai":                [{ Comp: FaRobot,       color: "#8B5CF6" }],
  "iot":               [{ Comp: FiCpu,         color: "#3B82F6" }],
  "cyber-security":    [{ Comp: FiLock,        color: "#10B981" }],
  "digital-marketing": [{ Comp: FiTrendingUp,  color: "#6366F1" }],
};
const getIconEntry = (slug = "") => ICON_MAP[slug] ?? [{ Comp: SiReact, color: "#61DAFB" }];

// ── Dégradé de bandeau — mappé par slug réel (pas par position dans la
// liste), pour rester correct si l'ordre des formations change. Couleurs
// réutilisées depuis la palette déjà en place (var(--primary), var(--secondary),
// var(--warning)) + #7C3AED, déjà l'accent violet établi ailleurs dans le
// projet (.fp-hero__title, .msb__logo-accent) — pas une couleur inventée. ──
const GRADIENT_MAP = {
  "mobile-flutter":           "linear-gradient(135deg, var(--primary), #06B6D4)",
  "fullstack-spring-angular": "linear-gradient(135deg, #7C3AED, #EC4899)",
  "digital-marketing":        "linear-gradient(135deg, #6366F1, #7C3AED)",
  "bi":                       "linear-gradient(135deg, var(--warning), #FBBF24)",
  "ai":                       "linear-gradient(135deg, #7C3AED, var(--primary))",
  "iot":                      "linear-gradient(135deg, var(--primary), #0EA5E9)",
  "devops":                   "linear-gradient(135deg, var(--primary), #4F46E5)",
  "mern-stack":                "linear-gradient(135deg, #06B6D4, var(--secondary))",
  "cyber-security":            "linear-gradient(135deg, var(--secondary), #06B6D4)",
};
const DEFAULT_GRADIENT = "linear-gradient(135deg, var(--primary), #7C3AED)";
const getGradient = (slug) => GRADIENT_MAP[slug] || DEFAULT_GRADIENT;

// ── Catégorie — classification par domaine réel (slug), affichée dans le
// filtre. Pas un champ DB (le schéma Formation n'a pas de champ "category"),
// mais dérivée de l'identité réelle de chaque formation, pas inventée. ──
const CATEGORY_KEY_MAP = {
  "mobile-flutter":           "categoryMobile",
  "fullstack-spring-angular": "categoryWeb",
  "mern-stack":                "categoryWeb",
  "digital-marketing":        "categoryMarketing",
  "bi":                       "categoryData",
  "ai":                       "categoryAI",
  "iot":                      "categoryIot",
  "devops":                   "categoryDevops",
  "cyber-security":            "categorySecurity",
};

// ─── Subtle entry animation only ─────────────────────────────────────────────
const cardVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" },
  }),
};

const containerVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

function StatCard({ Icon, value, label }) {
  return (
    <div className="frp-stat-card">
      <span className="frp-stat-card__icon"><Icon size={20} /></span>
      <div>
        <div className="frp-stat-card__value">{value}</div>
        <div className="frp-stat-card__label">{label}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const FormationsPage = () => {
  const { t }             = useTranslation();
  const { user }         = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();

  const [formations, setFormations] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [category,   setCategory]   = useState("");
  const [level,      setLevel]      = useState("");

  useEffect(() => {
    let active = true;
    api.get("/formations")
      .then(res => { if (active) setFormations(res.data); })
      .catch(err => console.error("Erreur chargement formations", err))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleEnroll = (formationId) => {
    if (!user) {
      navigate("/login", { state: { from: location.pathname, formationId } });
    } else {
      navigate("/dashboard");
    }
  };

  // "Populaire" — dérivé du champ réel `views` (les 2 formations les plus
  // consultées), pas une position arbitraire ni un champ marketing inventé.
  const popularSlugs = useMemo(() => {
    return [...formations]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 2)
      .map((f) => f.slug);
  }, [formations]);

  const categories = useMemo(() => {
    const keys = [...new Set(formations.map((f) => CATEGORY_KEY_MAP[f.slug]).filter(Boolean))];
    return keys.map((key) => ({ key, label: t(`formations.${key}`) }));
  }, [formations, t]);

  const levels = useMemo(
    () => [...new Set(formations.map((f) => f.level).filter(Boolean))],
    [formations]
  );

  const filteredFormations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return formations.filter((f) => {
      const matchesSearch = !q
        || f.title.toLowerCase().includes(q)
        || (f.description || "").toLowerCase().includes(q);
      const matchesCategory = !category || CATEGORY_KEY_MAP[f.slug] === category;
      const matchesLevel = !level || f.level === level;
      return matchesSearch && matchesCategory && matchesLevel;
    });
  }, [formations, search, category, level]);

  return (
    <div className="fp-page">

      <SiteNavbar />

      {/* ── HERO — spécifique à cette page redesignée (.frp-hero), ne touche
          pas .fp-hero (partagé par 7 autres pages : Aide, Guides, Tarifs,
          mentions légales, CGU, confidentialité, 404). Image de fond réelle
          en mode clair (public/formation-hero-bg.png, même traitement que
          .cp-hero sur /ceremonie), dégradé sombre inchangé en dark mode.
          ────────────────────────────────────────────────────────────────── */}
      <section className="frp-hero">
        <div className="frp-hero__inner">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <span className="frp-hero__badge"><FiBookOpen size={13} /> {t("formations.heroBadge")}</span>
            <h1 className="frp-hero__title">{t("formations.pageTitle")}</h1>
            <p className="frp-hero__subtitle">{t("formations.subtitle")}</p>
            <p className="frp-hero__tagline">{t("formations.tagline")}</p>
          </motion.div>
        </div>
      </section>

      <main className="frp-main">
        {/* ── STATISTIQUES ─────────────────────────────────────────────── */}
        <section className="frp-stats">
          <StatCard Icon={FiBookOpen} value={formations.length || "—"} label={t("formations.statFormations")} />
          <StatCard Icon={FiAward}    value={t("formations.statExpertsValue")} label={t("formations.statExpertsLabel")} />
          <StatCard Icon={FiUsers}    value={t("formations.statSupportValue")} label={t("formations.statSupportLabel")} />
          <StatCard Icon={FiTarget}   value={t("formations.statPracticalValue")} label={t("formations.statPracticalLabel")} />
        </section>

        {/* ── EN-TÊTE CATALOGUE + TOOLBAR ─────────────────────────────────── */}
        <div className="frp-catalog-heading">
          <span className="frp-section-badge">{t("formations.catalogBadge")}</span>
          <h2>{t("formations.catalogTitle")}</h2>
          <p>{t("formations.catalogSub")}</p>
        </div>

        <div className="frp-toolbar">
          <div className="frp-search">
            <FiSearch size={16} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("formations.searchPlaceholder")}
            />
          </div>
          {categories.length > 0 && (
            <select className="frp-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{t("formations.allCategories")}</option>
              {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          )}
          {levels.length > 0 && (
            <select className="frp-select" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">{t("formations.allLevels")}</option>
              {levels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
        </div>

        {/* ── GRID ────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="fp-loader">
            <Loader size="lg" label={t("formations.loading")} />
          </div>
        ) : formations.length === 0 ? (
          <p className="fp-empty">{t("formations.empty")}</p>
        ) : filteredFormations.length === 0 ? (
          <p className="fp-empty">{t("formations.noResults")}</p>
        ) : (
          <motion.div
            className="fp-grid"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {filteredFormations.map((f, index) => {
              const icons = getIconEntry(f.slug);
              const isPopular = popularSlugs.includes(f.slug);
              return (
                <motion.article
                  key={f._id}
                  custom={index}
                  variants={cardVariants}
                  className="fp-card"
                >
                  {/* Bandeau coloré — icônes de la formation + badge "Populaire" */}
                  <div className="frp-card__banner" style={{ background: getGradient(f.slug) }}>
                    <div className="frp-card__banner-icons">
                      {icons.map(({ Comp: Ic, color: c }, i) => (
                        <span key={i} className="frp-card__banner-icon">
                          <Ic size={20} color={c} />
                        </span>
                      ))}
                    </div>
                    {isPopular && (
                      <span className="frp-card__ribbon">
                        <FiTrendingUp size={11} /> {t("formations.popularBadge")}
                      </span>
                    )}
                  </div>

                  <div className="fp-card__body">
                    {/* Title */}
                    <h2 className="fp-card__title">{f.title}</h2>

                    {/* Description */}
                    <p className="fp-card__desc">
                      {f.description || t("formations.subtitle")}
                    </p>

                    {/* Meta chips */}
                    <div className="fp-card__meta">
                      <span className="fp-chip">
                        <FiClock size={12} />
                        {f.duration}
                      </span>
                      <span className="fp-chip">
                        <FiUsers size={12} />
                        {t("formations.onsite")} {f.price.onsite}
                      </span>
                      <span className="fp-chip">
                        <FiMonitor size={12} />
                        {t("formations.online")} {f.price.online}
                      </span>
                    </div>

                    {/* Curriculum accordion */}
                    {f.weeks?.length > 0 && (
                      <details className="fp-details">
                        <summary>{t("formations.viewProgram")} <FiArrowRight size={13} className="frp-details__arrow" /></summary>
                        <ul className="fp-weeks">
                          {f.weeks.map((w, idx) => (
                            <li key={idx}>
                              <span className="fp-week-badge">
                                {t("formations.week")} {w.week}
                              </span>
                              <span className="fp-week-text">{w.content}</span>
                            </li>
                          ))}
                        </ul>
                        {Array.isArray(f.supervision) && f.supervision.length > 0 && (
                          <p className="fp-supervision">
                            <strong>{t("formations.supervision")} :</strong>{" "}
                            {f.supervision.length} session{f.supervision.length > 1 ? "s" : ""} d'encadrement
                          </p>
                        )}
                      </details>
                    )}

                    {/* Actions */}
                    <div className="fp-card__actions">
                      <Link to={`/formations/${f.slug}`} className="fp-card__details">
                        {t("formations.viewDetails")}
                      </Link>
                      <button
                        className="fp-card__cta"
                        onClick={() => handleEnroll(f._id)}
                      >
                        {user ? t("formations.enroll") : t("formations.loginToEnroll")}
                      </button>
                      <a
                        href={`https://wa.me/21658840064?text=${encodeURIComponent(
                          `Bonjour 👋 Je suis intéressé(e) par la formation ${f.title}.\nJ'aimerais savoir :\n- En quoi consiste exactement cette formation ?\n- Comment puis-je m'inscrire ?\n- Quel est le tarif et la durée ?`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="fp-card__whatsapp"
                        aria-label={t("formationDetail.whatsapp")}
                      >
                        <FiMessageCircle size={16} />
                      </a>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        )}

        {/* ── CTA FINAL ───────────────────────────────────────────────────
            Adapté au contexte (spec: "Explorer toutes les formations", mais
            on est déjà sur le catalogue complet — lien circulaire). Pointe
            vers l'inscription à la place, cohérent avec le CTA hero de la
            Landing Page (ctaStart → /register). ────────────────────────── */}
        {!loading && formations.length > 0 && (
          <div className="frp-cta">
            <div className="frp-cta__icon"><FiTrendingUp size={22} /></div>
            <div className="frp-cta__text">
              <h3>{t("formations.ctaTitle")}</h3>
              <p>{t("formations.ctaSub")}</p>
            </div>
            <Link to="/register" className="frp-cta__btn">
              {t("formations.ctaButton")} <FiArrowRight size={16} />
            </Link>
          </div>
        )}
      </main>

      {/* ── FOOTER — même pattern que Cérémonie (.cp-footer), propre à cette
          page (pas de composant Footer partagé dans le projet). ────────── */}
      <footer className="frp-footer">
        <div className="frp-footer__inner">
          <div className="frp-footer__brand">
            <img src="/favicon.png" alt="Logo" className="frp-footer__logo" />
            <span className="frp-footer__name">TheBridgeFlow</span>
          </div>
          <p className="frp-footer__tagline">Innovation • Collaboration • Impact</p>

          <nav className="frp-footer__nav">
            <Link to="/">{t("nav.home")}</Link>
            <Link to="/offers">{t("nav.offers")}</Link>
            <Link to="/formations">{t("nav.formations")}</Link>
            <Link to="/ceremonie">{t("nav.ceremony")}</Link>
            <a href="/#about">{t("nav.about")}</a>
            <a href="/#contact">{t("nav.contact")}</a>
          </nav>

          <div className="frp-footer__socials">
            <a href="https://www.facebook.com/9antra.tn" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><FiFacebook size={16} /></a>
            <a href="https://www.linkedin.com/company/9antra-tn-the-bridge/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><FiLinkedin size={16} /></a>
            <a href="https://www.instagram.com/9antra.tn_the_bridge/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><FiInstagram size={16} /></a>
            <a href="https://www.youtube.com/@9antra.tn_the_bridge" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><FiYoutube size={16} /></a>
          </div>

          <div className="frp-footer__bottom">© 2026 TheBridgeFlow. {t("landing.copyright")}.</div>
        </div>
      </footer>
    </div>
  );
};

export default FormationsPage;
