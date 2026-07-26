import express from "express";
import { createStore, getMyStore, getStoreBySubdomain, updateStore, upgradeStorePlan, getStoreData, restoreStore, deleteStore, verifyEmployee } from "../controllers/storeController.js";
import { protect } from "../middleware/authMiddleware.js";
import { subdomainMiddleware } from "../middleware/subdomain.js";
import { storeResolver } from "../middleware/storeResolver.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";

const router = express.Router();

// --- PUBLIC ROUTES ---
// This is the main endpoint for the storefront to get its data via domain/subdomain.
router.get("/data", storeResolver, getStoreData);
router.get("/public", storeResolver, getStoreData);

// --- USER-AUTHENTICATED ROUTES (for the admin dashboard) ---
router.post("/", protect, createStore);
router.post("/verify-employee", protect, verifyEmployee);
router.get("/me", protect, getMyStore);

// --- TENANT-SPECIFIC PUBLIC ROUTES (for storefront widgets/pages) ---
router.get("/tenant/info", subdomainMiddleware, storeResolver, (req, res) => {
  if (!req.store) return res.status(404).json({ message: "Store not found" });
  const { _id, storeName, logo, banner, theme, favicon, websiteTitle, metaDescription, subdomain, supportPhoneNumbers, whatsappNumber, whatsappSupportEnabled, supportEmail, locationAddress, mapLocation } = req.store;
  res.json({ _id, name: storeName, logo, banner, theme, favicon, websiteTitle, metaDescription, subdomain, supportPhoneNumbers, whatsappNumber, whatsappSupportEnabled, supportEmail, locationAddress, mapLocation });
});

router.get("/tenant/products", subdomainMiddleware, storeResolver, async (req, res) => {
  try {
    if (!req.store) return res.status(404).json({ message: "Store not found" });
    
    // Only return active products for the public storefront, using .lean() for fast performance
    const products = await Product.find({ storeId: req.store._id, isActive: true })
      .populate({ path: 'category', model: 'Category', select: 'name' })
      .populate({ path: 'subCategories', model: 'SubCategory' })
      .populate({ path: 'offerCategories', model: 'OfferCategory' })
      .lean();
    
    // Aggregate approved reviews to calculate average ratings and totals
    const reviewsAggr = await Review.aggregate([
      { $match: { storeId: req.store._id, isApproved: true } },
      { $group: { _id: "$productId", averageRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } }
    ]);

    // Create a fast lookup map
    const reviewMap = {};
    reviewsAggr.forEach(r => { reviewMap[r._id.toString()] = r; });

    // Attach review stats to each product
    const productsWithReviews = products.map(p => ({ 
      ...p, 
      categoryName: p.category && p.category.name ? p.category.name : '',
      category: p.category && p.category._id ? p.category._id : p.category, // Restore ID to prevent breaking frontend
      averageRating: reviewMap[p._id.toString()]?.averageRating || 0, 
      totalReviews: reviewMap[p._id.toString()]?.totalReviews || 0 
    }));

    res.json(productsWithReviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- DYNAMIC ID-BASED ROUTES (must be after specific string routes) ---
router.put("/:id", protect, updateStore);
router.delete("/:id", protect, deleteStore); // Added soft delete route
router.put("/:id/restore", protect, restoreStore);
router.put("/:id/plan", protect, upgradeStorePlan);

// This MUST be last to avoid hijacking other routes like /me, /data, /tenant, etc.
router.get("/:subdomain", getStoreBySubdomain);

export default router;
