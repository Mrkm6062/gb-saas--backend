import express from "express";
import {
  createTheme,
  getSuperadminThemes,
  updateTheme,
  deleteTheme
} from "../controllers/themeController.js";
// Import your auth middleware (adjust the path/names to match your actual middleware)
// import { protect, superAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// If you have auth middleware, uncomment the line below:
// router.use(protect, superAdmin);

router.route("/")
  .post(createTheme)
  .get(getSuperadminThemes);

router.route("/:id")
  .put(updateTheme)
  .delete(deleteTheme);

export default router;