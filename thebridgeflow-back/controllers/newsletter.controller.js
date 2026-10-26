import NewsletterDelivery from "../models/newsletterDelivery.model.js";
import NewsletterSubscriber from "../models/newsletterSubscriber.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  createUnsubscribeToken,
  encryptUnsubscribeToken,
  hashUnsubscribeToken,
  normalizeNewsletterEmail,
  normalizeNewsletterLanguage,
} from "../utils/newsletterToken.js";
import { queueSubscriberEmails } from "../services/newsletter.service.js";

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
};

const messages = {
  fr: {
    subscribed: "Votre inscription à la newsletter est confirmée.",
    resubscribed: "Votre réabonnement est confirmé.",
    alreadySubscribed: "Cette adresse est déjà abonnée.",
    invalidEmail: "Veuillez saisir une adresse email valide.",
    invalidToken: "Le lien de désabonnement n'est plus valide.",
    unsubscribed: "Votre désabonnement est confirmé.",
    alreadyUnsubscribed: "Ce lien a déjà été utilisé ou n'est plus valide.",
  },
  en: {
    subscribed: "Your newsletter subscription is confirmed.",
    resubscribed: "Your subscription has been reactivated.",
    alreadySubscribed: "This email address is already subscribed.",
    invalidEmail: "Please enter a valid email address.",
    invalidToken: "This unsubscribe link is no longer valid.",
    unsubscribed: "You have been unsubscribed.",
    alreadyUnsubscribed: "This link has already been used or is no longer valid.",
  },
  ar: {
    subscribed: "تم تأكيد اشتراكك في النشرة.",
    resubscribed: "تمت إعادة تفعيل اشتراكك.",
    alreadySubscribed: "هذا البريد الإلكتروني مشترك بالفعل.",
    invalidEmail: "يرجى إدخال عنوان بريد إلكتروني صالح.",
    invalidToken: "لم يعد رابط إلغاء الاشتراك صالحًا.",
    unsubscribed: "تم إلغاء اشتراكك.",
    alreadyUnsubscribed: "تم استخدام هذا الرابط أو لم يعد صالحًا.",
  },
};

const messageFor = (language, key) => messages[language]?.[key] || messages.fr[key];

async function subscribeExisting(subscriber, language) {
  if (!subscriber.subscribed) {
    const token = createUnsubscribeToken();
    subscriber.subscribed = true;
    subscriber.language = language;
    subscriber.unsubscribeTokenHash = hashUnsubscribeToken(token);
    const encrypted = encryptUnsubscribeToken(token);
    subscriber.encryptedUnsubscribeToken = encrypted.encryptedToken;
    subscriber.unsubscribeTokenIv = encrypted.tokenIv;
    subscriber.unsubscribeTokenAuthTag = encrypted.tokenAuthTag;
    subscriber.subscriptionVersion += 1;
    subscriber.subscribedAt = new Date();
    subscriber.unsubscribedAt = null;
    await subscriber.save();
    await queueSubscriberEmails(subscriber, token, subscriber.subscriptionVersion);
    return { message: messageFor(language, "resubscribed"), alreadySubscribed: false };
  }

  const welcomeKey = `welcome:${subscriber._id}:${subscriber.subscriptionVersion}`;
  const welcomeExists = await NewsletterDelivery.exists({ deliveryKey: welcomeKey });
  let token = null;
  if (!welcomeExists) {
    token = createUnsubscribeToken();
    subscriber.unsubscribeTokenHash = hashUnsubscribeToken(token);
    const encrypted = encryptUnsubscribeToken(token);
    subscriber.encryptedUnsubscribeToken = encrypted.encryptedToken;
    subscriber.unsubscribeTokenIv = encrypted.tokenIv;
    subscriber.unsubscribeTokenAuthTag = encrypted.tokenAuthTag;
    await subscriber.save();
  }
  await queueSubscriberEmails(subscriber, token, subscriber.subscriptionVersion);
  return { message: messageFor(language, "alreadySubscribed"), alreadySubscribed: true };
}

export const subscribeToNewsletter = asyncHandler(async (req, res) => {
  const email = normalizeNewsletterEmail(req.body?.email);
  const language = normalizeNewsletterLanguage(req.body?.language);
  if (!email) badRequest(messageFor(language, "invalidEmail"));

  const existing = await NewsletterSubscriber.findOne({ email });
  if (existing) {
    const result = await subscribeExisting(existing, language);
    return res.status(200).json(result);
  }

  const token = createUnsubscribeToken();
  const encrypted = encryptUnsubscribeToken(token);
  let subscriber;
  try {
    [subscriber] = await NewsletterSubscriber.create([{
      email,
      language,
      unsubscribeTokenHash: hashUnsubscribeToken(token),
      encryptedUnsubscribeToken: encrypted.encryptedToken,
      unsubscribeTokenIv: encrypted.tokenIv,
      unsubscribeTokenAuthTag: encrypted.tokenAuthTag,
    }]);
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const winner = await NewsletterSubscriber.findOne({ email });
    if (!winner) throw error;
    const result = await subscribeExisting(winner, language);
    return res.status(200).json(result);
  }
  await queueSubscriberEmails(subscriber, token, subscriber.subscriptionVersion);
  res.status(201).json({ message: messageFor(language, "subscribed"), alreadySubscribed: false });
});

export const unsubscribeFromNewsletter = asyncHandler(async (req, res) => {
  const token = req.params.token;
  const language = normalizeNewsletterLanguage(req.body?.language);
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
    return res.status(200).json({ message: messageFor(language, "invalidToken"), unsubscribed: false });
  }
  const subscriber = await NewsletterSubscriber.findOneAndUpdate(
    { unsubscribeTokenHash: hashUnsubscribeToken(token), subscribed: true },
    {
      $set: { subscribed: false, unsubscribedAt: new Date() },
      $unset: {
        encryptedUnsubscribeToken: 1,
        unsubscribeTokenIv: 1,
        unsubscribeTokenAuthTag: 1,
      },
    },
    { new: true }
  );
  res.set("Cache-Control", "no-store").json({
    message: messageFor(language, subscriber ? "unsubscribed" : "alreadyUnsubscribed"),
    unsubscribed: Boolean(subscriber),
  });
});

export const getNewsletterSubscribers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(250, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const filter = { subscribed: true };
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.email = { $regex: escaped, $options: "i" };
  }
  const cursorProvided = typeof req.query.cursor === "string";
  const cursor = cursorProvided ? req.query.cursor : "";
  if (cursor && cursor !== "start") {
    if (!/^[a-f\d]{24}$/i.test(cursor)) badRequest("Le curseur de pagination est invalide.");
    filter._id = { $gt: cursor };
  }
  const [subscribers, total] = await Promise.all([
    NewsletterSubscriber.find(filter)
      .select("email subscribedAt")
      .sort(cursorProvided ? { _id: 1 } : { subscribedAt: -1, _id: -1 })
      .skip(cursorProvided ? 0 : (page - 1) * limit)
      .limit(limit)
      .lean(),
    NewsletterSubscriber.countDocuments({ subscribed: true, ...(search ? { email: filter.email } : {}) }),
  ]);
  const last = subscribers[subscribers.length - 1];
  res.set("Cache-Control", "no-store").json({
    subscribers,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    nextCursor: cursorProvided && subscribers.length === limit ? String(last._id) : null,
  });
});
