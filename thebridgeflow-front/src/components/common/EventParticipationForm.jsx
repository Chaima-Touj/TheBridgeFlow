import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  User, UserRound, Mail, Phone, School, GraduationCap, CalendarDays, ChevronDown, Send, LoaderCircle,
  CircleAlert, CircleCheck, ShieldCheck,
} from "lucide-react";
import { eventsService } from "../../services/events.service.js";
import { eventParticipationService } from "../../services/eventParticipation.service.js";
import { useRecaptchaCheckbox } from "../../hooks/useRecaptchaCheckbox.jsx";
import {
  EMPTY_PARTICIPATION_FORM, STUDY_LEVELS, UPCOMING_INTEREST, buildParticipationPayload,
  participationErrorField, participationErrorKey, validateParticipationForm,
} from "../../utils/eventParticipation.js";
import "./EventParticipationForm.css";

const FIELD_ORDER = ["firstName", "lastName", "email", "phone", "university", "studyLevel"];
const LOCALES = { fr: "fr-FR", en: "en-GB", ar: "ar-TN" };
const FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

// Popup affichée UNIQUEMENT après une réponse positive du serveur.
// Le focus reste dans la popup (Tab / Maj+Tab) puis revient à returnFocusRef.
function SuccessModal({ duplicate, onClose, returnFocusRef }) {
  const { t } = useTranslation();
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const returnTarget = returnFocusRef?.current;
    buttonRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const nodes = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((node) => !node.disabled);
      if (!nodes.length) { event.preventDefault(); return; }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const inside = dialogRef.current.contains(document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === first)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (!inside || document.activeElement === last)) { event.preventDefault(); first.focus(); }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      returnTarget?.focus({ preventScroll: true });
    };
  }, [onClose, returnFocusRef]);

  return createPortal(
    <motion.div
      className="epf-modal-overlay"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.section
        ref={dialogRef}
        className="epf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        initial={{ opacity: 0, y: 24, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.16 } }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
      >
        <motion.span
          className="epf-modal__icon"
          aria-hidden="true"
          initial={{ scale: 0.4, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.12 }}
        >
          <CircleCheck size={40} strokeWidth={2} />
        </motion.span>
        <h2 id={titleId}>{t("eventParticipation.success.title")}</h2>
        <div id={messageId} className="epf-modal__body">
          <p>{t("eventParticipation.success.message")}</p>
          {duplicate && <p className="epf-modal__note">{t("eventParticipation.success.duplicateNote")}</p>}
        </div>
        <button ref={buttonRef} type="button" className="btn btn-primary epf-modal__close" onClick={onClose}>
          {t("eventParticipation.success.close")}
        </button>
      </motion.section>
    </motion.div>,
    document.body,
  );
}

/* Formulaire « Participer à nos événements » — partagé par la section Contact
   de la page d'accueil et la page /contact. Enregistre réellement la demande
   (POST /api/event-participation-requests). */
