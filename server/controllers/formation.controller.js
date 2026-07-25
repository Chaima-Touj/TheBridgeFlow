import Formation         from "../models/formation.model.js";
import Enrollment        from "../models/enrollment.model.js";
import EnrollmentRequest from "../models/enrollmentRequest.model.js";
import asyncHandler      from "../utils/asyncHandler.js";

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
   videos/reviews/faq restent vides — ils ont leurs propres routes dédiées.    */
export const createFormation = asyncHandler(async (req, res) => {
  const { title, slug, duration, price, schedule, level, description, mode, certificate } = req.body;

  if (!title || !duration || !price?.onsite || !price?.online || !schedule) {
    const err = new Error("Champs requis manquants : title, duration, price.onsite, price.online, schedule.");
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
    price: { onsite: price.onsite, online: price.online },
    schedule,
    level,
    description,
    mode,
    certificate,
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

  const { title, slug, duration, price, schedule, level, description, mode, certificate, technologies } = req.body;

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
  if (schedule !== undefined)             formation.schedule = schedule;
  if (level !== undefined)                formation.level = level;
  if (description !== undefined)          formation.description = description;
  if (mode !== undefined)                 formation.mode = mode;
  if (certificate !== undefined)          formation.certificate = certificate;
  if (technologies !== undefined)         formation.technologies = technologies;

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

export const patchFormationWeeks = asyncHandler(async (req, res) => {
  const { weeks } = req.body;
  if (!Array.isArray(weeks)) {
    return res.status(400).json({ message: "weeks doit être un tableau." });
  }
  const formation = await Formation.findOneAndUpdate(
    { slug: req.params.slug },
    { $set: { weeks } },
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
  const formation = await Formation.findOneAndUpdate(
    { slug: req.params.slug },
    { $set: { supervision } },
    { new: true }
  ).select("-__v");
  if (!formation) return res.status(404).json({ message: "Formation introuvable." });
  res.json({ message: "supervision mis à jour.", slug: formation.slug, count: formation.supervision.length });
});
