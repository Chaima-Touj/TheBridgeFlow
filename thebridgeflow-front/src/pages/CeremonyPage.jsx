import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiCheck, FiUser } from "react-icons/fi";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import CeremonyLeaderboard from "../components/ceremony/CeremonyLeaderboard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useDocumentMeta } from "../hooks/useDocumentMeta.js";
import { useCeremonySelection, MAX_SELECTION } from "../hooks/useCeremonySelection.js";
import { ceremonyService } from "../services/ceremony.service.js";
import "../components/common/NewsSection.css";
import "./FormationsPage.css";
import "./CeremonyPage.css";

export default function CeremonyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  useDocumentMeta({
    title: "Cérémonie — Votez pour vos projets préférés | TheBridgeFlow",
    description: "Découvrez les projets soumis par les étudiants TheBridgeFlow et votez pour vos 3 préférés. Classement en temps réel.",
  });

  const [projects,   setProjects]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const { selected, toggleSelect: toggleSelection, clearSelection } = useCeremonySelection();
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState(false);

  useEffect(() => {
    ceremonyService.getProjects()
      .then(({ data }) => setProjects(data.projects || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleSelect = (id) => {
    if (success) return;
    setError("");
    toggleSelection(id);
  };

  // Tilt 3D au survol, suivant la position du curseur — appliqué directement
  // au DOM (pas de setState) pour rester fluide même avec de nombreuses
  // cartes ; la transition CSS sur .cp-card gère le lissage/retour à plat.
  const TILT_MAX_DEG = 6;
  const handleCardTilt = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * TILT_MAX_DEG * 2;
    const rotateX = (0.5 - py) * TILT_MAX_DEG * 2;
    card.style.transform = `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-6px)`;
  };
  const resetCardTilt = (e) => {
    e.currentTarget.style.transform = "";
  };

  const handleConfirmVote = async () => {
    if (selected.length !== MAX_SELECTION) return;

    if (!user) {
      navigate("/login");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await ceremonyService.vote(selected);
      setSuccess(true);
      clearSelection();
    } catch (err) {
      setError(err.response?.data?.message || t("ceremony.voteError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fp-page">
      <SiteNavbar />

      <section className="fp-hero">
        <div className="fp-hero__inner">
          <span className="fp-hero__badge">🏆 {t("ceremony.badge")}</span>
          <h1 className="fp-hero__title">{t("ceremony.title")}</h1>
          <p className="fp-hero__subtitle">{t("ceremony.subtitle")}</p>
        </div>
      </section>

      <main className="cp-main">
        <section className="cp-section">
          <h2 className="cp-section-title">{t("ceremony.leaderboardTitle")}</h2>
          <CeremonyLeaderboard />
        </section>

        <section className="cp-section">
          <h2 className="cp-section-title">{t("ceremony.projectsTitle")}</h2>

          {success ? (
            <div className="cp-success">{t("ceremony.voteSuccess")}</div>
          ) : (
            <p className="cp-vote-hint">{t("ceremony.voteHint", { count: selected.length })}</p>
          )}
          {error && <div className="cp-error">{error}</div>}

          {loading ? (
            <div className="news-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="news-card news-card--skeleton" aria-hidden="true" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <p className="cp-empty">{t("ceremony.projectsEmpty")}</p>
          ) : (
            <div className="news-grid cp-grid">
              {projects.map((p) => {
                const isSelected = selected.includes(p._id);
                const atMax = !isSelected && selected.length >= MAX_SELECTION;
                return (
                  <article
                    key={p._id}
                    className={`news-card cp-card${isSelected ? " cp-card--selected" : ""}${success ? " cp-card--locked" : ""}`}
                    onMouseMove={success ? undefined : handleCardTilt}
                    onMouseLeave={resetCardTilt}
                  >
                    <div className="news-card__img-wrap">
                      {p.coverImage
                        ? <img src={p.coverImage} alt="" className="news-card__img" loading="lazy" />
                        : <div className="cp-card__placeholder" />}
                      {isSelected && (
                        <span className="cp-card__check"><FiCheck size={16} /></span>
                      )}
                    </div>
                    <div className="news-card__body">
                      <div className="news-card__meta">
                        <span className="news-card__meta-item">
                          <FiUser size={13} /> {p.studentId?.name || t("ceremony.unknownAuthor")}
                        </span>
                      </div>
                      <h3 className="news-card__title">{p.title}</h3>
                      {p.description && <p className="news-card__excerpt">{p.description}</p>}
                      <div className="cp-card__actions">
                        <Link
                          to={`/ceremonie/${p._id}`}
                          className="cp-card__btn cp-card__btn--view"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t("ceremony.viewDetail")}
                        </Link>
                        <button
                          type="button"
                          className={`cp-card__btn cp-card__btn--vote${isSelected ? " cp-card__btn--active" : ""}`}
                          disabled={success || atMax}
                          onClick={(e) => { e.stopPropagation(); toggleSelect(p._id); }}
                        >
                          {isSelected && <FiCheck size={14} />}
                          {isSelected ? t("ceremony.voteCancel") : t("ceremony.vote")}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!success && projects.length > 0 && (
            <div className="cp-vote-bar">
              <button
                type="button"
                className="btn btn-primary"
                disabled={selected.length !== MAX_SELECTION || submitting}
                onClick={handleConfirmVote}
              >
                {submitting ? t("ceremony.submitting") : t("ceremony.confirmVote", { count: selected.length })}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
