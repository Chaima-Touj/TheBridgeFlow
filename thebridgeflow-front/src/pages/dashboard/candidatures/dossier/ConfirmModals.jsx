import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck, LoaderCircle, ShieldCheck, TriangleAlert, UserCheck, UserX } from "lucide-react";
import Modal from "../../../../components/common/Modal.jsx";
import { ICON_STROKE } from "../candidatesConfig.js";

/* Confirmation EXPLICITE avant de marquer une tâche comme terminée : un clic
   sur « Appeler » ou « WhatsApp » ne prouve pas que l'échange a eu lieu. */
export function CompletionConfirmModal({ task, loading, error, onCancel, onConfirm }) {
  const { t } = useTranslation();
  const tc = (key, options) => t(`adminCandidates.dossier.completion.${key}`, options);
  const [checked, setChecked] = useState(false);
  return (
    <Modal
      title={tc("title")}
      titleIcon={<CircleCheck size={18} strokeWidth={ICON_STROKE} className="cnd-dos-modal-icon cnd-dos-modal-icon--success" aria-hidden="true" />}
      onClose={loading ? () => {} : onCancel}
      maxWidth={500}
      className="cnd-scope cnd-dos-confirm-modal"
      footer={(
        <>
          <button type="button" className="cnd-btn cnd-btn--ghost" onClick={onCancel} disabled={loading}>{t("adminCandidates.common.actions.cancel")}</button>
          <button type="button" className="cnd-btn cnd-btn--primary" onClick={onConfirm} disabled={!checked || loading}>
            {loading && <LoaderCircle className="cnd-spin" size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />}
            {tc("confirm")}
          </button>
        </>
      )}
    >
      <p className="cnd-dos-confirm-text">{tc("question", { title: task.title })}</p>
      <label className="cnd-dos-confirm">
        <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} autoFocus />
        <ShieldCheck size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
        <span>
          <strong>{t("adminCandidates.dossier.form.confirmLabel")}</strong>
          <small>{t("adminCandidates.dossier.form.confirmHelp")}</small>
        </span>
      </label>
      {error && (
        <div className="cnd-alert cnd-tone--red" role="alert">
          <TriangleAlert size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
          <span className="cnd-alert__body">{error}</span>
        </div>
      )}
    </Modal>
  );
}

// Accepter / refuser une candidature : l'étudiant est notifié (in-app + email).
export function DecisionConfirmModal({ application, decision, loading, error, studentName, onCancel, onConfirm }) {
  const { t } = useTranslation();
  const td = (key, options) => t(`adminCandidates.dossier.decision.${key}`, options);
  const accept = decision === "accept";
  const Icon = accept ? UserCheck : UserX;
  return (
    <Modal
      title={td(accept ? "acceptTitle" : "rejectTitle")}
      titleIcon={<Icon size={18} strokeWidth={ICON_STROKE} className={`cnd-dos-modal-icon ${accept ? "cnd-dos-modal-icon--success" : "cnd-dos-modal-icon--danger"}`} aria-hidden="true" />}
      onClose={loading ? () => {} : onCancel}
      maxWidth={500}
      className="cnd-scope cnd-dos-confirm-modal"
      footer={(
        <>
          {/* Refus irréversible (email envoyé) : le focus initial va sur Annuler. */}
          <button type="button" className="cnd-btn cnd-btn--ghost" onClick={onCancel} disabled={loading} autoFocus={!accept}>{t("adminCandidates.common.actions.cancel")}</button>
          <button type="button" className={`cnd-btn ${accept ? "cnd-btn--primary" : "cnd-btn--danger"}`} onClick={onConfirm} disabled={loading} autoFocus={accept}>
            {loading && <LoaderCircle className="cnd-spin" size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />}
            {td(accept ? "acceptConfirm" : "rejectConfirm")}
          </button>
        </>
      )}
    >
      <p className="cnd-dos-confirm-text">
        {td(accept ? "acceptText" : "rejectText", { name: studentName, offer: application.offer?.title || t("adminCandidates.common.deletedOffer") })}
      </p>
      <p className="cnd-dos-confirm-note">{td("notifyNote")}</p>
      {error && (
        <div className="cnd-alert cnd-tone--red" role="alert">
          <TriangleAlert size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
          <span className="cnd-alert__body">{error}</span>
        </div>
      )}
    </Modal>
  );
}
