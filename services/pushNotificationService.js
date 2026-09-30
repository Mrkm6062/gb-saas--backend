import webpush from "web-push";
import mongoose from "mongoose";
import dotenv from "dotenv";
import PushSubscription from "../models/PushSubscription.js";
import Store from "../models/Store.js";

dotenv.config();

/**
 * Configure VAPID details dynamically
 */
const configureVapid = () => {
  const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
  const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicVapidKey || !privateVapidKey) {
    return false;
  }

  try {
    webpush.setVapidDetails(
      "mailto:support@galibrand.cloud",
      publicVapidKey,
      privateVapidKey
    );
    return true;
  } catch (err) {
    console.error("[WebPush] Failed to initialize VAPID details:", err.message);
    return false;
  }
};

/**
 * Send a web push notification to all subscribed devices for a store
 * @param {string|ObjectId} storeId
 * @param {Object} payload { title, body, icon, badge, data }
 */
export const sendPushToStore = async (storeId, payload) => {
  try {
    const isVapidReady = configureVapid();
    if (!isVapidReady) {
      console.warn("[WebPush] VAPID keys not configured in process.env. Skipping push notification.");
      return { success: false, reason: "VAPID_KEYS_NOT_CONFIGURED" };
    }

    const targetStoreIdStr = storeId ? storeId.toString() : "";
    const queryIds = new Set();
    let friendlyStoreId = targetStoreIdStr;

    if (targetStoreIdStr) {
      queryIds.add(targetStoreIdStr);
      try {
        const isObjId = mongoose.Types.ObjectId.isValid(targetStoreIdStr);
        const st = await Store.findOne({
          $or: [
            ...(isObjId ? [{ _id: targetStoreIdStr }] : []),
            { storeId: targetStoreIdStr },
          ],
        });
        if (st) {
          queryIds.add(st._id.toString());
          if (st.storeId) {
            queryIds.add(st.storeId);
            friendlyStoreId = st.storeId;
          }
        }
      } catch (err) {
        // Fallback
      }
    }

    const subscriptions = await PushSubscription.find({
      storeId: { $in: Array.from(queryIds) },
    });

    console.log(`[WebPush] Found ${subscriptions.length} active device subscription(s) for store ${targetStoreIdStr}`);

    if (!subscriptions || subscriptions.length === 0) {
      return { success: true, subscribersFound: 0, sentCount: 0, failedCount: 0, errors: [] };
    }

    const targetUrl = (payload.data && payload.data.url) 
      ? payload.data.url 
      : `/store/${friendlyStoreId}/live-orders`;

    const payloadString = JSON.stringify({
      title: payload.title || "🎉 New Live Order!",
      body: payload.body || "A new order has been placed on your store.",
      icon: payload.icon || "/icon-192x192.png",
      badge: payload.badge || "/icon-192x192.png",
      tag: payload.tag || "live-order-" + Date.now(),
      data: {
        ...(payload.data || {}),
        url: targetUrl,
      },
    });

    // High urgency and 24h TTL ensures FCM delivers immediately when Chrome/device is sleeping
    const pushOptions = {
      TTL: 86400,
      urgency: "high",
    };

    let sentCount = 0;
    let failedCount = 0;
    const errors = [];

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          },
          payloadString,
          pushOptions
        );
        sentCount++;
        console.log(`[WebPush] Successfully sent notification to device: ${sub._id}`);
      } catch (err) {
        failedCount++;
        const errDetail = {
          subscriberId: sub._id.toString(),
          statusCode: err.statusCode,
          message: err.message,
          body: err.body || "",
        };
        errors.push(errDetail);

        // If subscription has expired or is invalid (410 Gone / 404 Not Found), remove it from DB
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[WebPush] Removing expired subscription ${sub._id} (${err.statusCode})`);
          await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
        } else {
          console.error(`[WebPush] Push delivery error for subscriber ${sub._id} (${err.statusCode}):`, err.message, err.body || "");
        }
      }
    });

    await Promise.allSettled(sendPromises);
    return {
      success: sentCount > 0,
      subscribersFound: subscriptions.length,
      sentCount,
      failedCount,
      errors,
    };
  } catch (error) {
    console.error("[WebPush] Error in sendPushToStore:", error.message);
    return { success: false, error: error.message };
  }
};
