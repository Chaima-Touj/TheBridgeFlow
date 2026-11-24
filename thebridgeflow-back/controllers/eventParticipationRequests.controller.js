import mongoose from "mongoose";
import EventParticipationRequest from "../models/eventParticipationRequest.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { notifyAdmins } from "../services/notification.service.js";
import { splitFullName } from "../services/legacyContactMigration.service.js";
import {
  PARTICIPATION_STATUSES, UPCOMING_INTEREST, escapeRegex,
} from "../utils/validateEventParticipationRequest.js";
import {
  CONTACT_INTEREST_KEY, contactDedupKey, validateContactMessage,
} from "../utils/validateContactMessage.js";

/* Messages du site (modèle EventParticipationRequest) : messages du
   formulaire de contact (source "contact", nouveaux ou repris par la
   migration) et demandes de participation aux événements déjà reçues. */

function fail(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

const OPEN_STATUSES = ["new", "contacted"];
const isDedupConflict = (error) => error?.code === 11000 && Boolean(error.keyPattern?.dedupKey);
// Message envoyé par le formulaire de contact actuel (pas un ancien message repris par la migration).
const isContactFormMessage = (doc) => doc?.source === "contact" && !doc.legacyContactId;

function serialize(request) {
  return {
    _id: request._id,
    // "contact" = message du formulaire de contact ; "form" = demande de participation.
    source: request.source === "contact" ? "contact" : "form",
    firstName: request.firstName,
    lastName: request.lastName || "",
    email: request.email,
    phone: request.phone || "",
    university: request.university || "",
    studyLevel: request.studyLevel || "",
    subject: request.subject || "",
    message: request.message || "",
    eventId: request.eventId || null,
    eventTitle: request.eventTitle || "",
    eventStartsAt: request.eventStartsAt || null,
    notifyUpcoming: Boolean(request.notifyUpcoming),
    status: request.status,
    statusUpdatedAt: request.statusUpdatedAt || null,
    statusUpdatedBy: request.statusUpdatedBy && request.statusUpdatedBy._id
      ? { _id: request.statusUpdatedBy._id, name: request.statusUpdatedBy.name || "" }
      : null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

/* ── POST /api/contact-messages (public, reCAPTCHA) ─────────────────────── */
// Formulaire de contact du site : enregistré dans le même modèle que les
// demandes de participation (source "contact"), suivi dans Messages du site.
// Document enregistré pour un message validé (validateContactMessage).
export function contactMessageDocument(data) {
  const { firstName, lastName } = splitFullName(data.name);
  return {
    source: "contact",
    firstName,
    lastName,
    email: data.email,
    subject: data.subject,
    message: data.message,
    interestKey: CONTACT_INTEREST_KEY,
    status: "new",
    dedupKey: contactDedupKey(data),
  };
}

export const createContactMessage = asyncHandler(async (req, res) => {
  const data = validateContactMessage(req.body);

  // Même message envoyé deux fois (double clic, deux onglets, nouvel essai
  // réseau) tant qu'il est ouvert : l'index unique sur dedupKey rend la
  // vérification atomique. Aucun identifiant n'est renvoyé au visiteur.
  try {
    await EventParticipationRequest.create(contactMessageDocument(data));
  } catch (error) {
    if (!isDedupConflict(error)) throw error;
    return res.status(200).json({ message: "Votre message a déjà été envoyé.", duplicate: true });
  }

  // Administrateurs : notification dans le tableau de bord uniquement (pas d'email).
  await notifyAdmins(() => ({
    notification: {
      title: "Nouveau message depuis le site",
      message: `${data.name} — ${data.subject}`,
      type: "info",
      link: "/dashboard/admin/contact-messages",
    },
  }));

  res.status(201).json({ message: "Votre message a été envoyé." });
});

/* ── Admin ───────────────────────────────────────────────────────────────── */
// req.query n'est pas nettoyé par mongoSanitize : chaque valeur est forcée en chaîne.
const queryString = (value) => (typeof value === "string" ? value : "");

const SEARCH_FIELDS = ["firstName", "lastName", "email", "phone", "university", "eventTitle", "subject", "message"];

/* Chaque mot doit apparaître dans au moins un champ (« Sarra Haddad » trouve
   prénom + nom). Un numéro saisi sans espaces ou avec l'indicatif
   (20123456, +216 20123456, 0021620123456) trouve aussi le téléphone
   enregistré au format « +216 20 123 456 ». */
function buildSearchFilter(search) {
  const tokens = search.split(/\s+/).filter(Boolean).slice(0, 8);
  const byWords = {
    $and: tokens.map((token) => {
      const rx = new RegExp(escapeRegex(token), "i");
      return { $or: SEARCH_FIELDS.map((field) => ({ [field]: rx })) };
    }),
  };
  let digits = search.replace(/[\s().+-]/g, "");
  if (!/^\d{3,15}$/.test(digits)) return byWords;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length > 8 && digits.startsWith("216")) digits = digits.slice(3);
  return { $or: [byWords, { phone: new RegExp(digits.split("").join("\\s*")) }] };
}

/* Filtres de la liste. event = "contact" (messages du formulaire de contact),
   "participation" (toutes les demandes de participation), <id d'événement>,
   "upcoming" (prochains événements) ou "none" (sans événement précis). */
export function buildFilters(query) {
  const base = {};
  const search = queryString(query.search).trim().slice(0, 100);
  if (search) Object.assign(base, buildSearchFilter(search));
  const event = queryString(query.event);
  // Les demandes créées avant l'ajout du champ source n'en ont pas : $ne les inclut.
  const participation = { source: { $ne: "contact" } };
  if (event === UPCOMING_INTEREST) base.notifyUpcoming = true;
  else if (event === "contact") base.source = "contact";
  else if (event === "participation") Object.assign(base, participation);
  else if (event === "none") Object.assign(base, { eventId: null, notifyUpcoming: false, ...participation });
  else if (mongoose.Types.ObjectId.isValid(event) && /^[a-f\d]{24}$/i.test(event)) base.eventId = new mongoose.Types.ObjectId(event);

  const status = queryString(query.status);
  const withStatus = PARTICIPATION_STATUSES.includes(status) ? { ...base, status } : base;
  return { base, withStatus };
}

// GET /api/event-participation-requests?search=&status=&event=&page=&limit=
export const listParticipationRequests = asyncHandler(async (req, res) => {
  const { base, withStatus } = buildFilters(req.query);
  const limitValue = Number.parseInt(queryString(req.query.limit), 10);
  const limit = [10, 25, 50, 100].includes(limitValue) ? limitValue : 25;
  const pageValue = Number.parseInt(queryString(req.query.page), 10);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;

  const [requests, total, statusCounts, events] = await Promise.all([
    EventParticipationRequest.find(withStatus).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)
      .populate("statusUpdatedBy", "name").lean(),
    EventParticipationRequest.countDocuments(withStatus),
    EventParticipationRequest.aggregate([{ $match: base }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    // Événements présents dans les demandes (groupe « Événements » du filtre par type).
    EventParticipationRequest.aggregate([
      { $match: { eventId: { $ne: null } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$eventId", title: { $first: "$eventTitle" }, startsAt: { $first: "$eventStartsAt" }, count: { $sum: 1 } } },
      { $sort: { startsAt: -1 } },
    ]),
  ]);

  const counts = { all: 0, new: 0, contacted: 0, confirmed: 0 };
  for (const row of statusCounts) {
    if (counts[row._id] !== undefined) counts[row._id] = row.count;
    counts.all += row.count;
  }

  res.json({
    requests: requests.map(serialize),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    counts,
    events: events.map((row) => ({ _id: row._id, title: row.title || "", startsAt: row.startsAt || null, count: row.count })),
  });
});

// GET /api/event-participation-requests/:id
export const getParticipationRequest = asyncHandler(async (req, res) => {
  const request = await EventParticipationRequest.findById(req.params.id).populate("statusUpdatedBy", "name").lean();
  if (!request) fail("Message introuvable.", 404);
  res.json({ request: serialize(request) });
});

/* Mise à jour d'un changement de statut. L'empreinte anti-doublon n'existe que
   pour un message ouvert : retirée à la confirmation, recalculée à la
   réouverture uniquement pour un message envoyé par le formulaire de contact
   (ni pour un ancien message repris par la migration, ni pour une demande de
   participation). */
export function buildStatusUpdate(current, status, userId, now = new Date()) {
  const set = { status, statusUpdatedAt: now, statusUpdatedBy: userId };
  if (!OPEN_STATUSES.includes(status)) return { $set: set, $unset: { dedupKey: 1 } };
  if (!current.dedupKey && isContactFormMessage(current)) {
    set.dedupKey = contactDedupKey({
      email: current.email,
      name: `${current.firstName || ""} ${current.lastName || ""}`.trim(),
      subject: current.subject,
      message: current.message,
    });
  }
  return { $set: set };
}

// PATCH /api/event-participation-requests/:id/status { status }
export const updateParticipationStatus = asyncHandler(async (req, res) => {
  const status = req.body?.status;
  if (typeof status !== "string" || !PARTICIPATION_STATUSES.includes(status)) fail("Statut invalide.", 400);
  const current = await EventParticipationRequest.findById(req.params.id).lean();
  if (!current) fail("Message introuvable.", 404);

  const update = buildStatusUpdate(current, status, req.user._id);
  const save = (changes) => EventParticipationRequest.findByIdAndUpdate(
    req.params.id, changes, { returnDocument: "after", runValidators: true },
  ).populate("statusUpdatedBy", "name").lean();

  let request;
  try {
    request = await save(update);
  } catch (error) {
    // Un message identique est déjà ouvert : on change le statut sans empreinte.
    if (!isDedupConflict(error)) throw error;
    delete update.$set.dedupKey;
    request = await save(update);
  }
  if (!request) fail("Message introuvable.", 404);
  res.json({ request: serialize(request) });
});
