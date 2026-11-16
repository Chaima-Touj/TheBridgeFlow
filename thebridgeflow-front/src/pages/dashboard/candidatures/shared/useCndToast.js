import { useCallback, useEffect, useRef, useState } from "react";

let toastSeq = 0;

/* Toasts locaux à l'espace Candidatures (le projet n'a pas de système global).
   const { toasts, pushToast, dismissToast } = useCndToast();
   <CndToastViewport toasts={toasts} onDismiss={dismissToast} /> */
export function useCndToast({ duration = 4200 } = {}) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const pushToast = useCallback((type, message) => {
    if (!message) return;
    toastSeq += 1;
    const id = toastSeq;
    setToasts((list) => [...list.slice(-2), { id, type, message }]);
    timers.current.set(id, setTimeout(() => dismissToast(id), type === "error" ? duration + 2000 : duration));
  }, [dismissToast, duration]);

  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach((timer) => clearTimeout(timer)); map.clear(); };
  }, []);

  return { toasts, pushToast, dismissToast };
}
