import express from "express";
import {
  getConversations,
  getConversationMessages,
  getStudents,
  uploadFileMessage,
} from "../controllers/conversations.controller.js";
import { protect }            from "../middleware/auth.middleware.js";
import { uploadMessageFile }  from "../middleware/upload.middleware.js";

const router = express.Router();

router.get("/",                          protect, getConversations);
router.get("/students",                  protect, getStudents);
router.get("/:conversationId/messages", protect, getConversationMessages);

router.post(
  "/upload",
  protect,
  (req, res, next) => {
    uploadMessageFile(req, res, (err) => {
      if (err) {
        const e = new Error(err.message);
        e.statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return next(e);
      }
      next();
    });
  },
  uploadFileMessage
);

export default router;
