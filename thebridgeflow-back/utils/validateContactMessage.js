import { createHash } from "node:crypto";
import { EMAIL_PATTERN } from "./validateEventParticipationRequest.js";

/* Formulaire de contact public (Accueil, section #contact, et page /contact).
   Validation PURE, testée dans tests/contactMessage.test.js. Les messages sont
   enregistrés dans le modèle EventParticipationRequest (source "contact") et
   suivis dans Dashboard Admin → Messages du site. */

export const CONTACT_MESSAGE_LIMITS = { name: 120, email: 254, subject: 180, message: 5000 };
// interestKey des messages du site (nouveaux et repris par la migration).
export const CONTACT_INTEREST_KEY = "contact";

const REQUIRED_MESSAGES = {
  name: "Veuillez indiquer votre nom.",
  email: "Veuillez indiquer votre adresse email.",
  subject: "Veuillez indiquer le sujet de votre message.",
  message: "Veuillez écrire votre message.",
};
const LABELS = { name: "Le nom", email: "L'adresse email", subject: "Le sujet", message: "Le message" };

function badRequest(message, field) {
  const error = new Error(message);
  error.statusCode = 400;
  // Code + champ renvoyés au client par errorHandler.
  error.code = "VALIDATION_ERROR";
  if (field) error.field = field;
  return error;
}

/* Texte obligatoire : seules les chaînes sont acceptées (un objet comme
   { $ne: 1 } est refusé). collapse = espaces intérieurs réduits à un seul
   (nom, sujet) ; sinon seul le début et la fin sont nettoyés (les retours à
   la ligne du message sont conservés). */
function requiredText(input, field, { collapse = true } = {}) {
  const value = input[field];
  if (typeof value !== "string" || !value.trim()) throw badRequest(REQUIRED_MESSAGES[field], field);
  const text = collapse ? value.trim().replace(/\s+/g, " ") : value.trim();
  const max = CONTACT_MESSAGE_LIMITS[field];
  if (text.length > max) throw badRequest(`${LABELS[field]} ne doit pas dépasser ${max} caractères.`, field);
  return text;
}

/* Renvoie { name, email, subject, message } normalisés. Tout champ inconnu
   est ignoré. Erreur 400 (code VALIDATION_ERROR, field = champ concerné). */
export function validateContactMessage(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Données du formulaire invalides.");

  const name = requiredText(input, "name");

  if (typeof input.email !== "string" || !input.email.trim()) throw badRequest(REQUIRED_MESSAGES.email, "email");
  const email = input.email.trim().toLowerCase();
  if (email.length > CONTACT_MESSAGE_LIMITS.email || !EMAIL_PATTERN.test(email)) {
    throw badRequest("Veuillez saisir une adresse email valide.", "email");
  }

  const subject = requiredText(input, "subject");
  const message = requiredText(input, "message", { collapse: false });

  return { name, email, subject, message };
}

const dedupText = (value) => String(value ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/\s+/g, " ").trim();

/* Empreinte d'un message encore ouvert (Nouveau / Contacté) : même e-mail,
   même nom, même sujet et même message, sans tenir compte de la casse, des
   accents ni des espaces. L'index unique sur dedupKey empêche d'enregistrer
   deux fois le même message (double clic, deux onglets, nouvel essai réseau). */
export function contactDedupKey({ email, name, subject, message }) {
  const parts = [CONTACT_INTEREST_KEY, email, name, subject, message];
  return createHash("sha256").update(parts.map(dedupText).join("\u0000")).digest("hex");
}
