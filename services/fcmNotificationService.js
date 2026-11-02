import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import StaffDeviceToken from '../models/StaffDeviceToken.js';
import Staff from '../models/Staff.js';
import Store from '../models/Store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to Firebase Service Account credentials
const serviceAccountPath = path.resolve(__dirname, '../config/firebase-service-account.json');

let authClient = null;
let projectId = null;

/**
 * Initializes and caches GoogleAuth client for FCM HTTP v1 API
 */
const getFCMAuth = async () => {
  if (authClient && projectId) {
    return { authClient, projectId };
  }

  if (!fs.existsSync(serviceAccountPath)) {
    console.warn('[FCM] Firebase service account JSON not found at:', serviceAccountPath);
    return null;
  }

  try {
    const rawData = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    projectId = rawData.project_id || 'gen-lang-client-0821076332';

    const auth = new GoogleAuth({
      keyFile: serviceAccountPath,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    authClient = await auth.getClient();
    console.log(`[FCM] Successfully initialized FCM client for project: ${projectId}`);
    return { authClient, projectId };
  } catch (err) {
    console.error('[FCM] Error initializing GoogleAuth:', err.message);
    return null;
  }
};

/**
 * Send an FCM notification to a specific device token using FCM v1 REST API
 */
export const sendFCMNotification = async (fcmToken, { title, body, data = {}, channelId = 'staff_orders' }) => {
  if (!fcmToken || typeof fcmToken !== 'string') return { success: false, reason: 'INVALID_TOKEN' };

  try {
    const authData = await getFCMAuth();
    if (!authData) {
      return { success: false, reason: 'FCM_NOT_CONFIGURED' };
    }

    const { authClient, projectId } = authData;
    const tokenResponse = await authClient.getAccessToken();
    const accessToken = tokenResponse?.token;

    if (!accessToken) {
      return { success: false, reason: 'ACCESS_TOKEN_FAILED' };
    }

    // Ensure all data values are strings (required by FCM HTTP v1)
    const stringData = {};
    for (const [key, val] of Object.entries(data)) {
      stringData[key] = typeof val === 'string' ? val : JSON.stringify(val);
    }

    const payload = {
      message: {
        token: fcmToken,
        notification: {
          title: title || 'Staff Alert',
          body: body || '',
        },
        data: stringData,
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: channelId,
            sound: 'default',
            default_sound: true,
            default_vibrate_timings: true,
            notification_priority: 'PRIORITY_MAX',
            visibility: 'PUBLIC',
          },
        },
      },
    };

    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`[FCM] Notification sent successfully: ${result.name}`);
      return { success: true, messageId: result.name };
    } else {
      console.error(`[FCM] Send error (${response.status}):`, result.error?.message || result);

      // If token is invalid or unregistered, clean it up from DB
      const errorCode = result.error?.details?.[0]?.errorCode || result.error?.status;
      if (
        response.status === 404 ||
        response.status === 400 ||
        errorCode === 'UNREGISTERED' ||
        errorCode === 'INVALID_ARGUMENT'
      ) {
        console.log(`[FCM] Cleaning up stale token: ${fcmToken.slice(0, 15)}...`);
        await StaffDeviceToken.deleteOne({ fcmToken }).catch(() => {});
        await Staff.updateMany(
          { 'fcmTokens.token': fcmToken },
          { $pull: { fcmTokens: { token: fcmToken } } }
        ).catch(() => {});
      }

      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('[FCM] Unexpected error in sendFCMNotification:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Notify Kitchen Staff when a new order is received
 */
export const notifyKitchenNewOrder = async (store, order) => {
  try {
    if (!store || !order) return;

    const storeIdStr = store._id ? store._id.toString() : store.toString();

    // Find all kitchen staff device tokens for this store
    const deviceTokens = await StaffDeviceToken.find({
      $or: [
        { store: store._id },
        { storeId: store.storeId || storeIdStr },
      ],
      role: 'kitchen',
    });

    // Also look up Staff model directly to catch tokens saved in fcmTokens array
    const staffMembers = await Staff.find({
      store: store._id,
      role: 'kitchen',
      status: 'active',
    }).select('fcmTokens');

    const tokenSet = new Set();
    deviceTokens.forEach(d => { if (d.fcmToken) tokenSet.add(d.fcmToken); });
    staffMembers.forEach(s => {
      if (Array.isArray(s.fcmTokens)) {
        s.fcmTokens.forEach(t => { if (t.token) tokenSet.add(t.token); });
      }
    });

    const allTokens = Array.from(tokenSet);
    console.log(`[FCM] Found ${allTokens.length} kitchen staff device token(s) for store: ${store.storeName || storeIdStr}`);

    if (allTokens.length === 0) {
      return { sent: 0, reason: 'NO_KITCHEN_TOKENS' };
    }

    const orderShortId = order._id.toString().slice(-6).toUpperCase();
    const orderType = order.orderType || (order.isDineIn ? 'Dine-in' : 'Delivery');
    const storeCode = store.storeId || storeIdStr;

    const title = `🍳 New Order #${orderShortId} [${orderType}]`;
    const body = `${order.customerName || 'Customer'} placed order of ₹${order.totalAmount || 0} (${order.orderItems?.length || 0} items)`;
    const data = {
      type: 'NEW_ORDER',
      orderId: order._id.toString(),
      orderNumber: orderShortId,
      storeId: storeCode,
      role: 'kitchen',
      totalAmount: String(order.totalAmount || 0),
      url: `https://dashboard.galibrand.cloud/staff-login/kitchen`,
    };

    const sendPromises = allTokens.map(token =>
      sendFCMNotification(token, {
        title,
        body,
        data,
        channelId: 'staff_orders',
      })
    );

    const results = await Promise.allSettled(sendPromises);
    const sentCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    console.log(`[FCM] Successfully delivered new order notification to ${sentCount}/${allTokens.length} kitchen device(s)`);

    return { sent: sentCount, total: allTokens.length };
  } catch (error) {
    console.error('[FCM] Error notifying kitchen staff:', error.message);
    return { sent: 0, error: error.message };
  }
};

/**
 * Notify Delivery Staff when an order is assigned to them
 */
export const notifyDeliveryStaffAssigned = async (order, store, deliveryStaffId) => {
  try {
    if (!order || !deliveryStaffId) return;

    // Find the delivery staff
    const staff = await Staff.findById(deliveryStaffId);
    if (!staff) {
      console.log(`[FCM] Delivery staff ${deliveryStaffId} not found`);
      return;
    }

    // Collect FCM tokens for this delivery staff member
    const deviceTokens = await StaffDeviceToken.find({ staff: staff._id });
    const tokenSet = new Set();
    deviceTokens.forEach(d => { if (d.fcmToken) tokenSet.add(d.fcmToken); });

    if (Array.isArray(staff.fcmTokens)) {
      staff.fcmTokens.forEach(t => { if (t.token) tokenSet.add(t.token); });
    }

    const allTokens = Array.from(tokenSet);
    console.log(`[FCM] Found ${allTokens.length} delivery device token(s) for staff: ${staff.name} (${staff.staffId})`);

    if (allTokens.length === 0) {
      return { sent: 0, reason: 'NO_DELIVERY_TOKENS' };
    }

    const orderShortId = order._id.toString().slice(-6).toUpperCase();
    const storeCode = store?.storeId || (order.store ? order.store.toString() : '');

    const title = `🛵 New Order Assigned #${orderShortId}`;
    const body = `Deliver to ${order.customerName || 'Customer'} (${order.customerPhone || 'N/A'}) - ₹${order.totalAmount || 0}`;
    const data = {
      type: 'ORDER_ASSIGNED',
      orderId: order._id.toString(),
      orderNumber: orderShortId,
      storeId: storeCode,
      role: 'delivery',
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      customerAddress: order.customerAddress || '',
      totalAmount: String(order.totalAmount || 0),
      url: `https://dashboard.galibrand.cloud/staff-login/delivery`,
    };

    const sendPromises = allTokens.map(token =>
      sendFCMNotification(token, {
        title,
        body,
        data,
        channelId: 'staff_delivery',
      })
    );

    const results = await Promise.allSettled(sendPromises);
    const sentCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    console.log(`[FCM] Successfully delivered assignment alert to ${sentCount}/${allTokens.length} delivery device(s)`);

    return { sent: sentCount, total: allTokens.length };
  } catch (error) {
    console.error('[FCM] Error notifying delivery staff:', error.message);
    return { sent: 0, error: error.message };
  }
};
