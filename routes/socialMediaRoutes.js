import express from "express";
import { getSocialMedia, createSocialMedia, deleteSocialMedia, getPublicSocialMedia } from "../controllers/socialMediaController.js";
import { protect } from "../middleware/authMiddleware.js";
import { subdomainMiddleware } from "../middleware/subdomain.js";
import { storeResolver } from "../middleware/storeResolver.js";
import SocialMedia from "../models/SocialMedia.js";

const router = express.Router();

router.get("/public", subdomainMiddleware, storeResolver, getPublicSocialMedia);

// Smart route: Handles both Admin Dashboard (with token) and Public Storefront (without token)
router.get("/", (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    // If admin token exists, run protect middleware then getSocialMedia controller
    return protect(req, res, () => getSocialMedia(req, res, next));
  } else {
    // If no token exists, fallback to fulfilling the public storefront request
    const { storeId } = req.query;
    if (!storeId) return res.status(401).json({ message: "Not authorized, no token provided" });
    
    SocialMedia.find({ storeId })
      .then(links => res.json(links))
      .catch(err => res.status(500).json({ message: err.message }));
  }
});

router.post("/", protect, createSocialMedia);
router.delete("/:id", protect, deleteSocialMedia);

export default router;