import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiCheck, FiUser, FiAward, FiBriefcase, FiUsers, FiThumbsUp,
  FiSearch, FiCpu, FiSmartphone, FiShield, FiBarChart2, FiFolder,
  FiFacebook, FiLinkedin, FiInstagram, FiYoutube,
} from "react-icons/fi";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import CeremonyLeaderboard from "../components/ceremony/CeremonyLeaderboard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useDocumentMeta } from "../hooks/useDocumentMeta.js";
import { useCeremonySelection, MAX_SELECTION } from "../hooks/useCeremonySelection.js";
import { useCeremonyVoteGate } from "../hooks/useCeremonyVoteGate.js";
import { ceremonyService } from "../services/ceremony.service.js";
import "../components/common/NewsSection.css";
import "./FormationsPage.css";
import "./CeremonyPage.css";

const VOTE_GATE_MESSAGE_KEY = {
  closed:     "ceremony.voteClosed",
  notStarted: "ceremony.voteNotStarted",
  ended:      "ceremony.voteEnded",
};

// Icône de catégorie déduite des technologies du projet — purement
// décoratif (petit badge sur la couverture), pas de nouvelle donnée
// serveur : simple correspondance par mot-clé, avec repli générique.
const CATEGORY_ICON_RULES = [
  { keywords: ["ia", "ai", "machine learning", "scikit", "openai", "nlp"], Icon: FiCpu },
  { keywords: ["flutter", "react native", "swift", "kotlin", "mobile"], Icon: FiSmartphone },
  { keywords: ["solidity", "hardhat", "blockchain", "sécurité", "security"], Icon: FiShield },
  { keywords: ["power bi", "sql", "airflow", "data"], Icon: FiBarChart2 },
];
function getCategoryIcon(technologies = []) {
  const joined = technologies.join(" ").toLowerCase();
  const rule = CATEGORY_ICON_RULES.find((r) => r.keywords.some((k) => joined.includes(k)));
  return rule ? rule.Icon : FiFolder;
}

function StatCard({ Icon, value, label, color }) {
  return (
    <div className="cp-stat-card">
      <span className="cp-stat-card__icon" style={{ background: `${color}18`, color }}>
        <Icon size={20} />
      </span>
      <div>
        <div className="cp-stat-card__value">{value ?? "—"}</div>
        <div className="cp-stat-card__label">{label}</div>
      </div>
    </div>
  );
}

