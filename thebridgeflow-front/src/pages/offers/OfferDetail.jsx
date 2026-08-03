// src/pages/offers/OfferDetail.jsx
import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiArrowLeft, FiMapPin, FiBriefcase, FiClock, FiCalendar,
  FiBookmark, FiExternalLink, FiSend, FiShare2, FiCheck,
  FiGlobe, FiUsers, FiGrid, FiCode, FiCheckCircle, FiAlertCircle,
} from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { useAuth }               from "../../context/AuthContext.jsx";
import { offersService }         from "../../services/offers.service.js";
import { favoritesService }      from "../../services/favorites.service.js";
import { applicationsService }   from "../../services/applications.service.js";
import { useFormationsTechMap }  from "../../hooks/useFormationsTechMap.js";
import { buildSkillFormationMatcher } from "../../utils/techMatch.js";
import "./OfferDetail.css";

/* ── helpers ─────────────────────────────────────────────────────────────── */
const LOGO_PALETTES = [
  { bg: "#4F46E5", color: "#fff" },
  { bg: "#0EA5E9", color: "#fff" },
  { bg: "#10B981", color: "#fff" },
  { bg: "#F59E0B", color: "#fff" },
  { bg: "#EF4444", color: "#fff" },
  { bg: "#8B5CF6", color: "#fff" },
  { bg: "#EC4899", color: "#fff" },
  { bg: "#6366F1", color: "#fff" },
];

function getLogoStyle(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return LOGO_PALETTES[Math.abs(h) % LOGO_PALETTES.length];
}

const timeAgo = (d, t) => {
  if (!d) return "";
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (days === 0) return t("offers.today");
  if (days === 1) return t("offers.yesterday");
  return t("offers.daysAgo", { count: days });
};

const formatDate = (d) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return null;
  }
};

const STATUS_CONFIG = {
  "en attente": { bg: "rgba(245,158,11,0.1)",  color: "#D97706" },
  "acceptée":   { bg: "rgba(16,185,129,0.1)",   color: "#059669" },
  "refusée":    { bg: "rgba(239,68,68,0.1)",    color: "#DC2626" },
  "en cours":   { bg: "rgba(37,99,235,0.1)",    color: "#2563EB" },
};

