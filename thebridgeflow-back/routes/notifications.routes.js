import express from "express";
import { getNotifications, markAsRead, markAllAsRead, deleteNotification } from "../controllers/notifications.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/",          protect, getNotifications);
router.put("/read-all",  protect, markAllAsRead);
router.put("/:id/read",  protect, markAsRead);
router.delete("/:id",    protect, deleteNotification);

export default router;
