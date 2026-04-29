import Store from "../models/Store.js";
import Counter from "../models/Counter.js";
import Plan from "../models/Plan.js";

// CREATE NEW STORE
export const createStore = async (req, res) => {
  try {
    const { name, category, storeType, metaDescription, planId } = req.body;

    // Prevent undefined.toLowerCase() crash
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: "A valid store name is required" });
    }

    // Generate unique subdomain based on name (e.g., "My Store" -> "mystore")
    const storeSlug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const storeExists = await Store.findOne({ storeSlug });

    if (storeExists) {
      return res.status(400).json({ message: "Store name is already taken. Try another." });
    }

    // Safely generate Store Code using an atomic counter to prevent race conditions
    const counter = await Counter.findOneAndUpdate(
      { _id: 'storeId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const storeId = `GBS${String(counter.seq).padStart(3, '0')}`;

    // Calculate Plan Expiry Date (e.g., 30 days from creation)
    const planStartDate = new Date();
    const planExpiryDate = new Date();
    planExpiryDate.setDate(planExpiryDate.getDate() + 30);

    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Unauthorized. User context is missing." });
    }

    const store = await Store.create({
      storeName: name,
      storeSlug,
      subdomain: `${storeSlug}.galibrand.cloud`,
      storeId,
      ownerId: req.user.userId, // Attached securely by the 'protect' middleware
      category,
      metaDescription,
      status: 'active',
      planId: planId || null,
      planStartDate,
      planExpiryDate,
      isTrialActive: true
    });

    res.status(201).json({ message: "Store created successfully!", store });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE STORE DETAILS (Logo, Favicon, Title, etc.)
export const updateStore = async (req, res) => {
  try {
    const { id } = req.params; // Can be MongoDB _id or custom storeId (e.g., GBS001)
    const { storeName, websiteTitle, logo, favicon, banner, category, storeType } = req.body;

    // Ensure the store belongs to the authenticated user
    const query = { ownerId: req.user.userId };
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query._id = id;
    } else {
      query.storeId = id;
    }

    const store = await Store.findOne(query);

    if (!store) {
      return res.status(404).json({ message: "Store not found or unauthorized" });
    }

    // Update fields if they are provided in the request payload
    if (storeName !== undefined) store.storeName = storeName;
    if (websiteTitle !== undefined) store.websiteTitle = websiteTitle;
    if (logo !== undefined) store.logo = logo;
    if (favicon !== undefined) store.favicon = favicon;
    if (banner !== undefined) store.banner = banner;
    if (category !== undefined) store.category = category;
    if (storeType !== undefined) store.storeType = storeType;

    await store.save();

    res.json({ message: "Store updated successfully!", store });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPGRADE STORE PLAN (User protected)
export const upgradeStorePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { planId } = req.body;

    // Ensure the store belongs to the authenticated user
    const store = await Store.findOne({ _id: id, ownerId: req.user.userId });
    if (!store) {
      return res.status(404).json({ message: "Store not found or unauthorized" });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Selected plan not found" });
    }

    // Apply the new plan
    store.planId = planId;
    store.subscriptionStatus = 'active';
    store.isTrialActive = false;
    store.planStartDate = new Date();
    store.planExpiryDate = new Date(new Date().setDate(new Date().getDate() + 30)); // Adds 30 days

    await store.save();
    res.json({ message: "Plan upgraded successfully!", store });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET CURRENT STORE
export const getMyStore = async (req, res) => {
  try {
    // Find all stores owned by the user
    const stores = await Store.find({ ownerId: req.user.userId });
    
    // Always return a 200 OK with the stores array, even if empty
    res.json({ stores });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET STORE BY SUBDOMAIN (PUBLIC)
export const getStoreBySubdomain = async (req, res) => {
  try {
    const { subdomain } = req.params;

    const store = await Store.findOne({ storeSlug: subdomain });

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    res.json(store);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};