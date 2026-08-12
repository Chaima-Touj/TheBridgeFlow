import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  FiX, FiChevronLeft, FiChevronRight, FiPlay, FiArrowRight, FiExternalLink,
} from "react-icons/fi";
import { BREAKPOINTS } from "../../constants/breakpoints.js";
import { isGoogleDriveUrl, resolveDriveUrl, resolveDriveThumbnailProxyUrl, extractDriveFileId } from "../../constants/videoUrls.js";
import "./VideoTestimonialCarousel.css";

const AUTO_ADVANCE_MS = 4500;
const RESUME_DELAY_MS = 5000;

// Watchdog 2 paliers, porté depuis CoursePreviewModal/VideoFrame (même
// logique exacte) — TestimonialDriveFrame n'avait jusqu'ici aucun filet de
// sécurité : si onLoad ne se déclenche jamais, le spinner tournait pour
// toujours (bug préexistant, sans rapport avec le crop 114.9% ajouté
// séparément). 0-7s : chargement normal. 7-15s : "slow-loading", log
// silencieux uniquement, aucun changement visible. >15s : toujours aucun
// onLoad -> fallback "Ouvrir dans Drive" affiché.
const SLOW_LOADING_AT_MS = 7000;
const FALLBACK_AT_MS = 15000;

function logVideoDiagnostic(event, { mountedAt, videoUrl, extra } = {}) {
  const connection =
    typeof navigator !== "undefined"
      ? navigator.connection || navigator.mozConnection || navigator.webkitConnection
      : null;
  console.log(`[VIDEO_DIAGNOSTIC] ${event}`, {
    elapsedMs: mountedAt != null ? Math.round(performance.now() - mountedAt) : null,
    videoUrl,
    onLine: typeof navigator !== "undefined" ? navigator.onLine : null,
    effectiveType: connection?.effectiveType ?? null,
    ...extra,
  });
}

/* ─── Une carte "story" (9:16) — statique, jamais de lecture inline dans la
   rangée (source de l'ancien bug "barre de contrôles Drive coupée" : un
   iframe qui joue dans une carte trop petite). Chaque carte affiche
   uniquement son poster + l'icône .vtc-card__play-hint ; le clic (onOpen)
   ouvre la modale, seul endroit où une vidéo est réellement lue. ── */
function TestimonialCard({ item, isActive, wrapRef, onOpen }) {
  const { t } = useTranslation();
  const isDrive = isGoogleDriveUrl(item.videoUrl);
  // item.posterUrl, quand renseigné, est lui aussi un lien de partage Drive
  // (ex: généré par generate-testimonial-thumbnails.js) — jamais une image
  // brute directement utilisable en <img src> : même restriction anti-
  // hotlinking que pour les vidéos (voir resolveDriveThumbnailProxyUrl),
  // donc même passage obligé par notre proxy. Sans ce passage, l'image reste
  // noire (testé : la page Drive "view" renvoyée par un accès direct n'est
  // pas une image, le <img> échoue silencieusement).
  // Vignette dérivée à la volée depuis l'URL vidéo elle-même quand aucune
  // n'est fournie — Drive génère aussi une image depuis un fichier vidéo, pas
  // seulement depuis une image (endpoint /thumbnail, même que pour les images).
  const posterSrc =
    (item.posterUrl && (isGoogleDriveUrl(item.posterUrl) ? resolveDriveThumbnailProxyUrl(item.posterUrl) : item.posterUrl)) ||
    (isDrive ? resolveDriveThumbnailProxyUrl(item.videoUrl) : undefined);

  return (
    <div className="vtc-card-wrap" ref={wrapRef}>
      <div
        className={`vtc-card ${isActive ? "vtc-card--active" : ""}`}
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
        aria-label={t("testimonials.openAria")}
      >
        {posterSrc ? (
          <img
            className="vtc-card__video"
            src={posterSrc}
            alt=""
            loading={isActive ? "eager" : "lazy"}
            // Filet de sécurité complémentaire à l'effet sectionInView du
            // parent (.vtc-row) : quand la page charge ~28 vignettes
            // simultanément (3 catégories confondues), certaines
            // terminent leur chargement bien après le double rAF déclenché
            // à l'entrée dans le viewport — observé en test réel : une
            // vignette peut rester noire alors que ses données sont
            // intégralement chargées (`complete: true`, dimensions
            // correctes), preuve d'un défaut de peinture, pas de
            // chargement. Un `offsetHeight` seul ne suffisait pas à la
            // débloquer (testé) ; basculer légèrement l'opacité force un
            // recompositing de CET élément précisément, sans lien avec
            // l'ancêtre transformé — technique standard, imperceptible.
            onLoad={(e) => {
              const el = e.currentTarget;
              el.style.opacity = "0.999";
              requestAnimationFrame(() => { el.style.opacity = ""; });
            }}
          />
        ) : (
          <div className="vtc-card__video" style={{ background: "#111" }} />
        )}

        <div className="vtc-card__scrim" />

        <div className="vtc-card__top">
          {item.category === "pfe" && (
            <span className="vtc-card__badge">🎓 {t("testimonials.badgeCompany")}</span>
          )}
        </div>

        <div className="vtc-card__play-hint" aria-hidden="true"><FiPlay size={20} /></div>
      </div>

      {!item.vttUrl && item.captionText && (
        <p className="vtc-card-wrap__caption">{item.captionText}</p>
      )}
    </div>
  );
}

