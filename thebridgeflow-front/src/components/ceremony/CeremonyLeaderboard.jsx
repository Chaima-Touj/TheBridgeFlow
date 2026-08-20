import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FiUser, FiTrendingUp, FiAward, FiList, FiArrowRight, FiThumbsUp } from "react-icons/fi";
import { ceremonyService } from "../../services/ceremony.service.js";
import { scrollToSection } from "../../utils/scrollToSection.js";
import "./CeremonyLeaderboard.css";

// Même cadence que le polling déjà établi dans l'app (notifications,
// DashboardLayout.jsx L31) — pas de WebSocket, cohérent avec l'architecture
// existante.
const REFRESH_INTERVAL_MS = 30000;

// Icône couronne — FiAward (déjà utilisé pour "Cérémonie" dans Sidebar.jsx),
// pas d'émoji : la distinction or/argent/bronze vient entièrement de CSS
// (couleur du badge podium, couleur du texte en liste), pas d'un glyphe à
// couleurs fixes. Même icône que .fp-hero__badge (CeremonyPage.jsx) pour
// rester cohérent avec le reste de la page.

// Transition "premium" — ni trop raide (sec, mécanique) ni trop molle (lent,
// gluant) : valeurs modérées pour un effet FLIP fluide sur le réordonnancement.
const CARD_TRANSITION = { type: "spring", stiffness: 300, damping: 30 };

// Au-delà de quelques centaines de votes un compteur en clair devient
// difficile à lire d'un coup d'œil — bascule en notation courte (1.5k).
// Les volumes réels actuels restent à 2 chiffres, donc cette branche est
// prête mais inactive tant que le nombre de votes ne le justifie pas.
function formatVoteLabel(count, t) {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M ${t("ceremony.votes")}`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k ${t("ceremony.votes")}`;
  }
  return t("ceremony.voteCount", { count });
}

/* ─── Avatar auteur — même pattern que Sidebar.jsx (avatarUrl ou initiale
   sur fond coloré déterministe à partir du nom) ────────────────────────── */
const AVATAR_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#0EA5E9", "#EC4899"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function AuthorAvatar({ author, size = 28 }) {
  const name = author?.name || "";
  return author?.avatarUrl ? (
    <img src={author.avatarUrl} alt="" className="cl-avatar" style={{ width: size, height: size }} />
  ) : (
    <span
      className="cl-avatar cl-avatar--initial"
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.42 }}
    >
      {name[0]?.toUpperCase() || <FiUser size={size * 0.5} />}
    </span>
  );
}

/* ─── Colonne podium (top 3) ──────────────────────────────────────────────
   layoutId (partagé avec TopProjectRow) : permet à Framer Motion d'animer en
   douceur le passage d'un projet entre le podium et la liste "Top projets"
   (deux arbres JSX différents), pas seulement le réordonnancement DANS
   le podium (couvert par `layout`). L'avatar de l'auteur (photo ou
   initiale) est le visuel principal de chaque colonne — pas la couverture
   du projet. Pas d'apparence "carte" (bordure/ombre/padding uniforme) :
   la hiérarchie visuelle vient uniquement de la barre colorée en bas de
   colonne, dont la hauteur varie par rang (voir .cl-podium-bar--rank{n}),
   les 3 colonnes restant alignées sur une base commune. Badge : trophée
   pour le 1er, numéro de rang pour le 2e/3e (référence design). */
function PodiumCard({ project, rank, t }) {
  return (
    <motion.div
      layoutId={`ceremony-project-${project._id}`}
      layout
      transition={CARD_TRANSITION}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      className={`cl-podium-col cl-podium-col--rank${rank}`}
    >
      <span className={`cl-podium-badge cl-podium-badge--rank${rank}`}>
        {rank === 1 ? <FiAward size={26} /> : rank}
      </span>
      <div className="cl-podium-avatar-ring">
        <AuthorAvatar author={project.studentId} size={rank === 1 ? 92 : 72} />
      </div>
      <Link to={`/ceremonie/${project._id}`} className="cl-podium-title">{project.title}</Link>
      <span className="cl-podium-author-name">{project.studentId?.name || t("ceremony.unknownAuthor")}</span>
      <div className="cl-podium-votes">
        <FiTrendingUp size={13} />
        {formatVoteLabel(project.voteCount, t)}
      </div>
      <div className={`cl-podium-bar cl-podium-bar--rank${rank}`}>
        <span className="cl-podium-bar__rank">{rank}</span>
      </div>
    </motion.div>
  );
}

