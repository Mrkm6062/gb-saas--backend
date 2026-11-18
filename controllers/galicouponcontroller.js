import GaliCoupon from "../models/galicoupon.js";
import Store from "../models/Store.js";
import User from "../models/User.js";

/**
 * 1. GET ALL PLATFORM COUPONS (Superadmin)
 */
export const getCoupons = async (req, res) => {
  try {
    const { search, status, discountType } = req.query;
    const query = {};

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [{ code: regex }, { description: regex }];
    }

    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;
    if (discountType) query.discountType = discountType.toUpperCase();

    const coupons = await GaliCoupon.find(query)
      .populate("usedBy.user", "name email userId")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: coupons.length, coupons });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to fetch coupons" });
  }
};

/**
 * 2. GET SINGLE COUPON BY ID (Superadmin)
 */
export const getCouponById = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await GaliCoupon.findById(id).populate("usedBy.user", "name email userId");
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json(coupon);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to fetch coupon" });
  }
};

/**
 * 3. CREATE NEW PLATFORM COUPON (Superadmin)
 */
export const createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      validFrom,
      expiresAt,
      usageLimit,
      perUserLimit,
      firstOrderOnly,
      applicableCategories,
      applicableProducts,
      applicablePincodes,
      isActive,
    } = req.body;

    if (!code || !discountType || discountValue === undefined || !expiresAt) {
      return res.status(400).json({ message: "Code, discountType, discountValue, and expiresAt are required." });
    }

    const normalizedCode = code.trim().toUpperCase();

    const existing = await GaliCoupon.findOne({ code: normalizedCode });
    if (existing) {
      return res.status(400).json({ message: `Coupon with code "${normalizedCode}" already exists.` });
    }

    const coupon = await GaliCoupon.create({
      code: normalizedCode,
      description: description || "",
      discountType: discountType.toUpperCase(),
      discountValue: Number(discountValue),
      maxDiscountAmount: maxDiscountAmount !== undefined && maxDiscountAmount !== "" && maxDiscountAmount !== null ? Number(maxDiscountAmount) : null,
      minOrderAmount: minOrderAmount ? Number(minOrderAmount) : 0,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      expiresAt: new Date(expiresAt),
      usageLimit: usageLimit !== undefined && usageLimit !== "" && usageLimit !== null ? Number(usageLimit) : null,
      perUserLimit: perUserLimit ? Number(perUserLimit) : 1,
      firstOrderOnly: Boolean(firstOrderOnly),
      applicableCategories: Array.isArray(applicableCategories) ? applicableCategories : [],
      applicableProducts: Array.isArray(applicableProducts) ? applicableProducts : [],
      applicablePincodes: Array.isArray(applicablePincodes) ? applicablePincodes : [],
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    res.status(201).json({ success: true, message: `Coupon "${coupon.code}" created successfully!`, coupon });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create coupon" });
  }
};

/**
 * 4. UPDATE EXISTING PLATFORM COUPON (Superadmin)
 */
export const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await GaliCoupon.findById(id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });

    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
      validFrom,
      expiresAt,
      usageLimit,
      perUserLimit,
      firstOrderOnly,
      applicableCategories,
      applicableProducts,
      applicablePincodes,
      isActive,
    } = req.body;

    if (code) {
      const normalizedCode = code.trim().toUpperCase();
      if (normalizedCode !== coupon.code) {
        const existing = await GaliCoupon.findOne({ code: normalizedCode, _id: { $ne: id } });
        if (existing) {
          return res.status(400).json({ message: `Another coupon with code "${normalizedCode}" already exists.` });
        }
        coupon.code = normalizedCode;
      }
    }

    if (description !== undefined) coupon.description = description;
    if (discountType !== undefined) coupon.discountType = discountType.toUpperCase();
    if (discountValue !== undefined) coupon.discountValue = Number(discountValue);
    if (maxDiscountAmount !== undefined) {
      coupon.maxDiscountAmount = maxDiscountAmount !== "" && maxDiscountAmount !== null ? Number(maxDiscountAmount) : null;
    }
    if (minOrderAmount !== undefined) coupon.minOrderAmount = Number(minOrderAmount) || 0;
    if (validFrom !== undefined) coupon.validFrom = new Date(validFrom);
    if (expiresAt !== undefined) coupon.expiresAt = new Date(expiresAt);
    if (usageLimit !== undefined) {
      coupon.usageLimit = usageLimit !== "" && usageLimit !== null ? Number(usageLimit) : null;
    }
    if (perUserLimit !== undefined) coupon.perUserLimit = Number(perUserLimit) || 1;
    if (firstOrderOnly !== undefined) coupon.firstOrderOnly = Boolean(firstOrderOnly);
    if (applicableCategories !== undefined) coupon.applicableCategories = applicableCategories;
    if (applicableProducts !== undefined) coupon.applicableProducts = applicableProducts;
    if (applicablePincodes !== undefined) coupon.applicablePincodes = applicablePincodes;
    if (isActive !== undefined) coupon.isActive = Boolean(isActive);

    await coupon.save();

    res.json({ success: true, message: `Coupon "${coupon.code}" updated successfully!`, coupon });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update coupon" });
  }
};

