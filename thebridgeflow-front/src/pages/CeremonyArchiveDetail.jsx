import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiUser, FiUsers, FiTrendingUp, FiAward } from "react-icons/fi";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import { useDocumentMeta } from "../hooks/useDocumentMeta.js";
import { ceremonyService } from "../services/ceremony.service.js";
import "../components/common/NewsSection.css";
import "./FormationsPage.css";
import "./CeremonyPage.css";
import "./CeremonyProjectDetail.css";
import "./CeremonyArchives.css";

/* Détail d'une édition archivée — liste en lecture seule de tous ses
   CeremonyProject (titre, auteur, description, technologies, équipe, image,
   votes final). Pas de bloc de vote ni de QR (voir CeremonyProjectDetail.jsx
   pour la version "édition en cours" avec ces fonctionnalités) — cette page
   ne sert que la consultation d'une édition déjà terminée. */
export default function CeremonyArchiveDetail() {
  const { edition } = useParams();
  const { t } = useTranslation();

  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useDocumentMeta({
    title: `Cérémonie ${edition} — Archives | TheBridgeFlow`,
    description: `Découvrez les projets de la Cérémonie ${edition} chez TheBridgeFlow.`,
  });

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    ceremonyService.getArchiveEdition(edition)
      .then(({ data }) => { if (active) setProjects(data.projects || []); })
      .catch((err) => { if (active) setError(err?.response?.data?.message || t("ceremony.projectNotFound")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [edition, t]);

  return (
    <div className="fp-page">
      <SiteNavbar />

      <section className="fp-hero">
        <div className="fp-hero__inner">
          <span className="fp-hero__badge"><FiAward size={13} /> {t("ceremony.archivesBadge")}</span>
          <h1 className="fp-hero__title">{t("ceremony.editionLabel", { edition })}</h1>
          <p className="fp-hero__subtitle">{t("ceremony.archiveDetailSubtitle")}</p>
        </div>
      </section>

      <main className="cp-main">
        <section className="cp-section">
          <Link to="/ceremonie/archives" className="ca-back">{t("ceremony.backToArchives")}</Link>

          {loading ? (
            <div className="news-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="news-card news-card--skeleton" aria-hidden="true" />
              ))}
            </div>
          ) : error ? (
            <p className="cp-empty">{error}</p>
          ) : (
            <div className="news-grid cp-grid">
              {projects.map((p) => (
                <article key={p._id} className="news-card cp-card">
                  <div className="news-card__img-wrap">
                    {p.coverImage
                      ? <img src={p.coverImage} alt="" className="news-card__img" loading="lazy" />
                      : <div className="cp-card__placeholder" />}
                  </div>
                  <div className="news-card__body">
                    <div className="news-card__meta">
                      <span className="news-card__meta-item">
                        <FiUser size={13} /> {p.studentId?.name || t("ceremony.unknownAuthor")}
                      </span>
                    </div>
                    <h3 className="news-card__title">{p.title}</h3>
                    {p.description && <p className="news-card__excerpt">{p.description}</p>}

                    {p.technologies?.length > 0 && (
                      <div className="cpd-techs">
                        {p.technologies.map((tech) => (
                          <span key={tech} className="cpd-tech-chip">{tech}</span>
                        ))}
                      </div>
                    )}

                    {p.teamMembers?.length > 0 && (
                      <div className="cpd-team">
                        <FiUsers size={14} />
                        <span>{p.teamMembers.join(", ")}</span>
                      </div>
                    )}

                    <div className="ca-card__winner">
                      <FiTrendingUp size={13} /> {t("ceremony.voteCount", { count: p.voteCount })}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
