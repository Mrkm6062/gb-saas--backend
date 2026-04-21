import Product from "../models/Product.js";
import Store from "../models/Store.js";

// CREATE PRODUCT
export const createProduct = async (req, res) => {
  try {
    const { name, price, stock, storeId } = req.body;

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Not authorized to add products to this store" });
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

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Not authorized to view these products" });
    }

    const products = await Product.find({ storeId });

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE PRODUCT
export const updateProduct = async (req, res) => {
  try {
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