import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft, FiAward, FiBookOpen, FiBriefcase, FiCalendar, FiCheckCircle,
  FiCode, FiDownload, FiExternalLink, FiGithub, FiGlobe, FiLinkedin, FiMail,
  FiMapPin, FiPhone, FiUser, FiXCircle,
} from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import Loader from "../../components/common/Loader.jsx";
import { adminService } from "../../services/admin.service.js";
import "./AdminUserDetail.css";

function formatDate(value, locale) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(locale);
}

function safeExternalUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function DetailCard({ icon: Icon, title, children, className = "" }) {
  return (
    <section className={`aud-card ${className}`}>
      <header className="aud-card__header">
        <span className="aud-card__icon"><Icon aria-hidden="true" /></span>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

export default function AdminUserDetail() {
  const { t, i18n } = useTranslation();
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    adminService.getUserById(userId)
      .then(({ data }) => {
        if (active) setUser(data?.user || data);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.message || t("settings.toast.loadError"));
        setUser(null);
      })
      .finally(() => {
        if (active) setLoadedUserId(userId);
      });
    return () => { active = false; };
  }, [userId, retryCount, t]);

  const locale = i18n.resolvedLanguage || i18n.language || "fr";
  const loading = loadedUserId !== userId;
  const retryLoading = () => {
    setError("");
    setUser(null);
    setLoadedUserId(null);
    setRetryCount((count) => count + 1);
  };

  if (loading) {
    return (
      <DashboardLayout title={t("adminUsers.detailModalTitle")}>
        <div className="aud-state"><Loader size="lg" /></div>
      </DashboardLayout>
    );
  }

  if (error || !user) {
    return (
      <DashboardLayout title={t("adminUsers.detailModalTitle")}>
        <div className="aud-state aud-state--error" role="alert">
          <p>{error || t("adminUsers.userNotFound")}</p>
          <button type="button" className="btn btn-primary" onClick={error ? retryLoading : () => navigate("/dashboard/admin/users")}>
            {error ? t("offers.retry") : t("adminUsers.backToUsers")}
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const isActive = user.isVerified === true && user.isActive !== false;
  const profileFields = [
    { icon: FiMail, label: t("profile.email"), value: user.email },
    { icon: FiPhone, label: t("profile.phone"), value: user.phone },
    { icon: FiMapPin, label: t("profile.university"), value: user.university },
    { icon: FiBookOpen, label: t("profile.specialty"), value: user.specialty },
    {
      icon: FiUser,
      label: t("register.genderLabel"),
      value: user.gender === "homme" ? t("register.genderMale") : user.gender === "femme" ? t("register.genderFemale") : "",
    },
  ].filter((field) => field.value);

  const socials = [
    { label: t("profileEditor.linkedin"), href: user.socialLinks?.linkedin, icon: FiLinkedin },
    { label: t("profileEditor.github"), href: user.socialLinks?.github, icon: FiGithub },
    { label: t("profile.portfolio"), href: user.socialLinks?.portfolio, icon: FiExternalLink },
  ].map((item) => ({ ...item, href: safeExternalUrl(item.href) }))
    .filter((item) => item.href);
  const cvUrl = safeExternalUrl(user.cv?.fileUrl);

  return (
    <DashboardLayout title={t("adminUsers.detailModalTitle")} subtitle={user.name}>
      <div className="aud-page">
        <button type="button" className="aud-back" onClick={() => navigate("/dashboard/admin/users")}>
          <FiArrowLeft aria-hidden="true" /> {t("adminUsers.backToUsers")}
        </button>

        <section className="aud-hero">
          <div className="aud-hero__identity">
            <div className="aud-avatar">
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt={user.name} />
                : <span>{user.name?.trim()?.[0]?.toUpperCase() || <FiUser aria-hidden="true" />}</span>}
            </div>
            <div className="aud-hero__content">
              <div className="aud-hero__title">
                <h1>{user.name}</h1>
                <span className={`aud-status ${isActive ? "aud-status--active" : "aud-status--inactive"}`}>
                  {isActive ? <FiCheckCircle aria-hidden="true" /> : <FiXCircle aria-hidden="true" />}
                  {isActive ? t("adminUsers.statusActive") : user.isVerified ? t("adminUsers.statusInactive") : t("adminUsers.verifiedNo")}
                </span>
              </div>
              <p className="aud-role">{t(user.role === "admin" ? "adminUsers.roleAdmin" : "adminUsers.roleStudent")}</p>
              <div className="aud-quick-info">
                <span><FiCalendar aria-hidden="true" />{t("adminUsers.detailFieldJoined")}: {formatDate(user.createdAt, locale)}</span>
                {user.university && <span><FiMapPin aria-hidden="true" />{user.university}</span>}
                {user.specialty && <span><FiBookOpen aria-hidden="true" />{user.specialty}</span>}
              </div>
              {socials.length > 0 && (
                <nav className="aud-socials" aria-label={t("profile.socialLinks")}>
                  {socials.map(({ label, href, icon: Icon }) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
                      <Icon aria-hidden="true" />
                    </a>
                  ))}
                </nav>
              )}
            </div>
          </div>
          <div className="aud-hero__meta">
            {profileFields.map(({ icon: Icon, label, value }) => (
              <div className="aud-meta-item" key={label}>
                <Icon aria-hidden="true" />
                <span><small>{label}</small><strong>{value}</strong></span>
              </div>
            ))}
            <div className="aud-meta-item">
              <FiCalendar aria-hidden="true" />
              <span><small>{t("adminUsers.detailFieldJoined")}</small><strong>{formatDate(user.createdAt, locale)}</strong></span>
            </div>
          </div>
        </section>

        <div className="aud-grid">
          <div className="aud-column">
            <DetailCard icon={FiUser} title={t("profile.personalInfo")}>
              {user.bio
                ? <p className="aud-bio">{user.bio}</p>
                : <p className="aud-empty">{t("profile.noBio")}</p>}
              {profileFields.length > 0 && (
                <dl className="aud-facts">
                  {profileFields.map(({ label, value }) => (
                    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                  ))}
                </dl>
              )}
            </DetailCard>

            <DetailCard icon={FiBookOpen} title={t("profile.education")}>
              {user.education?.institution ? (
                <div className="aud-timeline-item">
                  <h3>{user.education.institution}</h3>
                  <p>{[user.education.degree, user.education.fieldOfStudy].filter(Boolean).join(" — ") || "—"}</p>
                  {(user.education.startDate || user.education.endDate) && (
                    <small>{formatDate(user.education.startDate, locale)} – {user.education.current ? t("profile.present") : formatDate(user.education.endDate, locale)}</small>
                  )}
                  {user.education.grade && <p>{t("profile.grade")}: {user.education.grade}</p>}
                  {user.education.courses?.length > 0 && <div className="aud-tags">{user.education.courses.map((course) => <span key={course}>{course}</span>)}</div>}
                </div>
              ) : <p className="aud-empty">{t("profile.noEducation")}</p>}
            </DetailCard>

            <DetailCard icon={FiBriefcase} title={t("profile.experience")}>
              {user.experience?.length ? user.experience.map((experience, index) => (
                <article className="aud-timeline-item" key={`${experience.company}-${index}`}>
                  <h3>{experience.position || experience.company || "—"}</h3>
                  <p>{[experience.company, experience.location].filter(Boolean).join(" · ")}</p>
                  {(experience.startDate || experience.endDate) && (
                    <small>{formatDate(experience.startDate, locale)} – {experience.current ? t("profile.present") : formatDate(experience.endDate, locale)}</small>
                  )}
                  {experience.description && <p>{experience.description}</p>}
                  {experience.technologies?.length > 0 && <div className="aud-tags">{experience.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div>}
                </article>
              )) : <p className="aud-empty">{t("profile.noExperience")}</p>}
            </DetailCard>
          </div>

          <aside className="aud-column">
            <DetailCard icon={FiCode} title={t("profile.skills")}>
              {user.skills?.length ? (
                <div className="aud-tags">
                  {user.skills.map((skill, index) => (
                    <span key={`${skill.name}-${index}`}>
                      {skill.name}{[skill.category, skill.level].filter(Boolean).map((detail) => ` · ${detail}`).join("")}
                    </span>
                  ))}
                </div>
              ) : <p className="aud-empty">{t("profile.noSkills")}</p>}
            </DetailCard>

            {user.languages?.length > 0 && (
              <DetailCard icon={FiGlobe} title={t("profile.languages")}>
                <ul className="aud-language-list">
                  {user.languages.map((language, index) => (
                    <li key={`${language.name}-${index}`}><strong>{language.name}</strong><span>{language.level}</span></li>
                  ))}
                </ul>
              </DetailCard>
            )}

            <DetailCard icon={FiAward} title={t("profile.cv")}>
              {cvUrl ? (
                <a className="aud-cv-link" href={cvUrl} target="_blank" rel="noopener noreferrer">
                  <FiDownload aria-hidden="true" />
                  <span>{user.cv.fileName || t("profile.cv")}<small>{t("profile.downloadCV")}</small></span>
                  <FiExternalLink aria-hidden="true" />
                </a>
              ) : user.cv?.fileName ? (
                <p className="aud-empty">{user.cv.fileName}</p>
              ) : <p className="aud-empty">{t("profile.noCV")}</p>}
            </DetailCard>

            {socials.length > 0 && (
              <DetailCard icon={FiGlobe} title={t("profile.socialLinks")}>
                <div className="aud-social-list">
                  {socials.map(({ label, href }) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer">
                      {label}<FiExternalLink aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </DetailCard>
            )}
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
