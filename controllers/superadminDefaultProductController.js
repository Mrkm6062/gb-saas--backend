import DefaultProduct from "../models/DefaultProduct.js";

// GET ALL DEFAULT PRODUCTS (Paginated)
export const getAllDefaultProducts = async (req, res) => {
  try {
    const { storeType, page = 1, limit = 50 } = req.query;
    const query = {};
    
    if (storeType) query.storeTypes = storeType;

    const skip = (Number(page) - 1) * Number(limit);
    const products = await DefaultProduct.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
    const total = await DefaultProduct.countDocuments(query);

    res.json({
      data: products,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE DEFAULT PRODUCT
export const createDefaultProduct = async (req, res) => {
  try {
    const payload = { ...req.body };
    
    // Auto-generate a unique slug to prevent MongoDB duplicate key errors
    if (payload.name) {
      payload.slug = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
    }

    const product = await DefaultProduct.create(payload);
    res.status(201).json({ message: "Default product created successfully", product });
  } catch (error) {
    console.error("Default Product Create Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// UPDATE DEFAULT PRODUCT
export const updateDefaultProduct = async (req, res) => {
  try {
    const payload = { ...req.body };
    
    // Ensure a slug exists during updates to prevent unique index constraints from failing
    if (!payload.slug && payload.name) {
      payload.slug = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
    }

    const product = await DefaultProduct.findByIdAndUpdate(req.params.id, payload, { new: true });
    
    if (!product) return res.status(404).json({ message: "Default product not found" });
    
    res.json({ message: "Default product updated successfully", product });
  } catch (error) {
    console.error("Default Product Update Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// DELETE DEFAULT PRODUCT
export const deleteDefaultProduct = async (req, res) => {
  try {
    const product = await DefaultProduct.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Default product not found" });
    res.json({ message: "Default product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};