import { useEffect, useState } from "react";

// Horloge « douce » pour les calculs d'échéance / retard en cours de rendu
// (évite Date.now() dans le corps des composants) — rafraîchie chaque minute.
export function useNow(intervalMs = 60 * 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
