import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FiX } from "react-icons/fi";
import { SCREENSHOT_FEEDBACKS } from "../../constants/screenshotTestimonials.js";
import "./TestimonialsScreenshotCarousel.css";

/**
 * Bande de captures d'écran de témoignages en défilement infini — même
 * logique/mécanique que TechMarquee (liste dupliquée x2, boucle CSS
 * translateX pure, pause au survol). Section indépendante du
 * VideoTestimonialCarousel, aucun état/donnée partagé.
 * Clic sur une carte : ouvre l'image en grand dans une lightbox, la boucle
 * en arrière-plan continue de tourner (aucun changement à cette mécanique).
 */
export default function TestimonialsScreenshotCarousel({ title, subtitle }) {
  const { t } = useTranslation();
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const overlayRef = useRef(null);

  const closeLightbox = useCallback(() => setLightboxSrc(null), []);

  useEffect(() => {
    if (!lightboxSrc) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") closeLightbox(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxSrc, closeLightbox]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) closeLightbox();
  };

  if (SCREENSHOT_FEEDBACKS.length === 0) return null;

  const track = [...SCREENSHOT_FEEDBACKS, ...SCREENSHOT_FEEDBACKS];

  return (
    <section id="screenshot-testimonials" className="stc-section">
      <div className="stc-section__inner">
        <div className="stc-header">
          <span className="stc-header__badge">💬 {t("testimonials.screenshotEyebrow")}</span>
          <h2 className="stc-header__title">{title}</h2>
          {subtitle && <p className="stc-header__sub">{subtitle}</p>}
        </div>

        <div className="stc-marquee">
          <div className="stc-marquee__track">
            {track.map((item, i) => (
              <button
                type="button"
                className="stc-badge"
                key={`${item.id}-${i}`}
                onClick={() => setLightboxSrc(item.src)}
                aria-label={t("testimonials.openScreenshotAria")}
              >
                <img src={item.src} alt="" className="stc-badge__img" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {lightboxSrc && (
        <div
          className="stc-lightbox-overlay"
          ref={overlayRef}
          onClick={handleOverlayClick}
          role="dialog"
          aria-modal="true"
        >
          <button type="button" className="stc-lightbox-close" onClick={closeLightbox} aria-label={t("applications.closeModal")}>
            <FiX size={20} />
          </button>
          <img src={lightboxSrc} alt="" className="stc-lightbox-img" />
        </div>
      )}
    </section>
  );
}
