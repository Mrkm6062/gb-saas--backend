import nodemailer from "nodemailer";
import User from "../models/User.js";
import Store from "../models/Store.js";
import PlatformSettings from "../models/PlatformSettings.js";
import { getLandingMailConfigAndTransporter } from "./landingEmailService.js";

/**
 * Default HTML template for store creation reminders sent to users who have not created a store.
 */
export const DEFAULT_CREATE_STORE_REMINDER_TEMPLATE = `<div style="font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; padding: 30px 15px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
    <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8, #0ea5e9); padding: 36px 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
        {{platformName}}
      </h1>
      <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 14px; font-weight: 500;">
        Launch Your Online Store in Just a Few Clicks
      </p>
    </div>
    <div style="padding: 32px 28px;">
      <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0;">
        Hello {{userName}},
      </h2>
      <p style="font-size: 15px; line-height: 1.7; color: #475569;">
        We noticed you created an account on <strong>{{platformName}}</strong>, but haven't launched your online store yet!
      </p>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; border-radius: 10px; padding: 18px; margin: 24px 0;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #15803d; font-weight: 700;">
          ✨ Your Free 7-Day Trial is Ready
        </h3>
        <p style="margin: 0; color: #166534; font-size: 13px; line-height: 1.6;">
          Start selling online with custom domains, product catalogs, POS billing, digital receipts, and WhatsApp orders &mdash; no technical experience needed.
        </p>
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{createStoreUrl}}" style="background: #2563eb; color: #ffffff; padding: 14px 36px; text-decoration: none; font-weight: 700; font-size: 15px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(37,99,235,0.25);">
          Create Your Store Now &rarr;
        </a>
      </div>
      <p style="font-size: 13px; line-height: 1.6; color: #64748b; text-align: center; margin: 0 0 20px 0;">
        Need help setting up? Reply directly to this email or contact our support team at <a href="mailto:support@galibrand.cloud" style="color: #2563eb; text-decoration: underline;">support@galibrand.cloud</a>.
      </p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 13px; color: #64748b; margin-bottom: 4px;">Best regards,</p>
      <p style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 0;">The {{platformName}} Team</p>
    </div>
    <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0 0 4px;">{{companyAddress}} | {{companyPhone}}</p>
      <p style="font-size: 11px; color: #cbd5e1; margin: 0;">&copy; {{platformName}}. All rights reserved.</p>
    </div>
  </div>
</div>`;

/**
 * Returns the configured support notification email address.
 * Falls back to "support@galibrand.cloud".
 */
export const getSupportNotificationEmail = async () => {
  try {
    const settings = await PlatformSettings.findOne({ key: "global" });
    if (settings && settings.supportNotificationEmail && settings.supportNotificationEmail.includes("@")) {
      return settings.supportNotificationEmail.trim();
    }
  } catch (err) {
    console.warn("[Notification] Could not fetch support email from settings:", err.message);
  }
  return process.env.SUPPORT_NOTIFICATION_EMAIL || "support@galibrand.cloud";
};

/**
 * Retrieves an active Nodemailer transporter and sender string.
 */
export const getActiveNotificationTransporter = async () => {
  try {
    const mailSetup = await getLandingMailConfigAndTransporter();
    if (mailSetup && mailSetup.transporter) {
      const senderEmail = mailSetup.config?.fromEmail || mailSetup.config?.smtpUser || process.env.EMAIL_USER;
      const senderName = mailSetup.config?.fromName || "GaliBrand Platform";
      return {
        transporter: mailSetup.transporter,
        sender: `"${senderName}" <${senderEmail}>`
      };
    }
  } catch (err) {
    console.warn("[Notification] Error fetching landing mail transporter:", err.message);
  }

  // Direct environment variable fallback
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const fallbackTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: Number(process.env.EMAIL_PORT) === 465,
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
      sender: `"GaliBrand Platform" <${process.env.EMAIL_USER}>`
    };
  }

  return { transporter: null, sender: null };
};

