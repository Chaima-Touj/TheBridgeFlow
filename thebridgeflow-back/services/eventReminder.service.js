import Event from "../models/event.model.js";
import EventFeedback from "../models/eventFeedback.model.js";
import EventRegistration from "../models/eventRegistration.model.js";
import emailService from "./email.service.js";

const WORK_INTERVAL_MS = 60_000;
const CLAIM_LEASE_MS = 5 * 60_000;
const MAX_ATTEMPTS = 8;
const BATCH_SIZE = 100;
const SIX_HOURS_MS = 6 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
let workerTimer;
let workerRunning = false;

const REMINDER_FIELDS = {
  "24h": {
    sent: "reminderSentForStartAt",
    nextAttempt: "reminderNextAttemptAt",
    attempts: "reminderAttempts",
  },
  "6h": {
    sent: "reminder6hSentForStartAt",
    nextAttempt: "reminder6hNextAttemptAt",
    attempts: "reminder6hAttempts",
  },
};

const eventEmailData = (event) => ({
  eventTitle: event.title,
  description: event.description,
  startsAt: event.startsAt,
  timezone: event.timezone,
  location: event.location,
  mode: event.mode,
  meetingUrl: event.meetingUrl,
  eventId: String(event._id),
});

function retryDelay(attempt) {
  return Math.min(60 * 60_000, 60_000 * (2 ** Math.min(attempt, 6)));
}

async function sendReminderBatch(event, kind) {
  const fields = REMINDER_FIELDS[kind];
  for (let index = 0; index < BATCH_SIZE; index += 1) {
    const claimTime = new Date();
    const staleClaimBefore = new Date(claimTime.getTime() - CLAIM_LEASE_MS);
    const registration = await EventRegistration.findOneAndUpdate(
      {
        event: event._id,
        status: "registered",
        [fields.sent]: { $ne: event.startsAt },
        $and: [
          { $or: [{ [fields.nextAttempt]: null }, { [fields.nextAttempt]: { $lte: claimTime } }] },
          { $or: [{ reminderClaimedAt: null }, { reminderClaimedAt: { $lt: staleClaimBefore } }] },
          { $or: [{ [fields.attempts]: { $lt: MAX_ATTEMPTS } }, { [fields.attempts]: null }] },
        ],
      },
      {
        $set: {
          reminderClaimedForStartAt: event.startsAt,
          reminderClaimedAt: claimTime,
          reminderClaimedKind: kind,
        },
        $inc: { [fields.attempts]: 1 },
      },
      { new: true, sort: { _id: 1 } },
    ).populate("student", "name email").lean();

    if (!registration) break;

    try {
      if (!registration.student?.email) throw new Error("Registered student has no email address.");
      const result = await emailService.sendEventReminder(registration.student.email, {
        recipientName: registration.student.name,
        event: eventEmailData(event),
        reminderHours: kind === "6h" ? 6 : 24,
      });
      if (!result?.success) throw new Error(result?.error || "Email service did not confirm delivery.");

      await EventRegistration.updateOne(
        {
          _id: registration._id,
          reminderClaimedAt: claimTime,
          reminderClaimedForStartAt: event.startsAt,
          reminderClaimedKind: kind,
        },
        {
          $set: { [fields.sent]: event.startsAt },
          $unset: {
            reminderClaimedForStartAt: 1,
            reminderClaimedAt: 1,
            reminderClaimedKind: 1,
            [fields.nextAttempt]: 1,
          },
        },
      );
    } catch (error) {
      const attemptNumber = Number(registration[fields.attempts]) || 1;
      await EventRegistration.updateOne(
        {
          _id: registration._id,
          reminderClaimedAt: claimTime,
          reminderClaimedForStartAt: event.startsAt,
          reminderClaimedKind: kind,
        },
        {
          $set: { [fields.nextAttempt]: new Date(Date.now() + retryDelay(attemptNumber)) },
          $unset: {
            reminderClaimedForStartAt: 1,
            reminderClaimedAt: 1,
            reminderClaimedKind: 1,
          },
        },
      );
      console.error("[event-reminder] Failed to send event reminder", {
        eventId: String(event._id),
        registrationId: String(registration._id),
        kind,
        attempt: attemptNumber,
        message: error.message,
      });
    }
  }
}

async function sendEventReminders() {
  const now = new Date();
  const dueBefore = new Date(now.getTime() + DAY_MS);
  const events = await Event.find({
    status: "published",
    startsAt: { $gt: now, $lte: dueBefore },
  }).select("_id title description startsAt timezone location mode meetingUrl").sort({ startsAt: 1 }).lean();

  for (const event of events) {
    const kind = event.startsAt.getTime() - now.getTime() <= SIX_HOURS_MS ? "6h" : "24h";
    await sendReminderBatch(event, kind);
  }
}

