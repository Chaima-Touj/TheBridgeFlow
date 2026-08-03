import mongoose from "mongoose";
import EnrollmentRequest from "../models/enrollmentRequest.model.js";
import Formation         from "../models/formation.model.js";
import Enrollment        from "../models/enrollment.model.js";
import Notification      from "../models/notification.model.js";
import asyncHandler      from "../utils/asyncHandler.js";
import { buildInitialWeekProgress } from "../utils/enrollmentProgress.js";

/* ── POST /api/enrollment-requests ────────────────────────────────────────────
   Soumettre une demande d'inscription à une formation                          */
export const createRequest = asyncHandler(async (req, res) => {
  const { formationId, mode, message } = req.body;

  if (!formationId || !mongoose.Types.ObjectId.isValid(formationId)) {
    const err = new Error("formationId invalide ou manquant."); err.statusCode = 400; throw err;
  }
  if (!["Présentiel", "En ligne"].includes(mode)) {
    const err = new Error("Mode invalide. Valeurs acceptées : Présentiel, En ligne."); err.statusCode = 400; throw err;
  }

  const formation = await Formation.findById(formationId);
  if (!formation) {
    const err = new Error("Formation introuvable."); err.statusCode = 404; throw err;
  }

  const existing = await EnrollmentRequest.findOne({ student: req.user._id, formation: formationId });
  if (existing) {
    const err = new Error("Vous avez déjà soumis une demande pour cette formation."); err.statusCode = 409; throw err;
  }

  const request = await EnrollmentRequest.create({
    student:   req.user._id,
    formation: formationId,
    mode,
    message:   message?.trim() || "",
  });

  await request.populate("formation", "title slug");
  res.status(201).json(request);
});

/* ── GET /api/enrollment-requests ─────────────────────────────────────────────
   Toutes les demandes de l'étudiant connecté                                   */
export const getMyRequests = asyncHandler(async (req, res) => {
  const requests = await EnrollmentRequest.find({ student: req.user._id })
    .populate("formation", "title slug duration level")
    .sort("-createdAt")
    .lean();
  res.json(requests);
});

/* ── GET /api/enrollment-requests/admin?status= ───────────────────────────────
   Toutes les demandes (tous étudiants confondus) — réservé à l'admin.
   `status` optionnel : en_attente | acceptée | refusée.                       */
export const getAllRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (["en_attente", "acceptée", "refusée"].includes(status)) filter.status = status;

  const requests = await EnrollmentRequest.find(filter)
    .populate("student", "name email university specialty")
    .populate("formation", "title slug duration level")
    .sort("-createdAt")
    .lean();

  res.json(requests);
});

/* ── PATCH /api/enrollment-requests/:id/accept ────────────────────────────────
   Accepter une demande — réservé à l'admin. Crée l'Enrollment correspondant
   s'il n'existe pas déjà.                                                     */
export const acceptRequest = asyncHandler(async (req, res) => {
  const request = await EnrollmentRequest.findById(req.params.id);
  if (!request) {
    const err = new Error("Demande introuvable."); err.statusCode = 404; throw err;
  }
  if (request.status !== "en_attente") {
    const err = new Error("Cette demande a déjà été traitée."); err.statusCode = 409; throw err;
  }

  request.status = "acceptée";
  await request.save();

  const existingEnrollment = await Enrollment.findOne({
    student:   request.student,
    formation: request.formation,
  });
  if (!existingEnrollment) {
    const formation = await Formation.findById(request.formation);
    await Enrollment.create({
      student:      request.student,
      formation:    request.formation,
      weekProgress: buildInitialWeekProgress(formation?.weeks),
    });
  }

  await request.populate("formation", "title slug duration level");

  // Notification in-app
  await Notification.create({
    userId:  request.student,
    title:   "Demande d'inscription acceptée",
    message: `Votre demande d'inscription à "${request.formation.title}" a été acceptée.`,
    type:    "success",
    link:    "/dashboard/student/demandes",
  });

  res.json(request);
});

/* ── PATCH /api/enrollment-requests/:id/reject ────────────────────────────────
   Refuser une demande — réservé à l'admin.                                    */
export const rejectRequest = asyncHandler(async (req, res) => {
  const request = await EnrollmentRequest.findById(req.params.id);
  if (!request) {
    const err = new Error("Demande introuvable."); err.statusCode = 404; throw err;
  }
  if (request.status !== "en_attente") {
    const err = new Error("Cette demande a déjà été traitée."); err.statusCode = 409; throw err;
  }

  request.status = "refusée";
  await request.save();

  await request.populate("formation", "title slug duration level");

  // Notification in-app
  await Notification.create({
    userId:  request.student,
    title:   "Demande d'inscription refusée",
    message: `Votre demande d'inscription à "${request.formation.title}" n'a pas été retenue.`,
    type:    "warning",
    link:    "/dashboard/student/demandes",
  });

  res.json(request);
});
