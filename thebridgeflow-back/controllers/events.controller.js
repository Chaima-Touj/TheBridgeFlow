import mongoose from "mongoose";
import Event from "../models/event.model.js";
import EventRegistration from "../models/eventRegistration.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getActiveStudents, notifyAdmins, notifyUser, notifyUsers } from "../services/notification.service.js";

const EVENT_FIELDS = [
  "title", "description", "image", "category", "startsAt", "endsAt",
  "timezone", "mode", "location", "meetingUrl", "capacity",
  "registrationRequired", "status",
];

const fail = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

function validateEventPayload(data, { partial = false } = {}) {
  const payload = {};
  for (const key of EVENT_FIELDS) {
    if (data[key] !== undefined) payload[key] = data[key];
  }

  if (!partial || payload.title !== undefined) {
    if (typeof payload.title !== "string" || !payload.title.trim() || payload.title.trim().length > 160) {
      fail("Le titre est requis (160 caractères maximum).", 400);
    }
    payload.title = payload.title.trim();
  }
  if (!partial || payload.description !== undefined) {
    if (typeof payload.description !== "string" || !payload.description.trim() || payload.description.trim().length > 10000) {
      fail("La description est requise (10 000 caractères maximum).", 400);
    }
    payload.description = payload.description.trim();
  }
  if (!partial || payload.category !== undefined) {
    if (typeof payload.category !== "string" || !payload.category.trim() || payload.category.trim().length > 80) {
      fail("La catégorie est requise (80 caractères maximum).", 400);
    }
    payload.category = payload.category.trim();
  }

  for (const key of ["startsAt", "endsAt"]) {
    if (payload[key] === null && key === "endsAt") continue;
    if (payload[key] !== undefined) {
      if (payload[key] === null || payload[key] === "") fail(`La date ${key} est invalide.`, 400);
      const date = new Date(payload[key]);
      if (Number.isNaN(date.getTime())) fail(`La date ${key} est invalide.`, 400);
      payload[key] = date;
    } else if (!partial && key === "startsAt") {
      fail("La date de début est requise.", 400);
    }
  }
  if (payload.startsAt && payload.endsAt && payload.endsAt <= payload.startsAt) {
    fail("La date de fin doit être postérieure à la date de début.", 400);
  }

  if (payload.mode !== undefined && !["onsite", "online", "hybrid"].includes(payload.mode)) {
    fail("Le mode d'événement est invalide.", 400);
  }
  if (payload.mode === "onsite") payload.meetingUrl = "";
  if (payload.mode === "online") payload.location = "";
  if (payload.registrationRequired !== undefined && typeof payload.registrationRequired !== "boolean") {
    fail("registrationRequired doit être un booléen.", 400);
  }
  if (payload.capacity !== undefined && payload.capacity !== null &&
      (!Number.isInteger(Number(payload.capacity)) || Number(payload.capacity) < 1)) {
    fail("La capacité doit être un entier positif ou null.", 400);
  }
  if (payload.capacity !== undefined && payload.capacity !== null) payload.capacity = Number(payload.capacity);
  const stringLimits = { image: 2048, location: 500, meetingUrl: 2048, timezone: 100 };
  for (const [key, maxLength] of Object.entries(stringLimits)) {
    if (payload[key] !== undefined && typeof payload[key] !== "string") fail(`${key} doit être une chaîne.`, 400);
    if (typeof payload[key] === "string") {
      payload[key] = payload[key].trim();
      if (payload[key].length > maxLength) fail(`${key} dépasse la longueur maximale autorisée.`, 400);
    }
  }
  if (payload.timezone !== undefined && !payload.timezone) fail("Le fuseau horaire est requis.", 400);
  if (payload.timezone) {
    try { new Intl.DateTimeFormat("en", { timeZone: payload.timezone }); }
    catch { fail("Le fuseau horaire est invalide.", 400); }
  }
  for (const key of ["image", "meetingUrl"]) {
    if (payload[key]) {
      let parsed;
      try { parsed = new URL(payload[key]); } catch { fail(`L'URL ${key} est invalide.`, 400); }
      if (!["http:", "https:"].includes(parsed.protocol)) fail(`L'URL ${key} doit utiliser HTTP ou HTTPS.`, 400);
    }
  }
  if (payload.status !== undefined && !["draft", "published", "cancelled", "archived"].includes(payload.status)) {
    fail("Le statut de l'événement est invalide.", 400);
  }
  const finalMode = payload.mode || "onsite";
  if (!partial && ["onsite", "hybrid"].includes(finalMode) && !payload.location?.trim()) {
    fail("Un lieu est requis pour un événement présentiel ou hybride.", 400);
  }
  if (!partial && ["online", "hybrid"].includes(finalMode) && !payload.meetingUrl?.trim()) {
    fail("Un lien de visioconférence est requis pour un événement en ligne ou hybride.", 400);
  }
  return payload;
}

