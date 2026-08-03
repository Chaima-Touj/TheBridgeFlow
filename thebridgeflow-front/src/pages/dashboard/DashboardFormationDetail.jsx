import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useLang } from "../../context/LangContext.jsx";
import {
  FiArrowLeft, FiChevronDown, FiAward, FiClock, FiMonitor, FiUsers,
  FiCheck, FiStar, FiChevronRight, FiPlay, FiMessageCircle, FiZap,
  FiBook, FiTarget, FiShield, FiHelpCircle, FiX, FiCheckCircle,
  FiCpu, FiLock, FiTrendingUp,
} from "react-icons/fi";
import { FaChartBar, FaRobot } from "react-icons/fa";
import { SiFlutter, SiSpringboot, SiAngular, SiReact, SiNodedotjs, SiDocker, SiKubernetes } from "react-icons/si";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import CoursePreviewModal from "../../components/common/CoursePreviewModal.jsx";
import VideoTestimonialCarousel from "../../components/common/VideoTestimonialCarousel.jsx";
import { formationsService } from "../../services/formations.service.js";
import { enrollmentRequestsService } from "../../services/enrollmentRequests.service.js";
import { DEFAULT_THUMB, getWeekThumb } from "../../utils/thumbUtils.js";
import { getAllFormationTestimonials } from "../../constants/testimonials.js";
import "../FormationDetail.css";
import "./DashboardFormationDetail.css";

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

const ACCOMPANIMENT_ICONS = [
  FiUsers, FiZap, FiCheck, FiMessageCircle, FiBook, FiTarget, FiShield,
];
const ACCOMPANIMENT_KEYS = [
  "feat_experts", "feat_coaching", "feat_followup",
  "feat_qa", "feat_exercises", "feat_eval", "feat_support",
];

function getIconEntry(slug = "") {
  return ICON_MAP[slug] ?? [{ Comp: SiReact, color: "#61DAFB" }];
}

function groupWeeksByPhase(weeks = [], t) {
  const groups = new Map();
  weeks.forEach((w) => {
    const phase = w.phase?.trim() || t("formationDetail.monthFallback", { n: Math.ceil(w.week / 4) });
    if (!groups.has(phase)) groups.set(phase, []);
    groups.get(phase).push(w);
  });
  return groups;
}

