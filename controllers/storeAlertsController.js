import StoreAlerts from "../models/StoreAlerts.js";
import Store from "../models/Store.js";
import LandingMailConfig from "../models/LandingMailConfig.js";
import nodemailer from "nodemailer";
import { getDefaultTemplates } from "../utils/defaultAlertTemplates.js";
import { getLandingMailConfigAndTransporter } from "../services/landingEmailService.js";

// GET STORE ALERT CONFIGURATION
export const getAlertConfig = async (req, res) => {
  try {
    const { storeId } = req.params;
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Unauthorized" });

    let config = await StoreAlerts.findOne({ storeId });
    if (!config) {
      // Auto-initialize default alert config using LandingMailConfig by default
      config = await StoreAlerts.create({
        storeId,
        isEmailEnabled: true,
        useDefaultMail: true,
        provider: "system",
        smtpHost: "smtp.gmail.com",
        smtpPort: 587,
        emailAddress: "",
        appPassword: "",
        templates: getDefaultTemplates(store.storeName),
      });
    } else {
      // Populate default templates if none exist
      if (!config.templates || config.templates.length === 0) {
        config.templates = getDefaultTemplates(store.storeName);
        await config.save();
      }
    }

    const isCustomConfigured = Boolean(
      config.emailAddress && String(config.emailAddress).trim() && 
      config.appPassword && String(config.appPassword).trim()
    );

    // If useDefaultMail is undefined, default it to true if custom is not configured
    const useDefaultMail = config.useDefaultMail !== undefined 
      ? config.useDefaultMail 
      : (!isCustomConfigured);

    // Check system landing mail availability
    const landingConfig = await LandingMailConfig.findOne({ key: "global" });
    const isSystemMailAvailable = Boolean(
      (landingConfig && landingConfig.smtpHost && landingConfig.smtpUser && landingConfig.smtpPass) ||
      (process.env.EMAIL_USER && process.env.EMAIL_PASS)
    );
    const systemSender = landingConfig?.fromEmail || landingConfig?.smtpUser || process.env.EMAIL_USER || "system@galibrand.cloud";

    res.json({
      ...config.toObject(),
      useDefaultMail,
      isCustomConfigured,
      isSystemMailAvailable,
      systemSender,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// SAVE / UPDATE STORE ALERT CONFIGURATION
export const saveAlertConfig = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { 
      isEmailEnabled, 
      useDefaultMail, 
      provider, 
      smtpHost, 
      smtpPort, 
      emailAddress, 
      appPassword, 
      templates 
    } = req.body;
    
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Unauthorized" });

    const hasCustomCredentials = Boolean(
      emailAddress && String(emailAddress).trim() && 
      appPassword && String(appPassword).trim()
    );

    // If store owner enters valid custom email & password and hasn't explicitly set useDefaultMail to true,
    // automatically disable default mail and use custom SMTP.
    let resolvedUseDefaultMail = useDefaultMail;
    if (resolvedUseDefaultMail === undefined) {
      resolvedUseDefaultMail = !hasCustomCredentials;
    }

    const resolvedProvider = resolvedUseDefaultMail ? "system" : (provider || "gmail");

    const config = await StoreAlerts.findOneAndUpdate(
      { storeId },
      { 
        isEmailEnabled: isEmailEnabled !== undefined ? isEmailEnabled : true,
        useDefaultMail: resolvedUseDefaultMail,
        provider: resolvedProvider,
        smtpHost: smtpHost || "smtp.gmail.com",
        smtpPort: Number(smtpPort) || 587,
        emailAddress: emailAddress ? emailAddress.trim() : "",
        appPassword: appPassword || "",
        ...(templates ? { templates } : {})
      },
      { new: true, upsert: true }
    );

    res.json({ 
      message: resolvedUseDefaultMail 
        ? "Saved! System Default Mail is active for customer order & delivery alerts." 
        : "Saved! Custom Mail Configuration is active. Default system mail has been disabled.", 
      config 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// SEND TEST EMAIL (Supports both System Default Mail & Custom SMTP)
export const sendTestMail = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { useDefaultMail, smtpHost, smtpPort, emailAddress, appPassword, testEmailTo } = req.body;

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Unauthorized" });

    if (!testEmailTo) {
      return res.status(400).json({ message: "Please provide a recipient email address for testing." });
    }

    // Test System Default Mail
    if (useDefaultMail) {
      const landingData = await getLandingMailConfigAndTransporter();
      if (!landingData) {
        return res.status(400).json({ 
          message: "Platform Landing Mail is not configured in settings or environment." 
        });
      }

      const fromAddr = landingData.config.fromEmail || landingData.config.smtpUser;
      await landingData.transporter.verify();
      await landingData.transporter.sendMail({
        from: `"${store.storeName}" <${fromAddr}>`,
        to: testEmailTo,
        subject: `[Test] Delivery Status & Order Alert - ${store.storeName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #1e293b;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0; font-size: 18px; font-weight: 800;">✓ System Default Mail Connected!</h2>
              <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Store: ${store.storeName}</p>
            </div>
            <p style="font-size: 14px; line-height: 1.5; color: #334155;">
              This test email was sent using the <strong>GaliBrand System Mail (LandingMailConfig)</strong> on behalf of <strong>${store.storeName}</strong>.
            </p>
            <p style="font-size: 13px; line-height: 1.5; color: #64748b;">
              Your customers will automatically receive order confirmation and delivery status (placed, shipped, delivered) notifications.
            </p>
            <div style="margin-top: 20px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 11px; color: #94a3b8; text-align: center;">
              Sent via GaliBrand Store Alert Service
            </div>
          </div>
        `
      });
      return res.json({ message: "Test email sent successfully via System Default Mail (LandingMailConfig)!" });
    }

    // Test Custom SMTP
    if (!emailAddress || !appPassword) {
      return res.status(400).json({ 
        message: "Email address and App Password are required to test custom SMTP." 
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost || "smtp.gmail.com", 
      port: Number(smtpPort) || 587, 
      secure: Number(smtpPort) === 465,
      auth: { user: emailAddress, pass: appPassword }
    });

    await transporter.verify(); // Test connection
    await transporter.sendMail({
      from: `"${store.storeName}" <${emailAddress}>`,
      to: testEmailTo,
      subject: `[Test] Custom Mail Server Connected - ${store.storeName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #1e293b;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 18px; font-weight: 800;">✓ Custom Mail Server Connected!</h2>
            <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Store: ${store.storeName}</p>
          </div>
          <p style="font-size: 14px; line-height: 1.5; color: #334155;">
            Your custom SMTP server (<strong>${emailAddress}</strong>) is configured and working perfectly!
          </p>
          <p style="font-size: 13px; line-height: 1.5; color: #64748b;">
            All automated delivery status and order emails will now be sent directly from your email address. Default system mail is disabled.
          </p>
        </div>
      `
    });

    res.json({ message: "Test email sent successfully via your custom mail server!" });
  } catch (error) {
    res.status(500).json({ message: `Failed to connect to mail server: ${error.message}` });
  }
};
