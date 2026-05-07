import PlatformPaymentSettings from "../models/PlatformPaymentSettings.js";
import Store from "../models/Store.js";
import Razorpay from "razorpay";
import crypto from "crypto";

export const getSettings = async (req, res) => {
  try {
    // Ensure only Superadmin can access keys
    if (req.user.role !== 'superadmin') return res.status(403).json({ message: "Not authorized" });
    
    let settings = await PlatformPaymentSettings.findOne();
    if (!settings) settings = await PlatformPaymentSettings.create({});
    res.json(settings);
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
    settings.razorpayKeySecret = razorpayKeySecret;
    await settings.save();
    
    res.json(settings);
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

    const instance = new Razorpay({ key_id: settings.razorpayKeyId, key_secret: settings.razorpayKeySecret });
    const options = { amount: amount * 100, currency: "INR", receipt: `sub_rcpt_${storeId}_${Date.now()}` };
    
    const order = await instance.orders.create(options);
    res.json(order);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, storeId, planId } = req.body;
    const settings = await PlatformPaymentSettings.findOne();

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac("sha256", settings.razorpayKeySecret).update(body.toString()).digest("hex");

    if (expectedSignature === razorpay_signature) {
      // Payment is authentic -> Mark store as active/paid
      await Store.findByIdAndUpdate(storeId, { subscriptionStatus: 'active', plan: planId || 'paid' });
      res.json({ message: "Payment verified successfully", success: true });
    } else {
      res.status(400).json({ message: "Invalid signature", success: false });
    }
  } catch (error) { 
    res.status(500).json({ message: error.message }); 
  }
};