import mongoose from "mongoose";
import PfePackRegistration from "../models/pfePackRegistration.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { validatePfePackRegistration } from "../utils/validatePfePackRegistration.js";

export const createPfePackRegistration = asyncHandler(async (req, res) => {
  const registration = await PfePackRegistration.create(validatePfePackRegistration(req.body));

  res.status(201).json({
    message: "Votre demande pour le Pack PFE a bien été envoyée.",
    registration: { id: registration._id },
  });
});

export const getPfePackRegistrations = asyncHandler(async (_req, res) => {
  const registrations = await PfePackRegistration.find()
    .sort({ createdAt: -1 })
    .select("firstName lastName email createdAt");
  res.json(registrations);
});

export const getPfePackRegistrationById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    const error = new Error("Identifiant de demande invalide.");
    error.statusCode = 400;
    throw error;
  }
  const registration = await PfePackRegistration.findById(req.params.id).select("-__v");
  if (!registration) {
    const error = new Error("Demande Pack PFE introuvable.");
    error.statusCode = 404;
    throw error;
  }
  res.json(registration);
});
