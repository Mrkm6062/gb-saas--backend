import Domain from "../models/Domain.js";
import Store from "../models/Store.js";

// Resolves the store from the database using the custom domain or subdomain
export const storeResolver = async (req, res, next) => {
  try {
    let host = req.headers.host || "";
    
    // Respect origin header for API requests from storefront
    if (req.headers.origin) {
      try {
        const originUrl = new URL(req.headers.origin);
        host = originUrl.host;
      } catch (e) {}
    }

    let hostname = host.split(":")[0].toLowerCase();
    
    // Normalize: remove "www." prefix
    const normalizedHost = hostname.startsWith("www.") ? hostname.slice(4) : hostname;

    let store = null;

    // FIRST -> Check custom domain
    const domainRecord = await Domain.findOne({ domain: normalizedHost, status: "connected" });
    if (domainRecord) {
      store = await Store.findOne({ _id: domainRecord.storeId, isDeleted: { $ne: true } }).populate('planId');
    }

    // SECOND -> Fallback to subdomain (if no custom domain match)
    if (!store && (hostname.endsWith(".galibrand.cloud") || hostname.endsWith(".localhost") || hostname.endsWith(".nip.io"))) {
      const subdomain = hostname.split(".")[0];
      const ignored = ["www", "api", "dashboard", "cname", "store"];
      
      if (!ignored.includes(subdomain)) {
        store = await Store.findOne({ storeSlug: subdomain, isDeleted: { $ne: true } }).populate('planId');
      }
    }

    // THIRD -> Attach store if found, else just continue safely
    if (store) {
      if (store.status === 'suspended') {
        return res.status(403).json({ message: "This store has been temporarily suspended." });
      }

      // Automatically expire the subscription if the end date has passed
      if (store.subscriptionStatus !== 'pending' && store.planExpiryDate && new Date() > store.planExpiryDate) {
        store.subscriptionStatus = 'pending';
        store.isTrialActive = false;
        await store.save();
      }

      req.plan = store.planId; // Make plan details available to frontend API responses
      req.store = store;
    }

    next();
  } catch (error) {
    console.error("Store resolver error:", error);
    next(); // Always continue so static frontend can still load
  }
};