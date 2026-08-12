import Formation         from "../models/formation.model.js";
import Enrollment        from "../models/enrollment.model.js";
import EnrollmentRequest from "../models/enrollmentRequest.model.js";
import asyncHandler      from "../utils/asyncHandler.js";
import { normalizeDriveUrl, isBase64Image } from "../utils/driveHelper.js";

// Kebab-case, sans accents (ex: "Business Intelligence (BI)" → "business-intelligence-bi")
const ACCENT_MAP = {
  à: "a", â: "a", ä: "a", á: "a", ã: "a",
  ç: "c",
  é: "e", è: "e", ê: "e", ë: "e",
  î: "i", ï: "i", í: "i", ì: "i",
  ô: "o", ö: "o", ó: "o", ò: "o", õ: "o",
  ù: "u", û: "u", ü: "u", ú: "u",
  ñ: "n",
};

function slugify(text) {
  return String(text)
    .toLowerCase()
    .split("")
    .map((ch) => ACCENT_MAP[ch] || ch)
    .join("")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Ajoute -2, -3... si le slug de base est déjà pris
async function generateUniqueSlug(base) {
  let slug = base;
  let counter = 2;
  while (await Formation.exists({ slug })) {
    slug = `${base}-${counter}`;
    counter++;
  }
  return slug;
}

export const getAllFormations = asyncHandler(async (req, res) => {
  const formations = await Formation.find().select("-__v");
  res.json(formations);
});

// GET /api/formations/tech-map — liste allégée (slug, title, technologies)
// utilisée pour faire correspondre les tags de compétences d'une offre à la
// formation qui les enseigne, sans télécharger weeks/videos/reviews/faq.
export const getFormationsTechMap = asyncHandler(async (req, res) => {
  const formations = await Formation.find().select("slug title technologies").sort({ title: 1 });
  res.json(formations);
});

export const getFormationBySlug = asyncHandler(async (req, res) => {
  const formation = await Formation.findOne({ slug: req.params.slug }).select("-__v");
  if (!formation) return res.status(404).json({ message: "Formation introuvable." });

  // Incrémenter le compteur de vues
  await Formation.findByIdAndUpdate(formation._id, { $inc: { views: 1 } }, { runValidators: false });

  res.json(formation);
});

export const getFormationById = asyncHandler(async (req, res) => {
  const formation = await Formation.findById(req.params.id).select("-__v");
  if (!formation) return res.status(404).json({ message: "Formation introuvable." });

  // Incrémenter le compteur de vues
  await Formation.findByIdAndUpdate(formation._id, { $inc: { views: 1 } }, { runValidators: false });

  res.json(formation);
});

/* ── POST /api/formations ─────────────────────────────────────────────────────
   Crée une nouvelle formation (champs de base uniquement). weeks/supervision/
   videos restent vides — ils ont leurs propres routes dédiées. reviews a ses
   propres routes CRUD par avis (voir addReview/updateReview/deleteReview
   plus bas) ; faq n'a pas encore de route dédiée.                           */
export const createFormation = asyncHandler(async (req, res) => {
  const { title, slug, duration, price, level, description, mode, certificate, image, trailerVideoUrl, trailerThumbnail } = req.body;

  if (!title || !duration || !price?.onsite || !price?.online) {
    const err = new Error("Champs requis manquants : title, duration, price.onsite, price.online.");
    err.statusCode = 400;
    throw err;
  }

  const existingTitle = await Formation.findOne({ title });
  if (existingTitle) {
    const err = new Error("Une formation avec ce titre existe déjà.");
    err.statusCode = 409;
    throw err;
  }

  const baseSlug = slugify(slug || title);
  if (!baseSlug) {
    const err = new Error("Impossible de générer un slug à partir du titre fourni.");
    err.statusCode = 400;
    throw err;
  }
  const finalSlug = await generateUniqueSlug(baseSlug);

  const formation = await Formation.create({
    title,
    slug: finalSlug,
    duration,
    price: { onsite: price.onsite, online: price.online, recordings: price.recordings },
    level,
    description,
    mode,
    certificate,
    image,
    trailerVideoUrl:  trailerVideoUrl  ? normalizeDriveUrl(trailerVideoUrl, "video") : undefined,
    trailerThumbnail: trailerThumbnail ? normalizeDriveUrl(trailerThumbnail, "image") : undefined,
  });

  res.status(201).json(formation);
});

/* ── PATCH /api/formations/:id ────────────────────────────────────────────────
   Met à jour uniquement les champs de base — ne touche pas weeks/supervision. */
export const updateFormationInfo = asyncHandler(async (req, res) => {
  const formation = await Formation.findById(req.params.id);
  if (!formation) {
    const err = new Error("Formation introuvable.");
    err.statusCode = 404;
    throw err;
  }

  const { title, slug, duration, price, level, description, mode, certificate, technologies, image } = req.body;

  if (title !== undefined) {
    const dup = await Formation.findOne({ title, _id: { $ne: formation._id } });
    if (dup) {
      const err = new Error("Une autre formation utilise déjà ce titre.");
      err.statusCode = 409;
      throw err;
    }
    formation.title = title;
  }

  if (slug !== undefined) {
    const newSlug = slugify(slug);
    if (!newSlug) {
      const err = new Error("Slug invalide.");
      err.statusCode = 400;
      throw err;
    }
    const dup = await Formation.findOne({ slug: newSlug, _id: { $ne: formation._id } });
    if (dup) {
      const err = new Error("Une autre formation utilise déjà ce slug.");
      err.statusCode = 409;
      throw err;
    }
    formation.slug = newSlug;
  }

  if (duration !== undefined)             formation.duration = duration;
  if (price?.onsite !== undefined)        formation.price.onsite = price.onsite;
  if (price?.online !== undefined)        formation.price.online = price.online;
  if (price?.recordings !== undefined)    formation.price.recordings = price.recordings;
  if (level !== undefined)                formation.level = level;
  if (description !== undefined)          formation.description = description;
  if (mode !== undefined)                 formation.mode = mode;
  if (certificate !== undefined)          formation.certificate = certificate;
  if (technologies !== undefined)         formation.technologies = technologies;
  if (image !== undefined)                formation.image = image;

  await formation.save();
  res.json(formation);
});

/* ── DELETE /api/formations/:id ───────────────────────────────────────────────
   Refuse la suppression si des Enrollment/EnrollmentRequest existent encore. */
export const deleteFormation = asyncHandler(async (req, res) => {
  const formation = await Formation.findById(req.params.id);
  if (!formation) {
    const err = new Error("Formation introuvable.");
    err.statusCode = 404;
    throw err;
  }

  const [enrollmentCount, requestCount] = await Promise.all([
    Enrollment.countDocuments({ formation: formation._id }),
    EnrollmentRequest.countDocuments({ formation: formation._id }),
  ]);

  if (enrollmentCount > 0 || requestCount > 0) {
    const parts = [];
    if (enrollmentCount > 0) parts.push(`${enrollmentCount} étudiant(s) inscrit(s)`);
    if (requestCount > 0)    parts.push(`${requestCount} demande(s) d'inscription`);
    const err = new Error(`Impossible de supprimer : ${parts.join(" et ")} lié(s) à cette formation.`);
    err.statusCode = 409;
    throw err;
  }

  await formation.deleteOne();
  res.json({ message: "Formation supprimée.", id: formation._id });
});

/* ── PATCH /api/formations/:id/trailer ───────────────────────────────────────
   Met à jour la vidéo de présentation (trailer) et sa vignette.
   Normalise automatiquement les URLs Google Drive.                          */
export const patchFormationTrailer = asyncHandler(async (req, res) => {
  const { trailerVideoUrl, trailerThumbnail, trailerProvider, trailerDriveUrl } = req.body;
  const formation = await Formation.findById(req.params.id);
  if (!formation) {
    const err = new Error("Formation introuvable.");
    err.statusCode = 404;
    throw err;
  }
  if (trailerVideoUrl !== undefined)  formation.trailerVideoUrl  = normalizeDriveUrl(trailerVideoUrl, "video");
  if (trailerThumbnail !== undefined) formation.trailerThumbnail = normalizeDriveUrl(trailerThumbnail, "image");
  if (trailerProvider !== undefined)  formation.trailerProvider  = trailerProvider;
  if (trailerDriveUrl !== undefined)  formation.trailerDriveUrl  = trailerDriveUrl;
  await formation.save();
  res.json({ message: "Trailer mis à jour.", trailerVideoUrl: formation.trailerVideoUrl, trailerThumbnail: formation.trailerThumbnail });
});

/* ── PATCH /api/formations/slug/:slug/videos ─────────────────────────────────
   Remplace intégralement le tableau `videos` d'une formation.               */
export const patchFormationVideos = asyncHandler(async (req, res) => {
  const { videos } = req.body;
  if (!Array.isArray(videos)) {
    return res.status(400).json({ message: "videos doit être un tableau." });
  }
  // Normalize Google Drive URLs in videos : driveUrl (lien saisi par l'admin) → url (lien /preview)
  // thumbnail peut être une image base64 (compression côté client) plutôt
  // qu'un lien Drive — ne jamais la faire passer par normalizeDriveUrl (voir
  // isBase64Image).
  const normalizedVideos = videos.map((v) => ({
    ...v,
    url:       v.driveUrl ? normalizeDriveUrl(v.driveUrl, "video") : v.url,
    thumbnail: v.thumbnail && !isBase64Image(v.thumbnail) ? normalizeDriveUrl(v.thumbnail, "image") : v.thumbnail,
  }));
  const formation = await Formation.findOneAndUpdate(
    { slug: req.params.slug },
    { $set: { videos: normalizedVideos } },
    { new: true }
  ).select("-__v");
  if (!formation) return res.status(404).json({ message: "Formation introuvable." });
  res.json({ message: "videos mis à jour.", slug: formation.slug, count: formation.videos.length });
});

/* ── POST /api/formations/upload-thumbnail ────────────────────────────────────
   Upload d'une image de couverture pour une carte vidéo (voir uploadVideoThumbnail,
   upload.middleware.js). Retourne l'URL du fichier stocké — ne touche à aucune
   formation, l'admin l'utilise ensuite comme valeur du champ `thumbnail`.      */
export const uploadFormationVideoThumbnail = asyncHandler(async (req, res) => {
  if (!req.file) {
    const err = new Error("Aucune image fournie.");
    err.statusCode = 400;
    throw err;
  }
  const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.status(201).json({ url });
});

export const patchFormationWeeks = asyncHandler(async (req, res) => {
  const { weeks } = req.body;
  if (!Array.isArray(weeks)) {
    return res.status(400).json({ message: "weeks doit être un tableau." });
  }
  // Normalize Google Drive URLs in weeks — thumbnail peut être une image
  // base64 (compression côté client), jamais passée à normalizeDriveUrl.
  const normalizedWeeks = weeks.map((w) => ({
    ...w,
    videoUrl:  w.videoUrl  ? normalizeDriveUrl(w.videoUrl, "video") : w.videoUrl,
    thumbnail: w.thumbnail && !isBase64Image(w.thumbnail) ? normalizeDriveUrl(w.thumbnail, "image") : w.thumbnail,
  }));
  const formation = await Formation.findOneAndUpdate(
    { slug: req.params.slug },
    { $set: { weeks: normalizedWeeks } },
    { new: true }
  ).select("-__v");
  if (!formation) return res.status(404).json({ message: "Formation introuvable." });
  res.json({ message: "weeks mis à jour.", slug: formation.slug, count: formation.weeks.length });
});

export const patchFormationSupervision = asyncHandler(async (req, res) => {
  const { supervision } = req.body;
  if (!Array.isArray(supervision)) {
    return res.status(400).json({ message: "supervision doit être un tableau." });
  }
  // Normalize Google Drive URLs in supervision weeks — thumbnail peut être
  // une image base64 (compression côté client), jamais passée à normalizeDriveUrl.
  const normalizedSupervision = supervision.map((w) => ({
    ...w,
    videoUrl:  w.videoUrl  ? normalizeDriveUrl(w.videoUrl, "video") : w.videoUrl,
    thumbnail: w.thumbnail && !isBase64Image(w.thumbnail) ? normalizeDriveUrl(w.thumbnail, "image") : w.thumbnail,
  }));
  const formation = await Formation.findOneAndUpdate(
    { slug: req.params.slug },
    { $set: { supervision: normalizedSupervision } },
    { new: true }
  ).select("-__v");
  if (!formation) return res.status(404).json({ message: "Formation introuvable." });
  res.json({ message: "supervision mis à jour.", slug: formation.slug, count: formation.supervision.length });
});

/* ── POST /api/formations/:formationId/reviews ────────────────────────────────
   Ajoute un avis à une formation. Réservé admin. */
export const addReview = asyncHandler(async (req, res) => {
  const { name, avatar, rating, comment, date } = req.body;
  if (!name) {
    const err = new Error("Champ requis manquant : name.");
    err.statusCode = 400;
    throw err;
  }

  const formation = await Formation.findById(req.params.formationId);
  if (!formation) {
    const err = new Error("Formation introuvable.");
    err.statusCode = 404;
    throw err;
  }

  formation.reviews.push({
    name,
    avatar:  avatar || "",
    rating:  rating !== undefined ? rating : 5,
    comment: comment || "",
    date:    date || Date.now(),
  });
  await formation.save();

  res.status(201).json(formation.reviews[formation.reviews.length - 1]);
});

/* ── PATCH /api/formations/:formationId/reviews/:reviewId ─────────────────────
   Modifie un avis existant. Réservé admin. */
export const updateReview = asyncHandler(async (req, res) => {
  const formation = await Formation.findById(req.params.formationId);
  if (!formation) {
    const err = new Error("Formation introuvable.");
    err.statusCode = 404;
    throw err;
  }

  const review = formation.reviews.id(req.params.reviewId);
  if (!review) {
    const err = new Error("Avis introuvable.");
    err.statusCode = 404;
    throw err;
  }

  const { name, avatar, rating, comment, date } = req.body;
  if (name !== undefined)    review.name = name;
  if (avatar !== undefined)  review.avatar = avatar;
  if (rating !== undefined)  review.rating = rating;
  if (comment !== undefined) review.comment = comment;
  if (date !== undefined)    review.date = date;

  await formation.save();
  res.json(review);
});

/* ── DELETE /api/formations/:formationId/reviews/:reviewId ────────────────────
   Supprime un avis. Réservé admin. */
export const deleteReview = asyncHandler(async (req, res) => {
  const formation = await Formation.findById(req.params.formationId);
  if (!formation) {
    const err = new Error("Formation introuvable.");
    err.statusCode = 404;
    throw err;
  }

  const review = formation.reviews.id(req.params.reviewId);
  if (!review) {
    const err = new Error("Avis introuvable.");
    err.statusCode = 404;
    throw err;
  }

  review.deleteOne();
  await formation.save();
  res.json({ message: "Avis supprimé.", id: req.params.reviewId });
});
