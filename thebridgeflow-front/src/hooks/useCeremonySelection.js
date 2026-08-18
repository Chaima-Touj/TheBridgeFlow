import { useState, useCallback } from "react";

// État de sélection des 3 projets à voter, partagé entre CeremonyPage.jsx
// (grille) et CeremonyProjectDetail.jsx (page détail) — persisté en
// sessionStorage pour que sélectionner depuis l'une ou l'autre page reste
// cohérent, y compris à travers un aller-retour par /login (qui ne redirige
// pas vers la page d'origine, voir Login.jsx — la sélection survit quand
// même puisqu'elle n'est plus gardée seulement en mémoire).
const SELECTION_KEY = "ceremony_selection";
export const MAX_SELECTION = 3;

function readSelection() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SELECTION_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSelection(next) {
  sessionStorage.setItem(SELECTION_KEY, JSON.stringify(next));
}

export function useCeremonySelection() {
  const [selected, setSelected] = useState(readSelection);

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_SELECTION
          ? prev
          : [...prev, id];
      writeSelection(next);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelected([]);
    sessionStorage.removeItem(SELECTION_KEY);
  }, []);

  return { selected, toggleSelect, clearSelection, MAX_SELECTION };
}
