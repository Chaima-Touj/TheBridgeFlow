import axios from "axios";
import { getToken, clearToken } from "../utils/tokenStorage.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
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
