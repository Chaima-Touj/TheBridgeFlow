import express from "express";
import {
  getOffers, getOffer, createOffer, updateOffer, deleteOffer, getDomains,
  getOffersAdmin, updateOfferStatus,
} from "../controllers/offers.controller.js";
import { protect, authorize, validateObjectId } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/meta/domains", getDomains);
router.get("/admin",        protect, authorize("admin"), getOffersAdmin);
router.get("/",              getOffers);
router.get("/:id",           validateObjectId("id"), getOffer);
router.post("/",             protect, authorize("admin"), createOffer);
router.put("/:id",           protect, validateObjectId("id"), authorize("admin"), updateOffer);
router.patch("/:id/status",  protect, validateObjectId("id"), authorize("admin"), updateOfferStatus);
router.delete("/:id",        protect, validateObjectId("id"), authorize("admin"), deleteOffer);

export default router;
