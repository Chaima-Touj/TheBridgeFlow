/* Vidéos de témoignages (SiteSettings.testimonialVideos / actionVideo) :
   lien Google Drive, ou vidéo envoyée depuis le PC de l'admin, enregistrée
   par le backend sous la forme « /uploads/testimonials/<id>.mp4 ». Ce chemin
   est servi par le serveur de l'API : on le préfixe par son origine
   (https://9antra.tn en production, http://localhost:5000 en local). */

const DEFAULT_API_URL = "http://localhost:5000/api";

// « https://9antra.tn/api » → « https://9antra.tn » ; « /api » → "" (même origine).
export function apiOrigin(apiUrl = DEFAULT_API_URL) {
  return String(apiUrl || "").replace(/\/+$/, "").replace(/\/api$/, "");
}

const currentApiUrl = () => (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || DEFAULT_API_URL;

export const isUploadedMedia = (url) => typeof url === "string" && url.startsWith("/uploads/");

// Adresse lisible par le navigateur ; les liens Drive et autres restent inchangés.
export function resolveMediaUrl(url, apiUrl = currentApiUrl()) {
  return isUploadedMedia(url) ? `${apiOrigin(apiUrl)}${url}` : url;
}

// Témoignage vidéo → format attendu par VideoTestimonialCarousel. Options en
// objet : utilisable directement dans .map() (qui passe l'index en 2e argument).
export function toTestimonialItem(video, { apiUrl = currentApiUrl() } = {}) {
  return {
    id: video?._id,
    videoUrl: resolveMediaUrl(video?.url, apiUrl),
    posterUrl: video?.thumbnail,
    category: video?.category,
  };
}
