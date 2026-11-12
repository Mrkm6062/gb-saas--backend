import express from "express";
import { loginSuperAdmin, getDashboardData, getMe } from "../superadmin/controllers/authController.js";
import { getPlans, createOrUpdatePlan, assignPlanToStore, deletePlan } from "../controllers/planController.js";
import { getFeatures, createFeature, updateFeature, deleteFeature } from "../controllers/featureController.js";
import { updateStoreStatus, updateStoreExpiry } from "../controllers/storeController.js";
import { getPlatformPolicies, createOrUpdatePlatformPolicy, deletePlatformPolicy } from "../controllers/platformPolicyController.js";
import { getPlatformSocialMedia, createPlatformSocialMedia, deletePlatformSocialMedia } from "../controllers/platformSocialMediaController.js";
import { updatePlatformSettings } from "../controllers/platformSettingsController.js";
import { protectSuperadmin } from "../middleware/superadminMiddleware.js";
import { sendExpiredStoreAlertsManually, sendSubscriptionReminders } from "../middleware/subscriptionReminder.js";

const router = express.Router();

router.post("/login", loginSuperAdmin);

// Protected Superadmin Routes
router.get("/me", protectSuperadmin, getMe);
router.get("/data", protectSuperadmin, getDashboardData); 
router.get("/plans", protectSuperadmin, getPlans);
router.post("/plans", protectSuperadmin, createOrUpdatePlan);
router.delete("/plans/:id", protectSuperadmin, deletePlan);
router.put("/store/:id/plan", protectSuperadmin, assignPlanToStore);
router.put("/stores/:id/status", protectSuperadmin, updateStoreStatus);
router.put("/stores/:id/expiry", protectSuperadmin, updateStoreExpiry);

// Features Management Routes
router.get("/features", protectSuperadmin, getFeatures);
router.post("/features", protectSuperadmin, createFeature);
router.put("/features/:id", protectSuperadmin, updateFeature);
router.delete("/features/:id", protectSuperadmin, deleteFeature);

// Platform Policies
router.get("/policies", protectSuperadmin, getPlatformPolicies);
router.post("/policies", protectSuperadmin, createOrUpdatePlatformPolicy);
router.delete("/policies/:id", protectSuperadmin, deletePlatformPolicy);

// Platform Social Media
router.get("/social-media", protectSuperadmin, getPlatformSocialMedia);
router.post("/social-media", protectSuperadmin, createPlatformSocialMedia);
router.delete("/social-media/:id", protectSuperadmin, deletePlatformSocialMedia);

// Platform Settings
router.put("/settings", protectSuperadmin, updatePlatformSettings);

// Subscription Alert Status Check
router.get("/subscription-alerts/status", protectSuperadmin, (req, res) => {
  res.json({ success: true, message: "Subscription alerts service is active" });
});

// Subscription Alert Triggers (Manual Superadmin Triggers)
router.post("/subscription-alerts/send-expired", protectSuperadmin, async (req, res) => {
  try {
    const result = await sendExpiredStoreAlertsManually();
    res.json(result);
  } catch (error) {
    console.error("Error sending manual expired store alerts:", error);
    res.status(500).json({ message: error.message || "Failed to send expired store alerts" });
  }
});

// Alias for send-expired
router.post("/send-expired-alerts", protectSuperadmin, async (req, res) => {
  try {
    const result = await sendExpiredStoreAlertsManually();
    res.json(result);
  } catch (error) {
    console.error("Error sending manual expired store alerts:", error);
    res.status(500).json({ message: error.message || "Failed to send expired store alerts" });
  }
});

router.post("/subscription-alerts/run-cron-now", protectSuperadmin, async (req, res) => {
  try {
    const result = await sendSubscriptionReminders({ manualTrigger: true });
    res.json(result);
  } catch (error) {
    console.error("Error triggering daily subscription reminders:", error);
    res.status(500).json({ message: error.message || "Failed to trigger subscription reminders" });
  }
});

export default router;
