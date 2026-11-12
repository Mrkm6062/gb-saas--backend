import Store from '../models/Store.js';
import User from '../models/User.js';
import PlatformSettings from '../models/PlatformSettings.js';
import { getLandingMailConfigAndTransporter } from '../services/landingEmailService.js';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Resolves the store owner details (name, email, user object) reliably.
 * Supports store.ownerId as custom userId, MongoDB _id, or email, with fallback to store.supportEmail.
 */
export const resolveStoreOwner = async (store) => {
  let user = null;
  if (store.ownerId) {
    try {
      user = await User.findOne({ userId: store.ownerId });
      if (!user && mongoose.Types.ObjectId.isValid(store.ownerId)) {
        user = await User.findById(store.ownerId);
      }
      if (!user) {
        user = await User.findOne({ $or: [{ userId: store.ownerId }, { email: store.ownerId }] });
      }
    } catch (e) {
      console.warn(`[SUBSCRIPTION-ALERT] Error looking up user for store ${store.storeId}:`, e.message);
    }
  }

  const email = (user && user.email) ? user.email.trim() : (store.supportEmail ? store.supportEmail.trim() : null);
  const name = (user && user.name) ? user.name : (store.storeName ? `${store.storeName} Owner` : "Store Owner");

  return { user, email, name };
};

/**
 * Replaces placeholder variables in HTML template strings.
 */
export const renderEmailTemplate = (template, variables = {}) => {
  let result = template || '';
  for (const [key, val] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, val !== undefined && val !== null ? String(val) : '');
  }
  return result;
};

/**
 * Retrieves the active mail transporter and sender details.
 */
export const getActiveTransporter = async () => {
  const mailSetup = await getLandingMailConfigAndTransporter();
  if (mailSetup && mailSetup.transporter) {
    const senderEmail = mailSetup.config?.fromEmail || mailSetup.config?.smtpUser || process.env.EMAIL_USER;
    const senderName = mailSetup.config?.fromName || "Galibrand Cloud";
    return {
      transporter: mailSetup.transporter,
      sender: `"${senderName}" <${senderEmail}>`
    };
  }

  // Direct environment variable fallback
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const fallbackTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: Number(process.env.EMAIL_PORT) || 465,
      secure: Number(process.env.EMAIL_PORT) === 465 || !process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    return {
      transporter: fallbackTransporter,
      sender: `"Galibrand Cloud" <${process.env.EMAIL_USER}>`
    };
  }

  return { transporter: null, sender: null };
};

/**
 * Sends a subscription reminder or expiry email for a single store.
 */
