import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiArrowLeft, FiExternalLink, FiGithub, FiPlay, FiUsers, FiTrendingUp, FiUser, FiCheckCircle, FiPlusCircle } from "react-icons/fi";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import { useDocumentMeta, truncateForSEO } from "../hooks/useDocumentMeta.js";
import { useCeremonySelection, MAX_SELECTION } from "../hooks/useCeremonySelection.js";
import { useCeremonyVoteGate } from "../hooks/useCeremonyVoteGate.js";
import { ceremonyService } from "../services/ceremony.service.js";
import "./FormationsPage.css";
import "./CeremonyProjectDetail.css";

const VOTE_GATE_MESSAGE_KEY = {
  closed:     "ceremony.voteClosed",
  notStarted: "ceremony.voteNotStarted",
  ended:      "ceremony.voteEnded",
};

export default function CeremonyProjectDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { selected, toggleSelect } = useCeremonySelection();
  const voteGateReason = useCeremonyVoteGate();
  const voteDisabled = voteGateReason !== null;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    ceremonyService.getProject(id)
      .then(({ data }) => { if (active) setProject(data); })
      .catch((err) => { if (active) setError(err?.response?.data?.message || t("ceremony.projectNotFound")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, t]);

  useDocumentMeta({
    title:       project ? `${project.title} — Cérémonie | TheBridgeFlow` : undefined,
    description: project?.description ? truncateForSEO(project.description) : undefined,
  });

  const isSelected = project ? selected.includes(project._id) : false;
  const atMax = !isSelected && selected.length >= MAX_SELECTION;

  return (
    <div className="fp-page">
      <SiteNavbar />

      <main className="cpd-main">
        <Link to="/ceremonie" className="cpd-back">
          <FiArrowLeft size={16} /> {t("ceremony.backToList")}
        </Link>

        {loading ? (
          <div className="cpd-skeleton" aria-hidden="true" />
        ) : error ? (
          <p className="cp-empty">{error}</p>
        ) : project && (
          <article className="cpd-card">
            <div className="cpd-cover">
              {project.coverImage
                ? <img src={project.coverImage} alt="" className="cpd-cover__img" />
                : <div className="cpd-cover__placeholder" />}
              <span className="cpd-votes">
                <FiTrendingUp size={14} /> {t("ceremony.voteCount", { count: project.voteCount })}
              </span>
            </div>

            <div className="cpd-body">
              <h1 className="cpd-title">{project.title}</h1>

              <div className="cpd-author">
                {project.studentId?.avatarUrl
                  ? <img src={project.studentId.avatarUrl} alt="" className="cpd-author__avatar" />
                  : <span className="cpd-author__avatar cpd-author__avatar--initial"><FiUser size={14} /></span>}
                <span>{project.studentId?.name || t("ceremony.unknownAuthor")}</span>
              </div>

              <div className="cpd-vote-block">
                <button
                  type="button"
                  className={`cpd-vote-btn${isSelected ? " cpd-vote-btn--active" : ""}`}
                  disabled={atMax || voteDisabled}
                  onClick={() => toggleSelect(project._id)}
                >
                  {isSelected ? <FiCheckCircle size={18} /> : <FiPlusCircle size={18} />}
                  {isSelected ? t("ceremony.voteRemove") : t("ceremony.voteAdd")}
                </button>
                <p className="cpd-vote-status">
                  {voteDisabled
                    ? t(VOTE_GATE_MESSAGE_KEY[voteGateReason])
                    : atMax ? t("ceremony.voteMaxReached") : t("ceremony.voteProgress", { count: selected.length, max: MAX_SELECTION })}
                  {" "}
                  <Link to="/ceremonie" className="cpd-vote-status__link">{t("ceremony.finishVote")}</Link>
                </p>
              </div>

              {project.description && <p className="cpd-desc">{project.description}</p>}

              {project.technologies?.length > 0 && (
                <div className="cpd-techs">
                  {project.technologies.map((tech) => (
                    <span key={tech} className="cpd-tech-chip">{tech}</span>
                  ))}
                </div>
              )}

              {project.teamMembers?.length > 0 && (
                <div className="cpd-team">
                  <FiUsers size={15} />
                  <span>{project.teamMembers.join(", ")}</span>
                </div>
              )}

              <div className="cpd-links">
                {project.driveAppUrl && (
                  <a href={project.driveAppUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    <FiExternalLink size={15} /> {t("ceremony.openApp")}
                  </a>
                )}
                {project.driveVideoUrl && (
                  <a href={project.driveVideoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                    <FiPlay size={15} /> {t("ceremony.watchDemo")}
                  </a>
                )}
                {project.githubUrl && (
                  <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                    <FiGithub size={15} /> GitHub
                  </a>
                )}
              </div>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
