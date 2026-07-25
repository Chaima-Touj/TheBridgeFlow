import express from "express";
import { protect, authorize, validateObjectId } from "../middleware/auth.middleware.js";
import {
  getDashboardStats,
  getAdvancedStats,
  getOnlineCount,
  getTopOffers,
  getTopFormations,
  createUser,
  getUsers,
  getUserById,
  updateUserStatus,
  updateUserRole,
  deleteUser,
} from "../controllers/admin.controller.js";

const router = express.Router();

// ─── Toutes les routes de ce fichier sont réservées à l'admin ──────────────
router.use(protect);
router.use(authorize("admin"));

router.get("/dashboard-stats", getDashboardStats);
router.get("/stats",           getAdvancedStats);
router.get("/top-offers",     getTopOffers);
router.get("/top-formations", getTopFormations);
router.get("/online-count",   getOnlineCount);

router.post("/users",              createUser);
router.get("/users",               getUsers);
router.get("/users/:id",           validateObjectId(), getUserById);
router.patch("/users/:id/status",  validateObjectId(), updateUserStatus);
router.patch("/users/:id/role",    validateObjectId(), updateUserRole);
router.delete("/users/:id",        validateObjectId(), deleteUser);

export default router;
