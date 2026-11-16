import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Building2, MapPin, Clock3, BriefcaseBusiness, CalendarDays, Activity, CalendarClock, Video, UserRound,
  Send, UserCheck, UserX, Plus, History, FileText, ChevronDown, ChevronUp, Quote, ClipboardList, Eye,
} from "lucide-react";
import { ICON_STROKE } from "../candidatesConfig.js";
import { formatDate, formatDateTime, formatRelative } from "../candidatesUtils.js";
import { ApplicationStatusBadge, InterviewStatusBadge } from "../shared/StatusBadges.jsx";
import EmptyState from "../shared/EmptyState.jsx";

const listVariants = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.22, 0.8, 0.24, 1] } },
};

function ApplicationCard({ application, documents, locale, busyDocument, onProposeInterview, onDecision, onAddLinkedTask, onShowHistory, onPreviewDocument }) {
  const { t } = useTranslation();
  const ta = (key, options) => t(`adminCandidates.dossier.applications.${key}`, options);
  const [expanded, setExpanded] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const offer = application.offer;
  const chips = [
    offer?.location && { Icon: MapPin, text: offer.location },
    offer?.type && { Icon: BriefcaseBusiness, text: offer.type },
    offer?.duration && { Icon: Clock3, text: offer.duration },
  ].filter(Boolean);
  const appDocuments = documents.filter((doc) => String(doc.applicationId) === String(application._id));

  return (
    <motion.article variants={cardVariants} className={`cnd-card cnd-dos-app cnd-dos-app--${application.status === "acceptée" ? "accepted" : application.status === "refusée" ? "rejected" : application.status === "en cours" ? "review" : "pending"}`}>
      <header className="cnd-dos-app__head">
        <span className="cnd-icon-tile cnd-tone--indigo" aria-hidden="true"><BriefcaseBusiness size={18} strokeWidth={ICON_STROKE} /></span>
        <div className="cnd-dos-app__heading">
          <h3>{offer?.title || t("adminCandidates.common.deletedOffer")}</h3>
          {offer?.companyName && <p><Building2 size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />{offer.companyName}</p>}
        </div>
        <ApplicationStatusBadge status={application.status} />
      </header>

      {chips.length > 0 && (
        <div className="cnd-dos-app__chips">
          {chips.map(({ Icon, text }) => (
            <span key={text} className="cnd-dos-chip"><Icon size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />{text}</span>
          ))}
          {offer && !offer.isActive && <span className="cnd-dos-chip cnd-dos-chip--muted">{ta("offerClosed")}</span>}
        </div>
      )}

      {offer?.description && (
        <div className="cnd-dos-app__desc">
          <p className={expanded ? "" : "cnd-dos-clamp-2"}>{offer.description}</p>
          {offer.description.length > 160 && (
            <button type="button" className="cnd-dos-link-btn" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
              {expanded ? ta("showLess") : ta("showMore")}
              {expanded ? <ChevronUp size={14} strokeWidth={ICON_STROKE} aria-hidden="true" /> : <ChevronDown size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />}
            </button>
          )}
        </div>
      )}

      <dl className="cnd-dos-app__facts">
        <div><dt><CalendarDays size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />{ta("appliedOn")}</dt><dd>{formatDate(application.createdAt, locale)}</dd></div>
        <div><dt><Activity size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />{ta("lastActivity")}</dt><dd title={formatDateTime(application.lastActivityAt, locale)}>{formatRelative(application.lastActivityAt, locale)}</dd></div>
        <div><dt><ClipboardList size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />{ta("linkedTasks")}</dt><dd className="cnd-num">{application.taskCount}</dd></div>
      </dl>

      {application.interviews.length > 0 && (
        <div className="cnd-dos-app__interviews">
          <h4>{ta("interviews")}</h4>
          <ul>
            {application.interviews.map((interview) => (
              <li key={interview._id}>
                <span className="cnd-dos-app__interview-date"><CalendarClock size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />{formatDateTime(interview.scheduledAt, locale)}</span>
                <span>
                  {interview.mode === "présentiel" ? <MapPin size={13} strokeWidth={ICON_STROKE} aria-hidden="true" /> : <Video size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />}
                  {interview.mode === "présentiel" ? t("adminCandidatures.interviewModeOnsite") : t("adminCandidatures.interviewModeOnline")}
                  {interview.location && <span className="cnd-dos-app__interview-loc"> · {interview.location}</span>}
                </span>
                <InterviewStatusBadge status={interview.status} size="sm" />
                {interview.proposedBy?.name && <span className="cnd-muted"><UserRound size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />{interview.proposedBy.name}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(application.coverLetter || appDocuments.length > 0 || application.cvSource === "profile") && (
        <div className="cnd-dos-app__docs">
          {application.coverLetter && (
            <div className="cnd-dos-app__letter">
              <button type="button" className="cnd-dos-link-btn" onClick={() => setLetterOpen((value) => !value)} aria-expanded={letterOpen}>
                <Quote size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
                {letterOpen ? ta("hideCoverLetter") : ta("showCoverLetter")}
              </button>
              {letterOpen && <p className="cnd-dos-app__letter-text">{application.coverLetter}</p>}
            </div>
          )}
          {application.cvSource === "profile" && <span className="cnd-dos-chip"><FileText size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />{ta("profileCvUsed")}</span>}
          {appDocuments.map((doc) => (
            <button
              key={doc.key}
              type="button"
              className="cnd-dos-chip cnd-dos-chip--action"
              onClick={() => onPreviewDocument(doc)}
              disabled={(!doc.available && !doc.externalUrl) || Boolean(busyDocument)}
            >
              {doc.available ? <Eye size={13} strokeWidth={ICON_STROKE} aria-hidden="true" /> : <FileText size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />}
              {doc.kind === "coverLetter" ? ta("coverLetterFile") : ta("applicationCv")}
            </button>
          ))}
        </div>
      )}

      <footer className="cnd-dos-app__actions">
        {application.status === "en attente" && (
          <button type="button" className="cnd-btn cnd-btn--primary cnd-btn--sm" onClick={() => onProposeInterview(application)}>
            <Send size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
            {t("adminCandidatures.proposeInterviewAction")}
          </button>
        )}
        {application.status === "en cours" && (
          <>
            <button type="button" className="cnd-btn cnd-btn--soft cnd-btn--sm cnd-tone--emerald" onClick={() => onDecision(application, "accept")}>
              <UserCheck size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
              {t("adminCandidatures.acceptAction")}
            </button>
            <button type="button" className="cnd-btn cnd-btn--soft cnd-btn--sm cnd-tone--rose" onClick={() => onDecision(application, "reject")}>
              <UserX size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
              {t("adminCandidatures.rejectAction")}
            </button>
          </>
        )}
        <span className="cnd-dos-app__actions-spacer" />
        <button type="button" className="cnd-btn cnd-btn--ghost cnd-btn--sm" onClick={() => onShowHistory(application)}>
          <History size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
          {ta("showHistory")}
        </button>
        <button type="button" className="cnd-btn cnd-btn--secondary cnd-btn--sm" onClick={() => onAddLinkedTask(application)}>
          <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
          {ta("addLinkedTask")}
        </button>
      </footer>
    </motion.article>
  );
}

export default function ApplicationsPanel({ applications, documents, ...handlers }) {
  const { t } = useTranslation();
  if (!applications.length) {
    return <EmptyState icon={BriefcaseBusiness} title={t("adminCandidates.dossier.applications.emptyTitle")} />;
  }
  return (
    <motion.div className="cnd-dos-apps" variants={listVariants} initial="hidden" animate="show">
      {applications.map((application) => (
        <ApplicationCard key={application._id} application={application} documents={documents} {...handlers} />
      ))}
    </motion.div>
  );
}
