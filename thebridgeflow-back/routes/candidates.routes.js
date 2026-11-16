import express from "express";
import { authorize, validateObjectId } from "../middleware/auth.middleware.js";
import {
  getCandidateStats,
  listCandidates,
  getCandidateDossier,
  getCandidateDocument,
  getStudentTasks,
  createStudentTask,
  updateStudentTask,
  deleteStudentTask,
} from "../controllers/candidates.controller.js";

// Monté dans admin.routes.js APRÈS protect + authorize("admin") :
// base /api/admin/candidates. authorize est répété ici par défense en profondeur.
const router = express.Router();
router.use(authorize("admin"));

const student = validateObjectId("studentId");
const task = validateObjectId("taskId");

router.get("/stats", getCandidateStats);
router.get("/", listCandidates);
router.get("/:studentId", student, getCandidateDossier);
router.get("/:studentId/document", student, getCandidateDocument);
router.get("/:studentId/tasks", student, getStudentTasks);
router.post("/:studentId/tasks", student, createStudentTask);
router.patch("/:studentId/tasks/:taskId", student, task, updateStudentTask);
router.delete("/:studentId/tasks/:taskId", student, task, deleteStudentTask);

export default router;
