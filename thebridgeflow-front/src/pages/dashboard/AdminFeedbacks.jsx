import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FiPlus, FiStar, FiAlertTriangle, FiImage, FiTrash2, FiEdit2,
  FiMessageSquare, FiExternalLink, FiVideo,
} from "react-icons/fi";
import { FaStar } from "react-icons/fa";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import Modal from "../../components/common/Modal.jsx";
import { formationsService } from "../../services/formations.service.js";
import { settingsService } from "../../services/settings.service.js";
import { feedbacksService } from "../../services/feedbacks.service.js";
import { compressImageToBase64 } from "../../utils/imageCompression.js";
import { isGoogleDriveUrl, resolveDriveUrl } from "../../constants/videoUrls.js";
import "./StudentDashboard.css";
import "./AdminFormations.css";
import "./AdminNews.css";
import "./AdminFeedbacks.css";

const TABS = [
  { id: "formations",   labelKey: "adminFeedbacks.tabs.formations" },
  { id: "summer-camp",  labelKey: "adminFeedbacks.tabs.summerCamp" },
  { id: "pfe",          labelKey: "adminFeedbacks.tabs.pfe" },
  { id: "screenshots",  labelKey: "adminFeedbacks.tabs.screenshots" },
];

function extractErrorMessage(err, fallback) {
  return err?.response?.data?.message || fallback;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function toDateInputValue(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

/* ─── Étoiles — affichage lecture seule (tableau des avis) ────────────────── */
function StarRatingDisplay({ value = 0 }) {
  return (
    <div className="afd-star-display" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        n <= value
          ? <FaStar key={n} size={13} className="afd-star--filled" />
          : <FiStar key={n} size={13} className="afd-star--empty" />
      ))}
    </div>
  );
}

/* ─── Étoiles — sélecteur cliquable (formulaire) ───────────────────────────── */
function StarRatingInput({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <div className="afd-star-input" role="radiogroup" aria-label={t("adminFeedbacks.reviewRatingLabel")}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className="afd-star-btn"
          onClick={() => onChange(n)}
          aria-label={t("adminFeedbacks.starAriaLabel", { n })}
          aria-pressed={n === value}
        >
          {n <= value ? <FaStar size={20} className="afd-star--filled" /> : <FiStar size={20} className="afd-star--empty" />}
        </button>
      ))}
    </div>
  );
}

/* ─── Menu d'actions par ligne/carte (Modifier / Supprimer) ────────────────── */
function RowActionsMenu({ onEdit, onDelete }) {
  const { t } = useTranslation();
  return (
    <div className="af-row-actions">
      <button
        type="button"
        className="af-action-btn af-action-btn--edit"
        onClick={onEdit}
        title={t("adminFormations.editAction")}
        aria-label={t("adminFormations.editAction")}
      >
        <FiEdit2 size={15} />
      </button>
      <button
        type="button"
        className="af-action-btn af-action-btn--delete"
        onClick={onDelete}
        title={t("notifications.deleteLabel")}
        aria-label={t("notifications.deleteLabel")}
      >
        <FiTrash2 size={15} />
      </button>
    </div>
  );
}

/* ─── Champ image réutilisable — bascule lien Google Drive / upload local
     (base64, compression client canvas 800px, voir imageCompression.js).
     Même pattern que le champ image des formations/actualités. ─────────────── */