/* ─── Iframe Drive + spinner de chargement (fondu 250ms) — même pattern que
   CoursePreviewModal/VideoFrame (voir son commentaire pour le détail du
   fondu). Isolée dans son propre composant, montée avec key={item.id} par
   l'appelant : "loaded" repart à false à chaque changement de témoignage via
   le remount React, sans effect de resynchronisation d'un state dérivé
   d'une prop. Scope volontairement limité à l'iframe (source cross-origin,
   seule concernée par le flash "deux ronds superposés") — la <video> native
   de la branche non-Drive n'est pas touchée. */
function TestimonialDriveFrame({ item, t }) {
  const [loaded, setLoaded] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  // Indépendant de `loaded`, jamais remis à false : si onLoad arrive
  // tardivement après le watchdog (cas rare), la boîte "timeout" déjà
  // affichée s'estompe en fondu au lieu de basculer brutalement vers le
  // spinner simple — même comportement que CoursePreviewModal.
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const [mountedAt] = useState(() => performance.now());
  const watchdogIdRef = useRef(null);

  // Watchdog 2 paliers sur une seule ref, un seul timer actif à la fois —
  // voir commentaire en tête de fichier pour le détail des paliers.
  useEffect(() => {
    logVideoDiagnostic("mount", { mountedAt, videoUrl: item.videoUrl });
    watchdogIdRef.current = setTimeout(() => {
      logVideoDiagnostic("slow-loading", { mountedAt, videoUrl: item.videoUrl });
      watchdogIdRef.current = setTimeout(() => {
        setHasTimedOut(true);
        logVideoDiagnostic("timeout", { mountedAt, videoUrl: item.videoUrl });
      }, FALLBACK_AT_MS - SLOW_LOADING_AT_MS);
    }, SLOW_LOADING_AT_MS);
    return () => {
      clearTimeout(watchdogIdRef.current);
      logVideoDiagnostic("unmount", { mountedAt, videoUrl: item.videoUrl });
    };
  }, [mountedAt, item.videoUrl]);

  const handleLoad = () => {
    clearTimeout(watchdogIdRef.current);
    logVideoDiagnostic("iframe-load", { mountedAt, videoUrl: item.videoUrl });
    setLoaded(true);
  };

  useEffect(() => {
    if (!loaded) return undefined;
    const timer = setTimeout(() => setShowLoading(false), 250);
    return () => clearTimeout(timer);
  }, [loaded]);

  const driveFileId = extractDriveFileId(item.videoUrl);
  const driveViewUrl = driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : null;

  return (
    <>
      <iframe
        className="vtc-modal__video"
        style={{ border: 0 }}
        // autoplay=1 indispensable ici : le calque anti-flash ci-dessous
        // absorbe TOUT tap, y compris celui qui servait jusqu'ici à lancer
        // la lecture — sans autoplay, la vidéo ne démarrerait plus jamais
        // (vérifié : reproduit, deux taps sans effet, toujours à l'état
        // pause initial). Pas de mute : cette modale est la version "son
        // activé" par design (contrairement à l'aperçu carte, muet).
        src={`${resolveDriveUrl(item.videoUrl, "video")}?autoplay=1`}
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
        title={t("testimonials.openAria")}
        onLoad={handleLoad}
      />
      {showLoading && (
        hasTimedOut ? (
          <div className="vtc-modal__loading vtc-modal__loading--timeout" role="status">
            <p>
              Le chargement prend plus de temps que prévu.
              Cela peut arriver si votre navigateur bloque les cookies tiers (ex : navigation privée).
            </p>
            {driveViewUrl && (
              <a className="vtc-timeout-link" href={driveViewUrl} target="_blank" rel="noopener noreferrer">
                <FiExternalLink size={14} />
                <span>{t("coursePreview.openExternal")}</span>
              </a>
            )}
          </div>
        ) : (
          <div className={`vtc-modal__loading${loaded ? " vtc-modal__loading--fade-out" : ""}`} aria-hidden="true">
            <span className="vtc-modal__spinner" />
          </div>
        )
      )}
      {/* Bloque tout tap vers l'iframe Drive (investigation confirmée : un
         calque au-dessus, sans pointer-events:none, absorbe le clic avant
         qu'il atteigne l'iframe) — empêche le flash natif "icône dupliquée"
         que Drive affiche à chaque bascule play/pause, au prix d'une vidéo
         qu'on ne peut plus mettre en pause/reprendre soi-même une fois
         lancée (compromis accepté, voir bouton fermer + flèches, non
         couverts par ce calque). */}
      <div className="vtc-modal__tap-blocker" aria-hidden="true" />
    </>
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
  const isDrive = isGoogleDriveUrl(item.videoUrl);

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
          {isDrive ? (
            <TestimonialDriveFrame key={item.id} item={item} t={t} />
          ) : (
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
          )}

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

  /* ── Filet de sécurité pour un éventuel défaut de peinture au premier
     affichage (voir .vtc-row en CSS — plus de will-change:transform
     permanent, retiré à la cause du problème observé en test réel : des
     vignettes chargées mais jamais peintes). Un double rAF force une
     relecture de layout dès que la section devient visible — le même effet
     qu'un scroll, sans attendre que l'utilisateur le refasse. Ceinture et
     bretelles avec le onLoad par <img> (voir TestimonialCard) qui couvre le
     cas d'une vignette dont le chargement se termine après ce déclenchement. ── */
  useEffect(() => {
    if (!sectionInView) return undefined;
    let raf2 = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (trackRef.current) void trackRef.current.offsetHeight;
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [sectionInView]);


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
                  wrapRef={(el) => { wrapRefs.current[i] = el; }}
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
