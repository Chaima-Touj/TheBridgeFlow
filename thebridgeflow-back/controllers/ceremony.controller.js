import mongoose from "mongoose";
import CeremonyProject from "../models/ceremonyProject.model.js";
import CeremonyVote from "../models/ceremonyVote.model.js";
import CeremonySettings from "../models/ceremonySettings.model.js";
import User from "../models/users.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import emailService from "../services/email.service.js";

const AUTHOR_SELECT = "name avatarUrl";

// Document singleton — même pattern que getOrCreateSettings (SiteSettings).
async function getOrCreateCeremonySettings() {
  let settings = await CeremonySettings.findOne();
  if (!settings) settings = await CeremonySettings.create({});
  return settings;
}

// POST /api/ceremony/projects — réservé aux étudiants
export const createProject = asyncHandler(async (req, res) => {
  if (req.user.role !== "étudiant") {
    const err = new Error("Seuls les étudiants peuvent soumettre un projet.");
    err.statusCode = 403;
    throw err;
  }

  const {
    title, description, technologies, coverImage,
    driveAppUrl, driveVideoUrl, githubUrl, teamMembers,
  } = req.body;

  if (!title?.trim()) {
    const err = new Error("Titre requis.");
    err.statusCode = 400;
    throw err;
  }

  const project = await CeremonyProject.create({
    studentId: req.user._id,
    title: title.trim(),
    description,
    technologies,
    coverImage,
    driveAppUrl,
    driveVideoUrl,
    githubUrl,
    teamMembers,
    // Portail de modération réel — écrase explicitement le default "approuvé"
    // du schéma (ce default ne couvre que les documents pré-existants et les
    // écritures qui ne précisent pas status, ex. le script de seed).
    status: "en_attente",
  });

  res.status(201).json(project);
});

// GET /api/ceremony/projects — public, uniquement les projets approuvés
export const getProjects = asyncHandler(async (req, res) => {
  const projects = await CeremonyProject.find({ status: "approuvé" })
    .populate("studentId", AUTHOR_SELECT)
    .sort({ createdAt: -1 })
    .lean();
  res.json({ projects });
});

// GET /api/ceremony/projects/:id — public, uniquement si approuvé (sinon 404,
// comme un projet inexistant — pas de fuite d'info sur les projets en attente/refusés).
export const getProject = asyncHandler(async (req, res) => {
  const project = await CeremonyProject.findOne({ _id: req.params.id, status: "approuvé" })
    .populate("studentId", AUTHOR_SELECT)
    .lean();
  if (!project) {
    const err = new Error("Projet introuvable.");
    err.statusCode = 404;
    throw err;
  }
  res.json(project);
});

// GET /api/ceremony/my-projects — étudiant connecté, tous ses projets quel
// que soit leur statut (il doit voir si son projet est en attente/refusé).
export const getMyProjects = asyncHandler(async (req, res) => {
  const projects = await CeremonyProject.find({ studentId: req.user._id })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ projects });
});

// GET /api/ceremony/leaderboard — public, uniquement les projets approuvés,
// trié par voteCount desc
export const getLeaderboard = asyncHandler(async (req, res) => {
  const projects = await CeremonyProject.find({ status: "approuvé" })
    .populate("studentId", AUTHOR_SELECT)
    .sort({ voteCount: -1, createdAt: 1 })
    .lean();
  res.json({ projects });
});

// GET /api/ceremony/settings — public (la page de vote a besoin de savoir si
// le vote est ouvert, sans exposer d'action de modification).
export const getCeremonySettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateCeremonySettings();
  await settings.populate("winnerProjectId", "title");
  res.json(settings);
});

// POST /api/ceremony/vote — { projectIds: [id1, id2, id3] }, réservé aux étudiants
export const vote = asyncHandler(async (req, res) => {
  if (req.user.role !== "étudiant") {
    const err = new Error("Seuls les étudiants peuvent voter.");
    err.statusCode = 403;
    throw err;
  }

  const settings = await CeremonySettings.findOne().lean();
  const now = new Date();
  if (settings?.isVoteClosed) {
    const err = new Error("Le vote de la Cérémonie est clôturé.");
    err.statusCode = 403;
    throw err;
  }
  if (settings?.voteStartDate && now < new Date(settings.voteStartDate)) {
    const err = new Error("Le vote de la Cérémonie n'a pas encore commencé.");
    err.statusCode = 403;
    throw err;
  }
  if (settings?.voteEndDate && now > new Date(settings.voteEndDate)) {
    const err = new Error("La période de vote de la Cérémonie est terminée.");
    err.statusCode = 403;
    throw err;
  }

  const { projectIds } = req.body;

  if (!Array.isArray(projectIds) || projectIds.length < 1 || projectIds.length > 3) {
    const err = new Error("Le vote doit contenir entre 1 et 3 projets.");
    err.statusCode = 400;
    throw err;
  }
  if (new Set(projectIds.map(String)).size !== projectIds.length) {
    const err = new Error("Les projets sélectionnés doivent être distincts.");
    err.statusCode = 400;
    throw err;
  }
  if (!projectIds.every((id) => mongoose.Types.ObjectId.isValid(id))) {
    const err = new Error("Identifiant de projet invalide.");
    err.statusCode = 400;
    throw err;
  }

  const existingVote = await CeremonyVote.findOne({ studentId: req.user._id });
  if (existingVote) {
    const err = new Error("Vous avez déjà voté.");
    err.statusCode = 409;
    throw err;
  }

  const projects = await CeremonyProject.find({ _id: { $in: projectIds }, status: "approuvé" }).select("title").lean();
  if (projects.length !== projectIds.length) {
    const err = new Error("Un ou plusieurs projets sont introuvables.");
    err.statusCode = 404;
    throw err;
  }

  await CeremonyVote.create({ studentId: req.user._id, projectIds });

  await CeremonyProject.updateMany(
    { _id: { $in: projectIds } },
    { $inc: { voteCount: 1 } }
  );

  const student = await User.findById(req.user._id).select("name email").lean();
  const projectTitles = projects.map((p) => p.title);
  emailService.sendVoteConfirmation(student.email, {
    studentName: student.name,
    projectTitles,
  });

  res.status(201).json({ message: "Vote enregistré." });
});

