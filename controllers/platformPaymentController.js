import PlatformPaymentSettings from "../models/PlatformPaymentSettings.js";
import Store from "../models/Store.js";
import Razorpay from "razorpay";
import Plan from "../models/Plan.js";
import crypto from "crypto";
import { encrypt, decrypt } from "../utils/crypto.js";

export const getSettings = async (req, res) => {
  try {
    // Ensure only Superadmin can access keys
    if (req.user.role !== 'superadmin') return res.status(403).json({ message: "Not authorized" });
    
    let settings = await PlatformPaymentSettings.findOne();
    if (!settings) settings = await PlatformPaymentSettings.create({});

    // Decrypt secret before sending to admin UI
    const responseSettings = settings.toObject();
    if (responseSettings.razorpayKeySecret) {
      responseSettings.razorpayKeySecret = decrypt(responseSettings.razorpayKeySecret);
    }
    res.json(responseSettings);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const updateSettings = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') return res.status(403).json({ message: "Not authorized" });
    const { razorpayEnabled, razorpayKeyId, razorpayKeySecret } = req.body;
    
    let settings = await PlatformPaymentSettings.findOne();
    if (!settings) settings = new PlatformPaymentSettings();
    
    settings.razorpayEnabled = razorpayEnabled;
    settings.razorpayKeyId = razorpayKeyId;

    // Only update the secret if it's part of the request body
    if (req.body.hasOwnProperty('razorpayKeySecret')) {
      if (razorpayKeySecret) {
        settings.razorpayKeySecret = encrypt(razorpayKeySecret);
      } else {
        settings.razorpayKeySecret = null; // Clear if empty string is provided
      }
    }

    await settings.save();
    
    // Return the updated settings with the secret decrypted for the UI
    const responseSettings = settings.toObject();
    if (responseSettings.razorpayKeySecret) {
      responseSettings.razorpayKeySecret = decrypt(responseSettings.razorpayKeySecret);
    }
    res.json(responseSettings);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const getPublicKey = async (req, res) => {
  try {
    const settings = await PlatformPaymentSettings.findOne();
    res.json({ 
      razorpayEnabled: settings?.razorpayEnabled || false, 
      razorpayKeyId: settings?.razorpayEnabled ? settings.razorpayKeyId : null 
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const createSubscriptionOrder = async (req, res) => {
  try {
    const { amount, storeId } = req.body; // amount in INR
    const settings = await PlatformPaymentSettings.findOne();
    
    if (!settings || !settings.razorpayEnabled) return res.status(400).json({ message: "Razorpay is not enabled on platform" });

    const keySecret = decrypt(settings.razorpayKeySecret);
    if (!keySecret) {
      return res.status(500).json({ message: "Razorpay secret key is missing or corrupted." });
    }

    const instance = new Razorpay({ key_id: settings.razorpayKeyId, key_secret: keySecret });
    
    // Ensure receipt is under 40 chars max (Razorpay limit)
    const safeStoreId = storeId ? storeId.toString().slice(-10) : 'store';
    const receipt = `sub_${safeStoreId}_${Date.now()}`.substring(0, 40);
    
    const options = { amount: Math.round(amount * 100), currency: "INR", receipt };
    
    const order = await instance.orders.create(options);
    res.json(order);
  } catch (error) { 
    const errorMsg = error.error ? error.error.description : error.message;
    res.status(500).json({ message: errorMsg || "Failed to create payment order" }); 
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, storeId, planId } = req.body;
    const settings = await PlatformPaymentSettings.findOne();

    const keySecret = decrypt(settings.razorpayKeySecret);
    if (!keySecret) {
      return res.status(500).json({ message: "Razorpay secret key is missing or corrupted." });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac("sha256", keySecret).update(body.toString()).digest("hex");

    if (expectedSignature === razorpay_signature) {
      const planExpiryDate = new Date();
      planExpiryDate.setDate(planExpiryDate.getDate() + 30); // Grant 30 days of access

      const plan = await Plan.findById(planId);
      const invoiceId = `INV-${Date.now().toString().slice(-6).toUpperCase()}`;

      await Store.findByIdAndUpdate(storeId, { 
        $set: {
          subscriptionStatus: 'active', 
          planId: planId,
          isTrialActive: false,
          planStartDate: new Date(),
          planExpiryDate: planExpiryDate,
          lastPaymentId: razorpay_payment_id // Log the payment confirmation
        },
        $push: {
          billingHistory: {
            planId: plan._id,
            planName: plan.name,
            amount: plan.price,
            date: new Date(),
            transactionId: razorpay_payment_id,
            invoiceId: invoiceId
          }
        }
      });

      res.json({ message: "Payment verified successfully", success: true });
    } else {
      res.status(400).json({ message: "Invalid signature", success: false });
    }
  } catch (error) { 
    res.status(500).json({ message: error.message }); 
  }
};