/* ─── Ligne "Top projets" (4e place et plus, aperçu des 3 suivantes) ──────
   Carte distincte du podium, avec description + badge de votes façon pilule
   (pouce levé), conforme à la référence visuelle. ─────────────────────── */
function TopProjectRow({ project, rank, t }) {
  return (
    <motion.div
      layoutId={`ceremony-project-${project._id}`}
      layout
      transition={CARD_TRANSITION}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="cl-toprow"
    >
      <span className="cl-toprow-rank">#{rank}</span>
      <AuthorAvatar author={project.studentId} size={40} />
      <div className="cl-toprow-body">
        <Link to={`/ceremonie/${project._id}`} className="cl-toprow-title">{project.title}</Link>
        <span className="cl-toprow-author">{project.studentId?.name || t("ceremony.unknownAuthor")}</span>
      </div>
      {project.description && <p className="cl-toprow-desc">{project.description}</p>}
      <span className="cl-toprow-votes">
        <FiThumbsUp size={13} /> {formatVoteLabel(project.voteCount, t)}
      </span>
    </motion.div>
  );
}

function LeaderboardSkeleton() {
  return (
    <>
      <div className="cl-card" aria-hidden="true">
        <div className="cl-podium">
          {[2, 1, 3].map((rank) => (
            <div key={rank} className={`cl-podium-col cl-podium-col--rank${rank} cl-podium-col--skeleton`} />
          ))}
        </div>
      </div>
      <div className="cl-card" aria-hidden="true">
        <div className="cl-toplist">
          {[4, 5, 6].map((i) => <div key={i} className="cl-toprow cl-toprow--skeleton" />)}
        </div>
      </div>
    </>
  );
}

export default function CeremonyLeaderboard() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState(null); // null = chargement initial

  const loadLeaderboard = useCallback(() => {
    ceremonyService.getLeaderboard()
      .then(({ data }) => setProjects(data.projects || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadLeaderboard]);

  if (projects === null) return <LeaderboardSkeleton />;

  if (projects.length === 0) {
    return (
      <div className="cl-card">
        <div className="cl-empty">
          <FiTrendingUp size={28} style={{ opacity: 0.3 }} />
          <p>{t("ceremony.leaderboardEmpty")}</p>
        </div>
      </div>
    );
  }

  const podium = projects.slice(0, 3);
  // Aperçu "Top projets" : les 3 suivantes (rang 4 à 6) — le classement
  // complet reste consultable dans la grille "Tous les projets" plus bas
  // sur la même page (lien "Voir tous les projets").
  const topList = projects.slice(3, 6);
  // Ordre visuel du podium : 2e à gauche, 1er au centre, 3e à droite.
  const podiumSlots = [
    { project: podium[1], rank: 2 },
    { project: podium[0], rank: 1 },
    { project: podium[2], rank: 3 },
  ].filter((slot) => slot.project);

  return (
    <>
      <div className="cl-card">
        <div className="cl-card__header">
          <h3 className="cl-card__title"><FiAward size={18} /> {t("ceremony.leaderboardTitle")}</h3>
          <span className="cl-live-badge"><span className="cl-live-dot" /> {t("ceremony.liveVotes")}</span>
        </div>
        <div className="cl-podium">
          <AnimatePresence>
            {podiumSlots.map(({ project, rank }) => (
              <PodiumCard key={project._id} project={project} rank={rank} t={t} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {topList.length > 0 && (
        <div className="cl-card">
          <div className="cl-card__header">
            <h3 className="cl-card__title"><FiList size={18} /> {t("ceremony.topProjectsTitle")}</h3>
            <button type="button" className="cl-view-all" onClick={() => scrollToSection("ceremonie-grille")}>
              {t("ceremony.viewAllProjects")} <FiArrowRight size={14} />
            </button>
          </div>
          <div className="cl-toplist">
            <AnimatePresence>
              {topList.map((project, i) => (
                <TopProjectRow key={project._id} project={project} rank={i + 4} t={t} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </>
  );
}
