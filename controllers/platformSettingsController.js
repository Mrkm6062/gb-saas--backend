import PlatformSettings from "../models/PlatformSettings.js";

// GET PLATFORM SETTINGS (Public & Admin)
export const getPlatformSettings = async (req, res) => {
  try {
    const settings = await PlatformSettings.findOne({ key: "global" });
    if (!settings) {
      // If no settings exist, create and return the default one
      const defaultSettings = await PlatformSettings.create({ key: "global" });
      return res.json(defaultSettings);
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE PLATFORM SETTINGS (Superadmin)
export const updatePlatformSettings = async (req, res) => {
  try {
    const settings = await PlatformSettings.findOneAndUpdate(
      { key: "global" },
      { ...req.body },
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};