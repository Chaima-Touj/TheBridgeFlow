import mongoose from "mongoose";
import Event from "../models/event.model.js";
import EventFeedback from "../models/eventFeedback.model.js";
import EventRegistration from "../models/eventRegistration.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getActiveStudents, notifyAdmins, notifyUser, notifyUsers } from "../services/notification.service.js";
import { processNewsletterJobs } from "../services/newsletter.service.js";
import { isSafeSessionUrl, isSessionLinkAvailable } from "../utils/eventSessionAccess.js";
import { getEventPeriodFilter } from "../utils/eventPeriodFilter.js";

const EVENT_FIELDS = [
  "title", "description", "image", "category", "startsAt", "endsAt",
  "timezone", "mode", "location", "meetingUrl", "capacity",
  "sessionUrl", "registrationRequired", "status",
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
    if (typeof payload.description !== "string" || !payload.description.trim() || payload.description.length > 10000) {
      fail("La description est requise (10 000 caractères maximum).", 400);
    }
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
  const stringLimits = { image: 2048, location: 500, meetingUrl: 2048, sessionUrl: 2048, timezone: 100 };
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
  for (const key of ["image", "meetingUrl", "sessionUrl"]) {
    if (payload[key]) {
      let parsed;
      try { parsed = new URL(payload[key]); } catch { fail(`L'URL ${key} est invalide.`, 400); }
      const allowedProtocols = key === "sessionUrl" ? ["https:"] : ["http:", "https:"];
      if (!allowedProtocols.includes(parsed.protocol) || parsed.username || parsed.password) {
        fail(`L'URL ${key} n'utilise pas un protocole autorisé.`, 400);
      }
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
    mode: event.mode,
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

async function announceAvailableRecording(event) {
  if (!isSessionLinkAvailable(event)) return;

  const eventId = String(event._id);
  const recordingUrl = event.sessionUrl;
  const claimedAt = new Date();
  const staleClaimBefore = new Date(claimedAt.getTime() - 10 * 60 * 1000);
  let claim;
  try {
    claim = await Event.findOneAndUpdate(
      {
        _id: event._id,
        status: "published",
        sessionUrl: recordingUrl,
        recordingAnnouncementSentForUrl: { $ne: recordingUrl },
        $or: [
          { recordingAnnouncementClaimedAt: null },
          { recordingAnnouncementClaimedAt: { $lt: staleClaimBefore } },
        ],
      },
      {
        $set: {
          recordingAnnouncementClaimedForUrl: recordingUrl,
          recordingAnnouncementClaimedAt: claimedAt,
        },
      },
      { new: true },
    ).select("_id");
  } catch (error) {
    console.error("[events] Failed to claim recording announcement", {
      eventId,
      message: error.message,
    });
    return;
  }
  if (!claim) return;

  try {
    const students = await getActiveStudents();
    const studentRecordingUrl = `/events/${eventId}/session`;
    const emailResults = await notifyUsers(students, (student) => ({
      notification: {
        title: "Enregistrement disponible",
        message: `L'enregistrement de l'événement "${event.title}" est maintenant disponible.`,
        type: "info",
        link: studentRecordingUrl,
      },
      emailMethod: "sendEventRecordingAvailable",
      emailData: {
        recipientName: student.name,
        eventTitle: event.title,
        recordingUrl: studentRecordingUrl,
      },
    }));
    if (emailResults.some((result) => result?.success !== true)) {
      throw new Error("Un ou plusieurs emails d'annonce n'ont pas pu être envoyés.");
    }

    const finalized = await Event.updateOne(
      {
        _id: event._id,
        status: "published",
        sessionUrl: recordingUrl,
        recordingAnnouncementClaimedForUrl: recordingUrl,
        recordingAnnouncementClaimedAt: claimedAt,
      },
      {
        $set: { recordingAnnouncementSentForUrl: recordingUrl },
        $unset: {
          recordingAnnouncementClaimedForUrl: 1,
          recordingAnnouncementClaimedAt: 1,
        },
      },
    );
    if (finalized.modifiedCount === 0) {
      console.error("[events] Recording announcement claim was lost before finalization", { eventId });
    }
  } catch (error) {
    console.error("[events] Failed to send recording announcement", {
      eventId,
      message: error.message,
    });
    try {
      await Event.updateOne(
        {
          _id: event._id,
          recordingAnnouncementClaimedForUrl: recordingUrl,
          recordingAnnouncementClaimedAt: claimedAt,
        },
        {
          $unset: {
            recordingAnnouncementClaimedForUrl: 1,
            recordingAnnouncementClaimedAt: 1,
          },
        },
      );
    } catch (releaseError) {
      console.error("[events] Failed to release recording announcement claim", {
        eventId,
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
  const filter = { status: "published", ...getEventPeriodFilter(req.query.period, now) };
  const sortDirection = req.query.period === "past" ? -1 : 1;
  const events = await Event.find(filter).select(`${publicProjection} sessionUrl`).sort({ startsAt: sortDirection }).lean();
  for (const event of events) {
    event.sessionLinkAvailable = isSessionLinkAvailable(event, now);
    event.sessionLinkConfigured = Boolean(event.sessionUrl && isSafeSessionUrl(event.sessionUrl));
    delete event.sessionUrl;
  }
  res.json({ events });
});

// GET /api/events/:id — no private meeting link is returned publicly.
export const getPublicEvent = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Identifiant d'événement invalide.", 400);
  const event = await Event.findOne({ _id: req.params.id, status: { $in: ["published", "cancelled"] } })
    .select(`${publicProjection} sessionUrl`)
    .lean();
  if (!event) fail("Événement introuvable.", 404);
  event.sessionLinkAvailable = isSessionLinkAvailable(event);
  event.sessionLinkConfigured = Boolean(event.sessionUrl && isSafeSessionUrl(event.sessionUrl));
  delete event.sessionUrl;
  res.json({ event });
});

// GET /api/events/admin
export const getAdminEvents = asyncHandler(async (req, res) => {
  const events = await Event.find().sort({ startsAt: 1 }).lean();
  res.json({ events });
});

// DELETE /api/events/:id — admin uniquement
export const deleteEvent = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Identifiant d'événement invalide.", 400);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const event = await Event.findById(req.params.id).session(session);
      if (!event) fail("Événement introuvable.", 404);
      await EventRegistration.deleteMany({ event: event._id }, { session });
      await event.deleteOne({ session });
    });
  } catch (error) {
    if (error.code === 20 && /transaction numbers are only allowed/i.test(error.message)) {
      error.statusCode = 503;
      error.message = "La suppression atomique nécessite un MongoDB configuré en replica set. Aucune donnée n'a été supprimée.";
    }
    throw error;
  } finally {
    await session.endSession();
  }
  res.json({ message: "Événement supprimé." });
});

