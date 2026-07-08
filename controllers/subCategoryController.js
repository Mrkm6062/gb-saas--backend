import SubCategory from "../models/SubCategory.js";
import Store from "../models/Store.js";

// GET ALL SUB-CATEGORIES FOR A STORE or CATEGORY (Admin)
export const getSubCategories = async (req, res) => {
  try {
    const { storeId, categoryId } = req.query;
    if (!storeId) return res.status(400).json({ message: "Store ID is required" });

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    const filter = { store: storeId };
    if (categoryId) filter.category = categoryId;

    const subCategories = await SubCategory.find(filter).populate("category", "name").sort({ order: 1, createdAt: -1 });
    res.json(subCategories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE NEW SUB-CATEGORY
export const createSubCategory = async (req, res) => {
  try {
    const { storeId, categoryId, name, description, status, order } = req.body;
    if (!storeId || !categoryId || !name) {
      return res.status(400).json({ message: "Store ID, Category ID, and Sub-Category Name are required" });
    }

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const existing = await SubCategory.findOne({ store: storeId, slug });
    if (existing) return res.status(400).json({ message: "Sub-Category already exists in this store" });

    const subCategory = await SubCategory.create({
      store: storeId,
      category: categoryId,
      name,
      slug,
      description: description || "",
      status: status || "active",
      order: order !== undefined ? Number(order) : 0
    });

    res.status(201).json(subCategory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE SUB-CATEGORY
export const updateSubCategory = async (req, res) => {
  try {
    const { name, categoryId, description, status, order } = req.body;

    const subCategory = await SubCategory.findById(req.params.id);
    if (!subCategory) return res.status(404).json({ message: "Sub-Category not found" });

    const store = await Store.findOne({ _id: subCategory.store, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    if (name) {
      subCategory.name = name;
      subCategory.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    if (categoryId) subCategory.category = categoryId;
    if (description !== undefined) subCategory.description = description;
    if (status !== undefined) subCategory.status = status;
    if (order !== undefined) subCategory.order = Number(order);

    await subCategory.save();
    res.json(subCategory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE SUB-CATEGORY
export const deleteSubCategory = async (req, res) => {
  try {
    const subCategory = await SubCategory.findById(req.params.id);
    if (!subCategory) return res.status(404).json({ message: "Sub-Category not found" });

    const store = await Store.findOne({ _id: subCategory.store, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    await subCategory.deleteOne();
    res.json({ message: "Sub-Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET PUBLIC SUB-CATEGORIES (Storefront)
export const getPublicSubCategories = async (req, res) => {
  try {
    if (!req.store || !req.store._id) return res.status(404).json({ message: "Store context missing" });
    const { categoryId } = req.query;
    
    const filter = { store: req.store._id, status: "active" };
    if (categoryId) filter.category = categoryId;

    const subCategories = await SubCategory.find(filter).sort({ order: 1, createdAt: -1 });
    res.json(subCategories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
