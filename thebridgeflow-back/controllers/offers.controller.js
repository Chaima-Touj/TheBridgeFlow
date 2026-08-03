import Offer from "../models/offers.model.js";
import Application from "../models/applications.model.js";
import asyncHandler from "../utils/asyncHandler.js";

const normalizeType = (value) => {
  if (!value) return "stage";
  const t = String(value).trim().toLowerCase();
  if (t === "stage pfe" || t === "pfe") return "PFE";
  if (t === "stage") return "stage";
  if (t === "alternance") return "alternance";
  if (t === "formation") return "formation";
  if (t === "vidéo" || t === "video") return "vidéo";
  return "stage";
};

const normalizePayload = (body) => {
  let {
    title, description, companyName, domain, location, duration,
    type, skills, salary, deadline,
    company, specialite, skillsRequired, motsCles, desc,
  } = body || {};

  if (!description && desc) description = desc;
  if (!companyName && company) companyName = company;
  if (!domain && specialite) domain = specialite;

  const normalizedSkills =
    (Array.isArray(skills) && skills.length ? skills : undefined) ||
    (Array.isArray(skillsRequired) && skillsRequired.length ? skillsRequired : undefined) ||
    (Array.isArray(motsCles) && motsCles.length ? motsCles : []) ||
    [];

  return {
    title,
    description,
    companyName,
    domain,
    location,
    duration,
    type: normalizeType(type),
    skills: normalizedSkills,
    salary,
    deadline,
  };
};

// GET /api/offers
export const getOffers = asyncHandler(async (req, res) => {
  const { domain, type, location, search, page = 1, limit = 9, sort = "-createdAt" } = req.query;

  const filter = {
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  };

  if (domain)   filter.domain = domain;
  if (type)     filter.type   = normalizeType(type);
  if (location) filter.location = { $regex: location, $options: "i" };

  // Recherche textuelle — corrigée et fonctionnelle
  if (search && search.trim()) {
    const regex = { $regex: search.trim(), $options: "i" };
    filter.$and = [
      { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
      {
        $or: [
          { title:       regex },
          { description: regex },
          { companyName: regex },
          { domain:      regex },
          { skills:      regex },
        ],
      },
    ];
    delete filter.$or;
  }

  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  const [offers, total] = await Promise.all([
    Offer.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
    Offer.countDocuments(filter),
  ]);

  res.json({
    offers,
    pagination: {
      total,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.ceil(total / limitNum),
      hasNext:    skip + offers.length < total,
      hasPrev:    pageNum > 1,
    },
  });
});

// GET /api/offers/:id
export const getOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.findById(req.params.id).lean();
  if (!offer) {
    const err = new Error("Offre non trouvée");
    err.statusCode = 404;
    throw err;
  }

  await Offer.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { runValidators: false });
  res.json({ offer });
});

// POST /api/offers — admin uniquement
export const createOffer = asyncHandler(async (req, res) => {
  const payload = normalizePayload(req.body);

  if (!payload.title || !payload.description || !payload.companyName) {
    const err = new Error("Titre, description et nom d'entreprise requis");
    err.statusCode = 400;
    throw err;
  }

  const offer = await Offer.create({ ...payload, companyId: req.user._id });
  res.status(201).json({ offer });
});

// PUT /api/offers/:id — admin uniquement
export const updateOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.findById(req.params.id);
  if (!offer) {
    const err = new Error("Offre non trouvée");
    err.statusCode = 404;
    throw err;
  }

  const updated = await Offer.findByIdAndUpdate(
    req.params.id,
    normalizePayload(req.body),
    { new: true, runValidators: true }
  ).lean();

  res.json({ offer: updated });
});

// DELETE /api/offers/:id — admin uniquement
export const deleteOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.findById(req.params.id);
  if (!offer) {
    const err = new Error("Offre non trouvée");
    err.statusCode = 404;
    throw err;
  }

  await offer.deleteOne();
  res.json({ message: "Offre supprimée" });
});

// GET /api/offers/meta/domains
export const getDomains = asyncHandler(async (req, res) => {
  const domains = await Offer.distinct("domain", { domain: { $ne: "" } });
  res.json({ domains });
});

// GET /api/offers/admin — admin uniquement. Toutes les offres (actives et
// inactives, contrairement à getOffers qui masque les inactives côté public),
// avec le nombre de candidatures reçues par offre.
export const getOffersAdmin = asyncHandler(async (req, res) => {
  const offers = await Offer.find({}).sort("-createdAt").lean();

  const counts = await Application.aggregate([
    { $match: { offerId: { $in: offers.map((o) => o._id) } } },
    { $group: { _id: "$offerId", count: { $sum: 1 } } },
  ]);
  const countByOffer = new Map(counts.map((c) => [String(c._id), c.count]));

  res.json({
    offers: offers.map((o) => ({
      ...o,
      applicationsCount: countByOffer.get(String(o._id)) || 0,
    })),
  });
});

// PATCH /api/offers/:id/status — admin uniquement. Active bascule isActive
// sans passer par le formulaire complet (mêmes champs que updateOffer sinon).
export const updateOfferStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  if (typeof isActive !== "boolean") {
    const err = new Error("isActive (booléen) requis");
    err.statusCode = 400;
    throw err;
  }

  const offer = await Offer.findByIdAndUpdate(
    req.params.id,
    { isActive },
    { new: true, runValidators: true }
  ).lean();

  if (!offer) {
    const err = new Error("Offre non trouvée");
    err.statusCode = 404;
    throw err;
  }

  res.json({ offer });
});
