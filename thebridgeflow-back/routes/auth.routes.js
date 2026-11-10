import express from "express";
import {
  register,
  login,
  googleAuth,
  facebookAuth,
  getMe,
  logout,
  updateProfile,
  verifyEmail,
  resendCode,
  forgotPassword,
  resetPassword,
  uploadProfileCV,
  deleteProfileCV,
  changePassword,
  updateSettings,
  deleteAccount,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { uploadCV } from "../middleware/upload.middleware.js";
import { verifyRecaptcha, verifyRecaptchaCheckbox } from "../middleware/recaptcha.middleware.js";
// Créer un routeur Express
const router = express.Router();
// Définir les routes pour l'authentification et la gestion du compte
// (reCAPTCHA sur les formulaires publics ; Google/Facebook sont déjà vérifiés par le fournisseur)
router.post("/register",     verifyRecaptcha, register);
router.post("/login",        verifyRecaptchaCheckbox, login);
router.post("/google",       googleAuth);
router.post("/facebook",     facebookAuth);
router.post("/verify-email", verifyRecaptcha, verifyEmail);
router.post("/resend-code",  verifyRecaptcha, resendCode);
router.post("/forgot-password",        verifyRecaptcha, forgotPassword);
router.post("/reset-password/:token",  verifyRecaptcha, resetPassword);
router.get("/me",            protect, getMe);
router.put("/profile",       protect, updateProfile);
router.post("/profile/cv",   protect, uploadCV, uploadProfileCV);
router.delete("/profile/cv", protect, deleteProfileCV);
router.post("/logout",       protect, logout);
router.put("/password",      protect, changePassword);
router.put("/settings",      protect, updateSettings);
router.delete("/account",    protect, deleteAccount);

export default router;