function getEventEmailData(event) {
  return {
    eventTitle: event.title,
    description: event.description,
    startsAt: event.startsAt,
    timezone: event.timezone,
    location: event.location,
    eventId: String(event._id),
  };
}

async function announcePublishedEvent(event) {
  let students;
  try {
    students = await getActiveStudents();
  } catch (error) {
    console.error("[events] Failed to load announcement recipients", {
      eventId: String(event._id),
      message: error.message,
    });
    return;
  }

  const claimedAt = new Date();
  const staleClaimBefore = new Date(claimedAt.getTime() - 10 * 60 * 1000);
  let claim;
  try {
    claim = await Event.findOneAndUpdate(
      {
        _id: event._id,
        status: "published",
        publishedAnnouncementSentAt: null,
        $or: [
          { publishedAnnouncementClaimedAt: null },
          { publishedAnnouncementClaimedAt: { $lt: staleClaimBefore } },
        ],
      },
      { $set: { publishedAnnouncementClaimedAt: claimedAt } },
      { new: true }
    ).select("_id");
  } catch (error) {
    console.error("[events] Failed to claim publication announcement", {
      eventId: String(event._id),
      message: error.message,
    });
    return;
  }
  if (!claim) return;

  try {
    const eventData = getEventEmailData(event);
    await notifyUsers(students, (student) => ({
      notification: {
        title: "Un nouvel événement est disponible !",
        message: `Un nouvel événement vient d'être publié : "${event.title}".`,
        type: "info",
        link: `/events/${event._id}`,
      },
      emailMethod: "sendEventPublished",
      emailData: { recipientName: student.name, event: eventData },
    }));

    const finalized = await Event.updateOne(
      {
        _id: event._id,
        status: "published",
        publishedAnnouncementSentAt: null,
        publishedAnnouncementClaimedAt: claimedAt,
      },
      {
        $set: { publishedAnnouncementSentAt: new Date() },
        $unset: { publishedAnnouncementClaimedAt: 1 },
      }
    );
    if (finalized.modifiedCount === 0) {
      console.error("[events] Publication announcement claim was lost before finalization", {
        eventId: String(event._id),
      });
      await Event.updateOne(
        { _id: event._id, publishedAnnouncementClaimedAt: claimedAt },
        { $unset: { publishedAnnouncementClaimedAt: 1 } }
      );
    }
  } catch (error) {
    console.error("[events] Failed to process publication announcement", {
      eventId: String(event._id),
      message: error.message,
    });
    try {
      await Event.updateOne(
        { _id: event._id, publishedAnnouncementClaimedAt: claimedAt },
        { $unset: { publishedAnnouncementClaimedAt: 1 } }
      );
    } catch (releaseError) {
      console.error("[events] Failed to release publication announcement claim", {
        eventId: String(event._id),
        message: releaseError.message,
      });
    }
  }
}

const publicProjection = [
  "title", "description", "image", "category", "startsAt", "endsAt",
  "timezone", "mode", "location", "capacity", "registrationRequired",
  "registrationCount", "status", "createdAt",
].join(" ");

// GET /api/events?period=upcoming|past
export const getPublicEvents = asyncHandler(async (req, res) => {
  const now = new Date();
  const filter = { status: "published" };
  if (req.query.period === "upcoming") filter.startsAt = { $gte: now };
  if (req.query.period === "past") filter.startsAt = { $lt: now };
  const sortDirection = req.query.period === "past" ? -1 : 1;
  const events = await Event.find(filter).select(publicProjection).sort({ startsAt: sortDirection }).lean();
  res.json({ events });
});

// GET /api/events/:id — no private meeting link is returned publicly.
export const getPublicEvent = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Identifiant d'événement invalide.", 400);
  const event = await Event.findOne({ _id: req.params.id, status: { $in: ["published", "cancelled"] } })
    .select(publicProjection)
    .lean();
  if (!event) fail("Événement introuvable.", 404);
  res.json({ event });
});

// GET /api/events/admin
export const getAdminEvents = asyncHandler(async (req, res) => {
  const events = await Event.find().sort({ startsAt: 1 }).lean();
  res.json({ events });
});

// POST /api/events
export const createEvent = asyncHandler(async (req, res) => {
  const payload = validateEventPayload(req.body);
  const event = await Event.create({ ...payload, createdBy: req.user._id });
  if (event.status === "published") await announcePublishedEvent(event);
  res.status(201).json({ event });
});

