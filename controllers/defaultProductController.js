import DefaultProduct from "../models/DefaultProduct.js";
import Product from "../models/Product.js";
import Store from "../models/Store.js";
import Category from "../models/Category.js";

// GET DEFAULT PRODUCTS (Paginated)
export const getDefaultProducts = async (req, res) => {
  try {
    const { storeType, page = 1, limit = 50 } = req.query;
    
    const query = { isActive: true };
    if (storeType) {
      query.storeTypes = storeType;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const defaultProducts = await DefaultProduct.find(query).skip(skip).limit(Number(limit)).lean();
    const total = await DefaultProduct.countDocuments(query);

    res.json({
      data: defaultProducts,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// IMPORT DEFAULT PRODUCTS INTO STORE
export const importDefaultProducts = async (req, res) => {
  try {
    const { storeId, storeType, importOnlyMissing = true, productIds } = req.body;

    if (!storeId || !storeType) return res.status(400).json({ message: "storeId and storeType are required." });

    // Ensure store belongs to the authenticated user
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized to import products to this store." });

    // Fetch active default products for the specified type
    let query = { storeTypes: storeType, isActive: true };
    if (Array.isArray(productIds) && productIds.length > 0) {
      query._id = { $in: productIds };
    }

    const defaultProducts = await DefaultProduct.find(query).lean();
    if (!defaultProducts.length) return res.status(404).json({ message: "No default products available for this store type or selection." });

    // Fetch already imported default product IDs to prevent duplication
    let existingIds = [];
    if (importOnlyMissing) {
      const existingProducts = await Product.find({ storeId, source: "default", defaultProductId: { $in: defaultProducts.map(dp => dp._id) } }).select("defaultProductId").lean();
      existingIds = existingProducts.map(p => p.defaultProductId.toString());
    }

    // Filter out already imported products
    const productsToProcess = defaultProducts.filter(dp => !(importOnlyMissing && existingIds.includes(dp._id.toString())));

    if (!productsToProcess.length) return res.json({ message: "All available default products have already been imported.", count: 0 });

    const categoryCache = {};
    const productsToInsert = [];

    for (const dp of productsToProcess) {
      let categoryId = null;

      // Map string category to an actual Category ObjectId for this store
      if (dp.category) {
        const categoryName = dp.category.trim();
        const cacheKey = categoryName.toLowerCase();

        if (categoryCache[cacheKey]) {
          categoryId = categoryCache[cacheKey];
        } else {
          // Find if the category already exists in the user's store
          let storeCategory = await Category.findOne({ store: storeId, name: { $regex: new RegExp(`^${categoryName}$`, 'i') } });
          
          // If it doesn't exist, automatically create it
          if (!storeCategory) {
            const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            storeCategory = await Category.create({ store: storeId, name: categoryName, slug, status: 'active' });
          }
          
          categoryId = storeCategory._id;
          categoryCache[cacheKey] = categoryId; // Cache it to save DB calls for the next products in the loop
        }
      }

      const { _id, createdAt, updatedAt, storeTypes, category, ...productData } = dp;
      
      productsToInsert.push({ ...productData, category: categoryId, storeId, source: "default", defaultProductId: _id });
    }

    const inserted = await Product.insertMany(productsToInsert);
    res.status(201).json({ message: "Default products imported successfully.", count: inserted.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};