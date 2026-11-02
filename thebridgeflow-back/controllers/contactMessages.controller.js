import ContactSubmission from "../models/contactSubmission.model.js";
import Notification from "../models/notification.model.js";
import User from "../models/users.model.js";
import asyncHandler from "../utils/asyncHandler.js";

const fail = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

export const createContactSubmission = asyncHandler(async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const subject = typeof req.body.subject === "string" ? req.body.subject.trim() : "";
  const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
  if (!name || !subject || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail("Veuillez remplir tous les champs avec une adresse email valide.", 400);
  }
  if (name.length > 120 || email.length > 254 || subject.length > 180 || message.length > 5000) {
    fail("Un ou plusieurs champs dépassent la longueur autorisée.", 400);
  }

  const submission = await ContactSubmission.create({ name, email, subject, message });
  try {
    const admins = await User.find({ role: "admin", isActive: true }).select("_id").lean();
    if (admins.length) {
      await Notification.insertMany(admins.map((admin) => ({
        userId: admin._id,
        title: "Nouveau message depuis le site",
        message: `${name} — ${subject}`,
        type: "info",
        link: "/dashboard/admin/contact-messages",
      })));
    }
  } catch (error) {
    console.error("[contact] Failed to notify administrators", { message: error.message });
  }
  res.status(201).json({ message: "Votre message a été envoyé." });
});

export const getContactSubmissions = asyncHandler(async (_req, res) => {
  const submissions = await ContactSubmission.find().sort({ createdAt: -1 }).lean();
  res.json({ submissions });
});

export const markContactSubmissionRead = asyncHandler(async (req, res) => {
  const submission = await ContactSubmission.findByIdAndUpdate(
    req.params.id,
    { $set: { isRead: true } },
    { new: true }
  ).lean();
  if (!submission) fail("Message introuvable.", 404);
  res.json({ submission });
});
