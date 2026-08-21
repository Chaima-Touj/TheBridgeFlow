import mongoose from "mongoose";
import CeremonyProject from "../models/ceremonyProject.model.js";
import CeremonyVote from "../models/ceremonyVote.model.js";
import CeremonySettings from "../models/ceremonySettings.model.js";
import User from "../models/users.model.js";
import Notification from "../models/notification.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import emailService from "../services/email.service.js";

const AUTHOR_SELECT = "name avatarUrl";

// Document singleton — même pattern que getOrCreateSettings (SiteSettings).
async function getOrCreateCeremonySettings() {
  let settings = await CeremonySettings.findOne();
  if (!settings) settings = await CeremonySettings.create({});
  return settings;
}

// Édition en cours — toutes les routes publiques/admin listant des
// CeremonyProject filtrent dessus (voir models/ceremonySettings.model.js).
async function getCurrentEdition() {
  const settings = await getOrCreateCeremonySettings();
  return settings.edition;
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
    edition: await getCurrentEdition(),
  });

  res.status(201).json(project);
});

// GET /api/ceremony/projects — public, uniquement les projets approuvés de
// l'édition en cours (une édition passée ne se consulte que via /archives).
export const getProjects = asyncHandler(async (req, res) => {
  const edition = await getCurrentEdition();
  const projects = await CeremonyProject.find({ status: "approuvé", edition })
    .populate("studentId", AUTHOR_SELECT)
    .sort({ createdAt: -1 })
    .lean();
  res.json({ projects });
});

// GET /api/ceremony/projects/:id — public, uniquement si approuvé ET de
// l'édition en cours (sinon 404, comme un projet inexistant — pas de fuite
// d'info sur les projets en attente/refusés, ni sur les éditions passées :
// celles-ci n'ont ni vote ni QR actif, seule /archives/:edition les expose).
export const getProject = asyncHandler(async (req, res) => {
  const edition = await getCurrentEdition();
  const project = await CeremonyProject.findOne({ _id: req.params.id, status: "approuvé", edition })
    .populate("studentId", AUTHOR_SELECT)
    .lean();
  if (!project) {
    const err = new Error("Projet introuvable.");
    err.statusCode = 404;
    throw err;
  }
  res.json(project);
});

// GET /api/ceremony/my-projects — étudiant connecté, tous ses projets de
// l'édition en cours, quel que soit leur statut (il doit voir si son projet
// est en attente/refusé). Ses soumissions d'éditions passées restent
// consultables via /archives/:edition (sans distinction "les miens").
export const getMyProjects = asyncHandler(async (req, res) => {
  const edition = await getCurrentEdition();
  const projects = await CeremonyProject.find({ studentId: req.user._id, edition })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ projects });
});

