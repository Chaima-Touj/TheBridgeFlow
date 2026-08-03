// src/pages/offers/ApplyOffer.jsx
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiArrowLeft, FiMapPin, FiClock, FiBriefcase,
  FiUpload, FiCheckCircle, FiAlertCircle, FiUser,
  FiMail, FiPhone, FiFileText, FiX, FiSend,
  FiBook, FiCode,
} from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { useAuth }               from "../../context/AuthContext.jsx";
import { offersService }         from "../../services/offers.service.js";
import { profileService }        from "../../services/profile.service.js";
import { applicationsService }   from "../../services/applications.service.js";
import "./ApplyOffer.css";

/* ── helpers ─────────────────────────────────────────────────────────────── */
const LOGO_PALETTES = [
  { bg: "#4F46E5", color: "#fff" }, { bg: "#0EA5E9", color: "#fff" },
  { bg: "#10B981", color: "#fff" }, { bg: "#F59E0B", color: "#fff" },
  { bg: "#EF4444", color: "#fff" }, { bg: "#8B5CF6", color: "#fff" },
];
function getLogoStyle(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return LOGO_PALETTES[Math.abs(h) % LOGO_PALETTES.length];
}

function getInitials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

const AVATAR_COLORS = ["#4F46E5","#0EA5E9","#10B981","#F59E0B","#EF4444","#8B5CF6"];
function getAvatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const MAX_CHARS = 2000;
const MIN_CHARS = 50;

/* ── SkeletonSidebar ─────────────────────────────────────────────────────── */
function SkeletonSidebar() {
  return (
    <div className="ao-left">
      <div className="ao-card">
        {[80, 60, 50, 40].map((w, i) => (
          <div key={i} className="ao-skel" style={{ height: i === 0 ? 20 : 14, width: `${w}%`, marginBottom: 10 }} />
        ))}
      </div>
      <div className="ao-card">
        {[70, 55, 45, 35, 35].map((w, i) => (
          <div key={i} className="ao-skel" style={{ height: i === 0 ? 48 : 14, width: `${w}%`, marginBottom: 10 }} />
        ))}
      </div>
    </div>
  );
}

/* ── AlreadyApplied ──────────────────────────────────────────────────────── */
function AlreadyApplied({ t, offerTitle, navigate }) {
  return (
    <div className="ao-already">
      <div className="ao-already-icon">
        <FiCheckCircle size={40} />
      </div>
      <h2 className="ao-already-title">{t("apply.alreadyTitle")}</h2>
      <p className="ao-already-desc">
        {t("apply.alreadyDesc")}
      </p>
      {offerTitle && (
        <div className="ao-already-offer">"{offerTitle}"</div>
      )}
      <button
        type="button"
        className="btn btn-primary ao-already-btn"
        onClick={() => navigate("/dashboard/student/applications")}
      >
        {t("apply.alreadyCta")}
      </button>
    </div>
  );
}

