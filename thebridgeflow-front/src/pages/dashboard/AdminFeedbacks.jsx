import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  FiPlus, FiAlertTriangle, FiImage,
  FiExternalLink, FiVideo, FiStar, FiEye, FiEyeOff, FiDownload,
  FiCheckCircle, FiCalendar, FiMessageSquare, FiArrowLeft, FiChevronRight,
  FiUpload, FiX, FiHardDrive,
} from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import Modal from "../../components/common/Modal.jsx";
import DestructiveActionModal from "../../components/common/DestructiveActionModal.jsx";
import AdminRowActions from "../../components/common/AdminRowActions.jsx";
import { settingsService } from "../../services/settings.service.js";
import { feedbacksService } from "../../services/feedbacks.service.js";
import { eventsService } from "../../services/events.service.js";
import { compressImageToBase64 } from "../../utils/imageCompression.js";
import { downloadCSV } from "../../utils/exportTable.js";
import { isGoogleDriveUrl, resolveDriveUrl, resolveDriveThumbnailProxyUrl } from "../../constants/videoUrls.js";
import { resolveMediaUrl } from "../../utils/testimonialMedia.js";
import { captureVideoPoster } from "../../utils/videoPoster.js";
import { uploadVideoInChunks, videoFileProblem, VIDEO_UPLOAD_ACCEPT } from "../../services/mediaUpload.service.js";
import "./StudentDashboard.css";
import "./AdminFormations.css";
import "./AdminNews.css";
import "./AdminFeedbacks.css";

const TABS = [
  { id: "formations",   labelKey: "adminFeedbacks.tabs.formations" },
  { id: "summer-camp",  labelKey: "adminFeedbacks.tabs.summerCamp" },
  { id: "pfe",          labelKey: "adminFeedbacks.tabs.pfe" },
  { id: "landing-video", labelKey: "adminFeedbacks.tabs.landingVideo" },
  { id: "screenshots",  labelKey: "adminFeedbacks.tabs.screenshots" },
  { id: "events", labelKey: "adminFeedbacks.tabs.events" },
];

// L'onglet "formations" gère SiteSettings.testimonialVideos dont
// category="formation" (vidéos portraits/ambiance des étudiants, confirmé
// visuellement — pas "summer-camp", qui montre en réalité des captures
// d'écran/salles de formation). Les ids d'onglet "summer-camp"/"pfe"
// correspondent déjà tels quels à leur valeur category.
const TAB_CATEGORY = {
  formations: "formation",
  "summer-camp": "summer-camp",
  pfe: "pfe",
};
const TESTIMONIAL_TABS = ["formations", "summer-camp", "pfe"];

function extractErrorMessage(err, fallback) {
  return err?.response?.data?.message || fallback;
}

