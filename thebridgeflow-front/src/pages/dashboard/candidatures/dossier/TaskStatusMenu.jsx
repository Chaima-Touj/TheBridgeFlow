import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Check, LoaderCircle } from "lucide-react";
import { TASK_STATUSES, ICON_STROKE, toneClass } from "../candidatesConfig.js";
import { TaskStatusBadge } from "../shared/StatusBadges.jsx";

/* Changement rapide de statut depuis la timeline. Le passage à « Terminée »
   n'est PAS appliqué ici : le parent ouvre d'abord la confirmation explicite. */
export default function TaskStatusMenu({ task, busy = false, onSelect }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (task.type === "note") return <TaskStatusBadge task={task} size="sm" />;

  return (
    <div className="cnd-dos-status" ref={rootRef}>
      <button
        type="button"
        className="cnd-dos-status__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("adminCandidates.dossier.timeline.changeStatus")}
        disabled={busy}
      >
        <TaskStatusBadge task={task} size="sm" />
        {busy
          ? <LoaderCircle className="cnd-spin" size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
          : <ChevronDown size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="cnd-dos-status__menu"
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.16 }}
          >
            {TASK_STATUSES.map(({ key, Icon, tone }) => {
              const current = task.status === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current}
                  className={`cnd-dos-status__item ${toneClass(tone)}`}
                  onClick={() => { setOpen(false); if (!current) onSelect(key); }}
                >
                  <Icon size={15} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  <span>{t(`adminCandidates.common.taskStatus.${key}`)}</span>
                  {current && <Check className="cnd-dos-status__check" size={14} strokeWidth={2.2} aria-hidden="true" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
