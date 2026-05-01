import Category from "../models/Category.js";
import Store from "../models/Store.js";

// GET ALL CATEGORIES FOR A STORE (Admin)
export const getCategories = async (req, res) => {
  try {
    const { storeId } = req.query;
    if (!storeId) return res.status(400).json({ message: "Store ID is required" });

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    const categories = await Category.find({ store: storeId }).sort({ order: 1, createdAt: -1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE NEW CATEGORY
export const createCategory = async (req, res) => {
  try {
    const { storeId, name, description, image, status } = req.body;
    if (!storeId || !name) return res.status(400).json({ message: "Store ID and Category Name are required" });

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    // Generate a URL-friendly slug
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const existingCategory = await Category.findOne({ store: storeId, slug });
    if (existingCategory) return res.status(400).json({ message: "Category already exists in this store" });

    const category = await Category.create({
      name, slug, description, store: storeId, createdBy: req.user._id, image: { url: image || "" }, status: status || "active"
    });

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE CATEGORY
export const updateCategory = async (req, res) => {
  try {
    const { name, description, image, status } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    const store = await Store.findOne({ _id: category.store, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    if (name) {
      category.name = name;
      category.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    if (description !== undefined) category.description = description;
    if (image !== undefined) category.image = { url: image };
    if (status !== undefined) category.status = status;

    await category.save();
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// REORDER CATEGORIES
export const reorderCategories = async (req, res) => {
  try {
    const { storeId, orderedIds } = req.body;
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: { filter: { _id: id, store: storeId }, update: { order: index } }
    }));

    await Category.bulkWrite(bulkOps);
    res.json({ message: "Categories reordered successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE CATEGORY
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    const store = await Store.findOne({ _id: category.store, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    await category.deleteOne();
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET PUBLIC CATEGORIES (Storefront)
export const getPublicCategories = async (req, res) => {
  try {
    if (!req.store || !req.store._id) return res.status(404).json({ message: "Store context missing" });
    const categories = await Category.find({ store: req.store._id, status: "active" }).sort({ order: 1, createdAt: -1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};