/**
 * Replaces mustache-style {{variable}} placeholders in a template string.
 */
export const renderTemplate = (template, variables = {}) => {
  let result = template || "";
  for (const [key, val] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, val !== undefined && val !== null ? String(val) : "");
  }
  return result;
};

/**
 * 1. SEND NOTIFICATION TO SUPPORT WHEN A STORE OWNER SIGNS UP
 */
export const sendNewUserSignupAlert = async (user) => {
  try {
    const supportEmail = await getSupportNotificationEmail();
    const { transporter, sender } = await getActiveNotificationTransporter();

    if (!transporter) {
      console.warn("[Notification] Skipping new user signup alert: No mail transporter available.");
      return { sent: false, reason: "No transporter" };
    }

    const regTime = new Date(user.createdAt || Date.now()).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const subject = `🎉 [New Store Owner Signup] ${user.name} (${user.email})`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 24px; color: #1e293b; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff; padding: 28px 32px;">
            <span style="display: inline-block; padding: 4px 10px; background: rgba(59,130,246,0.3); border: 1px solid #3b82f6; border-radius: 9999px; font-size: 11px; font-weight: 700; color: #93c5fd; text-transform: uppercase;">
              GaliBrand Platform Alert
            </span>
            <h1 style="margin: 12px 0 4px 0; font-size: 22px; font-weight: 800;">New Store Owner Registered</h1>
            <p style="margin: 0; font-size: 13px; color: #94a3b8;">A new user has successfully registered and verified their account.</p>
          </div>
          <div style="padding: 28px 32px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600; width: 140px;">Full Name:</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: 700;">${user.name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Email Address:</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: 700;">
                  <a href="mailto:${user.email}" style="color: #2563eb; text-decoration: none;">${user.email}</a>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">User ID:</td>
                <td style="padding: 10px 0; color: #0f172a; font-family: monospace; font-weight: 700;">${user.userId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Auth Provider:</td>
                <td style="padding: 10px 0; color: #0f172a; text-transform: uppercase; font-size: 12px; font-weight: 700;">${user.provider || "email"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Signup Time:</td>
                <td style="padding: 10px 0; color: #0f172a;">${regTime}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Store Status:</td>
                <td style="padding: 10px 0;">
                  <span style="display: inline-block; padding: 2px 8px; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; border-radius: 9999px;">
                    Awaiting Store Creation
                  </span>
                </td>
              </tr>
            </table>

            <div style="margin-top: 28px; text-align: center;">
              <a href="https://admin.galibrand.cloud/dashboard/users" style="display: inline-block; padding: 12px 28px; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 10px;">
                View Platform Users in Dashboard &rarr;
              </a>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
            Sent automatically to <strong>${supportEmail}</strong> via GaliBrand Notification Service.
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: sender,
      to: supportEmail,
      subject,
      html: htmlContent
    });

    console.log(`[Notification] ✅ New user signup alert sent to ${supportEmail} for ${user.email}`);
    return { sent: true };
  } catch (error) {
    console.error("[Notification] ❌ Error sending new user signup alert:", error.message);
    return { sent: false, error: error.message };
  }
};

/**
 * 2. SEND NOTIFICATION TO SUPPORT WHEN A USER CREATES A STORE
 */
