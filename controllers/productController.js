import Product from "../models/Product.js";

// CREATE PRODUCT
export const createProduct = async (req, res) => {
  try {
    const { name, price, stock } = req.body;

    const product = await Product.create({
      store: req.store._id,
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
    const products = await Product.find({ store: req.store._id });

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE PRODUCT
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      store: req.store._id,
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    product.name = req.body.name || product.name;
    product.price = req.body.price || product.price;
    product.stock = req.body.stock || product.stock;

    const updated = await product.save();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE PRODUCT
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      store: req.store._id,
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await product.deleteOne();

    res.json({ message: "Product removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};