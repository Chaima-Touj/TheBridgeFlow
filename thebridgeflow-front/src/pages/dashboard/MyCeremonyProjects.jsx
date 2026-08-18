import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FiPlus, FiTrendingUp, FiExternalLink, FiGithub, FiPlay, FiUpload, FiX } from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import Modal from "../../components/common/Modal.jsx";
import { compressImageToBase64 } from "../../utils/imageCompression.js";
import { ceremonyService } from "../../services/ceremony.service.js";
import "../../components/common/NewsSection.css";
import "./MyCeremonyProjects.css";

const EMPTY_FORM = {
  title: "", description: "", technologies: "", coverImage: "",
  driveAppUrl: "", driveVideoUrl: "", githubUrl: "", teamMembers: "",
};

function ProjectForm({ submitting, formError, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    setFieldErrors((prev) => ({ ...prev, coverImage: undefined }));
    try {
      const base64 = await compressImageToBase64(file, { maxWidth: 800, quality: 0.8 });
      setForm((f) => ({ ...f, coverImage: base64 }));
    } catch (err) {
      setFieldErrors((prev) => ({ ...prev, coverImage: err.message || t("myCeremonyProjects.errors.imageInvalid") }));
    } finally {
      setCompressing(false);
      e.target.value = "";
    }
  };

  const validate = () => {
    const errors = {};
    if (!form.title.trim()) errors.title = t("myCeremonyProjects.errors.titleRequired");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      title:         form.title.trim(),
      description:   form.description.trim(),
      technologies:  form.technologies.split(",").map((s) => s.trim()).filter(Boolean),
      coverImage:    form.coverImage,
      driveAppUrl:   form.driveAppUrl.trim(),
      driveVideoUrl: form.driveVideoUrl.trim(),
      githubUrl:     form.githubUrl.trim(),
      teamMembers:   form.teamMembers.split(",").map((s) => s.trim()).filter(Boolean),
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {formError && <div className="af-form-error">{formError}</div>}

      <div className="af-form-row">
        <label className="label" htmlFor="mcp-title">{t("myCeremonyProjects.titleLabel")} *</label>
        <input id="mcp-title" className="input" value={form.title} onChange={set("title")} />
        {fieldErrors.title && <span className="af-field-error">{fieldErrors.title}</span>}
      </div>

      <div className="af-form-row">
        <label className="label" htmlFor="mcp-description">{t("myCeremonyProjects.descriptionLabel")}</label>
        <textarea id="mcp-description" className="input" rows={3} value={form.description} onChange={set("description")} />
      </div>

      <div className="af-form-row">
        <label className="label">{t("myCeremonyProjects.coverLabel")}</label>
        {form.coverImage ? (
          <div className="mcp-cover-preview">
            <img src={form.coverImage} alt="" />
            <button type="button" className="mcp-cover-remove" onClick={() => setForm((f) => ({ ...f, coverImage: "" }))}>
              <FiX size={14} />
            </button>
          </div>
        ) : (
          <button type="button" className="mcp-cover-upload" onClick={() => fileInputRef.current?.click()} disabled={compressing}>
            <FiUpload size={16} /> {compressing ? t("myCeremonyProjects.compressing") : t("myCeremonyProjects.coverUpload")}
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageChange} />
        {fieldErrors.coverImage && <span className="af-field-error">{fieldErrors.coverImage}</span>}
      </div>

      <div className="af-form-row">
        <label className="label" htmlFor="mcp-technologies">{t("myCeremonyProjects.technologiesLabel")}</label>
        <input id="mcp-technologies" className="input" placeholder="React, Node.js, MongoDB" value={form.technologies} onChange={set("technologies")} />
      </div>

      <div className="af-form-row">
        <label className="label" htmlFor="mcp-drive-app">{t("myCeremonyProjects.driveAppLabel")}</label>
        <input id="mcp-drive-app" className="input" placeholder="https://drive.google.com/..." value={form.driveAppUrl} onChange={set("driveAppUrl")} />
      </div>

      <div className="af-form-row">
        <label className="label" htmlFor="mcp-drive-video">{t("myCeremonyProjects.driveVideoLabel")}</label>
        <input id="mcp-drive-video" className="input" placeholder="https://drive.google.com/..." value={form.driveVideoUrl} onChange={set("driveVideoUrl")} />
      </div>

      <div className="af-form-row">
        <label className="label" htmlFor="mcp-github">{t("myCeremonyProjects.githubLabel")}</label>
        <input id="mcp-github" className="input" placeholder="https://github.com/..." value={form.githubUrl} onChange={set("githubUrl")} />
      </div>

      <div className="af-form-row">
        <label className="label" htmlFor="mcp-team">{t("myCeremonyProjects.teamLabel")}</label>
        <input id="mcp-team" className="input" placeholder={t("myCeremonyProjects.teamPlaceholder")} value={form.teamMembers} onChange={set("teamMembers")} />
      </div>

      <div className="modal-footer" style={{ padding: "16px 0 0", borderTop: "none" }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>{t("common.cancel")}</button>
        <button type="submit" className="btn btn-primary" disabled={submitting || compressing}>
          {submitting ? t("myCeremonyProjects.submitting") : t("myCeremonyProjects.submit")}
        </button>
      </div>
    </form>
  );
}

export default function MyCeremonyProjects() {
  const { t } = useTranslation();
  const [projects,   setProjects]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState("");

  const loadProjects = () => {
    setLoading(true);
    ceremonyService.getMyProjects()
      .then(({ data }) => setProjects(data.projects || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(loadProjects, []);

  const handleCreate = async (payload) => {
    setSubmitting(true);
    setFormError("");
    try {
      await ceremonyService.createProject(payload);
      setShowForm(false);
      loadProjects();
    } catch (err) {
      setFormError(err.response?.data?.message || t("myCeremonyProjects.errors.createFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title={t("myCeremonyProjects.pageTitle")} subtitle={t("myCeremonyProjects.pageSubtitle")}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
          <FiPlus size={16} /> {t("myCeremonyProjects.newProject")}
        </button>
      </div>

      {loading ? (
        <p>{t("myCeremonyProjects.loading")}</p>
      ) : projects.length === 0 ? (
        <div className="mcp-empty">
          <p>{t("myCeremonyProjects.empty")}</p>
        </div>
      ) : (
        <div className="news-grid">
          {projects.map((p) => (
            <article key={p._id} className="news-card mcp-card">
              <div className="news-card__img-wrap">
                {p.coverImage
                  ? <img src={p.coverImage} alt="" className="news-card__img" />
                  : <div className="mcp-card__placeholder" />}
              </div>
              <div className="news-card__body">
                <h3 className="news-card__title">{p.title}</h3>
                <div className="mcp-card__votes">
                  <FiTrendingUp size={13} /> {t("ceremony.voteCount", { count: p.voteCount })}
                </div>
                <div className="mcp-card__links">
                  {p.driveAppUrl && <a href={p.driveAppUrl} target="_blank" rel="noopener noreferrer"><FiExternalLink size={14} /></a>}
                  {p.driveVideoUrl && <a href={p.driveVideoUrl} target="_blank" rel="noopener noreferrer"><FiPlay size={14} /></a>}
                  {p.githubUrl && <a href={p.githubUrl} target="_blank" rel="noopener noreferrer"><FiGithub size={14} /></a>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title={t("myCeremonyProjects.newProject")} onClose={() => setShowForm(false)} maxWidth={640}>
          <ProjectForm
            submitting={submitting}
            formError={formError}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </Modal>
      )}
    </DashboardLayout>
  );
}