function DriveOrUploadField({ value, onChange, label }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState(value?.startsWith("data:image/") ? "upload" : "drive");
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState("");

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
          <label className="an-image-upload">
            {value ? (
              <img src={value} alt="" className="an-image-preview" />
            ) : (
              <div className="an-image-placeholder">
                <FiImage size={20} />
                <span>{t("adminFormations.videoThumbnailChoose")}</span>
              </div>
            )}
            {compressing && <div className="af-video-thumb-uploading">{t("adminFormations.inProgress")}</div>}
          </label>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} hidden />
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
      {error && <span className="af-field-error">{error}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Formulaire — Avis de formation (Formation.reviews[])
   ═══════════════════════════════════════════════════════════════════════════ */
function ReviewForm({ initial, submitting, formError, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = t("adminFeedbacks.errors.nameRequired");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      name:    form.name.trim(),
      rating:  form.rating,
      comment: form.comment.trim(),
      date:    form.date,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {formError && (
        <div className="af-form-error">
          <FiAlertTriangle size={15} />
          <span>{formError}</span>
        </div>
      )}

      <div className="af-form-row">
        <label className="label" htmlFor="afd-review-name">{t("adminFeedbacks.reviewNameLabel")}</label>
        <input
          id="afd-review-name"
          className="input"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        {fieldErrors.name && <span className="af-field-error">{fieldErrors.name}</span>}
      </div>

      <div className="af-form-grid">
        <div className="af-form-row">
          <label className="label">{t("adminFeedbacks.reviewRatingLabel")}</label>
          <StarRatingInput value={form.rating} onChange={(rating) => setForm((f) => ({ ...f, rating }))} />
        </div>
        <div className="af-form-row">
          <label className="label" htmlFor="afd-review-date">{t("adminFeedbacks.reviewDateLabel")}</label>
          <input
            id="afd-review-date"
            type="date"
            className="input"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
        </div>
      </div>

      <div className="af-form-row">
        <label className="label" htmlFor="afd-review-comment">{t("adminFeedbacks.reviewCommentLabel")}</label>
        <textarea
          id="afd-review-comment"
          className="input"
          rows={3}
          value={form.comment}
          onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
        />
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
   Formulaire — Témoignage vidéo (SiteSettings.testimonialVideos[])
   ═══════════════════════════════════════════════════════════════════════════ */
function TestimonialVideoForm({ initial, categoryLabel, submitting, formError, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!form.driveUrl.trim()) errors.driveUrl = t("adminFeedbacks.errors.driveUrlRequired");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      driveUrl:  form.driveUrl.trim(),
      thumbnail: form.thumbnail,
    });
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

      <div className="af-form-row">
        <label className="label" htmlFor="afd-testi-drive">{t("adminFeedbacks.testimonialDriveUrlLabel")}</label>
        <input
          id="afd-testi-drive"
          className="input"
          placeholder="https://drive.google.com/file/d/..."
          value={form.driveUrl}
          onChange={(e) => setForm((f) => ({ ...f, driveUrl: e.target.value }))}
        />
        {fieldErrors.driveUrl && <span className="af-field-error">{fieldErrors.driveUrl}</span>}
      </div>

      <DriveOrUploadField
        label={t("adminFeedbacks.testimonialThumbnailLabel")}
        value={form.thumbnail}
        onChange={(thumbnail) => setForm((f) => ({ ...f, thumbnail }))}
      />

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

  // ── Formations (avis) ──────────────────────────────────────────────────
  const [formations, setFormations] = useState([]);
  const [formationsLoading, setFormationsLoading] = useState(true);
  const [formationsError, setFormationsError] = useState(false);
  const [selectedFormationId, setSelectedFormationId] = useState("");

  const [reviewModal, setReviewModal] = useState(null); // null | "create" | review
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewFormError, setReviewFormError] = useState("");
  const [reviewDeleteTarget, setReviewDeleteTarget] = useState(null);
  const [reviewDeleting, setReviewDeleting] = useState(false);
  const [reviewDeleteError, setReviewDeleteError] = useState("");

  // ── Témoignages vidéo (Summer Camp / PFE) ──────────────────────────────
  const [testimonials, setTestimonials] = useState([]);
  const [testimonialsLoading, setTestimonialsLoading] = useState(true);
  const [testimonialsError, setTestimonialsError] = useState(false);

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

  // ── Chargement initial (les 3 sources, une seule fois — la page bascule
  //    ensuite entre onglets sans refetch, sauf après une action CRUD) ──────
  const loadFormations = useCallback(() => {
    formationsService.getAll()
      .then(({ data }) => {
        setFormations(data);
        setFormationsError(false);
        setSelectedFormationId((prev) => (prev && data.some((f) => f._id === prev)) ? prev : (data[0]?._id || ""));
      })
      .catch(() => setFormationsError(true))
      .finally(() => setFormationsLoading(false));
  }, []);

  const loadTestimonials = useCallback(() => {
    settingsService.get()
      .then(({ data }) => { setTestimonials(data.testimonialVideos || []); setTestimonialsError(false); })
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
  useEffect(() => { loadFormations(); }, [loadFormations]);
  useEffect(() => { loadTestimonials(); }, [loadTestimonials]);
  useEffect(() => { loadScreenshots(); }, [loadScreenshots]);

  const currentFormation = useMemo(
    () => formations.find((f) => f._id === selectedFormationId) || null,
    [formations, selectedFormationId]
  );

  const testimonialsForTab = useMemo(
    () => testimonials.filter((v) => v.category === activeTab),
    [testimonials, activeTab]
  );

  // ── Avis — handlers ─────────────────────────────────────────────────────
  const openReviewCreate = () => { setReviewFormError(""); setReviewModal("create"); };
  const openReviewEdit   = (review) => { setReviewFormError(""); setReviewModal(review); };
  const closeReviewForm  = () => { if (!reviewSubmitting) { setReviewModal(null); setReviewFormError(""); } };

  const handleReviewSubmit = async (payload) => {
    if (!selectedFormationId) return;
    setReviewSubmitting(true);
    setReviewFormError("");
    try {
      if (reviewModal === "create") {
        await feedbacksService.addReview(selectedFormationId, payload);
      } else {
        await feedbacksService.updateReview(selectedFormationId, reviewModal._id, payload);
      }
      setReviewModal(null);
      loadFormations();
    } catch (err) {
      setReviewFormError(extractErrorMessage(err, t("adminFeedbacks.errors.generic")));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const openReviewDelete  = (review) => { setReviewDeleteError(""); setReviewDeleteTarget(review); };
  const closeReviewDelete = () => { if (!reviewDeleting) { setReviewDeleteTarget(null); setReviewDeleteError(""); } };
  const confirmReviewDelete = async () => {
    setReviewDeleting(true);
    setReviewDeleteError("");
    try {
      await feedbacksService.deleteReview(selectedFormationId, reviewDeleteTarget._id);
      setReviewDeleteTarget(null);
      loadFormations();
    } catch (err) {
      setReviewDeleteError(extractErrorMessage(err, t("adminFeedbacks.errors.deleteFailed")));
    } finally {
      setReviewDeleting(false);
    }
  };

  // ── Témoignages vidéo — handlers ────────────────────────────────────────
  const openTestimonialCreate = () => { setTestimonialFormError(""); setTestimonialModal("create"); };
  const openTestimonialEdit   = (item) => { setTestimonialFormError(""); setTestimonialModal(item); };
  const closeTestimonialForm  = () => { if (!testimonialSubmitting) { setTestimonialModal(null); setTestimonialFormError(""); } };

  const handleTestimonialSubmit = async (payload) => {
    setTestimonialSubmitting(true);
    setTestimonialFormError("");
    try {
      if (testimonialModal === "create") {
        // Catégorie fixée à l'onglet actif — Summer Camp et PFE sont deux
        // catégories distinctes des avis de formation (Formation.reviews),
        // jamais mélangées.
        await feedbacksService.addTestimonialVideo({ ...payload, category: activeTab });
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
    if (activeTab === "formations")  return openReviewCreate();
    if (activeTab === "screenshots") return openScreenshotCreate();
    return openTestimonialCreate();
  };
  const addDisabled = activeTab === "formations" && !selectedFormationId;
  const addLabel = activeTab === "formations"
    ? t("adminFeedbacks.addReview")
    : activeTab === "screenshots"
      ? t("adminFeedbacks.addScreenshot")
      : t("adminFeedbacks.addTestimonial");

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
            <div className="af-toolbar-actions">
              {activeTab === "formations" && (
                <div className="af-select-wrap">
                  <label htmlFor="afd-formation-select">{t("adminFeedbacks.formationSelectLabel")}</label>
                  <select
                    id="afd-formation-select"
                    className="af-select"
                    value={selectedFormationId}
                    onChange={(e) => setSelectedFormationId(e.target.value)}
                  >
                    {formations.map((f) => <option key={f._id} value={f._id}>{f.title}</option>)}
                  </select>
                </div>
              )}
              <button type="button" className="btn btn-primary" onClick={handleAddClick} disabled={addDisabled}>
                <FiPlus size={15} /> {addLabel}
              </button>
            </div>
          </div>

          {/* ── Onglet : Formations (avis) ────────────────────────────── */}
          {activeTab === "formations" && (
            formationsLoading ? (
              <div className="sd-skeleton" style={{ height: 240, margin: "0 20px 20px" }} />
            ) : formationsError ? (
              <div className="sd-empty-box"><p>{t("adminFeedbacks.errors.loadFailed")}</p></div>
            ) : !currentFormation ? (
              <div className="sd-empty-box">
                <FiMessageSquare size={28} style={{ opacity: .3 }} />
                <p>{t("adminFeedbacks.noFormations")}</p>
              </div>
            ) : currentFormation.reviews?.length === 0 ? (
              <div className="sd-empty-box">
                <FiMessageSquare size={28} style={{ opacity: .3 }} />
                <p>{t("adminFeedbacks.emptyReviews")}</p>
                <button type="button" className="btn btn-primary" onClick={openReviewCreate}>
                  <FiPlus size={15} /> {t("adminFeedbacks.addReview")}
                </button>
              </div>
            ) : (
              <div className="af-table-wrap">
                <table className="af-table">
                  <thead>
                    <tr>
                      <th>{t("adminFeedbacks.colName")}</th>
                      <th>{t("adminFeedbacks.colRating")}</th>
                      <th>{t("adminFeedbacks.colComment")}</th>
                      <th>{t("adminFeedbacks.colDate")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...currentFormation.reviews].sort((a, b) => new Date(b.date) - new Date(a.date)).map((review) => (
                      <tr key={review._id}>
                        <td className="af-cell-title">{review.name}</td>
                        <td><StarRatingDisplay value={review.rating} /></td>
                        <td className="afd-comment-cell" title={review.comment}>{review.comment || "—"}</td>
                        <td>{formatDate(review.date)}</td>
                        <td>
                          <RowActionsMenu onEdit={() => openReviewEdit(review)} onDelete={() => openReviewDelete(review)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── Onglets : Summer Camp / PFE (témoignages vidéo) ─────────── */}
          {(activeTab === "summer-camp" || activeTab === "pfe") && (
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
                {testimonialsForTab.map((item) => (
                  <div className="afd-card" key={item._id}>
                    <div className="afd-card-thumb">
                      {item.thumbnail
                        ? <img src={item.thumbnail} alt="" />
                        : <div className="afd-card-thumb--placeholder"><FiVideo size={22} /></div>}
                    </div>
                    <div className="afd-card-body">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="afd-card-link">
                        <FiExternalLink size={12} /> {t("adminFeedbacks.viewVideo")}
                      </a>
                      <RowActionsMenu onEdit={() => openTestimonialEdit(item)} onDelete={() => openTestimonialDelete(item)} />
                    </div>
                  </div>
                ))}
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
                      <RowActionsMenu onEdit={() => openScreenshotEdit(shot)} onDelete={() => openScreenshotDelete(shot)} />
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Modale — Avis de formation ─────────────────────────────────── */}
      {reviewModal && (
        <Modal
          title={reviewModal === "create" ? t("adminFeedbacks.addReview") : t("adminFeedbacks.editReview")}
          onClose={closeReviewForm}
          maxWidth={520}
        >
          <ReviewForm
            initial={reviewModal === "create"
              ? { name: "", rating: 5, comment: "", date: toDateInputValue() }
              : { name: reviewModal.name || "", rating: reviewModal.rating || 5, comment: reviewModal.comment || "", date: toDateInputValue(reviewModal.date) }}
            submitting={reviewSubmitting}
            formError={reviewFormError}
            onSubmit={handleReviewSubmit}
            onCancel={closeReviewForm}
          />
        </Modal>
      )}

      {reviewDeleteTarget && (
        <Modal
          title={t("adminFeedbacks.deleteReviewTitle")}
          onClose={closeReviewDelete}
          maxWidth={460}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={closeReviewDelete} disabled={reviewDeleting}>
                {t("common.cancel")}
              </button>
              <button type="button" className="btn btn-primary" style={{ background: "#EF4444" }} onClick={confirmReviewDelete} disabled={reviewDeleting}>
                {reviewDeleting ? t("settings.danger.modal.confirming") : t("settings.danger.modal.confirm")}
              </button>
            </>
          }
        >
          <p>
            {t("adminFeedbacks.confirmDeleteReview")} <strong>{reviewDeleteTarget.name}</strong> ?
            {" "}{t("adminFormations.irreversibleNotice")}
          </p>
          {reviewDeleteError && (
            <div className="af-form-error" style={{ marginTop: 14 }}>
              <FiAlertTriangle size={15} />
              <span>{reviewDeleteError}</span>
            </div>
          )}
        </Modal>
      )}

      {/* ── Modale — Témoignage vidéo ──────────────────────────────────── */}
      {testimonialModal && (
        <Modal
          title={testimonialModal === "create" ? t("adminFeedbacks.addTestimonial") : t("adminFeedbacks.editTestimonial")}
          onClose={closeTestimonialForm}
          maxWidth={560}
        >
          <TestimonialVideoForm
            initial={testimonialModal === "create"
              ? { driveUrl: "", thumbnail: "" }
              : { driveUrl: testimonialModal.driveUrl || testimonialModal.url || "", thumbnail: testimonialModal.thumbnail || "" }}
            categoryLabel={t(activeTab === "summer-camp" ? "adminFeedbacks.tabs.summerCamp" : "adminFeedbacks.tabs.pfe")}
            submitting={testimonialSubmitting}
            formError={testimonialFormError}
            onSubmit={handleTestimonialSubmit}
            onCancel={closeTestimonialForm}
          />
        </Modal>
      )}

      {testimonialDeleteTarget && (
        <Modal
          title={t("adminFeedbacks.deleteTestimonialTitle")}
          onClose={closeTestimonialDelete}
          maxWidth={460}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={closeTestimonialDelete} disabled={testimonialDeleting}>
                {t("common.cancel")}
              </button>
              <button type="button" className="btn btn-primary" style={{ background: "#EF4444" }} onClick={confirmTestimonialDelete} disabled={testimonialDeleting}>
                {testimonialDeleting ? t("settings.danger.modal.confirming") : t("settings.danger.modal.confirm")}
              </button>
            </>
          }
        >
          <p>
            {t("adminFeedbacks.confirmDeleteTestimonial")}
            {" "}{t("adminFormations.irreversibleNotice")}
          </p>
          {testimonialDeleteError && (
            <div className="af-form-error" style={{ marginTop: 14 }}>
              <FiAlertTriangle size={15} />
              <span>{testimonialDeleteError}</span>
            </div>
          )}
        </Modal>
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
        <Modal
          title={t("adminFeedbacks.deleteScreenshotTitle")}
          onClose={closeScreenshotDelete}
          maxWidth={460}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={closeScreenshotDelete} disabled={screenshotDeleting}>
                {t("common.cancel")}
              </button>
              <button type="button" className="btn btn-primary" style={{ background: "#EF4444" }} onClick={confirmScreenshotDelete} disabled={screenshotDeleting}>
                {screenshotDeleting ? t("settings.danger.modal.confirming") : t("settings.danger.modal.confirm")}
              </button>
            </>
          }
        >
          <p>
            {t("adminFeedbacks.confirmDeleteScreenshot")}
            {" "}{t("adminFormations.irreversibleNotice")}
          </p>
          {screenshotDeleteError && (
            <div className="af-form-error" style={{ marginTop: 14 }}>
              <FiAlertTriangle size={15} />
              <span>{screenshotDeleteError}</span>
            </div>
          )}
        </Modal>
      )}
    </DashboardLayout>
  );
}
