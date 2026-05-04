import Coupon from "../models/Coupon.js";
import Store from "../models/Store.js";

// ============================================================================
// ADMIN DASHBOARD ENDPOINTS
// ============================================================================

// 1. CREATE COUPON
export const createCoupon = async (req, res) => {
  try {
    const { storeId, code, description, discountType, discountValue, minOrderAmount, maxDiscountAmount, startDate, endDate, usageLimit, isActive } = req.body;

    // Ensure store exists and is owned by the requester
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized to create coupons for this store" });

    // Check for duplicate codes within this specific store
    const existingCoupon = await Coupon.findOne({ storeId, code: code.toUpperCase() });
    if (existingCoupon) return res.status(400).json({ message: "This coupon code already exists for your store" });

    const coupon = await Coupon.create({
      storeId,
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      startDate,
      endDate,
      usageLimit,
      isActive
    });

    res.status(201).json(coupon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. GET ALL COUPONS FOR A STORE
export const getCoupons = async (req, res) => {
  try {
    const { storeId } = req.query;

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    const coupons = await Coupon.find({ storeId }).sort({ createdAt: -1 });
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. UPDATE COUPON
export const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const coupon = await Coupon.findById(id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });

    const store = await Store.findOne({ _id: coupon.storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    // If they are trying to change the code, make sure it doesn't conflict with another coupon
    if (updates.code) {
      updates.code = updates.code.toUpperCase();
      const duplicate = await Coupon.findOne({ storeId: store._id, code: updates.code, _id: { $ne: id } });
      if (duplicate) return res.status(400).json({ message: "This coupon code is already in use" });
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(id, updates, { new: true });
    res.json(updatedCoupon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. DELETE COUPON
export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    
    const coupon = await Coupon.findById(id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });

    const store = await Store.findOne({ _id: coupon.storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    await coupon.deleteOne();
    res.json({ message: "Coupon deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============================================================================
// STOREFRONT ENDPOINT (PUBLIC)
// ============================================================================

// 5. VALIDATE & APPLY COUPON
export const validateCoupon = async (req, res) => {
  try {
    const { code, cartTotal } = req.body;

    // Look for the explicitly passed store ID header from the React frontend
    let storeId = req.headers['x-store-id'] || (req.store && req.store._id);

    // Prevent stringified "undefined" or "null" from bypassing the truthy check
    if (storeId === "undefined" || storeId === "null") {
      storeId = null;
    }

    if (!storeId) return res.status(400).json({ message: "Store context missing" });
    if (!code) return res.status(400).json({ message: "Please enter a coupon code" });
    if (cartTotal === undefined) return res.status(400).json({ message: "Cart total is required to validate the coupon" });

    const trimmedCode = code.trim().toUpperCase();
    const coupon = await Coupon.findOne({ storeId, code: trimmedCode });
    
    if (!coupon) return res.status(404).json({ message: "Invalid coupon code" });
    if (!coupon.isActive) return res.status(400).json({ message: "This coupon is no longer active" });

    const now = new Date();
    if (now < coupon.startDate) return res.status(400).json({ message: "This coupon is not valid yet" });
    if (now > coupon.endDate) return res.status(400).json({ message: "This coupon has expired" });

    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({ message: "This coupon has reached its usage limit" });
    }

    if (cartTotal < coupon.minOrderAmount) {
      return res.status(400).json({ message: `A minimum order of ₹${coupon.minOrderAmount} is required for this coupon` });
    }

    // Calculate the actual discount amount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (cartTotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else if (coupon.discountType === 'fixed') {
      discountAmount = coupon.discountValue;
    }

    // Ensure a fixed/percentage discount doesn't exceed the total cart value
    if (coupon.discountType !== 'free_shipping' && discountAmount > cartTotal) {
      discountAmount = cartTotal;
    }

    // Return details back to the frontend to adjust the cart display
    res.json({ message: "Coupon applied successfully!", coupon, calculatedDiscount: Number(discountAmount.toFixed(2)) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};