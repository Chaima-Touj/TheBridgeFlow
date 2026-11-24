import PfePackRegistration from "../models/pfePackRegistration.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { isRequestStatus } from "../utils/requestStatuses.js";
import { validatePfePackRegistration } from "../utils/validatePfePackRegistration.js";

function fail(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

// Identifiant MongoDB : uniquement 24 caractères hexadécimaux.
const isRegistrationId = (value) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

// Champs nécessaires à la liste du tableau de bord (filtre et recherche côté client).
const LIST_FIELDS = "firstName lastName email phone university city technologies locationMode preferredLocation status statusUpdatedAt createdAt";

/* Format renvoyé au tableau de bord admin. Une demande enregistrée avant
   l'ajout du suivi n'a pas de statut : elle est renvoyée comme « new ».
   detail = true ajoute le sujet, l'accord et l'auteur du dernier changement
   de statut (peuplé avec { _id, name }, ou null). */
export function serializePfePackRegistration(registration, { detail = false } = {}) {
  const item = {
    _id: registration._id,
    firstName: registration.firstName || "",
    lastName: registration.lastName || "",
    email: registration.email || "",
    phone: registration.phone || "",
    university: registration.university || "",
    city: registration.city || "",
    technologies: Array.isArray(registration.technologies) ? registration.technologies : [],
    locationMode: registration.locationMode || "",
    preferredLocation: registration.preferredLocation || "",
    status: isRequestStatus(registration.status) ? registration.status : "new",
    statusUpdatedAt: registration.statusUpdatedAt || null,
    createdAt: registration.createdAt,
  };
  if (!detail) return item;

  const updatedBy = registration.statusUpdatedBy;
  return {
    ...item,
    subject: registration.subject || "",
    consentConfirmed: registration.consentConfirmed === true,
    statusUpdatedBy: updatedBy && updatedBy._id
      ? { _id: updatedBy._id, name: typeof updatedBy.name === "string" ? updatedBy.name : "" }
      : null,
  };
}

/* ── POST /api/pfe-pack/registrations (public, reCAPTCHA) ──────────────────
   Le validateur ne garde que les champs du formulaire : le statut et son
   suivi ne peuvent jamais être fixés par le visiteur. */
export const createPfePackRegistration = asyncHandler(async (req, res) => {
  const registration = await PfePackRegistration.create(validatePfePackRegistration(req.body));

  res.status(201).json({
    message: "Votre demande pour le Pack PFE a bien été envoyée.",
    registration: { id: registration._id },
  });
});

/* ── Admin ───────────────────────────────────────────────────────────────── */
// GET /api/pfe-pack/registrations : toutes les demandes, les plus récentes d'abord.
export const getPfePackRegistrations = asyncHandler(async (_req, res) => {
  const registrations = await PfePackRegistration.find()
    .sort({ createdAt: -1, _id: -1 })
    .select(LIST_FIELDS)
    .lean();
  res.json(registrations.map((registration) => serializePfePackRegistration(registration)));
});

// GET /api/pfe-pack/registrations/:id
export const getPfePackRegistrationById = asyncHandler(async (req, res) => {
  if (!isRegistrationId(req.params.id)) fail("Identifiant de demande invalide.", 400);
  const registration = await PfePackRegistration.findById(req.params.id)
    .populate("statusUpdatedBy", "name")
    .lean();
  if (!registration) fail("Demande Pack PFE introuvable.", 404);
  res.json(serializePfePackRegistration(registration, { detail: true }));
});

// PATCH /api/pfe-pack/registrations/:id/status { status }
export const updatePfePackRegistrationStatus = asyncHandler(async (req, res) => {
  if (!isRegistrationId(req.params.id)) fail("Identifiant de demande invalide.", 400);
  const status = req.body?.status;
  if (!isRequestStatus(status)) fail("Statut invalide.", 400);

  const registration = await PfePackRegistration.findByIdAndUpdate(
    req.params.id,
    { $set: { status, statusUpdatedAt: new Date(), statusUpdatedBy: req.user._id } },
    { returnDocument: "after", runValidators: true },
  ).populate("statusUpdatedBy", "name").lean();
  if (!registration) fail("Demande Pack PFE introuvable.", 404);
  res.json({ registration: serializePfePackRegistration(registration, { detail: true }) });
});
