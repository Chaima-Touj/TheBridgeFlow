// src/components/profile/ProfileView.jsx
import { useTranslation } from "react-i18next";
import {
  FiEdit2, FiDownload, FiUpload, FiTrash2,
  FiLinkedin, FiGithub, FiGlobe,
  FiMail, FiPhone, FiBriefcase, FiBookOpen, FiCalendar,
  FiCheckCircle, FiAlertCircle, FiUser, FiCode, FiAward,
} from "react-icons/fi";
import { computeCompletion } from "../../utils/profileUtils";

// ── helpers ──────────────────────────────────────────────────────────

function formatDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function getInitials(name = "") {
  return (
    name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"
  );
}

const LEVEL_STYLE = {
  Débutant:      { bg: "rgba(107,114,128,0.1)", color: "#6B7280",  border: "rgba(107,114,128,0.2)" },
  Intermédiaire: { bg: "rgba(37,99,235,0.1)",   color: "#2563EB",  border: "rgba(37,99,235,0.2)" },
  Avancé:        { bg: "rgba(245,158,11,0.1)",  color: "#D97706",  border: "rgba(245,158,11,0.2)" },
  Expert:        { bg: "rgba(16,185,129,0.1)",  color: "#059669",  border: "rgba(16,185,129,0.2)" },
};

const LANG_DOTS = { Débutant: 1, Intermédiaire: 2, Courant: 3, Natif: 4 };
const EXP_COLORS = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#EF4444", "#EC4899"];

// ── SVG sub-components ────────────────────────────────────────────────

function CompletionRing({ pct, size = 108, stroke = 6 }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ position: "absolute", inset: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.2)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.9)" strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={circ - (pct / 100) * circ}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.8s ease" }} />
    </svg>
  );
}

function StrengthDonut({ pct }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const color = pct >= 80 ? "#10B981" : pct >= 50 ? "#2563EB" : "#F59E0B";
  return (
    <svg viewBox="0 0 80 80" width="80" height="80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
        style={{ transition: "stroke-dashoffset 0.8s ease" }} />
    </svg>
  );
}

// ── SocialLink ────────────────────────────────────────────────────────

