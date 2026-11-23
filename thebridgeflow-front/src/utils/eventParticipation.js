import { normalizeTunisianPhone } from "./tunisianPhone.js";

/* Formulaire « Participer à nos événements » : mêmes règles que le backend
   (utils/validateEventParticipationRequest.js). Fonctions pures. */

export const STUDY_LEVELS = ["bac", "bac1", "bac2", "bac3", "bac4", "bac5", "other"];
export const UPCOMING_INTEREST = "upcoming";
export const PARTICIPATION_STATUSES = ["new", "contacted", "confirmed"];

// Identique au backend : lettres, chiffres et « . _ + - » avant @, domaine en
// labels [a-z0-9-] ; refuse ? & % < > " (pas d'injection dans un lien mailto:).
const EMAIL_PATTERN = /^[a-z0-9_+-]+(?:\.[a-z0-9_+-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24}|xn--[a-z0-9-]{1,59})$/i;
const LIMITS = { firstName: 80, lastName: 80, university: 160 };
const FORM_FIELDS = ["firstName", "lastName", "email", "phone", "university", "studyLevel", "interest"];

export const EMPTY_PARTICIPATION_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  university: "",
  studyLevel: "",
  interest: "",
};

// Renvoie { champ: "required" | "email" | "phone" | "tooLong" } (vide = valide).
export function validateParticipationForm(form) {
  const errors = {};
  for (const field of ["firstName", "lastName", "university"]) {
    const value = String(form[field] || "").trim();
    if (!value) errors[field] = "required";
    else if (value.length > LIMITS[field]) errors[field] = "tooLong";
  }
  const email = String(form.email || "").trim();
  if (!email) errors.email = "required";
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) errors.email = "email";
  const phone = String(form.phone || "").trim();
  if (!phone) errors.phone = "required";
  else if (!normalizeTunisianPhone(phone)) errors.phone = "phone";
  if (!STUDY_LEVELS.includes(form.studyLevel)) errors.studyLevel = "required";
  return errors;
}

export function buildParticipationPayload(form) {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim().toLowerCase(),
    phone: normalizeTunisianPhone(form.phone.trim()) || form.phone.trim(),
    university: form.university.trim(),
    studyLevel: form.studyLevel,
    interest: form.interest || "",
  };
}

/* Clé i18n (eventParticipation.errors.*) d'une erreur d'envoi. Le texte brut
   du serveur (français uniquement, parfois technique sur une erreur 500)
   n'est jamais affiché au visiteur. */
export function participationErrorKey(error) {
  const response = error?.response;
  if (!response) return "network";
  if (response.status === 429) return "rateLimited";
  if (response.data?.code === "EVENT_UNAVAILABLE") return "eventUnavailable";
  if (response.data?.code === "VALIDATION_ERROR") return "fixFields";
  if (response.status === 403) return "captcha"; // case anti-robot absente ou refusée
  return "generic";
}

// Champ du formulaire signalé par le serveur (validation), sinon null.
export function participationErrorField(error) {
  const field = error?.response?.data?.field;
  return FORM_FIELDS.includes(field) ? field : null;
}
