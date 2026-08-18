import express from "express";
import {
  createProject, getProjects, getProject, getMyProjects, vote, getLeaderboard,
} from "../controllers/ceremony.controller.js";
import { protect, validateObjectId } from "../middleware/auth.middleware.js";

const router = express.Router();

// ─── Public ─────────────────────────────────────────────────────────────────
router.get("/leaderboard",  getLeaderboard);
router.get("/projects",     getProjects);
router.get("/projects/:id", validateObjectId(), getProject);

// ─── Étudiant connecté ──────────────────────────────────────────────────────
router.get("/my-projects",  protect, getMyProjects);
router.post("/projects",    protect, createProject);
router.post("/vote",        protect, vote);

export default router;
