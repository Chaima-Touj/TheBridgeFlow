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

// Gestion globale des erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expiré ou invalide — nettoyage et redirection
      clearToken();
      // On ne supprime plus "user" car il n'est plus stocké dans localStorage
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
