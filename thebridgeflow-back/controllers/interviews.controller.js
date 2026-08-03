import Interview from "../models/interview.model.js";
import Application from "../models/applications.model.js";
import Notification from "../models/notification.model.js";
import User from "../models/users.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import emailService from "../services/email.service.js";
import { autoCompletePastInterviews } from "../utils/interviewStatus.js";

// POST /api/interviews — réservé à l'admin
export const proposeInterview = asyncHandler(async (req, res) => {
  const { applicationId, scheduledAt, mode, location, notes } = req.body;

  if (!applicationId || !scheduledAt) {
    const err = new Error("applicationId et scheduledAt requis");
    err.statusCode = 400;
    throw err;
  }

  const application = await Application.findById(applicationId).populate("offerId");
  if (!application) {
    const err = new Error("Candidature non trouvée");
    err.statusCode = 404;
    throw err;
  }

  if (req.user.role !== "admin") {
    const err = new Error("Vous n'êtes pas autorisé à proposer un entretien pour cette candidature");
    err.statusCode = 403;
    throw err;
  }

  // Un entretien est déjà en cours de traitement pour cette candidature, ou elle
  // a déjà reçu une décision finale — on ne repropose pas par-dessus.
  if (application.status !== "en attente") {
    const err = new Error("Un entretien a déjà été proposé (ou une décision a déjà été prise) pour cette candidature.");
    err.statusCode = 409;
    throw err;
  }

  // companyId identifie désormais l'admin qui gère l'entretien (il n'y a plus
  // de compte "entreprise" séparé) — conservé sur Interview pour l'affichage
  // et la traçabilité, sans logique d'autorisation dessus.
  const interview = await Interview.create({
    applicationId,
    studentId:   application.studentId,
    companyId:   req.user._id,
    scheduledAt,
    mode,
    location,
    notes,
  });

  // La candidature passe en cours de traitement — l'admin ne peut plus
  // accepter/refuser directement, seulement se prononcer une fois l'entretien passé.
  application.status = "en cours";
  await application.save();

  // Notification in-app — reprend le message personnalisé saisi dans le formulaire
  // (pré-rempli côté client), sinon un texte par défaut équivalent.
  const scheduledDate = new Date(scheduledAt);
  const defaultMessage = `Nous vous proposons un entretien le ${scheduledDate.toLocaleDateString("fr-FR")} à ${scheduledDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} en ${mode || "en ligne"}. Merci de confirmer votre disponibilité.`;
  await Notification.create({
    userId:  application.studentId,
    title:   "Entretien proposé",
    message: notes?.trim() || defaultMessage,
    type:    "info",
    link:    "/dashboard/student/interviews",
  });

  // Email à l'étudiant — entretien proposé
  const student = await User.findById(application.studentId).select("email name").lean();
  if (student?.email) {
    emailService.sendInterviewProposed(student.email, {
      studentName: student.name,
      companyName: application.offerId.companyName || req.user.name,
      offerTitle:  application.offerId.title,
      scheduledAt,
      mode:        mode || "en ligne",
      location:    location || "",
    });
  }

  res.status(201).json({ interview, application });
});

// GET /api/interviews
export const getInterviews = asyncHandler(async (req, res) => {
  const filter =
    req.user.role === "admin" ? {} :
    { studentId: req.user._id };

  await autoCompletePastInterviews(filter);

  const interviews = await Interview.find(filter)
    .populate({ path: "applicationId", populate: { path: "offerId", select: "title companyName" } })
    .populate("studentId", "name email")
    .populate("companyId", "name")
    .sort({ scheduledAt: 1 })
    .lean();

  res.json({ count: interviews.length, interviews });
});

// PUT /api/interviews/:id/status
export const updateInterviewStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ["proposé", "confirmé", "annulé", "terminé"];

  if (!validStatuses.includes(status)) {
    const err = new Error("Statut invalide");
    err.statusCode = 400;
    throw err;
  }

  const interview = await Interview.findById(req.params.id)
    .populate({ path: "applicationId", populate: { path: "offerId", select: "title companyName" } });

  if (!interview) {
    const err = new Error("Entretien non trouvé");
    err.statusCode = 404;
    throw err;
  }

  const isStudent = interview.studentId.toString() === req.user._id.toString();

  if (!isStudent && req.user.role !== "admin") {
    const err = new Error("Vous n'êtes pas autorisé à modifier cet entretien");
    err.statusCode = 403;
    throw err;
  }

  interview.status = status;
  await interview.save();

  // Email aux deux parties concernées si statut important
  if (["confirmé", "annulé", "terminé"].includes(status)) {
    const offerTitle  = interview.applicationId?.offerId?.title || "Stage";
    const scheduledAt = interview.scheduledAt;

    const [student, company] = await Promise.all([
      User.findById(interview.studentId).select("email name").lean(),
      User.findById(interview.companyId).select("email name").lean(),
    ]);

    if (student?.email) {
      emailService.sendInterviewStatus(student.email, {
        recipientName: student.name,
        status,
        offerTitle,
        scheduledAt,
      });
    }

    if (company?.email && status === "confirmé") {
      emailService.sendInterviewStatus(company.email, {
        recipientName: company.name,
        status,
        offerTitle,
        scheduledAt,
      });
    }
  }

  res.json({ interview });
});