import ReactGA from "react-ga4";

const MEASUREMENT_ID = "G-X91NN7VJVZ";

let initialized = false;

/**
 * Initialise GA4 uniquement en production.
 * Évite de polluer les statistiques avec les tests en développement local.
 */
export function initGA() {
  if (initialized) return;
  if (import.meta.env.PROD) {
    ReactGA.initialize(MEASUREMENT_ID);
    initialized = true;
    console.log("[GA4] Initialized with ID:", MEASUREMENT_ID);
  } else {
    console.log("[GA4] Skipped initialization (development mode)");
  }
}

/**
 * Envoie un événement "page_view" à GA4.
 * @param {string} path - Le chemin de la page (location.pathname)
 */
export function trackPageView(path) {
  if (!initialized) {
    // Tentative d'initialisation différée (au cas où trackPageView soit appelé
    // avant initGA dans le flux de l'application)
    if (import.meta.env.PROD) {
      initGA();
    } else {
      console.log(`[GA4] Track page view skipped (dev): ${path}`);
      return;
    }
  }
  ReactGA.send({ hitType: "pageview", page: path });
  console.log(`[GA4] Page view tracked: ${path}`);
}

