import express from "express";
import { optimizeImage } from "../controllers/imageController.js";

const router = express.Router();

// Match any path under /api/images
router.get("/*", optimizeImage);

export default router;
