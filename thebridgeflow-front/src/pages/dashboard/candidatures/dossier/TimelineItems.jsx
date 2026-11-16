import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  CalendarClock, BriefcaseBusiness, Pencil, Trash2, ChevronDown, ChevronUp, FileText, CalendarPlus,
  CalendarCheck, UserCheck, UserX, CircleAlert, UserRound, MapPin, Video,
} from "lucide-react";
import { ICON_STROKE, toneClass } from "../candidatesConfig.js";
import { formatDateTime, formatTime, isTaskOverdue } from "../candidatesUtils.js";
import { TaskTypeIcon, InterviewStatusBadge, ApplicationStatusBadge } from "../shared/StatusBadges.jsx";
import TaskStatusMenu from "./TaskStatusMenu.jsx";
import { isDueSoon } from "./dossierUtils.js";

const itemMotion = {
  layout: true,
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.16 } },
  transition: { duration: 0.24, ease: [0.22, 0.8, 0.24, 1] },
};

export function TaskItem({ task, now, locale, highlighted, busy, canDelete, onStatusChange, onEdit, onDelete, onFilterOffer }) {
  const { t } = useTranslation();
  const tt = (key, options) => t(`adminCandidates.dossier.timeline.${key}`, options);
  const [expanded, setExpanded] = useState(false);
  const overdue = isTaskOverdue(task, now);
  const soon = !overdue && isDueSoon(task, now);
  const unknown = t("adminCandidates.common.unknownAdmin");
  const offer = task.application?.offer;
  const longDescription = (task.description || "").length > 220 || (task.description || "").split("\n").length > 3;

  const stateClass = overdue
    ? "cnd-dos-tl-item--overdue"
    : `cnd-dos-tl-item--${task.status}`;

  return (
    <motion.li
      {...itemMotion}
      id={`cnd-task-${task._id}`}
      className={`cnd-dos-tl-item ${stateClass} ${highlighted ? "cnd-dos-tl-item--highlight" : ""}`}
    >
      <span className="cnd-dos-tl-node" aria-hidden="true">
        <TaskTypeIcon type={task.type} size="sm" />
      </span>
      <article className="cnd-dos-tl-card" aria-label={task.title}>
        <header className="cnd-dos-tl-card__head">
          <div className="cnd-dos-tl-card__heading">
            <span className="cnd-dos-tl-card__type">
              {t(`adminCandidates.common.taskType.${task.type}`)}
              <span aria-hidden="true">·</span>
              <time dateTime={task.activityDate} title={formatDateTime(task.activityDate, locale)}>{formatTime(task.activityDate, locale)}</time>
            </span>
            <h3 className="cnd-dos-tl-card__title">{task.title}</h3>
          </div>
          <div className="cnd-dos-tl-card__side">
            <TaskStatusMenu task={task} busy={busy} onSelect={(status) => onStatusChange(task, status)} />
            <button type="button" className="cnd-btn cnd-btn--ghost cnd-btn--sm cnd-btn--icon" onClick={() => onEdit(task)} aria-label={tt("edit")} title={tt("edit")} disabled={busy}>
              <Pencil size={15} strokeWidth={ICON_STROKE} aria-hidden="true" />
            </button>
            {canDelete && (
              <button type="button" className="cnd-btn cnd-btn--ghost cnd-btn--sm cnd-btn--icon cnd-dos-danger-icon" onClick={() => onDelete(task)} aria-label={tt("delete")} title={tt("delete")} disabled={busy}>
                <Trash2 size={15} strokeWidth={ICON_STROKE} aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        {(task.dueDate || task.application) && (
          <div className="cnd-dos-tl-card__chips">
            {task.dueDate && (
              <span className={`cnd-dos-due ${overdue ? "cnd-dos-due--overdue" : soon ? "cnd-dos-due--soon" : ""} ${task.status === "completed" ? "cnd-dos-due--done" : ""}`}>
                {overdue
                  ? <CircleAlert size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  : <CalendarClock size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />}
                {overdue ? tt("overdueSince", { date: formatDateTime(task.dueDate, locale) }) : tt("dueOn", { date: formatDateTime(task.dueDate, locale) })}
              </span>
            )}
            {task.application && (
              <button
                type="button"
                className="cnd-dos-offer-chip"
                onClick={() => onFilterOffer(String(task.applicationId))}
                title={tt("filterByOffer")}
              >
                <BriefcaseBusiness size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />
                <span>{offer?.title || t("adminCandidates.common.deletedOffer")}</span>
              </button>
            )}
          </div>
        )}

        {task.description && (
          <p className={`cnd-dos-tl-card__desc ${expanded || !longDescription ? "" : "cnd-dos-tl-card__desc--clamp"}`}>{task.description}</p>
        )}

        <footer className="cnd-dos-tl-card__foot">
          <span className="cnd-dos-tl-card__author">
            <UserRound size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />
            {tt("createdBy", { name: task.createdBy?.name || unknown, date: formatDateTime(task.createdAt, locale) })}
          </span>
          <button type="button" className="cnd-dos-link-btn" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
            {expanded ? tt("hideDetails") : tt("showDetails")}
            {expanded ? <ChevronUp size={14} strokeWidth={ICON_STROKE} aria-hidden="true" /> : <ChevronDown size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />}
          </button>
        </footer>

        {expanded && (
          <motion.dl
            className="cnd-dos-tl-details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.2 }}
          >
            <div><dt>{tt("detailActivity")}</dt><dd>{formatDateTime(task.activityDate, locale)}</dd></div>
            <div><dt>{tt("detailCreated")}</dt><dd>{tt("byOn", { name: task.createdBy?.name || unknown, date: formatDateTime(task.createdAt, locale) })}</dd></div>
            {task.updatedBy && (
              <div><dt>{tt("detailUpdated")}</dt><dd>{tt("byOn", { name: task.updatedBy.name || unknown, date: formatDateTime(task.updatedAt, locale) })}</dd></div>
            )}
            {task.status === "completed" && task.completedAt && (
              <div><dt>{tt("detailCompleted")}</dt><dd>{tt("byOn", { name: task.completedBy?.name || unknown, date: formatDateTime(task.completedAt, locale) })}</dd></div>
            )}
            {task.application && (
              <div>
                <dt>{tt("detailApplication")}</dt>
                <dd className="cnd-dos-tl-details__app">
                  <span>{[offer?.title || t("adminCandidates.common.deletedOffer"), offer?.companyName].filter(Boolean).join(" — ")}</span>
                  {task.application.status && <ApplicationStatusBadge status={task.application.status} size="sm" />}
                </dd>
              </div>
            )}
          </motion.dl>
        )}
      </article>
    </motion.li>
  );
}

const SYSTEM_META = {
  application_received: { Icon: FileText, tone: "blue" },
  interview_proposed:   { Icon: CalendarPlus, tone: "violet" },
  interview_scheduled:  { Icon: CalendarCheck, tone: "violet" },
};

export function SystemItem({ event, locale }) {
  const { t } = useTranslation();
  const tt = (key, options) => t(`adminCandidates.dossier.timeline.${key}`, options);
  const decision = event.kind === "application_decision";
  const accepted = decision && event.meta?.status === "acceptée";
  const meta = decision ? { Icon: accepted ? UserCheck : UserX, tone: accepted ? "emerald" : "rose" } : SYSTEM_META[event.kind] || SYSTEM_META.application_received;
  const Icon = meta.Icon;
  const offer = event.offerTitle || t("adminCandidates.common.deletedOffer");
  const isInterview = event.kind === "interview_proposed" || event.kind === "interview_scheduled";

  return (
    <motion.li {...itemMotion} className="cnd-dos-tl-item cnd-dos-tl-item--system">
      <span className="cnd-dos-tl-node" aria-hidden="true">
        <span className={`cnd-icon-tile cnd-icon-tile--sm ${toneClass(meta.tone)}`}><Icon size={15} strokeWidth={ICON_STROKE} /></span>
      </span>
      <div className="cnd-dos-tl-system">
        <div className="cnd-dos-tl-system__head">
          <span className="cnd-dos-tl-system__label">{t("adminCandidates.common.system")}</span>
          <time dateTime={event.date} title={formatDateTime(event.date, locale)}>{formatTime(event.date, locale)}</time>
        </div>
        <p className="cnd-dos-tl-system__text">
          {decision
            ? tt(accepted ? "system.application_accepted" : "system.application_rejected", { offer })
            : tt(`system.${event.kind}`, { offer })}
        </p>
        {isInterview && (
          <div className="cnd-dos-tl-system__meta">
            {event.kind === "interview_proposed" && event.meta?.scheduledAt && (
              <span><CalendarClock size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />{formatDateTime(event.meta.scheduledAt, locale)}</span>
            )}
            {event.meta?.mode && (
              <span>
                {event.meta.mode === "présentiel" ? <MapPin size={13} strokeWidth={ICON_STROKE} aria-hidden="true" /> : <Video size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />}
                {event.meta.mode === "présentiel" ? t("adminCandidatures.interviewModeOnsite") : t("adminCandidatures.interviewModeOnline")}
              </span>
            )}
            {event.meta?.interviewStatus && <InterviewStatusBadge status={event.meta.interviewStatus} size="sm" />}
            {event.kind === "interview_proposed" && event.meta?.proposedBy && (
              <span><UserRound size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />{tt("proposedBy", { name: event.meta.proposedBy })}</span>
            )}
          </div>
        )}
      </div>
    </motion.li>
  );
}
