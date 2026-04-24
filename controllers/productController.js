import Product from "../models/Product.js";
import Store from "../models/Store.js";

// CREATE PRODUCT
export const createProduct = async (req, res) => {
  try {
    const { name, price, stock, storeId } = req.body;

    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Unauthorized: User context is missing." });
    }

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId }).populate('planId');
    if (!store) {
      return res.status(403).json({ message: "Not authorized to add products to this store" });
    }

    // 1. Subscription Check
    if (store.subscriptionStatus === 'expired') {
      return res.status(403).json({ message: "Subscription expired. Please upgrade your plan to add products." });
    }

    // 2. Plan Limit Feature Enforcement
    if (store.planId) {
      const productCount = await Product.countDocuments({ storeId });
      if (productCount >= store.planId.features.maxProducts) {
        return res.status(403).json({ message: `Plan limit reached. Maximum ${store.planId.features.maxProducts} products allowed.` });
      }
    }

    const product = await Product.create({
      storeId,
      name,
      price,
      stock,
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ALL PRODUCTS (STORE BASED)
export const getProducts = async (req, res) => {
  try {
    const { storeId } = req.query;

    if (!storeId) {
      return res.status(400).json({ message: "storeId query parameter is required." });
    }

    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Unauthorized: User context is missing." });
    }

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Not authorized to view these products" });
    }

    const products = await Product.find({ storeId });

    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: error.message });
  }
};

// UPDATE PRODUCT
export const updateProduct = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Unauthorized: User context is missing." });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const store = await Store.findOne({ _id: product.storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Not authorized to update this product" });
    }

    product.name = req.body.name || product.name;
    product.price = req.body.price || product.price;
    product.stock = req.body.stock !== undefined ? req.body.stock : product.stock;

    const updated = await product.save();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE PRODUCT
export const deleteProduct = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Unauthorized: User context is missing." });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const store = await Store.findOne({ _id: product.storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Not authorized to delete this product" });
    }

    await product.deleteOne();

    res.json({ message: "Product removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};