import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Check, LoaderCircle } from "lucide-react";
import { TASK_STATUSES, ICON_STROKE, toneClass } from "../candidatesConfig.js";
import { TaskStatusBadge } from "../shared/StatusBadges.jsx";

/* Changement rapide de statut depuis la timeline. Le passage à « Terminée »
   n'est PAS appliqué ici : le parent ouvre d'abord la confirmation explicite.
   Clavier : flèches haut/bas, Début/Fin, Échap (le focus revient au bouton). */
export default function TaskStatusMenu({ task, busy = false, onSelect }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const current = Math.max(0, TASK_STATUSES.findIndex((status) => status.key === task.status));
    const frame = requestAnimationFrame(() => itemRefs.current[current]?.focus());
    const onPointer = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, task.status]);

  const onMenuKeyDown = (event) => {
    const items = itemRefs.current.filter(Boolean);
    const index = items.indexOf(document.activeElement);
    let next = null;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      close(event.key === "Escape");
      return;
    }
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  };

  if (task.type === "note") return <TaskStatusBadge task={task} size="sm" />;

  return (
    <div className="cnd-dos-status" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="cnd-dos-status__trigger"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) { event.preventDefault(); setOpen(true); }
        }}
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
            aria-label={t("adminCandidates.dossier.timeline.changeStatus")}
            onKeyDown={onMenuKeyDown}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.16 }}
          >
            {TASK_STATUSES.map(({ key, Icon, tone }, index) => {
              const current = task.status === key;
              return (
                <button
                  key={key}
                  ref={(node) => { itemRefs.current[index] = node; }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current}
                  tabIndex={-1}
                  className={`cnd-dos-status__item ${toneClass(tone)}`}
                  onClick={() => { close(); if (!current) onSelect(key); }}
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
