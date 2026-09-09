import DeliverySettings from "../models/DeliverySettings.js";
import DeliveryArea from "../models/DeliveryArea.js";
import Store from "../models/Store.js";
import StateDistrictMap from "../models/StateDistrictMap.js";
import Pincode from "../models/Pincode.js";

// GET PUBLIC DELIVERY SETTINGS & ENABLED AREAS FOR FRONTEND STORE
export const getPublicDeliverySettings = async (req, res) => {
  try {
    let storeId = req.headers['x-store-id'] || (req.store && req.store._id);
    if (storeId === "undefined" || storeId === "null") storeId = null;

    if (!storeId) {
      return res.status(400).json({ message: "Store context missing" });
    }

    const settings = await DeliverySettings.findOne({ storeId }).lean();
    const areas = await DeliveryArea.find({ storeId, enabled: true }).sort({ name: 1 }).lean();

    res.json({
      ...(settings || {
        deliveryMode: "all",
        allowedStates: [],
        allowedPincodes: [],
        baseCharge: 0,
        freeShippingThreshold: 0,
        deliveryLocations: []
      }),
      areas: areas || []
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUBLIC CALCULATE DELIVERY AVAILABILITY AND CHARGE
export const calculatePublicDelivery = async (req, res) => {
  try {
    let storeId = req.headers['x-store-id'] || req.body.storeId;
    if (storeId === "undefined" || storeId === "null") storeId = null;

    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const { state, district, pincode, postOffice, locality, subtotal = 0 } = req.body;

    const settings = await DeliverySettings.findOne({ storeId });
    const areas = await DeliveryArea.find({ storeId, enabled: true });

    const deliveryMode = settings?.deliveryMode || "all";
    const baseCharge = settings?.baseCharge || 0;
    const freeShippingThreshold = settings?.freeShippingThreshold || 0;
    const allowedStates = (settings?.allowedStates || []).map(s => s.toLowerCase().trim());
    const allowedPincodes = (settings?.allowedPincodes || []).map(p => p.trim());
    const deliveryLocations = settings?.deliveryLocations || [];

    let available = false;
    let matchedCharge = baseCharge;
    let matchedLocationName = "";

    const cleanState = (state || "").toLowerCase().trim();
    const cleanDistrict = (district || "").toLowerCase().trim();
    const cleanPincode = (pincode || "").trim();
    const cleanPostOffice = (postOffice || "").toLowerCase().trim();
    const cleanLocality = (locality || "").toLowerCase().trim();

    // Find specific location charge if available
    let foundArea = null;
    if (cleanLocality) {
      foundArea = areas.find(a => a.name?.toLowerCase().trim() === cleanLocality) ||
                  deliveryLocations.find(l => l.enabled && l.name?.toLowerCase().trim() === cleanLocality);
    }
    if (!foundArea && cleanPostOffice) {
      foundArea = areas.find(a => a.postOffice?.toLowerCase().trim() === cleanPostOffice || a.name?.toLowerCase().trim() === cleanPostOffice) ||
                  deliveryLocations.find(l => l.enabled && l.name?.toLowerCase().trim() === cleanPostOffice);
    }
    if (!foundArea && cleanPincode) {
      foundArea = areas.find(a => a.pincode === cleanPincode) ||
                  deliveryLocations.find(l => l.enabled && l.pincode === cleanPincode);
    }
    if (!foundArea && cleanDistrict) {
      foundArea = areas.find(a => a.type === "district" && (a.district?.toLowerCase().trim() === cleanDistrict || a.name?.toLowerCase().trim() === cleanDistrict)) ||
                  deliveryLocations.find(l => l.type === "district" && l.enabled && l.name?.toLowerCase().trim() === cleanDistrict);
    }
    if (!foundArea && cleanState) {
      foundArea = areas.find(a => a.type === "state" && (a.state?.toLowerCase().trim() === cleanState || a.name?.toLowerCase().trim() === cleanState)) ||
                  deliveryLocations.find(l => l.type === "state" && l.enabled && l.name?.toLowerCase().trim() === cleanState);
    }

    // Check deliveryMode availability
    if (deliveryMode === "all") {
      available = true;
    } else if (deliveryMode === "state") {
      if (cleanState && (allowedStates.includes(cleanState) || foundArea || areas.some(a => a.type === "state" && (a.state?.toLowerCase().trim() === cleanState || a.name?.toLowerCase().trim() === cleanState)))) {
        available = true;
      }
    } else if (deliveryMode === "district") {
      if (cleanDistrict && (foundArea || areas.some(a => a.type === "district" && (a.district?.toLowerCase().trim() === cleanDistrict || a.name?.toLowerCase().trim() === cleanDistrict)))) {
        available = true;
      }
    } else if (deliveryMode === "pincode") {
      if (cleanPincode && (allowedPincodes.includes(cleanPincode) || foundArea || areas.some(a => a.pincode === cleanPincode))) {
        available = true;
      }
    } else if (deliveryMode === "postOffice") {
      if (cleanPostOffice && (foundArea || areas.some(a => a.type === "postOffice" && (a.postOffice?.toLowerCase().trim() === cleanPostOffice || a.name?.toLowerCase().trim() === cleanPostOffice)))) {
        available = true;
      }
    } else if (deliveryMode === "locality") {
      if (cleanLocality && (foundArea || areas.some(a => ["village", "building", "chawl"].includes(a.type) && a.name?.toLowerCase().trim() === cleanLocality))) {
        available = true;
      }
    }

    // If specific DeliveryAreas exist for store, ensure location matches if pincode is specified
    if (areas.length > 0 && cleanPincode) {
      const pinAreas = areas.filter(a => a.pincode === cleanPincode);
      if (pinAreas.length > 0) {
        if (cleanLocality && !pinAreas.some(a => a.name?.toLowerCase().trim() === cleanLocality)) {
          available = false;
        }
      }
    }

    if (foundArea) {
      matchedCharge = foundArea.charge !== undefined ? Number(foundArea.charge) : baseCharge;
      matchedLocationName = foundArea.name || "";
    }

    // Free shipping threshold check
    let isFreeShipping = false;
    if (freeShippingThreshold > 0 && subtotal >= freeShippingThreshold) {
      matchedCharge = 0;
      isFreeShipping = true;
    }

    res.json({
      available,
      deliveryMode,
      charge: available ? matchedCharge : 0,
      isFreeShipping,
      baseCharge,
      matchedLocationName,
      message: available 
        ? (isFreeShipping ? "Free shipping applied!" : `Delivery available (₹${matchedCharge})`) 
        : "Pincode is not deliverable"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getStatesAndDistricts = async (req, res) => {
  try {
    const map = await StateDistrictMap.find().sort({ stateName: 1 });
    res.json(map);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getOfficesByDistrict = async (req, res) => {
  try {
    const { state, district } = req.query;
    const offices = await Pincode.find({ stateName: state, districtName: district }).sort({ officeName: 1 });
    res.json(offices);
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

    const storeQuery = { _id: storeId };
    if (req.user.role !== 'superadmin') storeQuery.ownerId = req.user.userId;
    const store = await Store.findOne(storeQuery);
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
    const { storeId, deliveryMode, allowedStates, allowedPincodes, baseCharge, freeShippingThreshold, deliveryLocations } = req.body;

    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const storeQuery = { _id: storeId };
    if (req.user.role !== 'superadmin') storeQuery.ownerId = req.user.userId;
    const store = await Store.findOne(storeQuery);
    if (!store) {
      return res.status(403).json({ message: "Not authorized to update delivery settings for this store." });
    }

    const settings = await DeliverySettings.findOneAndUpdate(
      { storeId },
      { deliveryMode, allowedStates, allowedPincodes, baseCharge, freeShippingThreshold, deliveryLocations },
      { new: true, upsert: true }
    );

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDetailsByPincode = async (req, res) => {
  try {
    const { pincode } = req.params;
    if (!pincode || isNaN(pincode)) {
      return res.status(400).json({ message: "Invalid pincode" });
    }

    const records = await Pincode.find({ pincode: Number(pincode) });
    if (records && records.length > 0) {
      const record = records[0];
      const offices = records.map(r => r.officeName);
      res.json({ city: record.districtName, state: record.stateName, offices });
    } else {
      res.status(404).json({ message: "Pincode not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELIVERY AREA CRUD CONTROLLERS
export const getDeliveryAreas = async (req, res) => {
  try {
    const { storeId, type } = req.query;
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const query = { storeId };
    if (type) query.type = type;

    const areas = await DeliveryArea.find(query).sort({ name: 1 });
    res.json(areas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createDeliveryArea = async (req, res) => {
  try {
    const { storeId, type, name, state, district, postOffice, pincode, charge, enabled } = req.body;
    if (!storeId || !type || !name) {
      return res.status(400).json({ message: "storeId, type, and name are required" });
    }

    const storeQuery = { _id: storeId };
    if (req.user.role !== 'superadmin') storeQuery.ownerId = req.user.userId;
    const store = await Store.findOne(storeQuery);
    if (!store) {
      return res.status(403).json({ message: "Not authorized to manage delivery areas for this store." });
    }

    const area = await DeliveryArea.create({
      storeId,
      type,
      name,
      state: state || null,
      district: district || null,
      postOffice: postOffice || null,
      pincode: pincode || null,
      charge: charge !== undefined ? charge : 0,
      enabled: enabled !== undefined ? enabled : true
    });

    res.status(201).json(area);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateDeliveryArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, state, district, postOffice, pincode, charge, enabled } = req.body;

    const area = await DeliveryArea.findById(id);
    if (!area) {
      return res.status(404).json({ message: "Delivery area not found" });
    }

    const storeQuery = { _id: area.storeId };
    if (req.user.role !== 'superadmin') storeQuery.ownerId = req.user.userId;
    const store = await Store.findOne(storeQuery);
    if (!store) {
      return res.status(403).json({ message: "Not authorized to manage delivery areas for this store." });
    }

    if (name !== undefined) area.name = name;
    if (type !== undefined) area.type = type;
    if (state !== undefined) area.state = state;
    if (district !== undefined) area.district = district;
    if (postOffice !== undefined) area.postOffice = postOffice;
    if (pincode !== undefined) area.pincode = pincode;
    if (charge !== undefined) area.charge = charge;
    if (enabled !== undefined) area.enabled = enabled;

    await area.save();
    res.json(area);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteDeliveryArea = async (req, res) => {
  try {
    const { id } = req.params;
    const area = await DeliveryArea.findById(id);
    if (!area) {
      return res.status(404).json({ message: "Delivery area not found" });
    }

    const storeQuery = { _id: area.storeId };
    if (req.user.role !== 'superadmin') storeQuery.ownerId = req.user.userId;
    const store = await Store.findOne(storeQuery);
    if (!store) {
      return res.status(403).json({ message: "Not authorized to manage delivery areas for this store." });
    }

    await DeliveryArea.findByIdAndDelete(id);
    res.json({ message: "Delivery area deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};