// ─── Star rating ──────────────────────────────────────────────────────────────
function StarRating({ rating = 5 }) {
  return (
    <div className="fd-stars" aria-label={`${rating}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <FiStar key={i} size={14} className={i <= rating ? "fd-star--filled" : "fd-star--empty"} />
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
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);
  return count;
}

function StatCounter({ value, suffix = "", label }) {
  const ref    = useRef(null);
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
      <button className="fd-faq-q" onClick={() => setOpen((v) => !v)}>
        <FiHelpCircle size={16} className="fd-faq-ico" />
        <span>{question}</span>
        <FiChevronDown className="fd-faq-arrow" size={16} />
      </button>
      {open && <div className="fd-faq-a">{answer}</div>}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonHero() {
  return (
    <div className="fd-hero fd-hero--skeleton" aria-hidden="true">
      <div className="fd-hero__inner">
        <div className="fd-sk-hero">
          <div className="fd-sk fd-sk-badge" />
          <div className="fd-sk fd-sk-title" />
          <div className="fd-sk fd-sk-title fd-sk--short" />
          <div className="fd-sk fd-sk-desc" />
          <div className="fd-sk fd-sk-desc fd-sk--mid" />
        </div>
      </div>
    </div>
  );
}

// ─── Enrollment request modal ─────────────────────────────────────────────────
function EnrollModal({ formation, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [mode,        setMode]       = useState("Présentiel");
  const [message,     setMessage]    = useState("");
  const [submitting,  setSubmitting] = useState(false);
  const [alreadySent, setAlreadySent] = useState(false);

  const MODES = [
    { value: "Présentiel", label: t("dfd.modeOnsite") },
    { value: "En ligne",   label: t("dfd.modeOnline") },
  ];

  /* Scroll lock */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* Escape key */
  const handleKey = useCallback((e) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await enrollmentRequestsService.create(formation._id, mode, message);
      onSuccess();
      onClose();
    } catch (err) {
      if (err?.response?.status === 409) {
        setAlreadySent(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dfd-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="dfd-modal" onClick={(e) => e.stopPropagation()}>

        <div className="dfd-modal__header">
          <h3 className="dfd-modal__title">{t("dfd.modalTitle")}</h3>
          <button className="dfd-modal__close" onClick={onClose} aria-label={t("dfd.modalClose")}>
            <FiX size={18} />
          </button>
        </div>

        <p className="dfd-modal__formation">{formation.title}</p>

        {alreadySent ? (
          <div className="dfd-modal__already">
            <FiCheckCircle size={20} />
            <span>{t("dfd.alreadySent")}</span>
          </div>
        ) : (
          <form className="dfd-modal__form" onSubmit={handleSubmit}>

            {/* Mode */}
            <fieldset className="dfd-modal__fieldset">
              <legend className="dfd-modal__legend">{t("dfd.modeLegend")}</legend>
              <div className="dfd-modal__radios">
                {MODES.map((m) => (
                  <label
                    key={m.value}
                    className={`dfd-modal__radio${mode === m.value ? " dfd-modal__radio--active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={m.value}
                      checked={mode === m.value}
                      onChange={() => setMode(m.value)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Message */}
            <label className="dfd-modal__label">
              {t("dfd.messageLabel")}
              <textarea
                className="dfd-modal__textarea"
                placeholder={t("dfd.messagePlaceholder")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={800}
              />
            </label>

            <button
              type="submit"
              className="dfd-modal__submit"
              disabled={submitting}
            >
              {submitting ? t("dfd.submitting") : t("dfd.submitBtn")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ visible }) {
  const { t } = useTranslation();
  return (
    <div className={`dfd-toast${visible ? " dfd-toast--visible" : ""}`} role="status">
      <FiCheckCircle size={16} />
      {t("dfd.toastSuccess")}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardFormationDetail() {
  const { slug }      = useParams();
  const { t }         = useTranslation();
  const { lang }      = useLang();

  const [formation,    setFormation]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [previewWeek,  setPreviewWeek]  = useState(null);
  const [showModal,    setShowModal]    = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    formationsService.getBySlug(slug)
      .then((res) => {
        if (!active) return;
        const f = res.data;
        if (!f?._id) throw new Error(t("formationDetail.notFound"));
        setFormation(f);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.response?.data?.message ?? err.message ?? t("formationDetail.error"));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const handleSuccess = () => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 4000);
  };

  // Derived data
  const iconEntries = formation ? getIconEntry(formation.slug) : [{ Comp: SiReact, color: "#61DAFB" }];
  const weekGroups        = formation ? groupWeeksByPhase(formation.weeks ?? [], t) : new Map();
  const supervisionGroups = formation ? groupWeeksByPhase(formation.supervision ?? [], t) : new Map();
  const features   = formation?.features?.length
    ? formation.features
    : ACCOMPANIMENT_KEYS.map((k) => t(`formationDetail.${k}`));
  const hasStats    = formation && Object.values(formation.stats ?? {}).some((v) => v > 0);
  const hasFaq      = formation?.faq?.length > 0;
  const hasReviews  = formation?.reviews?.length > 0;
  const sortedWeeks = [...(formation?.weeks ?? [])].sort((a, b) => a.week - b.week);

  return (
    <DashboardLayout title={formation?.title ?? "Formation"}>
      <div className="fd-page dfd-page-override">

        {/* ── Skeleton ─────────────────────────────────────────────────────── */}
        {loading && <SkeletonHero />}

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="fd-error">
            <p className="fd-error__msg">{error}</p>
            <Link to="/dashboard/student/formations" className="fd-btn fd-btn--ghost">
              {t("dfd.back")}
            </Link>
          </div>
        )}

        {!loading && !error && formation && (
          <>
            {/* ══════════════════════════════════════════════════════════════
                1. HERO
            ══════════════════════════════════════════════════════════════ */}
            <section className="fd-hero">
              <div className="fd-hero__blob fd-hero__blob--1" />
              <div className="fd-hero__blob fd-hero__blob--2" />

              <div className="fd-hero__inner">
                {/* ── LEFT ─────────────────────────────────────────────── */}
                <motion.div
                  className="fd-hero__left"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  <Link to="/dashboard/student/formations" className="fd-back">
                    <FiArrowLeft size={15} /> {t("dfd.back")}
                  </Link>

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
                    {formation.schedule && (
                      <span className="fd-hero__badge">
                        <FiUsers size={13} />{formation.schedule}
                      </span>
                    )}
                  </div>
                </motion.div>

                {/* ── RIGHT: pricing card ───────────────────────────────── */}
                <motion.div
                  className="fd-hero__card"
                  initial={{ opacity: 0, y: 32 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.12, ease: "easeOut" }}
                >
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {iconEntries.map(({ Comp: Ic, color: c }, i) => (
                      <div
                        key={i}
                        className="fd-price-icon"
                        style={{
                          background: `${c}22`,
                          color: c,
                          ...(iconEntries.length >= 3 && { width: 36, height: 36 }),
                        }}
                      >
                        <Ic size={iconEntries.length >= 3 ? 16 : 24} />
                      </div>
                    ))}
                  </div>

                  <h2 className="fd-price-title">{formation.title}</h2>

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

                  <div className="fd-cert-row">
                    <FiAward size={15} className={formation.certificate ? "fd-cert--yes" : "fd-cert--no"} />
                    <span className={formation.certificate ? "fd-cert--yes" : "fd-cert--no"}>
                      {t("formationDetail.certificate")} :{" "}
                      {formation.certificate
                        ? t("formationDetail.certificateYes")
                        : t("formationDetail.certificateNo")}
                    </span>
                  </div>

                  {/* ← CTA modifié */}
                  <button className="fd-enroll-btn dfd-enroll-btn" onClick={() => setShowModal(true)}>
                    {t("dfd.enrollBtn")}
                  </button>
                </motion.div>
              </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                CONTENT BODY
            ══════════════════════════════════════════════════════════════ */}
            <div className="fd-body">
              <div className="fd-body__inner">

                {/* ── LEFT COLUMN ──────────────────────────────────────── */}
                <div className="fd-body__left">

                  {/* Programme */}
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

                  {/* Encadrement */}
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

                  {/* Accompagnement */}
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
                            <div className="fd-feature__icon"><Icon size={18} /></div>
                            <span className="fd-feature__text">{feat}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Avis */}
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

                  {/* FAQ */}
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
                </div>

                {/* ── RIGHT STICKY SIDEBAR ─────────────────────────────── */}
                <aside className="fd-body__right">

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

                    {/* ← CTA modifié */}
                    <button className="fd-sidebar-enroll dfd-enroll-btn" onClick={() => setShowModal(true)}>
                      {t("dfd.enrollBtnShort")} <FiChevronRight size={15} />
                    </button>

                    <Link
                      to="/dashboard/student/formations"
                      className="fd-sidebar-back"
                    >
                      {t("dfd.back")}
                    </Link>
                  </div>

                  <div className="fd-sidebar-card">
                    <div className="fd-sidebar-info-list">
                      {[
                        { icon: <FiClock size={15} />,   label: t("formationDetail.duration"), val: formation.duration },
                        { icon: <FiTarget size={15} />,  label: t("formationDetail.level"),    val: formation.level },
                        { icon: <FiMonitor size={15} />, label: t("formationDetail.mode"),     val: formation.mode || formation.schedule },
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
              </div>
            </div>

            {/* Statistics */}
            {hasStats && (
              <section className="fd-stats-section">
                <div className="fd-stats-inner">
                  <h2 className="fd-stats-title">{t("formationDetail.stats")}</h2>
                  <div className="fd-stats-grid">
                    <StatCounter value={formation.stats.students}      label={t("formationDetail.statsStudents")} />
                    <StatCounter value={formation.stats.successRate}    suffix="%" label={t("formationDetail.statsSuccess")} />
                    <StatCounter value={formation.stats.insertionRate}  suffix="%" label={t("formationDetail.statsInsertion")} />
                    <StatCounter value={formation.stats.satisfaction}   suffix="%" label={t("formationDetail.statsSatisfaction")} />
                  </div>
                </div>
              </section>
            )}

            {/* Témoignages vidéo — pas de CTA ici, le bouton d'inscription
                (dfd-enroll-btn) juste en dessous suffit. */}
            <VideoTestimonialCarousel
              items={getAllFormationTestimonials()}
              title={t("formationDetail.testimonialsTitle")}
              subtitle={t("formationDetail.testimonialsSub")}
            />

            {/* CTA final */}
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
                  <button className="fd-cta-btn dfd-enroll-btn" onClick={() => setShowModal(true)}>
                    {t("dfd.enrollBtn")} <FiChevronRight size={18} />
                  </button>
                </motion.div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {showModal && formation && (
        <EnrollModal
          formation={formation}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}

      {/* ── Course preview modal ──────────────────────────────────────────── */}
      {previewWeek && formation && (
        <CoursePreviewModal
          formation={formation}
          week={previewWeek}
          allWeeks={sortedWeeks}
          onClose={() => setPreviewWeek(null)}
          onSelectWeek={setPreviewWeek}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      <Toast visible={toastVisible} />
    </DashboardLayout>
  );
}
