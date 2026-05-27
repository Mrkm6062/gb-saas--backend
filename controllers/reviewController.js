import Review from "../models/review.js";
import Store from "../models/Store.js";

// ==========================================
// PUBLIC STOREFRONT ENDPOINTS
// ==========================================

// CREATE A REVIEW
export const createReview = async (req, res) => {
  try {
    const { productId, orderId, customerName, customerEmail, rating, review, reviewImages } = req.body;
    
    if (!req.store) return res.status(400).json({ message: "Store context missing" });
    const storeId = req.store._id;

    // Check for existing review
    if (orderId && productId) {
      const existing = await Review.findOne({ orderId, productId });
      if (existing) return res.status(400).json({ message: "You have already reviewed this product." });
    }

    const newReview = await Review.create({
      storeId,
      productId,
      orderId,
      customerName,
      customerEmail,
      rating,
      review,
      reviewImages
    });

    res.status(201).json({ message: "Review submitted successfully. It will be visible once approved.", review: newReview });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET APPROVED REVIEWS FOR A PRODUCT
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!req.store) return res.status(400).json({ message: "Store context missing" });

    const reviews = await Review.find({ 
      storeId: req.store._id, 
      productId, 
      isApproved: true 
    }).sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CHECK IF A REVIEW EXISTS (PUBLIC)
export const checkReviewStatus = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const review = await Review.findOne({ orderId, productId });
    res.json({ hasReviewed: !!review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// ADMIN DASHBOARD ENDPOINTS
// ==========================================

// GET ALL REVIEWS FOR A STORE
export const getStoreReviews = async (req, res) => {
  try {
    const { storeId } = req.query;
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    const reviews = await Review.find({ storeId }).populate("productId", "name images").sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// APPROVE / REJECT REVIEW
export const updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    const store = await Store.findOne({ _id: review.storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    review.isApproved = isApproved;
    await review.save();

    res.json({ message: "Review status updated", review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE REVIEW
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    const store = await Store.findOne({ _id: review.storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    await review.deleteOne();
    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};