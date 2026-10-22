import LandingContact from "../models/LandingContact.js";
import LandingMailConfig from "../models/LandingMailConfig.js";
import {
  sendLandingContactAlert,
  testLandingMailConnection,
} from "../services/landingEmailService.js";

/**
 * Normalizes receiver emails from an array, comma-separated string, or newline-separated string.
 */
const parseReceiverEmails = (input) => {
  if (Array.isArray(input)) {
    return input
      .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
      .filter((e) => e && e.includes("@"));
  }
  if (typeof input === "string") {
    return input
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes("@"));
  }
  return [];
};

/**
 * PUBLIC: Submit contact form on landing page
 * POST /api/landing-contact (or /api/contact)
 */
export const submitContactForm = async (req, res) => {
  try {
    const { name, email, phone, shopName, shopname, shop_name, subject, message } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Name is required." });
    }

    const cleanName = name.trim();
    const cleanPhone = (phone || "").trim();
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanShopName = (shopName || shopname || shop_name || "").trim();

    if (!cleanEmail && !cleanPhone) {
      return res.status(400).json({
        success: false,
        message: "Please provide either a mobile number or an email address.",
      });
    }

    if (cleanEmail && !cleanEmail.includes("@")) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    const finalMessage = message && message.trim()
      ? message.trim()
      : (cleanShopName
        ? `Inquiry / demo request for shop: ${cleanShopName}`
        : "Contact request submitted from landing page");

    const finalSubject = subject && subject.trim()
      ? subject.trim()
      : (cleanShopName
        ? `Demo Request - ${cleanShopName}`
        : "New Landing Page Inquiry");

    const ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      "";
    const userAgent = req.headers["user-agent"] || "";

    // 1. Save submission to Database
    const contact = await LandingContact.create({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      shopName: cleanShopName,
      subject: finalSubject,
      message: finalMessage,
      ipAddress,
      userAgent,
      status: "new",
    });

    // 2. Dispatch Email Alert asynchronously using configured settings
    sendLandingContactAlert(contact)
      .then(async (result) => {
        if (result.sent) {
          contact.emailSent = true;
          contact.sentTo = result.sentTo || [];
          contact.emailError = "";
        } else {
          contact.emailSent = false;
          contact.emailError = result.reason || "Failed to dispatch email alert";
        }
        await contact.save();
      })
      .catch((err) => {
        console.error("Async email dispatch error:", err);
      });

    return res.status(201).json({
      success: true,
      message: "Thank you for reaching out! Your message has been received and our team will get back to you shortly.",
      submissionId: contact._id,
    });
  } catch (error) {
    console.error("❌ Error submitting landing contact form:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while processing your request. Please try again later.",
      error: error.message,
    });
  }
};

/**
 * SYSADMIN: Get current Landing Page Mail Configuration
 * GET /api/landing-contact/config
 */
export const getMailConfig = async (req, res) => {
  try {
    let config = await LandingMailConfig.findOne({ key: "global" });
    if (!config) {
      config = await LandingMailConfig.create({
        key: "global",
        isEnabled: false,
        smtpHost: "smtp.gmail.com",
        smtpPort: 587,
        secure: false,
        smtpUser: "",
        smtpPass: "",
        fromName: "GaliBrand Contact System",
        fromEmail: "",
        receiverEmails: [],
        subjectPrefix: "New Contact Inquiry",
      });
    }

    const configObj = config.toObject();
    configObj.hasPassword = Boolean(config.smtpPass);

    return res.status(200).json({
      success: true,
      config: configObj,
    });
  } catch (error) {
    console.error("❌ Error getting landing mail config:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve email configuration",
      error: error.message,
    });
  }
};

/**
 * SYSADMIN: Update Landing Page Mail Configuration
 * PUT /api/landing-contact/config
 */
export const updateMailConfig = async (req, res) => {
  try {
    const {
      isEnabled,
      smtpHost,
      smtpPort,
      secure,
      smtpUser,
      smtpPass,
      fromName,
      fromEmail,
      receiverEmails,
      subjectPrefix,
    } = req.body;

    let existingConfig = await LandingMailConfig.findOne({ key: "global" });
    if (!existingConfig) {
      existingConfig = new LandingMailConfig({ key: "global" });
    }

    if (typeof isEnabled === "boolean") existingConfig.isEnabled = isEnabled;
    if (smtpHost !== undefined) existingConfig.smtpHost = smtpHost.trim();
    if (smtpPort !== undefined) existingConfig.smtpPort = Number(smtpPort) || 587;
    if (typeof secure === "boolean") existingConfig.secure = secure;
    if (smtpUser !== undefined) existingConfig.smtpUser = smtpUser.trim();
    
    // Only update password if a new one was provided
    if (smtpPass !== undefined && smtpPass !== "") {
      existingConfig.smtpPass = smtpPass;
    }

    if (fromName !== undefined) existingConfig.fromName = fromName.trim();
    if (fromEmail !== undefined) existingConfig.fromEmail = fromEmail.trim();
    if (receiverEmails !== undefined) {
      existingConfig.receiverEmails = parseReceiverEmails(receiverEmails);
    }
    if (subjectPrefix !== undefined) existingConfig.subjectPrefix = subjectPrefix.trim();

    await existingConfig.save();

    const configObj = existingConfig.toObject();
    configObj.hasPassword = Boolean(existingConfig.smtpPass);

    return res.status(200).json({
      success: true,
      message: "Mail configuration updated successfully!",
      config: configObj,
    });
  } catch (error) {
    console.error("❌ Error updating landing mail config:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update mail configuration",
      error: error.message,
    });
  }
};

/**
 * SYSADMIN: Test Landing Page Mail Configuration
 * POST /api/landing-contact/config/test
 */
