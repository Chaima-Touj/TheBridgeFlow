import mongoose from "mongoose";
import Event from "../models/event.model.js";
import EventParticipationRequest from "../models/eventParticipationRequest.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { notifyAdmins } from "../services/notification.service.js";
import { getEventPeriodFilter } from "../utils/eventPeriodFilter.js";
import {
  PARTICIPATION_STATUSES, UPCOMING_INTEREST, escapeRegex, interestKeyOf, participationDedupKey,
  validateEventParticipationRequest,
} from "../utils/validateEventParticipationRequest.js";

function fail(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  throw error;
}

const OPEN_STATUSES = ["new", "contacted"];
const isDedupConflict = (error) => error?.code === 11000 && Boolean(error.keyPattern?.dedupKey);

function serialize(request) {
  return {
    _id: request._id,
    // "contact" = ancien message du site repris par la migration.
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

/* ── POST /api/event-participation-requests (public, reCAPTCHA) ─────────── */
export const createParticipationRequest = asyncHandler(async (req, res) => {
  const data = validateEventParticipationRequest(req.body);

  let event = null;
  if (data.interest && data.interest !== UPCOMING_INTEREST) {
    // Seuls les événements publiés et à venir (mêmes règles que la liste
    // publique /api/events?period=upcoming) peuvent être choisis.
    event = await Event.findOne({ _id: data.interest, status: "published", ...getEventPeriodFilter("upcoming") })
      .select("title startsAt")
      .lean();
    if (!event) fail("Cet événement n'est plus disponible. Choisissez-en un autre ou l'option « prochains événements ».", 400, "EVENT_UNAVAILABLE");
  }

  const interestKey = interestKeyOf(data.interest);
  const fields = {
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    university: data.university,
    studyLevel: data.studyLevel,
  };

  // Doublon inutile : même e-mail, même choix, mêmes informations (casse,
  // accents et espaces ignorés) et demande encore ouverte. L'index unique sur
  // dedupKey rend la vérification atomique. On ne réécrit jamais une demande
  // existante (n'importe qui peut saisir l'e-mail d'un autre) : si les
  // informations diffèrent, une nouvelle demande est créée et l'équipe voit
  // les deux. Aucun identifiant n'est renvoyé au visiteur.
  try {
    await EventParticipationRequest.create({
      ...fields,
      email: data.email,
      eventId: event?._id || null,
      eventTitle: event?.title || "",
      eventStartsAt: event?.startsAt || null,
      notifyUpcoming: data.interest === UPCOMING_INTEREST,
      interestKey,
      dedupKey: participationDedupKey(data, interestKey),
    });
  } catch (error) {
    if (!isDedupConflict(error)) throw error;
    return res.status(200).json({
      message: "Votre demande est déjà enregistrée. Notre équipe vous contactera prochainement.",
      duplicate: true,
    });
  }

  // Administrateurs : notification dans le tableau de bord uniquement (pas d'email).
  await notifyAdmins(() => ({
    notification: {
      title: "Nouvelle demande de participation",
      message: `${data.firstName} ${data.lastName}${event ? ` — ${event.title}` : ""}`,
      type: "info",
      link: "/dashboard/admin/demandes-participation",
    },
  }));

  res.status(201).json({ message: "Vos informations ont été envoyées avec succès.", duplicate: false });
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

function buildFilters(query) {
  const base = {};
  const search = queryString(query.search).trim().slice(0, 100);
  if (search) Object.assign(base, buildSearchFilter(search));
  const event = queryString(query.event);
  if (event === UPCOMING_INTEREST) base.notifyUpcoming = true;
  else if (event === "contact") base.source = "contact";
  // Les demandes créées avant l'ajout du champ source n'en ont pas : $ne les inclut.
  else if (event === "none") Object.assign(base, { eventId: null, notifyUpcoming: false, source: { $ne: "contact" } });
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
    // Événements présents dans les demandes (liste du filtre « Événement »).
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
  if (!request) fail("Demande de participation introuvable.", 404);
  res.json({ request: serialize(request) });
});

// PATCH /api/event-participation-requests/:id/status { status }
export const updateParticipationStatus = asyncHandler(async (req, res) => {
  const status = req.body?.status;
  if (typeof status !== "string" || !PARTICIPATION_STATUSES.includes(status)) fail("Statut invalide.", 400);
  const current = await EventParticipationRequest.findById(req.params.id).lean();
  if (!current) fail("Demande de participation introuvable.", 404);

  // L'empreinte anti-doublon n'existe que pour une demande ouverte : retirée
  // à la confirmation, recalculée si la demande est rouverte.
  const set = { status, statusUpdatedAt: new Date(), statusUpdatedBy: req.user._id };
  const open = OPEN_STATUSES.includes(status);
  const update = open ? { $set: set } : { $set: set, $unset: { dedupKey: 1 } };
  // Pas d'empreinte pour un ancien message du site (pas de doublon possible via le formulaire).
  if (open && !current.dedupKey && current.source !== "contact") {
    update.$set.dedupKey = participationDedupKey(current, current.interestKey);
  }

  const save = (changes) => EventParticipationRequest.findByIdAndUpdate(
    req.params.id, changes, { returnDocument: "after", runValidators: true },
  ).populate("statusUpdatedBy", "name").lean();

  let request;
  try {
    request = await save(update);
  } catch (error) {
    // Une demande identique est déjà ouverte : on change le statut sans empreinte.
    if (!isDedupConflict(error)) throw error;
    delete update.$set.dedupKey;
    request = await save(update);
  }
  if (!request) fail("Demande de participation introuvable.", 404);
  res.json({ request: serialize(request) });
});
