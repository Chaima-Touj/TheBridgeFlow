import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, useScroll, useTransform } from "framer-motion";
import { FiPlay, FiX, FiExternalLink } from "react-icons/fi";
import { isGoogleDriveUrl, extractDriveFileId } from "../../constants/videoUrls.js";
import "./FormationTrailer.css";

/**
 * Vidéo résumé d'une formation — même design/comportement que la vidéo promo
 * de la Landing Page (LandingPage.jsx, section ".lp-promo-video") : cadre
 * "tablette" avec tilt 3D au scroll, aperçu autoplay muet gated par
 * IntersectionObserver, modale plein cadre au clic, lien de repli "ouvrir
 * dans Drive" (navigation privée = cookies tiers bloqués, l'iframe peut
 * rester coincée sur l'écran de connexion Google). Volontairement dupliqué
 * plutôt qu'importé depuis LandingPage.jsx/.css (page non touchée) — mêmes
 * classes CSS renommées sous le préfixe "ftv-".
 */
export default function FormationTrailer({ videoUrl }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const sectionRef = useRef(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const rotateX = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    isMobile ? [8, 3, 0, 0] : [18, 6, 0, -2]
  );
  const scale = useTransform(
    scrollYProgress,
    [0, 0.4, 0.7, 1],
    isMobile ? [0.97, 0.99, 1, 1] : [0.92, 0.97, 1, 1]
  );

  const isDrive = isGoogleDriveUrl(videoUrl);
  const driveEmbedSrc = videoUrl.includes("?")
    ? `${videoUrl}&autoplay=1&mute=1`
    : `${videoUrl}?autoplay=1&mute=1`;
  const driveFileId = isDrive ? extractDriveFileId(videoUrl) : null;
  const driveViewUrl = driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : null;

  const cardRef  = useRef(null);
  const videoRef = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isDrive) return; // iframe : géré par mount/unmount, pas par play()/pause()
    const v = videoRef.current;
    if (!v) return;
    if (inView) v.play().catch(() => {});
    else v.pause();
  }, [inView, isDrive]);

  return (
    <section className="ftv-trailer" id="formation-trailer" ref={sectionRef}>
      <div className="ftv-trailer__inner">

        <motion.div
          className="ftv-trailer__header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="ftv-trailer__badge">🎥 {t("formationDetail.trailerBadge")}</span>
          <h2 className="ftv-trailer__title">{t("formationDetail.trailerTitle")}</h2>
          <p className="ftv-trailer__sub">{t("formationDetail.trailerSubtitle")}</p>
        </motion.div>

        <motion.div style={{ perspective: "1000px", rotateX, scale }}>
          <div className="ftv-trailer__frame">
            <button
              className="ftv-trailer__card"
              ref={cardRef}
              onClick={() => setOpen(true)}
              aria-label={t("formationDetail.trailerPlayAriaLabel")}
            >
              {isDrive ? (
                inView && (
                  <iframe
                    className="ftv-trailer__preview"
                    src={driveEmbedSrc}
                    allow="autoplay; encrypted-media"
                    title={t("formationDetail.trailerVideoLabel")}
                    tabIndex={-1}
                  />
                )
              ) : (
                <video
                  ref={videoRef}
                  className="ftv-trailer__preview"
                  src={videoUrl}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  tabIndex={-1}
                />
              )}
              <div className="ftv-trailer__card-overlay" />
              <div className="ftv-trailer__play-ring">
                <FiPlay size={28} />
              </div>
              <div className="ftv-trailer__caption">
                <span className="ftv-trailer__caption-label">{t("formationDetail.trailerVideoLabel")}</span>
                <span className="ftv-trailer__caption-sub">{t("formationDetail.trailerVideoSub")}</span>
              </div>
            </button>
          </div>
        </motion.div>
      </div>

      {open && (
        <div
          className="ftv-trailer__overlay"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t("formationDetail.trailerModalAriaLabel")}
        >
          <motion.div
            className="ftv-trailer__modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22 }}
          >
            <button
              className="ftv-trailer__modal-close"
              onClick={() => setOpen(false)}
              aria-label={t("applications.closeModal")}
            >
              <FiX size={18} />
            </button>
            {isDrive && driveViewUrl && (
              <a
                className="ftv-trailer__modal-external"
                href={driveViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={t("coursePreview.openExternalHint")}
              >
                <FiExternalLink size={13} />
                <span>{t("coursePreview.openExternal")}</span>
              </a>
            )}
            {isDrive ? (
              <iframe
                className="ftv-trailer__modal-video"
                src={videoUrl}
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={t("formationDetail.trailerModalAriaLabel")}
              />
            ) : (
              <video
                className="ftv-trailer__modal-video"
                src={videoUrl}
                controls
                autoPlay
                preload="metadata"
                controlsList="nodownload"
                disablePictureInPicture
                onContextMenu={(e) => e.preventDefault()}
              >
                <track kind="captions" />
              </video>
            )}
          </motion.div>
        </div>
      )}
    </section>
  );
}
