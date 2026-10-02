import Interview from "../models/interview.model.js";
import Application from "../models/applications.model.js";
import User from "../models/users.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { notifyUser } from "../services/notification.service.js";
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
  // Claim the pending application before creating the interview so concurrent
  // proposals cannot both pass the same eligibility check.
  const claimedApplication = await Application.findOneAndUpdate(
    { _id: application._id, status: "en attente" },
    { $set: { status: "en cours" } },
    { new: true }
  );
  if (!claimedApplication) {
    const err = new Error("Un entretien a déjà été proposé (ou une décision a déjà été prise) pour cette candidature.");
    err.statusCode = 409;
    throw err;
  }

  let interview;
  try {
    interview = await Interview.create({
      applicationId,
      studentId:   claimedApplication.studentId,
      companyId:   req.user._id,
      scheduledAt,
      mode,
      location,
      notes,
    });
  } catch (error) {
    try {
      await Application.updateOne(
        { _id: claimedApplication._id, status: "en cours" },
        { $set: { status: "en attente" } }
      );
    } catch (rollbackError) {
      console.error("[interviews] Failed to restore application after proposal error", {
        applicationId: String(claimedApplication._id),
        message: rollbackError.message,
      });
    }
    throw error;
  }

  // Notification in-app — reprend le message personnalisé saisi dans le formulaire
  // (pré-rempli côté client), sinon un texte par défaut équivalent.
  const scheduledDate = new Date(scheduledAt);
  const defaultMessage = `Nous vous proposons un entretien le ${scheduledDate.toLocaleDateString("fr-FR")} à ${scheduledDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} en ${mode || "en ligne"}. Merci de confirmer votre disponibilité.`;
  const student = await User.findById(claimedApplication.studentId).select("email name").lean();
  application.status = "en cours";
  await notifyUser({
    userId: claimedApplication.studentId,
    email: student?.email,
    notification: {
      title: "Entretien proposé",
      message: notes?.trim() || defaultMessage,
      type: "info",
      link: "/dashboard/student/interviews",
    },
    emailMethod: "sendInterviewProposed",
    emailData: {
      studentName: student.name,
      companyName: application.offerId.companyName || req.user.name,
      offerTitle:  application.offerId.title,
      scheduledAt,
      mode:        mode || "en ligne",
      location:    location || "",
    },
  });

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

  const previousStatus = interview.status;
  if (previousStatus === status) return res.json({ interview });

  const updatedInterview = await Interview.findOneAndUpdate(
    { _id: interview._id, status: previousStatus },
    { $set: { status } },
    { new: true }
  ).populate({ path: "applicationId", populate: { path: "offerId", select: "title companyName" } });
  if (!updatedInterview) {
    const err = new Error("L'entretien a été modifié par une autre action. Actualisez la page.");
    err.statusCode = 409;
    throw err;
  }

  // Notify the other party only; the actor already knows about their change.
  if (["confirmé", "annulé", "terminé"].includes(status)) {
    const offerTitle  = updatedInterview.applicationId?.offerId?.title || "Stage";
    const scheduledAt = updatedInterview.scheduledAt;

    const [student, company] = await Promise.all([
      User.findById(updatedInterview.studentId).select("email name").lean(),
      User.findById(updatedInterview.companyId).select("email name").lean(),
    ]);
    const recipient = isStudent ? company : student;
    const link = isStudent ? "/dashboard/admin/candidatures" : "/dashboard/student/interviews";
    await notifyUser({
      userId: isStudent ? updatedInterview.companyId : updatedInterview.studentId,
      email: recipient?.email,
      notification: {
        title: `Entretien ${status}`,
        message: `${isStudent ? student?.name || "L'étudiant" : "L'administration"} a ${status === "confirmé" ? "confirmé" : status === "annulé" ? "annulé" : "mis à jour"} l'entretien pour l'offre "${offerTitle}".`,
        type: status === "confirmé" ? "success" : status === "annulé" ? "warning" : "info",
        link,
      },
      emailMethod: "sendInterviewStatus",
      emailData: {
        recipientName: recipient?.name || (isStudent ? "Administrateur" : "Étudiant"),
        status,
        offerTitle,
        scheduledAt,
        recipientRole: isStudent ? "admin" : "étudiant",
        link,
        linkLabel: isStudent ? "Gérer les candidatures" : "Voir mes entretiens",
      },
    });
  }

  res.json({ interview: updatedInterview });
});