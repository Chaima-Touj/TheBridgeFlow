import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FiUser, FiTrendingUp, FiAward } from "react-icons/fi";
import { ceremonyService } from "../../services/ceremony.service.js";
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
   layoutId (partagé avec ListRow) : permet à Framer Motion d'animer en
   douceur le passage d'un projet entre le podium et la liste classique
   (deux arbres JSX différents), pas seulement le réordonnancement DANS
   le podium (couvert par `layout`). L'avatar de l'auteur (photo ou
   initiale) est le visuel principal de chaque colonne — pas la couverture
   du projet. Pas d'apparence "carte" (bordure/ombre/padding uniforme) :
   la hiérarchie visuelle vient uniquement de la barre colorée en bas de
   colonne, dont la hauteur varie par rang (voir .cl-podium-bar--rank{n}),
   les 3 colonnes restant alignées sur une base commune. */
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
        <FiAward size={rank === 1 ? 26 : 20} />
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

/* ─── Ligne de classement (4e place et plus) — pattern .news-card repris
   pour la cohérence visuelle (photo/titre/auteur), adapté en ligne
   horizontale : rang (+ couronne si jamais rank <= 3) à gauche, votes
   alignés à droite. ──────────────────────────────────────────────────── */
function ListRow({ project, rank, t }) {
  return (
    <motion.div
      layoutId={`ceremony-project-${project._id}`}
      layout
      transition={CARD_TRANSITION}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="cl-row news-card"
    >
      <div className="cl-row-rank">
        {rank <= 3 && (
          <span className={`cl-row-rank__crown cl-row-rank__crown--rank${rank}`} aria-hidden="true">
            <FiAward size={13} />
          </span>
        )}
        <span className="cl-row-rank__number">#{rank}</span>
      </div>
      <div className="news-card__img-wrap cl-row-img-wrap">
        {project.coverImage
          ? <img src={project.coverImage} alt="" className="news-card__img" loading="lazy" />
          : <div className="cl-row-img-wrap__placeholder" />}
      </div>
      <div className="news-card__body cl-row-body">
        <Link to={`/ceremonie/${project._id}`} className="cl-row-title">{project.title}</Link>
        <div className="cl-row-author">
          <AuthorAvatar author={project.studentId} size={20} />
          <span>{project.studentId?.name || t("ceremony.unknownAuthor")}</span>
        </div>
      </div>
      <div className="cl-row-votes">{formatVoteLabel(project.voteCount, t)}</div>
    </motion.div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="cl-root" aria-hidden="true">
      <div className="cl-podium">
        {[2, 1, 3].map((rank) => (
          <div key={rank} className={`cl-podium-col cl-podium-col--rank${rank} cl-podium-col--skeleton`} />
        ))}
      </div>
      <div className="cl-list">
        {[4, 5, 6].map((i) => <div key={i} className="cl-row cl-row--skeleton" />)}
      </div>
    </div>
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
      <div className="cl-empty">
        <FiTrendingUp size={28} style={{ opacity: 0.3 }} />
        <p>{t("ceremony.leaderboardEmpty")}</p>
      </div>
    );
  }

  const podium = projects.slice(0, 3);
  const rest = projects.slice(3);
  // Ordre visuel du podium : 2e à gauche, 1er au centre, 3e à droite.
  const podiumSlots = [
    { project: podium[1], rank: 2 },
    { project: podium[0], rank: 1 },
    { project: podium[2], rank: 3 },
  ].filter((slot) => slot.project);

  return (
    <div className="cl-root">
      <div className="cl-podium">
        <AnimatePresence>
          {podiumSlots.map(({ project, rank }) => (
            <PodiumCard key={project._id} project={project} rank={rank} t={t} />
          ))}
        </AnimatePresence>
      </div>

      {rest.length > 0 && (
        <div className="cl-list">
          <AnimatePresence>
            {rest.map((project, i) => (
              <ListRow key={project._id} project={project} rank={i + 4} t={t} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
