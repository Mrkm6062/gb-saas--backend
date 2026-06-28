import StoreNewsLetter from "../models/StoreNewsLetter.js";
import NewsletterTemplate from "../models/NewsletterTemplate.js";
import StoreAlerts from "../models/StoreAlerts.js";
import Store from "../models/Store.js";
import nodemailer from "nodemailer";

// PUBLIC: Subscribe to newsletter
export const subscribeNewsletter = async (req, res) => {
  try {
    const { storeId, email } = req.body;
    if (!storeId || !email) {
      return res.status(400).json({ message: "Store ID and Email are required" });
    }

    const emailLower = email.trim().toLowerCase();

    // Check if store exists
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    // Find or create subscriber
    let subscriber = await StoreNewsLetter.findOne({ storeId, email: emailLower });
    if (subscriber) {
      if (subscriber.isSubscribed) {
        return res.status(400).json({ message: "Email is already subscribed to this store" });
      } else {
        subscriber.isSubscribed = true;
        await subscriber.save();
        return res.status(200).json({ message: "Subscribed successfully!", subscriber });
      }
    }

    subscriber = await StoreNewsLetter.create({
      storeId,
      email: emailLower,
      isSubscribed: true
    });

    res.status(201).json({ message: "Subscribed successfully!", subscriber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ADMIN: Get all subscribers
export const getSubscribers = async (req, res) => {
  try {
    const { storeId } = req.params;
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const subscribers = await StoreNewsLetter.find({ storeId }).sort({ createdAt: -1 });
    res.json(subscribers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ADMIN: Toggle subscriber status
export const toggleSubscriberStatus = async (req, res) => {
  try {
    const { storeId, subscriberId } = req.params;
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const subscriber = await StoreNewsLetter.findOne({ _id: subscriberId, storeId });
    if (!subscriber) {
      return res.status(404).json({ message: "Subscriber not found" });
    }

    subscriber.isSubscribed = !subscriber.isSubscribed;
    await subscriber.save();

    res.json({ message: "Subscriber status updated successfully", subscriber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ADMIN: Get templates
export const getTemplates = async (req, res) => {
  try {
    const { storeId } = req.params;
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const templates = await NewsletterTemplate.find({ storeId }).sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ADMIN: Save template (Create/Update)
export const saveTemplate = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { templateId, name, subject, htmlContent, designJson } = req.body;

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (!name || !subject || !htmlContent) {
      return res.status(400).json({ message: "Template Name, Subject, and HTML Content are required" });
    }

    let template;
    if (templateId) {
      template = await NewsletterTemplate.findOneAndUpdate(
        { _id: templateId, storeId },
        { name, subject, htmlContent, designJson },
        { new: true }
      );
      if (!template) return res.status(404).json({ message: "Template not found" });
    } else {
      template = await NewsletterTemplate.create({
        storeId,
        name,
        subject,
        htmlContent,
        designJson
      });
    }

    res.json({ message: "Template saved successfully", template });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ADMIN: Delete template
export const deleteTemplate = async (req, res) => {
  try {
    const { storeId, templateId } = req.params;
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const template = await NewsletterTemplate.findOneAndDelete({ _id: templateId, storeId });
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    res.json({ message: "Template deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ADMIN: Send newsletter
export const sendNewsletter = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { templateId, subject: customSubject, htmlContent: customHtml } = req.body;

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Get SMTP Configuration
    const smtpConfig = await StoreAlerts.findOne({ storeId });
    if (!smtpConfig || !smtpConfig.isEmailEnabled || !smtpConfig.emailAddress || !smtpConfig.appPassword) {
      return res.status(400).json({ 
        message: "SMTP is not configured or disabled for this store. Please configure Email Alerts SMTP settings first." 
      });
    }

    // Determine subject and HTML content to send
    let subject = customSubject;
    let htmlContent = customHtml;

    if (templateId) {
      const template = await NewsletterTemplate.findOne({ _id: templateId, storeId });
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      subject = template.subject;
      htmlContent = template.htmlContent;
    }

    if (!subject || !htmlContent) {
      return res.status(400).json({ message: "Subject and HTML Content are required to send newsletter." });
    }

    // Get active subscribers
    const activeSubscribers = await StoreNewsLetter.find({ storeId, isSubscribed: true });
    if (activeSubscribers.length === 0) {
      return res.status(400).json({ message: "No active subscribers found for this store." });
    }

    // Configure transporter
    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtpHost,
      port: Number(smtpConfig.smtpPort),
      secure: Number(smtpConfig.smtpPort) === 465,
      auth: {
        user: smtpConfig.emailAddress,
        pass: smtpConfig.appPassword
      }
    });

    // Test transporter connection
    await transporter.verify();

    let successCount = 0;
    let failCount = 0;
    const failedEmails = [];

    // Send emails sequentially
    for (const sub of activeSubscribers) {
      try {
        await transporter.sendMail({
          from: `"${store.storeName}" <${smtpConfig.emailAddress}>`,
          to: sub.email,
          subject: subject,
          html: htmlContent
        });
        successCount++;
      } catch (error) {
        console.error(`Failed to send newsletter to ${sub.email}:`, error);
        failCount++;
        failedEmails.push({ email: sub.email, error: error.message });
      }
    }

    res.json({
      message: `Newsletter sent: ${successCount} succeeded, ${failCount} failed.`,
      successCount,
      failCount,
      failedEmails
    });
  } catch (error) {
    res.status(500).json({ message: `Newsletter sending failed: ${error.message}` });
  }
};
