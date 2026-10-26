import Event from "../models/event.model.js";
import News from "../models/news.model.js";
import NewsletterDelivery from "../models/newsletterDelivery.model.js";
import NewsletterSubscriber from "../models/newsletterSubscriber.model.js";
import Notification from "../models/notification.model.js";
import User from "../models/users.model.js";
import emailService from "./email.service.js";
import { decryptUnsubscribeToken, encryptUnsubscribeToken } from "../utils/newsletterToken.js";

const MAX_ATTEMPTS = 8;
const BATCH_SIZE = 250;
const WORK_INTERVAL_MS = 60_000;
const LEASE_MS = 5 * 60_000;
let workerTimer;
let workerRunning = false;

const logFailure = (stage, error, details = {}) => {
  console.error("[newsletter] Delivery workflow failed", {
    stage,
    message: error.message,
    ...details,
  });
};

const getClientBaseUrl = () => (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");

function assertEmailSuccess(result) {
  if (!result?.success) throw new Error(result?.error || "Email service did not confirm delivery.");
  return true;
}

async function queueSubscriptionMessages(subscriber, token, version) {
  if (token) {
    const encryptedToken = encryptUnsubscribeToken(token);
    await NewsletterDelivery.updateOne(
      { deliveryKey: `welcome:${subscriber._id}:${version}` },
      {
        $setOnInsert: {
          deliveryKey: `welcome:${subscriber._id}:${version}`,
          kind: "welcome",
          recipientEmail: subscriber.email,
          language: subscriber.language,
          subscriber: subscriber._id,
          subscriptionVersion: version,
          ...encryptedToken,
        },
      },
      { upsert: true }
    );
  }

  const admins = await User.find({
    role: "admin",
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  }).select("_id name email").lean();
  if (!admins.length) {
    logFailure("admin-notification", new Error("No active administrator accounts were found."), {
      subscriberId: String(subscriber._id),
    });
    return;
  }

  const emailAdmins = admins.filter(({ email }) => email);
  const adminEmailDeliveries = emailAdmins.map((admin) => ({
    updateOne: {
      filter: { deliveryKey: `admin:${subscriber._id}:${version}:${admin._id}` },
      update: {
        $setOnInsert: {
          deliveryKey: `admin:${subscriber._id}:${version}:${admin._id}`,
          kind: "admin",
          recipientEmail: admin.email.toLowerCase(),
          recipientName: admin.name || "",
          language: subscriber.language,
          subscriber: subscriber._id,
          sourceId: subscriber._id,
        },
      },
      upsert: true,
    },
  }));
  let result = null;
  if (adminEmailDeliveries.length) {
    result = await NewsletterDelivery.bulkWrite(adminEmailDeliveries, { ordered: false });
  }
  const newDeliveryIndices = new Set(Object.keys(result?.upsertedIds || {}).map(Number));
  const notificationAdmins = emailAdmins.filter((_, index) => newDeliveryIndices.has(index));
  const notificationDocs = notificationAdmins.map((admin) => ({
    userId: admin._id,
    title: "Nouvel abonné à la newsletter",
    message: `${subscriber.email} s'est abonné à la newsletter.`,
    type: "info",
    link: "/dashboard/admin/newsletter",
  }));
  try {
    if (notificationDocs.length) await Notification.insertMany(notificationDocs);
  } catch (error) {
    logFailure("admin-notification", error, { subscriberId: String(subscriber._id) });
  }
}

async function loadPublication(sourceType, sourceId) {
  if (sourceType === "event") {
    const event = await Event.findById(sourceId).select("title description status").lean();
    if (!event || event.status !== "published") return null;
    return {
      title: event.title,
      excerpt: event.description,
      url: `${getClientBaseUrl()}/events/${event._id}`,
    };
  }
  const news = await News.findOne({
    _id: sourceId,
    $or: [{ status: "published" }, { status: { $exists: false } }],
  }).select("title excerpt status").lean();
  if (!news) return null;
  return {
    title: news.title,
    excerpt: news.excerpt,
    url: `${getClientBaseUrl()}/blog/${news._id}`,
  };
}

async function sendDelivery(delivery) {
  if (delivery.kind === "welcome") {
    const subscriber = await NewsletterSubscriber.findOne({
      _id: delivery.subscriber,
      subscribed: true,
      subscriptionVersion: delivery.subscriptionVersion,
    }).select("_id").lean();
    if (!subscriber) return null;
    const token = decryptUnsubscribeToken(delivery);
    const result = await emailService.sendNewsletterWelcome(delivery.recipientEmail, {
      language: delivery.language,
      unsubscribeUrl: `${getClientBaseUrl()}/newsletter/unsubscribe/${encodeURIComponent(token)}`,
    });
    return assertEmailSuccess(result);
  }
  if (delivery.kind === "admin") {
    const subscriber = await NewsletterSubscriber.findById(delivery.sourceId).select("email").lean();
    if (!subscriber) return true;
    const result = await emailService.sendNewsletterAdmin(delivery.recipientEmail, {
      language: delivery.language,
      subscriberEmail: subscriber.email,
    });
    return assertEmailSuccess(result);
  }
  const subscriber = await NewsletterSubscriber.findOne({ _id: delivery.subscriber, subscribed: true })
    .select("_id +encryptedUnsubscribeToken +unsubscribeTokenIv +unsubscribeTokenAuthTag")
    .lean();
  if (!subscriber) return null;
  const publication = await loadPublication(delivery.sourceType, delivery.sourceId);
  if (!publication) return null;
  const unsubscribeToken = decryptUnsubscribeToken({
    encryptedToken: subscriber.encryptedUnsubscribeToken,
    tokenIv: subscriber.unsubscribeTokenIv,
    tokenAuthTag: subscriber.unsubscribeTokenAuthTag,
  });
  const result = await emailService.sendNewsletterPublication(delivery.recipientEmail, {
    language: delivery.language,
    unsubscribeUrl: `${getClientBaseUrl()}/newsletter/unsubscribe/${encodeURIComponent(unsubscribeToken)}`,
    ...publication,
  });
  return assertEmailSuccess(result);
}

async function claimNextDelivery() {
  const now = new Date();
  const staleClaimBefore = new Date(now.getTime() - LEASE_MS);
  return NewsletterDelivery.findOneAndUpdate(
    {
      attempts: { $lt: MAX_ATTEMPTS },
      $or: [
        { status: "pending", nextAttemptAt: { $lte: now } },
        { status: "sending", claimedAt: { $lt: staleClaimBefore } },
      ],
    },
    { $set: { status: "sending", claimedAt: now }, $inc: { attempts: 1 } },
    { new: true, sort: { nextAttemptAt: 1 } }
  ).select("+encryptedToken +tokenIv +tokenAuthTag");
}

async function processDeliveries() {
  for (let index = 0; index < 50; index += 1) {
    const delivery = await claimNextDelivery();
    if (!delivery) return;
    try {
      const sent = await sendDelivery(delivery);
      if (sent === null) {
        await NewsletterDelivery.updateOne(
          { _id: delivery._id, status: "sending" },
          { $set: { status: "skipped", sentAt: new Date() }, $unset: { encryptedToken: 1, tokenIv: 1, tokenAuthTag: 1 } }
        );
      } else if (sent) {
        await NewsletterDelivery.updateOne(
          { _id: delivery._id, status: "sending" },
          { $set: { status: "sent", sentAt: new Date(), lastError: "" }, $unset: { encryptedToken: 1, tokenIv: 1, tokenAuthTag: 1 } }
        );
      }
    } catch (error) {
      const terminal = delivery.attempts >= MAX_ATTEMPTS;
      const backoffMs = Math.min(60 * 60_000, 60_000 * (2 ** Math.min(delivery.attempts - 1, 6)));
      await NewsletterDelivery.updateOne(
        { _id: delivery._id, status: "sending" },
        {
          $set: {
            status: terminal ? "failed" : "pending",
            nextAttemptAt: new Date(Date.now() + backoffMs),
            lastError: String(error.message).slice(0, 500),
          },
          $unset: { claimedAt: 1 },
        }
      );
      logFailure("send", error, { deliveryId: String(delivery._id), kind: delivery.kind });
    }
  }
}

export async function queuePublishedCampaign(sourceType, sourceId) {
  const Model = sourceType === "event" ? Event : News;
  const now = new Date();
  const staleClaimBefore = new Date(now.getTime() - LEASE_MS);
  const claim = await Model.findOneAndUpdate(
    {
      _id: sourceId,
      status: "published",
      newsletterCampaignEligibleAt: { $ne: null },
      newsletterCampaignSentAt: null,
      $or: [
        { newsletterCampaignClaimedAt: null },
        { newsletterCampaignClaimedAt: { $lt: staleClaimBefore } },
      ],
    },
    { $set: { newsletterCampaignClaimedAt: now } },
    { new: true }
  ).select("_id newsletterCampaignEligibleAt");
  if (!claim) return;

  try {
    let lastId = null;
    while (true) {
      const filter = {
        subscribed: true,
        subscribedAt: { $lte: claim.newsletterCampaignEligibleAt },
      };
      if (lastId) filter._id = { $gt: lastId };
      const subscribers = await NewsletterSubscriber.find(filter)
        .select("_id email language")
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .lean();
      if (!subscribers.length) break;
      await NewsletterDelivery.bulkWrite(subscribers.map((subscriber) => ({
        updateOne: {
          filter: { deliveryKey: `${sourceType}:${sourceId}:${subscriber._id}` },
          update: {
            $setOnInsert: {
              deliveryKey: `${sourceType}:${sourceId}:${subscriber._id}`,
              kind: "publication",
              recipientEmail: subscriber.email,
              language: subscriber.language,
              subscriber: subscriber._id,
              sourceType,
              sourceId,
            },
          },
          upsert: true,
        },
      })), { ordered: false });
      lastId = subscribers[subscribers.length - 1]._id;
      if (subscribers.length < BATCH_SIZE) break;
    }
    await Model.updateOne(
      { _id: sourceId, newsletterCampaignClaimedAt: now },
      { $set: { newsletterCampaignSentAt: new Date() }, $unset: { newsletterCampaignClaimedAt: 1 } }
    );
  } catch (error) {
    await Model.updateOne(
      { _id: sourceId, newsletterCampaignClaimedAt: now },
      { $unset: { newsletterCampaignClaimedAt: 1 } }
    );
    logFailure("queue-publication", error, { sourceType, sourceId: String(sourceId) });
    throw error;
  }
}

async function queueEligiblePublications() {
  const [events, news] = await Promise.all([
    Event.find({
      status: "published",
      newsletterCampaignEligibleAt: { $ne: null },
      newsletterCampaignSentAt: null,
    }).select("_id").limit(50).lean(),
    News.find({
      status: "published",
      newsletterCampaignEligibleAt: { $ne: null },
      newsletterCampaignSentAt: null,
    }).select("_id").limit(50).lean(),
  ]);
  for (const event of events) await queuePublishedCampaign("event", event._id);
  for (const article of news) await queuePublishedCampaign("news", article._id);
}

export async function processNewsletterJobs() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    await queueEligiblePublications();
    await processDeliveries();
  } catch (error) {
    logFailure("worker", error);
  } finally {
    workerRunning = false;
  }
}

export function startNewsletterWorker() {
  if (workerTimer) return;
  void processNewsletterJobs();
  workerTimer = setInterval(() => void processNewsletterJobs(), WORK_INTERVAL_MS);
  workerTimer.unref?.();
}

export async function queueSubscriberEmails(subscriber, token, version) {
  await queueSubscriptionMessages(subscriber, token, version);
  const subscriberId = String(subscriber._id);
  await NewsletterDelivery.updateMany(
    {
      status: "failed",
      $or: [
        { deliveryKey: `welcome:${subscriberId}:${version}` },
        { deliveryKey: { $regex: `^admin:${subscriberId}:${version}:` } },
      ],
    },
    {
      $set: { status: "pending", attempts: 0, nextAttemptAt: new Date(), lastError: "" },
      $unset: { claimedAt: 1 },
    }
  );
  void processNewsletterJobs();
}
