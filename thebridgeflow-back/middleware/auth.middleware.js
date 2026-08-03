import asyncHandler from "../utils/asyncHandler.js";
import { verifyToken } from "../utils/jwt.js";
import User from "../models/users.model.js";
import mongoose from "mongoose";

// Validation ObjectId — réutilisable sur toutes les routes avec :id
export const validateObjectId = (paramName = "id") => (req, res, next) => {
  const id = req.params[paramName];
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error(`Identifiant invalide : ${paramName}`);
    err.statusCode = 400;
    return next(err);
  }
  next();
};

// Protection JWT
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization || "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    const err = new Error("Non autorisé, token manquant");
    err.statusCode = 401;
    throw err;
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (error) {
    error.statusCode = 401;
    throw error;
  }

  if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
    const err = new Error("Token invalide");
    err.statusCode = 401;
    throw err;
  }

  const user = await User.findById(decoded.id).lean();
  if (!user) {
    const err = new Error("Utilisateur introuvable");
    err.statusCode = 401;
    throw err;
  }

  // Révoque immédiatement l'accès si le compte a été désactivé après
  // l'émission du token (sinon un compte désactivé garde un accès complet
  // tant que son JWT n'a pas expiré — le login seul ne suffit pas).
  if (user.isActive === false) {
    const err = new Error("Ce compte a été désactivé.");
    err.statusCode = 403;
    throw err;
  }

  req.user = user;
  next();
});

// RBAC — vérification de rôle
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      const err = new Error("Non authentifié");
      err.statusCode = 401;
      return next(err);
    }
    if (!allowedRoles.includes(req.user.role)) {
      const err = new Error(`Accès refusé. Rôle requis : ${allowedRoles.join(", ")}`);
      err.statusCode = 403;
      return next(err);
    }
    next();
  };
};
