import express from "express";
import { createApplication, getApplications, getApplication, updateStatus } from "../controllers/applications.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { uploadCV } from "../middleware/upload.middleware.js";
import { requireStudentPhone } from "../middleware/requireStudentPhone.middleware.js";

const router = express.Router();

router.post("/",              protect, requireStudentPhone, uploadCV, createApplication);
router.get("/",               protect, getApplications);
router.get("/:id",            protect, getApplication);
router.put("/:id/status",     protect, updateStatus);

export default router;
