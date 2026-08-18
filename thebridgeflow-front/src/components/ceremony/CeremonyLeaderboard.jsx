import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FiUser, FiTrendingUp } from "react-icons/fi";
import { ceremonyService } from "../../services/ceremony.service.js";
import "./CeremonyLeaderboard.css";

// Même cadence que le polling déjà établi dans l'app (notifications,
// DashboardLayout.jsx L31) — pas de WebSocket, cohérent avec l'architecture
// existante.
const REFRESH_INTERVAL_MS = 30000;

const RANK_BADGE = { 1: "🥇", 2: "🥈", 3: "🥉" };

// Transition "premium" — ni trop raide (sec, mécanique) ni trop molle (lent,
// gluant) : valeurs modérées pour un effet FLIP fluide sur le réordonnancement.
const CARD_TRANSITION = { type: "spring", stiffness: 300, damping: 30 };

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
    <span className="cl-avatar cl-avatar--initial" style={{ width: size, height: size, background: avatarColor(name) }}>
      {name[0]?.toUpperCase() || <FiUser size={size * 0.5} />}
    </span>
  );
}

/* ─── Carte podium (top 3) ────────────────────────────────────────────────
   layoutId (partagé avec ListRow) : permet à Framer Motion d'animer en
   douceur le passage d'un projet entre le podium et la liste classique
   (deux arbres JSX différents), pas seulement le réordonnancement DANS
   le podium (couvert par `layout`). */
function PodiumCard({ project, rank, t }) {
  return (
    <motion.div
      layoutId={`ceremony-project-${project._id}`}
      layout
      transition={CARD_TRANSITION}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      className={`cl-podium-card cl-podium-card--rank${rank}`}
    >
      <span className={`cl-podium-badge cl-podium-badge--rank${rank}`}>{RANK_BADGE[rank]}</span>
      <div className="cl-podium-cover">
        {project.coverImage
          ? <img src={project.coverImage} alt="" className="cl-podium-cover__img" />
          : <div className="cl-podium-cover__placeholder" />}
      </div>
      <Link to={`/ceremonie/${project._id}`} className="cl-podium-title">{project.title}</Link>
      <div className="cl-podium-author">
        <AuthorAvatar author={project.studentId} size={22} />
        <span>{project.studentId?.name || t("ceremony.unknownAuthor")}</span>
      </div>
      <div className="cl-podium-votes">
        <FiTrendingUp size={13} />
        {t("ceremony.voteCount", { count: project.voteCount })}
      </div>
    </motion.div>
  );
}

/* ─── Ligne de classement (4e place et plus) — pattern .news-card repris
   pour la cohérence visuelle (photo/titre/auteur), adapté en ligne
   horizontale avec rang + votes bien visibles à gauche. ────────────────── */
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
        <span className="cl-row-rank__number">#{rank}</span>
        <span className="cl-row-rank__votes">{t("ceremony.voteCount", { count: project.voteCount })}</span>
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
    </motion.div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="cl-root" aria-hidden="true">
      <div className="cl-podium">
        {[2, 1, 3].map((rank) => (
          <div key={rank} className={`cl-podium-card cl-podium-card--rank${rank} cl-podium-card--skeleton`} />
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
