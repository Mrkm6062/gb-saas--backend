import express from "express";
import multer from "multer";
import {
  uploadWebsiteFiles,
  getWebsiteFiles,
  deleteWebsiteFile,
  deleteEntireWebsite,
  servePublicWebsiteFile
} from "../controllers/customWebsiteController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
// Memory storage to process files without saving to disk before sending to GCS
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per single file
    files: 500 // Allow up to 500 files per upload batch
  }
});

// Protected Store Owner Routes
router.post("/upload", protect, upload.array("files", 500), uploadWebsiteFiles);
router.get("/files", protect, getWebsiteFiles);
router.delete("/file", protect, deleteWebsiteFile);
router.delete("/all", protect, deleteEntireWebsite);

// Public Storefront Proxy Routes
router.get("/public/serve", servePublicWebsiteFile);
router.get("/public/serve/*", servePublicWebsiteFile);

export default router;
