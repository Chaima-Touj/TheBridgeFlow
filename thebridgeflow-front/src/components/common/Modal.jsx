import { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FiX } from "react-icons/fi";
import "./Modal.css";

/**
 * Modal générique réutilisable (overlay + carte + header/body/footer).
 * Pattern repris de la modal déjà existante dans MyApplications.jsx (ma-overlay/ma-modal),
 * généralisé avec les classes CSS du thème plutôt que du contenu spécifique aux offres.
 */
export default function Modal({ title, onClose, children, footer, maxWidth = 520 }) {
  const { t } = useTranslation();
  const overlayRef = useRef(null);

  const handleOverlayClick = useCallback((e) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Lock body scroll while open — otherwise the page behind scrolls along
  // with (or instead of) the modal on touch devices.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth }}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t("applications.closeModal")}>
            <FiX size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
