import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  FiVolume2, FiVolumeX, FiX, FiChevronLeft, FiChevronRight, FiPlay, FiArrowRight,
} from "react-icons/fi";
import { BREAKPOINTS } from "../../constants/breakpoints.js";
import "./VideoTestimonialCarousel.css";

const AUTO_ADVANCE_MS = 4500;
const RESUME_DELAY_MS = 5000;

/* ─── Une carte "story" (9:16) — lecture pilotée par le parent, pas par elle-même ── */
function TestimonialCard({ item, isActive, canPlay, wrapRef, videoRef, onOpen }) {
  const { t } = useTranslation();
  const [muted, setMuted] = useState(true);

  const toggleMute = (e) => {
    e.stopPropagation();
    setMuted((m) => !m);
  };

  return (
    <div className="vtc-card-wrap" ref={wrapRef}>
      <div
        className={`vtc-card ${isActive && canPlay ? "vtc-card--active" : ""}`}
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
        aria-label={t("testimonials.openAria")}
      >
        <video
          ref={videoRef}
          className="vtc-card__video"
          src={item.videoUrl}
          poster={item.posterUrl || undefined}
          muted={muted}
          loop
          playsInline
          preload="metadata"
        >
          {item.vttUrl && <track kind="subtitles" src={item.vttUrl} default />}
        </video>

        <div className="vtc-card__scrim" />

        <div className="vtc-card__top">
          {item.category === "pfe" && (
            <span className="vtc-card__badge">🎓 {t("testimonials.badgeCompany")}</span>
          )}
          <button
            type="button"
            className="vtc-card__mute"
            onClick={toggleMute}
            aria-label={t(muted ? "testimonials.unmute" : "testimonials.mute")}
          >
            {muted ? <FiVolumeX size={15} /> : <FiVolume2 size={15} />}
          </button>
        </div>

        <div className="vtc-card__play-hint" aria-hidden="true"><FiPlay size={20} /></div>
      </div>

      {!item.vttUrl && item.captionText && (
        <p className="vtc-card-wrap__caption">{item.captionText}</p>
      )}
    </div>
  );
}