export const testMailConfig = async (req, res) => {
  try {
    const {
      smtpHost,
      smtpPort,
      secure,
      smtpUser,
      smtpPass,
      fromName,
      fromEmail,
      testEmailTo,
    } = req.body;

    const existingConfig = await LandingMailConfig.findOne({ key: "global" });

    const activePass =
      smtpPass && smtpPass !== ""
        ? smtpPass
        : existingConfig?.smtpPass || "";

    const activeHost = smtpHost || existingConfig?.smtpHost || "";
    const activePort = smtpPort || existingConfig?.smtpPort || 587;
    const activeUser = smtpUser || existingConfig?.smtpUser || "";
    const activeSecure =
      typeof secure === "boolean"
        ? secure
        : existingConfig?.secure ?? Number(activePort) === 465;

    if (!activeHost || !activeUser || !activePass) {
      return res.status(400).json({
        success: false,
        message: "SMTP Host, User, and Password are all required to test the connection.",
      });
    }

    if (!testEmailTo || !testEmailTo.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "A valid recipient email address is required to send the test email.",
      });
    }

    const testPayload = {
      smtpHost: activeHost,
      smtpPort: activePort,
      secure: activeSecure,
      smtpUser: activeUser,
      smtpPass: activePass,
      fromName: fromName || existingConfig?.fromName || "GaliBrand Contact System",
      fromEmail: fromEmail || existingConfig?.fromEmail || activeUser,
      testEmailTo: testEmailTo.trim(),
    };

    try {
      const result = await testLandingMailConnection(testPayload);

      // Record test status in DB
      if (existingConfig) {
        existingConfig.lastTestedAt = new Date();
        existingConfig.lastTestStatus = "Success";
        await existingConfig.save();
      }

      return res.status(200).json({
        success: true,
        message: result.message || "Test email sent successfully!",
      });
    } catch (testErr) {
      if (existingConfig) {
        existingConfig.lastTestedAt = new Date();
        existingConfig.lastTestStatus = `Failed: ${testErr.message}`;
        await existingConfig.save();
      }
      return res.status(400).json({
        success: false,
        message: `SMTP Test Failed: ${testErr.message}`,
      });
    }
  } catch (error) {
    console.error("❌ Error in testMailConfig:", error);
    return res.status(500).json({
      success: false,
      message: `Failed to test email settings: ${error.message}`,
    });
  }
};

/**
 * SYSADMIN: Get all received contact form submissions with filtering and stats
 * GET /api/landing-contact/submissions
 */
export const getContactSubmissions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const { status, search } = req.query;

    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { shopName: searchRegex },
        { subject: searchRegex },
        { message: searchRegex },
      ];
    }

    const [submissions, total, newCount, readCount, respondedCount, archivedCount] =
      await Promise.all([
        LandingContact.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        LandingContact.countDocuments(query),
        LandingContact.countDocuments({ status: "new" }),
        LandingContact.countDocuments({ status: "read" }),
        LandingContact.countDocuments({ status: "responded" }),
        LandingContact.countDocuments({ status: "archived" }),
      ]);

    // Calculate today's submissions count
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayCount = await LandingContact.countDocuments({
      createdAt: { $gte: startOfToday },
    });

    return res.status(200).json({
      success: true,
      submissions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
      stats: {
        total: newCount + readCount + respondedCount + archivedCount,
        new: newCount,
        read: readCount,
        responded: respondedCount,
        archived: archivedCount,
        today: todayCount,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching contact submissions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch contact form submissions",
      error: error.message,
    });
  }
};

/**
 * SYSADMIN: Get single contact submission by ID
 * GET /api/landing-contact/submissions/:id
 */
export const getContactSubmissionById = async (req, res) => {
  try {
    const { id } = req.params;
    const contact = await LandingContact.findById(id);

    if (!contact) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    // Automatically mark as read if it's currently new
    if (contact.status === "new") {
      contact.status = "read";
      await contact.save();
    }

    return res.status(200).json({
      success: true,
      submission: contact,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch submission details",
      error: error.message,
    });
  }
};

/**
 * SYSADMIN: Update status or notes for a contact submission
 * PATCH /api/landing-contact/submissions/:id
 */
export const updateContactSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const contact = await LandingContact.findById(id);
    if (!contact) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    if (status) {
      contact.status = status;
      if (status === "responded" && !contact.respondedAt) {
        contact.respondedAt = new Date();
      }
    }

    if (adminNotes !== undefined) {
      contact.adminNotes = adminNotes;
    }

    await contact.save();

    return res.status(200).json({
      success: true,
      message: "Submission updated successfully",
      submission: contact,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update submission",
      error: error.message,
    });
  }
};

/**
 * SYSADMIN: Delete a contact submission
 * DELETE /api/landing-contact/submissions/:id
 */
export const deleteContactSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await LandingContact.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Submission deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete submission",
      error: error.message,
    });
  }
};

/**
 * SYSADMIN: Resend email alert for a specific submission
 * POST /api/landing-contact/submissions/:id/resend
 */
export const resendContactAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const contact = await LandingContact.findById(id);

    if (!contact) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    const result = await sendLandingContactAlert(contact);

    if (result.sent) {
      contact.emailSent = true;
      contact.sentTo = result.sentTo || [];
      contact.emailError = "";
      await contact.save();

      return res.status(200).json({
        success: true,
        message: `Alert email dispatched successfully to: ${(result.sentTo || []).join(", ")}`,
        sentTo: result.sentTo,
      });
    } else {
      contact.emailSent = false;
      contact.emailError = result.reason;
      await contact.save();

      return res.status(400).json({
        success: false,
        message: `Failed to dispatch alert: ${result.reason}`,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error resending alert email",
      error: error.message,
    });
  }
};
