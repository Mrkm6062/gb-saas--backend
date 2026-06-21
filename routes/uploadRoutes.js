import express from "express";
import multer from "multer";
import { uploadImages, listImages, deleteImage, proxyDownload } from "../controllers/uploadController.js";
// Note: If your auth middleware is named differently, adjust the import path below.
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // Process files in memory for fast conversion

router.get("/download", proxyDownload); // Public endpoint to proxy GCS download requests bypassing CORS
router.post("/public", upload.array("images", 10), uploadImages); // Public upload for customer reviews
router.post("/", protect, upload.array("images", 10), uploadImages);
router.get("/", protect, listImages);
router.delete("/", protect, deleteImage);

export default router;