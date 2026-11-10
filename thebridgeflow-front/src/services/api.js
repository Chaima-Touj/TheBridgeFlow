import axios from "axios";
import { getToken, clearToken } from "../utils/tokenStorage.js";
import { getRecaptchaToken } from "../utils/recaptchaV3Client.js";
import { RECAPTCHA_V2_SITE_KEY } from "../utils/recaptchaV2Client.js";

const RECAPTCHA_V3_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

// Formulaires protégés par reCAPTCHA (même liste que verifyRecaptcha dans les routes
// du backend) : connexion, inscription, vérification email, mot de passe oublié,
// contact, newsletter, Pack PFE et candidature à une offre.
// - Case v2 visible : le formulaire passe { recaptchaToken } dans la config de la requête.
// - Sinon v3 invisible : le jeton est demandé ici pour ces endpoints.
const RECAPTCHA_ENDPOINTS = [
  /^\/auth\/(register|login|verify-email|resend-code|forgot-password)$/,
  /^\/auth\/reset-password\/[^/]+$/,
  /^\/contact-messages\/?$/,
  /^\/newsletter\/subscribe$/,
  /^\/pfe-pack\/registrations\/?$/,
  /^\/applications\/?$/,
];

function needsRecaptcha(config) {
  const method = (config.method || "get").toLowerCase();
  const path = (config.url || "").split("?")[0];
  return method === "post" && RECAPTCHA_ENDPOINTS.some((pattern) => pattern.test(path));
}

api.interceptors.request.use(async (config) => {
  // Case v2 « Je ne suis pas un robot » cochée dans le formulaire.
  if (config.recaptchaToken) {
    config.headers = config.headers || {};
    config.headers["X-Recaptcha-Token"] = config.recaptchaToken;
    config.headers["X-Recaptcha-Version"] = "v2";
    return config;
  }

  // reCAPTCHA v3 invisible : seulement si la case v2 n'est pas configurée et
  // qu'une clé v3 existe (sinon rien à demander à Google).
  if (!RECAPTCHA_V2_SITE_KEY && RECAPTCHA_V3_SITE_KEY && needsRecaptcha(config)) {
    // Jeton reCAPTCHA en best-effort : si Google est bloqué ou lent, la requête
    // part sans jeton et c'est le backend qui décide (sauf pour la connexion).
    let captchaToken;
    try {
      captchaToken = await Promise.race([
        getRecaptchaToken(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Google reCAPTCHA timed out.")), 5000)),
      ]);
    } catch (captchaError) {
      console.warn("[recaptcha]", captchaError.message);
      if (/\/auth\/login$/.test((config.url || "").split("?")[0])) {
        throw new Error("RECAPTCHA_UNAVAILABLE", { cause: captchaError });
      }
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