/**
 * 5. DELETE PLATFORM COUPON (Superadmin)
 */
export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await GaliCoupon.findByIdAndDelete(id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });

    res.json({ success: true, message: `Coupon "${coupon.code}" deleted successfully!` });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to delete coupon" });
  }
};

/**
 * 6. TOGGLE COUPON ACTIVE STATUS (Superadmin)
 */
export const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await GaliCoupon.findById(id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({
      success: true,
      message: `Coupon "${coupon.code}" is now ${coupon.isActive ? "Active" : "Inactive"}.`,
      isActive: coupon.isActive,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to toggle status" });
  }
};

/**
 * 7. VALIDATE & CALCULATE DISCOUNT (Store Creation / Subscription Checkout)
 * Public / User authenticated endpoint
 */
export const validateCoupon = async (req, res) => {
  try {
    const { code, amount, planId, billingDuration } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ message: "Please provide a coupon code." });
    }

    const orderAmount = Number(amount) || 0;
    const normalizedCode = code.trim().toUpperCase();

    const coupon = await GaliCoupon.findOne({ code: normalizedCode });

    if (!coupon) {
      return res.status(404).json({ message: `Coupon code "${normalizedCode}" does not exist.` });
    }

    if (!coupon.isActive) {
      return res.status(400).json({ message: `Coupon "${normalizedCode}" is currently inactive.` });
    }

    const now = new Date();

    // Check validity window
    if (coupon.validFrom && now < new Date(coupon.validFrom)) {
      return res.status(400).json({
        message: `Coupon "${normalizedCode}" is not valid yet. It starts on ${new Date(coupon.validFrom).toLocaleDateString()}.`
      });
    }

    if (coupon.expiresAt && now > new Date(coupon.expiresAt)) {
      return res.status(400).json({
        message: `Coupon "${normalizedCode}" expired on ${new Date(coupon.expiresAt).toLocaleDateString()}.`
      });
    }

    // Check global usage limit
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        message: `Coupon "${normalizedCode}" has reached its maximum usage limit.`
      });
    }

    // Check minimum order amount
    if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
      return res.status(400).json({
        message: `Minimum order amount of ₹${coupon.minOrderAmount} is required to apply this coupon.`
      });
    }

    // Check per-user usage limit if user context exists
    if (req.user) {
      const userIdent = String(req.user._id || req.user.userId);
      const userUsage = coupon.usedBy?.find(u => String(u.user) === userIdent || String(u.user) === String(req.user.userId));
      const userCount = userUsage ? userUsage.usageCount : 0;
      const allowedPerUser = coupon.perUserLimit || 1;

      if (userCount >= allowedPerUser) {
        return res.status(400).json({
          message: `You have already used coupon "${normalizedCode}" the maximum number of times (${allowedPerUser} time${allowedPerUser > 1 ? "s" : ""}).`
        });
      }

      // Check first order only rule
      if (coupon.firstOrderOnly) {
        const existingStoresCount = await Store.countDocuments({
          ownerId: { $in: [req.user.userId, req.user._id] },
          isDeleted: { $ne: true }
        });
        if (existingStoresCount > 0) {
          return res.status(400).json({
            message: `Coupon "${normalizedCode}" is only valid for first-time store creations.`
          });
        }
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.discountType === "PERCENTAGE") {
      discountAmount = Math.round((orderAmount * coupon.discountValue) / 100);
      if (coupon.maxDiscountAmount !== null && coupon.maxDiscountAmount !== undefined && coupon.maxDiscountAmount > 0) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      }
    } else {
      // FIXED discount
      discountAmount = Math.min(orderAmount, coupon.discountValue);
    }

    const finalAmount = Math.max(0, orderAmount - discountAmount);

    res.json({
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      finalAmount,
      description: coupon.description,
      message: `Coupon "${coupon.code}" applied! You save ₹${discountAmount}.`
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to validate coupon" });
  }
};

/**
 * 8. HELPER: RECORD COUPON USAGE UPON SUCCESSFUL ORDER / STORE CREATION
 */
export const recordCouponUsage = async (code, userId) => {
  if (!code) return;
  try {
    const coupon = await GaliCoupon.findOne({ code: code.trim().toUpperCase() });
    if (!coupon) return;

    coupon.usedCount = (coupon.usedCount || 0) + 1;

    if (userId) {
      let userDoc = null;
      if (typeof userId === "string" && !userId.match(/^[0-9a-fA-F]{24}$/)) {
        userDoc = await User.findOne({ userId });
      }

      const mongoUserId = userDoc ? userDoc._id : userId;

      const existingUsage = coupon.usedBy?.find(u => String(u.user) === String(mongoUserId));
      if (existingUsage) {
        existingUsage.usageCount = (existingUsage.usageCount || 1) + 1;
      } else {
        if (!Array.isArray(coupon.usedBy)) coupon.usedBy = [];
        coupon.usedBy.push({ user: mongoUserId, usageCount: 1 });
      }
    }

    await coupon.save();
    console.log(`[GaliCoupon] Recorded redemption for code "${coupon.code}", total redemptions: ${coupon.usedCount}`);
  } catch (err) {
    console.error("[GaliCoupon] Error recording coupon redemption:", err.message);
  }
};
