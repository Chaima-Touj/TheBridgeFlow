import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  FiPlus, FiFileText, FiAlertTriangle, FiMoreVertical, FiImage, FiUpload,
} from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import Modal from "../../components/common/Modal.jsx";
import { newsService } from "../../services/news.service.js";
import { compressImageToBase64 } from "../../utils/imageCompression.js";
import { isGoogleDriveUrl, resolveDriveUrl } from "../../constants/videoUrls.js";
import "./StudentDashboard.css";
import "./AdminFormations.css";
import "./AdminNews.css";

const CATEGORY_SUGGESTIONS = ["Événements", "Summer Camp", "Éducation"];

const EMPTY_FORM = {
  title: "",
  excerpt: "",
  content: "",
  category: "",
  publishedAt: new Date().toISOString().slice(0, 10),
  image: "",
};

function articleToForm(article) {
  return {
    title:       article.title || "",
    excerpt:     article.excerpt || "",
    content:     article.content || "",
    category:    article.category || "",
    publishedAt: article.publishedAt ? new Date(article.publishedAt).toISOString().slice(0, 10) : "",
    image:       article.image || "",
  };
}

function extractErrorMessage(err, fallback) {
  return err?.response?.data?.message || fallback;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/* ─── Menu d'actions par ligne ("•••" → Modifier / Supprimer) ────────────── */
function RowActionsMenu({ onEdit, onDelete }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="af-row-menu" ref={ref}>
      <button type="button" className="af-icon-btn" onClick={() => setOpen((v) => !v)} aria-label={t("adminFormations.actionsAriaLabel")}>
        <FiMoreVertical size={16} />
      </button>
      {open && (
        <div className="af-row-menu-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit(); }}>
            {t("adminFormations.editAction")}
          </button>
          <button type="button" role="menuitem" className="af-row-menu-danger" onClick={() => { setOpen(false); onDelete(); }}>
            {t("notifications.deleteLabel")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Formulaire (création + édition) ────────────────────────────────────── */
function NewsForm({ initial, isEdit, submitting, formError, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState({});
  const [imageMode, setImageMode] = useState(initial.image?.startsWith("data:image/") ? "upload" : "drive");
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Compression 100% locale (FileReader + canvas, voir imageCompression.js) —
  // plus d'upload disque : le champ image part directement en base64 avec le
  // reste du formulaire (JSON), ou reste un lien Drive saisi en mode "drive".
  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    setFieldErrors((prev) => ({ ...prev, image: undefined }));
    try {
      const base64 = await compressImageToBase64(file, { maxWidth: 800, quality: 0.8 });
      setForm((f) => ({ ...f, image: base64 }));
    } catch (err) {
      setFieldErrors((prev) => ({ ...prev, image: err.message || t("adminNews.errors.imageRequired") }));
    } finally {
      setCompressing(false);
      e.target.value = "";
    }
  };

  const validate = () => {
    const errors = {};
    if (!form.title.trim())    errors.title    = t("adminNews.errors.titleRequired");
    if (!form.excerpt.trim())  errors.excerpt  = t("adminNews.errors.excerptRequired");
    if (!form.category.trim()) errors.category = t("adminNews.errors.categoryRequired");
    if (!form.image.trim())    errors.image    = t("adminNews.errors.imageRequired");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      title:       form.title.trim(),
      excerpt:     form.excerpt.trim(),
      content:     form.content.trim(),
      category:    form.category.trim(),
      publishedAt: form.publishedAt,
      image:       form.image.trim(),
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
        <label className="label">{t("adminNews.imageLabel")}</label>
        <div className="af-thumb-mode-toggle">
          <button
            type="button"
            className={`af-thumb-mode-btn${imageMode === "drive" ? " af-thumb-mode-btn--active" : ""}`}
            onClick={() => setImageMode("drive")}
          >
            {t("adminFormations.thumbnailModeDrive")}
          </button>
          <button
            type="button"
            className={`af-thumb-mode-btn${imageMode === "upload" ? " af-thumb-mode-btn--active" : ""}`}
            onClick={() => setImageMode("upload")}
          >
            {t("adminFormations.thumbnailModeUpload")}
          </button>
        </div>

        {imageMode === "upload" ? (
          <>
            <button
              type="button"
              className="an-image-upload"
              onClick={() => fileInputRef.current?.click()}
            >
              {form.image ? (
                <img src={form.image} alt="" className="an-image-preview" />
              ) : (
                <div className="an-image-placeholder">
                  <FiImage size={24} />
                  <span>{t("adminNews.imageChoose")}</span>
                </div>
              )}
              <div className="an-image-overlay"><FiUpload size={16} /> {t("adminNews.imageChange")}</div>
              {compressing && <div className="af-video-thumb-uploading">{t("adminFormations.inProgress")}</div>}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageFileChange}
              hidden
            />
          </>
        ) : (
          <>
            <input
              className="input"
              placeholder="https://drive.google.com/file/d/..."
              value={form.image}
              onChange={set("image")}
            />
            {/* Aperçu live — normalisé en type "image" (format /thumbnail?id=...,
                adapté à <img>), pas "video" (/preview, fait pour les iframes). */}
            {form.image && isGoogleDriveUrl(form.image) && (
              <div className="af-video-thumb-drive-preview">
                <img
                  src={resolveDriveUrl(form.image, "image")}
                  alt=""
                  className="af-video-thumb-preview"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              </div>
            )}
          </>
        )}
        {fieldErrors.image && <span className="af-field-error">{fieldErrors.image}</span>}
      </div>

      <div className="af-form-row">
        <label className="label" htmlFor="an-title">{t("adminNews.titleLabel")}</label>
        <input id="an-title" className="input" value={form.title} onChange={set("title")} />
        {fieldErrors.title && <span className="af-field-error">{fieldErrors.title}</span>}
      </div>

      <div className="af-form-grid">
        <div className="af-form-row">
          <label className="label" htmlFor="an-category">{t("adminNews.categoryLabel")}</label>
          <input
            id="an-category"
            className="input"
            list="an-category-options"
            placeholder={t("adminNews.categoryPlaceholder")}
            value={form.category}
            onChange={set("category")}
          />
          <datalist id="an-category-options">
            {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
          </datalist>
          {fieldErrors.category && <span className="af-field-error">{fieldErrors.category}</span>}
        </div>
        <div className="af-form-row">
          <label className="label" htmlFor="an-date">{t("adminNews.publishedAtLabel")}</label>
          <input id="an-date" type="date" className="input" value={form.publishedAt} onChange={set("publishedAt")} />
        </div>
      </div>

      <div className="af-form-row">
        <label className="label" htmlFor="an-excerpt">{t("adminNews.excerptLabel")}</label>
        <textarea id="an-excerpt" className="input" rows={2} value={form.excerpt} onChange={set("excerpt")} />
        {fieldErrors.excerpt && <span className="af-field-error">{fieldErrors.excerpt}</span>}
      </div>

      <div className="af-form-row">
        <label className="label" htmlFor="an-content">{t("adminNews.contentLabel")}</label>
        <textarea id="an-content" className="input" rows={5} value={form.content} onChange={set("content")} />
      </div>

      <div className="modal-footer" style={{ padding: "16px 0 0", borderTop: "none" }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? t("adminNews.inProgress") : isEdit ? t("common.save") : t("adminNews.create")}
        </button>
      </div>
    </form>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function AdminNews() {
  const { t } = useTranslation();
  const [news,    setNews]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const [formModal,  setFormModal]  = useState(null); // null | "create" | article object
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState("");

  const loadNews = useCallback(() => {
    newsService.getAll()
      .then(({ data }) => { setNews(data); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadNews(); }, [loadNews]);

  const openCreate = () => { setFormError(""); setFormModal("create"); };
  const openEdit   = (article) => { setFormError(""); setFormModal(article); };
  const closeForm  = () => { if (!submitting) { setFormModal(null); setFormError(""); } };

  const handleFormSubmit = async (payload) => {
    setSubmitting(true);
    setFormError("");
    try {
      if (formModal === "create") {
        await newsService.createNews(payload);
      } else {
        await newsService.updateNews(formModal._id, payload);
      }
      setFormModal(null);
      loadNews();
    } catch (err) {
      setFormError(extractErrorMessage(err, t("adminNews.errors.generic")));
    } finally {
      setSubmitting(false);
    }
  };

  const openDelete  = (article) => { setDeleteError(""); setDeleteTarget(article); };
  const closeDelete = () => { if (!deleting) { setDeleteTarget(null); setDeleteError(""); } };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await newsService.deleteNews(deleteTarget._id);
      setDeleteTarget(null);
      loadNews();
    } catch (err) {
      setDeleteError(extractErrorMessage(err, t("adminNews.errors.deleteFailed")));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout title={t("sidebar.admin.news")} subtitle={t("adminNews.pageSubtitle")}>
      <div className="sd-root">

        <div className="af-card">

          {/* ── Barre d'outils ─────────────────────────────────────────── */}
          <div className="af-toolbar">
            <h1 className="af-toolbar-title">{t("sidebar.admin.news")}</h1>
            <div className="af-toolbar-actions">
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <FiPlus size={15} /> {t("adminNews.newArticle")}
              </button>
            </div>
          </div>

          {/* ── Tableau ────────────────────────────────────────────────── */}
          {loading ? (
            <div className="sd-skeleton" style={{ height: 240, margin: "0 20px 20px" }} />
          ) : error ? (
            <div className="sd-empty-box">
              <p>{t("adminNews.errors.loadFailed")}</p>
            </div>
          ) : news.length === 0 ? (
            <div className="sd-empty-box">
              <FiFileText size={28} style={{ opacity: .3 }} />
              <p>{t("adminNews.emptyState")}</p>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <FiPlus size={15} /> {t("adminNews.createFirst")}
              </button>
            </div>
          ) : (
            <div className="af-table-wrap">
              <table className="af-table">
                <thead>
                  <tr>
                    <th>{t("adminNews.colArticle")}</th>
                    <th>{t("adminNews.colCategory")}</th>
                    <th>{t("adminNews.colDate")}</th>
                    <th>{t("adminNews.colAuthor")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {news.map((a) => (
                    <tr key={a._id}>
                      <td className="af-cell-title">
                        <div className="af-formation-cell">
                          <img src={a.image} alt="" className="an-thumb" />
                          <span className="af-formation-title-text">{a.title}</span>
                        </div>
                      </td>
                      <td><span className="badge badge-primary">{a.category}</span></td>
                      <td>{formatDate(a.publishedAt)}</td>
                      <td>{a.author}</td>
                      <td>
                        <RowActionsMenu onEdit={() => openEdit(a)} onDelete={() => openDelete(a)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {formModal && (
        <Modal
          title={formModal === "create" ? t("adminNews.newArticle") : t("adminNews.editArticleTitle", { title: formModal.title })}
          onClose={closeForm}
          maxWidth={640}
        >
          <NewsForm
            initial={formModal === "create" ? EMPTY_FORM : articleToForm(formModal)}
            isEdit={formModal !== "create"}
            submitting={submitting}
            formError={formError}
            onSubmit={handleFormSubmit}
            onCancel={closeForm}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={t("adminNews.deleteArticleTitle")}
          onClose={closeDelete}
          maxWidth={460}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={closeDelete} disabled={deleting}>
                {t("common.cancel")}
              </button>
              <button type="button" className="btn btn-primary" style={{ background: "#EF4444" }} onClick={confirmDelete} disabled={deleting}>
                {deleting ? t("settings.danger.modal.confirming") : t("settings.danger.modal.confirm")}
              </button>
            </>
          }
        >
          <p>
            {t("adminNews.confirmDeleteQuestion")} <strong>{deleteTarget.title}</strong> ?
            {" "}{t("adminFormations.irreversibleNotice")}
          </p>
          {deleteError && (
            <div className="af-form-error" style={{ marginTop: 14 }}>
              <FiAlertTriangle size={15} />
              <span>{deleteError}</span>
            </div>
          )}
        </Modal>
      )}
    </DashboardLayout>
  );
}
