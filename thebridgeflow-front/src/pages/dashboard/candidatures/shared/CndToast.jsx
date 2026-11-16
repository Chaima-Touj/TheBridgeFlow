import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, CircleAlert, Info, X } from "lucide-react";
import { toneClass } from "../candidatesConfig.js";
import "./candidatesShared.css";

/* Toasts locaux à l'espace Candidatures (le projet n'a pas de système global).
   const { toasts, pushToast, dismissToast } = useCndToast();   // ./useCndToast.js
   <CndToastViewport toasts={toasts} onDismiss={dismissToast} /> */
const TYPE_META = {
  success: { Icon: CircleCheck, tone: "emerald" },
  error:   { Icon: CircleAlert, tone: "red" },
  info:    { Icon: Info,        tone: "blue" },
};

export function CndToastViewport({ toasts, onDismiss }) {
  const { t } = useTranslation();
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="cnd-toast-viewport" role="region" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const meta = TYPE_META[toast.type] || TYPE_META.info;
          const Icon = meta.Icon;
          return (
            <motion.div
              key={toast.id}
              layout
              className={`cnd-toast ${toneClass(meta.tone)}`}
              role={toast.type === "error" ? "alert" : "status"}
              initial={{ opacity: 0, y: 16, scale: .97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: .97, transition: { duration: .16 } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
            >
              <Icon className="cnd-toast__icon" size={18} strokeWidth={2} aria-hidden="true" />
              <span className="cnd-toast__msg">{toast.message}</span>
              <button type="button" className="cnd-toast__close" onClick={() => onDismiss(toast.id)} aria-label={t("adminCandidates.common.actions.dismiss")}>
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
