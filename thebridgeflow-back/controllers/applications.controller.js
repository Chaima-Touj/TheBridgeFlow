import Application from "../models/applications.model.js";
import Offer from "../models/offers.model.js";
import User from "../models/users.model.js";
import Notification from "../models/notification.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import emailService from "../services/email.service.js";

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

  // Email à l'étudiant — confirmation d'envoi
  emailService.sendApplicationSent(req.user.email, {
    studentName: req.user.name,
    offerTitle:  offer.title,
    companyName: offer.companyName,
  });

  // Notification (cloche) + email à tous les admins — nouvelle candidature
  // reçue. L'admin gère désormais les offres/candidatures (plus de compte
  // "entreprise" séparé à notifier via offer.companyId).
  const admins = await User.find({ role: "admin", isActive: true }).select("email name").lean();

  await Promise.all(
    admins.map((admin) =>
      Notification.create({
        userId:  admin._id,
        title:   "Nouvelle candidature",
        message: `${req.user.name} a postulé à l'offre "${offer.title}".`,
        type:    "info",
        link:    "/dashboard/admin/candidatures",
      })
    )
  );

  admins.forEach((admin) => {
    if (admin.email) {
      emailService.sendApplicationReceived(admin.email, {
        companyName:  admin.name,
        studentName:  req.user.name,
        studentEmail: req.user.email,
        offerTitle:   offer.title,
      });
    }
  });

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

  application.status = status;
  await application.save();

  // Notification in-app
  const statusMessages = {
    "acceptée": `Bonne nouvelle ! Ta candidature pour "${application.offerId.title}" a été acceptée.`,
    "refusée":  `Ta candidature pour "${application.offerId.title}" n'a pas été retenue cette fois.`,
    "en cours": `Ta candidature pour "${application.offerId.title}" est en cours d'examen.`,
  };

  if (statusMessages[status]) {
    await Notification.create({
      userId:  application.studentId,
      title:   "Mise à jour de candidature",
      message: statusMessages[status],
      type:    status === "acceptée" ? "success" : status === "refusée" ? "warning" : "info",
      link:    "/dashboard/student/applications",
    });
  }

  // Email à l'étudiant — statut mis à jour
  if (status !== "en attente") {
    const student = await User.findById(application.studentId).select("email name").lean();
    if (student?.email) {
      emailService.sendApplicationStatus(student.email, {
        studentName: student.name,
        offerTitle:  application.offerId.title,
        companyName: application.offerId.companyName,
        status,
      });
    }
  }

  res.json({ application });
});