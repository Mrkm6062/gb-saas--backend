import nodemailer from "nodemailer";
import LandingMailConfig from "../models/LandingMailConfig.js";

/**
 * Creates and returns a Nodemailer transporter using the provided or saved config.
 */
export const createLandingTransporter = (config) => {
  const isSecure =
    typeof config.secure === "boolean"
      ? config.secure
      : Number(config.smtpPort) === 465;

  return nodemailer.createTransport({
    host: config.smtpHost,
    port: Number(config.smtpPort) || 587,
    secure: isSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Send an email alert to all configured receiver emails when a contact form is submitted.
 */
export const sendLandingContactAlert = async (contact) => {
  try {
    const config = await LandingMailConfig.findOne({ key: "global" });

    if (!config) {
      return { sent: false, reason: "Landing mail configuration not found" };
    }

    if (!config.isEnabled) {
      return { sent: false, reason: "Email alerts are currently disabled in settings" };
    }

    if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
      return { sent: false, reason: "Incomplete SMTP configuration (host/user/pass missing)" };
    }

    const recipients = (config.receiverEmails || [])
      .map((e) => (typeof e === "string" ? e.trim() : ""))
      .filter((e) => e.length > 0 && e.includes("@"));

    if (recipients.length === 0) {
      return { sent: false, reason: "No valid receiver emails configured" };
    }

    const transporter = createLandingTransporter(config);

    const senderName = config.fromName || "GaliBrand Contact Form";
    const senderEmail = config.fromEmail || config.smtpUser;
    const prefix = config.subjectPrefix || "New Contact Inquiry";
    const shopSuffix = contact.shopName ? ` [Shop: ${contact.shopName}]` : "";
    const subject = `[${prefix}] ${contact.name}${shopSuffix}${contact.subject ? " - " + contact.subject : ""}`;

    const submissionDate = new Date(contact.createdAt || Date.now()).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const replySubject = encodeURIComponent(
      contact.subject ? `Re: ${contact.subject}` : `Re: Your inquiry on GaliBrand`
    );

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>New Contact Form Submission</title>
      </head>
      <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; color: #1e293b;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px; background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); text-align: left;">
              <span style="display: inline-block; padding: 4px 10px; background-color: rgba(255,255,255,0.2); border-radius: 9999px; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                GaliBrand Alert
              </span>
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 10px 0 4px 0;">
                New Contact Form Submission
              </h1>
              <p style="color: #e0f2fe; font-size: 13px; margin: 0;">
                A visitor submitted the contact form on the GaliBrand landing page.
              </p>
            </td>
          </tr>

          <!-- Contact Details -->
          <tr>
            <td style="padding: 28px 32px 16px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; width: 140px; font-size: 13px; font-weight: 600; color: #64748b;">
                    Full Name
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 600; color: #0f172a;">
                    ${contact.name || "N/A"}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">
                    Email Address
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #0284c7; font-weight: 500;">
                    <a href="mailto:${contact.email}" style="color: #0284c7; text-decoration: none;">${contact.email || "N/A"}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">
                    Phone Number
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #0f172a;">
                    ${contact.phone ? `<a href="tel:${contact.phone}" style="color: #0f172a; text-decoration: none;">${contact.phone}</a>` : '<span style="color: #94a3b8;">Not provided</span>'}
                  </td>
                </tr>
                ${
                  contact.shopName
                    ? `
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">
                    Shop Name
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #0f172a; font-weight: 700;">
                    ${contact.shopName}
                  </td>
                </tr>
                `
                    : ""
                }
                ${
                  contact.subject
                    ? `
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">
                    Subject
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #0f172a; font-weight: 500;">
                    ${contact.subject}
                  </td>
                </tr>
                `
                    : ""
                }
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #64748b;">
                    Submitted At
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #64748b;">
                    ${submissionDate}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Message Box -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <div style="font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 8px;">
                Message Content:
              </div>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${contact.message || "No message body."}</div>
            </td>
          </tr>

          <!-- Action Button -->
          <tr>
            <td style="padding: 0 32px 28px 32px; text-align: center;">
              <a href="mailto:${contact.email}?subject=${replySubject}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; box-shadow: 0 2px 6px rgba(37,99,235,0.25);">
                Reply to ${contact.name}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
              This alert was generated automatically from the <strong>GaliBrand Landing Page</strong>.<br />
              Recipients: ${recipients.join(", ")}
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const textContent = `
NEW CONTACT FORM SUBMISSION - GALIBRAND
===================================================

Name: ${contact.name}
Email: ${contact.email || "Not provided"}
Phone: ${contact.phone || "Not provided"}
Shop Name: ${contact.shopName || "Not provided"}
Subject: ${contact.subject || "N/A"}
Date: ${submissionDate}

Message:
---------------------------------------------------
${contact.message}
---------------------------------------------------

Reply to: ${contact.email}
Configured Receivers: ${recipients.join(", ")}
    `.trim();

    const mailOptions = {
      from: `"${senderName}" <${senderEmail}>`,
      to: recipients.join(", "),
      replyTo: contact.email,
      subject,
      text: textContent,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      sent: true,
      sentTo: recipients,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("❌ Failed to send landing contact alert email:", error);
    return {
      sent: false,
      reason: error.message || "Unknown mail delivery error",
    };
  }
};

/**
 * Verify SMTP connection and send a test email.
 */
export const testLandingMailConnection = async (testConfig) => {
  const isSecure =
    typeof testConfig.secure === "boolean"
      ? testConfig.secure
      : Number(testConfig.smtpPort) === 465;

  const transporter = nodemailer.createTransport({
    host: testConfig.smtpHost,
    port: Number(testConfig.smtpPort) || 587,
    secure: isSecure,
    auth: {
      user: testConfig.smtpUser,
      pass: testConfig.smtpPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  // Verify connection configuration
  await transporter.verify();

  // If a test email recipient was supplied, send an actual test message
  if (testConfig.testEmailTo) {
    const senderName = testConfig.fromName || "GaliBrand Contact System";
    const senderEmail = testConfig.fromEmail || testConfig.smtpUser;

    await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: testConfig.testEmailTo,
      subject: `✅ [GaliBrand] SMTP Connection Test Successful`,
      html: `
        <div style="font-family: sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
          <h2 style="color: #16a34a; margin-top: 0;">SMTP Test Successful!</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Congratulations! Your email alert configuration for the <strong>GaliBrand Landing Page</strong> is working correctly.
          </p>
          <div style="background-color: #f8fafc; border-left: 4px solid #16a34a; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #475569;">
            <strong>SMTP Host:</strong> ${testConfig.smtpHost}<br />
            <strong>SMTP Port:</strong> ${testConfig.smtpPort} (${isSecure ? "SSL/TLS" : "STARTTLS"})<br />
            <strong>User:</strong> ${testConfig.smtpUser}<br />
            <strong>Sender Name:</strong> ${senderName}<br />
            <strong>Tested At:</strong> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">
            When users submit contact forms on your landing page, alert emails will be dispatched using these settings.
          </p>
        </div>
      `,
      text: `SMTP Test Successful! Your GaliBrand landing page email alerts are configured properly.\nHost: ${testConfig.smtpHost}\nPort: ${testConfig.smtpPort}\nUser: ${testConfig.smtpUser}`,
    });
  }

  return { success: true, message: "SMTP configuration verified and test email sent successfully!" };
};
