import Application from "../models/applications.model.js";
import Interview from "../models/interview.model.js";
import Offer from "../models/offers.model.js";
import User from "../models/users.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { notifyAdmins, notifyUser } from "../services/notification.service.js";

// POST /api/applications — réservé aux étudiants
export const createApplication = asyncHandler(async (req, res) => {
  if (req.user.role !== "étudiant") {
    const err = new Error("Seuls les étudiants peuvent postuler à une offre");
    err.statusCode = 403;
    throw err;
  }

  const { offerId, coverLetter } = req.body;

  if (!offerId) {
    const err = new Error("offerId requis");
    err.statusCode = 400;
    throw err;
  }

  const existing = await Application.findOne({ offerId, studentId: req.user._id });
  if (existing) {
    const err = new Error("Tu as déjà postulé à cette offre");
    err.statusCode = 409;
    throw err;
  }

  const offer = await Offer.findById(offerId);
  if (!offer) {
    const err = new Error("Offre non trouvée");
    err.statusCode = 404;
    throw err;
  }

  const cvUrl = req.file ? `/uploads/${req.file.filename}` : "";

  const application = await Application.create({
    offerId,
    studentId: req.user._id,
    coverLetter,
    cvUrl,
  });

  const studentNotification = {
    title: "Candidature envoyée",
    message: `Votre candidature pour l'offre "${offer.title}" a bien été transmise.`,
    type: "success",
    link: "/dashboard/student/applications",
  };
  await notifyUser({
    userId: req.user._id,
    email: req.user.email,
    notification: studentNotification,
    emailMethod: "sendApplicationSent",
    emailData: {
      studentName: req.user.name,
      offerTitle: offer.title,
      companyName: offer.companyName,
    },
  });

  await notifyAdmins((admin) => ({
    notification: {
      title: "Nouvelle candidature",
      message: `${req.user.name} a postulé à l'offre "${offer.title}".`,
      type: "info",
      link: "/dashboard/admin/candidatures",
    },
    emailMethod: "sendApplicationReceived",
    emailData: {
      companyName: admin.name,
      studentName: req.user.name,
      studentEmail: req.user.email,
      offerTitle: offer.title,
    },
  }));

  res.status(201).json({ application });
});

// GET /api/applications
export const getApplications = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.role === "étudiant") filter.studentId = req.user._id;

  const applications = await Application.find(filter)
    .populate("offerId",   "title companyName location type companyId")
    .populate("studentId", "name email university specialty")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ count: applications.length, applications });
});

// GET /api/applications/:id
export const getApplication = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id)
    .populate("offerId")
    .populate("studentId", "name email university specialty phone");

  if (!application) {
    const err = new Error("Candidature non trouvée");
    err.statusCode = 404;
    throw err;
  }

  const isOwnerStudent = application.studentId._id.toString() === req.user._id.toString();

  if (!isOwnerStudent && req.user.role !== "admin") {
    const err = new Error("Vous n'êtes pas autorisé à consulter cette candidature");
    err.statusCode = 403;
    throw err;
  }

  res.json({ application });
});

// PUT /api/applications/:id/status — réservé à l'admin
export const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ["en attente", "acceptée", "refusée", "en cours"];

  if (!validStatuses.includes(status)) {
    const err = new Error("Statut invalide");
    err.statusCode = 400;
    throw err;
  }

  const application = await Application.findById(req.params.id).populate("offerId");
  if (!application) {
    const err = new Error("Candidature non trouvée");
    err.statusCode = 404;
    throw err;
  }

  if (req.user.role !== "admin") {
    const err = new Error("Vous n'êtes pas autorisé à modifier cette candidature");
    err.statusCode = 403;
    throw err;
  }

  // Décision finale (acceptée/refusée) : réservée à l'issue d'un entretien déjà
  // proposé — on ne bascule plus directement depuis "en attente".
  if (["acceptée", "refusée"].includes(status) && application.status !== "en cours") {
    const err = new Error("Un entretien doit d'abord être proposé avant d'accepter ou de refuser cette candidature.");
    err.statusCode = 409;
    throw err;
  }

  if (
    ["acceptée", "refusée"].includes(status) &&
    !await Interview.exists({ applicationId: application._id })
  ) {
    const err = new Error("Aucun entretien enregistré pour cette candidature. Actualisez la page avant de prendre une décision.");
    err.statusCode = 409;
    throw err;
  }

  const previousStatus = application.status;
  if (previousStatus === status) return res.json({ application });

  const updatedApplication = await Application.findOneAndUpdate(
    { _id: application._id, status: previousStatus },
    { $set: { status } },
    { new: true }
  ).populate("offerId");
  if (!updatedApplication) {
    const err = new Error("La candidature a été modifiée par une autre action. Actualisez la page.");
    err.statusCode = 409;
    throw err;
  }

  // Notification in-app
  const statusMessages = {
    "acceptée": `Bonne nouvelle ! Ta candidature pour "${updatedApplication.offerId.title}" a été acceptée.`,
    "refusée":  `Ta candidature pour "${updatedApplication.offerId.title}" n'a pas été retenue cette fois.`,
    "en cours": `Ta candidature pour "${updatedApplication.offerId.title}" est en cours d'examen.`,
  };

  if (statusMessages[status]) {
    const student = await User.findById(updatedApplication.studentId).select("email name").lean();
    await notifyUser({
      userId: updatedApplication.studentId,
      email: student?.email,
      notification: {
        title: "Mise à jour de candidature",
        message: statusMessages[status],
        type: status === "acceptée" ? "success" : status === "refusée" ? "warning" : "info",
        link: "/dashboard/student/applications",
      },
      ...(status !== "en attente" ? {
        emailMethod: "sendApplicationStatus",
        emailData: {
        studentName: student.name,
        offerTitle: updatedApplication.offerId.title,
        companyName: updatedApplication.offerId.companyName,
        status,
        },
      } : {}),
    });
  }

  res.json({ application: updatedApplication });
});