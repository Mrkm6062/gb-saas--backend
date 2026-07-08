import express from "express";
import { getGoogleConfig, googleAuth } from "../controllers/googleAuthController.js";

const router = express.Router();

router.get("/config", getGoogleConfig);
router.post("/", googleAuth);

export default router;
