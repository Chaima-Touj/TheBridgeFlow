import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiCheck, FiUser } from "react-icons/fi";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import CeremonyLeaderboard from "../components/ceremony/CeremonyLeaderboard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useDocumentMeta } from "../hooks/useDocumentMeta.js";
import { ceremonyService } from "../services/ceremony.service.js";
import "../components/common/NewsSection.css";
import "./FormationsPage.css";
import "./CeremonyPage.css";

const MAX_SELECTION = 3;
// Sélection sauvegardée le temps d'un aller-retour par /login (le flux de
// connexion existant ne redirige pas vers la page d'origine — voir
// Login.jsx — donc restaurée seulement si l'étudiant revient sur cette page
// après connexion, pas automatiquement redirigé ici).
const PENDING_VOTE_KEY = "ceremony_pending_vote";

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
  const [selected,   setSelected]   = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState(false);

  useEffect(() => {
    ceremonyService.getProjects()
      .then(({ data }) => setProjects(data.projects || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Restaure une sélection en attente si l'étudiant revient ici après
  // connexion (voir handleConfirmVote).
  useEffect(() => {
    if (!user) return;
    const pending = sessionStorage.getItem(PENDING_VOTE_KEY);
    if (!pending) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(JSON.parse(pending));
    } catch {
      // Valeur corrompue — ignorée silencieusement, pas de sélection perdue
      // à récupérer de toute façon.
    }
    sessionStorage.removeItem(PENDING_VOTE_KEY);
  }, [user]);

  const toggleSelect = (id) => {
    if (success) return;
    setError("");
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SELECTION) return prev;
      return [...prev, id];
    });
  };

  const handleConfirmVote = async () => {
    if (selected.length !== MAX_SELECTION) return;

    if (!user) {
      sessionStorage.setItem(PENDING_VOTE_KEY, JSON.stringify(selected));
      navigate("/login", { state: { from: "/ceremonie" } });
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await ceremonyService.vote(selected);
      setSuccess(true);
      setSelected([]);
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
                return (
                  <article
                    key={p._id}
                    className={`news-card cp-card${isSelected ? " cp-card--selected" : ""}${success ? " cp-card--locked" : ""}`}
                    onClick={() => toggleSelect(p._id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && toggleSelect(p._id)}
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
