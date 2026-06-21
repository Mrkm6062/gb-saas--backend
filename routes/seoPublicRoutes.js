import express from "express";
import { getRobotsText, getLlmsText, getSitemapXml } from "../controllers/seoPublicController.js";

const router = express.Router();

router.get("/robots.txt", getRobotsText);
router.get("/llms.txt", getLlmsText);
router.get("/sitemap.xml", getSitemapXml);

export default router;
