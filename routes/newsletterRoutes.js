import express from "express";
import {
  subscribeNewsletter,
  getSubscribers,
  toggleSubscriberStatus,
  getTemplates,
  saveTemplate,
  deleteTemplate,
  sendNewsletter
} from "../controllers/newsletterController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public route to subscribe
router.post("/subscribe", subscribeNewsletter);

// Protected store owner routes
router.get("/:storeId/subscribers", protect, getSubscribers);
router.put("/:storeId/subscribers/:subscriberId/toggle", protect, toggleSubscriberStatus);
router.get("/:storeId/templates", protect, getTemplates);
router.post("/:storeId/templates", protect, saveTemplate);
router.delete("/:storeId/templates/:templateId", protect, deleteTemplate);
router.post("/:storeId/send", protect, sendNewsletter);

export default router;
