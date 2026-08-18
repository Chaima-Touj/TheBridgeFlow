import express from "express";
import {
  createProject, getProjects, getProject, getMyProjects, vote, getLeaderboard,
  getCeremonySettings, getAdminProjects, acceptProject, rejectProject,
  updateCeremonySettings, closeAndAnnounce, resetVotes,
} from "../controllers/ceremony.controller.js";
import { protect, authorize, validateObjectId } from "../middleware/auth.middleware.js";

const router = express.Router();

// ─── Public ─────────────────────────────────────────────────────────────────
router.get("/leaderboard",  getLeaderboard);
router.get("/settings",     getCeremonySettings);
router.get("/projects",     getProjects);
router.get("/projects/:id", validateObjectId(), getProject);

// ─── Étudiant connecté ──────────────────────────────────────────────────────
router.get("/my-projects",  protect, getMyProjects);
router.post("/projects",    protect, createProject);
router.post("/vote",        protect, vote);

// ─── Admin — modération, config, clôture ────────────────────────────────────
router.get("/admin/projects",              protect, authorize("admin"), getAdminProjects);
router.patch("/admin/projects/:id/accept", protect, authorize("admin"), validateObjectId(), acceptProject);
router.patch("/admin/projects/:id/reject", protect, authorize("admin"), validateObjectId(), rejectProject);
router.patch("/admin/settings",            protect, authorize("admin"), updateCeremonySettings);
router.post("/admin/close-and-announce",   protect, authorize("admin"), closeAndAnnounce);
router.post("/admin/reset-votes",          protect, authorize("admin"), resetVotes);

export default router;
