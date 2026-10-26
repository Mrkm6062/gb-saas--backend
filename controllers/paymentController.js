import Razorpay from "razorpay";
import CheckoutSettings from "../models/CheckoutSettings.js";
import { decrypt } from "../utils/crypto.js";
import { createPaymentOrder } from "../services/paymentService.js";

export const createPayment = async (req, res) => {
  try {
    const { amount, storeId, orderId } = req.body;
    const effectiveStoreId = storeId || req.headers["x-store-id"];

    if (!amount) {
      return res.status(400).json({ message: "Amount is required" });
    }

    // Check if store has configured custom Razorpay keys in CheckoutSettings
    if (effectiveStoreId) {
      const settings = await CheckoutSettings.findOne({ storeId: effectiveStoreId });
      if (settings && settings.razorpayEnabled && settings.razorpayKeyId && settings.razorpayKeySecret) {
        let secret = settings.razorpayKeySecret;
        try {
          secret = decrypt(settings.razorpayKeySecret);
        } catch (e) {
          // in case it was stored plain
        }

        const storeRazorpay = new Razorpay({
          key_id: settings.razorpayKeyId,
          key_secret: secret
        });

        const rzpOrder = await storeRazorpay.orders.create({
          amount: Math.round(Number(amount) * 100),
          currency: "INR",
          receipt: orderId ? `rcpt_${String(orderId).slice(-6)}` : `rcpt_${Date.now()}`
        });

        return res.json({
          id: rzpOrder.id,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          keyId: settings.razorpayKeyId
        });
      }
    }

    // Platform default payment service fallback
    const order = await createPaymentOrder(amount);
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
