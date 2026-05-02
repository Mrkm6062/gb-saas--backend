import express from "express";
import { getPlatformSocialMedia } from "../controllers/platformSocialMediaController.js";

const router = express.Router();

router.get("/public", getPlatformSocialMedia);

export default router;