import mongoose from "mongoose";
import EnrollmentRequest from "../models/enrollmentRequest.model.js";
import Formation         from "../models/formation.model.js";
import Enrollment        from "../models/enrollment.model.js";
import User              from "../models/users.model.js";
import asyncHandler      from "../utils/asyncHandler.js";
import { buildInitialWeekProgress } from "../utils/enrollmentProgress.js";
import { notifyAdmins, notifyUser } from "../services/notification.service.js";

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

  let request;
  try {
    request = await EnrollmentRequest.create({
      student:   req.user._id,
      formation: formationId,
      mode,
      message:   message?.trim() || "",
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicateError = new Error("Vous avez déjà soumis une demande pour cette formation.");
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }

  await request.populate("formation", "title slug");

  // Notification (cloche) à tous les admins actifs — même pattern que les candidatures.
  await notifyAdmins((admin) => ({
    notification: {
      title: "Nouvelle demande d'inscription",
      message: `${req.user.name} a demandé l'inscription à la formation "${request.formation.title}".`,
      type: "info",
      link: "/dashboard/admin/demandes",
    },
    emailMethod: "sendEnrollmentRequestReceived",
    emailData: {
      adminName: admin.name,
      studentName: req.user.name,
      studentEmail: req.user.email,
      studentPhone: req.user.phone,
      formationTitle: request.formation.title,
      mode,
    },
  }));

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
  const request = await EnrollmentRequest.findOneAndUpdate(
    { _id: req.params.id, status: "en_attente" },
    { $set: { status: "acceptée" } },
    { new: true }
  );
  if (!request) {
    const existingRequest = await EnrollmentRequest.findById(req.params.id).select("_id");
    if (!existingRequest) {
      const err = new Error("Demande introuvable."); err.statusCode = 404; throw err;
    }
    const err = new Error("Cette demande a déjà été traitée."); err.statusCode = 409; throw err;
  }

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

  const student = await User.findById(request.student).select("name email").lean();
  await notifyUser({
    userId: request.student,
    email: student?.email,
    notification: {
      title: "Demande d'inscription acceptée",
      message: `Votre demande d'inscription à "${request.formation.title}" a été acceptée.`,
      type: "success",
      link: request.formation.slug
        ? `/dashboard/student/formations/${request.formation.slug}`
        : "/dashboard/student/demandes",
    },
    emailMethod: "sendEnrollmentRequestStatus",
    emailData: {
      studentName: student?.name || "Étudiant",
      formationTitle: request.formation.title,
      status: "acceptée",
      link: request.formation.slug
        ? `/dashboard/student/formations/${request.formation.slug}`
        : "/dashboard/student/demandes",
    },
  });

  res.json(request);
});

/* ── PATCH /api/enrollment-requests/:id/reject ────────────────────────────────
   Refuser une demande — réservé à l'admin.                                    */
export const rejectRequest = asyncHandler(async (req, res) => {
  const request = await EnrollmentRequest.findOneAndUpdate(
    { _id: req.params.id, status: "en_attente" },
    { $set: { status: "refusée" } },
    { new: true }
  );
  if (!request) {
    const existingRequest = await EnrollmentRequest.findById(req.params.id).select("_id");
    if (!existingRequest) {
      const err = new Error("Demande introuvable."); err.statusCode = 404; throw err;
    }
    const err = new Error("Cette demande a déjà été traitée."); err.statusCode = 409; throw err;
  }

  await request.populate("formation", "title slug duration level");

  const student = await User.findById(request.student).select("name email").lean();
  await notifyUser({
    userId: request.student,
    email: student?.email,
    notification: {
      title: "Demande d'inscription refusée",
      message: `Votre demande d'inscription à "${request.formation.title}" n'a pas été retenue.`,
      type: "warning",
      link: "/dashboard/student/demandes",
    },
    emailMethod: "sendEnrollmentRequestStatus",
    emailData: {
      studentName: student?.name || "Étudiant",
      formationTitle: request.formation.title,
      status: "refusée",
      link: "/dashboard/student/demandes",
    },
  });

  res.json(request);
});
