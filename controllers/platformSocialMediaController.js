import PlatformSocialMedia from "../models/PlatformSocialMedia.js";

// GET ALL PLATFORM SOCIAL LINKS
export const getPlatformSocialMedia = async (req, res) => {
  try {
    const links = await PlatformSocialMedia.find();
    res.json(links);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE NEW PLATFORM SOCIAL LINK
export const createPlatformSocialMedia = async (req, res) => {
  try {
    const { platform, url } = req.body;
    const link = await PlatformSocialMedia.create({ platform, url });
    res.status(201).json(link);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE PLATFORM SOCIAL LINK
export const deletePlatformSocialMedia = async (req, res) => {
  try {
    await PlatformSocialMedia.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};