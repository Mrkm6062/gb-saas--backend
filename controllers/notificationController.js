import PushSubscription from "../models/PushSubscription.js";
import { sendPushToStore } from "../services/pushNotificationService.js";

// @desc    Get VAPID public key for Web Push subscription
// @route   GET /api/notifications/vapid-key
// @access  Public / Authenticated
export const getVapidPublicKey = async (req, res) => {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
      return res.status(500).json({ 
        success: false, 
        message: "VAPID public key not configured in server .env. Please add VAPID_PUBLIC_KEY to .env" 
      });
    }
    res.json({ success: true, publicKey });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Save/Register Web Push subscription for a store
// @route   POST /api/notifications/subscribe
// @access  Authenticated or Store context
export const subscribe = async (req, res) => {
  try {
    const { storeId, subscription, userAgent } = req.body;
    if (!storeId || !subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ success: false, message: "Invalid subscription payload" });
    }

    const { endpoint, keys } = subscription;
    if (!keys.p256dh || !keys.auth) {
      return res.status(400).json({ success: false, message: "Missing p256dh or auth keys" });
    }

    // Safely extract string userId (e.g. "GBUSER001" or ObjectId string)
    let userId = null;
    if (req.user) {
      userId = req.user.userId || (req.user._id ? req.user._id.toString() : null);
    }

    const savedSub = await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        storeId: String(storeId),
        userId: userId ? String(userId) : null,
        endpoint,
        keys: {
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        userAgent: userAgent || req.headers["user-agent"] || "",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: "Push subscription registered successfully", data: savedSub });
  } catch (error) {
    console.error("Error in push subscribe:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Unsubscribe device from push notifications
// @route   POST /api/notifications/unsubscribe
// @access  Public / Authenticated
export const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ success: false, message: "Endpoint is required to unsubscribe" });
    }

    await PushSubscription.deleteOne({ endpoint });
    res.json({ success: true, message: "Unsubscribed successfully" });
  } catch (error) {
    console.error("Error in push unsubscribe:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Trigger test push notification for a store
// @route   POST /api/notifications/test
// @access  Authenticated
export const testPushNotification = async (req, res) => {
  try {
    const { storeId } = req.body;
    if (!storeId) {
      return res.status(400).json({ success: false, message: "storeId is required" });
    }

    const result = await sendPushToStore(storeId, {
      title: "🔔 Live Orders Test Notification",
      body: "Push notifications are working properly! You will receive instant alerts for new live orders even when the app is closed.",
      data: { url: `/store/${storeId}/live-orders` },
    });

    if (result && result.reason === "VAPID_KEYS_NOT_CONFIGURED") {
      return res.status(500).json({
        success: false,
        message: "VAPID keys not configured in VPS .env. Please add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to .env and restart server.",
      });
    }

    if (result && result.subscribersFound === 0) {
      return res.status(404).json({
        success: false,
        message: "No active device subscriptions found for this store. Please click 'Enable Push Alerts' on this device first.",
      });
    }

    if (result && result.sentCount === 0 && result.errors && result.errors.length > 0) {
      const firstErr = result.errors[0];
      const errorMsg = firstErr.body || firstErr.message || `Error code ${firstErr.statusCode}`;
      return res.status(500).json({
        success: false,
        message: `FCM rejected push (${firstErr.statusCode || 'Failed'}): ${errorMsg}. Please click 'Enable Push Alerts' to refresh device subscription.`,
        details: result,
      });
    }

    res.json({ 
      success: true, 
      message: `Test alert sent to ${result?.sentCount || 0} device(s)!`,
      details: result 
    });
  } catch (error) {
    console.error("Error in testPushNotification:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