/* ── SuccessScreen ───────────────────────────────────────────────────────── */
function SuccessScreen({ t, offer, navigate }) {
  return (
    <div className="ao-success">
      <div className="ao-success-ring">
        <div className="ao-success-icon">
          <FiCheckCircle size={44} />
        </div>
      </div>
      <h2 className="ao-success-title">{t("apply.successTitle")}</h2>
      {offer && (
        <div className="ao-success-offer">
          <strong>{offer.title}</strong>
          <span>{offer.companyName}</span>
        </div>
      )}
      <p className="ao-success-sub">{t("apply.successSub")}</p>
      <div className="ao-success-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate("/dashboard/student/applications")}
        >
          {t("apply.successCta")}
        </button>
        <Link
          to="/dashboard/student/offers"
          className="btn btn-outline"
        >
          {t("apply.successBack")}
        </Link>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function ApplyOffer() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { t }    = useTranslation();
  const { user } = useAuth();

  /* state ─────────────────────────────────────────────────────────────────── */
  const [offer,          setOffer]         = useState(null);
  const [profile,        setProfile]       = useState(null);
  const [loading,        setLoading]       = useState(true);
  const [submitting,     setSubmitting]    = useState(false);
  const [submitted,      setSubmitted]     = useState(false);
  const [alreadyApplied, setAlreadyApplied]= useState(false);
  const [coverLetter,    setCoverLetter]   = useState("");
  const [cvFile,         setCvFile]        = useState(null);
  const [error,          setError]         = useState("");
  const [fieldErrors,    setFieldErrors]   = useState({});
  const fileInputRef = useRef(null);

  /* load ──────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    setLoading(true);
    Promise.all([
      offersService.getOne(id),
      profileService.getMyProfile(),
      applicationsService.getAll(),
    ])
      .then(([offRes, profRes, appRes]) => {
        const o = offRes.data.offer || offRes.data.offers?.[0] || offRes.data;
        setOffer(o);

        const p = profRes.data?.user || profRes.data?.profile || profRes.data;
        setProfile(p);

        const apps = appRes.data.applications || [];
        const found = apps.find(
          (a) => String(a.offerId?._id || a.offerId) === String(id)
        );
        if (found) setAlreadyApplied(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  /* validation ────────────────────────────────────────────────────────────── */
  const validate = () => {
    const errors = {};
    if (!coverLetter.trim()) {
      errors.coverLetter = t("apply.errorCoverLetter");
    } else if (coverLetter.trim().length < MIN_CHARS) {
      errors.coverLetter = t("apply.errorMinLength");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* submit ─────────────────────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("offerId", id);
      formData.append("coverLetter", coverLetter.trim());
      if (cvFile) formData.append("cv", cvFile);

      await applicationsService.create(formData);
      setSubmitted(true);
    } catch (err) {
      const status  = err?.response?.status;
      const message = err?.response?.data?.message || "";

      if (status === 409 || message.toLowerCase().includes("déjà postulé")) {
        setAlreadyApplied(true);
      } else {
        setError(message || "Erreur lors de l'envoi de la candidature.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* file handler ──────────────────────────────────────────────────────────── */
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setCvFile(file);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setCvFile(file);
  };

  /* char count color ──────────────────────────────────────────────────────── */
  const charCount = coverLetter.length;
  const charCountClass =
    charCount > MAX_CHARS     ? "ao-char-count--over" :
    charCount > MAX_CHARS * 0.9 ? "ao-char-count--warn" :
    charCount >= MIN_CHARS    ? "ao-char-count--ok"   : "";

  /* derived ───────────────────────────────────────────────────────────────── */
  const offerLogo   = offer ? getLogoStyle(offer.companyName || "") : null;
  const profileName = profile?.name || user?.name || "";
  const skills      = (profile?.skills || user?.skills || []).slice(0, 6);
  const hasCvProfile = !!(profile?.cv?.fileUrl);

  /* ── Loading ─────────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <DashboardLayout title={t("apply.title")}>
        <div className="ao-page">
          <div className="ao-skel ao-skel-back" />
          <div className="ao-layout">
            <SkeletonSidebar />
            <div className="ao-right">
              <div className="ao-card">
                {[60, 90, 100, 100, 80].map((w, i) => (
                  <div key={i} className="ao-skel" style={{ height: i < 2 ? 18 : 13, width: `${w}%`, marginBottom: 12 }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  /* ── Already applied ─────────────────────────────────────────────────────── */
  if (alreadyApplied) {
    return (
      <DashboardLayout title={t("apply.title")}>
        <div className="ao-page">
          <button type="button" className="ao-back" onClick={() => navigate(-1)}>
            <FiArrowLeft size={16} /> {t("apply.back")}
          </button>
          <AlreadyApplied t={t} offerTitle={offer?.title} navigate={navigate} />
        </div>
      </DashboardLayout>
    );
  }

  /* ── Success ─────────────────────────────────────────────────────────────── */
  if (submitted) {
    return (
      <DashboardLayout title={t("apply.successTitle")}>
        <div className="ao-page">
          <SuccessScreen t={t} offer={offer} navigate={navigate} />
        </div>
      </DashboardLayout>
    );
  }

  /* ── Main form ───────────────────────────────────────────────────────────── */
  return (
    <DashboardLayout title={t("apply.title")}>
      <div className="ao-page">

        {/* Back */}
        <button type="button" className="ao-back" onClick={() => navigate(-1)}>
          <FiArrowLeft size={16} /> {t("apply.back")}
        </button>

        <div className="ao-layout">

          {/* ════════ LEFT SIDEBAR ════════ */}
          <div className="ao-left">

            {/* Offer card */}
            {offer && (
              <div className="ao-card ao-offer-card">
                <p className="ao-card-label">{t("apply.offerCard")}</p>
                <div className="ao-offer-header">
                  <div className="ao-offer-logo" style={{ background: offerLogo.bg, color: offerLogo.color }}>
                    {(offer.companyName || "?")[0].toUpperCase()}
                  </div>
                  <div className="ao-offer-info">
                    <h3 className="ao-offer-title">{offer.title}</h3>
                    <span className="ao-offer-company">{offer.companyName}</span>
                  </div>
                </div>
                <div className="ao-offer-meta">
                  {offer.location && (
                    <span className="ao-offer-chip">
                      <FiMapPin size={11} /> {offer.location}
                    </span>
                  )}
                  {offer.type && (
                    <span className="ao-offer-chip">
                      <FiBriefcase size={11} /> {offer.type}
                    </span>
                  )}
                  {offer.duration && (
                    <span className="ao-offer-chip">
                      <FiClock size={11} /> {offer.duration}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Profile card */}
            <div className="ao-card ao-profile-card">
              <p className="ao-card-label">{t("apply.yourProfile")}</p>

              {/* Avatar + name */}
              <div className="ao-profile-header">
                <div
                  className="ao-avatar"
                  style={{ background: getAvatarColor(profileName) }}
                >
                  {getInitials(profileName)}
                </div>
                <div className="ao-profile-name-block">
                  <div className="ao-profile-name">{profileName}</div>
                  {(profile?.specialty || user?.specialty) && (
                    <div className="ao-profile-spec">
                      {profile?.specialty || user?.specialty}
                    </div>
                  )}
                </div>
              </div>

              {/* Info rows */}
              <div className="ao-profile-rows">
                {(profile?.email || user?.email) && (
                  <div className="ao-profile-row">
                    <FiMail size={13} />
                    <span>{profile?.email || user?.email}</span>
                  </div>
                )}
                {(profile?.phone || user?.phone) && (
                  <div className="ao-profile-row">
                    <FiPhone size={13} />
                    <span>{profile?.phone || user?.phone}</span>
                  </div>
                )}
                {(profile?.university || user?.university) && (
                  <div className="ao-profile-row">
                    <FiBook size={13} />
                    <span>{profile?.university || user?.university}</span>
                  </div>
                )}
              </div>

              {/* Skills */}
              {skills.length > 0 && (
                <div className="ao-skills-section">
                  <div className="ao-skills-label">
                    <FiCode size={12} /> {t("apply.skills")}
                  </div>
                  <div className="ao-skills-list">
                    {skills.map((s) => (
                      <span key={s.name || s} className="ao-skill-chip">
                        {s.name || s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* ════════ RIGHT FORM ════════ */}
          <form className="ao-right" onSubmit={handleSubmit} noValidate>

            {/* CV section */}
            <div className="ao-card ao-cv-card">
              <h3 className="ao-section-title">
                <FiFileText size={16} /> {t("apply.cvSection")}
              </h3>

              {/* Profile CV display */}
              {hasCvProfile && (
                <div className="ao-cv-profile">
                  <div className="ao-cv-profile-icon">
                    <FiFileText size={18} />
                  </div>
                  <div className="ao-cv-profile-body">
                    <div className="ao-cv-profile-label">{t("apply.cvProfile")}</div>
                    <div className="ao-cv-profile-name">
                      {profile.cv.fileName || "cv.pdf"}
                    </div>
                  </div>
                  <a
                    href={profile.cv.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ao-cv-link"
                    title={t("apply.viewCv")}
                  >
                    <FiUser size={14} />
                  </a>
                </div>
              )}

              {/* File drop zone */}
              {cvFile ? (
                <div className="ao-cv-selected">
                  <FiFileText size={18} className="ao-cv-selected-icon" />
                  <div className="ao-cv-selected-body">
                    <div className="ao-cv-selected-label">{t("apply.cvSelected")}</div>
                    <div className="ao-cv-selected-name">{cvFile.name}</div>
                  </div>
                  <button
                    type="button"
                    className="ao-cv-remove"
                    onClick={() => { setCvFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    aria-label={t("fileUpload.removeFile")}
                  >
                    <FiX size={16} />
                  </button>
                </div>
              ) : (
                <div
                  className="ao-cv-dropzone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                >
                  <FiUpload size={22} className="ao-cv-dropzone-icon" />
                  <span className="ao-cv-dropzone-text">
                    {hasCvProfile ? t("apply.cvReplace") : t("apply.cvAdd")}
                  </span>
                  <span className="ao-cv-dropzone-hint">{t("apply.cvDropHint")}</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                hidden
              />
            </div>

            {/* Cover letter section */}
            <div className="ao-card ao-cl-card">
              <h3 className="ao-section-title">
                <FiFileText size={16} /> {t("apply.coverLetterLabel")}
                <span className="ao-required">*</span>
              </h3>

              <div className={`ao-cl-hint`}>
                {t("apply.coverLetterHint")}
              </div>

              <div className={`ao-textarea-wrap ${fieldErrors.coverLetter ? "ao-textarea-wrap--error" : ""}`}>
                <textarea
                  className="ao-textarea"
                  placeholder={t("apply.coverLetterPlaceholder")}
                  value={coverLetter}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_CHARS) setCoverLetter(e.target.value);
                    if (fieldErrors.coverLetter) setFieldErrors({});
                  }}
                  rows={10}
                />
              </div>

              <div className="ao-cl-footer">
                {fieldErrors.coverLetter ? (
                  <span className="ao-field-error">
                    <FiAlertCircle size={13} /> {fieldErrors.coverLetter}
                  </span>
                ) : (
                  <span className="ao-cl-tip">
                    {charCount >= MIN_CHARS && <FiCheckCircle size={13} className="ao-tip-check" />}
                    {charCount < MIN_CHARS && `Minimum ${MIN_CHARS} caractères`}
                  </span>
                )}
                <span className={`ao-char-count ${charCountClass}`}>
                  {t("apply.charCount", { count: charCount })}
                </span>
              </div>
            </div>

            {/* Submit section */}
            <div className="ao-submit-section">
              {error && (
                <div className="ao-error">
                  <FiAlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="ao-btn-submit"
                disabled={submitting || charCount > MAX_CHARS}
              >
                {submitting ? (
                  <>
                    <span className="ao-spinner" />
                    {t("apply.submitting")}
                  </>
                ) : (
                  <>
                    <FiSend size={16} />
                    {t("apply.submitBtn")}
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