export default function CeremonyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const voteGateReason = useCeremonyVoteGate();
  const voteDisabled = voteGateReason !== null;

  useDocumentMeta({
    title: "Cérémonie — Votez pour vos projets préférés | TheBridgeFlow",
    description: "Découvrez les projets soumis par les étudiants TheBridgeFlow et votez pour vos 3 préférés. Classement en temps réel.",
  });

  const [projects,   setProjects]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [stats,      setStats]      = useState(null);
  const [search,     setSearch]     = useState("");
  const [category,   setCategory]   = useState("");
  const { selected, toggleSelect: toggleSelection, clearSelection } = useCeremonySelection();
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState(false);

  useEffect(() => {
    ceremonyService.getProjects()
      .then(({ data }) => setProjects(data.projects || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    ceremonyService.getStats()
      .then(({ data }) => setStats(data))
      .catch(() => {});
  }, []);

  // Catégories disponibles = technologies distinctes réellement présentes
  // dans les projets chargés — pas de liste figée côté client.
  const categories = useMemo(
    () => [...new Set(projects.flatMap((p) => p.technologies || []))].sort(),
    [projects]
  );

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      const matchesSearch = !q
        || p.title.toLowerCase().includes(q)
        || (p.description || "").toLowerCase().includes(q);
      const matchesCategory = !category || (p.technologies || []).includes(category);
      return matchesSearch && matchesCategory;
    });
  }, [projects, search, category]);

  const toggleSelect = (id) => {
    if (success || voteDisabled) return;
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
    if (selected.length < 1) return;

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

      {/* ── HERO — spécifique Cérémonie (dégradé indigo/violet + trophée),
          ne réutilise pas .fp-hero (partagé Formations/Offres, thème clair)
          pour ne pas impacter ces autres pages. ─────────────────────────── */}
      <section className="cp-hero">
        <div className="cp-hero__inner">
          <span className="cp-hero__badge"><FiAward size={13} /> {t("ceremony.badge")}</span>
          <h1 className="cp-hero__title">{t("ceremony.title")}</h1>
          <p className="cp-hero__subtitle">{t("ceremony.subtitle")}</p>
        </div>
      </section>

      <main className="cp-main">
        {/* ── CLASSEMENT EN DIRECT + TOP PROJETS (2 cartes, même source de
            données, un seul appel réseau — voir CeremonyLeaderboard.jsx) ── */}
        <section className="cp-leaderboard-section">
          <CeremonyLeaderboard />
        </section>

        {/* ── STATISTIQUES ─────────────────────────────────────────────── */}
        <section className="cp-stats">
          <StatCard Icon={FiBriefcase} value={stats?.projectsCount} label={t("ceremony.statsProjects")} color="#2563EB" />
          <StatCard Icon={FiUsers}     value={stats?.participantsCount} label={t("ceremony.statsParticipants")} color="#10B981" />
          <StatCard Icon={FiThumbsUp}  value={stats?.votesCount} label={t("ceremony.statsVotes")} color="#8B5CF6" />
          <StatCard Icon={FiAward}     value={stats?.rewardedCount} label={t("ceremony.statsRewarded")} color="#EC4899" />
        </section>

        {/* ── TOUS LES PROJETS ─────────────────────────────────────────── */}
        <section className="cp-section" id="ceremonie-grille">
          <div className="cp-projects-heading">
            <h2>{t("ceremony.projectsTitle")}</h2>
          </div>
          <p className="cp-projects-sub">{t("ceremony.allProjectsSub")}</p>

          <div className="cp-toolbar">
            <div className="cp-search">
              <FiSearch size={16} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("ceremony.searchPlaceholder")}
              />
            </div>
            {categories.length > 0 && (
              <select className="cp-category-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">{t("ceremony.allCategories")}</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          {success ? (
            <div className="cp-success">{t("ceremony.voteSuccess")}</div>
          ) : voteDisabled ? (
            <div className="cp-error">{t(VOTE_GATE_MESSAGE_KEY[voteGateReason])}</div>
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
          ) : filteredProjects.length === 0 ? (
            <p className="cp-empty">{t("ceremony.noResults")}</p>
          ) : (
            <div className="news-grid cp-grid">
              {filteredProjects.map((p) => {
                const isSelected = selected.includes(p._id);
                const atMax = !isSelected && selected.length >= MAX_SELECTION;
                const CategoryIcon = getCategoryIcon(p.technologies);
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
                      <span className="cp-card__category-icon"><CategoryIcon size={14} /></span>
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
                          disabled={success || atMax || voteDisabled}
                          onClick={(e) => { e.stopPropagation(); toggleSelect(p._id); }}
                        >
                          {isSelected ? <FiCheck size={14} /> : <FiThumbsUp size={14} />}
                          {isSelected ? t("ceremony.voteCancel") : t("ceremony.vote")}
                        </button>
                        <span className="cp-card__votes">{t("ceremony.voteCount", { count: p.voteCount })}</span>
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
                disabled={selected.length < 1 || submitting || voteDisabled}
                onClick={handleConfirmVote}
              >
                {submitting ? t("ceremony.submitting") : t("ceremony.confirmVote", { count: selected.length })}
              </button>
            </div>
          )}
        </section>
      </main>

      {/* ── FOOTER — compact, spécifique à cette page (aucun composant Footer
          partagé n'existe dans le projet ; LandingPage.jsx a son propre
          footer inline, plus riche, non réutilisé ici pour éviter de le
          complexifier pour un seul autre appelant). Liens/réseaux réels,
          identiques à ceux de LandingPage.jsx. ─────────────────────────── */}
      <footer className="cp-footer">
        <div className="cp-footer__inner">
          <div className="cp-footer__brand">
            <img src="/favicon.png" alt="Logo" className="cp-footer__logo" />
            <span className="cp-footer__name">TheBridgeFlow</span>
          </div>
          <p className="cp-footer__tagline">{t("ceremony.footerTagline")}</p>

          <nav className="cp-footer__nav">
            <Link to="/">{t("nav.home")}</Link>
            <Link to="/offers">{t("nav.offers")}</Link>
            <Link to="/formations">{t("nav.formations")}</Link>
            <Link to="/ceremonie">{t("nav.ceremony")}</Link>
            <a href="/#about">{t("nav.about")}</a>
            <a href="/#contact">{t("nav.contact")}</a>
          </nav>

          <div className="cp-footer__socials">
            <a href="https://www.facebook.com/9antra.tn" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><FiFacebook size={16} /></a>
            <a href="https://www.linkedin.com/company/9antra-tn-the-bridge/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><FiLinkedin size={16} /></a>
            <a href="https://www.instagram.com/9antra.tn_the_bridge/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><FiInstagram size={16} /></a>
            <a href="https://www.youtube.com/@9antra.tn_the_bridge" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><FiYoutube size={16} /></a>
          </div>

          <div className="cp-footer__bottom">© 2026 TheBridgeFlow. {t("landing.copyright")}.</div>
        </div>
      </footer>
    </div>
  );
}
