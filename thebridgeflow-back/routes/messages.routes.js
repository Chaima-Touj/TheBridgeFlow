import express from "express";
import { sendMessage, getConversation, getConversations } from "../controllers/messages.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/",         protect, sendMessage);
router.get("/",          protect, getConversations);
router.get("/:userId",   protect, getConversation);

export default router;
