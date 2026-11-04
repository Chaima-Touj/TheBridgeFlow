import Event from "../models/event.model.js";
import EventRegistration from "../models/eventRegistration.model.js";
import emailService from "./email.service.js";

const WORK_INTERVAL_MS = 60_000;
const CLAIM_LEASE_MS = 5 * 60_000;
const MAX_ATTEMPTS = 8;
const BATCH_SIZE = 100;
let workerTimer;
let workerRunning = false;

const eventEmailData = (event) => ({
  eventTitle: event.title,
  description: event.description,
  startsAt: event.startsAt,
  timezone: event.timezone,
  location: event.location,
  eventId: String(event._id),
});

async function sendEventReminders() {
  const now = new Date();
  const dueBefore = new Date(now.getTime() + 24 * 60 * 60_000);
  const events = await Event.find({
    status: "published",
    startsAt: { $gt: now, $lte: dueBefore },
  }).select("_id title description startsAt timezone location").sort({ startsAt: 1 }).lean();

  for (const event of events) {
    for (let index = 0; index < BATCH_SIZE; index += 1) {
      const claimTime = new Date();
      const staleClaimBefore = new Date(claimTime.getTime() - CLAIM_LEASE_MS);
      const registration = await EventRegistration.findOneAndUpdate(
        {
          event: event._id,
          status: "registered",
          reminderSentForStartAt: { $ne: event.startsAt },
          $and: [
            { $or: [{ reminderNextAttemptAt: null }, { reminderNextAttemptAt: { $lte: claimTime } }] },
            { $or: [{ reminderClaimedAt: null }, { reminderClaimedAt: { $lt: staleClaimBefore } }] },
            { $or: [{ reminderAttempts: { $lt: MAX_ATTEMPTS } }, { reminderAttempts: null }] },
          ],
        },
        {
          $set: {
            reminderClaimedForStartAt: event.startsAt,
            reminderClaimedAt: claimTime,
          },
          $inc: { reminderAttempts: 1 },
        },
        { new: true, sort: { _id: 1 } },
      ).populate("student", "name email").lean();

      if (!registration) break;

      try {
        if (!registration.student?.email) {
          throw new Error("Registered student has no email address.");
        }
        const result = await emailService.sendEventReminder(registration.student.email, {
          recipientName: registration.student.name,
          event: eventEmailData(event),
        });
        if (!result?.success) throw new Error(result?.error || "Email service did not confirm delivery.");

        await EventRegistration.updateOne(
          {
            _id: registration._id,
            reminderClaimedAt: claimTime,
            reminderClaimedForStartAt: event.startsAt,
          },
          {
            $set: { reminderSentForStartAt: event.startsAt },
            $unset: {
              reminderClaimedForStartAt: 1,
              reminderClaimedAt: 1,
              reminderNextAttemptAt: 1,
            },
          },
        );
      } catch (error) {
        const attemptNumber = Number(registration.reminderAttempts) || 1;
        const backoffMs = Math.min(60 * 60_000, 60_000 * (2 ** Math.min(attemptNumber, 6)));
        await EventRegistration.updateOne(
          {
            _id: registration._id,
            reminderClaimedAt: claimTime,
            reminderClaimedForStartAt: event.startsAt,
          },
          {
            $set: { reminderNextAttemptAt: new Date(Date.now() + backoffMs) },
            $unset: { reminderClaimedForStartAt: 1, reminderClaimedAt: 1 },
          },
        );
        console.error("[event-reminder] Failed to send event reminder", {
          eventId: String(event._id),
          registrationId: String(registration._id),
          attempt: attemptNumber,
          message: error.message,
        });
      }
    }
  }
}

export async function processEventReminders() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    await sendEventReminders();
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
