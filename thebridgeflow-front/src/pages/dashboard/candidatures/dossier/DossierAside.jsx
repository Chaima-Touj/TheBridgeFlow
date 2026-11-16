import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { CalendarClock, CircleAlert, CircleCheck, FileText } from "lucide-react";
import { ICON_STROKE } from "../candidatesConfig.js";
import { formatDateTime, formatRelative, isTaskOverdue } from "../candidatesUtils.js";
import { TaskTypeIcon } from "../shared/StatusBadges.jsx";
import { DocumentRow } from "./DocumentsPanel.jsx";
import { upcomingTasks } from "./dossierUtils.js";

// Colonne latérale : prochaines échéances + CV du profil.
export default function DossierAside({ tasks, documents, now, locale, busy, onSelectTask, onPreview, onDownload }) {
  const { t } = useTranslation();
  const ts = (key, options) => t(`adminCandidates.dossier.aside.${key}`, options);
  const upcoming = upcomingTasks(tasks, now, 5);
  const profileCv = documents.find((doc) => doc.key === "profile-cv");
  const otherCount = documents.filter((doc) => doc.key !== "profile-cv").length;

  return (
    <aside className="cnd-dos-aside" aria-label={ts("label")}>
      <motion.section className="cnd-card cnd-dos-aside__card" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.26, delay: 0.08 }}>
        <h3 className="cnd-dos-aside__title"><CalendarClock size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />{ts("upcoming")}</h3>
        {upcoming.length ? (
          <ul className="cnd-dos-upcoming">
            {upcoming.map((task) => {
              const overdue = isTaskOverdue(task, now);
              return (
                <li key={task._id}>
                  <button type="button" className={`cnd-dos-upcoming__item ${overdue ? "cnd-dos-upcoming__item--overdue" : ""}`} onClick={() => onSelectTask(task)}>
                    <TaskTypeIcon type={task.type} size="sm" />
                    <span className="cnd-dos-upcoming__text">
                      <strong>{task.title}</strong>
                      <small title={formatDateTime(task.dueDate, locale)}>
                        {overdue && <CircleAlert size={12} strokeWidth={ICON_STROKE} aria-hidden="true" />}
                        {overdue ? ts("overdue", { when: formatRelative(task.dueDate, locale, now) }) : ts("due", { when: formatRelative(task.dueDate, locale, now) })}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="cnd-dos-aside__empty"><CircleCheck size={15} strokeWidth={ICON_STROKE} aria-hidden="true" />{ts("nothingDue")}</p>
        )}
      </motion.section>

      <motion.section className="cnd-card cnd-dos-aside__card" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.26, delay: 0.14 }}>
        <h3 className="cnd-dos-aside__title"><FileText size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />{ts("cv")}</h3>
        {profileCv ? (
          <DocumentRow doc={profileCv} busy={busy} onPreview={onPreview} onDownload={onDownload} compact />
        ) : (
          <p className="cnd-dos-aside__empty">{ts("noCv")}</p>
        )}
        {otherCount > 0 && <p className="cnd-dos-aside__more">{ts("otherDocuments", { count: otherCount })}</p>}
      </motion.section>
    </aside>
  );
}
