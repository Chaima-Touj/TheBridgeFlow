import { useEffect } from "react";

// Pas de react-helmet (contrainte : aucune nouvelle dépendance avant le
// déploiement du jour) — manipulation directe du DOM. Crée la balise <meta>
// si absente (index.html n'a pas de balises og:* de base), la met à jour
// sinon.
function setMetaTag(attr, key, content) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// Longueur standard SEO pour une meta description (~155 caractères avant
// troncature dans les résultats de recherche).
export function truncateForSEO(text = "", max = 155) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Met à jour document.title + meta description/Open Graph pour la page
 * courante. `title`/`description` undefined ou vide = pas de mise à jour
 * (utile pour attendre qu'une donnée asynchrone — formation, offre — soit
 * chargée avant d'écraser le titre générique d'index.html).
 */
export function useDocumentMeta({ title, description }) {
  useEffect(() => {
    if (title) {
      document.title = title;
      setMetaTag("property", "og:title", title);
    }
    if (description) {
      setMetaTag("name", "description", description);
      setMetaTag("property", "og:description", description);
    }
    if (title || description) {
      setMetaTag("property", "og:url", window.location.href);
    }
  }, [title, description]);
}
