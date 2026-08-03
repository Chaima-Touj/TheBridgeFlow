import mongoose from "mongoose";
import Enrollment from "../models/enrollment.model.js";
import Formation  from "../models/formation.model.js";
import Notification from "../models/notification.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildInitialWeekProgress } from "../utils/enrollmentProgress.js";

/* ── GET /api/enrollments ─────────────────────────────────────────────────────
   Toutes les inscriptions de l'étudiant connecté, formation peuplée           */
export const getMyEnrollments = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ student: req.user._id })
    .populate("formation")
    .sort("-createdAt")
    .lean();
  res.json(enrollments);
});

/* ── GET /api/enrollments/:formationId ────────────────────────────────────────
   Inscription de l'étudiant pour une formation spécifique                     */
export const getMyEnrollment = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.formationId)) {
    const err = new Error("Identifiant invalide"); err.statusCode = 400; throw err;
  }
  const enrollment = await Enrollment.findOne({
    student:   req.user._id,
    formation: req.params.formationId,
  }).populate("formation").lean();

  if (!enrollment) {
    const err = new Error("Inscription introuvable."); err.statusCode = 404; throw err;
  }
  res.json(enrollment);
});

/* ── GET /api/enrollments/admin?status= ───────────────────────────────────────
   Toutes les inscriptions (tous étudiants confondus) — réservé à l'admin.
   `status` optionnel : not_started | in_progress | completed.                 */
export const getAllEnrollments = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (["not_started", "in_progress", "completed"].includes(status)) filter.overallStatus = status;

  const enrollments = await Enrollment.find(filter)
    .populate("student", "name email university specialty")
    .populate("formation", "title slug duration level")
    .sort("-createdAt")
    .lean();

  res.json(enrollments);
});

/* ── DELETE /api/enrollments/admin/:id ────────────────────────────────────────
   Annule (supprime) une inscription — réservé à l'admin.                     */
export const cancelEnrollment = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findById(req.params.id).populate("formation", "title slug");
  if (!enrollment) {
    const err = new Error("Inscription introuvable."); err.statusCode = 404; throw err;
  }

  const { student, formation } = enrollment;
  await enrollment.deleteOne();

  // Notification in-app
  await Notification.create({
    userId:  student,
    title:   "Inscription annulée",
    message: `Votre inscription à "${formation.title}" a été annulée par l'administration.`,
    type:    "warning",
    link:    formation.slug ? `/dashboard/student/formations/${formation.slug}` : "/dashboard/student/formations",
  });

  res.json({ message: "Inscription annulée.", id: req.params.id });
});

/* ── POST /api/enrollments ────────────────────────────────────────────────────
   Inscrire l'étudiant à une formation                                         */
export const enroll = asyncHandler(async (req, res) => {
  const { formationId } = req.body;
  if (!formationId || !mongoose.Types.ObjectId.isValid(formationId)) {
    const err = new Error("formationId invalide ou manquant."); err.statusCode = 400; throw err;
  }

  const formation = await Formation.findById(formationId);
  if (!formation) {
    const err = new Error("Formation introuvable."); err.statusCode = 404; throw err;
  }

  const existing = await Enrollment.findOne({ student: req.user._id, formation: formationId });
  if (existing) {
    const err = new Error("Vous êtes déjà inscrit à cette formation."); err.statusCode = 409; throw err;
  }

  const weekProgress = buildInitialWeekProgress(formation.weeks);

  const enrollment = await Enrollment.create({
    student:   req.user._id,
    formation: formationId,
    weekProgress,
    overallStatus: "in_progress",
  });

  await enrollment.populate("formation");
  res.status(201).json(enrollment);
});

/* ── PATCH /api/enrollments/:formationId/weeks/:weekNum ───────────────────────
   Met à jour le statut d'une semaine (done / not_started)                     */
export const updateWeekStatus = asyncHandler(async (req, res) => {
  const { formationId, weekNum } = req.params;
  const { status } = req.body;

  if (!["done", "not_started", "in_progress"].includes(status)) {
    const err = new Error("Statut invalide. Valeurs acceptées : done, not_started, in_progress.");
    err.statusCode = 400; throw err;
  }

  const enrollment = await Enrollment.findOne({
    student:   req.user._id,
    formation: formationId,
  });
  if (!enrollment) {
    const err = new Error("Inscription introuvable."); err.statusCode = 404; throw err;
  }

  const num = Number(weekNum);
  const idx = enrollment.weekProgress.findIndex(w => w.weekNumber === num);
  if (idx === -1) {
    const err = new Error("Semaine introuvable dans cette inscription."); err.statusCode = 404; throw err;
  }

  enrollment.weekProgress[idx].status = status;
  if (status === "done") {
    enrollment.weekProgress[idx].completedAt = new Date();
    // Débloquer automatiquement la semaine suivante
    const next = enrollment.weekProgress[idx + 1];
    if (next && next.status === "not_started") {
      enrollment.weekProgress[idx + 1].status = "in_progress";
    }
  }

  // Recalculer le statut global
  const allDone = enrollment.weekProgress.every(w => w.status === "done");
  const anyStarted = enrollment.weekProgress.some(w => w.status !== "not_started");
  enrollment.overallStatus = allDone ? "completed" : anyStarted ? "in_progress" : "not_started";

  await enrollment.save();
  await enrollment.populate("formation");
  res.json(enrollment);
});