function SocialLink({ href, icon, label }) {
  if (!href) {
    return (
      <div className="sf-pv-social-item sf-pv-social-item--empty">
        {icon}
        <span className="sf-pv-social-label">{label}</span>
        <span className="sf-pv-social-empty">—</span>
      </div>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="sf-pv-social-item">
      {icon}
      <span className="sf-pv-social-label">{label}</span>
      <span className="sf-pv-social-url">
        {href.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
      </span>
    </a>
  );
}

// ── Main component ────────────────────────────────────────────────────

const ProfileView = ({ profile, onEdit, onCVUpload, onCVDelete }) => {
  const { t } = useTranslation();
  const pct = computeCompletion(profile);

  const checks = [
    { key: "bio",      done: !!profile?.bio,                           label: t("profile.checkBio") },
    { key: "phone",    done: !!profile?.phone,                         label: t("profile.checkPhone") },
    { key: "skills",   done: (profile?.skills?.length || 0) > 0,      label: t("profile.checkSkills") },
    { key: "cv",       done: !!profile?.cv?.fileUrl,                   label: t("profile.checkCV") },
    { key: "edu",      done: !!profile?.education?.institution,        label: t("profile.checkEdu") },
    { key: "exp",      done: (profile?.experience?.length || 0) > 0,  label: t("profile.checkExp") },
    { key: "linkedin", done: !!profile?.socialLinks?.linkedin,         label: t("profile.checkLinkedIn") },
  ];

  const handleCVChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onCVUpload) {
      const fd = new FormData();
      fd.append("cv", file);
      onCVUpload(fd);
    }
  };

  return (
    <div className="sf-pv-root">

      {/* ── HERO ── */}
      <div className="sf-pv-hero">
        <div className="sf-pv-hero__deco" />

        <div className="sf-pv-hero__left">
          <div className="sf-pv-avatar-wrap">
            <CompletionRing pct={pct} />
            <div className="sf-pv-avatar">
              {profile?.avatarUrl
                ? <img src={profile.avatarUrl} alt="" className="sf-pv-avatar__img"/>
                : getInitials(profile?.name)}
            </div>
            <span className="sf-pv-avatar-dot" />
          </div>

          <div className="sf-pv-hero__info">
            <h1 className="sf-pv-hero__name">{profile?.name || "—"}</h1>
            <p className="sf-pv-hero__role">
              {[profile?.specialty, profile?.university].filter(Boolean).join(" · ") || "—"}
            </p>
            <div className="sf-pv-hero__chips">
              {profile?.email && (
                <span className="sf-pv-chip"><FiMail size={12} />{profile.email}</span>
              )}
              {profile?.phone && (
                <span className="sf-pv-chip"><FiPhone size={12} />{profile.phone}</span>
              )}
              <span className="sf-pv-chip sf-pv-chip--pct">
                <FiAward size={12} />{pct}% {t("profile.completion")}
              </span>
            </div>
          </div>
        </div>

        <div className="sf-pv-hero__actions">
          <button className="sf-pv-btn-edit" onClick={onEdit}>
            <FiEdit2 size={14} /> {t("profile.edit")}
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="sf-pv-layout">

        {/* ── MAIN COLUMN ── */}
        <div className="sf-pv-main">

          {/* Personal Info */}
          <div className="sf-pv-card">
            <div className="sf-pv-card-header">
              <span className="sf-pv-card-icon"><FiUser size={15} /></span>
              <h2 className="sf-pv-card-title">{t("profile.personalInfo")}</h2>
            </div>
            <div className="sf-pv-info-grid">
              <div className="sf-pv-info-item">
                <FiMail size={14} className="sf-pv-info-icon" />
                <div>
                  <p className="sf-pv-info-label">{t("profile.email")}</p>
                  <p className="sf-pv-info-value">{profile?.email || "—"}</p>
                </div>
              </div>
              <div className="sf-pv-info-item">
                <FiPhone size={14} className="sf-pv-info-icon" />
                <div>
                  <p className="sf-pv-info-label">{t("profile.phone")}</p>
                  <p className="sf-pv-info-value">{profile?.phone || "—"}</p>
                </div>
              </div>
              <div className="sf-pv-info-item">
                <FiBookOpen size={14} className="sf-pv-info-icon" />
                <div>
                  <p className="sf-pv-info-label">{t("profile.university")}</p>
                  <p className="sf-pv-info-value">{profile?.university || "—"}</p>
                </div>
              </div>
              <div className="sf-pv-info-item">
                <FiBriefcase size={14} className="sf-pv-info-icon" />
                <div>
                  <p className="sf-pv-info-label">{t("profile.specialty")}</p>
                  <p className="sf-pv-info-value">{profile?.specialty || "—"}</p>
                </div>
              </div>
            </div>
            {profile?.bio ? (
              <div className="sf-pv-bio">
                <p className="sf-pv-bio-text">{profile.bio}</p>
              </div>
            ) : (
              <p className="sf-pv-empty-hint">{t("profile.noBio")}</p>
            )}
          </div>

          {/* Skills */}
          <div className="sf-pv-card">
            <div className="sf-pv-card-header">
              <span className="sf-pv-card-icon"><FiCode size={15} /></span>
              <h2 className="sf-pv-card-title">{t("profile.skills")}</h2>
              {(profile?.skills?.length || 0) > 0 && (
                <span className="sf-pv-count">{profile.skills.length}</span>
              )}
            </div>
            {(profile?.skills?.length || 0) > 0 ? (
              <div className="sf-pv-skills-grid">
                {profile.skills.map((sk, i) => {
                  const s = LEVEL_STYLE[sk.level] || LEVEL_STYLE.Débutant;
                  return (
                    <span key={i} className="sf-pv-skill-badge"
                      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                      {sk.name}
                      {sk.level && <span className="sf-pv-skill-level">· {sk.level}</span>}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="sf-pv-empty">{t("profile.noSkills")}</p>
            )}
          </div>

          {/* Languages */}
          {(profile?.languages?.length || 0) > 0 && (
            <div className="sf-pv-card">
              <div className="sf-pv-card-header">
                <span className="sf-pv-card-icon"><FiGlobe size={15} /></span>
                <h2 className="sf-pv-card-title">{t("profile.languages")}</h2>
              </div>
              <div className="sf-pv-lang-list">
                {profile.languages.map((lang, i) => (
                  <div key={i} className="sf-pv-lang-item">
                    <div>
                      <p className="sf-pv-lang-name">{lang.name}</p>
                      <p className="sf-pv-lang-level">{lang.level}</p>
                    </div>
                    <div className="sf-pv-dots">
                      {[1, 2, 3, 4].map((d) => (
                        <span key={d}
                          className={`sf-pv-dot${d <= (LANG_DOTS[lang.level] || 0) ? " sf-pv-dot--on" : ""}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          <div className="sf-pv-card">
            <div className="sf-pv-card-header">
              <span className="sf-pv-card-icon"><FiBookOpen size={15} /></span>
              <h2 className="sf-pv-card-title">{t("profile.education")}</h2>
            </div>
            {profile?.education?.institution ? (
              <div className="sf-pv-timeline">
                <div className="sf-pv-tl-item">
                  <div className="sf-pv-tl-dot"
                    style={{ background: "rgba(37,99,235,0.12)", color: "#2563EB" }}>
                    <FiBookOpen size={14} />
                  </div>
                  <div className="sf-pv-tl-content">
                    <div className="sf-pv-tl-header">
                      <p className="sf-pv-tl-title">{profile.education.institution}</p>
                      {profile.education.current && (
                        <span className="sf-pv-badge sf-pv-badge--green">{t("profile.current")}</span>
                      )}
                    </div>
                    <p className="sf-pv-tl-sub">
                      {[profile.education.degree, profile.education.fieldOfStudy].filter(Boolean).join(" — ")}
                    </p>
                    {(profile.education.startDate || profile.education.endDate) && (
                      <p className="sf-pv-tl-date">
                        <FiCalendar size={11} />
                        {formatDate(profile.education.startDate)}
                        {" → "}
                        {profile.education.current
                          ? t("profile.present")
                          : formatDate(profile.education.endDate)}
                      </p>
                    )}
                    {profile.education.grade && (
                      <p className="sf-pv-tl-grade">{t("profile.grade")}: {profile.education.grade}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="sf-pv-empty">{t("profile.noEducation")}</p>
            )}
          </div>

          {/* Experience */}
          <div className="sf-pv-card">
            <div className="sf-pv-card-header">
              <span className="sf-pv-card-icon"><FiBriefcase size={15} /></span>
              <h2 className="sf-pv-card-title">{t("profile.experience")}</h2>
              {(profile?.experience?.length || 0) > 0 && (
                <span className="sf-pv-count">{profile.experience.length}</span>
              )}
            </div>
            {(profile?.experience?.length || 0) > 0 ? (
              <div className="sf-pv-timeline">
                {profile.experience.map((exp, i) => {
                  const color = EXP_COLORS[i % EXP_COLORS.length];
                  return (
                    <div key={i} className="sf-pv-tl-item">
                      <div className="sf-pv-tl-dot"
                        style={{ background: `${color}22`, color }}>
                        {exp.company?.[0]?.toUpperCase() || <FiBriefcase size={14} />}
                      </div>
                      {i < profile.experience.length - 1 && <div className="sf-pv-tl-line" />}
                      <div className="sf-pv-tl-content">
                        <div className="sf-pv-tl-header">
                          <p className="sf-pv-tl-title">{exp.position}</p>
                          {exp.current && (
                            <span className="sf-pv-badge sf-pv-badge--blue">{t("profile.current")}</span>
                          )}
                        </div>
                        <p className="sf-pv-tl-sub">
                          {exp.company}{exp.location ? ` · ${exp.location}` : ""}
                        </p>
                        {(exp.startDate || exp.endDate) && (
                          <p className="sf-pv-tl-date">
                            <FiCalendar size={11} />
                            {formatDate(exp.startDate)}
                            {" → "}
                            {exp.current ? t("profile.present") : formatDate(exp.endDate)}
                          </p>
                        )}
                        {exp.description && (
                          <p className="sf-pv-tl-desc">{exp.description}</p>
                        )}
                        {exp.technologies?.length > 0 && (
                          <div className="sf-pv-tech-tags">
                            {exp.technologies.map((tech, j) => (
                              <span key={j} className="sf-pv-tech-tag">{tech}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="sf-pv-empty">{t("profile.noExperience")}</p>
            )}
          </div>

          {/* CV */}
          <div className="sf-pv-card">
            <div className="sf-pv-card-header">
              <span className="sf-pv-card-icon"><FiAward size={15} /></span>
              <h2 className="sf-pv-card-title">{t("profile.cv")}</h2>
            </div>
            {profile?.cv?.fileUrl ? (
              <div className="sf-pv-cv-card">
                <div className="sf-pv-cv-icon">PDF</div>
                <div className="sf-pv-cv-info">
                  <p className="sf-pv-cv-name">{profile.cv.fileName || "curriculum_vitae.pdf"}</p>
                  <p className="sf-pv-cv-hint">{t("profile.cvReady")}</p>
                </div>
                <div className="sf-pv-cv-actions">
                  <a href={profile.cv.fileUrl} target="_blank" rel="noreferrer"
                    className="sf-pv-cv-btn sf-pv-cv-btn--dl">
                    <FiDownload size={13} /> {t("profile.downloadCV")}
                  </a>
                  <label className="sf-pv-cv-btn sf-pv-cv-btn--replace">
                    <FiUpload size={13} /> {t("profile.replaceCV")}
                    <input type="file" accept=".pdf,.doc,.docx" hidden onChange={handleCVChange} />
                  </label>
                  {onCVDelete && (
                    <button className="sf-pv-cv-btn sf-pv-cv-btn--del" onClick={onCVDelete}>
                      <FiTrash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="sf-pv-cv-empty">
                <p className="sf-pv-empty">{t("profile.noCV")}</p>
                <label className="sf-pv-cv-btn sf-pv-cv-btn--upload">
                  <FiUpload size={13} /> {t("profile.uploadCV")}
                  <input type="file" accept=".pdf,.doc,.docx" hidden onChange={handleCVChange} />
                </label>
              </div>
            )}
          </div>

        </div>

        {/* ── SIDEBAR ── */}
        <aside className="sf-pv-sidebar">

          {/* Profile Strength */}
          <div className="sf-pv-card">
            <div className="sf-pv-card-header">
              <span className="sf-pv-card-icon"><FiAward size={15} /></span>
              <h2 className="sf-pv-card-title">{t("profile.profileStrength")}</h2>
            </div>
            <div className="sf-pv-strength-ring">
              <div className="sf-pv-strength-donut">
                <StrengthDonut pct={pct} />
                <span className="sf-pv-strength-pct">{pct}%</span>
              </div>
            </div>
            <div className="sf-pv-checklist">
              {checks.map((c) => (
                <div key={c.key} className="sf-pv-check-item">
                  {c.done
                    ? <FiCheckCircle size={15} className="sf-pv-check-icon sf-pv-check-icon--done" />
                    : <FiAlertCircle size={15} className="sf-pv-check-icon sf-pv-check-icon--todo" />
                  }
                  <span className={`sf-pv-check-label${c.done ? "" : " sf-pv-check-label--todo"}`}>
                    {c.label}
                  </span>
                </div>
              ))}
            </div>
            {checks.some((c) => !c.done) && (
              <button className="sf-pv-improve-btn" onClick={onEdit}>
                {t("profile.improveProfile")}
              </button>
            )}
          </div>

          {/* Social Links */}
          <div className="sf-pv-card">
            <div className="sf-pv-card-header">
              <span className="sf-pv-card-icon"><FiGlobe size={15} /></span>
              <h2 className="sf-pv-card-title">{t("profile.socialLinks")}</h2>
            </div>
            <div className="sf-pv-social-list">
              <SocialLink
                href={profile?.socialLinks?.linkedin}
                icon={<FiLinkedin size={15} />}
                label={t("profileEditor.linkedin")}
              />
              <SocialLink
                href={profile?.socialLinks?.github}
                icon={<FiGithub size={15} />}
                label={t("profileEditor.github")}
              />
              <SocialLink
                href={profile?.socialLinks?.portfolio}
                icon={<FiGlobe size={15} />}
                label={t("profile.portfolio")}
              />
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
};

export default ProfileView;
