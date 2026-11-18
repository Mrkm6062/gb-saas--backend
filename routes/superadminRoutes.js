import { sendCreateStoreReminderToUser, checkAndSend24HourNoStoreAlerts } from "../services/platformNotificationService.js";
import User from "../models/User.js";
import Store from "../models/Store.js";
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


// User Management & Store Creation Reminders
router.delete("/users/:id", protectSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const activeStores = await Store.find({ ownerId: { $in: [user.userId, user._id] }, isDeleted: { $ne: true } });
    if (activeStores.length > 0) {
      return res.status(400).json({ 
        message: `Cannot delete user because they own ${activeStores.length} active store(s): ${activeStores.map(s => s.storeName).join(', ')}. Please delete or reassign the stores first.` 
      });
    }

    await User.findByIdAndDelete(id);
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/users/:id/send-store-reminder", protectSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await sendCreateStoreReminderToUser(id);
    res.json(result);
  } catch (error) {
    console.error("Error sending store creation reminder:", error);
    res.status(500).json({ message: error.message || "Failed to send reminder email" });
  }
});

router.post("/users/send-store-reminder-bulk", protectSuperadmin, async (req, res) => {
  try {
    const users = await User.find({ role: 'user' });
    const stores = await Store.find({ isDeleted: { $ne: true } });
    const ownerSet = new Set(stores.map(s => String(s.ownerId)));

    const usersWithoutStore = users.filter(u => !ownerSet.has(String(u.userId)) && !ownerSet.has(String(u._id)));

    let successCount = 0;
    let failCount = 0;

    for (const u of usersWithoutStore) {
      try {
        await sendCreateStoreReminderToUser(u);
        successCount++;
      } catch (e) {
        failCount++;
      }
    }

    res.json({
      success: true,
      message: `Processed ${usersWithoutStore.length} users. Sent: ${successCount}, Failed: ${failCount}`,
      totalTargeted: usersWithoutStore.length,
      successCount,
      failCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to send bulk reminders" });
  }
});

router.post("/users/check-no-store-24h", protectSuperadmin, async (req, res) => {
  try {
    const result = await checkAndSend24HourNoStoreAlerts();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to run 24h store creation check" });
  }
});

export default router;
