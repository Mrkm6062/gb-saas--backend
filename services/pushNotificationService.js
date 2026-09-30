import webpush from "web-push";
import PushSubscription from "../models/PushSubscription.js";

const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
  try {
    webpush.setVapidDetails(
      "mailto:support@galibrand.cloud",
      publicVapidKey,
      privateVapidKey
    );
  } catch (err) {
    console.error("Failed to initialize VAPID details:", err.message);
  }
}

/**
 * Send a web push notification to all subscribed devices for a store
 * @param {string|ObjectId} storeId
 * @param {Object} payload { title, body, icon, badge, data }
 */
export const sendPushToStore = async (storeId, payload) => {
  try {
    if (!publicVapidKey || !privateVapidKey) {
      console.warn("VAPID keys not configured. Skipping push notification.");
      return;
    }

    const subscriptions = await PushSubscription.find({ storeId });
    if (!subscriptions || subscriptions.length === 0) {
      return;
    }

    const payloadString = JSON.stringify({
      title: payload.title || "🎉 New Live Order!",
      body: payload.body || "A new order has been placed on your store.",
      icon: payload.icon || "/icon-192x192.png",
      badge: payload.badge || "/icon-192x192.png",
      tag: payload.tag || "live-order-" + Date.now(),
      data: payload.data || { url: `/store/${storeId}/live-orders` }
    });

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth
            }
          },
          payloadString
        );
      } catch (err) {
        // If subscription has expired or is invalid, remove it from DB
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
        } else {
          console.error(`Web push error for subscriber ${sub._id}:`, err.message);
        }
      }
    });

    await Promise.allSettled(sendPromises);
  } catch (error) {
    console.error("Error in sendPushToStore:", error.message);
  }
};
