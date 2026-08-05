import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  FiArrowLeft, FiChevronDown, FiAward, FiClock,
  FiMonitor, FiUsers, FiCheck, FiStar, FiChevronRight, FiPlay,
  FiMessageCircle, FiZap, FiBook, FiTarget, FiShield, FiHelpCircle,
  FiCpu, FiLock, FiTrendingUp, FiVideo, FiSmartphone,
} from "react-icons/fi";
import { FaChartBar, FaRobot } from "react-icons/fa";
import { SiFlutter, SiSpringboot, SiAngular, SiReact, SiNodedotjs, SiDocker, SiKubernetes } from "react-icons/si";
import { useLang } from "../context/LangContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import CoursePreviewModal from "../components/common/CoursePreviewModal.jsx";
import VideoTestimonialCarousel from "../components/common/VideoTestimonialCarousel.jsx";
import TechMarquee from "../components/common/TechMarquee.jsx";
import { formationsService } from "../services/formations.service.js";
import { DEFAULT_THUMB, getWeekThumb } from "../utils/thumbUtils.js";
import { getAllFormationTestimonials } from "../constants/testimonials.js";
import { getTechLogo } from "../constants/techLogos.js";
import { resolveDriveThumbnailProxyUrl } from "../constants/videoUrls.js";
import { buildWhatsAppLink } from "../utils/whatsapp.js";
import "./FormationDetail.css";

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

