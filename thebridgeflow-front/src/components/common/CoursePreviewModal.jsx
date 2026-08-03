import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiX, FiPlay, FiLock, FiMaximize, FiMinimize, FiExternalLink } from "react-icons/fi";
import { DEFAULT_THUMB, getWeekThumb } from "../../utils/thumbUtils.js";
import { resolveVideoUrl, isGoogleDriveUrl, resolveDriveUrl, extractDriveFileId } from "../../constants/videoUrls.js";
import "./CoursePreviewModal.css";

function getYoutubeId(url = "") {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&\s]{11})/);
  return m ? m[1] : null;
}

/* Isolé dans son propre composant, monté avec key={videoUrl} par le parent :
   le spinner "loaded" repart naturellement à false à chaque changement de
   vidéo via le remount React, sans ref/effect pour resynchroniser un state
   dérivé d'une prop (pattern déconseillé par le linter react-hooks ici). */
function VideoFrame({ ytId, isDrive, videoUrl, isTrailer, week, t, onIframeEnter, onIframeLeave, driveViewUrl }) {
  const [loaded, setLoaded] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const isIframeSource = !!ytId || isDrive;

  // Instrumentation de diagnostic — mesure le délai réel entre le montage de
  // l'iframe et son onLoad. Actif en production (pas de gate DEV) : le
  // précédent gate `if (import.meta.env.DEV)` rendait ce log invisible en
  // prod (build Vite, DEV=false), alors que c'est justement en prod que le
  // bug de chargement Drive a été signalé. Lazy initializer : n'appelle
  // performance.now() qu'une seule fois, au premier rendu de ce composant
  // (jamais réinvoqué aux rendus suivants) — c'est le seul moyen pur d'y
  // accéder pendant le rendu (accéder à un ref pendant le rendu est proscrit
  // par le linter de ce projet).
  const [mountedAt] = useState(() => performance.now());

  // Watchdog de chargement — si l'iframe ne déclenche jamais onLoad (blocage
  // CSP côté Google Drive, fichier mal partagé...), bascule loadTimedOut à
  // true après 7s au lieu de laisser le spinner tourner indéfiniment sans
  // feedback. Se réinitialise naturellement à chaque nouvelle vidéo car
  // VideoFrame est remonté via key={videoUrl} par le parent (voir plus haut)
  // — pas besoin de reset manuel. Le timer est nettoyé au démontage (cleanup
  // de l'effect, ex: changement de vidéo avant l'expiration) et annulé
  // explicitement dans handleLoad si le chargement finit par réussir après coup.
  const timeoutIdRef = useRef(null);
  useEffect(() => {
    if (!isIframeSource) return undefined;
    timeoutIdRef.current = setTimeout(() => setLoadTimedOut(true), 7000);
    return () => clearTimeout(timeoutIdRef.current);
  }, [isIframeSource, videoUrl]);

  const handleLoad = () => {
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    const elapsed = Math.round(performance.now() - mountedAt);
    console.log(`[CoursePreviewModal] iframe onLoad après ${elapsed}ms (videoUrl: ${videoUrl})`);
    setLoaded(true);
  };

  return (
    <>
      {ytId ? (
        <iframe
          className="cpm-iframe"
          src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`}
          title={isTrailer ? t("coursePreview.trailer") : week.content}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          onLoad={handleLoad}
          onMouseEnter={onIframeEnter}
          onMouseLeave={onIframeLeave}
        />
      ) : isDrive ? (
        <iframe
          className="cpm-iframe"
          src={resolveDriveUrl(videoUrl, "video")}
          title={isTrailer ? t("coursePreview.trailer") : week.content}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          onLoad={handleLoad}
          onMouseEnter={onIframeEnter}
          onMouseLeave={onIframeLeave}
        />
      ) : videoUrl ? (
        <video
          className="cpm-video"
          controls
          autoPlay
          src={videoUrl}
          poster={week?.thumbnail || undefined}
          controlsList={isTrailer ? "nodownload nofullscreen" : "nodownload"}
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
        >
          <track kind="captions" />
        </video>
      ) : (
        <div className="cpm-no-video">
          <FiPlay size={42} />
          <p>{isTrailer ? t("coursePreview.noPreview") : t("coursePreview.noPreviewWeek")}</p>
        </div>
      )}
      {isIframeSource && !loaded && (
        loadTimedOut ? (
          <div className="cpm-loading cpm-loading--timeout" role="status">
            <p style={{ color: "#fff", textAlign: "center", padding: "0 1.5rem", fontSize: "0.85rem", lineHeight: 1.5, maxWidth: 320, margin: 0 }}>
              Le chargement prend plus de temps que prévu.
              {isDrive ? " Cela peut arriver si votre navigateur bloque les cookies tiers (ex : navigation privée)." : ""}
            </p>
            {isDrive && driveViewUrl && (
              <a
                className="cpm-timeout-link"
                href={driveViewUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FiExternalLink size={14} />
                <span>{t("coursePreview.openExternal")}</span>
              </a>
            )}
          </div>
        ) : (
          <div className="cpm-loading" aria-hidden="true">
            <span className="cpm-spinner" />
          </div>
        )
      )}
    </>
  );
}

export default function CoursePreviewModal({
  formation, week, onClose, onSelectWeek,
  isTrailer = false,
}) {
  const { t } = useTranslation();
  /* Scroll lock */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* Escape key */
  const handleKey = useCallback((e) => {
    if (e.key === "Escape" && !document.fullscreenElement && !document.webkitFullscreenElement) onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const videoUrl = resolveVideoUrl(week?.videoUrl) || "";
  const ytId = getYoutubeId(videoUrl);
  const isDrive = !!videoUrl && isGoogleDriveUrl(videoUrl);
  const driveFileId = isDrive ? extractDriveFileId(videoUrl) : null;
  const driveViewUrl = driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : null;

  /* Curseur custom bloqué au-dessus d'un iframe cross-origin (les mousemove
     internes à l'iframe ne remontent jamais au document parent — limitation
     navigateur). On informe CustomCursor.jsx via un événement global pour
     qu'il se masque et laisse place au curseur natif le temps du survol. */
  const handleIframeMouseEnter = useCallback(() => {
    window.dispatchEvent(new Event("customcursor:suspend"));
  }, []);
  const handleIframeMouseLeave = useCallback(() => {
    window.dispatchEvent(new Event("customcursor:resume"));
  }, []);
  useEffect(() => {
    // Filet de sécurité : si la modale se ferme pendant que la souris est
    // encore sur l'iframe, mouseleave ne se déclenche jamais — sans ce
    // nettoyage le curseur custom resterait masqué en permanence.
    return () => window.dispatchEvent(new Event("customcursor:resume"));
  }, []);

  /* Custom fullscreen for trailer (keeps blurred background layer) */
  const wrapperRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* Filet de sécurité pour le figement d'iframe observé avant tout scroll
     (voir .cpm-player-wrap en CSS pour la cause probable — backdrop-filter +
     transform persistant sur .cpm-overlay/.cpm-modal, ancêtres de l'iframe,
     empêchent le compositeur de le peindre tant qu'aucun repaint externe
     n'est déclenché). Un double rAF (attend deux peintures, pas juste une
     frame planifiée) force une lecture de layout juste après le premier
     affichage réel de la modale — le même effet qu'un scroll, sans attendre
     que l'utilisateur le fasse lui-même. */
  useEffect(() => {
    let raf2 = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (wrapperRef.current) void wrapperRef.current.offsetHeight;
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, []);

  useEffect(() => {
    if (!isTrailer) return;
    const onFsChange = () => {
      setIsFullscreen(
        document.fullscreenElement === wrapperRef.current ||
        document.webkitFullscreenElement === wrapperRef.current
      );
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, [isTrailer]);

  const handleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (isFullscreen) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    }
  }, [isFullscreen]);

  /* Detect which source array the current week belongs to */
  const isSupervision = useMemo(() => {
    if (!week || !formation) return false;
    return (formation.supervision ?? []).some(
      (s) => s.week === week.week && s.phase === week.phase
    );
  }, [formation, week]);

  /* Build the correct sorted list from the right source */
  const displayList = useMemo(() => {
    if (isTrailer) return [];
    const source = isSupervision
      ? (formation?.supervision ?? [])
      : (formation?.weeks ?? []);
    return [...source].sort((a, b) => a.week - b.week);
  }, [isTrailer, isSupervision, formation]);

  return (
    <div className="cpm-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className={`cpm-modal${isTrailer ? " cpm-modal--trailer" : ""}`} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="cpm-header">
          <div className="cpm-header__info">
            <span className="cpm-header__formation">{formation.title}</span>
            <span className="cpm-header__week">
              {isTrailer ? t("coursePreview.trailer") : t("coursePreview.weekHeading", { n: week.week, title: week.videoTitle || week.content })}
            </span>
          </div>
          <button className="cpm-close" onClick={onClose} aria-label={t("applications.closeModal")}>
            <FiX size={18} />
          </button>
        </div>

        {/* ── Lecteur vidéo 16:9 ──────────────────────────────────────── */}
        <div className="cpm-player-wrap" ref={wrapperRef}>
          {isTrailer && week?.thumbnail && (
            <div
              className="cpm-player-bg"
              style={{ backgroundImage: `url(${week.thumbnail})` }}
            />
          )}
          <VideoFrame
            key={videoUrl}
            ytId={ytId}
            isDrive={isDrive}
            videoUrl={videoUrl}
            isTrailer={isTrailer}
            week={week}
            t={t}
            onIframeEnter={handleIframeMouseEnter}
            onIframeLeave={handleIframeMouseLeave}
            driveViewUrl={driveViewUrl}
          />
          {isDrive && driveViewUrl && (
            <a
              className="cpm-external-link"
              href={driveViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={t("coursePreview.openExternalHint")}
            >
              <FiExternalLink size={13} />
              <span>{t("coursePreview.openExternal")}</span>
            </a>
          )}
          {isTrailer && (
            <button
              className="cpm-fullscreen-btn"
              onClick={handleFullscreen}
              aria-label={isFullscreen ? t("coursePreview.exitFullscreen") : t("coursePreview.fullscreen")}
            >
              {isFullscreen ? <FiMinimize size={15} /> : <FiMaximize size={15} />}
            </button>
          )}
        </div>

        {/* ── Liste des semaines (masquée en mode trailer) ─────────────── */}
        {!isTrailer && (
          <div className="cpm-list">
            <h4 className="cpm-list__title">
              {isSupervision ? t("coursePreview.supervisionSessions") : t("formationDetail.curriculum")}
            </h4>
            <div className="cpm-list__scroll">
              {displayList.map((w) => {
                const { src: thumbSrc, bg: thumbBg } = getWeekThumb(w, formation);
                const isActive = w.week === week.week && w.phase === week.phase;
                const hasVid = !!w.videoUrl;
                return (
                  <button
                    key={w.week}
                    className={`cpm-item${isActive ? " cpm-item--active" : ""}${!hasVid ? " cpm-item--locked" : ""}`}
                    onClick={() => hasVid && onSelectWeek(w)}
                    disabled={!hasVid}
                    aria-current={isActive ? "true" : undefined}
                  >
                    <div
                      className={`cpm-item__thumb${thumbBg ? " cpm-item__thumb--logo" : ""}`}
                      style={thumbBg ? { backgroundColor: thumbBg } : {}}
                    >
                      <img
                        src={thumbSrc}
                        alt=""
                        loading="lazy"
                        onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_THUMB.src; }}
                      />
                      {hasVid
                        ? <span className="cpm-item__play"><FiPlay size={9} /></span>
                        : <span className="cpm-item__lock"><FiLock size={10} /></span>
                      }
                      {w.duree && <span className="cpm-item__dur">{w.duree}</span>}
                    </div>
                    <div className="cpm-item__info">
                      <span className="cpm-item__label">
                        {t("formationDetail.week")} {w.week}
                        {isActive && <span className="cpm-item__now">{t("profileEditor.current")}</span>}
                      </span>
                      <span className="cpm-item__content">{w.content}</span>
                      {w.duree && <span className="cpm-item__dur-text">{w.duree}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
