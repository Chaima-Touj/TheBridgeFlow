import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiX, FiPlay, FiLock, FiMaximize, FiMinimize } from "react-icons/fi";
import { DEFAULT_THUMB, getWeekThumb } from "../../utils/thumbUtils.js";
import { resolveVideoUrl, isGoogleDriveUrl, resolveDriveUrl } from "../../constants/videoUrls.js";
import "./CoursePreviewModal.css";

function getYoutubeId(url = "") {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&\s]{11})/);
  return m ? m[1] : null;
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

  /* Custom fullscreen for trailer (keeps blurred background layer) */
  const wrapperRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
          {ytId ? (
            <iframe
              className="cpm-iframe"
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`}
              title={isTrailer ? t("coursePreview.trailer") : week.content}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
            />
          ) : videoUrl && isGoogleDriveUrl(videoUrl) ? (
            <iframe
              className="cpm-iframe"
              src={resolveDriveUrl(videoUrl, "video")}
              title={isTrailer ? t("coursePreview.trailer") : week.content}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
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