export default function EventParticipationForm({ className = "" }) {
  const { t, i18n } = useTranslation();
  const tp = (key, options) => t(`eventParticipation.${key}`, options);
  const baseId = useId();
  const fieldId = (field) => `${baseId}-${field}`;
  const locale = LOCALES[(i18n.resolvedLanguage || i18n.language || "fr").slice(0, 2)] || "fr-FR";
  const captcha = useRecaptchaCheckbox();
  const formRef = useRef(null);
  const submitRef = useRef(null);

  const [form, setForm] = useState(EMPTY_PARTICIPATION_FORM);
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  // Champ refusé par la validation du serveur (affiché sous ce champ).
  const [serverField, setServerField] = useState("");
  // Après un envoi en échec, le focus revient au champ en cause ou au bouton
  // (les contrôles désactivés pendant l'envoi perdent le focus).
  const [focusRequest, setFocusRequest] = useState(null);
  const [success, setSuccess] = useState(null);
  const [eventsReload, setEventsReload] = useState(0);
  const [events, setEvents] = useState({ status: "loading", items: [] });
  // Stable : la popup (focus, blocage du défilement) ne se réinitialise pas à chaque rendu.
  const closeSuccess = useCallback(() => setSuccess(null), []);

  // Met le champ au centre de l'écran : son libellé n'est pas caché sous la barre de navigation fixe.
  const focusField = useCallback((field) => {
    const input = formRef.current?.querySelector(`#${CSS.escape(`${baseId}-${field}`)}`);
    if (!input) return;
    input.focus({ preventScroll: true });
    // "instant" : un défilement animé serait interrompu par l'animation de l'alerte.
    input.closest(".epf-field")?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [baseId]);

  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.field) focusField(focusRequest.field);
    else submitRef.current?.focus();
  }, [focusRequest, focusField]);

  useEffect(() => {
    let active = true;
    eventsService.getPublic("upcoming")
      .then(({ data }) => {
        if (active) setEvents({ status: "ready", items: Array.isArray(data?.events) ? data.events : [] });
      })
      .catch(() => { if (active) setEvents({ status: "error", items: [] }); });
    return () => { active = false; };
  }, [eventsReload]);

  const errors = validateParticipationForm(form);
  const errorFor = (field) => {
    const key = ((attempted || touched[field]) && errors[field]) || (serverField === field ? "invalid" : "");
    return key ? tp(`errors.${key}`) : "";
  };
  const update = (field) => (event) => {
    setForm((previous) => ({ ...previous, [field]: event.target.value }));
    if (serverError) setServerError("");
    if (serverField === field) setServerField("");
  };
  const markTouched = (field) => () => setTouched((previous) => ({ ...previous, [field]: true }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setAttempted(true);
    const firstInvalid = FIELD_ORDER.find((field) => errors[field]);
    if (firstInvalid) {
      setServerError(tp("errors.fixFields"));
      // Après le rendu des messages d'erreur : défiler avant qu'ils ne
      // s'affichent annulerait le défilement (ancrage du navigateur).
      setFocusRequest({ field: firstInvalid });
      return;
    }
    if (captcha.missing) {
      setServerError(t("captcha.required"));
      return;
    }
    setSubmitting(true);
    setServerError("");
    setServerField("");
    try {
      const { data } = await eventParticipationService.submit(buildParticipationPayload(form), captcha.requestConfig);
      setSuccess({ duplicate: Boolean(data?.duplicate) });
      setForm(EMPTY_PARTICIPATION_FORM);
      setTouched({});
      setAttempted(false);
    } catch (error) {
      const key = participationErrorKey(error);
      const field = participationErrorField(error);
      setServerError(tp(`errors.${key}`));
      setServerField(field || "");
      if (key === "eventUnavailable") {
        setForm((previous) => ({ ...previous, interest: "" }));
        setEventsReload((value) => value + 1);
      }
      setFocusRequest({ field: key === "eventUnavailable" ? "interest" : field });
    } finally {
      setSubmitting(false);
      captcha.reset();
    }
  };

  const renderInput = (field, Icon, { type = "text", autoComplete, inputMode, dir } = {}) => {
    const message = errorFor(field);
    return (
      <div className={`epf-field ${message ? "epf-field--error" : ""}`}>
        <label htmlFor={fieldId(field)}>
          {tp(`fields.${field}`)} <span className="epf-required" aria-hidden="true">*</span>
        </label>
        <div className="epf-control">
          <Icon className="epf-control__icon" size={17} strokeWidth={1.9} aria-hidden="true" />
          <input
            id={fieldId(field)}
            type={type}
            value={form[field]}
            onChange={update(field)}
            onBlur={markTouched(field)}
            placeholder={tp(`placeholders.${field}`)}
            autoComplete={autoComplete}
            inputMode={inputMode}
            dir={dir}
            required
            aria-required="true"
            aria-invalid={Boolean(message)}
            aria-describedby={message ? `${fieldId(field)}-error` : undefined}
            disabled={submitting}
          />
        </div>
        {message && <p className="epf-error" id={`${fieldId(field)}-error`}>{message}</p>}
      </div>
    );
  };

  const levelError = errorFor("studyLevel");

  return (
    <MotionConfig reducedMotion="user">
      <form ref={formRef} className={`epf-form ${className}`} onSubmit={handleSubmit} noValidate aria-busy={submitting}>
        <div className="epf-grid">
          {renderInput("firstName", User, { autoComplete: "given-name" })}
          {renderInput("lastName", UserRound, { autoComplete: "family-name" })}
          {renderInput("email", Mail, { type: "email", autoComplete: "email", inputMode: "email", dir: "ltr" })}
          {renderInput("phone", Phone, { type: "tel", autoComplete: "tel", inputMode: "tel", dir: "ltr" })}
          <div className="epf-full">{renderInput("university", School, { autoComplete: "organization" })}</div>

          <div className={`epf-field ${levelError ? "epf-field--error" : ""}`}>
            <label htmlFor={fieldId("studyLevel")}>
              {tp("fields.studyLevel")} <span className="epf-required" aria-hidden="true">*</span>
            </label>
            <div className="epf-control epf-control--select">
              <GraduationCap className="epf-control__icon" size={17} strokeWidth={1.9} aria-hidden="true" />
              <select
                id={fieldId("studyLevel")}
                value={form.studyLevel}
                onChange={update("studyLevel")}
                onBlur={markTouched("studyLevel")}
                required
                aria-required="true"
                aria-invalid={Boolean(levelError)}
                aria-describedby={levelError ? `${fieldId("studyLevel")}-error` : undefined}
                disabled={submitting}
              >
                <option value="" disabled>{tp("placeholders.studyLevel")}</option>
                {STUDY_LEVELS.map((level) => <option key={level} value={level}>{tp(`levels.${level}`)}</option>)}
              </select>
              <ChevronDown className="epf-control__chevron" size={16} strokeWidth={1.9} aria-hidden="true" />
            </div>
            {levelError && <p className="epf-error" id={`${fieldId("studyLevel")}-error`}>{levelError}</p>}
          </div>

          <div className="epf-field">
            <label htmlFor={fieldId("interest")}>
              {tp("fields.event")} <span className="epf-optional">({tp("optional")})</span>
            </label>
            <div className="epf-control epf-control--select">
              <CalendarDays className="epf-control__icon" size={17} strokeWidth={1.9} aria-hidden="true" />
              <select id={fieldId("interest")} value={form.interest} onChange={update("interest")} disabled={submitting}>
                <option value="">{events.status === "loading" ? tp("eventsLoading") : tp("placeholders.event")}</option>
                {events.items.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.title}
                    {item.startsAt ? ` — ${new Date(item.startsAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}` : ""}
                  </option>
                ))}
                <option value={UPCOMING_INTEREST}>{tp("upcomingOption")}</option>
              </select>
              <ChevronDown className="epf-control__chevron" size={16} strokeWidth={1.9} aria-hidden="true" />
            </div>
            {events.status === "error" && <p className="epf-hint">{tp("eventsUnavailable")}</p>}
          </div>
        </div>

        <p className="epf-required-hint">{tp("requiredHint")}</p>

        <AnimatePresence initial={false}>
          {serverError && (
            <motion.div
              key="error"
              className="epf-alert"
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <CircleAlert size={17} strokeWidth={2} aria-hidden="true" />
              <span>{serverError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {captcha.widget}

        <button ref={submitRef} type="submit" className="btn btn-primary epf-submit" disabled={submitting}>
          {submitting
            ? <LoaderCircle className="epf-spin" size={17} strokeWidth={2} aria-hidden="true" />
            : <Send size={17} strokeWidth={2} aria-hidden="true" />}
          {submitting ? tp("submitting") : tp("submit")}
        </button>
        <p className="epf-privacy"><ShieldCheck size={14} strokeWidth={1.9} aria-hidden="true" />{tp("privacy")}</p>
      </form>

      <AnimatePresence>
        {success && <SuccessModal key="success" duplicate={success.duplicate} onClose={closeSuccess} returnFocusRef={submitRef} />}
      </AnimatePresence>
    </MotionConfig>
  );
}
