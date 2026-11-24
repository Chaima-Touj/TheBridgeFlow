/* Tableau de bord admin → Pack PFE : fonctions pures (comptage par statut,
   filtre et recherche côté client, regroupement des technologies). */

import { normalizeRequestStatus } from "./requestStatuses.js";

// Une demande enregistrée avant l'ajout du suivi n'a pas de statut : « new ».
export const registrationStatus = (registration) => normalizeRequestStatus(registration?.status);

export function countByStatus(list = []) {
  const counts = { all: 0, new: 0, contacted: 0, confirmed: 0 };
  for (const registration of list) {
    counts.all += 1;
    counts[registrationStatus(registration)] += 1;
  }
  return counts;
}

// Minuscules, sans accents ni espaces superflus : « Université » = « universite ».
export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const digitsOf = (value) => String(value ?? "").replace(/\D/g, "");

/* Numéro saisi sans espaces ou avec l'indicatif (29324873, +216 29324873,
   0021629324873) : comparé aux seuls chiffres du téléphone enregistré
   (« +216 29 324 873 »). Renvoie les variantes à chercher (vide = pas un numéro). */
function phoneQueries(search) {
  if (!/^[\d\s().+-]+$/.test(search)) return [];
  let digits = digitsOf(search);
  if (digits.length < 3) return [];
  const variants = [digits];
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
    variants.push(digits);
  }
  if (digits.length > 8 && digits.startsWith("216")) variants.push(digits.slice(3));
  return variants;
}

const searchableText = (registration) => normalizeSearchText([
  registration.firstName,
  registration.lastName,
  registration.email,
  registration.phone,
  registration.university,
  registration.city,
  ...(Array.isArray(registration.technologies) ? registration.technologies : []),
].join(" "));

/* status : "all" (ou vide) | "new" | "contacted" | "confirmed".
   search : chaque mot doit apparaître dans au moins un champ (nom et prénom
   dans n'importe quel ordre, e-mail, téléphone, établissement, ville,
   technologies), sans tenir compte de la casse ni des accents. */
export function filterRegistrations(list = [], { status = "all", search = "" } = {}) {
  const rawSearch = String(search ?? "").trim();
  const query = normalizeSearchText(rawSearch);
  const tokens = query ? query.split(" ") : [];
  const phones = phoneQueries(rawSearch);

  return list.filter((registration) => {
    if (status && status !== "all" && registrationStatus(registration) !== status) return false;
    if (!tokens.length) return true;
    const text = searchableText(registration);
    if (tokens.every((token) => text.includes(token))) return true;
    const phoneDigits = digitsOf(registration.phone);
    return phoneDigits.length > 0 && phones.some((digits) => phoneDigits.includes(digits));
  });
}

// Parenthèses équilibrées (« a (b) » oui, « a) (b » non).
function isBalanced(text) {
  let depth = 0;
  for (const char of text) {
    if (char === "(") depth += 1;
    else if (char === ")" && --depth < 0) return false;
  }
  return depth === 0;
}

// « Business Intelligence (BI) » → { name: "Business Intelligence", detail: "BI" }.
export function splitTechnology(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  const match = /^([^()]+?) ?\((.*)\)$/.exec(text);
  if (!match || !isBalanced(match[2])) return { name: text, detail: "" };
  return { name: match[1].trim(), detail: match[2].trim() };
}

/* Regroupe les technologies qui ont le même nom principal, dans l'ordre de
   saisie : « Artificial Intelligence (AI Chatbot / Système de recommandation) »
   et « Artificial Intelligence (IA Chatbot) » → un groupe « Artificial
   Intelligence » avec deux précisions. « DevOps » → groupe sans précision. */
export function groupTechnologies(list = []) {
  const groups = [];
  const byName = new Map();
  for (const value of Array.isArray(list) ? list : []) {
    const { name, detail } = splitTechnology(value);
    if (!name) continue;
    const key = normalizeSearchText(name);
    let group = byName.get(key);
    if (!group) {
      group = { name, details: [] };
      byName.set(key, group);
      groups.push(group);
    }
    const detailKey = normalizeSearchText(detail);
    if (detailKey && !group.details.some((existing) => normalizeSearchText(existing) === detailKey)) {
      group.details.push(detail);
    }
  }
  return groups;
}

/* Après un changement de statut : met à jour la ligne de la liste (statut,
   date et auteur du changement) sans recharger la page. */
export function applyStatusUpdate(list = [], updated) {
  if (!updated?._id) return list;
  return list.map((registration) => (registration._id === updated._id
    ? {
      ...registration,
      status: registrationStatus(updated),
      statusUpdatedAt: updated.statusUpdatedAt ?? null,
      statusUpdatedBy: updated.statusUpdatedBy ?? null,
    }
    : registration));
}

export function initials(firstName = "", lastName = "") {
  return `${String(firstName ?? "").trim().charAt(0)}${String(lastName ?? "").trim().charAt(0)}`.toUpperCase();
}

// Adresse encodée : aucun paramètre (?cc=, &body=…) ne peut être injecté dans le lien.
export const mailtoHref = (email) => `mailto:${encodeURIComponent(String(email ?? "").trim()).replace(/%40/g, "@")}`;

// « +216 29 324 873 » → « tel:+21629324873 ».
export const telHref = (phone) => `tel:${String(phone ?? "").replace(/[^\d+]/g, "")}`;
