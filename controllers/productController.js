import Product from "../models/Product.js";
import Store from "../models/Store.js";
import Review from "../models/Review.js";

// CREATE PRODUCT
export const createProduct = async (req, res) => {
  try {
    const { 
      name, storeId, description, category, subCategory, 
      images, variants, basePrice, unitType, tags, totalStock, isActive, seo,
      price, stock // Legacy fallbacks
    } = req.body;

    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Unauthorized: User context is missing." });
    }

    const storeQuery = { _id: storeId };
    if (req.user.role !== 'superadmin') storeQuery.ownerId = req.user.userId;
    const store = await Store.findOne(storeQuery).populate('planId');
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

    // 3. Generate a unique SEO slug
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    // 4. Calculate total stock (sum of variants, or fallback to provided totals)
    let calculatedTotalStock = totalStock !== undefined ? totalStock : (stock || 0);
    if (variants && variants.length > 0) {
      calculatedTotalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    }

    // 5. Determine base price
    const calculatedBasePrice = basePrice !== undefined ? basePrice : (price || (variants && variants.length > 0 ? variants[0].price : 0));

    const product = await Product.create({
      storeId,
      name,
      slug,
      description,
      category,
      subCategory,
      images: images || [],
      variants: variants || [],
      basePrice: calculatedBasePrice,
      price: calculatedBasePrice,
      unitType,
      tags: tags || [],
      totalStock: calculatedTotalStock,
      stock: calculatedTotalStock,
      isActive: isActive !== undefined ? isActive : true,
      seo
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

    const storeQuery = { _id: storeId };
    if (req.user.role !== 'superadmin') storeQuery.ownerId = req.user.userId;
    const store = await Store.findOne(storeQuery);
    if (!store) {
      return res.status(403).json({ message: "Not authorized to view these products" });
    }

    // Fetch products as plain JavaScript objects (.lean()) so we can mutate them easily
    const products = await Product.find({ storeId }).lean();

    // Aggregate approved reviews to calculate average ratings and totals
    const reviewsAggr = await Review.aggregate([
      { $match: { storeId: store._id, isApproved: true } },
      { $group: { _id: "$productId", averageRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } }
    ]);

    // Create a fast lookup map mapping productId to its review stats
    const reviewMap = {};
    reviewsAggr.forEach(r => { reviewMap[r._id.toString()] = r; });

    // Attach review stats to each product
    const productsWithReviews = products.map(p => ({ ...p, averageRating: reviewMap[p._id.toString()]?.averageRating || 0, totalReviews: reviewMap[p._id.toString()]?.totalReviews || 0 }));

    res.json(productsWithReviews);
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

    const storeQuery = { _id: product.storeId };
    if (req.user.role !== 'superadmin') storeQuery.ownerId = req.user.userId;
    const store = await Store.findOne(storeQuery);
    if (!store) {
      return res.status(403).json({ message: "Not authorized to update this product" });
    }

    const { 
      name, description, category, subCategory, images, variants, 
      basePrice, unitType, tags, totalStock, isActive, seo,
      price, stock // Legacy fallbacks
    } = req.body;

    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (category !== undefined) product.category = category;
    if (subCategory !== undefined) product.subCategory = subCategory;
    if (images !== undefined) product.images = images;
    if (unitType !== undefined) product.unitType = unitType;
    if (tags !== undefined) product.tags = tags;
    if (isActive !== undefined) product.isActive = isActive;
    if (seo !== undefined) product.seo = seo;

    if (variants !== undefined) {
      product.variants = variants;
      if (variants.length > 0) {
        product.totalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
        product.stock = product.totalStock;
        if (basePrice === undefined && price === undefined) {
          product.basePrice = variants[0].price;
          product.price = variants[0].price;
        }
      } else if (totalStock !== undefined || stock !== undefined) {
        product.totalStock = totalStock !== undefined ? totalStock : stock;
        product.stock = product.totalStock;
      }
    } else if (totalStock !== undefined || stock !== undefined) {
      product.totalStock = totalStock !== undefined ? totalStock : stock;
      product.stock = product.totalStock;
    }
    
    if (basePrice !== undefined || price !== undefined) {
      product.basePrice = basePrice !== undefined ? basePrice : price;
      product.price = product.basePrice;
    }

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

    const storeQuery = { _id: product.storeId };
    if (req.user.role !== 'superadmin') storeQuery.ownerId = req.user.userId;
    const store = await Store.findOne(storeQuery);
    if (!store) {
      return res.status(403).json({ message: "Not authorized to delete this product" });
    }

    await product.deleteOne();

    res.json({ message: "Product removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};