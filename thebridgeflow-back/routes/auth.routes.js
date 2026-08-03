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
  changePassword,
  updateSettings,
  deleteAccount,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { uploadCV } from "../middleware/upload.middleware.js";

const router = express.Router();

router.post("/register",     register);
router.post("/login",        login);
router.post("/google",       googleAuth);
router.post("/facebook",     facebookAuth);
router.post("/verify-email", verifyEmail);
router.post("/resend-code",  resendCode);
router.post("/forgot-password",        forgotPassword);
router.post("/reset-password/:token",  resetPassword);
router.get("/me",            protect, getMe);
router.put("/profile",       protect, updateProfile);
router.post("/profile/cv",   protect, uploadCV, uploadProfileCV);
router.post("/logout",       protect, logout);
router.put("/password",      protect, changePassword);
router.put("/settings",      protect, updateSettings);
router.delete("/account",    protect, deleteAccount);

export default router;