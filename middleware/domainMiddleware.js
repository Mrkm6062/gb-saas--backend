import Domain from "../models/Domain.js";
import Store from "../models/Store.js";

export const domainMiddleware = async (req, res, next) => {
  try {
    let host = req.headers.host || "";
    
    // Respect origin header for API requests from storefront
    if (req.headers.origin) {
      try {
        const originUrl = new URL(req.headers.origin);
        host = originUrl.host;
      } catch (e) {}
    }

    const hostname = host.split(":")[0];

    // Skip routing if it's an internal system domain or localhost
    const systemDomains = ["galibrand.cloud", "localhost", "nip.io"];
    const isSystemDomain = systemDomains.some(d => hostname.endsWith(d));

    if (isSystemDomain) {
      return next(); 
    }

    // Lookup connected custom domain
    const domainRecord = await Domain.findOne({ domain: hostname, status: "connected" });

    if (domainRecord) {
      const store = await Store.findById(domainRecord.storeId).populate('planId');
      if (store && store.status !== "suspended") {
        req.store = store;
        req.plan = store.planId;
        req.subdomain = store.storeSlug; // Backwards compatibility for subsequent middlewares
      }
    }
    next();
  } catch (error) {
    next();
  }
};