// POST /api/events
export const createEvent = asyncHandler(async (req, res) => {
  const payload = validateEventPayload(req.body);
  const event = await Event.create({
    ...payload,
    createdBy: req.user._id,
    ...(payload.status === "published" ? { newsletterCampaignEligibleAt: new Date() } : {}),
  });
  if (event.status === "published") await announcePublishedEvent(event);
  if (event.status === "published") void processNewsletterJobs();
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
    newsletterCampaignEligibleAt: event.newsletterCampaignEligibleAt,
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
  if (
    previous.status !== "published" &&
    event.status === "published" &&
    !previous.newsletterCampaignEligibleAt &&
    !event.newsletterCampaignSentAt
  ) {
    event.newsletterCampaignEligibleAt = new Date();
  }
  if (event.capacity !== null && event.capacity < event.registrationCount) {
    fail("La capacité ne peut pas être inférieure au nombre d'inscriptions actives.", 409);
  }
  await event.save();

  const reminderScheduleChanged = previous.startsAt !== event.startsAt?.getTime();
  const previousEndAt = previous.endsAt ?? previous.startsAt;
  const nextEndAt = event.endsAt?.getTime() ?? event.startsAt?.getTime();
  const feedbackScheduleChanged = previousEndAt !== nextEndAt;
  if (reminderScheduleChanged || feedbackScheduleChanged) {
    const resetFields = {};
    const removeFields = {};
    if (reminderScheduleChanged) {
      Object.assign(resetFields, { reminderAttempts: 0, reminder6hAttempts: 0 });
      Object.assign(removeFields, {
        reminderSentForStartAt: 1,
        reminder6hSentForStartAt: 1,
        reminderNextAttemptAt: 1,
        reminder6hNextAttemptAt: 1,
        reminderClaimedForStartAt: 1,
        reminderClaimedAt: 1,
        reminderClaimedKind: 1,
      });
    }
    if (feedbackScheduleChanged) {
      resetFields.feedbackEmailAttempts = 0;
      Object.assign(removeFields, {
        feedbackEmailSentForEndAt: 1,
        feedbackEmailNextAttemptAt: 1,
        feedbackEmailClaimedForEndAt: 1,
        feedbackEmailClaimedAt: 1,
      });
    }
    await EventRegistration.updateMany(
      { event: event._id, status: "registered" },
      { $set: resetFields, $unset: removeFields },
    );
  }

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
  if (
    event.status === "published" &&
    event.sessionUrl &&
    event.recordingAnnouncementSentForUrl !== event.sessionUrl
  ) {
    await announceAvailableRecording(event);
  }
  if (event.status === "published" && event.newsletterCampaignEligibleAt && !event.newsletterCampaignSentAt) {
    void processNewsletterJobs();
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

function getEventIdOrFail(value) {
  if (!mongoose.Types.ObjectId.isValid(value)) fail("Identifiant d'événement invalide.", 400);
}

function feedbackImageOrFail(image) {
  if (image === undefined || image === "") return "";
  if (
    typeof image !== "string" ||
    image.length > 1_000_000 ||
    !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)
  ) {
    fail("La photo doit être une image valide de taille raisonnable.", 400);
  }
  return image;
}

// GET /api/events/:id/feedbacks — public feedbacks approved by an admin.
export const getPublishedEventFeedbacks = asyncHandler(async (req, res) => {
  getEventIdOrFail(req.params.id);
  const event = await Event.findOne({ _id: req.params.id, status: "published" }).select("_id");
  if (!event) fail("Événement introuvable.", 404);
  const feedbacks = await EventFeedback.find({ event: event._id, isPublished: true })
    .select("firstName lastName comment rating image createdAt publishedAt")
    .sort({ publishedAt: -1, createdAt: -1 })
    .lean();
  res.json({ feedbacks });
});

// GET /api/events/:id/my-feedback — registration-scoped feedback status.
export const getMyEventFeedback = asyncHandler(async (req, res) => {
  getEventIdOrFail(req.params.id);
  const registration = await EventRegistration.findOne({
    event: req.params.id,
    student: req.user._id,
    status: "registered",
  }).select("_id");
  if (!registration) fail("Seuls les participants inscrits peuvent envoyer un avis.", 403);
  const feedback = await EventFeedback.findOne({
    event: req.params.id,
    student: req.user._id,
  }).select("_id isPublished");
  res.json({ feedback });
});

// POST /api/events/:id/feedbacks — one review per registered student/event.
export const createEventFeedback = asyncHandler(async (req, res) => {
  getEventIdOrFail(req.params.id);
  const event = await Event.findOne({ _id: req.params.id, status: "published" })
    .select("_id startsAt endsAt");
  if (!event) fail("Événement introuvable.", 404);
  if (new Date(event.endsAt || event.startsAt) > new Date()) {
    fail("Vous pourrez envoyer votre avis après la fin de l'événement.", 409);
  }
  const registration = await EventRegistration.findOne({
    event: event._id,
    student: req.user._id,
    status: "registered",
  }).select("_id");
  if (!registration) fail("Seuls les participants inscrits peuvent envoyer un avis.", 403);

  const firstName = typeof req.body.firstName === "string" ? req.body.firstName.trim() : "";
  const lastName = typeof req.body.lastName === "string" ? req.body.lastName.trim() : "";
  const comment = typeof req.body.comment === "string" ? req.body.comment.trim() : "";
  const rating = Number(req.body.rating);
  if (!firstName || firstName.length > 80) fail("Le prénom est requis (80 caractères maximum).", 400);
  if (!lastName || lastName.length > 80) fail("Le nom est requis (80 caractères maximum).", 400);
  if (!comment || comment.length > 2000) fail("Le commentaire est requis (2 000 caractères maximum).", 400);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail("La note doit être comprise entre 1 et 5.", 400);

  try {
    const feedback = await EventFeedback.create({
      event: event._id,
      student: req.user._id,
      firstName,
      lastName,
      comment,
      rating,
      image: feedbackImageOrFail(req.body.image),
    });
    res.status(201).json({ feedback });
  } catch (error) {
    if (error?.code === 11000) fail("Vous avez déjà envoyé votre avis pour cet événement.", 409);
    throw error;
  }
});

// GET /api/events/feedbacks/admin — completed events and their reviews.
export const getAdminEventFeedbacks = asyncHandler(async (_req, res) => {
  const now = new Date();
  const events = await Event.find({
    status: { $in: ["published", "archived"] },
    $expr: { $lte: [{ $ifNull: ["$endsAt", "$startsAt"] }, now] },
  })
    .select("title startsAt endsAt timezone status mode location")
    .sort({ startsAt: -1 })
    .lean();
  const eventIds = events.map((event) => event._id);
  const feedbacks = eventIds.length ? await EventFeedback.find({ event: { $in: eventIds } })
    .populate("event", "title startsAt endsAt status")
    .populate("student", "name")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean() : [];
  res.json({ events, feedbacks });
});

// PATCH /api/events/feedbacks/:feedbackId/publication — admin publication control.
export const setEventFeedbackPublication = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.feedbackId)) fail("Identifiant d'avis invalide.", 400);
  if (typeof req.body.isPublished !== "boolean") fail("isPublished doit être un booléen.", 400);
  const feedback = await EventFeedback.findById(req.params.feedbackId).populate("event", "status");
  if (!feedback) fail("Avis introuvable.", 404);
  if (req.body.isPublished && feedback.event?.status !== "published") {
    fail("Un avis ne peut pas être publié pour un événement indisponible.", 409);
  }
  feedback.isPublished = req.body.isPublished;
  feedback.publishedAt = req.body.isPublished ? new Date() : null;
  await feedback.save();
  res.json({ feedback });
});

export const getEventSessionLink = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) fail("Identifiant d'événement invalide.", 400);
    const event = await Event.findOne({ _id: req.params.id, status: "published" })
      .select(`${publicProjection} sessionUrl`)
    .lean();
  if (!event) fail("Événement introuvable.", 404);
    if (!isSessionLinkAvailable(event)) fail("L'enregistrement sera disponible après la fin de l'événement.", 403);
  if (!event.sessionUrl) fail("Le lien de séance n'est pas encore renseigné.", 404);
  if (!isSafeSessionUrl(event.sessionUrl)) fail("Le lien de séance configuré n'est pas sécurisé.", 500);
    const sessionUrl = event.sessionUrl;
    delete event.sessionUrl;
    res.set("Cache-Control", "no-store").json({ sessionUrl, event });
});
