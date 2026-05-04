import StoreAlerts from "../models/StoreAlerts.js";
import Store from "../models/Store.js";
import nodemailer from "nodemailer";

export const getAlertConfig = async (req, res) => {
  try {
    const { storeId } = req.params;
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Unauthorized" });

    let config = await StoreAlerts.findOne({ storeId });
    if (!config) {
      config = { isEmailEnabled: false, provider: 'gmail', smtpHost: 'smtp.gmail.com', smtpPort: 587, emailAddress: '', appPassword: '' };
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const saveAlertConfig = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { isEmailEnabled, provider, smtpHost, smtpPort, emailAddress, appPassword } = req.body;
    
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Unauthorized" });

    const config = await StoreAlerts.findOneAndUpdate(
      { storeId },
      { isEmailEnabled, provider, smtpHost, smtpPort, emailAddress, appPassword },
      { new: true, upsert: true }
    );
    res.json({ message: "Settings saved successfully", config });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const sendTestMail = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { smtpHost, smtpPort, emailAddress, appPassword, testEmailTo } = req.body;

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Unauthorized" });

    const transporter = nodemailer.createTransport({
      host: smtpHost, port: Number(smtpPort), secure: Number(smtpPort) === 465,
      auth: { user: emailAddress, pass: appPassword }
    });

    await transporter.verify(); // Test connection
    await transporter.sendMail({
      from: `"${store.storeName}" <${emailAddress}>`,
      to: testEmailTo,
      subject: `Test Email from ${store.storeName}`,
      text: "This is a test email to verify your SMTP configuration. If you received this, your email settings are working perfectly!"
    });
    res.json({ message: "Test email sent successfully!" });
  } catch (error) {
    res.status(500).json({ message: `Failed to connect to mail server: ${error.message}` });
  }
};