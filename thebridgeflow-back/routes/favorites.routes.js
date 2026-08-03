import express from "express";
import { getFavorites, toggleFavorite } from "../controllers/favorites.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/",          protect, getFavorites);
router.post("/:offerId", protect, toggleFavorite);

export default router;
