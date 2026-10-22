import express from "express";
import {
  submitContactForm,
  getMailConfig,
  updateMailConfig,
  testMailConfig,
  getContactSubmissions,
  getContactSubmissionById,
  updateContactSubmission,
  deleteContactSubmission,
  resendContactAlert,
} from "../controllers/landingContactController.js";
import { protectSuperadmin } from "../middleware/superadminMiddleware.js";

const router = express.Router();

// 🌐 PUBLIC ENDPOINTS (Landing Page Contact Form)
router.post("/", submitContactForm);
router.post("/submit", submitContactForm);

// 🛡️ SYSADMIN PROTECTED ENDPOINTS: EMAIL CONFIGURATION
router.get("/config", protectSuperadmin, getMailConfig);
router.put("/config", protectSuperadmin, updateMailConfig);
router.post("/config/test", protectSuperadmin, testMailConfig);

// 🛡️ SYSADMIN PROTECTED ENDPOINTS: RECEIVED CONTACT FORMS
router.get("/submissions", protectSuperadmin, getContactSubmissions);
router.get("/submissions/:id", protectSuperadmin, getContactSubmissionById);
router.patch("/submissions/:id", protectSuperadmin, updateContactSubmission);
router.delete("/submissions/:id", protectSuperadmin, deleteContactSubmission);
router.post("/submissions/:id/resend", protectSuperadmin, resendContactAlert);

export default router;
