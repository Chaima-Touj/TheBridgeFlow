import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiUsers, FiTrendingUp, FiAward } from "react-icons/fi";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import { useDocumentMeta } from "../hooks/useDocumentMeta.js";
import { ceremonyService } from "../services/ceremony.service.js";
import "../components/common/NewsSection.css";
import "./FormationsPage.css";
import "./CeremonyPage.css";
import "./CeremonyArchives.css";

/* Page publique "Archives Cérémonie" — liste de cards, une par édition
   passée (edition < édition en cours, voir getCeremonyArchives côté
   backend). Réutilise le hero partagé .fp-hero (déjà utilisé par /ceremonie
   avant sa refonte, /formations, /tarifs, etc.) et la grille .news-grid déjà
   en place (mêmes classes que CeremonyPage.jsx), pattern liste -> détail
   identique à Formations (FormationsPage.jsx -> FormationDetail.jsx). */
export default function CeremonyArchives() {
  const { t } = useTranslation();
  const [editions, setEditions] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useDocumentMeta({
    title: "Archives Cérémonie | TheBridgeFlow",
    description: "Consultez les éditions précédentes de la Cérémonie TheBridgeFlow et leurs projets primés.",
  });

  useEffect(() => {
    ceremonyService.getArchives()
      .then(({ data }) => setEditions(data.editions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fp-page">
      <SiteNavbar />

      <section className="fp-hero">
        <div className="fp-hero__inner">
          <span className="fp-hero__badge"><FiAward size={13} /> {t("ceremony.archivesBadge")}</span>
          <h1 className="fp-hero__title">{t("ceremony.archivesTitle")}</h1>
          <p className="fp-hero__subtitle">{t("ceremony.archivesSubtitle")}</p>
        </div>
      </section>

      <main className="cp-main">
        <section className="cp-section">
          <Link to="/ceremonie" className="ca-back">{t("ceremony.backToCeremony")}</Link>

          {loading ? (
            <div className="news-grid">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="news-card news-card--skeleton" aria-hidden="true" />
              ))}
            </div>
          ) : editions.length === 0 ? (
            <p className="cp-empty">{t("ceremony.archivesEmpty")}</p>
          ) : (
            <div className="news-grid">
              {editions.map((e) => (
                <Link key={e.edition} to={`/ceremonie/archives/${e.edition}`} className="news-card ca-card">
                  <div className="ca-card__year">{e.edition}</div>
                  <div className="news-card__body">
                    <h3 className="news-card__title">{t("ceremony.editionLabel", { edition: e.edition })}</h3>
                    {e.winner && (
                      <p className="ca-card__winner">
                        <FiAward size={13} /> {e.winner.title}
                      </p>
                    )}
                    <div className="ca-card__stats">
                      <span><FiUsers size={13} /> {t("ceremony.archiveProjectCount", { count: e.projectCount })}</span>
                      <span><FiTrendingUp size={13} /> {t("ceremony.archiveTotalVotes", { count: e.totalVotes })}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
