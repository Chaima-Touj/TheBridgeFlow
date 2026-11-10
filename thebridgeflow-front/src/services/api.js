import axios from "axios";
import { getToken, clearToken } from "../utils/tokenStorage.js";
import { getRecaptchaToken } from "../utils/recaptchaV3Client.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

// Formulaires protégés par reCAPTCHA (même liste que verifyRecaptcha dans les routes
// du backend) : connexion, inscription, vérification email, mot de passe oublié,
// contact, newsletter et Pack PFE. Les autres requêtes ne chargent pas reCAPTCHA.
const RECAPTCHA_ENDPOINTS = [
  /^\/auth\/(register|login|verify-email|resend-code|forgot-password)$/,
  /^\/auth\/reset-password\/[^/]+$/,
  /^\/contact-messages\/?$/,
  /^\/newsletter\/subscribe$/,
  /^\/pfe-pack\/registrations\/?$/,
];

function needsRecaptcha(config) {
  const method = (config.method || "get").toLowerCase();
  const path = (config.url || "").split("?")[0];
  return method === "post" && RECAPTCHA_ENDPOINTS.some((pattern) => pattern.test(path));
}

api.interceptors.request.use(async (config) => {
  if (needsRecaptcha(config)) {
    // Jeton reCAPTCHA en best-effort : si Google est bloqué, lent ou non configuré,
    // la requête part sans jeton et c'est le backend qui décide (vérification
    // désactivée tant que RECAPTCHA_SECRET_KEY n'est pas définie sur le serveur).
    let captchaToken;
    try {
      captchaToken = await Promise.race([
        getRecaptchaToken(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Google reCAPTCHA timed out.")), 5000)),
      ]);
    } catch (captchaError) {
      console.warn("[recaptcha]", captchaError.message);
    }
    if (captchaToken) {
      config.headers = config.headers || {};
      config.headers["X-Recaptcha-Token"] = captchaToken;
    }
  }
  return config;
});

// Injecter le token Bearer automatiquement sur chaque requête
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Routes publiques où un 401 signifie "identifiants invalides", pas "token
// expiré" — aucun token n'est en jeu sur ces requêtes, donc pas de
// clearToken()/redirection automatique : le composant appelant (ex.
// Login.jsx) doit pouvoir afficher son propre message d'erreur.
const PUBLIC_AUTH_ROUTES = /\/auth\/(login|register)(\?|$)/;

// Gestion globale des erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.test(error.config?.url || "");
    if (error.response?.status === 401 && !isPublicAuthRoute) {
      // Token expiré ou invalide — nettoyage et redirection
      clearToken();
      // On ne supprime plus "user" car il n'est plus stocké dans localStorage
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