/* ═══════════════════════════════ Admin ══════════════════════════════════ */

// GET /api/ceremony/admin/projects — réservé admin, tous statuts confondus
// (contrairement à getProjects, public, filtré sur "approuvé").
export const getAdminProjects = asyncHandler(async (req, res) => {
  const projects = await CeremonyProject.find()
    .populate("studentId", AUTHOR_SELECT)
    .sort({ createdAt: -1 })
    .lean();
  res.json({ projects });
});

async function setProjectStatus(id, status) {
  const project = await CeremonyProject.findById(id);
  if (!project) {
    const err = new Error("Projet introuvable.");
    err.statusCode = 404;
    throw err;
  }
  project.status = status;
  await project.save();
  return project;
}

// PATCH /api/ceremony/admin/projects/:id/accept — réservé admin
export const acceptProject = asyncHandler(async (req, res) => {
  const project = await setProjectStatus(req.params.id, "approuvé");
  res.json(project);
});

// PATCH /api/ceremony/admin/projects/:id/reject — réservé admin
export const rejectProject = asyncHandler(async (req, res) => {
  const project = await setProjectStatus(req.params.id, "refusé");
  res.json(project);
});

/* ── PATCH /api/ceremony/admin/settings ───────────────────────────────────────
   Réservé admin. voteStartDate/voteEndDate = config normale. isVoteClosed
   accepté ici aussi (ex. mettre à false) — c'est le seul moyen de rouvrir le
   vote après une clôture, closeAndAnnounce ne pouvant que fermer/désigner un
   gagnant, jamais rouvrir. winnerProjectId reste géré exclusivement par
   closeAndAnnounce, pas modifiable directement ici. */
export const updateCeremonySettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateCeremonySettings();
  const { voteStartDate, voteEndDate, isVoteClosed } = req.body;

  if (voteStartDate !== undefined) settings.voteStartDate = voteStartDate ? new Date(voteStartDate) : null;
  if (voteEndDate !== undefined)   settings.voteEndDate   = voteEndDate   ? new Date(voteEndDate)   : null;
  if (isVoteClosed !== undefined)  settings.isVoteClosed  = Boolean(isVoteClosed);

  await settings.save();
  await settings.populate("winnerProjectId", "title");
  res.json(settings);
});

/* ── POST /api/ceremony/admin/close-and-announce ──────────────────────────────
   Réservé admin. Clôture le vote et fige le gagnant (le projet approuvé avec
   le plus de votes). N'envoie pas d'email/notification — annonce = affichage
   admin + winnerProjectId exposé publiquement via getCeremonySettings. */
export const closeAndAnnounce = asyncHandler(async (req, res) => {
  const winner = await CeremonyProject.findOne({ status: "approuvé" })
    .sort({ voteCount: -1, createdAt: 1 })
    .populate("studentId", AUTHOR_SELECT)
    .lean();

  const settings = await getOrCreateCeremonySettings();
  settings.isVoteClosed = true;
  settings.winnerProjectId = winner ? winner._id : null;
  await settings.save();

  res.json({ settings, winner });
});

/* ── POST /api/ceremony/admin/reset-votes ──────────────────────────────────────
   Réservé admin. Remet tous les voteCount à 0 et supprime tous les
   CeremonyVote (les étudiants peuvent revoter). Ne touche PAS à
   isVoteClosed/winnerProjectId/dates — action distincte de close-and-announce,
   pour ne pas rouvrir le vote ni effacer le gagnant annoncé sans le vouloir. */
export const resetVotes = asyncHandler(async (req, res) => {
  await CeremonyProject.updateMany({}, { $set: { voteCount: 0 } });
  const { deletedCount } = await CeremonyVote.deleteMany({});
  res.json({ message: "Votes réinitialisés.", deletedCount });
});
