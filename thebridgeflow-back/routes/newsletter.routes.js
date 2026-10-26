import express from "express";
import rateLimit from "express-rate-limit";
import { getNewsletterSubscribers, subscribeToNewsletter, unsubscribeFromNewsletter } from "../controllers/newsletter.controller.js";
import { authorize, protect } from "../middleware/auth.middleware.js";

const router = express.Router();
const subscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { message: "Trop de tentatives. Réessayez dans 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== "production",
});

router.post("/subscribe", subscribeLimiter, subscribeToNewsletter);
router.post("/unsubscribe/:token", unsubscribeFromNewsletter);
router.get("/admin/subscribers", protect, authorize("admin"), getNewsletterSubscribers);

export default router;
