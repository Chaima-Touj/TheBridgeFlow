import mongoose from "mongoose";
import CeremonyProject from "../models/ceremonyProject.model.js";
import CeremonyVote from "../models/ceremonyVote.model.js";
import User from "../models/users.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import emailService from "../services/email.service.js";

const AUTHOR_SELECT = "name avatarUrl";

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
  });

  res.status(201).json(project);
});

// GET /api/ceremony/projects — public
export const getProjects = asyncHandler(async (req, res) => {
  const projects = await CeremonyProject.find()
    .populate("studentId", AUTHOR_SELECT)
    .sort({ createdAt: -1 })
    .lean();
  res.json({ projects });
});

// GET /api/ceremony/projects/:id — public
export const getProject = asyncHandler(async (req, res) => {
  const project = await CeremonyProject.findById(req.params.id)
    .populate("studentId", AUTHOR_SELECT)
    .lean();
  if (!project) {
    const err = new Error("Projet introuvable.");
    err.statusCode = 404;
    throw err;
  }
  res.json(project);
});

// GET /api/ceremony/my-projects — étudiant connecté
export const getMyProjects = asyncHandler(async (req, res) => {
  const projects = await CeremonyProject.find({ studentId: req.user._id })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ projects });
});

// GET /api/ceremony/leaderboard — public, trié par voteCount desc
export const getLeaderboard = asyncHandler(async (req, res) => {
  const projects = await CeremonyProject.find()
    .populate("studentId", AUTHOR_SELECT)
    .sort({ voteCount: -1, createdAt: 1 })
    .lean();
  res.json({ projects });
});

// POST /api/ceremony/vote — { projectIds: [id1, id2, id3] }, réservé aux étudiants
export const vote = asyncHandler(async (req, res) => {
  if (req.user.role !== "étudiant") {
    const err = new Error("Seuls les étudiants peuvent voter.");
    err.statusCode = 403;
    throw err;
  }

  const { projectIds } = req.body;

  if (!Array.isArray(projectIds) || projectIds.length !== 3) {
    const err = new Error("Le vote doit contenir exactement 3 projets.");
    err.statusCode = 400;
    throw err;
  }
  if (new Set(projectIds.map(String)).size !== 3) {
    const err = new Error("Les 3 projets doivent être distincts.");
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

  const projects = await CeremonyProject.find({ _id: { $in: projectIds } }).select("title").lean();
  if (projects.length !== 3) {
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
