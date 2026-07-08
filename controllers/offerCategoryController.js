import OfferCategory from "../models/OfferCategory.js";
import Store from "../models/Store.js";

// GET ALL OFFER CATEGORIES FOR A STORE (Admin)
export const getOfferCategories = async (req, res) => {
  try {
    const { storeId } = req.query;
    if (!storeId) return res.status(400).json({ message: "Store ID is required" });

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    const offerCategories = await OfferCategory.find({ store: storeId }).sort({ priority: -1, createdAt: -1 });
    res.json(offerCategories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE NEW OFFER CATEGORY
export const createOfferCategory = async (req, res) => {
  try {
    const {
      storeId, name, description, banner, icon, color, priority,
      homepageSection, active, startDate, endDate, offerType, discountPercentage
    } = req.body;

    if (!storeId || !name) {
      return res.status(400).json({ message: "Store ID and Category Name are required" });
    }

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    // Generate slug
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const existing = await OfferCategory.findOne({ store: storeId, slug });
    if (existing) return res.status(400).json({ message: "Offer Category already exists in this store" });

    const offerCategory = await OfferCategory.create({
      store: storeId,
      name,
      slug,
      description,
      banner: banner || "",
      icon: icon || "",
      color: color || "#76b900",
      priority: priority !== undefined ? Number(priority) : 0,
      homepageSection: homepageSection !== undefined ? homepageSection : false,
      active: active !== undefined ? active : true,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      offerType: offerType || "NONE",
      discountPercentage: discountPercentage !== undefined ? Number(discountPercentage) : 0
    });

    res.status(201).json(offerCategory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE OFFER CATEGORY
export const updateOfferCategory = async (req, res) => {
  try {
    const {
      name, description, banner, icon, color, priority,
      homepageSection, active, startDate, endDate, offerType, discountPercentage
    } = req.body;

    const offerCategory = await OfferCategory.findById(req.params.id);
    if (!offerCategory) return res.status(404).json({ message: "Offer Category not found" });

    const store = await Store.findOne({ _id: offerCategory.store, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    if (name) {
      offerCategory.name = name;
      offerCategory.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    if (description !== undefined) offerCategory.description = description;
    if (banner !== undefined) offerCategory.banner = banner;
    if (icon !== undefined) offerCategory.icon = icon;
    if (color !== undefined) offerCategory.color = color;
    if (priority !== undefined) offerCategory.priority = Number(priority);
    if (homepageSection !== undefined) offerCategory.homepageSection = homepageSection;
    if (active !== undefined) offerCategory.active = active;
    if (startDate !== undefined) offerCategory.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) offerCategory.endDate = endDate ? new Date(endDate) : null;
    if (offerType !== undefined) offerCategory.offerType = offerType;
    if (discountPercentage !== undefined) offerCategory.discountPercentage = Number(discountPercentage);

    await offerCategory.save();
    res.json(offerCategory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE OFFER CATEGORY
export const deleteOfferCategory = async (req, res) => {
  try {
    const offerCategory = await OfferCategory.findById(req.params.id);
    if (!offerCategory) return res.status(404).json({ message: "Offer Category not found" });

    const store = await Store.findOne({ _id: offerCategory.store, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    await offerCategory.deleteOne();
    res.json({ message: "Offer Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET PUBLIC OFFER CATEGORIES (Storefront)
export const getPublicOfferCategories = async (req, res) => {
  try {
    if (!req.store || !req.store._id) return res.status(404).json({ message: "Store context missing" });
    const offerCategories = await OfferCategory.find({ store: req.store._id, active: true }).sort({ priority: -1, createdAt: -1 });
    res.json(offerCategories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
