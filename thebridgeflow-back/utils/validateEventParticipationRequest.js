import { createHash } from "node:crypto";
import { normalizeTunisianPhone } from "./tunisianPhone.js";

/* Demandes de participation aux événements (formulaire « Participer à nos
   événements » des pages Contact). Validation PURE, testée dans
   tests/eventParticipationRequest.test.js. */

export const STUDY_LEVELS = ["bac", "bac1", "bac2", "bac3", "bac4", "bac5", "other"];
export const PARTICIPATION_STATUSES = ["new", "contacted", "confirmed"];
// Valeur de l'option « Je souhaite être informé des prochains événements ».
export const UPCOMING_INTEREST = "upcoming";

// Partie locale : lettres, chiffres et « . _ + - » (sans points consécutifs) ;
// domaine : labels [a-z0-9-] séparés par des points. Les caractères comme
// ? & % < > " sont refusés (aucune injection possible dans un lien mailto:).
// Même règle côté frontend : src/utils/eventParticipation.js.
const EMAIL_PATTERN = /^[a-z0-9_+-]+(?:\.[a-z0-9_+-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24}|xn--[a-z0-9-]{1,59})$/i;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function badRequest(message, field) {
  const error = new Error(message);
  error.statusCode = 400;
  // Code + champ renvoyés au client (errorHandler) pour afficher un message
  // traduit et mettre le bon champ en évidence.
  error.code = "VALIDATION_ERROR";
  if (field) error.field = field;
  return error;
}

function requiredText(value, field, label, maxLength) {
  if (typeof value !== "string" || !value.trim()) throw badRequest(`${label} est obligatoire.`, field);
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length > maxLength) throw badRequest(`${label} ne doit pas dépasser ${maxLength} caractères.`, field);
  return text;
}

/* Renvoie { firstName, lastName, email, phone, university, studyLevel,
   interest } normalisés, interest = "" | "upcoming" | <id d'événement>.
   Tout champ inconnu est ignoré. */
export function validateEventParticipationRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Données du formulaire invalides.");

  const firstName = requiredText(input.firstName, "firstName", "Le prénom", 80);
  const lastName = requiredText(input.lastName, "lastName", "Le nom", 80);

  if (typeof input.email !== "string" || !input.email.trim()) throw badRequest("L'adresse e-mail est obligatoire.", "email");
  const email = input.email.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) throw badRequest("Saisissez une adresse e-mail valide.", "email");

  if (typeof input.phone !== "string" || !input.phone.trim()) throw badRequest("Le numéro de téléphone est obligatoire.", "phone");
  const phone = normalizeTunisianPhone(input.phone);
  if (!phone) throw badRequest("Saisissez un numéro de téléphone tunisien valide (8 chiffres, ex. 20 123 456).", "phone");

  const university = requiredText(input.university, "university", "L'université ou l'établissement", 160);

  if (typeof input.studyLevel !== "string" || !STUDY_LEVELS.includes(input.studyLevel)) {
    throw badRequest("Choisissez votre niveau d'études.", "studyLevel");
  }

  let interest = "";
  if (input.interest !== undefined && input.interest !== null && input.interest !== "") {
    if (typeof input.interest !== "string") throw badRequest("Choix d'événement invalide.", "interest");
    if (input.interest === UPCOMING_INTEREST) interest = UPCOMING_INTEREST;
    else if (OBJECT_ID_PATTERN.test(input.interest)) interest = input.interest;
    else throw badRequest("Choix d'événement invalide.", "interest");
  }

  return { firstName, lastName, email, phone, university, studyLevel: input.studyLevel, interest };
}

// Clé de dédoublonnage : même personne (e-mail) + même centre d'intérêt.
export function interestKeyOf(interest) {
  return interest || "general";
}

const dedupText = (value) => String(value ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/\s+/g, " ").trim();

/* Empreinte d'une demande ouverte : même e-mail, même choix et mêmes
   informations, sans tenir compte de la casse, des accents ni des espaces.
   Un index unique sur cette empreinte empêche les doublons, y compris lors
   d'envois simultanés (double clic, deux onglets, nouvel essai réseau). */
export function participationDedupKey(data, interestKey) {
  const parts = [data.email, interestKey, data.firstName, data.lastName, data.phone, data.university, data.studyLevel];
  return createHash("sha256").update(parts.map(dedupText).join("\u0000")).digest("hex");
}

export function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