/* ─── Modale plein écran — son activé, navigation précédent/suivant ────────── */
function TestimonialModal({ items, activeIndex, onClose, onNavigate }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const item = items[activeIndex];

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowRight") onNavigate(1);
      if (e.key === "ArrowLeft")  onNavigate(-1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onNavigate]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  }, [activeIndex]);

  if (!item) return null;

  return (
    <div className="vtc-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="vtc-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="vtc-modal__close" onClick={onClose} aria-label={t("applications.closeModal")}>
          <FiX size={20} />
        </button>

        {items.length > 1 && (
          <button
            type="button"
            className="vtc-modal__nav vtc-modal__nav--prev"
            onClick={() => onNavigate(-1)}
            aria-label={t("testimonials.prev")}
          >
            <FiChevronLeft size={22} />
          </button>
        )}

        <div className="vtc-modal__video-wrap">
          <video
            ref={videoRef}
            key={item.id}
            className="vtc-modal__video"
            src={item.videoUrl}
            poster={item.posterUrl || undefined}
            controls
            playsInline
            autoPlay
          >
            {item.vttUrl && <track kind="subtitles" src={item.vttUrl} default />}
          </video>

          {item.category === "pfe" && (
            <div className="vtc-modal__info">
              <span className="vtc-modal__badge">🎓 {t("testimonials.badgeCompany")}</span>
            </div>
          )}
        </div>

        {items.length > 1 && (
          <button
            type="button"
            className="vtc-modal__nav vtc-modal__nav--next"
            onClick={() => onNavigate(1)}
            aria-label={t("testimonials.next")}
          >
            <FiChevronRight size={22} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Composant réutilisable — carousel de témoignages vidéo format "story".
   `items` doit déjà être filtré par l'appelant (featured pour la landing,
   par formationSlug sur une page FormationDetail). Ne rend rien si vide.

   Une seule vidéo "active" à la fois (coordinateur global) :
   - Desktop (> BREAKPOINTS.md) : vrai carousel à glissement, activeIndex piloté
     par les flèches / l'auto-advance.
   - Mobile (<= BREAKPOINTS.md) : scroll-snap tactile natif inchangé,
     activeIndex piloté par un IntersectionObserver (carte la plus visible).
   Dans les deux cas, un seul <video> lit à la fois — voir l'effet de lecture
   plus bas qui pause tout sauf items[activeIndex].
═══════════════════════════════════════════════════════════════════════════ */
export default function VideoTestimonialCarousel({ items, title, subtitle, ctaLabel, ctaHref, sectionId }) {
  const { t } = useTranslation();
  const [modalIndex, setModalIndex] = useState(null); // null | index dans `items`

  const [activeIndex, setActiveIndex]   = useState(0);
  const [sectionInView, setSectionInView] = useState(false);
  const [isPaused, setIsPaused]         = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= BREAKPOINTS.md
  );
  const [slide, setSlide] = useState({ step: 0, maxIndex: 0 });

  const sectionRef  = useRef(null);
  const viewportRef = useRef(null);
  const trackRef    = useRef(null);
  const wrapRefs    = useRef([]);
  const videoRefs   = useRef([]);
  const resumeTimerRef = useRef(null);

  const count = items?.length || 0;

  /* ── Layout mode (mobile swipe vs desktop carousel) — suit BREAKPOINTS.md ── */
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${BREAKPOINTS.md}px)`);
    const handler = (e) => setIsMobileLayout(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* ── La section entre/sort du viewport de la page — gate globale de lecture ── */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setSectionInView(entry.isIntersecting),
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ── Mesure du pas de glissement (largeur carte + gap) et du nombre visible ── */
  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const firstCard = wrapRefs.current[0];
    const track = trackRef.current;
    if (!viewport || !firstCard || !track) return;
    const cardWidth = firstCard.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || "0") || 0;
    const step = cardWidth + gap;
    const visibleCount = Math.max(1, Math.round(viewport.getBoundingClientRect().width / step));
    const maxIndex = Math.max(0, count - visibleCount);
    setSlide({ step, maxIndex });
  }, [count]);

  useEffect(() => {
    if (isMobileLayout || count === 0) return;
    measure();
    const ro = new ResizeObserver(measure);
    if (viewportRef.current) ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, [measure, isMobileLayout, count]);

  /* ── Mobile : la carte la plus visible dans le rail devient l'index actif ── */
  useEffect(() => {
    if (!isMobileLayout || count === 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const ratios = new Array(count).fill(0);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = wrapRefs.current.indexOf(entry.target);
          if (idx !== -1) ratios[idx] = entry.intersectionRatio;
        });
        let bestIdx = 0, bestRatio = -1;
        ratios.forEach((r, i) => { if (r > bestRatio) { bestRatio = r; bestIdx = i; } });
        if (bestRatio > 0) setActiveIndex(bestIdx);
      },
      { root: viewport, threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] }
    );
    wrapRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [isMobileLayout, count]);

  /* ── Un seul <video> en lecture à la fois : items[activeIndex], et seulement
     si la section est visible — pause tout le reste, sur les deux layouts. ── */
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (sectionInView && i === activeIndex) v.play().catch(() => {});
      else v.pause();
    });
  }, [activeIndex, sectionInView]);

  /* ── Pause immédiate au survol/interaction, reprise après quelques secondes ── */
  const pauseAndScheduleResume = useCallback(() => {
    setIsPaused(true);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => setIsPaused(false), RESUME_DELAY_MS);
  }, []);

  useEffect(() => () => { if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current); }, []);

  const handleMouseEnter = () => {
    setIsPaused(true);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  };
  const handleMouseLeave = () => pauseAndScheduleResume();

  /* ── Navigation manuelle (flèches) — avance/recule et relance le minuteur ── */
  const goTo = useCallback((delta) => {
    setActiveIndex((i) => (i + delta + count) % count);
  }, [count]);

  const goManual = (delta) => { goTo(delta); pauseAndScheduleResume(); };

  /* ── Auto-advance desktop — se reprogramme à chaque changement d'index,
     manuel ou automatique, pour garder une cadence régulière entre 2 avances ── */
  const visibleCount = slide.maxIndex >= 0 ? count - slide.maxIndex : count;
  const canAutoAdvance = !isMobileLayout && sectionInView && !isPaused && count > Math.max(1, visibleCount);

  useEffect(() => {
    if (!canAutoAdvance) return;
    const id = setTimeout(() => goTo(1), AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [canAutoAdvance, activeIndex, goTo]);

  /* ── Modale plein écran ────────────────────────────────────────────────── */
  const openModal  = useCallback((idx) => setModalIndex(idx), []);
  const closeModal = useCallback(() => setModalIndex(null), []);
  const navigateModal = useCallback(
    (delta) => setModalIndex((i) => (i === null ? null : (i + delta + count) % count)),
    [count]
  );

  if (!items || count === 0) return null;

  const clampedIndex = Math.min(activeIndex, slide.maxIndex);
  const showArrows = !isMobileLayout && count > Math.max(1, visibleCount);

  return (
    <section id={sectionId} className="vtc-section" ref={sectionRef}>
      <div className="vtc-section__inner">
        <div className="vtc-header">
          <span className="vtc-header__badge">🎬 {t("testimonials.eyebrow")}</span>
          <h2 className="vtc-header__title">{title}</h2>
          {subtitle && <p className="vtc-header__sub">{subtitle}</p>}
        </div>

        <div
          className="vtc-carousel"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {showArrows && (
            <button
              type="button"
              className="vtc-arrow vtc-arrow--prev"
              onClick={() => goManual(-1)}
              aria-label={t("testimonials.prev")}
            >
              <FiChevronLeft size={20} />
            </button>
          )}

          <div className="vtc-track-viewport" ref={viewportRef}>
            <div
              className="vtc-row"
              ref={trackRef}
              style={isMobileLayout ? undefined : { transform: `translateX(-${clampedIndex * slide.step}px)` }}
            >
              {items.map((item, i) => (
                <TestimonialCard
                  key={item.id}
                  item={item}
                  isActive={i === activeIndex}
                  canPlay={sectionInView}
                  wrapRef={(el) => { wrapRefs.current[i] = el; }}
                  videoRef={(el) => { videoRefs.current[i] = el; }}
                  onOpen={() => openModal(i)}
                />
              ))}
            </div>
          </div>

          {showArrows && (
            <button
              type="button"
              className="vtc-arrow vtc-arrow--next"
              onClick={() => goManual(1)}
              aria-label={t("testimonials.next")}
            >
              <FiChevronRight size={20} />
            </button>
          )}
        </div>

        {ctaHref && (
          <div className="vtc-cta">
            <Link to={ctaHref} className="btn btn-primary vtc-cta__btn">
              {ctaLabel || t("testimonials.ctaDefault")} <FiArrowRight size={16} />
            </Link>
          </div>
        )}
      </div>

      {modalIndex !== null && (
        <TestimonialModal items={items} activeIndex={modalIndex} onClose={closeModal} onNavigate={navigateModal} />
      )}
    </section>
  );
}
