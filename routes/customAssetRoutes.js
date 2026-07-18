import express from "express";
import multer from "multer";
import {
  uploadAsset,
  listAssets,
  deleteAsset,
} from "../controllers/customAssetController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", protect, upload.array("assets", 10), uploadAsset);
router.get("/list", protect, listAssets);
router.delete("/:id", protect, deleteAsset);

export default router;
