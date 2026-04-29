import express from "express";
import { getSocialMedia, createSocialMedia, deleteSocialMedia, getPublicSocialMedia } from "../controllers/socialMediaController.js";
import { protect } from "../middleware/authMiddleware.js";
import { subdomainMiddleware } from "../middleware/subdomain.js";
import { storeResolver } from "../middleware/storeResolver.js";

const router = express.Router();

router.get("/public", subdomainMiddleware, storeResolver, getPublicSocialMedia);
router.get("/", protect, getSocialMedia);
router.post("/", protect, createSocialMedia);
router.delete("/:id", protect, deleteSocialMedia);

export default router;