async function sendFeedbackRequestBatch(event, endAt) {
  for (let index = 0; index < BATCH_SIZE; index += 1) {
    const claimTime = new Date();
    const staleClaimBefore = new Date(claimTime.getTime() - CLAIM_LEASE_MS);
    const registration = await EventRegistration.findOneAndUpdate(
      {
        event: event._id,
        status: "registered",
        feedbackEmailSentForEndAt: { $ne: endAt },
        $and: [
          { $or: [{ feedbackEmailNextAttemptAt: null }, { feedbackEmailNextAttemptAt: { $lte: claimTime } }] },
          { $or: [{ feedbackEmailClaimedAt: null }, { feedbackEmailClaimedAt: { $lt: staleClaimBefore } }] },
          { $or: [{ feedbackEmailAttempts: { $lt: MAX_ATTEMPTS } }, { feedbackEmailAttempts: null }] },
        ],
      },
      {
        $set: {
          feedbackEmailClaimedForEndAt: endAt,
          feedbackEmailClaimedAt: claimTime,
        },
        $inc: { feedbackEmailAttempts: 1 },
      },
      { new: true, sort: { _id: 1 } },
    ).populate("student", "name email").lean();

    if (!registration) break;

    try {
      const submitted = await EventFeedback.exists({
        event: event._id,
        student: registration.student?._id,
      });
      if (submitted) {
        await EventRegistration.updateOne(
          { _id: registration._id, feedbackEmailClaimedAt: claimTime, feedbackEmailClaimedForEndAt: endAt },
          {
            $set: { feedbackEmailSentForEndAt: endAt },
            $unset: {
              feedbackEmailClaimedForEndAt: 1,
              feedbackEmailClaimedAt: 1,
              feedbackEmailNextAttemptAt: 1,
            },
          },
        );
        continue;
      }
      if (!registration.student?.email) throw new Error("Registered student has no email address.");

      const baseUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");
      const feedbackUrl = `${baseUrl}/events/${encodeURIComponent(String(event._id))}?feedback=1`;
      const result = await emailService.sendEventFeedbackRequest(registration.student.email, {
        recipientName: registration.student.name,
        event: eventEmailData(event),
        feedbackUrl,
      });
      if (!result?.success) throw new Error(result?.error || "Email service did not confirm delivery.");

      await EventRegistration.updateOne(
        { _id: registration._id, feedbackEmailClaimedAt: claimTime, feedbackEmailClaimedForEndAt: endAt },
        {
          $set: { feedbackEmailSentForEndAt: endAt },
          $unset: {
            feedbackEmailClaimedForEndAt: 1,
            feedbackEmailClaimedAt: 1,
            feedbackEmailNextAttemptAt: 1,
          },
        },
      );
    } catch (error) {
      const attemptNumber = Number(registration.feedbackEmailAttempts) || 1;
      await EventRegistration.updateOne(
        { _id: registration._id, feedbackEmailClaimedAt: claimTime, feedbackEmailClaimedForEndAt: endAt },
        {
          $set: { feedbackEmailNextAttemptAt: new Date(Date.now() + retryDelay(attemptNumber)) },
          $unset: { feedbackEmailClaimedForEndAt: 1, feedbackEmailClaimedAt: 1 },
        },
      );
      console.error("[event-feedback-email] Failed to send feedback request", {
        eventId: String(event._id),
        registrationId: String(registration._id),
        attempt: attemptNumber,
        message: error.message,
      });
    }
  }
}

async function sendEventFeedbackRequests() {
  const now = new Date();
  const events = await Event.find({
    status: "published",
    $expr: { $lte: [{ $ifNull: ["$endsAt", "$startsAt"] }, now] },
  }).select("_id title description startsAt endsAt timezone location mode meetingUrl").sort({ startsAt: 1 }).lean();

  for (const event of events) {
    await sendFeedbackRequestBatch(event, event.endsAt || event.startsAt);
  }
}

export async function processEventReminders() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    await sendEventReminders();
    await sendEventFeedbackRequests();
  } catch (error) {
    console.error("[event-reminder] Reminder worker failed", { message: error.message });
  } finally {
    workerRunning = false;
  }
}

export function startEventReminderWorker() {
  if (workerTimer) return;
  void processEventReminders();
  workerTimer = setInterval(() => void processEventReminders(), WORK_INTERVAL_MS);
  workerTimer.unref?.();
}