export const sendStoreSubscriptionEmail = async ({ store, type, diffDays, transporterInfo, platformSettings }) => {
  const { transporter, sender } = transporterInfo;
  if (!transporter) {
    throw new Error("Email transporter is not configured. Please check Landing Page Email or SMTP environment settings.");
  }

  const { email, name } = await resolveStoreOwner(store);
  if (!email) {
    return { sent: false, reason: `No owner email or support email found for store ${store.storeName} (${store.storeId})` };
  }

  const expiryDateFormatted = new Date(store.planExpiryDate).toLocaleDateString("en-IN", {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const renewUrl = `https://dashboard.galibrand.cloud/store/${store.storeId || store._id}/plan`;
  const platformName = "Galibrand Cloud";

  let subject = '';
  let templateToUse = '';
  let daysLeftText = '';

  if (type === 'expired') {
    subject = `Notice: Your store ${store.storeName} subscription has expired`;
    templateToUse = platformSettings.subscriptionExpiredTemplate;
  } else {
    if (diffDays === 1) {
      daysLeftText = "1 day (tomorrow)";
      subject = `Urgent: Your store ${store.storeName} subscription expires tomorrow!`;
    } else {
      daysLeftText = `${diffDays} days`;
      subject = `Action Required: Your store ${store.storeName} subscription expires in ${diffDays} days`;
    }
    templateToUse = platformSettings.subscriptionReminderTemplate;
  }

  const htmlContent = renderEmailTemplate(templateToUse, {
    ownerName: name,
    storeName: store.storeName,
    expiryDate: expiryDateFormatted,
    daysLeft: daysLeftText,
    renewUrl,
    mainLogoUrl: platformSettings.mainLogoUrl || 'https://storage.googleapis.com/galibrand/superadmin/products/galibrandfullname-logo.png',
    companyAddress: platformSettings.companyAddress || '',
    companyPhone: platformSettings.companyPhone || '',
    platformName
  });

  await transporter.sendMail({
    from: sender,
    to: email,
    subject: subject,
    html: htmlContent
  });

  return { sent: true, email, storeName: store.storeName, storeId: store.storeId, type };
};

/**
 * Sends reminder emails specifically to stores whose plan is expired.
 * Triggered manually via Superadmin Dashboard button or API.
 */
export const sendExpiredStoreAlertsManually = async () => {
  console.log('[MANUAL TRIGGER] Sending subscription expiry alerts to expired stores...');
  
  const transporterInfo = await getActiveTransporter();
  if (!transporterInfo.transporter) {
    throw new Error("Email transporter is not available. Configure SMTP in settings or .env.");
  }

  let platformSettings = await PlatformSettings.findOne({ key: "global" });
  if (!platformSettings) {
    platformSettings = new PlatformSettings({ key: "global" });
  }

  const now = new Date();
  
  // Find all stores that are not soft-deleted and whose planExpiryDate is in the past
  const expiredStores = await Store.find({
    isDeleted: { $ne: true },
    planExpiryDate: { $exists: true, $ne: null, $lte: now }
  });

  console.log(`[MANUAL TRIGGER] Found ${expiredStores.length} expired stores to process.`);

  let sentCount = 0;
  let failedCount = 0;
  const results = [];

  for (const store of expiredStores) {
    try {
      const res = await sendStoreSubscriptionEmail({
        store,
        type: 'expired',
        diffDays: 0,
        transporterInfo,
        platformSettings
      });

      if (res.sent) {
        sentCount++;
        results.push({ storeId: store.storeId, storeName: store.storeName, status: 'sent', email: res.email });
        console.log(`[MANUAL TRIGGER] ✅ Expired alert sent to ${res.email} for store: ${store.storeName}`);
      } else {
        failedCount++;
        results.push({ storeId: store.storeId, storeName: store.storeName, status: 'skipped', reason: res.reason });
        console.warn(`[MANUAL TRIGGER] ⚠️ Skipped store: ${store.storeName} - ${res.reason}`);
      }
    } catch (err) {
      failedCount++;
      results.push({ storeId: store.storeId, storeName: store.storeName, status: 'error', error: err.message });
      console.error(`[MANUAL TRIGGER] ❌ Failed to send expired alert for store ${store.storeName}:`, err.message);
    }
  }

  return {
    success: true,
    message: `Processed ${expiredStores.length} expired stores: ${sentCount} emails sent successfully, ${failedCount} failed/skipped.`,
    totalExpired: expiredStores.length,
    sentCount,
    failedCount,
    results
  };
};

/**
 * Main function for the 10:00 AM daily subscription check.
 * Checks upcoming expiries (3, 2, 1 days) and stores with expired plans.
 */
export const sendSubscriptionReminders = async ({ manualTrigger = false } = {}) => {
  const triggerLabel = manualTrigger ? '[MANUAL RUN]' : '[CRON 10:00 AM]';
  console.log(`${triggerLabel} Starting daily subscription reminder check...`);

  try {
    const transporterInfo = await getActiveTransporter();
    if (!transporterInfo.transporter) {
      console.error(`${triggerLabel} Cannot run reminder job: email transporter is not configured.`);
      return { success: false, message: "Email transporter not configured" };
    }

    let platformSettings = await PlatformSettings.findOne({ key: "global" });
    if (!platformSettings) {
      platformSettings = new PlatformSettings({ key: "global" });
    }

    const storesToRemind = await Store.find({
      isDeleted: { $ne: true },
      planExpiryDate: { $exists: true, $ne: null }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let remindersSent = 0;
    let expiredAlertsSent = 0;
    let errorsCount = 0;
    const details = [];

    for (const store of storesToRemind) {
      try {
        const expiry = new Date(store.planExpiryDate);
        expiry.setHours(0, 0, 0, 0);

        const diffTime = expiry - today;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        let alertType = null;

        // Upcoming reminders (3, 2, 1 days before expiry)
        if (diffDays === 3 || diffDays === 2 || diffDays === 1) {
          alertType = 'reminder';
        } else if (diffDays <= 0 && diffDays >= -30) {
          // Send alerts for expired stores (within 30 days of expiry)
          alertType = 'expired';
        }

        if (alertType) {
          const res = await sendStoreSubscriptionEmail({
            store,
            type: alertType,
            diffDays,
            transporterInfo,
            platformSettings
          });

          if (res.sent) {
            if (alertType === 'expired') expiredAlertsSent++;
            else remindersSent++;
            details.push({ storeId: store.storeId, type: alertType, email: res.email, status: 'sent' });
            console.log(`${triggerLabel} ✅ Sent ${alertType} email to ${res.email} for store ${store.storeName} (Diff days: ${diffDays})`);
          } else {
            details.push({ storeId: store.storeId, type: alertType, status: 'skipped', reason: res.reason });
          }
        }
      } catch (err) {
        errorsCount++;
        details.push({ storeId: store.storeId, status: 'error', error: err.message });
        console.error(`${triggerLabel} ❌ Failed processing store ${store.storeName}:`, err.message);
      }
    }

    console.log(`${triggerLabel} Completed. Reminders sent: ${remindersSent}, Expired alerts sent: ${expiredAlertsSent}, Errors: ${errorsCount}`);
    return {
      success: true,
      message: `Job completed: ${remindersSent} reminders and ${expiredAlertsSent} expired alerts sent.`,
      remindersSent,
      expiredAlertsSent,
      errorsCount,
      details
    };
  } catch (error) {
    console.error(`${triggerLabel} Fatal error in subscription reminder job:`, error);
    return { success: false, message: error.message };
  }
};

/**
 * Initializes the daily cron job scheduled at 10:00 AM server time.
 */
export const startSubscriptionReminderCron = async () => {
  console.log('[CRON] Initializing subscription expiry reminder job (configured for 10:00 AM daily)...');

  let nodeCronRegistered = false;

  try {
    const cronModule = await import('node-cron');
    const cron = cronModule.default || cronModule;

    // Run every day at 10:00 AM server time ('0 10 * * *')
    cron.schedule('0 10 * * *', async () => {
      console.log('[CRON] ⏰ 10:00 AM Scheduled Execution: Checking subscription expirations...');
      await sendSubscriptionReminders();
    });

    nodeCronRegistered = true;
    console.log('[CRON] ✅ node-cron scheduled successfully for 10:00 AM daily (0 10 * * *).');
  } catch (err) {
    console.warn('[CRON] node-cron not available, activating native timer fallback:', err.message);
  }

  // Backup Native Node Timer: Computes exact milliseconds to 10:00 AM every day
  // Guarantees reliable 10:00 AM execution even if node-cron package is not installed.
  const scheduleNextNativeRun = () => {
    const now = new Date();
    const next10AM = new Date(now);
    next10AM.setHours(10, 0, 0, 0);

    if (next10AM <= now) {
      next10AM.setDate(next10AM.getDate() + 1);
    }

    const delayMs = next10AM.getTime() - now.getTime();
    console.log(`[CRON-TIMER] Next daily 10:00 AM run in ${Math.round(delayMs / 1000 / 60)} minutes.`);

    setTimeout(async () => {
      try {
        if (!nodeCronRegistered) {
          console.log('[CRON-TIMER] ⏰ 10:00 AM Native Timer Execution: Checking subscription expirations...');
          await sendSubscriptionReminders();
        }
      } catch (e) {
        console.error('[CRON-TIMER] Error in scheduled run:', e);
      } finally {
        scheduleNextNativeRun();
      }
    }, delayMs);
  };

  scheduleNextNativeRun();
};
