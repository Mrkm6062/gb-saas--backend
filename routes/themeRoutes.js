import express from "express";
import { getActiveThemes } from "../controllers/themeController.js";

const router = express.Router();

// Fetch active themes for frontend storefront / ManageTheme.jsx
router.get("/", getActiveThemes);

export default router;