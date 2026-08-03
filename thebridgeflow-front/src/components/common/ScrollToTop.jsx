import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * React Router ne réinitialise pas la position de scroll entre les
 * navigations (contrairement à un chargement de page classique) — sans ça,
 * suivre un lien vers une autre page laisse le scroll à sa position
 * précédente. Ne réagit qu'au changement de pathname, pas de `state`, pour
 * ne pas interférer avec le scroll ciblé vers une ancre (ex. navigate("/",
 * { state: { scrollTo: "about" } })) géré séparément par la page cible.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // `behavior: "instant"` overrides the global `scroll-behavior: smooth`
    // (index.css) — without it, this would animate over ~1s instead of
    // landing on the new page already at the top.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
