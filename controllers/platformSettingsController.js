import PlatformSettings from "../models/PlatformSettings.js";

// GET PLATFORM SETTINGS (Public & Admin)
export const getPlatformSettings = async (req, res) => {
  try {
    let settings = await PlatformSettings.findOne({ key: "global" });
    if (!settings) {
      // If no settings exist, create and return the default one
      const defaultSettings = await PlatformSettings.create({ key: "global" });
      return res.json(defaultSettings);
    }

    // Auto-populate default email templates if missing on existing settings
    let modified = false;
    const defaultInstance = new PlatformSettings({ key: "temp" });
    if (!settings.subscriptionReminderTemplate) {
      settings.subscriptionReminderTemplate = defaultInstance.subscriptionReminderTemplate;
      modified = true;
    }
    if (!settings.subscriptionExpiredTemplate) {
      settings.subscriptionExpiredTemplate = defaultInstance.subscriptionExpiredTemplate;
      modified = true;
    }
    if (modified) {
      await settings.save();
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE PLATFORM SETTINGS (Superadmin)
export const updatePlatformSettings = async (req, res) => {
  try {
    const {
      mainLogoUrl,
      miniLogoUrl,
      loginImageGrid,
      companyAddress,
      companyPhone,
      gstNumber,
      isGstEnabled,
      cinNumber,
      isCinEnabled,
      subscriptionInvoiceTemplate,
      subscriptionReminderTemplate,
      subscriptionExpiredTemplate
    } = req.body;

    const updateData = {
      mainLogoUrl,
      miniLogoUrl,
      loginImageGrid,
      companyAddress,
      companyPhone,
      gstNumber,
      isGstEnabled,
      cinNumber,
      isCinEnabled,
      subscriptionInvoiceTemplate,
      subscriptionReminderTemplate,
      subscriptionExpiredTemplate
    };

    // Remove undefined fields so we don't accidentally overwrite existing data with nulls
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const settings = await PlatformSettings.findOneAndUpdate(
      { key: "global" },
      { $set: updateData },
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
