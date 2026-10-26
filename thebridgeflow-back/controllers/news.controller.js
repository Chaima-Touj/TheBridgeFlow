import News from "../models/news.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { normalizeDriveUrl, isBase64Image } from "../utils/driveHelper.js";
import { containsRawHtml } from "../utils/markdownContent.js";
import { processNewsletterJobs } from "../services/newsletter.service.js";

// image peut être un lien Google Drive (normalisé) ou une image base64
// (compression côté client, voir imageCompression.js — jamais passée à
// normalizeDriveUrl).
function normalizeNewsImage(image) {
  return isBase64Image(image) ? image : normalizeDriveUrl(image, "image");
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

const NEWS_FIELD_LABELS = {
  title: "titre principal",
  excerpt: "introduction",
  content: "contenu principal",
  conclusion: "conclusion",
  ctaLabel: "texte de l'appel à l'action",
  ctaUrl: "lien de l'appel à l'action",
  metaTitle: "meta title",
  metaDescription: "meta description",
  category: "catégorie",
  image: "image",
};

function validateText(value, field, { required = false, maxLength = 100000 } = {}) {
  const label = NEWS_FIELD_LABELS[field] || field;
  if (value === undefined || value === null) {
    if (required) badRequest(`Le champ « ${label} » est obligatoire.`);
    return "";
  }
  if (typeof value !== "string") badRequest(`Le champ « ${label} » doit être du texte.`);
  const text = value.trim();
  if (required && !text) badRequest(`Le champ « ${label} » est obligatoire.`);
  if (text.length > maxLength) badRequest(`Le champ « ${label} » dépasse la longueur maximale autorisée.`);
  return text;
}

function validateMarkdown(value, field, options) {
  const text = validateText(value, field, options);
  if (containsRawHtml(text)) {
    badRequest(`Le champ « ${NEWS_FIELD_LABELS[field] || field} » ne peut pas contenir de HTML brut.`);
  }
  return text;
}

function validateFaq(value) {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (!Array.isArray(value) || value.length > 25) badRequest("La FAQ doit contenir au maximum 25 entrées.");
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      badRequest(`L'entrée FAQ ${index + 1} est invalide.`);
    }
    return {
      question: validateText(entry.question, `La question FAQ ${index + 1}`, { required: true, maxLength: 300 }),
      answer: validateMarkdown(entry.answer, `La réponse FAQ ${index + 1}`, { required: true, maxLength: 10000 }),
    };
  });
}

function isSafeCtaUrl(value) {
  if (/^\/(?![\\/])/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validateCta(label, url) {
  if (Boolean(label) !== Boolean(url)) {
    badRequest("Le libellé et le lien de l'appel à l'action doivent être renseignés ensemble.");
  }
  if (url && !isSafeCtaUrl(url)) {
    badRequest("Le lien de l'appel à l'action doit être une URL HTTPS ou un chemin interne.");
  }
}

function validateNewsFields(body, { partial = false } = {}) {
  const fields = {
    title: { required: true, maxLength: 300 },
    excerpt: { required: true, maxLength: 5000 },
    content: { maxLength: 100000 },
    conclusion: { maxLength: 20000 },
    ctaLabel: { maxLength: 100 },
    ctaUrl: { maxLength: 2048 },
    metaTitle: { maxLength: 70 },
    metaDescription: { maxLength: 320 },
    category: { required: true, maxLength: 100 },
  };
  const payload = {};
  for (const [name, options] of Object.entries(fields)) {
    if (!partial || body[name] !== undefined) {
      payload[name] = ["content", "conclusion"].includes(name)
        ? validateMarkdown(body[name], name, options)
        : validateText(body[name], name, options);
    }
  }
  if (body.publishedAt !== undefined) {
    const publishedAt = new Date(body.publishedAt);
    if (Number.isNaN(publishedAt.getTime())) badRequest("La date de publication est invalide.");
    payload.publishedAt = publishedAt;
  }
  if (body.status !== undefined) {
    if (!["draft", "published"].includes(body.status)) badRequest("Le statut de l'article est invalide.");
    payload.status = body.status;
  }
  const faq = validateFaq(body.faq);
  if (faq !== undefined) payload.faq = faq;
  return payload;
}

// GET /api/news?limit=3 — public, triée par date de publication décroissante.
export const getAllNews = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 0;
  let query = News.find({
    $or: [{ status: "published" }, { status: { $exists: false } }],
  }).sort({ publishedAt: -1 }).select("-__v");
  if (limit > 0) query = query.limit(limit);
  const news = await query;
  res.json(news);
});

export const getNewsById = asyncHandler(async (req, res) => {
  const article = await News.findOne({
    _id: req.params.id,
    $or: [{ status: "published" }, { status: { $exists: false } }],
  }).select("-__v");
  if (!article) return res.status(404).json({ message: "Actualité introuvable." });
  res.json(article);
});

export const getAdminNews = asyncHandler(async (req, res) => {
  const news = await News.find().sort({ updatedAt: -1 }).select("-__v").lean();
  res.json(news);
});

/* ── POST /api/news ───────────────────────────────────────────────────────────
   Réservé admin. L'image est obligatoire à la création — soit un lien Google
   Drive (normalisé côté serveur), soit une image base64 compressée côté
   client (voir imageCompression.js). Plus d'upload disque (multer) : le
   champ `image` arrive en JSON comme un simple champ texte. */
export const createNews = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const fields = validateNewsFields(body);
  validateCta(fields.ctaLabel, fields.ctaUrl);
  const image = validateText(body.image, "image", { required: true, maxLength: 5_000_000 });

  const article = await News.create({
    ...fields,
    image: normalizeNewsImage(image),
    author: req.user?.name || "admin",
    publishedAt: fields.publishedAt || Date.now(),
    status: fields.status || "published",
    ...((fields.status || "published") === "published" ? { newsletterCampaignEligibleAt: new Date() } : {}),
  });

  if (article.status === "published") void processNewsletterJobs();
  res.status(201).json(article);
});

/* ── PUT /api/news/:id ─────────────────────────────────────────────────────────
   Réservé admin. Nouvelle image optionnelle : si non fournie, l'image
   existante est conservée. */
export const updateNews = asyncHandler(async (req, res) => {
  const article = await News.findById(req.params.id);
  if (!article) {
    const err = new Error("Actualité introuvable.");
    err.statusCode = 404;
    throw err;
  }

  const body = req.body || {};
  const fields = validateNewsFields(body, { partial: true });
  const previousStatus = article.status || "published";
  Object.assign(article, fields);
  validateCta(article.ctaLabel, article.ctaUrl);
  if (body.image !== undefined) {
    const image = validateText(body.image, "image", { required: true, maxLength: 5_000_000 });
    article.image = normalizeNewsImage(image);
  }

  if (previousStatus !== "published" && article.status === "published" &&
      !article.newsletterCampaignEligibleAt && !article.newsletterCampaignSentAt) {
    article.newsletterCampaignEligibleAt = new Date();
  }
  await article.save();
  if (previousStatus !== "published" && article.status === "published") void processNewsletterJobs();
  res.json(article);
});

export const deleteNews = asyncHandler(async (req, res) => {
  const article = await News.findById(req.params.id);
  if (!article) {
    const err = new Error("Actualité introuvable.");
    err.statusCode = 404;
    throw err;
  }
  await article.deleteOne();
  res.json({ message: "Actualité supprimée.", id: article._id });
});
