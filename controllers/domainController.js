import Domain from "../models/Domain.js";
import Store from "../models/Store.js";
import crypto from "crypto";
import dns from "dns";

// Helper: Format and sanitize domain
const sanitizeDomain = (domain) => {
  let sanitized = domain.toLowerCase().trim();
  sanitized = sanitized.replace(/^https?:\/\//, ''); // Remove protocol
  sanitized = sanitized.split('/')[0]; // Remove paths
  return sanitized;
};

// Helper: Basic Regex Validation
const isValidDomain = (domain) => {
  const regex = /^([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}?$/;
  return regex.test(domain);
};

// 1. ADD NEW DOMAIN
export const addDomain = async (req, res) => {
  try {
    const { storeId, domainName } = req.body;
    
    if (!storeId || !domainName) {
      return res.status(400).json({ message: "Store ID and domain name are required." });
    }

    let sanitizedDomain = sanitizeDomain(domainName);
    
    // Note: Encourage users to use www. if they submit a naked domain, 
    // but save exactly what they requested.
    if (!isValidDomain(sanitizedDomain)) {
      return res.status(400).json({ message: "Invalid domain format." });
    }

    // Verify ownership of the store
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId }).populate('planId');
    if (!store) {
      return res.status(403).json({ message: "Not authorized to manage domains for this store." });
    }

    // Enforce Plan Limits
    if (!store.planId || !store.planId.features?.customDomain) {
      return res.status(403).json({ message: "Your current plan does not support custom domains. Please upgrade." });
    }

    // Check if domain is already claimed by anyone on the platform
    const existingDomain = await Domain.findOne({ domain: sanitizedDomain });
    if (existingDomain) {
      return res.status(400).json({ message: "This domain is already registered on our platform." });
    }

    // Generate unique verification token
    const verificationToken = crypto.randomBytes(16).toString("hex");

    const targetCname = store.subdomain; // Dynamically use the store's Galibrand subdomain

    const newDomain = await Domain.create({
      userId: req.user._id,
      storeId: store._id,
      domain: sanitizedDomain,
      status: "pending",
      verificationToken,
      sslStatus: "pending"
    });

    res.status(201).json({
      message: "Domain added successfully.",
      domain: newDomain,
      dnsInstructions: {
        type: "CNAME",
        name: sanitizedDomain.startsWith("www.") ? "www" : "@",
        value: targetCname
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. VERIFY DOMAIN (DNS CHECK)
export const verifyDomain = async (req, res) => {
  try {
    const domainRecord = await Domain.findById(req.params.id);
    if (!domainRecord) {
      return res.status(404).json({ message: "Domain not found." });
    }

    if (domainRecord.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized to verify this domain." });
    }

    // Fetch the associated store to get the expected CNAME target
    const store = await Store.findById(domainRecord.storeId);
    if (!store) {
      return res.status(404).json({ message: "Associated store not found." });
    }
    const targetCname = store.subdomain; // e.g., "myshop.galibrand.cloud"

    try {
      // Execute DNS query to check CNAME records
      const records = await dns.promises.resolveCname(domainRecord.domain);
      
      if (records.includes(targetCname) || records.includes(targetCname + '.')) {
        domainRecord.status = "connected";
        await domainRecord.save();
        return res.json({ message: "Domain verified and connected successfully!", domain: domainRecord });
      } else {
        return res.status(400).json({ 
          message: `Domain CNAME does not point to our servers yet. Expected target: ${targetCname}. DNS changes can take up to 24 hours.`, 
          foundRecords: records 
        });
      }
    } catch (dnsError) {
      return res.status(400).json({ 
        message: `Failed to resolve CNAME record. Ensure you added a CNAME pointing to ${targetCname}.`,
        code: dnsError.code
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. GET ALL DOMAINS FOR USER
export const getDomains = async (req, res) => {
  try {
    const domains = await Domain.find({ userId: req.user._id }).populate("storeId", "storeName storeSlug");
    res.json(domains);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. DELETE DOMAIN
export const deleteDomain = async (req, res) => {
  try {
    const domainRecord = await Domain.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!domainRecord) return res.status(404).json({ message: "Domain not found or unauthorized." });
    res.json({ message: "Domain removed successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};