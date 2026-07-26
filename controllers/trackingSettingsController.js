import TrackingSettings from "../models/TrackingSettings.js";
import Store from "../models/Store.js";

// @desc    Get tracking settings for a store (Dashboard)
// @route   GET /api/tracking-settings/:storeId
// @access  Private
export const getTrackingSettings = async (req, res) => {
  try {
    const { storeId } = req.params;

    // Verify store ownership
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Not authorized to access tracking settings for this store" });
    }

    let settings = await TrackingSettings.findOne({ storeId });
    if (!settings) {
      settings = await TrackingSettings.create({ storeId });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update tracking settings for a store (Dashboard)
// @route   PUT /api/tracking-settings/:storeId
// @access  Private
export const updateTrackingSettings = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { googleAnalytics, googleTagManager, googleSearchConsole, facebookPixel } = req.body;

    // Verify store ownership
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Not authorized to modify tracking settings for this store" });
    }

    let settings = await TrackingSettings.findOne({ storeId });
    if (!settings) {
      settings = new TrackingSettings({ storeId });
    }

    if (googleAnalytics) {
      settings.googleAnalytics = {
        ...settings.googleAnalytics,
        ...googleAnalytics,
      };
    }

    if (googleTagManager) {
      settings.googleTagManager = {
        ...settings.googleTagManager,
        ...googleTagManager,
      };
    }

    if (googleSearchConsole) {
      settings.googleSearchConsole = {
        ...settings.googleSearchConsole,
        ...googleSearchConsole,
        verifiedAt: googleSearchConsole.enabled && !settings.googleSearchConsole.enabled ? new Date() : settings.googleSearchConsole.verifiedAt
      };
    }

    if (facebookPixel) {
      settings.facebookPixel = {
        ...settings.facebookPixel,
        ...facebookPixel,
      };
    }

    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get public tracking settings for storefront (Public)
// @route   GET /api/tracking-settings/public
// @access  Public
export const getPublicTrackingSettings = async (req, res) => {
  try {
    if (!req.store) {
      return res.status(404).json({ message: "Store context not found" });
    }

    const settings = await TrackingSettings.findOne({ storeId: req.store._id });
    if (!settings) {
      return res.json({
        googleAnalytics: { enabled: false, measurementId: "" },
        googleTagManager: { enabled: false, containerId: "" },
        googleSearchConsole: { enabled: false, verificationCode: "" },
        facebookPixel: { enabled: false, pixelId: "" }
      });
    }

    // Return only active tracking codes for security
    res.json({
      googleAnalytics: {
        enabled: settings.googleAnalytics.enabled,
        measurementId: settings.googleAnalytics.enabled ? settings.googleAnalytics.measurementId : ""
      },
      googleTagManager: {
        enabled: settings.googleTagManager.enabled,
        containerId: settings.googleTagManager.enabled ? settings.googleTagManager.containerId : ""
      },
      googleSearchConsole: {
        enabled: settings.googleSearchConsole.enabled,
        verificationCode: settings.googleSearchConsole.enabled ? settings.googleSearchConsole.verificationCode : ""
      },
      facebookPixel: {
        enabled: settings.facebookPixel.enabled,
        pixelId: settings.facebookPixel.enabled ? settings.facebookPixel.pixelId : ""
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
