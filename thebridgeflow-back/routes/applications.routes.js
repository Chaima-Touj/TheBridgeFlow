import express from "express";
import { createApplication, getApplications, getApplication, updateStatus } from "../controllers/applications.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { uploadApplicationFiles } from "../middleware/upload.middleware.js";
import { requireStudentPhone } from "../middleware/requireStudentPhone.middleware.js";
import { verifyRecaptcha } from "../middleware/recaptcha.middleware.js";

const router = express.Router();

// reCAPTCHA vérifié avant l'upload : une requête refusée n'écrit aucun fichier sur le disque.
router.post("/", protect, requireStudentPhone, verifyRecaptcha, (req, res, next) => {
  uploadApplicationFiles(req, res, (error) => {
    if (error) {
      const uploadError = new Error(error.message);
      uploadError.statusCode = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return next(uploadError);
    }
    next();
  });
}, createApplication);
router.get("/",               protect, getApplications);
router.get("/:id",            protect, getApplication);
router.put("/:id/status",     protect, updateStatus);

export default router;
