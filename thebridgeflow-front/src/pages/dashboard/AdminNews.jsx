import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  FiPlus, FiFileText, FiAlertTriangle, FiMoreVertical, FiImage, FiUpload,
} from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import Modal from "../../components/common/Modal.jsx";
import DestructiveActionModal from "../../components/common/DestructiveActionModal.jsx";
import NewsArticleBody from "../../components/common/NewsArticleBody.jsx";
import { newsService } from "../../services/news.service.js";
import { compressImageToBase64 } from "../../utils/imageCompression.js";
import { isSafeContentUrl } from "../../utils/safeContentUrl.js";
import { isGoogleDriveUrl, resolveDriveUrl } from "../../constants/videoUrls.js";
import "./StudentDashboard.css";
import "./AdminFormations.css";
import "./AdminNews.css";

const CATEGORY_SUGGESTIONS = ["Événements", "Summer Camp", "Éducation"];

const EMPTY_FORM = {
  title: "",
  excerpt: "",
  content: "",
  conclusion: "",
  ctaLabel: "",
  ctaUrl: "",
  faq: [],
  metaTitle: "",
  metaDescription: "",
  articleUrl: "",
  category: "",
  publishedAt: new Date().toISOString().slice(0, 10),
  image: "",
};

function articleToForm(article) {
  return {
    title:       article.title || "",
    excerpt:     article.excerpt || "",
    content:     article.content || "",
    conclusion:  article.conclusion || "",
    ctaLabel:    article.ctaLabel || "",
    ctaUrl:      article.ctaUrl || "",
    faq:         Array.isArray(article.faq) ? article.faq.map(({ question = "", answer = "" }) => ({ question, answer })) : [],
    metaTitle:   article.metaTitle || "",
    metaDescription: article.metaDescription || "",
    articleUrl:  article._id || "",
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
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setFaq = (index, key, value) => setForm((current) => ({
    ...current,
    faq: current.faq.map((entry, entryIndex) => entryIndex === index ? { ...entry, [key]: value } : entry),
  }));

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
    if (form.faq.some(({ question, answer }) => !question.trim() || !answer.trim())) {
      errors.faq = t("adminNews.errors.faqEntryRequired");
    }
    if (Boolean(form.ctaLabel.trim()) !== Boolean(form.ctaUrl.trim())) {
      errors.cta = t("adminNews.errors.ctaPairRequired");
    } else if (form.ctaUrl.trim() && !isSafeContentUrl(form.ctaUrl)) {
      errors.cta = t("adminNews.errors.ctaUrlInvalid");
    }
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
      conclusion:  form.conclusion.trim(),
      ctaLabel:    form.ctaLabel.trim(),
      ctaUrl:      form.ctaUrl.trim(),
      faq:         form.faq.map(({ question, answer }) => ({ question: question.trim(), answer: answer.trim() })),
      metaTitle:   form.metaTitle.trim(),
      metaDescription: form.metaDescription.trim(),
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

      <section className="an-form-section" aria-labelledby="an-seo-heading">
        <h3 id="an-seo-heading">{t("adminNews.seoSection")}</h3>
        <div className="af-form-row">
          <label className="label" htmlFor="an-meta-title">{t("adminNews.metaTitleLabel")}</label>
          <input id="an-meta-title" className="input" maxLength={70} value={form.metaTitle} onChange={set("metaTitle")} />
          <small>{t("adminNews.metaTitleHelp")}</small>
        </div>
        <div className="af-form-row">
          <label className="label" htmlFor="an-meta-description">{t("adminNews.metaDescriptionLabel")}</label>
          <textarea id="an-meta-description" className="input" rows={2} maxLength={320} value={form.metaDescription} onChange={set("metaDescription")} />
          <small>{t("adminNews.metaDescriptionHelp")}</small>
        </div>
        <div className="af-form-row">
          <span className="label">{t("adminNews.publicUrlLabel")}</span>
          {form.articleUrl
            ? <a href={`/blog/${encodeURIComponent(form.articleUrl)}`} target="_blank" rel="noreferrer">{`${window.location.origin}/blog/${form.articleUrl}`}</a>
            : <small>{t("adminNews.publicUrlAfterCreate")}</small>}
        </div>
      </section>

      <section className="an-form-section" aria-labelledby="an-main-heading">
        <h3 id="an-main-heading">{t("adminNews.mainSection")}</h3>
        <div className="af-form-row">
          <label className="label" htmlFor="an-title">{t("adminNews.titleLabel")}</label>
          <input id="an-title" className="input" maxLength={300} value={form.title} onChange={set("title")} />
          {fieldErrors.title && <span className="af-field-error">{fieldErrors.title}</span>}
        </div>

        <div className="af-form-grid">
          <div className="af-form-row">
            <label className="label" htmlFor="an-category">{t("adminNews.categoryLabel")}</label>
            <input
              id="an-category"
              className="input"
              maxLength={100}
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
          <textarea id="an-excerpt" className="input" rows={3} maxLength={5000} value={form.excerpt} onChange={set("excerpt")} />
          {fieldErrors.excerpt && <span className="af-field-error">{fieldErrors.excerpt}</span>}
        </div>
        <div className="af-form-row">
          <label className="label" htmlFor="an-content">{t("adminNews.contentLabel")}</label>
          <textarea id="an-content" className="input an-markdown-input" rows={12} maxLength={100000} value={form.content} onChange={set("content")} />
          <small>{t("adminNews.markdownHelp")}</small>
        </div>
      </section>

      <section className="an-form-section" aria-labelledby="an-organization-heading">
        <h3 id="an-organization-heading">{t("adminNews.organizationSection")}</h3>
        <div className="af-form-row">
          <label className="label" htmlFor="an-conclusion">{t("adminNews.conclusionLabel")}</label>
          <textarea id="an-conclusion" className="input an-markdown-input" rows={4} maxLength={20000} value={form.conclusion} onChange={set("conclusion")} />
        </div>
        <div className="af-form-grid">
          <div className="af-form-row">
            <label className="label" htmlFor="an-cta-label">{t("adminNews.ctaLabel")}</label>
            <input id="an-cta-label" className="input" maxLength={100} value={form.ctaLabel} onChange={set("ctaLabel")} />
          </div>
          <div className="af-form-row">
            <label className="label" htmlFor="an-cta-url">{t("adminNews.ctaUrl")}</label>
            <input id="an-cta-url" className="input" maxLength={2048} value={form.ctaUrl} onChange={set("ctaUrl")} placeholder="/formations ou https://..." />
            <small>{t("adminNews.ctaHelp")}</small>
          </div>
        </div>
        {fieldErrors.cta && <span className="af-field-error" role="alert">{fieldErrors.cta}</span>}
        <div className="an-faq-heading">
          <h4>{t("adminNews.faqSection")}</h4>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={form.faq.length >= 25}
            onClick={() => setForm((current) => ({ ...current, faq: [...current.faq, { question: "", answer: "" }] }))}
          >
            {t("adminNews.addFaq")}
          </button>
        </div>
        {form.faq.map((entry, index) => (
          <div className="an-faq-entry" key={`faq-${index}`}>
            <div className="af-form-row">
              <label className="label" htmlFor={`an-faq-question-${index}`}>{t("adminNews.faqQuestionLabel")}</label>
              <input
                id={`an-faq-question-${index}`}
                className="input"
                maxLength={300}
                value={entry.question}
                onChange={(event) => setFaq(index, "question", event.target.value)}
              />
            </div>
            <div className="af-form-row">
              <label className="label" htmlFor={`an-faq-answer-${index}`}>{t("adminNews.faqAnswerLabel")}</label>
              <textarea
                id={`an-faq-answer-${index}`}
                className="input"
                rows={2}
                maxLength={10000}
                value={entry.answer}
                onChange={(event) => setFaq(index, "answer", event.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost an-faq-remove"
              onClick={() => setForm((current) => ({ ...current, faq: current.faq.filter((_, faqIndex) => faqIndex !== index) }))}
              aria-label={t("adminNews.removeFaq")}
            >
              {t("adminNews.removeFaq")}
            </button>
          </div>
        ))}
        {fieldErrors.faq && <span className="af-field-error" role="alert">{fieldErrors.faq}</span>}
      </section>

      <button type="button" className="btn btn-ghost an-preview-toggle" onClick={() => setShowPreview((visible) => !visible)} aria-expanded={showPreview}>
        {showPreview ? t("adminNews.hidePreview") : t("adminNews.preview")}
      </button>
      {showPreview && (
        <section className="an-preview" aria-label={t("adminNews.preview")}>
          <div className="an-seo-preview">
            <small>{t("adminNews.seoPreview")}</small>
            <strong>{form.metaTitle || form.title || t("adminNews.titleLabel")}</strong>
            <p>{form.metaDescription || form.excerpt || t("adminNews.previewEmpty")}</p>
          </div>
          <h2>{form.title || t("adminNews.preview")}</h2>
          {form.excerpt && <p className="news-detail__excerpt">{form.excerpt}</p>}
          {form.content
            ? <NewsArticleBody content={form.content} className="an-preview__body" />
            : <p>{t("adminNews.previewEmpty")}</p>}
          {form.conclusion && (
            <section className="an-preview__conclusion">
              <h2>{t("adminNews.conclusionLabel")}</h2>
              <NewsArticleBody content={form.conclusion} />
            </section>
          )}
          {form.ctaLabel && isSafeContentUrl(form.ctaUrl) && (
            <a className="btn btn-primary an-preview__cta" href={form.ctaUrl}>
              {form.ctaLabel}
            </a>
          )}
          {form.faq.length > 0 && (
            <section className="an-preview__faq">
              <h2>{t("adminNews.faqSection")}</h2>
              {form.faq.map(({ question, answer }, index) => (
                <details key={`faq-preview-${index}`}>
                  <summary>{question || t("adminNews.faqQuestionLabel")}</summary>
                  <NewsArticleBody content={answer} />
                </details>
              ))}
            </section>
          )}
        </section>
      )}

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
        <DestructiveActionModal
          title={t("adminNews.deleteArticleTitle")}
          description={t("adminDestructive.genericPrompt")}
          itemName={deleteTarget.title}
          consequence={t("adminFormations.irreversibleNotice")}
          error={deleteError}
          isLoading={deleting}
          cancelLabel={t("adminDestructive.return")}
          confirmLabel={t("adminDestructive.confirmDelete")}
          loadingLabel={t("adminDestructive.processing")}
          onCancel={closeDelete}
          onConfirm={confirmDelete}
        />
      )}
    </DashboardLayout>
  );
}
