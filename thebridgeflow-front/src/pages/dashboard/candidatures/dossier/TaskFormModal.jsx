import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  ClipboardList, Pencil, LoaderCircle, TriangleAlert, Info, Phone, MessageCircle, Mail, Send, Lock, X, ShieldCheck,
} from "lucide-react";
import Modal from "../../../../components/common/Modal.jsx";
import { candidatesService } from "../../../../services/candidates.service.js";
import { TASK_TYPES, TASK_STATUSES, ICON_STROKE, getTaskType, toneClass } from "../candidatesConfig.js";
import {
  buildMailtoLink, buildTelLink, buildWhatsAppLink, createClientRequestId, getApiErrorCode,
  getApiErrorMessage, isNetworkError,
} from "../candidatesUtils.js";
import CandidateAvatar from "../shared/CandidateAvatar.jsx";
import {
  MAX_DESCRIPTION, MAX_TITLE, buildTaskPatch, buildTaskPayload, initialTaskForm, needsCompletionConfirmation, validateTaskForm,
} from "./dossierUtils.js";

const FORM_ID = "cnd-task-form";

/* Formulaire d'ajout / de modification d'une tâche de suivi. L'étudiant est
   imposé par le dossier ouvert (affiché en lecture seule, jamais saisi). */
export default function TaskFormModal({
  mode = "create", task = null, preset = {}, studentId, student, applications = [],
  onClose, onSaved, onConflict, onProposeInterview,
}) {
  const { t } = useTranslation();
  const tf = (key, options) => t(`adminCandidates.dossier.form.${key}`, options);
  const isEdit = mode === "edit" && Boolean(task);
  const [form, setForm] = useState(() => initialTaskForm({ task: isEdit ? task : null, preset }));
  const [clientRequestId] = useState(() => createClientRequestId());
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");

  const update = (patch) => setForm((previous) => ({ ...previous, ...patch }));
  const defaultTitle = form.type ? t(`adminCandidates.common.taskType.${form.type}`) : "";
  const title = form.titleTouched ? form.title : defaultTitle;
  const originalTask = isEdit ? task : null;
  const errors = validateTaskForm(form, { title, originalTask });
  const mustConfirm = needsCompletionConfirmation(form, originalTask);
  const typeMeta = form.type ? getTaskType(form.type) : null;
  const selectedApplication = applications.find((app) => String(app._id) === form.applicationId) || null;
  const fieldError = (key) => (attempted && errors[key] ? tf(`errors.${errors[key]}`, { max: key === "title" ? MAX_TITLE : MAX_DESCRIPTION }) : "");

  const selectType = (key) => {
    const meta = getTaskType(key);
    // Une note (toujours « terminée ») convertie en action repart « à faire » :
    // la réalisation devra être confirmée explicitement.
    const leavingNote = form.type === "note" && key !== "note";
    update({
      type: key,
      dueEnabled: form.dueEnabled || (!isEdit && meta.needsDueDate),
      ...(leavingNote ? { status: "pending", confirmDone: false } : {}),
    });
  };

  const contactLinks = {
    call: { href: buildTelLink(student?.phone), Icon: Phone, label: tf("contact.call") },
    whatsapp: { href: buildWhatsAppLink(student?.phone), Icon: MessageCircle, label: tf("contact.whatsapp"), external: true },
    email: { href: buildMailtoLink(student?.email), Icon: Mail, label: tf("contact.email") },
  };
  const contact = typeMeta?.contact ? contactLinks[form.type] : null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setAttempted(true);
    if (Object.keys(errors).length) return;
    setSubmitting(true);
    setError("");
    try {
      let response;
      if (isEdit) {
        const patch = buildTaskPatch(form, task, { title });
        if (!Object.keys(patch).length) {
          onClose();
          return;
        }
        response = await candidatesService.updateTask(studentId, task._id, { ...patch, expectedUpdatedAt: task.updatedAt });
      } else {
        response = await candidatesService.createTask(studentId, buildTaskPayload(form, { title, clientRequestId }));
      }
      onSaved(response.data.task, response.data.summary, { created: !isEdit, duplicate: Boolean(response.data.duplicate) });
    } catch (requestError) {
      const code = getApiErrorCode(requestError);
      const status = requestError?.response?.status;
      if (isEdit && status === 404) {
        onConflict("notFound");
        return;
      }
      if (code === "TASK_CONFLICT") {
        // Le formulaire reste ouvert (rien de ce qui a été saisi n'est perdu) ;
        // le parent recharge la tâche à jour, un nouvel envoi repart d'elle.
        setError(tf("conflictInline"));
        setSubmitting(false);
        onConflict("conflict");
        return;
      }
      if (code === "COMPLETION_CONFIRMATION_REQUIRED") setError(t("adminCandidates.common.errors.completionConfirm"));
      else if (isNetworkError(requestError)) setError(t("adminCandidates.common.errors.network"));
      else if (status === 429) setError(t("adminCandidates.common.errors.rateLimited"));
      else setError(getApiErrorMessage(requestError, t("adminCandidates.common.errors.generic")));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={isEdit ? tf("editTitle") : tf("createTitle")}
      titleIcon={isEdit
        ? <Pencil size={18} strokeWidth={ICON_STROKE} className="cnd-dos-modal-icon" aria-hidden="true" />
        : <ClipboardList size={18} strokeWidth={ICON_STROKE} className="cnd-dos-modal-icon" aria-hidden="true" />}
      onClose={submitting ? () => {} : onClose}
      maxWidth={680}
      className="cnd-scope cnd-dos-form-modal"
      footer={(
        <>
          <button type="button" className="cnd-btn cnd-btn--ghost" onClick={onClose} disabled={submitting}>
            {t("adminCandidates.common.actions.cancel")}
          </button>
          <button
            type="submit"
            form={FORM_ID}
            className="cnd-btn cnd-btn--primary"
            disabled={submitting || !form.type || (mustConfirm && !form.confirmDone)}
          >
            {submitting && <LoaderCircle className="cnd-spin" size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />}
            {submitting ? tf("saving") : isEdit ? tf("saveChanges") : tf("submit")}
          </button>
        </>
      )}
    >
      <form id={FORM_ID} className="cnd-dos-form" onSubmit={handleSubmit} noValidate>
        <div className="cnd-dos-form__student">
          <CandidateAvatar name={student?.name} avatarUrl={student?.avatarUrl} size="sm" />
          <span>
            <small>{tf("forStudent")}</small>
            <strong>{student?.name}</strong>
          </span>
          <Lock size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
          <span className="cnd-sr-only">{tf("studentLocked")}</span>
        </div>

        <fieldset className="cnd-dos-form__types">
          <legend className="cnd-label">{tf("typeLabel")}</legend>
          <div className="cnd-dos-type-grid" role="group" aria-label={tf("typeLabel")}>
            {TASK_TYPES.map(({ key, Icon, tone }) => {
              const selected = form.type === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  className={`cnd-dos-type ${toneClass(tone)} ${selected ? "cnd-dos-type--selected" : ""}`}
                  onClick={() => selectType(key)}
                >
                  <span className="cnd-icon-tile cnd-icon-tile--sm" aria-hidden="true"><Icon size={16} strokeWidth={ICON_STROKE} /></span>
                  <span className="cnd-dos-type__label">{t(`adminCandidates.common.taskAction.${key}`)}</span>
                </button>
              );
            })}
          </div>
          {attempted && errors.type && <p className="cnd-dos-field-error" role="alert">{tf("errors.typeRequired")}</p>}
        </fieldset>

        <AnimatePresence initial={false}>
          {contact && (
            <motion.div
              key="contact"
              className="cnd-dos-form__hint cnd-tone--blue"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Info size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
              <div>
                <p>{tf("contactHint")}</p>
                {contact.href ? (
                  <a className="cnd-btn cnd-btn--soft cnd-btn--sm cnd-tone--blue" href={contact.href} {...(contact.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    <contact.Icon size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
                    {contact.label}
                  </a>
                ) : (
                  <p className="cnd-muted">{form.type === "email" ? tf("contact.noEmail") : tf("contact.noPhone")}</p>
                )}
              </div>
            </motion.div>
          )}
          {form.type === "interview" && (
            <motion.div
              key="interview"
              className="cnd-dos-form__hint cnd-tone--violet"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Info size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
              <div>
                <p>{tf("interviewHint")}</p>
                {selectedApplication?.status === "en attente" && onProposeInterview && (
                  <button type="button" className="cnd-btn cnd-btn--soft cnd-btn--sm cnd-tone--violet" onClick={() => onProposeInterview(selectedApplication)}>
                    <Send size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
                    {tf("sendInvitation")}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="cnd-dos-form__grid">
          <div className="cnd-field cnd-dos-form__full">
            <label className="cnd-label" htmlFor="cnd-task-title">{tf("titleLabel")}</label>
            <input
              id="cnd-task-title"
              className="cnd-input"
              value={title}
              maxLength={MAX_TITLE + 20}
              onChange={(event) => update({ title: event.target.value, titleTouched: true })}
              placeholder={tf("titlePlaceholder")}
              aria-invalid={Boolean(fieldError("title"))}
            />
            {fieldError("title") && <p className="cnd-dos-field-error" role="alert">{fieldError("title")}</p>}
          </div>

          <div className="cnd-field">
            <label className="cnd-label" htmlFor="cnd-task-date">{tf("activityDateLabel")}</label>
            <input
              id="cnd-task-date"
              type="datetime-local"
              className="cnd-input"
              value={form.activityDate}
              onChange={(event) => update({ activityDate: event.target.value })}
              aria-invalid={Boolean(fieldError("activityDate"))}
            />
            {fieldError("activityDate") && <p className="cnd-dos-field-error" role="alert">{fieldError("activityDate")}</p>}
          </div>

          <div className="cnd-field">
            <span className="cnd-label" id="cnd-task-due-label">{tf("dueDateLabel")}</span>
            {form.dueEnabled ? (
              <div className="cnd-dos-form__due">
                <input
                  type="datetime-local"
                  className="cnd-input"
                  aria-labelledby="cnd-task-due-label"
                  value={form.dueDate}
                  onChange={(event) => update({ dueDate: event.target.value })}
                  aria-invalid={Boolean(fieldError("dueDate"))}
                />
                <button type="button" className="cnd-btn cnd-btn--ghost cnd-btn--icon" onClick={() => update({ dueEnabled: false, dueDate: "" })} aria-label={tf("removeDueDate")} title={tf("removeDueDate")}>
                  <X size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button type="button" className="cnd-btn cnd-btn--secondary cnd-dos-form__add-due" onClick={() => update({ dueEnabled: true })}>
                {tf("addDueDate")}
              </button>
            )}
            {fieldError("dueDate") && <p className="cnd-dos-field-error" role="alert">{fieldError("dueDate")}</p>}
          </div>

          <div className="cnd-field cnd-dos-form__full">
            <label className="cnd-label" htmlFor="cnd-task-app">{tf("applicationLabel")}</label>
            <select id="cnd-task-app" className="cnd-select" value={form.applicationId} onChange={(event) => update({ applicationId: event.target.value })}>
              <option value="">{tf("applicationNone")}</option>
              {applications.map((app) => (
                <option key={app._id} value={String(app._id)}>
                  {[app.offer?.title || t("adminCandidates.common.deletedOffer"), app.offer?.companyName].filter(Boolean).join(" — ")}
                </option>
              ))}
            </select>
          </div>

          {form.type !== "note" ? (
            <div className="cnd-field cnd-dos-form__full">
              <span className="cnd-label" id="cnd-task-status-label">{tf("statusLabel")}</span>
              <div className="cnd-seg cnd-dos-form__status" role="group" aria-labelledby="cnd-task-status-label">
                {TASK_STATUSES.map(({ key, Icon }) => {
                  const selected = form.status === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={selected}
                      className="cnd-seg__btn"
                      onClick={() => update({ status: key, confirmDone: key === "completed" ? form.confirmDone : false })}
                    >
                      {selected && <motion.span layoutId="cnd-dos-form-status" className="cnd-seg__indicator" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
                      <Icon size={15} strokeWidth={ICON_STROKE} aria-hidden="true" />
                      {t(`adminCandidates.common.taskStatus.${key}`)}
                    </button>
                  );
                })}
              </div>
              <AnimatePresence initial={false}>
                {mustConfirm && (
                  <motion.label
                    key="confirm"
                    className={`cnd-dos-confirm ${attempted && errors.confirmDone ? "cnd-dos-confirm--error" : ""}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <input type="checkbox" checked={form.confirmDone} onChange={(event) => update({ confirmDone: event.target.checked })} />
                    <ShieldCheck size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
                    <span>
                      <strong>{tf("confirmLabel")}</strong>
                      <small>{tf("confirmHelp")}</small>
                    </span>
                  </motion.label>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <p className="cnd-dos-form__note-hint cnd-dos-form__full">
              <Info size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
              {tf("noteHint")}
            </p>
          )}

          <div className="cnd-field cnd-dos-form__full">
            <label className="cnd-label" htmlFor="cnd-task-description">{tf("descriptionLabel")}</label>
            <textarea
              id="cnd-task-description"
              className="cnd-textarea"
              rows={4}
              value={form.description}
              onChange={(event) => update({ description: event.target.value })}
              placeholder={tf("descriptionPlaceholder")}
              aria-invalid={Boolean(fieldError("description"))}
            />
            <span className={`cnd-dos-form__counter cnd-num ${form.description.length > MAX_DESCRIPTION ? "cnd-dos-form__counter--over" : ""}`}>
              {form.description.length} / {MAX_DESCRIPTION}
            </span>
            {fieldError("description") && <p className="cnd-dos-field-error" role="alert">{fieldError("description")}</p>}
          </div>
        </div>

        {error && (
          <div className="cnd-alert cnd-tone--red" role="alert">
            <TriangleAlert size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
            <span className="cnd-alert__body">{error}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}