// PATCH /api/events/:id
export const updateEvent = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Identifiant d'événement invalide.", 400);
  const event = await Event.findById(req.params.id);
  if (!event) fail("Événement introuvable.", 404);

  const payload = validateEventPayload(req.body, { partial: true });
  if (Object.keys(payload).length === 0) fail("Aucun champ d'événement valide à modifier.", 400);

  const previous = {
    title: event.title,
    description: event.description,
    category: event.category,
    startsAt: event.startsAt?.getTime(),
    endsAt: event.endsAt?.getTime(),
    mode: event.mode,
    location: event.location,
    meetingUrl: event.meetingUrl,
    capacity: event.capacity,
    registrationRequired: event.registrationRequired,
    status: event.status,
  };
  if (payload.status === "archived" && event.status === "published" && event.startsAt > new Date()) {
    fail("Annulez d'abord un événement à venir avant de l'archiver.", 409);
  }
  if (payload.status === "draft" && event.status === "published") {
    fail("Un événement publié ne peut pas redevenir un brouillon. Annulez-le pour informer les participants.", 409);
  }
  const finalMode = payload.mode || event.mode;
  const finalLocation = payload.location !== undefined ? payload.location : event.location;
  const finalMeetingUrl = payload.meetingUrl !== undefined ? payload.meetingUrl : event.meetingUrl;
  const finalStartsAt = payload.startsAt || event.startsAt;
  const finalEndsAt = payload.endsAt !== undefined ? payload.endsAt : event.endsAt;
  if (finalEndsAt && finalEndsAt <= finalStartsAt) {
    fail("La date de fin doit être postérieure à la date de début.", 400);
  }
  if (["onsite", "hybrid"].includes(finalMode) && !finalLocation.trim()) {
    fail("Un lieu est requis pour un événement présentiel ou hybride.", 400);
  }
  if (["online", "hybrid"].includes(finalMode) && !finalMeetingUrl.trim()) {
    fail("Un lien de visioconférence est requis pour un événement en ligne ou hybride.", 400);
  }
  Object.assign(event, payload);
  if (event.capacity !== null && event.capacity < event.registrationCount) {
    fail("La capacité ne peut pas être inférieure au nombre d'inscriptions actives.", 409);
  }
  await event.save();

  const registrations = await EventRegistration.find({ event: event._id, status: "registered" })
    .populate("student", "name email")
    .lean();
  const eventLink = `/events/${event._id}`;
  const becamePublished = previous.status !== "published" && event.status === "published";
  if (previous.status !== "cancelled" && event.status === "cancelled") {
    await EventRegistration.updateMany({ event: event._id, status: "registered" }, { status: "cancelled" });
    event.registrationCount = 0;
    await event.save();
    await notifyUsers(registrations.map(({ student }) => student).filter(Boolean), (student) => ({
      notification: {
        title: "Événement annulé",
        message: `L'événement "${event.title}" a été annulé.`,
        type: "warning",
        link: eventLink,
      },
      emailMethod: "sendEventRegistrationCancelled",
      emailData: { recipientName: student.name, event: getEventEmailData(event) },
    }));
  } else if (becamePublished || (event.status === "published" && !event.publishedAnnouncementSentAt)) {
    await announcePublishedEvent(event);
  } else if (
    previous.title !== event.title ||
    previous.description !== event.description ||
    previous.category !== event.category ||
    previous.startsAt !== event.startsAt?.getTime() ||
    previous.endsAt !== event.endsAt?.getTime() ||
    previous.mode !== event.mode ||
    previous.location !== event.location ||
    previous.meetingUrl !== event.meetingUrl ||
    previous.capacity !== event.capacity ||
    previous.registrationRequired !== event.registrationRequired
  ) {
    await notifyUsers(registrations.map(({ student }) => student).filter(Boolean), (student) => ({
      notification: {
        title: "Mise à jour d'un événement",
        message: `Les informations de l'événement "${event.title}" ont changé.`,
        type: "info",
        link: eventLink,
      },
      emailMethod: "sendEventUpdated",
      emailData: { recipientName: student.name, event: getEventEmailData(event) },
    }));
  }
  res.json({ event });
});