/* ── SkeletonPage ────────────────────────────────────────────────────────── */
function SkeletonPage() {
  return (
    <div className="od-page">
      <div className="od-skel od-skel-back" />
      <div className="od-layout">
        <div className="od-left">
          <div className="od-header-card">
            <div className="od-header-top">
              <div className="od-skel od-skel-logo" />
              <div className="od-header-info">
                <div className="od-skel od-skel-badge" />
                <div className="od-skel od-skel-title" />
                <div className="od-skel od-skel-company" />
                <div className="od-badges">
                  {[1, 2, 3].map((i) => <div key={i} className="od-skel od-skel-chip" />)}
                </div>
              </div>
            </div>
            <div className="od-tabs">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="od-skel od-skel-tab" />
              ))}
            </div>
          </div>
          <div className="od-card">
            <div className="od-skel od-skel-h2" style={{ marginBottom: "1rem" }} />
            {[100, 85, 100, 70, 90].map((w, i) => (
              <div key={i} className="od-skel od-skel-para" style={{ width: `${w}%`, marginBottom: "0.5rem" }} />
            ))}
          </div>
        </div>
        <aside className="od-right">
          <div className="od-card">
            <div className="od-skel od-skel-h2" style={{ marginBottom: "1rem" }} />
            <div className="od-skel od-skel-apply" style={{ marginBottom: "0.625rem" }} />
            <div className="od-skel od-skel-apply" style={{ marginBottom: "0.625rem" }} />
            <div className="od-skel od-skel-apply" />
          </div>
          <div className="od-card">
            <div className="od-skel od-skel-h2" style={{ marginBottom: "1rem" }} />
            {[1, 2, 3].map((i) => (
              <div key={i} className="od-skel od-skel-para" style={{ marginBottom: "0.5rem" }} />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ── NotFound ────────────────────────────────────────────────────────────── */
function NotFound({ t }) {
  return (
    <div className="od-not-found">
      <div className="od-not-found-icon">
        <FiAlertCircle size={40} />
      </div>
      <h2 className="od-not-found-title">{t("offers.offerNotFound")}</h2>
      <p className="od-not-found-desc">
        L'offre que vous cherchez n'existe plus ou a été supprimée.
      </p>
      <Link to="/dashboard/student/offers" className="btn btn-primary od-not-found-btn">
        <FiArrowLeft size={14} /> {t("offers.backToOffers")}
      </Link>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function OfferDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { t }      = useTranslation();
  const { user }   = useAuth();

  const [offer,        setOffer]       = useState(null);
  const [similar,      setSimilar]     = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [saved,        setSaved]       = useState(false);
  const [appliedApp,   setAppliedApp]  = useState(null);
  const [activeTab,    setActiveTab]   = useState("description");
  const [copySuccess,  setCopySuccess] = useState(false);

  const userSkillSet = new Set(
    (user?.skills || []).map((s) => (s.name || s).toLowerCase())
  );

  const formations = useFormationsTechMap();
  const matchFormationForSkill = buildSkillFormationMatcher(formations);

  const TABS = [
    { key: "description", label: t("offers.tabDescription") },
    { key: "exigences",   label: t("offers.tabRequirements") },
    { key: "avantages",   label: t("offers.tabBenefits")     },
    { key: "apropos",     label: t("offers.tabAbout")        },
    { key: "processus",   label: t("offers.tabProcess")      },
  ];

  const DEFAULT_PROCESS = [
    t("offers.process1"),
    t("offers.process2"),
    t("offers.process3"),
    t("offers.process4"),
  ];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([
      offersService.getOne(id),
      favoritesService.getAll(),
      applicationsService.getAll(),
    ])
      .then(([offRes, favRes, appRes]) => {
        const o = offRes.data.offer || offRes.data.offers?.[0] || offRes.data;
        if (!o || !o._id) throw new Error("Offre introuvable");
        setOffer(o);

        // Favorites
        const favIds = new Set((favRes.data.favorites || []).map((f) => f._id));
        setSaved(favIds.has(o._id));

        // Applied?
        const apps = appRes.data.applications || [];
        const found = apps.find(
          (a) => String(a.offerId?._id || a.offerId) === String(id)
        );
        if (found) {
          setAppliedApp({ createdAt: found.createdAt, status: found.status });
        }

        // Similar offers
        return offersService
          .getAll({ domain: o.domain, limit: 4 })
          .then((simRes) => {
            const all = simRes.data.offers || [];
            setSimilar(all.filter((s) => s._id !== id).slice(0, 3));
          });
      })
      .catch(() => {
        /* offer not found — setOffer stays null */
      })
      .finally(() => setLoading(false));
  }, [id]);

  /* handlers */
  const handleApply = () => navigate(`/dashboard/student/offers/${id}/apply`);

  const handleSave = async () => {
    setSaved((v) => !v);
    try { await favoritesService.toggle(id); }
    catch { setSaved((v) => !v); }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: offer?.title, url });
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2500);
      } catch { /* clipboard not available */ }
    }
  };

  /* ── Loading / error states ──────────────────────────────────────────── */
  if (loading) {
    return (
      <DashboardLayout>
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  if (!offer) {
    return (
      <DashboardLayout>
        <NotFound t={t} />
      </DashboardLayout>
    );
  }

  /* ── Derived data ────────────────────────────────────────────────────── */
  const ls          = getLogoStyle(offer.companyName || "");
  const skills      = Array.isArray(offer.skills)    ? offer.skills
    : Array.isArray(offer.motsCles) ? offer.motsCles : [];
  const missions    = Array.isArray(offer.missions)  ? offer.missions : [];
  const description = offer.description || offer.desc || "";
  const deadline    = formatDate(offer.deadline);
  const published   = formatDate(offer.createdAt);
  const statusConf  = appliedApp
    ? (STATUS_CONFIG[appliedApp.status] || STATUS_CONFIG["en attente"])
    : null;

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <DashboardLayout>
      <div className="od-page">

        {/* Back */}
        <Link to="/dashboard/student/offers" className="od-back">
          <FiArrowLeft size={16} /> {t("offers.backToOffers")}
        </Link>

        <div className="od-layout">

          {/* ════════ LEFT COLUMN ════════ */}
          <div className="od-left">

            {/* Header card */}
            <div className="od-header-card">
              <div className="od-header-top">
                <div className="od-logo" style={{ background: ls.bg, color: ls.color }}>
                  {(offer.companyName || "?")[0].toUpperCase()}
                </div>

                <div className="od-header-info">
                  <span className="od-type-badge">{offer.type || "Stage"}</span>
                  <h1 className="od-title">{offer.title}</h1>
                  <div className="od-company-row">
                    <span className="od-company-label">{offer.companyName}</span>
                    <span className="od-verified">✓</span>
                  </div>
                  <div className="od-badges">
                    {offer.location && (
                      <span className="od-badge">
                        <FiMapPin size={12} /> {offer.location}
                      </span>
                    )}
                    {offer.duration && (
                      <span className="od-badge">
                        <FiClock size={12} /> {offer.duration}
                      </span>
                    )}
                    {offer.createdAt && (
                      <span className="od-badge">
                        <FiCalendar size={12} /> {timeAgo(offer.createdAt, t)}
                      </span>
                    )}
                    {deadline && (
                      <span className="od-badge od-badge--deadline">
                        <FiCalendar size={12} /> {t("offers.deadlineLabel")} : {deadline}
                      </span>
                    )}
                    {appliedApp && (
                      <span className="od-badge od-badge--applied">
                        <FiCheckCircle size={12} /> {t("offers.alreadyApplied")}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  className={`od-bookmark ${saved ? "od-bookmark--saved" : ""}`}
                  onClick={handleSave}
                  aria-label={saved ? t("offers.savedOffer") : t("offers.saveOffer")}
                >
                  <FiBookmark size={18} fill={saved ? "currentColor" : "none"} />
                </button>
              </div>

              {/* Tabs */}
              <div className="od-tabs">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`od-tab ${activeTab === tab.key ? "od-tab--on" : ""}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tab: Description ─────────────────────────────────── */}
            {activeTab === "description" && (
              <>
                {(description || missions.length > 0 || skills.length > 0) && (
                  <div className="od-card">
                    <h2 className="od-card-title">{t("offers.aboutJob")}</h2>

                    {description && (
                      <div className="od-description">
                        {description.split("\n").filter(Boolean).map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                      </div>
                    )}

                    {missions.length > 0 && (
                      <div className="od-missions">
                        <h3 className="od-section-h">{t("offers.mainMissions")}</h3>
                        <ul className="od-mission-list">
                          {missions.map((m, i) => (
                            <li key={i} className="od-mission-item">
                              <span className="od-mission-check">
                                <FiCheck size={13} />
                              </span>
                              <span>{m}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {skills.length > 0 && (
                      <div className="od-skills-section">
                        <h3 className="od-section-h">{t("offers.techSkills")}</h3>
                        <div className="od-skills">
                          {skills.map((s) => {
                            const isMatch = userSkillSet.has(s.toLowerCase());
                            const formation = matchFormationForSkill(s);
                            const chipClass = `od-skill-chip${isMatch ? " od-skill-chip--match" : ""}${formation ? " od-skill-chip--link" : ""}`;
                            const content = (
                              <>
                                {isMatch ? <FiCheckCircle size={12} /> : <FiCode size={12} />}
                                {s}
                              </>
                            );
                            return formation ? (
                              <Link
                                key={s}
                                to={`/dashboard/student/formations/${formation.slug}`}
                                className={chipClass}
                                title={t("offers.skillLinkedToFormation", { formation: formation.title })}
                              >
                                {content}
                              </Link>
                            ) : (
                              <span key={s} className={chipClass}>{content}</span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Infos card */}
                <div className="od-card">
                  <h2 className="od-card-title">{t("offers.stageInfo")}</h2>
                  <div className="od-info-grid">
                    <div className="od-info-item">
                      <div className="od-info-item__ico"><FiBriefcase size={16} /></div>
                      <div>
                        <div className="od-info-item__lbl">{t("offers.typeCol")}</div>
                        <div className="od-info-item__val">{offer.type || "—"}</div>
                      </div>
                    </div>
                    <div className="od-info-item">
                      <div className="od-info-item__ico"><FiMapPin size={16} /></div>
                      <div>
                        <div className="od-info-item__lbl">{t("offers.locationCol")}</div>
                        <div className="od-info-item__val">{offer.location || "—"}</div>
                      </div>
                    </div>
                    <div className="od-info-item">
                      <div className="od-info-item__ico"><FiClock size={16} /></div>
                      <div>
                        <div className="od-info-item__lbl">{t("offers.durationLabel")}</div>
                        <div className="od-info-item__val">{offer.duration || "—"}</div>
                      </div>
                    </div>
                    <div className="od-info-item">
                      <div className="od-info-item__ico"><FiGrid size={16} /></div>
                      <div>
                        <div className="od-info-item__lbl">{t("offers.categoryCol")}</div>
                        <div className="od-info-item__val">{offer.domain || "—"}</div>
                      </div>
                    </div>
                    <div className="od-info-item">
                      <div className="od-info-item__ico"><FiCalendar size={16} /></div>
                      <div>
                        <div className="od-info-item__lbl">{t("offers.publishedCol")}</div>
                        <div className="od-info-item__val">{published || "—"}</div>
                      </div>
                    </div>
                    {deadline && (
                      <div className="od-info-item">
                        <div className="od-info-item__ico od-info-item__ico--warn">
                          <FiCalendar size={16} />
                        </div>
                        <div>
                          <div className="od-info-item__lbl">{t("offers.deadlineLabel")}</div>
                          <div className="od-info-item__val">{deadline}</div>
                        </div>
                      </div>
                    )}
                    {offer.salary > 0 && (
                      <div className="od-info-item">
                        <div className="od-info-item__ico od-info-item__ico--green">
                          <FiUsers size={16} />
                        </div>
                        <div>
                          <div className="od-info-item__lbl">{t("offers.salaryLabel")}</div>
                          <div className="od-info-item__val">{offer.salary} {t("offers.salarySuffix")}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── Tab: Exigences ───────────────────────────────────── */}
            {activeTab === "exigences" && (
              <div className="od-card">
                <h2 className="od-card-title">{t("offers.tabRequirements")}</h2>
                {offer.requirements ? (
                  <div className="od-description">
                    {offer.requirements.split("\n").filter(Boolean).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                ) : (
                  <p className="od-empty-tab">{t("offers.noRequirements")}</p>
                )}
                {skills.length > 0 && (
                  <div className="od-skills" style={{ marginTop: "1.25rem" }}>
                    {skills.map((s) => {
                      const isMatch = userSkillSet.has(s.toLowerCase());
                      const formation = matchFormationForSkill(s);
                      const chipClass = `od-skill-chip${isMatch ? " od-skill-chip--match" : ""}${formation ? " od-skill-chip--link" : ""}`;
                      const content = (
                        <>
                          {isMatch ? <FiCheckCircle size={12} /> : <FiCode size={12} />}
                          {s}
                        </>
                      );
                      return formation ? (
                        <Link
                          key={s}
                          to={`/dashboard/student/formations/${formation.slug}`}
                          className={chipClass}
                          title={t("offers.skillLinkedToFormation", { formation: formation.title })}
                        >
                          {content}
                        </Link>
                      ) : (
                        <span key={s} className={chipClass}>{content}</span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Avantages ───────────────────────────────────── */}
            {activeTab === "avantages" && (
              <div className="od-card">
                <h2 className="od-card-title">{t("offers.tabBenefits")}</h2>
                {offer.benefits ? (
                  <div className="od-description">
                    {offer.benefits.split("\n").filter(Boolean).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                ) : (
                  <p className="od-empty-tab">{t("offers.noBenefits")}</p>
                )}
              </div>
            )}

            {/* ── Tab: À propos ────────────────────────────────────── */}
            {activeTab === "apropos" && (
              <div className="od-card">
                <h2 className="od-card-title">{t("offers.aboutCompany")}</h2>
                {offer.companyDescription ? (
                  <div className="od-description">
                    {offer.companyDescription.split("\n").filter(Boolean).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                ) : (
                  <p className="od-empty-tab">{t("offers.noCompanyInfo")}</p>
                )}
              </div>
            )}

            {/* ── Tab: Processus ───────────────────────────────────── */}
            {activeTab === "processus" && (
              <div className="od-card">
                <h2 className="od-card-title">{t("offers.recruitmentProcess")}</h2>
                {offer.process ? (
                  <div className="od-description">
                    {offer.process.split("\n").filter(Boolean).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                ) : (
                  <div className="od-process-steps">
                    {DEFAULT_PROCESS.map((step, i) => (
                      <div key={i} className="od-process-step">
                        <div className="od-process-step__num">{i + 1}</div>
                        <div className="od-process-step__lbl">{step}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* ════════ RIGHT SIDEBAR ════════ */}
          <aside className="od-right">

            {/* Card Postuler / Applied */}
            <div className="od-card od-card--apply">
              <h3 className="od-sidebar-title">{t("offers.applyNow")}</h3>

              {appliedApp ? (
                <div className="od-applied-banner">
                  <FiCheckCircle size={20} className="od-applied-icon" />
                  <div className="od-applied-body">
                    <div className="od-applied-title">{t("offers.alreadyApplied")}</div>
                    {appliedApp.createdAt && (
                      <div className="od-applied-date">
                        {t("offers.appliedOn")} {formatDate(appliedApp.createdAt)}
                      </div>
                    )}
                    {statusConf && (
                      <span
                        className="od-applied-status"
                        style={{ background: statusConf.bg, color: statusConf.color }}
                      >
                        {t(`status.${appliedApp.status}`)}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <p className="od-apply-sub">{t("offers.applyPrompt")}</p>
                  <button className="od-btn-apply" onClick={handleApply}>
                    <FiSend size={16} />
                    {t("offers.applyNow")}
                  </button>
                </>
              )}

              <button
                className={`od-btn-save ${saved ? "od-btn-save--saved" : ""}`}
                onClick={handleSave}
              >
                <FiBookmark size={15} fill={saved ? "currentColor" : "none"} />
                {saved ? t("offers.savedOffer") : t("offers.saveOffer")}
              </button>

              <button className="od-btn-share" onClick={handleShare}>
                {copySuccess ? <FiCheck size={15} /> : <FiShare2 size={15} />}
                {copySuccess ? t("offers.copySuccess") : t("offers.shareOffer")}
              </button>
            </div>

            {/* Card Entreprise */}
            <div className="od-card od-card--company">
              <h3 className="od-sidebar-title">{t("offers.aboutCompany")}</h3>
              <div className="od-company-header">
                <div
                  className="od-company-logo"
                  style={{ background: ls.bg, color: ls.color }}
                >
                  {(offer.companyName || "?")[0].toUpperCase()}
                </div>
                <div>
                  <div className="od-company-name">
                    {offer.companyName}
                    <span className="od-verified" style={{ marginLeft: 4 }}>✓</span>
                  </div>
                  <div className="od-company-type">
                    {offer.companyType || offer.sector || offer.domain || ""}
                  </div>
                </div>
              </div>

              <div className="od-company-infos">
                {offer.website && (
                  <div className="od-company-info-row">
                    <FiGlobe size={14} className="od-company-info-ico" />
                    <span className="od-company-info-lbl">{t("offers.companyWebsite")}</span>
                    <a
                      href={offer.website}
                      target="_blank"
                      rel="noreferrer"
                      className="od-company-info-link"
                    >
                      {offer.website.replace(/https?:\/\//, "")}
                      <FiExternalLink size={11} />
                    </a>
                  </div>
                )}
                <div className="od-company-info-row">
                  <FiMapPin size={14} className="od-company-info-ico" />
                  <span className="od-company-info-lbl">{t("offers.locationCol")}</span>
                  <span className="od-company-info-val">{offer.location || "—"}</span>
                </div>
                {offer.companySize && (
                  <div className="od-company-info-row">
                    <FiUsers size={14} className="od-company-info-ico" />
                    <span className="od-company-info-lbl">{t("offers.teamSize")}</span>
                    <span className="od-company-info-val">{offer.companySize}</span>
                  </div>
                )}
                <div className="od-company-info-row">
                  <FiGrid size={14} className="od-company-info-ico" />
                  <span className="od-company-info-lbl">{t("offers.sector")}</span>
                  <span className="od-company-info-val">
                    {offer.sector || offer.domain || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Offres similaires */}
            {similar.length > 0 && (
              <div className="od-card od-card--similar">
                <h3 className="od-sidebar-title">{t("offers.similarOffers")}</h3>
                <div className="od-similar-list">
                  {similar.map((s) => {
                    const sl = getLogoStyle(s.companyName || "");
                    return (
                      <Link
                        key={s._id}
                        to={`/dashboard/student/offers/${s._id}`}
                        className="od-similar-item"
                      >
                        <div
                          className="od-similar-logo"
                          style={{ background: sl.bg, color: sl.color }}
                        >
                          {(s.companyName || "?")[0].toUpperCase()}
                        </div>
                        <div className="od-similar-info">
                          <div className="od-similar-title">{s.title}</div>
                          <div className="od-similar-co">{s.companyName}</div>
                          {s.location && (
                            <div className="od-similar-loc">
                              <FiMapPin size={10} /> {s.location}
                            </div>
                          )}
                        </div>
                        <div className="od-similar-right">
                          <div className="od-similar-date">{timeAgo(s.createdAt, t)}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                <Link to="/dashboard/student/offers" className="od-similar-more">
                  {t("offers.viewAllSimilar")} <span>›</span>
                </Link>
              </div>
            )}

          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
