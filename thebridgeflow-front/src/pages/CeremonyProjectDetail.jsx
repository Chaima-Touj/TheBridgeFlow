import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import {
  FiArrowLeft, FiExternalLink, FiGithub, FiPlay, FiUsers, FiTrendingUp, FiUser,
  FiCheckCircle, FiPlusCircle, FiShare2, FiCheck,
} from "react-icons/fi";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import { useDocumentMeta, truncateForSEO } from "../hooks/useDocumentMeta.js";
import { useCeremonySelection, MAX_SELECTION } from "../hooks/useCeremonySelection.js";
import { useCeremonyVoteGate } from "../hooks/useCeremonyVoteGate.js";
import { useCeremonyVoteSubmit } from "../hooks/useCeremonyVoteSubmit.js";
import { ceremonyService } from "../services/ceremony.service.js";
import "./FormationsPage.css";
import "./CeremonyPage.css";
import "./CeremonyProjectDetail.css";

const VOTE_GATE_MESSAGE_KEY = {
  closed:     "ceremony.voteClosed",
  notStarted: "ceremony.voteNotStarted",
  ended:      "ceremony.voteEnded",
};

export default function CeremonyProjectDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { selected, toggleSelect, clearSelection } = useCeremonySelection();
  const voteGateReason = useCeremonyVoteGate();
  const voteDisabled = voteGateReason !== null;
  const { submitting, error: voteError, success, confirmVote } = useCeremonyVoteSubmit(clearSelection);

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [qrDownloaded, setQrDownloaded] = useState(false);
  const [sharingQr, setSharingQr] = useState(false);
  const qrWrapRef = useRef(null);

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

  // Convertit le <svg> du QR (rendu par QRCodeSVG) en PNG — le SVG étant
  // vectoriel, on peut le redessiner à une résolution bien plus grande
  // (QR_EXPORT_SIZE) que sa taille d'affichage (104px) sans perte de netteté,
  // pour un fichier partageable/imprimable de meilleure qualité.
  const QR_EXPORT_SIZE = 512;
  async function renderQrToPngBlob() {
    const svgEl = qrWrapRef.current?.querySelector("svg");
    if (!svgEl) return null;

    const svgString = new XMLSerializer().serializeToString(svgEl);
    const svgUrl = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = svgUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = QR_EXPORT_SIZE;
      canvas.height = QR_EXPORT_SIZE;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, QR_EXPORT_SIZE, QR_EXPORT_SIZE);
      ctx.drawImage(img, 0, 0, QR_EXPORT_SIZE, QR_EXPORT_SIZE);
      return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  // Partage l'IMAGE du QR (pas un lien texte) : Web Share API avec fichier si
  // le navigateur le supporte (navigator.canShare({ files })), sinon repli
  // téléchargement du PNG — même mécanisme que downloadCSV (utils/exportTable.js) :
  // Blob -> URL.createObjectURL -> <a download> -> click.
  const handleShareQr = async () => {
    setSharingQr(true);
    try {
      const blob = await renderQrToPngBlob();
      if (!blob) return;
      const filename = `qr-ceremonie-${project._id}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: project.title });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setQrDownloaded(true);
        setTimeout(() => setQrDownloaded(false), 2500);
      }
    } catch (err) {
      // AbortError = l'utilisateur a fermé la feuille de partage native, pas
      // une erreur à signaler. Le reste échoue silencieusement (même niveau
      // de gestion d'erreur que l'ancien repli presse-papiers).
      if (err?.name !== "AbortError") { /* ignoré */ }
    } finally {
      setSharingQr(false);
    }
  };

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
                  disabled={success || atMax || voteDisabled}
                  onClick={() => toggleSelect(project._id)}
                >
                  {isSelected ? <FiCheckCircle size={18} /> : <FiPlusCircle size={18} />}
                  {isSelected ? t("ceremony.voteRemove") : t("ceremony.voteAdd")}
                </button>

                {success ? (
                  <div className="cp-success">{t("ceremony.voteSuccess")}</div>
                ) : (
                  <>
                    <p className="cpd-vote-status">
                      {voteDisabled
                        ? t(VOTE_GATE_MESSAGE_KEY[voteGateReason])
                        : atMax ? t("ceremony.voteMaxReached") : t("ceremony.voteProgress", { count: selected.length, max: MAX_SELECTION })}
                      {" "}
                      <Link to="/ceremonie" className="cpd-vote-status__link">{t("ceremony.finishVote")}</Link>
                    </p>
                    {/* Confirmation réelle du vote — même logique d'appel que
                        .cp-vote-bar sur CeremonyPage.jsx (useCeremonyVoteSubmit,
                        partagé, pas réimplémenté). */}
                    <button
                      type="button"
                      className="cpd-confirm-btn btn btn-primary"
                      disabled={selected.length < 1 || submitting || voteDisabled}
                      onClick={() => confirmVote(selected)}
                    >
                      {submitting ? t("ceremony.submitting") : t("ceremony.confirmVote", { count: selected.length })}
                    </button>
                    {voteError && <div className="cp-error">{voteError}</div>}
                  </>
                )}
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

              <div className="cpd-qr-row">
                <div className="cpd-qr" ref={qrWrapRef}>
                  <QRCodeSVG
                    value={`${window.location.origin}/ceremonie/${project._id}`}
                    size={104}
                    level="M"
                    marginSize={2}
                    fgColor="#000000"
                    bgColor="#FFFFFF"
                    title={t("ceremony.qrCaption")}
                  />
                  <span className="cpd-qr__caption">{t("ceremony.qrCaption")}</span>
                </div>

                <button type="button" className="btn btn-outline" disabled={sharingQr} onClick={handleShareQr}>
                  {qrDownloaded ? <FiCheck size={15} /> : <FiShare2 size={15} />}
                  {qrDownloaded ? t("ceremony.qrDownloaded") : t("ceremony.share")}
                </button>
              </div>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