export const sendNewStoreCreatedAlert = async (store, ownerUser) => {
  try {
    const supportEmail = await getSupportNotificationEmail();
    const { transporter, sender } = await getActiveNotificationTransporter();

    if (!transporter) {
      console.warn("[Notification] Skipping new store alert: No mail transporter available.");
      return { sent: false, reason: "No transporter" };
    }

    const createdTime = new Date(store.createdAt || Date.now()).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const storeUrl = `https://${store.subdomain || `${store.storeSlug}.galibrand.cloud`}`;
    const subject = `🏬 [New Store Created] ${store.storeName} (${store.storeId}) by ${ownerUser?.name || "Owner"}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 24px; color: #1e293b; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          <div style="background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; padding: 28px 32px;">
            <span style="display: inline-block; padding: 4px 10px; background: rgba(255,255,255,0.25); border-radius: 9999px; font-size: 11px; font-weight: 700; color: #ffffff; text-transform: uppercase;">
              GaliBrand Store Creation Alert
            </span>
            <h1 style="margin: 12px 0 4px 0; font-size: 22px; font-weight: 800;">New Store Launched!</h1>
            <p style="margin: 0; font-size: 13px; color: #ecfdf5;">A store owner has successfully created their online storefront.</p>
          </div>
          <div style="padding: 28px 32px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600; width: 140px;">Store Name:</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: 800; font-size: 16px;">${store.storeName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Store Code:</td>
                <td style="padding: 10px 0; color: #0f172a; font-family: monospace; font-weight: 700;">${store.storeId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Store Domain:</td>
                <td style="padding: 10px 0;">
                  <a href="${storeUrl}" target="_blank" style="color: #059669; font-weight: 700; text-decoration: underline;">${storeUrl}</a>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Store Type:</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${store.storeType || "Standard"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Owner Details:</td>
                <td style="padding: 10px 0; color: #0f172a;">
                  <strong>${ownerUser?.name || store.ownerId}</strong>
                  ${ownerUser?.email ? `<br/><span style="font-size: 12px; color: #64748b;">${ownerUser.email}</span>` : ""}
                  <br/><span style="font-size: 11px; font-family: monospace; color: #94a3b8;">UID: ${ownerUser?.userId || store.ownerId}</span>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Assisted Staff:</td>
                <td style="padding: 10px 0; color: #0f172a;">${store.empID || "Self-Registered"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Trial & Plan:</td>
                <td style="padding: 10px 0; color: #059669; font-weight: 700;">
                  7-Day Free Trial (Active)
                  ${store.planExpiryDate ? `<br/><span style="font-size: 12px; color: #64748b; font-weight: normal;">Expires: ${new Date(store.planExpiryDate).toLocaleDateString()}</span>` : ""}
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Created Time:</td>
                <td style="padding: 10px 0; color: #0f172a;">${createdTime}</td>
              </tr>
            </table>

            <div style="margin-top: 28px; display: flex; gap: 12px; justify-content: center;">
              <a href="${storeUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #059669; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 10px;">
                Visit Store Website &rarr;
              </a>
              <a href="https://admin.galibrand.cloud/dashboard/stores" target="_blank" style="display: inline-block; padding: 12px 24px; background: #0f172a; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 10px;">
                Manage in Admin &rarr;
              </a>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
            Sent automatically to <strong>${supportEmail}</strong> via GaliBrand Notification Service.
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: sender,
      to: supportEmail,
      subject,
      html: htmlContent
    });

    console.log(`[Notification] ✅ New store created alert sent to ${supportEmail} for ${store.storeName} (${store.storeId})`);
    return { sent: true };
  } catch (error) {
    console.error("[Notification] ❌ Error sending new store alert:", error.message);
    return { sent: false, error: error.message };
  }
};

/**
 * 3. SEND ALERT TO SUPPORT WHEN A USER HAS NOT CREATED A STORE AFTER 24 HOURS
 */
export const send24HourNoStoreAlertToSupport = async (user) => {
  try {
    const supportEmail = await getSupportNotificationEmail();
    const { transporter, sender } = await getActiveNotificationTransporter();

    if (!transporter) {
      console.warn("[Notification] Skipping 24h no-store alert: No mail transporter available.");
      return { sent: false, reason: "No transporter" };
    }

    const signupTime = new Date(user.createdAt).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const hoursElapsed = Math.round((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60));
    const subject = `⚠️ [24h Notice] User ${user.name} (${user.email}) has not created a store yet`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 24px; color: #1e293b; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #fed7aa; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          <div style="background: linear-gradient(135deg, #ea580c, #f97316); color: #ffffff; padding: 28px 32px;">
            <span style="display: inline-block; padding: 4px 10px; background: rgba(255,255,255,0.25); border-radius: 9999px; font-size: 11px; font-weight: 700; color: #ffffff; text-transform: uppercase;">
              24-Hour Inactivity Notice
            </span>
            <h1 style="margin: 12px 0 4px 0; font-size: 22px; font-weight: 800;">User Has Not Created a Store</h1>
            <p style="margin: 0; font-size: 13px; color: #ffedd5;">This user registered over 24 hours ago but has not launched their store.</p>
          </div>
          <div style="padding: 28px 32px;">
            <div style="background: #fff7ed; border-left: 4px solid #ea580c; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; color: #9a3412; font-size: 13px; font-weight: 600; line-height: 1.5;">
                ⏱️ Elapsed Time: <strong>${hoursElapsed} hours</strong> since signup. 0 stores found under this account.
              </p>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600; width: 140px;">User Name:</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: 700;">${user.name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Email Address:</td>
                <td style="padding: 10px 0; color: #0f172a;">
                  <a href="mailto:${user.email}" style="color: #ea580c; font-weight: 700; text-decoration: none;">${user.email}</a>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">User ID:</td>
                <td style="padding: 10px 0; color: #0f172a; font-family: monospace; font-weight: 700;">${user.userId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Signup Time:</td>
                <td style="padding: 10px 0; color: #0f172a;">${signupTime}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Recommended:</td>
                <td style="padding: 10px 0; color: #475569;">Send store creation reminder email or reach out for onboarding support.</td>
              </tr>
            </table>

            <div style="margin-top: 28px; text-align: center;">
              <a href="https://admin.galibrand.cloud/dashboard/users" style="display: inline-block; padding: 12px 28px; background: #ea580c; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 10px;">
                Send Reminder from Admin Dashboard &rarr;
              </a>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
            Sent automatically to <strong>${supportEmail}</strong> via GaliBrand Notification Service.
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: sender,
      to: supportEmail,
      subject,
      html: htmlContent
    });

    console.log(`[Notification] ✅ 24h no-store alert sent to ${supportEmail} for user ${user.email}`);
    return { sent: true };
  } catch (error) {
    console.error("[Notification] ❌ Error sending 24h no-store alert:", error.message);
    return { sent: false, error: error.message };
  }
};

/**
 * 4. BATCH CRON CHECK: FIND ALL USERS WHO REGISTERED >= 24 HOURS AGO WITHOUT A STORE
 */
export const checkAndSend24HourNoStoreAlerts = async () => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const pendingUsers = await User.find({
      role: "user",
      createdAt: { $lte: twentyFourHoursAgo },
      storeNotCreatedAlertSent: { $ne: true }
    });

    if (pendingUsers.length === 0) {
      return { success: true, checked: 0, alerted: 0 };
    }

    console.log(`[Notification-Cron] Checking ${pendingUsers.length} users registered >= 24h ago for store creation...`);

    let alertedCount = 0;
    for (const user of pendingUsers) {
      const hasStore = await Store.exists({
        ownerId: { $in: [user.userId, user._id] },
        isDeleted: { $ne: true }
      });

      if (!hasStore) {
        await send24HourNoStoreAlertToSupport(user);
        alertedCount++;
      }

      user.storeNotCreatedAlertSent = true;
      await user.save();
    }

    console.log(`[Notification-Cron] ✅ Completed 24h check. Checked: ${pendingUsers.length}, Alerted: ${alertedCount}`);
    return { success: true, checked: pendingUsers.length, alerted: alertedCount };
  } catch (error) {
    console.error("[Notification-Cron] ❌ Fatal error in checkAndSend24HourNoStoreAlerts:", error);
    return { success: false, error: error.message };
  }
};

/**
 * 5. SEND CUSTOM STORE CREATION REMINDER EMAIL TO A SPECIFIC USER
 * Managed via dashboard settings template (PlatformSettings.createStoreReminderTemplate)
 */
export const sendCreateStoreReminderToUser = async (userIdOrUser) => {
  try {
    let user = null;
    if (typeof userIdOrUser === "string" || userIdOrUser instanceof String) {
      user = await User.findById(userIdOrUser);
      if (!user) {
        user = await User.findOne({ userId: userIdOrUser });
      }
    } else {
      user = userIdOrUser;
    }

    if (!user || !user.email) {
      throw new Error("Valid user with email address is required to send reminder.");
    }

    const { transporter, sender } = await getActiveNotificationTransporter();
    if (!transporter) {
      throw new Error("Email transporter is not configured. Please check Landing Page Email or SMTP environment settings.");
    }

    let settings = await PlatformSettings.findOne({ key: "global" });
    if (!settings) {
      settings = await PlatformSettings.create({ key: "global" });
    }

    const template = settings.createStoreReminderTemplate || DEFAULT_CREATE_STORE_REMINDER_TEMPLATE;

    const variables = {
      userName: user.name || "Store Owner",
      userEmail: user.email,
      userId: user.userId || "",
      createStoreUrl: "https://dashboard.galibrand.cloud/create-store",
      mainLogoUrl: settings.mainLogoUrl || "https://storage.googleapis.com/galibrand/superadmin/products/galibrandfullname-logo.png",
      companyAddress: settings.companyAddress || "GaliBrand Cloud, India",
      companyPhone: settings.companyPhone || "+91 9876543210",
      platformName: "Galibrand Cloud"
    };

    const htmlContent = renderTemplate(template, variables);
    const subject = `🚀 Complete Your Store Setup on Galibrand Cloud - Start Your Free Trial Today!`;

    await transporter.sendMail({
      from: sender,
      to: user.email,
      subject,
      html: htmlContent
    });

    user.storeReminderSentAt = new Date();
    user.storeReminderCount = (user.storeReminderCount || 0) + 1;
    await user.save();

    console.log(`[Notification] ✅ Custom store creation reminder sent to ${user.email} (${user.userId})`);
    return {
      success: true,
      message: `Store creation reminder sent successfully to ${user.email}!`,
      sentAt: user.storeReminderSentAt,
      reminderCount: user.storeReminderCount
    };
  } catch (error) {
    console.error("[Notification] ❌ Error sending store reminder to user:", error);
    throw error;
  }
};

/**
 * 6. INITIALIZE BACKGROUND HOURLY CRON FOR 24-HOUR STORE CREATION CHECKS
 */
export const start24HourNoStoreCheckCron = async () => {
  console.log("[CRON] Initializing 24-Hour User Store Creation Monitor...");

  // Run initial check 20 seconds after server startup
  setTimeout(() => {
    checkAndSend24HourNoStoreAlerts().catch(err => {
      console.error("[CRON] Error during initial 24h store creation check:", err.message);
    });
  }, 20000);

  let nodeCronRegistered = false;
  try {
    const cronModule = await import("node-cron");
    const cron = cronModule.default || cronModule;

    // Run at minute 15 of every hour ('15 * * * *')
    cron.schedule("15 * * * *", async () => {
      console.log("[CRON] ⏰ Hourly check for users without store >= 24h...");
      await checkAndSend24HourNoStoreAlerts();
    });

    nodeCronRegistered = true;
    console.log("[CRON] ✅ node-cron scheduled for 24h store monitor (hourly at *:15).");
  } catch (err) {
    console.warn("[CRON] node-cron not available for 24h monitor, using setInterval fallback:", err.message);
  }

  // Backup native setInterval (runs every 60 minutes) if node-cron failed
  if (!nodeCronRegistered) {
    setInterval(async () => {
      try {
        console.log("[CRON-INTERVAL] Hourly check for users without store >= 24h...");
        await checkAndSend24HourNoStoreAlerts();
      } catch (e) {
        console.error("[CRON-INTERVAL] Error in hourly 24h store check:", e.message);
      }
    }, 60 * 60 * 1000);
  }
};