function EventFeedbacksPanel() {
  const { t, i18n } = useTranslation();
  const [events, setEvents] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [publishingId, setPublishingId] = useState("");
  const [publishingSelection, setPublishingSelection] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState(null);

  const loadFeedbacks = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await eventsService.getAdminFeedbacks();
      setEvents(data.events || []);
      setFeedbacks(data.feedbacks || []);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t("adminFeedbacks.eventFeedbacks.loadFailed")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let active = true;
    eventsService.getAdminFeedbacks()
      .then(({ data }) => {
        if (!active) return;
        setEvents(data.events || []);
        setFeedbacks(data.feedbacks || []);
      })
      .catch((error) => {
        if (active) setLoadError(extractErrorMessage(error, t("adminFeedbacks.eventFeedbacks.loadFailed")));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [t]);

  const selectedEvent = events.find((event) => event._id === selectedEventId);
  const eventFeedbacks = feedbacks.filter((feedback) => feedback.event?._id === selectedEventId);
  const selectedFeedbacks = eventFeedbacks.filter((feedback) => selectedIds.includes(feedback._id));
  const canPublish = selectedEvent?.status === "published";
  const allSelected = eventFeedbacks.length > 0 && selectedFeedbacks.length === eventFeedbacks.length;
  const pendingSelected = selectedFeedbacks.some((feedback) => !feedback.isPublished);
  const publishedSelected = selectedFeedbacks.some((feedback) => feedback.isPublished);

  const toggleSelection = (id) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  };

  const toggleAll = () => {
    setSelectedIds((current) => current.length === eventFeedbacks.length
      ? []
      : eventFeedbacks.map((feedback) => feedback._id));
  };

  const setPublication = async (feedback, isPublished) => {
    setPublishingId(feedback._id);
    setActionError("");
    try {
      await eventsService.setFeedbackPublished(feedback._id, isPublished);
      setFeedbacks((current) => current.map((item) => item._id === feedback._id
        ? { ...item, isPublished, publishedAt: isPublished ? new Date().toISOString() : null }
        : item));
    } catch (error) {
      setActionError(extractErrorMessage(error, t("adminFeedbacks.eventFeedbacks.publishFailed")));
    } finally {
      setPublishingId("");
    }
  };

  const setSelectedPublication = async (isPublished) => {
    setPublishingSelection(true);
    setActionError("");
    try {
      await Promise.all(selectedFeedbacks
        .filter((feedback) => feedback.isPublished !== isPublished)
        .map((feedback) => eventsService.setFeedbackPublished(feedback._id, isPublished)));
      setFeedbacks((current) => current.map((feedback) => selectedIds.includes(feedback._id)
        ? { ...feedback, isPublished, publishedAt: isPublished ? new Date().toISOString() : null }
        : feedback));
    } catch (error) {
      setActionError(extractErrorMessage(error, t("adminFeedbacks.eventFeedbacks.publishFailed")));
      await loadFeedbacks();
    } finally {
      setPublishingSelection(false);
    }
  };

  const downloadSelected = () => {
    downloadCSV(
      "feedback-evenements.csv",
      [
        t("adminFeedbacks.eventFeedbacks.event"),
        t("adminFeedbacks.eventFeedbacks.participant"),
        t("adminFeedbacks.eventFeedbacks.rating"),
        t("adminFeedbacks.eventFeedbacks.comment"),
        t("adminFeedbacks.eventFeedbacks.receivedAt"),
        t("adminFeedbacks.eventFeedbacks.published"),
      ],
      selectedFeedbacks.map((feedback) => [
        feedback.event?.title || "",
        `${feedback.firstName} ${feedback.lastName}`,
        feedback.rating,
        feedback.comment,
        new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(feedback.createdAt)),
        feedback.isPublished ? t("adminFeedbacks.eventFeedbacks.published") : t("adminFeedbacks.eventFeedbacks.unpublished"),
      ]),
    );
  };

  if (loading) {
    return <div className="sd-skeleton afd-event-feedback__loading" role="status">{t("adminFeedbacks.eventFeedbacks.loading")}</div>;
  }
  if (loadError) {
    return (
      <div className="sd-empty-box afd-event-feedback__empty" role="alert">
        <p>{loadError}</p>
        <button type="button" className="btn btn-primary" onClick={loadFeedbacks}>{t("common.retry")}</button>
      </div>
    );
  }

  if (!selectedEventId) {
    return (
      <section className="afd-event-feedback" aria-label={t("adminFeedbacks.tabs.events")}>
        <div className="afd-event-feedback__intro">
          <p>{t("adminFeedbacks.eventFeedbacks.description")}</p>
        </div>
        {events.length === 0 ? (
          <div className="sd-empty-box afd-event-feedback__empty">
            <FiCalendar size={26} />
            <p>{t("adminFeedbacks.eventFeedbacks.noPastEvents")}</p>
          </div>
        ) : (
          <div className="afd-event-feedback__events">
            {events.map((event) => {
              const reviewCount = feedbacks.filter((feedback) => feedback.event?._id === event._id).length;
              return (
                <button
                  type="button"
                  className="afd-event-feedback__event-card"
                  key={event._id}
                  onClick={() => {
                    setSelectedIds([]);
                    setSelectedEventId(event._id);
                  }}
                >
                  <span className="afd-event-feedback__event-icon"><FiCalendar size={19} /></span>
                  <span className="afd-event-feedback__event-info">
                    <strong>{event.title}</strong>
                    <small>{new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeZone: event.timezone || "Africa/Tunis" }).format(new Date(event.endsAt || event.startsAt))}</small>
                  </span>
                  <span className="afd-event-feedback__event-count">
                    {t("adminFeedbacks.eventFeedbacks.reviewsCount", { count: reviewCount })}
                  </span>
                  <FiChevronRight className="afd-event-feedback__event-arrow" size={18} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="afd-event-feedback" aria-label={t("adminFeedbacks.tabs.events")}>
      <div className="afd-event-feedback__selected-header">
        <button type="button" className="btn btn-ghost" onClick={() => { setSelectedEventId(""); setSelectedIds([]); }}>
          <FiArrowLeft size={16} /> {t("adminFeedbacks.eventFeedbacks.backToEvents")}
        </button>
        <div>
          <h2>{selectedEvent?.title}</h2>
          {selectedEvent && (
            <small>{new Intl.DateTimeFormat(i18n.language, { dateStyle: "full", timeZone: selectedEvent.timezone || "Africa/Tunis" }).format(new Date(selectedEvent.endsAt || selectedEvent.startsAt))}</small>
          )}
        </div>
      </div>
      {selectedEvent && !canPublish && (
        <p className="afd-event-feedback__archived-note" role="note">
          {t("adminFeedbacks.eventFeedbacks.cannotPublish")}
        </p>
      )}
      <div className="afd-event-feedback__intro">
        <p>{t("adminFeedbacks.eventFeedbacks.description")}</p>
        <div className="afd-event-feedback__actions">
          {pendingSelected && canPublish && (
            <button type="button" className="btn btn-primary" onClick={() => setSelectedPublication(true)} disabled={publishingSelection}>
              <FiEye size={16} /> {t("adminFeedbacks.eventFeedbacks.publishSelected", { count: selectedFeedbacks.length })}
            </button>
          )}
          {publishedSelected && (
            <button type="button" className="btn btn-outline" onClick={() => setSelectedPublication(false)} disabled={publishingSelection}>
              <FiEyeOff size={16} /> {t("adminFeedbacks.eventFeedbacks.unpublishSelected", { count: selectedFeedbacks.length })}
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={downloadSelected} disabled={!selectedFeedbacks.length}>
            <FiDownload size={16} /> {t("adminFeedbacks.eventFeedbacks.downloadSelected", { count: selectedFeedbacks.length })}
          </button>
        </div>
      </div>
      {actionError && <p className="af-form-error" role="alert">{actionError}</p>}
      {eventFeedbacks.length === 0 ? (
        <div className="sd-empty-box afd-event-feedback__empty">
          <FiMessageSquare size={26} />
          <p>{t("adminFeedbacks.eventFeedbacks.empty")}</p>
        </div>
      ) : (
        <>
          <label className="afd-event-feedback__select-all">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            {t("adminFeedbacks.eventFeedbacks.selectAll")}
            <span>{eventFeedbacks.length}</span>
          </label>
          <div className="afd-event-feedback__grid">
            {eventFeedbacks.map((feedback) => (
              <article className={`afd-event-feedback__card${selectedIds.includes(feedback._id) ? " is-selected" : ""}`} key={feedback._id}>
                <label className="afd-event-feedback__checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(feedback._id)}
                    onChange={() => toggleSelection(feedback._id)}
                    aria-label={`${t("adminFeedbacks.eventFeedbacks.selectAll")} ${feedback.firstName} ${feedback.lastName}`}
                  />
                </label>
                <button
                  type="button"
                  className="afd-event-feedback__read"
                  onClick={() => setActiveFeedback(feedback)}
                  aria-label={`${t("adminFeedbacks.eventFeedbacks.readReview")} — ${feedback.firstName} ${feedback.lastName}`}
                  title={t("adminFeedbacks.eventFeedbacks.readReview")}
                >
                  <FiEye size={16} aria-hidden="true" />
                </button>
                <div className="afd-event-feedback__person">
                  {feedback.image
                    ? <img src={feedback.image} alt="" />
                    : <span aria-hidden="true">{feedback.firstName?.charAt(0) || ""}</span>}
                  <div>
                    <strong>{feedback.firstName} {feedback.lastName}</strong>
                    <small>{feedback.student?.name || t("adminFeedbacks.eventFeedbacks.verified")}</small>
                  </div>
                </div>
                <div className="afd-event-feedback__event">
                  <FiCalendar size={14} />
                  <span>{feedback.event?.title || t("adminFeedbacks.eventFeedbacks.event")}</span>
                </div>
                <div className="afd-event-feedback__rating" aria-label={t("events.feedback.ratingLabel", { rating: feedback.rating })}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <FiStar key={index} className={index < feedback.rating ? "is-filled" : ""} aria-hidden="true" />
                  ))}
                  <span>{feedback.rating}/5</span>
                </div>
                <p className="afd-event-feedback__comment">{feedback.comment}</p>
                <div className="afd-event-feedback__footer">
                  <span className={feedback.isPublished ? "is-published" : ""}>
                    <FiCheckCircle size={14} />
                    {t(feedback.isPublished ? "adminFeedbacks.eventFeedbacks.published" : "adminFeedbacks.eventFeedbacks.unpublished")}
                  </span>
                  <small>{new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(feedback.createdAt))}</small>
                </div>
                <button
                  type="button"
                  className={`afd-event-feedback__publish${feedback.isPublished ? " is-published" : ""}`}
                  onClick={() => setPublication(feedback, !feedback.isPublished)}
                  disabled={publishingId === feedback._id || (!feedback.isPublished && !canPublish)}
                  aria-pressed={feedback.isPublished}
                  title={!feedback.isPublished && !canPublish ? t("adminFeedbacks.eventFeedbacks.cannotPublish") : undefined}
                >
                  {feedback.isPublished ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  {t(feedback.isPublished ? "adminFeedbacks.eventFeedbacks.unpublish" : "adminFeedbacks.eventFeedbacks.publish")}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
      {activeFeedback && (
        <Modal
          title={t("adminFeedbacks.eventFeedbacks.reviewDetails")}
          onClose={() => setActiveFeedback(null)}
          maxWidth={600}
          className="afd-event-feedback__detail-modal"
          footer={<button type="button" className="btn btn-primary" onClick={() => setActiveFeedback(null)}>{t("common.close")}</button>}
        >
          <div className="afd-event-feedback__detail">
            <div className="afd-event-feedback__detail-person">
              {activeFeedback.image
                ? <img src={activeFeedback.image} alt="" />
                : <span aria-hidden="true">{activeFeedback.firstName?.charAt(0) || ""}</span>}
              <div>
                <strong>{activeFeedback.firstName} {activeFeedback.lastName}</strong>
                <small>{activeFeedback.student?.name || t("adminFeedbacks.eventFeedbacks.verified")}</small>
              </div>
            </div>
            <div className="afd-event-feedback__detail-meta">
              <span><FiCalendar size={15} />{activeFeedback.event?.title || selectedEvent?.title}</span>
              <small>{new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(activeFeedback.createdAt))}</small>
            </div>
            <div className="afd-event-feedback__rating" aria-label={t("events.feedback.ratingLabel", { rating: activeFeedback.rating })}>
              {Array.from({ length: 5 }, (_, index) => (
                <FiStar key={index} className={index < activeFeedback.rating ? "is-filled" : ""} aria-hidden="true" />
              ))}
              <span>{activeFeedback.rating}/5</span>
            </div>
            <p className="afd-event-feedback__detail-comment">{activeFeedback.comment}</p>
            {activeFeedback.image && <img className="afd-event-feedback__detail-image" src={activeFeedback.image} alt={t("adminFeedbacks.eventFeedbacks.reviewImage")} />}
            <span className={`afd-event-feedback__detail-status${activeFeedback.isPublished ? " is-published" : ""}`}>
              <FiCheckCircle size={15} />
              {t(activeFeedback.isPublished ? "adminFeedbacks.eventFeedbacks.published" : "adminFeedbacks.eventFeedbacks.unpublished")}
            </span>
          </div>
        </Modal>
      )}
    </section>
  );
}

/* ─── Champ image réutilisable — bascule lien Google Drive / upload local
     (base64, compression client canvas 800px, voir imageCompression.js).
     Même pattern que le champ image des formations/actualités. ─────────────── */
function DriveOrUploadField({ value, onChange, label, hint }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState(value?.startsWith("data:image/") ? "upload" : "drive");
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    setError("");
    try {
      const base64 = await compressImageToBase64(file, { maxWidth: 800, quality: 0.8 });
      onChange(base64);
    } catch (err) {
      setError(err.message || t("adminFormations.errors.thumbnailUploadFailed"));
    } finally {
      setCompressing(false);
      e.target.value = "";
    }
  };

  return (
    <div className="af-form-row">
      {label && <label className="label">{label}</label>}
      <div className="af-thumb-mode-toggle">
        <button type="button" className={`af-thumb-mode-btn${mode === "drive" ? " af-thumb-mode-btn--active" : ""}`} onClick={() => setMode("drive")}>
          {t("adminFormations.thumbnailModeDrive")}
        </button>
        <button type="button" className={`af-thumb-mode-btn${mode === "upload" ? " af-thumb-mode-btn--active" : ""}`} onClick={() => setMode("upload")}>
          {t("adminFormations.thumbnailModeUpload")}
        </button>
      </div>

      {mode === "upload" ? (
        <>
          {/* Bouton + champ fichier caché (même modèle que l'image des
              actualités) : un <label> séparé du champ n'ouvrait jamais le
              sélecteur de fichiers. */}
          <button
            type="button"
            className="an-image-upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={compressing}
          >
            {value?.startsWith("data:image/") || (value && !isGoogleDriveUrl(value)) ? (
              <img src={value} alt="" className="an-image-preview" />
            ) : (
              <div className="an-image-placeholder">
                <FiImage size={20} />
                <span>{t("adminFormations.videoThumbnailChoose")}</span>
              </div>
            )}
            {compressing && <div className="af-video-thumb-uploading">{t("adminFormations.inProgress")}</div>}
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} hidden />
        </>
      ) : (
        <>
          <input
            className="input"
            placeholder="https://drive.google.com/file/d/..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {value && isGoogleDriveUrl(value) && (
            <div className="af-video-thumb-drive-preview">
              <img
                src={resolveDriveUrl(value, "image")}
                alt=""
                className="af-video-thumb-preview"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            </div>
          )}
        </>
      )}
      {hint && !error && <span className="afd-field-hint">{hint}</span>}
      {error && <span className="af-field-error">{error}</span>}
    </div>
  );
}

/* ─── Champ vidéo — bascule lien Google Drive / vidéo envoyée depuis le PC.
     value : { mode: "drive" | "upload", driveUrl, uploadUrl }. L'envoi
     commence dès le choix du fichier (en morceaux, avec progression) ;
     uploadUrl reçoit alors /uploads/testimonials/<id>.<ext>. onBusyChange
     signale un envoi en cours (bouton Enregistrer bloqué), onVideoFile reçoit
     le fichier choisi (miniature automatique). ──────────────────────────────── */
function VideoSourceField({ id, label, value, onChange, onBusyChange, onVideoFile, error }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [fileName, setFileName] = useState("");
  const uploading = progress !== null;

  // Fenêtre fermée pendant un envoi : on l'interrompt.
  useEffect(() => () => abortRef.current?.abort(), []);

  const setMode = (mode) => onChange({ ...value, mode });

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = videoFileProblem(file);
    if (problem) {
      setUploadError(t(problem === "size" ? "adminFeedbacks.video.tooLarge" : "adminFeedbacks.video.typeInvalid"));
      return;
    }
    setUploadError("");
    setFileName(file.name);
    onVideoFile?.(file);
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);
    onBusyChange?.(true);
    try {
      const uploadUrl = await uploadVideoInChunks(file, { signal: controller.signal, onProgress: setProgress });
      onChange({ ...value, mode: "upload", uploadUrl });
    } catch (err) {
      if (!controller.signal.aborted) setUploadError(err?.response?.data?.message || t("adminFeedbacks.video.uploadFailed"));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setProgress(null);
      onBusyChange?.(false);
    }
  };

  const cancelUpload = () => abortRef.current?.abort();
  const percent = Math.round((progress || 0) * 100);

  return (
    <div className="af-form-row">
      {label && <span className="label" id={`${id}-label`}>{label}</span>}
      <div className="af-thumb-mode-toggle" role="group" aria-labelledby={label ? `${id}-label` : undefined}>
        <button type="button" aria-pressed={value.mode === "drive"} className={`af-thumb-mode-btn${value.mode === "drive" ? " af-thumb-mode-btn--active" : ""}`} onClick={() => setMode("drive")} disabled={uploading}>
          {t("adminFeedbacks.video.modeDrive")}
        </button>
        <button type="button" aria-pressed={value.mode === "upload"} className={`af-thumb-mode-btn${value.mode === "upload" ? " af-thumb-mode-btn--active" : ""}`} onClick={() => setMode("upload")}>
          {t("adminFeedbacks.video.modeUpload")}
        </button>
      </div>

      {value.mode === "drive" ? (
        <input
          id={id}
          className="input"
          placeholder="https://drive.google.com/file/d/..."
          value={value.driveUrl}
          onChange={(event) => onChange({ ...value, driveUrl: event.target.value })}
        />
      ) : (
        <div className="afd-video-upload">
          <input ref={fileInputRef} id={id} type="file" accept={VIDEO_UPLOAD_ACCEPT} onChange={handleFileChange} hidden />
          {uploading ? (
            <div className="afd-video-upload__progress" role="status" aria-live="polite">
              <div className="afd-video-upload__progress-head">
                <span className="afd-video-upload__file">{fileName}</span>
                <strong>{t("adminFeedbacks.video.uploading", { percent })}</strong>
              </div>
              <div className="afd-video-upload__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <span style={{ width: `${percent}%` }} />
              </div>
              <button type="button" className="btn btn-ghost afd-video-upload__cancel" onClick={cancelUpload}>
                <FiX size={14} /> {t("adminFeedbacks.video.cancelUpload")}
              </button>
            </div>
          ) : value.uploadUrl ? (
            <div className="afd-video-upload__done">
              <video className="afd-video-upload__preview" src={resolveMediaUrl(value.uploadUrl)} controls preload="metadata" playsInline />
              <div className="afd-video-upload__done-row">
                <span><FiCheckCircle size={14} /> {fileName || t("adminFeedbacks.video.uploaded")}</span>
                <button type="button" className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}>
                  <FiUpload size={14} /> {t("adminFeedbacks.video.replace")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="afd-video-upload__pick" onClick={() => fileInputRef.current?.click()}>
              <FiUpload size={20} />
              <strong>{t("adminFeedbacks.video.choose")}</strong>
              <span>{t("adminFeedbacks.video.formats")}</span>
            </button>
          )}
        </div>
      )}
      {(uploadError || error) && <span className="af-field-error" role="alert">{uploadError || error}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Formulaire — Témoignage vidéo (SiteSettings.testimonialVideos[])
   Vidéo : lien Google Drive ou envoi depuis le PC ; miniature : lien Drive ou
   image du PC (prise automatiquement dans la vidéo envoyée si vide).
   ═══════════════════════════════════════════════════════════════════════════ */
function TestimonialVideoForm({ initial, categoryLabel, submitting, formError, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState({});
  const [videoBusy, setVideoBusy] = useState(false);
  // Le champ miniature choisit son mode (lien / image) à l'affichage : on le
  // remonte quand une miniature est prise automatiquement dans la vidéo.
  const [thumbnailFieldKey, setThumbnailFieldKey] = useState(0);

  const video = { mode: form.videoMode, driveUrl: form.driveUrl, uploadUrl: form.uploadUrl };
  const setVideo = (next) => {
    setForm((f) => ({ ...f, videoMode: next.mode, driveUrl: next.driveUrl, uploadUrl: next.uploadUrl }));
    setFieldErrors((prev) => ({ ...prev, video: undefined }));
  };

  // Miniature prise dans la vidéo choisie : seulement si aucune miniature n'a
  // été choisie à la main (une miniature automatique précédente est remplacée).
  const handleVideoFile = async (file) => {
    const poster = await captureVideoPoster(file);
    if (!poster) return;
    setForm((f) => (f.thumbnail && !f.thumbnailIsAuto ? f : { ...f, thumbnail: poster, thumbnailIsAuto: true }));
    setThumbnailFieldKey((key) => key + 1);
  };

  const validate = () => {
    const errors = {};
    if (videoBusy) errors.video = t("adminFeedbacks.errors.videoUploadPending");
    else if (form.videoMode === "upload" && !form.uploadUrl) errors.video = t("adminFeedbacks.errors.videoUploadRequired");
    else if (form.videoMode !== "upload" && !form.driveUrl.trim()) errors.video = t("adminFeedbacks.errors.driveUrlRequired");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(form.videoMode === "upload"
      ? { videoUpload: form.uploadUrl, thumbnail: form.thumbnail }
      : { driveUrl: form.driveUrl.trim(), thumbnail: form.thumbnail });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {formError && (
        <div className="af-form-error">
          <FiAlertTriangle size={15} />
          <span>{formError}</span>
        </div>
      )}

      <p className="afd-category-hint">{t("adminFeedbacks.testimonialCategoryHint", { category: categoryLabel })}</p>

      <VideoSourceField
        id="afd-testi-video"
        label={t("adminFeedbacks.video.label")}
        value={video}
        onChange={setVideo}
        onBusyChange={setVideoBusy}
        onVideoFile={handleVideoFile}
        error={fieldErrors.video}
      />

      <DriveOrUploadField
        key={thumbnailFieldKey}
        label={t("adminFeedbacks.testimonialThumbnailLabel")}
        value={form.thumbnail}
        hint={form.thumbnailIsAuto ? t("adminFeedbacks.video.posterAuto") : ""}
        onChange={(thumbnail) => setForm((f) => ({ ...f, thumbnail, thumbnailIsAuto: false }))}
      />

      <div className="modal-footer" style={{ padding: "16px 0 0", borderTop: "none" }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting || videoBusy}>
          {submitting ? t("adminFormations.inProgress") : t("common.save")}
        </button>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Formulaire — Capture d'écran de témoignage (TestimonialScreenshot)
   Ajout : upload d'image requis. Modification : nom/ordre uniquement (pas de
   changement d'image), conformément à la demande.
   ═══════════════════════════════════════════════════════════════════════════ */
function ScreenshotForm({ initial, isEdit, submitting, formError, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!isEdit && !form.imageUrl) errors.imageUrl = t("adminFeedbacks.errors.imageRequired");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = { name: form.name.trim(), order: Number(form.order) || 0 };
    if (!isEdit) payload.imageUrl = form.imageUrl;
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {formError && (
        <div className="af-form-error">
          <FiAlertTriangle size={15} />
          <span>{formError}</span>
        </div>
      )}

      {!isEdit && (
        <DriveOrUploadField
          label={t("adminFeedbacks.screenshotImageLabel")}
          value={form.imageUrl}
          onChange={(imageUrl) => { setForm((f) => ({ ...f, imageUrl })); setFieldErrors((prev) => ({ ...prev, imageUrl: undefined })); }}
        />
      )}
      {fieldErrors.imageUrl && <span className="af-field-error">{fieldErrors.imageUrl}</span>}

      <div className="af-form-grid">
        <div className="af-form-row">
          <label className="label" htmlFor="afd-shot-name">{t("adminFeedbacks.screenshotNameLabel")}</label>
          <input
            id="afd-shot-name"
            className="input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="af-form-row">
          <label className="label" htmlFor="afd-shot-order">{t("adminFeedbacks.screenshotOrderLabel")}</label>
          <input
            id="afd-shot-order"
            type="number"
            className="input"
            value={form.order}
            onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
          />
        </div>
      </div>

      <div className="modal-footer" style={{ padding: "16px 0 0", borderTop: "none" }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? t("adminFormations.inProgress") : t("common.save")}
        </button>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════════════ */
export default function AdminFeedbacks() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("formations");

  // ── Témoignages vidéo (Formations / Summer Camp / PFE) ─────────────────
  const [testimonials, setTestimonials] = useState([]);
  const [testimonialsLoading, setTestimonialsLoading] = useState(true);
  const [testimonialsError, setTestimonialsError] = useState(false);
  // Vidéo de présentation : lien Drive ou vidéo envoyée depuis le PC.
  const [landingVideo, setLandingVideo] = useState({ mode: "drive", driveUrl: "", uploadUrl: "" });
  const [landingVideoBusy, setLandingVideoBusy] = useState(false);
  const [landingVideoSaving, setLandingVideoSaving] = useState(false);
  const [landingVideoMessage, setLandingVideoMessage] = useState("");
  const [landingVideoError, setLandingVideoError] = useState("");

  const [testimonialModal, setTestimonialModal] = useState(null);
  const [testimonialSubmitting, setTestimonialSubmitting] = useState(false);
  const [testimonialFormError, setTestimonialFormError] = useState("");
  const [testimonialDeleteTarget, setTestimonialDeleteTarget] = useState(null);
  const [testimonialDeleting, setTestimonialDeleting] = useState(false);
  const [testimonialDeleteError, setTestimonialDeleteError] = useState("");

  // ── Captures d'écran ────────────────────────────────────────────────────
  const [screenshots, setScreenshots] = useState([]);
  const [screenshotsLoading, setScreenshotsLoading] = useState(true);
  const [screenshotsError, setScreenshotsError] = useState(false);

  const [screenshotModal, setScreenshotModal] = useState(null);
  const [screenshotSubmitting, setScreenshotSubmitting] = useState(false);
  const [screenshotFormError, setScreenshotFormError] = useState("");
  const [screenshotDeleteTarget, setScreenshotDeleteTarget] = useState(null);
  const [screenshotDeleting, setScreenshotDeleting] = useState(false);
  const [screenshotDeleteError, setScreenshotDeleteError] = useState("");

  // ── Chargement initial (les 2 sources, une seule fois — la page bascule
  //    ensuite entre onglets sans refetch, sauf après une action CRUD) ──────
  const loadTestimonials = useCallback(() => {
    settingsService.get()
      .then(({ data }) => {
        setTestimonials(data.testimonialVideos || []);
        const action = data.actionVideo || {};
        setLandingVideo(action.provider === "upload"
          ? { mode: "upload", driveUrl: "", uploadUrl: action.url || "" }
          : { mode: "drive", driveUrl: action.driveUrl || action.url || "", uploadUrl: "" });
        setTestimonialsError(false);
      })
      .catch(() => setTestimonialsError(true))
      .finally(() => setTestimonialsLoading(false));
  }, []);

  const loadScreenshots = useCallback(() => {
    feedbacksService.getScreenshots()
      .then(({ data }) => { setScreenshots(data); setScreenshotsError(false); })
      .catch(() => setScreenshotsError(true))
      .finally(() => setScreenshotsLoading(false));
  }, []);

  // Un effet séparé par source — les regrouper en un seul déclenche plusieurs
  // setState synchrones d'affilée dans le même effet (règle react-hooks/set-state-in-effect).
  useEffect(() => { loadTestimonials(); }, [loadTestimonials]);
  useEffect(() => { loadScreenshots(); }, [loadScreenshots]);

  const testimonialsForTab = useMemo(
    () => testimonials.filter((v) => v.category === TAB_CATEGORY[activeTab]),
    [testimonials, activeTab]
  );

  // ── Témoignages vidéo — handlers ────────────────────────────────────────
  const openTestimonialCreate = () => { setTestimonialFormError(""); setTestimonialModal("create"); };
  const openTestimonialEdit   = (item) => { setTestimonialFormError(""); setTestimonialModal(item); };
  const closeTestimonialForm  = () => { if (!testimonialSubmitting) { setTestimonialModal(null); setTestimonialFormError(""); } };

  const handleTestimonialSubmit = async (payload) => {
    setTestimonialSubmitting(true);
    setTestimonialFormError("");
    try {
      if (testimonialModal === "create") {
        // Catégorie fixée à l'onglet actif — voir TAB_CATEGORY (l'id d'onglet
        // "formations" correspond à category="formation", singulier, en base).
        await feedbacksService.addTestimonialVideo({ ...payload, category: TAB_CATEGORY[activeTab] });
      } else {
        await feedbacksService.updateTestimonialVideo(testimonialModal._id, payload);
      }
      setTestimonialModal(null);
      loadTestimonials();
    } catch (err) {
      setTestimonialFormError(extractErrorMessage(err, t("adminFeedbacks.errors.generic")));
    } finally {
      setTestimonialSubmitting(false);
    }
  };

  const openTestimonialDelete  = (item) => { setTestimonialDeleteError(""); setTestimonialDeleteTarget(item); };
  const closeTestimonialDelete = () => { if (!testimonialDeleting) { setTestimonialDeleteTarget(null); setTestimonialDeleteError(""); } };
  const confirmTestimonialDelete = async () => {
    setTestimonialDeleting(true);
    setTestimonialDeleteError("");
    try {
      await feedbacksService.deleteTestimonialVideo(testimonialDeleteTarget._id);
      setTestimonialDeleteTarget(null);
      loadTestimonials();
    } catch (err) {
      setTestimonialDeleteError(extractErrorMessage(err, t("adminFeedbacks.errors.deleteFailed")));
    } finally {
      setTestimonialDeleting(false);
    }
  };

  // ── Captures d'écran — handlers ─────────────────────────────────────────
  const openScreenshotCreate = () => { setScreenshotFormError(""); setScreenshotModal("create"); };
  const openScreenshotEdit   = (item) => { setScreenshotFormError(""); setScreenshotModal(item); };
  const closeScreenshotForm  = () => { if (!screenshotSubmitting) { setScreenshotModal(null); setScreenshotFormError(""); } };

  const handleScreenshotSubmit = async (payload) => {
    setScreenshotSubmitting(true);
    setScreenshotFormError("");
    try {
      if (screenshotModal === "create") {
        await feedbacksService.addScreenshot(payload);
      } else {
        await feedbacksService.updateScreenshot(screenshotModal._id, payload);
      }
      setScreenshotModal(null);
      loadScreenshots();
    } catch (err) {
      setScreenshotFormError(extractErrorMessage(err, t("adminFeedbacks.errors.generic")));
    } finally {
      setScreenshotSubmitting(false);
    }
  };

  const openScreenshotDelete  = (item) => { setScreenshotDeleteError(""); setScreenshotDeleteTarget(item); };
  const closeScreenshotDelete = () => { if (!screenshotDeleting) { setScreenshotDeleteTarget(null); setScreenshotDeleteError(""); } };
  const confirmScreenshotDelete = async () => {
    setScreenshotDeleting(true);
    setScreenshotDeleteError("");
    try {
      await feedbacksService.deleteScreenshot(screenshotDeleteTarget._id);
      setScreenshotDeleteTarget(null);
      loadScreenshots();
    } catch (err) {
      setScreenshotDeleteError(extractErrorMessage(err, t("adminFeedbacks.errors.deleteFailed")));
    } finally {
      setScreenshotDeleting(false);
    }
  };

  // ── Bouton "Ajouter" de la toolbar — dépend de l'onglet actif ───────────
  const handleAddClick = () => {
    if (activeTab === "screenshots") return openScreenshotCreate();
    return openTestimonialCreate();
  };
  const addLabel = activeTab === "screenshots"
    ? t("adminFeedbacks.addScreenshot")
    : t("adminFeedbacks.addTestimonial");

  const saveLandingVideo = async (event) => {
    event.preventDefault();
    setLandingVideoMessage("");
    setLandingVideoError("");
    if (landingVideoBusy) return setLandingVideoError(t("adminFeedbacks.errors.videoUploadPending"));
    if (landingVideo.mode === "upload" && !landingVideo.uploadUrl) return setLandingVideoError(t("adminFeedbacks.errors.videoUploadRequired"));
    if (landingVideo.mode !== "upload" && !landingVideo.driveUrl.trim()) return setLandingVideoError(t("adminFeedbacks.errors.driveUrlRequired"));
    setLandingVideoSaving(true);
    try {
      await settingsService.update({
        actionVideo: landingVideo.mode === "upload"
          ? { videoUpload: landingVideo.uploadUrl }
          : { driveUrl: landingVideo.driveUrl.trim(), provider: "google_drive" },
      });
      setLandingVideoMessage(t("adminFeedbacks.landingVideo.saved"));
    } catch (error) {
      setLandingVideoError(error?.response?.data?.message || t("adminFeedbacks.landingVideo.saveFailed"));
    } finally {
      setLandingVideoSaving(false);
    }
  };

  return (
    <DashboardLayout title={t("sidebar.admin.feedbacks")} subtitle={t("adminFeedbacks.pageSubtitle")}>
      <div className="sd-root">
        <div className="af-card">

          {/* ── Onglets ────────────────────────────────────────────────── */}
          <div className="afd-tabs" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`afd-tab${activeTab === tab.id ? " afd-tab--active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>

          {/* ── Barre d'outils ─────────────────────────────────────────── */}
          <div className="af-toolbar">
            <h1 className="af-toolbar-title">{t(TABS.find((tb) => tb.id === activeTab).labelKey)}</h1>
            {activeTab !== "landing-video" && activeTab !== "events" && <div className="af-toolbar-actions">
              <button type="button" className="btn btn-primary" onClick={handleAddClick}>
                <FiPlus size={15} /> {addLabel}
              </button>
            </div>}
          </div>

          {activeTab === "landing-video" && (
            <form className="afd-landing-video" onSubmit={saveLandingVideo} noValidate>
              <p>{t("adminFeedbacks.landingVideo.description")}</p>
              <VideoSourceField
                id="afd-landing-video-url"
                label={t("adminFeedbacks.landingVideo.urlLabel")}
                value={landingVideo}
                onChange={(next) => { setLandingVideo(next); setLandingVideoMessage(""); }}
                onBusyChange={setLandingVideoBusy}
              />
              {landingVideoError && <p className="af-form-error" role="alert">{landingVideoError}</p>}
              {landingVideoMessage && <p className="afd-landing-video__success" role="status">{landingVideoMessage}</p>}
              <button type="submit" className="btn btn-primary" disabled={landingVideoSaving || landingVideoBusy}>
                {landingVideoSaving ? t("adminFormations.inProgress") : t("common.save")}
              </button>
              {landingVideo.mode === "drive" && landingVideo.driveUrl && <a href={landingVideo.driveUrl} target="_blank" rel="noopener noreferrer" className="afd-card-link"><FiExternalLink size={14} />{t("adminFeedbacks.viewVideo")}</a>}
            </form>
          )}

          {/* ── Onglets : Formations / Summer Camp / PFE (témoignages vidéo) ── */}
          {TESTIMONIAL_TABS.includes(activeTab) && (
            testimonialsLoading ? (
              <div className="sd-skeleton" style={{ height: 240, margin: "0 20px 20px" }} />
            ) : testimonialsError ? (
              <div className="sd-empty-box"><p>{t("adminFeedbacks.errors.loadFailed")}</p></div>
            ) : testimonialsForTab.length === 0 ? (
              <div className="sd-empty-box">
                <FiVideo size={28} style={{ opacity: .3 }} />
                <p>{t("adminFeedbacks.emptyTestimonials")}</p>
                <button type="button" className="btn btn-primary" onClick={openTestimonialCreate}>
                  <FiPlus size={15} /> {t("adminFeedbacks.addTestimonial")}
                </button>
              </div>
            ) : (
              <div className="afd-grid">
                {testimonialsForTab.map((item) => {
                  // Repli : la migration n'a jamais renseigné thumbnail pour les
                  // témoignages vidéo (voir migrate-landing.js) — même dérivation
                  // que le carousel public (VideoTestimonialCarousel) depuis l'URL
                  // Drive de la vidéo, via le proxy backend (évite le blocage
                  // cross-origin du endpoint /thumbnail de Drive sur un <img>).
                  const posterSrc = item.thumbnail || (isGoogleDriveUrl(item.url) ? resolveDriveThumbnailProxyUrl(item.url) : null);
                  const uploaded = item.provider === "upload";
                  return (
                  <div className="afd-card" key={item._id}>
                    <div className="afd-card-thumb">
                      {posterSrc
                        ? <img src={posterSrc} alt="" />
                        : <div className="afd-card-thumb--placeholder"><FiVideo size={22} /></div>}
                      <span className={`afd-card-source${uploaded ? " afd-card-source--upload" : ""}`}>
                        {uploaded ? <FiHardDrive size={11} aria-hidden="true" /> : <FiExternalLink size={11} aria-hidden="true" />}
                        {t(uploaded ? "adminFeedbacks.video.sourceUpload" : "adminFeedbacks.video.sourceDrive")}
                      </span>
                    </div>
                    <div className="afd-card-body">
                      <a href={resolveMediaUrl(item.url)} target="_blank" rel="noopener noreferrer" className="afd-card-link">
                        <FiExternalLink size={12} /> {t("adminFeedbacks.viewVideo")}
                      </a>
                      <AdminRowActions ariaLabel={t("adminFormations.actionsAriaLabel")} actions={[
                        { label: t("adminFormations.editAction"), onClick: () => openTestimonialEdit(item) },
                        { label: t("notifications.deleteLabel"), onClick: () => openTestimonialDelete(item), danger: true },
                      ]} />
                    </div>
                  </div>
                  );
                })}
              </div>
            )
          )}

          {/* ── Onglet : Captures d'écran ────────────────────────────────── */}
          {activeTab === "screenshots" && (
            screenshotsLoading ? (
              <div className="sd-skeleton" style={{ height: 240, margin: "0 20px 20px" }} />
            ) : screenshotsError ? (
              <div className="sd-empty-box"><p>{t("adminFeedbacks.errors.loadFailed")}</p></div>
            ) : screenshots.length === 0 ? (
              <div className="sd-empty-box">
                <FiImage size={28} style={{ opacity: .3 }} />
                <p>{t("adminFeedbacks.emptyScreenshots")}</p>
                <button type="button" className="btn btn-primary" onClick={openScreenshotCreate}>
                  <FiPlus size={15} /> {t("adminFeedbacks.addScreenshot")}
                </button>
              </div>
            ) : (
              <div className="afd-grid">
                {screenshots.map((shot) => (
                  <div className="afd-card" key={shot._id}>
                    <div className="afd-card-thumb">
                      <img src={shot.imageUrl} alt={shot.name || ""} />
                    </div>
                    <div className="afd-card-body">
                      <span className="afd-card-name">{shot.name || t("adminFeedbacks.screenshotUnnamed")}</span>
                      <span className="afd-card-order">#{shot.order}</span>
                      <AdminRowActions ariaLabel={t("adminFormations.actionsAriaLabel")} actions={[
                        { label: t("adminFormations.editAction"), onClick: () => openScreenshotEdit(shot) },
                        { label: t("notifications.deleteLabel"), onClick: () => openScreenshotDelete(shot), danger: true },
                      ]} />
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === "events" && <EventFeedbacksPanel />}
        </div>
      </div>

      {/* ── Modale — Témoignage vidéo ──────────────────────────────────── */}
      {testimonialModal && (
        <Modal
          title={testimonialModal === "create" ? t("adminFeedbacks.addTestimonial") : t("adminFeedbacks.editTestimonial")}
          onClose={closeTestimonialForm}
          maxWidth={560}
        >
          <TestimonialVideoForm
            initial={testimonialModal === "create"
              ? { videoMode: "drive", driveUrl: "", uploadUrl: "", thumbnail: "", thumbnailIsAuto: false }
              : testimonialModal.provider === "upload"
                ? { videoMode: "upload", driveUrl: "", uploadUrl: testimonialModal.url || "", thumbnail: testimonialModal.thumbnail || "", thumbnailIsAuto: false }
                : { videoMode: "drive", driveUrl: testimonialModal.driveUrl || testimonialModal.url || "", uploadUrl: "", thumbnail: testimonialModal.thumbnail || "", thumbnailIsAuto: false }}
            categoryLabel={t(TABS.find((tb) => tb.id === activeTab).labelKey)}
            submitting={testimonialSubmitting}
            formError={testimonialFormError}
            onSubmit={handleTestimonialSubmit}
            onCancel={closeTestimonialForm}
          />
        </Modal>
      )}

      {testimonialDeleteTarget && (
        <DestructiveActionModal
          title={t("adminFeedbacks.deleteTestimonialTitle")}
          description={t("adminFeedbacks.confirmDeleteTestimonial")}
          itemName={testimonialDeleteTarget.name || testimonialDeleteTarget.title}
          consequence={t("adminFormations.irreversibleNotice")}
          error={testimonialDeleteError}
          isLoading={testimonialDeleting}
          cancelLabel={t("adminDestructive.return")}
          confirmLabel={t("adminDestructive.confirmDelete")}
          loadingLabel={t("adminDestructive.processing")}
          onCancel={closeTestimonialDelete}
          onConfirm={confirmTestimonialDelete}
        />
      )}

      {/* ── Modale — Capture d'écran ───────────────────────────────────── */}
      {screenshotModal && (
        <Modal
          title={screenshotModal === "create" ? t("adminFeedbacks.addScreenshot") : t("adminFeedbacks.editScreenshot")}
          onClose={closeScreenshotForm}
          maxWidth={480}
        >
          <ScreenshotForm
            initial={screenshotModal === "create"
              ? { imageUrl: "", name: "", order: screenshots.length + 1 }
              : { imageUrl: screenshotModal.imageUrl || "", name: screenshotModal.name || "", order: screenshotModal.order ?? 0 }}
            isEdit={screenshotModal !== "create"}
            submitting={screenshotSubmitting}
            formError={screenshotFormError}
            onSubmit={handleScreenshotSubmit}
            onCancel={closeScreenshotForm}
          />
        </Modal>
      )}

      {screenshotDeleteTarget && (
        <DestructiveActionModal
          title={t("adminFeedbacks.deleteScreenshotTitle")}
          description={t("adminFeedbacks.confirmDeleteScreenshot")}
          itemName={screenshotDeleteTarget.name}
          consequence={t("adminFormations.irreversibleNotice")}
          error={screenshotDeleteError}
          isLoading={screenshotDeleting}
          cancelLabel={t("adminDestructive.return")}
          confirmLabel={t("adminDestructive.confirmDelete")}
          loadingLabel={t("adminDestructive.processing")}
          onCancel={closeScreenshotDelete}
          onConfirm={confirmScreenshotDelete}
        />
      )}
    </DashboardLayout>
  );
}
