import SocialMedia from "../models/SocialMedia.js";
import Store from "../models/Store.js";

// GET ALL SOCIAL MEDIA LINKS FOR A STORE (Admin)
export const getSocialMedia = async (req, res) => {
  try {
    const { storeId } = req.query;
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    const links = await SocialMedia.find({ storeId });
    res.json(links);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ADD NEW SOCIAL MEDIA LINK
export const createSocialMedia = async (req, res) => {
  try {
    const { storeId, platform, url } = req.body;
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    const link = await SocialMedia.create({ storeId, platform, url });
    res.status(201).json(link);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE SOCIAL MEDIA LINK
export const deleteSocialMedia = async (req, res) => {
  try {
    const link = await SocialMedia.findById(req.params.id);
    if (!link) return res.status(404).json({ message: "Not found" });

    await link.deleteOne();
    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET PUBLIC SOCIAL MEDIA LINKS (Storefront)
export const getPublicSocialMedia = async (req, res) => {
  try {
    if (!req.store || !req.store._id) return res.status(404).json({ message: "Store context missing" });
    const links = await SocialMedia.find({ storeId: req.store._id });
    res.json(links);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};