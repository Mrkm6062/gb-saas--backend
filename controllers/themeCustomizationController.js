import ThemeCustomization from "../models/ThemeCustomization.js";
import Store from "../models/Store.js";

// ============================================================================
// ADMIN DASHBOARD ENDPOINTS (Authenticated)
// ============================================================================

// 1. GET CUSTOMIZATION FOR A SPECIFIC STORE & THEME
export const getThemeCustomization = async (req, res) => {
  try {
    const { storeId, themeId } = req.query;

    if (!storeId || !themeId) {
      return res.status(400).json({ message: "storeId and themeId are required parameters." });
    }

    // Verify ownership
    const storeQuery = { _id: storeId };
    if (req.user && req.user.role !== "superadmin") {
      storeQuery.ownerId = req.user.userId;
    }

    const store = await Store.findOne(storeQuery);
    if (!store) {
      return res.status(403).json({ message: "Not authorized to access this store." });
    }

    const customization = await ThemeCustomization.findOne({ storeId, themeId });
    
    // Return existing customization, or an empty object if none exists yet
    res.json(customization || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. UPDATE OR CREATE (UPSERT) CUSTOMIZATION
export const updateThemeCustomization = async (req, res) => {
  try {
    const { storeId, themeId, global, header, banner, category, productCard, footer } = req.body;

    if (!storeId || !themeId) {
      return res.status(400).json({ message: "storeId and themeId are required in the body." });
    }

    // Verify ownership
    const storeQuery = { _id: storeId };
    if (req.user && req.user.role !== "superadmin") {
      storeQuery.ownerId = req.user.userId;
    }

    const store = await Store.findOne(storeQuery);
    if (!store) {
      return res.status(403).json({ message: "Not authorized to modify this store." });
    }

    // Prepare only provided fields for update to prevent overwriting missing sections with null
    const updateData = {};
    if (global) updateData.global = global;
    if (header) updateData.header = header;
    if (banner) updateData.banner = banner;
    if (category) updateData.category = category;
    if (productCard) updateData.productCard = productCard;
    if (footer) updateData.footer = footer;

    // Use findOneAndUpdate with upsert: true to create it if it doesn't exist
    const updatedCustomization = await ThemeCustomization.findOneAndUpdate(
      { storeId, themeId },
      { $set: updateData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ message: "Theme customization saved successfully!", customization: updatedCustomization });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============================================================================
// STOREFRONT ENDPOINT (PUBLIC)
// ============================================================================

// 3. GET ACTIVE THEME CUSTOMIZATION FOR THE PUBLIC STOREFRONT
export const getPublicThemeCustomization = async (req, res) => {
  try {
    if (!req.store) {
      return res.status(404).json({ message: "Store context missing." });
    }

    const storeId = req.store._id;
    // Prioritize query parameter for live previews, otherwise fallback to the active store theme
    const themeId = req.query.themeId || req.store.theme; 

    const customization = await ThemeCustomization.findOne({ storeId, themeId });
    
    res.json(customization || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};