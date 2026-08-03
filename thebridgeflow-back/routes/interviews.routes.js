import express from "express";
import { proposeInterview, getInterviews, updateInterviewStatus } from "../controllers/interviews.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/",            protect, proposeInterview);
router.get("/",              protect, getInterviews);
router.put("/:id/status",    protect, updateInterviewStatus);

export default router;
