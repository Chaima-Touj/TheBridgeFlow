import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCheckCircle, FiX } from "react-icons/fi";
import { enrollmentRequestsService } from "../../services/enrollmentRequests.service.js";
import "./EnrollmentRequestModal.css";

export default function EnrollmentRequestModal({ formation, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("Présentiel");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alreadySent, setAlreadySent] = useState(false);
  const [requestError, setRequestError] = useState("");

  const modes = [
    { value: "Présentiel", label: t("dfd.modeOnsite") },
    { value: "En ligne", label: t("dfd.modeOnline") },
  ];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const handleKey = useCallback((event) => {
    if (event.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setRequestError("");
    try {
      await enrollmentRequestsService.create(formation._id, mode, message);
      onSuccess();
      onClose();
    } catch (error) {
      if (error?.response?.status === 409) {
        setAlreadySent(true);
      } else {
        setRequestError(
          error?.response?.data?.message || error?.message || t("dfd.submitError")
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dfd-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="dfd-modal" onClick={(event) => event.stopPropagation()}>
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
            <fieldset className="dfd-modal__fieldset">
              <legend className="dfd-modal__legend">{t("dfd.modeLegend")}</legend>
              <div className="dfd-modal__radios">
                {modes.map((item) => (
                  <label
                    key={item.value}
                    className={`dfd-modal__radio${mode === item.value ? " dfd-modal__radio--active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={item.value}
                      checked={mode === item.value}
                      onChange={() => setMode(item.value)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="dfd-modal__label">
              {t("dfd.messageLabel")}
              <textarea
                className="dfd-modal__textarea"
                placeholder={t("dfd.messagePlaceholder")}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                maxLength={800}
              />
            </label>

            {requestError && (
              <div className="dfd-modal__error" role="alert">
                {requestError}
              </div>
            )}

            <button type="submit" className="dfd-modal__submit" disabled={submitting}>
              {submitting ? t("dfd.submitting") : t("dfd.submitBtn")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function EnrollmentRequestToast({ visible }) {
  const { t } = useTranslation();
  return (
    <div className={`dfd-toast${visible ? " dfd-toast--visible" : ""}`} role="status">
      <FiCheckCircle size={16} />
      {t("dfd.toastSuccess")}
    </div>
  );
}