// POST /api/events/:id/registrations
export const registerForEvent = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Identifiant d'événement invalide.", 400);
  const current = await Event.findById(req.params.id)
    .select("title description category registrationRequired status startsAt timezone mode location capacity");
  if (!current || current.status !== "published") fail("Événement introuvable.", 404);
  if (!current.registrationRequired) fail("Cet événement ne nécessite pas d'inscription.", 409);
  if (current.startsAt <= new Date()) fail("Les inscriptions à cet événement sont terminées.", 409);

  const existing = await EventRegistration.findOne({ event: current._id, student: req.user._id });
  if (existing?.status === "registered") fail("Vous êtes déjà inscrit à cet événement.", 409);

  const reservedEvent = await Event.findOneAndUpdate(
    {
      _id: current._id,
      status: "published",
      registrationRequired: true,
      startsAt: { $gt: new Date() },
      $expr: { $or: [{ $eq: ["$capacity", null] }, { $lt: ["$registrationCount", "$capacity"] }] },
    },
    { $inc: { registrationCount: 1 } },
    { new: true }
  );
  if (!reservedEvent) fail("Les inscriptions sont closes ou l'événement est complet.", 409);

  let registration;
  try {
    if (existing) {
      registration = await EventRegistration.findOneAndUpdate(
        { _id: existing._id, status: "cancelled" },
        { status: "registered" },
        { new: true }
      );
    } else {
      registration = await EventRegistration.create({ event: current._id, student: req.user._id });
    }
  } catch (error) {
    await Event.findOneAndUpdate(
      { _id: current._id, registrationCount: { $gt: 0 } },
      { $inc: { registrationCount: -1 } }
    );
    if (error?.code === 11000) fail("Vous êtes déjà inscrit à cet événement.", 409);
    throw error;
  }
  if (!registration) {
    await Event.findOneAndUpdate(
      { _id: current._id, registrationCount: { $gt: 0 } },
      { $inc: { registrationCount: -1 } }
    );
    fail("Cette inscription vient d'être modifiée. Actualisez la page.", 409);
  }

  const eventData = getEventEmailData(reservedEvent);
  await notifyUser({
    userId: req.user._id,
    email: req.user.email,
    notification: {
      title: "Votre participation est confirmée",
      message: `Votre participation à l'événement "${reservedEvent.title}" a bien été enregistrée.`,
      type: "success",
      link: `/events/${reservedEvent._id}`,
    },
    emailMethod: "sendEventRegistrationConfirmed",
    emailData: { recipientName: req.user.name, event: eventData },
  });
  await notifyAdmins((admin) => ({
    notification: {
      title: "Nouvelle participation à un événement",
      message: `${req.user.name} vient de participer à l'événement "${reservedEvent.title}".`,
      type: "info",
      link: "/dashboard/admin/events",
    },
    emailMethod: "sendEventRegistrationReceived",
    emailData: {
      adminName: admin.name,
      studentName: req.user.name,
      event: eventData,
    },
  }));
  res.status(201).json({ registration, event: reservedEvent });
});

// GET /api/events/my-registrations — meeting details only for this participant.
export const getMyEventRegistrations = asyncHandler(async (req, res) => {
  const registrations = await EventRegistration.find({ student: req.user._id })
    .populate({
      path: "event",
      select: "title description image category startsAt endsAt timezone mode location meetingUrl capacity registrationRequired status",
    })
    .sort({ createdAt: -1 })
    .lean();
  for (const registration of registrations) {
    if (registration.status !== "registered" && registration.event) {
      delete registration.event.meetingUrl;
    }
  }
  res.json({ registrations });
});

// DELETE /api/events/:id/registrations
export const cancelEventRegistration = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Identifiant d'événement invalide.", 400);
  const event = await Event.findById(req.params.id)
    .select("title description startsAt timezone location _id");
  const registration = await EventRegistration.findOneAndUpdate(
    { event: req.params.id, student: req.user._id, status: "registered" },
    { status: "cancelled" },
    { new: true }
  );
  if (!registration) fail("Inscription active introuvable.", 404);
  if (!event) fail("Événement introuvable.", 404);
  await Event.findOneAndUpdate(
    { _id: registration.event, registrationCount: { $gt: 0 } },
    { $inc: { registrationCount: -1 } }
  );
  const eventData = getEventEmailData(event);
  await notifyUser({
    userId: req.user._id,
    email: req.user.email,
    notification: {
      title: "Participation annulée",
      message: `Votre participation à l'événement "${event.title}" a été annulée.`,
      type: "info",
      link: `/events/${event._id}`,
    },
    emailMethod: "sendEventRegistrationCancelled",
    emailData: { recipientName: req.user.name, event: eventData },
  });
  await notifyAdmins((admin) => ({
    notification: {
      title: "Participation annulée",
      message: `${req.user.name} a annulé sa participation à l'événement "${event.title}".`,
      type: "info",
      link: "/dashboard/admin/events",
    },
    emailMethod: "sendEventRegistrationCancelled",
    emailData: {
      recipientName: admin.name,
      studentName: req.user.name,
      event: eventData,
    },
  }));
  res.json({ message: "Inscription annulée.", registration });
});

// GET /api/events/:id/registrations — admin participant list.
export const getEventRegistrations = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Identifiant d'événement invalide.", 400);
  const event = await Event.findById(req.params.id).select("_id");
  if (!event) fail("Événement introuvable.", 404);
  const registrations = await EventRegistration.find({ event: event._id, status: "registered" })
    .populate("student", "name email university specialty")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ registrations });
});
