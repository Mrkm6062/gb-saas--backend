import Store from "../models/Store.js";

const storeMiddleware = async (req, res, next) => {
  try {
    // 1. Safely handle missing host header
    const host = req.headers.host || ""; 
    
    // 2. Allow frontend dashboard to explicitly define which store to target
    const customStoreCode = req.headers['x-store-code'];
    if (customStoreCode) {
      const store = await Store.findOne({ storeId: customStoreCode.toUpperCase() });
      if (store) {
        req.store = store;
        return next();
      }
    }

    const subdomain = host.split(".")[0];

    // Ignore main domains
    if (
      subdomain === "www" ||
      subdomain === "galibrand" ||
      subdomain === "dashboard" ||
      subdomain === "localhost" ||
      subdomain === "127"
    ) {
      return next();
    }

    const store = await Store.findOne({ storeSlug: subdomain });

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    req.store = store; // attach store to request
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Store middleware error" });
  }
};

export default storeMiddleware;