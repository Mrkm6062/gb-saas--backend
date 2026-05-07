import CheckoutSettings from "../models/CheckoutSettings.js";
import Store from "../models/Store.js";
import { encrypt, decrypt } from "../utils/crypto.js";

export const getPublicCheckoutSettings = async (req, res) => {
  try {
    let storeId = req.headers['x-store-id'] || (req.store && req.store._id);
    if (storeId === "undefined" || storeId === "null") storeId = null;

    if (!storeId) {
      return res.status(400).json({ message: "Store context missing" });
    }

    const settings = await CheckoutSettings.findOne({ storeId });
    // NEVER send the Razorpay Secret to the public storefront!
    res.json(settings || {
      codEnabled: true,
      whatsappEnabled: false,
      whatsappNumber: "",
      razorpayEnabled: false,
      razorpayKeyId: ""
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCheckoutSettings = async (req, res) => {
  try {
    const { storeId } = req.query;
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    let settings = await CheckoutSettings.findOne({ storeId });
    if (!settings) {
      settings = await CheckoutSettings.create({ storeId });
    }

    // Decrypt secret before sending to admin UI
    const responseSettings = settings.toObject();
    if (responseSettings.razorpayKeySecret) {
      responseSettings.razorpayKeySecret = decrypt(responseSettings.razorpayKeySecret);
    }
    res.json(responseSettings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCheckoutSettings = async (req, res) => {
  try {
    const { storeId, codEnabled, whatsappEnabled, whatsappNumber, razorpayEnabled, razorpayKeyId, razorpayKeySecret } = req.body;
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    const updateData = { codEnabled, whatsappEnabled, whatsappNumber, razorpayEnabled, razorpayKeyId };

    // Only update the secret if it's part of the request body
    if (req.body.hasOwnProperty('razorpayKeySecret')) {
      if (razorpayKeySecret) {
        updateData.razorpayKeySecret = encrypt(razorpayKeySecret);
      } else {
        updateData.razorpayKeySecret = null; // Clear if empty string is provided
      }
    }

    const settings = await CheckoutSettings.findOneAndUpdate({ storeId }, updateData, { new: true, upsert: true });

    const responseSettings = settings.toObject();
    if (responseSettings.razorpayKeySecret) {
      responseSettings.razorpayKeySecret = decrypt(responseSettings.razorpayKeySecret);
    }
    res.json(responseSettings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};