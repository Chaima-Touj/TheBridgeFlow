import { useTranslation } from "react-i18next";
import {
  GLOBAL_STATUS_MAP, TASK_STATUS_MAP, OVERDUE_META, APPLICATION_STATUS_TONE,
  INTERVIEW_STATUS_TONE, ICON_SIZE, ICON_STROKE, getTaskType, toneClass,
} from "../candidatesConfig.js";
import { taskDisplayStatus } from "../candidatesUtils.js";
import "./candidatesShared.css";

const BADGE_ICON = 13;

// Statut global de suivi d'un étudiant (new / in_progress / interview / accepted / rejected).
export function GlobalStatusBadge({ status, size, className = "" }) {
  const { t } = useTranslation();
  const meta = GLOBAL_STATUS_MAP[status] || GLOBAL_STATUS_MAP.new;
  const Icon = meta.Icon;
  return (
    <span className={`cnd-badge ${size === "sm" ? "cnd-badge--sm" : ""} ${toneClass(meta.tone)} ${className}`}>
      <Icon size={BADGE_ICON} strokeWidth={2} aria-hidden="true" />
      {t(`adminCandidates.common.globalStatus.${meta.key}`)}
    </span>
  );
}

// Statut d'une tâche — « En retard » prime si l'échéance est dépassée.
export function TaskStatusBadge({ task, status, size, className = "" }) {
  const { t } = useTranslation();
  const key = task ? taskDisplayStatus(task) : status || "pending";
  const meta = key === "overdue" ? OVERDUE_META : TASK_STATUS_MAP[key] || TASK_STATUS_MAP.pending;
  const Icon = meta.Icon;
  return (
    <span
      className={`cnd-badge ${size === "sm" ? "cnd-badge--sm" : ""} ${toneClass(meta.tone)} ${key === "overdue" ? "cnd-badge--overdue" : ""} ${className}`}
    >
      <Icon size={BADGE_ICON} strokeWidth={2} aria-hidden="true" />
      {t(`adminCandidates.common.taskStatus.${meta.key}`)}
    </span>
  );
}

// Statut existant d'une candidature (Application.status) — libellés `status.*` existants.
export function ApplicationStatusBadge({ status, size, className = "" }) {
  const { t } = useTranslation();
  const tone = APPLICATION_STATUS_TONE[status] || "slate";
  return (
    <span className={`cnd-badge cnd-badge--dot ${size === "sm" ? "cnd-badge--sm" : ""} ${toneClass(tone)} ${className}`}>
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}

// Statut existant d'un entretien (Interview.status).
export function InterviewStatusBadge({ status, size, className = "" }) {
  const { t } = useTranslation();
  const tone = INTERVIEW_STATUS_TONE[status] || "slate";
  return (
    <span className={`cnd-badge cnd-badge--dot ${size === "sm" ? "cnd-badge--sm" : ""} ${toneClass(tone)} ${className}`}>
      {t(`adminCandidates.common.interviewStatus.${status}`, { defaultValue: status })}
    </span>
  );
}

// Tuile d'icône colorée d'un type de tâche.
export function TaskTypeIcon({ type, size = "md", className = "" }) {
  const meta = getTaskType(type);
  const Icon = meta.Icon;
  return (
    <span className={`cnd-icon-tile ${size === "sm" ? "cnd-icon-tile--sm" : size === "lg" ? "cnd-icon-tile--lg" : ""} ${toneClass(meta.tone)} ${className}`} aria-hidden="true">
      <Icon size={size === "lg" ? 20 : ICON_SIZE} strokeWidth={ICON_STROKE} />
    </span>
  );
}