// GET /api/ceremony/leaderboard — public, uniquement les projets approuvés de
// l'édition en cours, trié par voteCount desc
export const getLeaderboard = asyncHandler(async (req, res) => {
  const edition = await getCurrentEdition();
  const projects = await CeremonyProject.find({ status: "approuvé", edition })
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

  const currentEdition = await getCurrentEdition();
  const projects = await CeremonyProject.find({ _id: { $in: projectIds }, status: "approuvé", edition: currentEdition }).select("title").lean();
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

// GET /api/ceremony/admin/projects — réservé admin, tous statuts confondus de
// l'édition en cours (contrairement à getProjects, public, filtré sur
// "approuvé" ; les éditions passées se consultent via /archives, pas ici —
// leur modération est déjà terminée).
export const getAdminProjects = asyncHandler(async (req, res) => {
  const edition = await getCurrentEdition();
  const projects = await CeremonyProject.find({ edition })
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
   closeAndAnnounce, pas modifiable directement ici.
   edition : c'est aussi le seul moyen de démarrer une nouvelle édition —
   passer edition à une valeur supérieure à l'actuelle "libère" un nouveau
   cycle de soumission (createProject taggera désormais avec la nouvelle
   valeur) ; l'édition précédente devient automatiquement archivée (edition <
   edition courante, voir getCeremonyArchives) sans action supplémentaire.
   Ne réinitialise PAS isVoteClosed/winnerProjectId tout seul : l'admin garde
   la main via ce même endpoint (ex. isVoteClosed:false dans le même appel,
   ou le bouton "Rouvrir le vote" existant). */
export const updateCeremonySettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateCeremonySettings();
  const { voteStartDate, voteEndDate, isVoteClosed, edition } = req.body;

  if (voteStartDate !== undefined) settings.voteStartDate = voteStartDate ? new Date(voteStartDate) : null;
  if (voteEndDate !== undefined)   settings.voteEndDate   = voteEndDate   ? new Date(voteEndDate)   : null;
  if (isVoteClosed !== undefined)  settings.isVoteClosed  = Boolean(isVoteClosed);
  if (edition !== undefined) {
    const parsed = Number(edition);
    if (!Number.isFinite(parsed)) {
      const err = new Error("Édition invalide.");
      err.statusCode = 400;
      throw err;
    }
    settings.edition = parsed;
  }

  await settings.save();
  await settings.populate("winnerProjectId", "title");
  res.json(settings);
});

/* ── POST /api/ceremony/admin/close-and-announce ──────────────────────────────
   Réservé admin. Clôture le vote et fige le gagnant (le projet approuvé avec
   le plus de votes, dans l'édition en cours). Annonce = affichage admin +
   winnerProjectId exposé publiquement via getCeremonySettings, ET :
   - notification in-app + email de félicitations pour le gagnant ;
   - notification in-app + email de résultats pour les autres participants
     (tous les votants + tous les soumetteurs de cette édition, dédupliqués,
     gagnant exclu).
   Notifications awaited (écriture DB rapide, même pattern que
   applications.controller.js:61-67) ; emails PAS awaited — fire-and-forget,
   même principe que sendVoteConfirmation (vote() ci-dessus) : la réponse HTTP
   ne doit pas attendre l'API Brevo. */
export const closeAndAnnounce = asyncHandler(async (req, res) => {
  const currentEdition = await getCurrentEdition();
  // AUTHOR_SELECT seul (name avatarUrl) ne suffit pas ici : l'email du gagnant
  // est nécessaire pour l'envoi de sendWinnerCongrats juste après.
  const winner = await CeremonyProject.findOne({ status: "approuvé", edition: currentEdition })
    .sort({ voteCount: -1, createdAt: 1 })
    .populate("studentId", `${AUTHOR_SELECT} email`)
    .lean();

  const settings = await getOrCreateCeremonySettings();
  settings.isVoteClosed = true;
  settings.winnerProjectId = winner ? winner._id : null;
  await settings.save();

  if (winner) {
    await Notification.create({
      userId:  winner.studentId._id,
      title:   "🏆 Vous avez gagné la Cérémonie !",
      message: `Félicitations, votre projet "${winner.title}" a remporté la Cérémonie ${currentEdition} !`,
      type:    "success",
      link:    "/ceremonie",
    });
    emailService.sendWinnerCongrats(winner.studentId.email, {
      studentName:  winner.studentId.name,
      projectTitle: winner.title,
      edition:      currentEdition,
    });

    const [voterIds, submitterIds] = await Promise.all([
      CeremonyVote.distinct("studentId"),
      CeremonyProject.distinct("studentId", { edition: currentEdition }),
    ]);
    const participantIds = [...new Set([...voterIds, ...submitterIds].map(String))]
      .filter((id) => id !== String(winner.studentId._id));

    if (participantIds.length > 0) {
      const participants = await User.find({ _id: { $in: participantIds } }).select("name email").lean();
      await Promise.all(participants.map((p) => Notification.create({
        userId:  p._id,
        title:   "Résultats de la Cérémonie",
        message: `La Cérémonie ${currentEdition} est terminée — le projet gagnant est "${winner.title}".`,
        type:    "info",
        link:    "/ceremonie",
      })));
      participants.forEach((p) => {
        emailService.sendCeremonyResults(p.email, {
          studentName:       p.name,
          winnerTitle:       winner.title,
          winnerStudentName: winner.studentId.name,
          edition:           currentEdition,
        });
      });
    }
  }

  res.json({ settings, winner });
});

/* ── POST /api/ceremony/admin/reset-votes ──────────────────────────────────────
   Réservé admin. Remet à 0 le voteCount des projets de L'ÉDITION EN COURS
   uniquement (pas toutes les éditions — sinon un reset lancé après le début
   d'une nouvelle édition effacerait les votes finaux, déjà archivés, des
   éditions précédentes) et supprime tous les CeremonyVote (les étudiants
   peuvent revoter — CeremonyVote n'a pas de champ edition : ses documents ne
   référencent que des projets de l'édition en cours tant que reset-votes est
   appelé avant de démarrer la suivante, donc les supprimer tous reste correct).
   Ne touche PAS à isVoteClosed/winnerProjectId/dates — action distincte de
   close-and-announce, pour ne pas rouvrir le vote ni effacer le gagnant
   annoncé sans le vouloir. */
export const resetVotes = asyncHandler(async (req, res) => {
  const currentEdition = await getCurrentEdition();
  await CeremonyProject.updateMany({ edition: currentEdition }, { $set: { voteCount: 0 } });
  const { deletedCount } = await CeremonyVote.deleteMany({});
  res.json({ message: "Votes réinitialisés.", deletedCount });
});

/* ── GET /api/ceremony/archives ────────────────────────────────────────────────
   Public. Liste résumée des éditions passées (edition < édition en cours) —
   voir décision actée : pas de tracking d'isVoteClosed par édition (singleton
   CeremonySettings), une édition devient "archivée" dès qu'une édition plus
   récente existe. */
export const getCeremonyArchives = asyncHandler(async (req, res) => {
  const currentEdition = await getCurrentEdition();
  const editions = await CeremonyProject.distinct("edition", { edition: { $lt: currentEdition } });

  const summaries = await Promise.all(
    editions.sort((a, b) => b - a).map(async (edition) => {
      const projects = await CeremonyProject.find({ edition, status: "approuvé" })
        .populate("studentId", AUTHOR_SELECT)
        .sort({ voteCount: -1 })
        .lean();
      return {
        edition,
        projectCount: projects.length,
        winner: projects[0] || null,
        totalVotes: projects.reduce((sum, p) => sum + p.voteCount, 0),
      };
    })
  );

  res.json({ editions: summaries });
});

/* ── GET /api/ceremony/archives/:edition ───────────────────────────────────────
   Public. Tous les projets approuvés d'une édition passée, lecture seule
   (pas de vote/QR côté frontend — cette route ne sert que la consultation). */
export const getCeremonyArchiveEdition = asyncHandler(async (req, res) => {
  const edition = Number(req.params.edition);
  const currentEdition = await getCurrentEdition();

  if (!Number.isFinite(edition) || edition >= currentEdition) {
    const err = new Error("Édition introuvable.");
    err.statusCode = 404;
    throw err;
  }

  const projects = await CeremonyProject.find({ edition, status: "approuvé" })
    .populate("studentId", AUTHOR_SELECT)
    .sort({ voteCount: -1 })
    .lean();

  if (projects.length === 0) {
    const err = new Error("Édition introuvable.");
    err.statusCode = 404;
    throw err;
  }

  res.json({ edition, projects });
});
