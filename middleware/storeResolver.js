import Store from "../models/Store.js";

// Resolves the store from the database using the subdomain
export const storeResolver = async (req, res, next) => {
  try {
    // If request is from root domain or an unknown subdomain
    if (!req.subdomain) {
      return res.status(404).json({ message: "Store not found" });
    }

    const store = await Store.findOne({ storeSlug: req.subdomain });
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    req.store = store;
    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error during store resolution" });
  }
};