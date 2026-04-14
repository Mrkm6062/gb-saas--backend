import Store from "../models/Store.js";

const storeMiddleware = async (req, res, next) => {
  try {
    const host = req.headers.host; // mystore.galibrand.cloud
    const subdomain = host.split(".")[0];

    // Ignore main domains
    if (
      subdomain === "www" ||
      subdomain === "galibrand" ||
      subdomain === "dashboard"
    ) {
      return next();
    }

    const store = await Store.findOne({ subdomain });

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