import { useState } from "react";
import { TriangleAlert, Send } from "lucide-react";
import { interviewsService } from "../../../services/interviews.service.js";

/* Formulaire « Proposer un entretien » — extrait tel quel de l'ancienne page
   AdminApplications.jsx (même API : POST /api/interviews, même message par
   défaut, mêmes classes af-*), réutilisé par la vue « Par candidature » et par
   le dossier étudiant. La candidature passe « en cours » côté backend. */

function extractErrorMessage(err, fallback) {
  return err?.response?.data?.message || fallback;
}

/* Pré-remplit le message par défaut à partir de la date/heure/mode choisis —
   tant que l'admin n'a pas lui-même modifié le texte. */
function buildDefaultMessage(scheduledAt, mode) {
  if (!scheduledAt) return "";
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("fr-FR");
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const modeLabel = mode === "présentiel" ? "présentiel" : "en ligne";
  return `Nous vous proposons un entretien le ${date} à ${time} en ${modeLabel}. Merci de confirmer votre disponibilité.`;
}

export default function ProposeInterviewForm({ application, onCancel, onSubmitted, t }) {
  const [scheduledAt,    setScheduledAt]    = useState("");
  const [mode,           setMode]           = useState("en ligne");
  const [location,       setLocation]       = useState("");
  const [customMessage,  setCustomMessage]  = useState("");
  const [messageTouched, setMessageTouched] = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState("");

  const message = messageTouched
    ? customMessage
    : buildDefaultMessage(scheduledAt, mode);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!scheduledAt) {
      setError(t("adminCandidatures.errors.dateRequired"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { data } = await interviewsService.propose({
        applicationId: application._id,
        scheduledAt:   new Date(scheduledAt).toISOString(),
        mode,
        location,
        notes: message.trim(),
      });
      onSubmitted(data);
    } catch (err) {
      setError(extractErrorMessage(err, t("adminCandidatures.errors.interviewFailed")));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="af-form-row">
        <label className="label">{t("adminCandidatures.interviewDateLabel")}</label>
        <input
          type="datetime-local"
          className="input"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
        />
      </div>

      <div className="af-form-row">
        <label className="label">{t("adminCandidatures.interviewModeLabel")}</label>
        <select className="input" value={mode} onChange={(e) => { setMode(e.target.value); setLocation(""); }}>
          <option value="en ligne">{t("adminCandidatures.interviewModeOnline")}</option>
          <option value="présentiel">{t("adminCandidatures.interviewModeOnsite")}</option>
        </select>
      </div>

      <div className="af-form-row">
        <label className="label">{t("adminCandidatures.interviewLocationLabel")}</label>
        <input
          type="text"
          className="input"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={
            mode === "présentiel"
              ? t("adminCandidatures.interviewLocationPlaceholderOnsite")
              : t("adminCandidatures.interviewLocationPlaceholderOnline")
          }
        />
      </div>

      <div className="af-form-row">
        <label className="label">{t("adminCandidatures.interviewMessageLabel")}</label>
        <textarea
          className="input"
          rows={4}
          value={message}
          onChange={(e) => { setCustomMessage(e.target.value); setMessageTouched(true); }}
        />
      </div>

      {error && (
        <div className="af-form-error">
          <TriangleAlert size={15} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="modal-footer" style={{ padding: "16px 0 0", borderTop: "none" }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <Send size={14} aria-hidden="true" />
          {submitting ? t("adminCandidatures.interviewSubmitting") : t("adminCandidatures.interviewSubmit")}
        </button>
      </div>
    </form>
  );
}
