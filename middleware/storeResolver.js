import Store from "../models/Store.js";

// Resolves the store from the database using the subdomain
export const storeResolver = async (req, res, next) => {
  try {
    // If request is from root domain or an unknown subdomain
    if (!req.subdomain) {
      return res.status(404).json({ message: "Store not found" });
    }

    // Fetch store and populate the plan details
    const store = await Store.findOne({ storeSlug: req.subdomain }).populate('planId');
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    // Automatically expire the subscription if the end date has passed
    if (store.subscriptionStatus !== 'expired' && store.planExpiryDate && new Date() > store.planExpiryDate) {
      store.subscriptionStatus = 'expired';
      store.isTrialActive = false;
      await store.save();
    }

    req.plan = store.planId; // Make plan details available to frontend API responses
    req.store = store;
    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error during store resolution" });
  }
};