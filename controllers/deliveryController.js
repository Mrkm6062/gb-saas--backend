import DeliverySettings from "../models/DeliverySettings.js";
import Store from "../models/Store.js";

export const getPublicDeliverySettings = async (req, res) => {
  try {
    // Extract store context from headers or middleware
    let storeId = req.headers['x-store-id'] || (req.store && req.store._id);
    if (storeId === "undefined" || storeId === "null") storeId = null;

    if (!storeId) {
      return res.status(400).json({ message: "Store context missing" });
    }

    const settings = await DeliverySettings.findOne({ storeId });
    res.json(settings || {
      deliveryMode: "all",
      allowedStates: [],
      allowedPincodes: [],
      baseCharge: 0,
      freeShippingThreshold: 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDeliverySettings = async (req, res) => {
  try {
    const { storeId } = req.query;

    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Not authorized to access delivery settings for this store." });
    }

    let settings = await DeliverySettings.findOne({ storeId });
    if (!settings) {
      settings = await DeliverySettings.create({ storeId });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateDeliverySettings = async (req, res) => {
  try {
    const { storeId, deliveryMode, allowedStates, allowedPincodes, baseCharge, freeShippingThreshold } = req.body;

    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Not authorized to update delivery settings for this store." });
    }

    const settings = await DeliverySettings.findOneAndUpdate(
      { storeId },
      { deliveryMode, allowedStates, allowedPincodes, baseCharge, freeShippingThreshold },
      { new: true, upsert: true }
    );

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};