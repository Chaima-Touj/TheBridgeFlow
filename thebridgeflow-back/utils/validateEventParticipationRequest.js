import { REQUEST_STATUSES } from "./requestStatuses.js";

/* Messages du site (modèle EventParticipationRequest) : constantes et
   fonctions PURES partagées par le modèle, l'administration et le formulaire
   de contact (utils/validateContactMessage.js). Les demandes de participation
   déjà reçues restent consultables ; le formulaire public « Participer à nos
   événements » n'existe plus. */

// Niveau d'études : texte libre facultatif (ex. « Licence 2 », « Master 1 »).
export const STUDY_LEVEL_MAX_LENGTH = 120;
export const PARTICIPATION_STATUSES = REQUEST_STATUSES;
// Option « Je souhaite être informé des prochains événements » des demandes de participation.
export const UPCOMING_INTEREST = "upcoming";

// Partie locale : lettres, chiffres et « . _ + - » (sans points consécutifs) ;
// domaine : labels [a-z0-9-] séparés par des points. Les caractères comme
// ? & % < > " sont refusés (aucune injection possible dans un lien mailto:).
export const EMAIL_PATTERN = /^[a-z0-9_+-]+(?:\.[a-z0-9_+-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24}|xn--[a-z0-9-]{1,59})$/i;

export function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
