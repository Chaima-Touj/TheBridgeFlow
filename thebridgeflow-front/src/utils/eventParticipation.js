/* Dashboard Admin → Messages du site : fonctions pures (testées dans
   eventParticipation.test.js). Statuts : components/common/RequestStatus.jsx. */

// Message du formulaire de contact (envoyé depuis le site ou repris de
// l'ancienne collection) ; sinon demande de participation à un événement.
export const isContactMessage = (item) => item?.source === "contact";

// Codes de l'ancienne liste déroulante, encore présents dans les demandes de
// participation envoyées avant le passage au texte libre (affichés traduits).
export const LEGACY_STUDY_LEVELS = ["bac", "bac1", "bac2", "bac3", "bac4", "bac5", "other"];

// Libellé affiché d'un niveau d'études : texte saisi, ou code de l'ancienne liste traduit.
export function studyLevelLabel(value, t) {
  const text = String(value || "").trim();
  return LEGACY_STUDY_LEVELS.includes(text) ? t(`adminParticipation.levels.${text}`) : text;
}

/* Lien « Répondre par e-mail » : adresse encodée (aucun paramètre ne peut être
   injecté dans le lien mailto:) ; réponse à un message du site avec son
   sujet (« Re : sujet »). */
export function replyMailtoHref(item, replyPrefix) {
  const address = encodeURIComponent(String(item?.email || "")).replace(/%40/g, "@");
  const subject = String(item?.subject || "").trim();
  return isContactMessage(item) && subject
    ? `mailto:${address}?subject=${encodeURIComponent(`${replyPrefix} ${subject}`)}`
    : `mailto:${address}`;
}
