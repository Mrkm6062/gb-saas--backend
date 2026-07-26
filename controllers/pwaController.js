import Pwa from "../models/Pwa.js";
import Store from "../models/Store.js";

// @desc    Get PWA settings for a store (Dashboard)
// @route   GET /api/pwa/:storeId
// @access  Private
export const getPwaSettings = async (req, res) => {
  try {
    const { storeId } = req.params;

    // Verify store ownership
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Not authorized to access PWA settings for this store" });
    }

    let settings = await Pwa.findOne({ storeId });
    if (!settings) {
      settings = await Pwa.create({ storeId });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update PWA settings for a store (Dashboard)
// @route   PUT /api/pwa/:storeId
// @access  Private
export const updatePwaSettings = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { enabled, appName, shortName, themeColor, backgroundColor, icon192, icon512 } = req.body;

    // Verify store ownership
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Not authorized to modify PWA settings for this store" });
    }

    let settings = await Pwa.findOne({ storeId });
    if (!settings) {
      settings = new Pwa({ storeId });
    }

    settings.enabled = enabled;
    settings.appName = appName;
    settings.shortName = shortName;
    settings.themeColor = themeColor;
    settings.backgroundColor = backgroundColor;
    settings.icon192 = icon192;
    settings.icon512 = icon512;

    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get public PWA settings for storefront (Public)
// @route   GET /api/pwa/public
// @access  Public
export const getPublicPwaSettings = async (req, res) => {
  try {
    if (!req.store) {
      return res.status(404).json({ message: "Store context not found" });
    }

    const settings = await Pwa.findOne({ storeId: req.store._id });
    if (!settings || !settings.enabled) {
      return res.json({ enabled: false });
    }

    res.json({
      enabled: true,
      appName: settings.appName,
      shortName: settings.shortName,
      themeColor: settings.themeColor,
      backgroundColor: settings.backgroundColor,
      icon192: settings.icon192,
      icon512: settings.icon512
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