// ─── Accompaniment features with icons ───────────────────────────────────────
const ACCOMPANIMENT_ICONS = [
  FiUsers, FiZap, FiCheck, FiMessageCircle, FiBook, FiTarget, FiShield,
];
const ACCOMPANIMENT_KEYS = [
  "feat_experts", "feat_coaching", "feat_followup",
  "feat_qa", "feat_exercises", "feat_eval", "feat_support",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function groupWeeksByPhase(weeks = [], t) {
  const groups = new Map();
  weeks.forEach(w => {
    const phase = w.phase?.trim() || t("formationDetail.monthFallback", { n: Math.ceil(w.week / 4) });
    if (!groups.has(phase)) groups.set(phase, []);
    groups.get(phase).push(w);
  });
  return groups;
}


function StarRating({ rating = 5 }) {
  return (
    <div className="fd-stars" aria-label={`${rating}/5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <FiStar
          key={i}
          size={14}
          className={i <= rating ? "fd-star--filled" : "fd-star--empty"}
        />
      ))}
    </div>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function useCounter(target, duration = 1600, active = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active || !target) return;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);
  return count;
}

function StatCounter({ value, suffix = "", label }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const count  = useCounter(value, 1600, inView);
  return (
    <div ref={ref} className="fd-stat">
      <div className="fd-stat__num">{count}{suffix}</div>
      <div className="fd-stat__label">{label}</div>
    </div>
  );
}

// ─── FAQ item ─────────────────────────────────────────────────────────────────
function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`fd-faq-item${open ? " fd-faq-item--open" : ""}`}>
      <button className="fd-faq-q" onClick={() => setOpen(v => !v)}>
        <FiHelpCircle size={16} className="fd-faq-ico" />
        <span>{question}</span>
        <FiChevronDown className="fd-faq-arrow" size={16} />
      </button>
      {open && <div className="fd-faq-a">{answer}</div>}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonHero = () => (
  <div className="fd-hero fd-hero--skeleton" aria-hidden="true">
    <div className="fd-hero__inner">
      <div className="fd-sk-hero">
        <div className="fd-sk fd-sk-badge" />
        <div className="fd-sk fd-sk-title" />
        <div className="fd-sk fd-sk-title fd-sk--short" />
        <div className="fd-sk fd-sk-desc" />
        <div className="fd-sk fd-sk-desc fd-sk--mid" />
        <div className="fd-sk-badges">
          <div className="fd-sk fd-sk-chip" />
          <div className="fd-sk fd-sk-chip" />
          <div className="fd-sk fd-sk-chip" />
          <div className="fd-sk fd-sk-chip" />
        </div>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
const FormationDetail = () => {
  const { slug }               = useParams();
  const { t }                  = useTranslation();
  const { lang } = useLang();
  const { user }               = useAuth();
  const navigate               = useNavigate();
  const location               = useLocation();

  const [formation,    setFormation]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [previewWeek,  setPreviewWeek]  = useState(null);
  const [showTrailerModal, setShowTrailerModal] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchFormation = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await formationsService.getBySlug(slug);
        if (!active) return;
        const f = res.data;
        if (!f?._id) throw new Error(t("formationDetail.notFound"));
        setFormation(f);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message ?? err.message ?? t("formationDetail.error"));
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchFormation();
    return () => { active = false; };
  }, [slug, t]);

  const handleEnroll = useCallback(() => {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
    } else {
      navigate("/dashboard");
    }
  }, [user, navigate, location]);

  // Derived data
  const iconEntries  = formation ? getIconEntry(formation.slug) : [{ Comp: SiReact, color: "#61DAFB" }];
  const weekGroups        = formation ? groupWeeksByPhase(formation.weeks ?? [], t) : new Map();
  const supervisionGroups = formation ? groupWeeksByPhase(formation.supervision ?? [], t) : new Map();
  const features     = formation?.features?.length
    ? formation.features
    : ACCOMPANIMENT_KEYS.map(k => t(`formationDetail.${k}`));
  const hasStats     = formation && Object.values(formation.stats ?? {}).some(v => v > 0);
  const hasFaq       = formation?.faq?.length > 0;
  const hasReviews   = formation?.reviews?.length > 0;
  const sortedWeeks  = [...(formation?.weeks ?? [])].sort((a, b) => a.week - b.week);
  const learnItems   = sortedWeeks.slice(0, 6).map(w => w.content).filter(Boolean);
  const techPills    = (formation?.technologies ?? [])
    .map(slug => ({ slug, logo: getTechLogo(slug) }))
    .filter(t => t.logo);
  const waMessage = formation
    ? `Bonjour 👋 Je suis intéressé(e) par la formation ${formation.title}.\nJ'aimerais savoir :\n- En quoi consiste exactement cette formation ?\n- Comment puis-je m'inscrire ?\n- Quel est le tarif et la durée ?`
    : "";
  // Vignette de l'aside : priorité à trailerThumbnail (image dédiée choisie
  // par l'admin) via le proxy Drive, sinon dérivée de trailerVideoUrl.
  const previewThumb = formation
    ? resolveDriveThumbnailProxyUrl(formation.trailerThumbnail)
      || resolveDriveThumbnailProxyUrl(formation.trailerVideoUrl)
    : null;

  return (
    <div className="fd-page">

      <SiteNavbar />

      {/* ─── SKELETON ────────────────────────────────────────────────────── */}
      {loading && <SkeletonHero />}

      {/* ─── ERROR ───────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="fd-error">
          <p className="fd-error__msg">{error}</p>
          <button className="fd-btn fd-btn--outline" onClick={() => window.location.reload()}>
            {t("formationDetail.retry")}
          </button>
          <Link to="/formations" className="fd-btn fd-btn--ghost">{t("formationDetail.back")}</Link>
        </div>
      )}

      {!loading && !error && formation && (
        <>
          {/* ══════════════════════════════════════════════════════════════
              1. HERO — bande edge-to-edge (dégradé + titre/badges + aside
              prix/vidéo), comme avant la carte englobante (même pattern que
              .lp-hero de la Landing Page : bande pleine largeur + .fd-hero__inner
              centré à l'intérieur).
              NB : .fd-hero / .fd-hero__inner / .fd-hero__left / .fd-price-* /
              .fd-enroll-btn / .fd-whatsapp-btn restent PARTAGÉS avec
              DashboardFormationDetail.jsx (même FormationDetail.css) — réutilisés
              tels quels sans modification. Seule l'aside (structure différente
              du dashboard : pas de titre/icônes/ligne certificat, aperçu vidéo
              optionnel en modale) a des classes dédiées.
          ══════════════════════════════════════════════════════════════ */}
          <section className="fd-hero">
            <div className="fd-hero__blob fd-hero__blob--1" />
            <div className="fd-hero__blob fd-hero__blob--2" />

            <div className="fd-hero__inner">
                  {/* ── LEFT: info ─────────────────────────────────────── */}
                  <motion.div
                    className="fd-hero__left"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <Link to="/formations" className="fd-back">
                      <FiArrowLeft size={15} /> {t("formationDetail.back")}
                    </Link>

                    {/* Icon + badge */}
                    <div className="fd-hero__icon-wrap">
                      {iconEntries.map(({ Comp: Ic, color: c }, i) => (
                        <div
                          key={i}
                          className="fd-hero__icon"
                          style={{
                            background: `${c}22`,
                            color: c,
                            ...(iconEntries.length >= 3 && { width: 48, height: 48 }),
                          }}
                        >
                          <Ic size={iconEntries.length >= 3 ? 22 : 36} />
                        </div>
                      ))}
                      {formation.certificate && (
                        <span className="fd-hero__cert-badge">
                          <FiAward size={13} /> {t("formationDetail.certificateYes")}
                        </span>
                      )}
                    </div>

                    <h1 className="fd-hero__title">{formation.title}</h1>

                    {formation.description && (
                      <p className="fd-hero__desc">{formation.description}</p>
                    )}

                    {/* Meta badges */}
                    <div className="fd-hero__meta">
                      {formation.level && (
                        <span className="fd-hero__badge">
                          <FiTarget size={13} />{t("formationDetail.level")} : {formation.level}
                        </span>
                      )}
                      {formation.duration && (
                        <span className="fd-hero__badge">
                          <FiClock size={13} />{formation.duration}
                        </span>
                      )}
                      {formation.mode && (
                        <span className="fd-hero__badge">
                          <FiMonitor size={13} />{formation.mode}
                        </span>
                      )}
                    </div>
                  </motion.div>

                  {/* ── RIGHT: aside prix ─────────────────────────────── */}
                  <motion.aside
                    className="fd-hero__aside"
                    initial={{ opacity: 0, y: 32 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.12, ease: "easeOut" }}
                  >
                    {/* Aperçu vidéo — uniquement si un trailer réel existe,
                        ouvre le modal plein écran (CoursePreviewModal en mode
                        isTrailer) qui habille l'iframe Drive existant. */}
                    {formation.trailerVideoUrl && (
                      <button
                        type="button"
                        className="fd-hero__preview"
                        style={previewThumb ? { backgroundImage: `url(${previewThumb})` } : undefined}
                        aria-label={t("formationDetail.previewAriaLabel")}
                        onClick={() => setShowTrailerModal(true)}
                      >
                        <span className="fd-hero__preview-play"><FiPlay size={22} /></span>
                        <span className="fd-hero__preview-label">{t("formationDetail.previewLabel")}</span>
                      </button>
                    )}

                    <div className="fd-hero__aside-body">
                      {/* Price rows */}
                      <div className="fd-price-rows">
                        <div className="fd-price-row">
                          <span className="fd-price-row__label">
                            <FiUsers size={14} /> {t("formationDetail.priceOnsite")}
                          </span>
                          <span className="fd-price-row__value">{formation.price?.onsite}</span>
                        </div>
                        <div className="fd-price-row">
                          <span className="fd-price-row__label">
                            <FiMonitor size={14} /> {t("formationDetail.priceOnline")}
                          </span>
                          <span className="fd-price-row__value">{formation.price?.online}</span>
                        </div>
                      </div>

                      {/* CTA — connecté : flux d'inscription réel (handleEnroll
                          navigue vers /dashboard) ; non connecté : /login */}
                      <button className="fd-enroll-btn" onClick={handleEnroll}>
                        {user ? t("formationDetail.enroll") : t("formationDetail.loginToEnroll")}
                      </button>

                      {/* WhatsApp — via l'utilitaire partagé buildWhatsAppLink */}
                      <a
                        href={buildWhatsAppLink(waMessage)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="fd-whatsapp-btn"
                      >
                        <FiMessageCircle size={18} />
                        {t("formationDetail.whatsapp")}
                      </a>
                    </div>
                  </motion.aside>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════
              CONTENT BODY
          ══════════════════════════════════════════════════════════════ */}
          <div className="fd-body">
            <div className="fd-body__inner">

              {/* ── LEFT COLUMN ──────────────────────────────────────── */}
              <div className="fd-body__left">

                {/* ────────────────────────────────────────────────────
                    1. CE QUE VOUS APPRENDREZ / TECHNOLOGIES / CETTE FORMATION
                    COMPREND — sections normales (même gabarit que Programme/
                    Encadrement ci-dessous), fond clair, largeur de contenu
                    standard. La vidéo résumé elle-même se regarde désormais
                    via le modal ouvert depuis la vignette de l'aside (plus
                    de section dédiée pleine largeur).
                ──────────────────────────────────────────────────── */}
                {learnItems.length > 0 && (
                  <section className="fd-section">
                    <h2 className="fd-section__title">{t("formationDetail.whatYouWillLearn")}</h2>
                    <div className="fd-learn-grid">
                      {learnItems.map((item, i) => (
                        <div key={i} className="fd-learn-item">
                          <FiCheck size={15} />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {techPills.length > 0 && (
                  <section className="fd-section">
                    <h2 className="fd-section__title">{t("formationDetail.technologiesTitle")}</h2>
                    <div className="fd-tech-pills">
                      {techPills.map(({ slug, logo }) => (
                        <span key={slug} className="fd-tech-pill">{logo.label}</span>
                      ))}
                    </div>
                  </section>
                )}

                <section className="fd-section">
                  <h2 className="fd-section__title">{t("formationDetail.formationIncludes")}</h2>
                  <div className="fd-includes-grid">
                    {formation.weeks?.length > 0 && (
                      <div className="fd-includes-item">
                        <FiVideo size={16} /><span>{t("formationDetail.includeVideoSessions")}</span>
                      </div>
                    )}
                    <div className="fd-includes-item">
                      <FiSmartphone size={16} /><span>{t("formationDetail.includeMobileDesktop")}</span>
                    </div>
                    {formation.certificate && (
                      <div className="fd-includes-item">
                        <FiAward size={16} /><span>{t("formationDetail.includeCertificate")}</span>
                      </div>
                    )}
                    <div className="fd-includes-item">
                      <FiMessageCircle size={16} /><span>{t("formationDetail.includeCoaching")}</span>
                    </div>
                  </div>
                </section>

                {/* ────────────────────────────────────────────────────
                    2. PROGRAMME / TIMELINE
                ──────────────────────────────────────────────────── */}
                {weekGroups.size > 0 && (
                  <section className="fd-section">
                    <h2 className="fd-section__title">{t("formationDetail.curriculum")}</h2>
                    <p className="fd-section__sub">{t("formationDetail.curriculumSubtitle")}</p>

                    <div className="fd-timeline">
                      {[...weekGroups.entries()].map(([phase, weeks], phaseIdx) => (
                        <motion.div
                          key={phase}
                          className="fd-phase"
                          initial={{ opacity: 0, x: -16 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true, margin: "-60px" }}
                          transition={{ delay: phaseIdx * 0.08, duration: 0.4 }}
                        >
                          <div className="fd-phase__header">
                            <div className="fd-phase__dot" />
                            <h3 className="fd-phase__title">{phase}</h3>
                          </div>
                          <div className="fd-phase__weeks">
                            {weeks.map((w, i) => {
                              const { src: thumbSrc, bg: thumbBg } = getWeekThumb(w, formation);
                              const hasVideo = !!w.videoUrl;
                              return (
                                <div
                                  key={i}
                                  className={`fd-week${hasVideo ? " fd-week--clickable" : ""}`}
                                  onClick={hasVideo ? () => setPreviewWeek(w) : undefined}
                                  role={hasVideo ? "button" : undefined}
                                  tabIndex={hasVideo ? 0 : undefined}
                                  onKeyDown={hasVideo ? (e) => e.key === "Enter" && setPreviewWeek(w) : undefined}
                                >
                                  {hasVideo && (
                                    <div
                                      className={`fd-week__thumb${thumbBg ? " fd-week__thumb--logo" : ""}`}
                                      style={thumbBg ? { backgroundColor: thumbBg } : {}}
                                    >
                                      <img
                                        src={thumbSrc}
                                        alt=""
                                        loading="lazy"
                                        onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_THUMB.src; }}
                                      />
                                      <span className="fd-week__play"><FiPlay size={9} /></span>
                                      {w.duree && <span className="fd-week__dur">{w.duree}</span>}
                                    </div>
                                  )}
                                  <div className="fd-week__text">
                                    <span className="fd-week__badge">
                                      {t("formationDetail.week")} {w.week}
                                    </span>
                                    {w.videoTitle && <span className="fd-week__title">{w.videoTitle}</span>}
                                    <span className="fd-week__content">{w.content}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      ))}
                    </div>

                  </section>
                )}

                {/* ────────────────────────────────────────────────────
                    3. ENCADREMENT
                ──────────────────────────────────────────────────── */}
                {supervisionGroups.size > 0 && (
                  <section className="fd-section">
                    <h2 className="fd-section__title">{t("formationDetail.supervision")}</h2>
                    <p className="fd-section__sub">{t("formationDetail.supervisionSubtitle")}</p>

                    <div className="fd-timeline">
                      {[...supervisionGroups.entries()].map(([phase, weeks], phaseIdx) => (
                        <motion.div
                          key={phase}
                          className="fd-phase"
                          initial={{ opacity: 0, x: -16 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true, margin: "-60px" }}
                          transition={{ delay: phaseIdx * 0.08, duration: 0.4 }}
                        >
                          <div className="fd-phase__header">
                            <div className="fd-phase__dot" />
                            <h3 className="fd-phase__title">{phase}</h3>
                          </div>
                          <div className="fd-phase__weeks">
                            {weeks.map((w, i) => {
                              const { src: thumbSrc, bg: thumbBg } = getWeekThumb(w, formation);
                              const hasVideo = !!w.videoUrl;
                              return (
                                <div
                                  key={i}
                                  className={`fd-week${hasVideo ? " fd-week--clickable" : ""}`}
                                  onClick={hasVideo ? () => setPreviewWeek(w) : undefined}
                                  role={hasVideo ? "button" : undefined}
                                  tabIndex={hasVideo ? 0 : undefined}
                                  onKeyDown={hasVideo ? (e) => e.key === "Enter" && setPreviewWeek(w) : undefined}
                                >
                                  {hasVideo && (
                                    <div
                                      className={`fd-week__thumb${thumbBg ? " fd-week__thumb--logo" : ""}`}
                                      style={thumbBg ? { backgroundColor: thumbBg } : {}}
                                    >
                                      <img
                                        src={thumbSrc}
                                        alt=""
                                        loading="lazy"
                                        onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_THUMB.src; }}
                                      />
                                      <span className="fd-week__play"><FiPlay size={9} /></span>
                                      {w.duree && <span className="fd-week__dur">{w.duree}</span>}
                                    </div>
                                  )}
                                  <div className="fd-week__text">
                                    <span className="fd-week__badge">
                                      {t("formationDetail.week")} {w.week}
                                    </span>
                                    {w.videoTitle && <span className="fd-week__title">{w.videoTitle}</span>}
                                    <span className="fd-week__content">{w.content}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ────────────────────────────────────────────────────
                    4. ACCOMPAGNEMENT
                ──────────────────────────────────────────────────── */}
                <section className="fd-section fd-section--accent">
                  <h2 className="fd-section__title">{t("formationDetail.accompaniment")}</h2>
                  <p className="fd-section__sub">{t("formationDetail.accompanimentSubtitle")}</p>
                  <div className="fd-features">
                    {features.slice(0, 7).map((feat, i) => {
                      const Icon = ACCOMPANIMENT_ICONS[i % ACCOMPANIMENT_ICONS.length];
                      return (
                        <motion.div
                          key={i}
                          className="fd-feature"
                          initial={{ opacity: 0, y: 12 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: "-40px" }}
                          transition={{ delay: i * 0.06, duration: 0.35 }}
                        >
                          <div className="fd-feature__icon">
                            <Icon size={18} />
                          </div>
                          <span className="fd-feature__text">{feat}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                </section>

                {/* ────────────────────────────────────────────────────
                    5. AVIS / REVIEWS
                ──────────────────────────────────────────────────── */}
                {hasReviews && (
                  <section className="fd-section">
                    <h2 className="fd-section__title">{t("formationDetail.reviews")}</h2>
                    <p className="fd-section__sub">{t("formationDetail.reviewsSubtitle")}</p>
                    <div className="fd-reviews">
                      {formation.reviews.map((rev, i) => (
                        <motion.div
                          key={i}
                          className="fd-review"
                          initial={{ opacity: 0, y: 12 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: "-40px" }}
                          transition={{ delay: i * 0.07, duration: 0.35 }}
                        >
                          <div className="fd-review__header">
                            {rev.avatar ? (
                              <img src={rev.avatar} alt={rev.name} className="fd-review__avatar" />
                            ) : (
                              <div className="fd-review__avatar fd-review__avatar--initials">
                                {rev.name?.[0]?.toUpperCase() ?? "?"}
                              </div>
                            )}
                            <div>
                              <div className="fd-review__name">{rev.name}</div>
                              <StarRating rating={rev.rating} />
                            </div>
                            {rev.date && (
                              <span className="fd-review__date">
                                {new Date(rev.date).toLocaleDateString(
                                  lang === "ar" ? "ar-TN" : lang === "en" ? "en-US" : "fr-FR",
                                  { month: "short", year: "numeric" }
                                )}
                              </span>
                            )}
                          </div>
                          {rev.comment && <p className="fd-review__comment">{rev.comment}</p>}
                        </motion.div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ────────────────────────────────────────────────────
                    7. FAQ
                ──────────────────────────────────────────────────── */}
                {hasFaq && (
                  <section className="fd-section">
                    <h2 className="fd-section__title">{t("formationDetail.faq")}</h2>
                    <p className="fd-section__sub">{t("formationDetail.faqSubtitle")}</p>
                    <div className="fd-faq">
                      {formation.faq.map((item, i) => (
                        <FaqItem key={i} question={item.question} answer={item.answer} />
                      ))}
                    </div>
                  </section>
                )}

              </div>{/* /fd-body__left */}

              {/* ── RIGHT STICKY SIDEBAR ─────────────────────────────── */}
              <aside className="fd-body__right">

                {/* Quick enroll card */}
                <div className="fd-sidebar-card fd-sidebar-card--enroll">
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {iconEntries.map(({ Comp: Ic, color: c }, i) => (
                      <div
                        key={i}
                        className="fd-sidebar-icon"
                        style={{
                          background: `${c}22`,
                          color: c,
                          ...(iconEntries.length >= 3 && { width: 34, height: 34 }),
                        }}
                      >
                        <Ic size={iconEntries.length >= 3 ? 15 : 20} />
                      </div>
                    ))}
                  </div>
                  <h3 className="fd-sidebar-title">{formation.title}</h3>

                  <div className="fd-sidebar-prices">
                    <div className="fd-sidebar-price">
                      <span className="fd-sidebar-price__mode">{t("formationDetail.priceOnsite")}</span>
                      <span className="fd-sidebar-price__val">{formation.price?.onsite}</span>
                    </div>
                    <div className="fd-sidebar-price">
                      <span className="fd-sidebar-price__mode">{t("formationDetail.priceOnline")}</span>
                      <span className="fd-sidebar-price__val">{formation.price?.online}</span>
                    </div>
                  </div>

                  <button className="fd-sidebar-enroll" onClick={handleEnroll}>
                    {user ? t("formationDetail.enroll") : t("formationDetail.loginToEnroll")}
                    <FiChevronRight size={15} />
                  </button>

                  <a
                    href={`https://wa.me/21658840064?text=${encodeURIComponent(
                      `Bonjour 👋 Je suis intéressé(e) par la formation ${formation.title}.\nJ'aimerais savoir :\n- En quoi consiste exactement cette formation ?\n- Comment puis-je m'inscrire ?\n- Quel est le tarif et la durée ?`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fd-whatsapp-btn"
                  >
                    <FiMessageCircle size={16} />
                    {t("formationDetail.whatsapp")}
                  </a>

                  <Link to="/formations" className="fd-sidebar-back">{t("formationDetail.back")}</Link>
                </div>

                {/* Info summary */}
                <div className="fd-sidebar-card">
                  <div className="fd-sidebar-info-list">
                    {[
                      { icon: <FiClock size={15} />,   label: t("formationDetail.duration"), val: formation.duration },
                      { icon: <FiTarget size={15} />,  label: t("formationDetail.level"),    val: formation.level },
                      { icon: <FiMonitor size={15} />, label: t("formationDetail.mode"),     val: formation.mode },
                      formation.certificate != null
                        ? { icon: <FiAward size={15} />, label: t("formationDetail.certificate"),
                            val: formation.certificate ? t("formationDetail.certificateYes") : t("formationDetail.certificateNo") }
                        : null,
                    ].filter(Boolean).map((row, i) => (
                      <div key={i} className="fd-sidebar-info-row">
                        <span className="fd-sidebar-info-icon">{row.icon}</span>
                        <span className="fd-sidebar-info-label">{row.label}</span>
                        <span className="fd-sidebar-info-val">{row.val || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </aside>
            </div>{/* /fd-body__inner */}
          </div>{/* /fd-body */}

          {/* ══════════════════════════════════════════════════════════════
              BANDE DE LOGOS TECHS — ne rend rien si formation.technologies est vide
          ══════════════════════════════════════════════════════════════ */}
          <TechMarquee
            technologies={formation.technologies || []}
            title={t("formationDetail.techMarqueeTitle")}
          />

          {/* ══════════════════════════════════════════════════════════════
              6. STATISTICS (full width)
          ══════════════════════════════════════════════════════════════ */}
          {hasStats && (
            <section className="fd-stats-section">
              <div className="fd-stats-inner">
                <h2 className="fd-stats-title">{t("formationDetail.stats")}</h2>
                <div className="fd-stats-grid">
                  <StatCounter
                    value={formation.stats.students}
                    label={t("formationDetail.statsStudents")}
                  />
                  <StatCounter
                    value={formation.stats.successRate}
                    suffix="%"
                    label={t("formationDetail.statsSuccess")}
                  />
                  <StatCounter
                    value={formation.stats.insertionRate}
                    suffix="%"
                    label={t("formationDetail.statsInsertion")}
                  />
                  <StatCounter
                    value={formation.stats.satisfaction}
                    suffix="%"
                    label={t("formationDetail.statsSatisfaction")}
                  />
                </div>
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════
              7. TÉMOIGNAGES VIDÉO (full width) — ne rend rien si vide
          ══════════════════════════════════════════════════════════════ */}
          {/* Pas de CTA ici : la section "8. CTA FINAL" juste en dessous
              (bouton d'inscription réel) suffit — un second CTA redondant
              juste au-dessus créerait une double incitation confuse. */}
          <VideoTestimonialCarousel
            items={getAllFormationTestimonials()}
            title={t("formationDetail.testimonialsTitle")}
            subtitle={t("formationDetail.testimonialsSub")}
          />

          {/* ══════════════════════════════════════════════════════════════
              8. CTA FINAL (full width)
          ══════════════════════════════════════════════════════════════ */}
          <section className="fd-cta-section">
            <div className="fd-cta-inner">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="fd-cta-title">{t("formationDetail.ctaTitle")}</h2>
                <p className="fd-cta-sub">{t("formationDetail.ctaSubtitle")}</p>
                <button className="fd-cta-btn" onClick={handleEnroll}>
                  {user ? t("formationDetail.ctaBtn") : t("formationDetail.ctaLogin")}
                  <FiChevronRight size={18} />
                </button>
              </motion.div>
            </div>
          </section>

        </>
      )}

      {/* ── Modal aperçu semaine ─────────────────────────────────────────── */}
      {previewWeek && (
        <CoursePreviewModal
          formation={formation}
          week={previewWeek}
          allWeeks={sortedWeeks}
          onClose={() => setPreviewWeek(null)}
          onSelectWeek={setPreviewWeek}
        />
      )}

      {/* ── Modal vidéo résumé (trailer) — réutilise CoursePreviewModal en
          mode isTrailer (déjà prévu pour ça, jamais invoqué jusqu'ici) :
          habille l'iframe Drive existant, pas de faux contrôles. ── */}
      {showTrailerModal && formation?.trailerVideoUrl && (
        <CoursePreviewModal
          formation={formation}
          week={{ videoUrl: formation.trailerVideoUrl, thumbnail: formation.trailerThumbnail }}
          isTrailer
          onClose={() => setShowTrailerModal(false)}
        />
      )}

    </div>
  );
};

export default FormationDetail;
