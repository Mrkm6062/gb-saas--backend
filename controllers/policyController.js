import Policy from "../models/Policy.js";
import Store from "../models/Store.js";

// GET ALL POLICIES FOR A STORE
export const getPolicies = async (req, res) => {
  try {
    const { storeId } = req.query;
    
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    const policies = await Policy.find({ storeId }).sort({ updatedAt: -1 });
    res.json(policies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE POLICY
export const createPolicy = async (req, res) => {
  try {
    const { storeId, title, description } = req.body;

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    const policy = await Policy.create({ storeId, title, description });
    res.status(201).json(policy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE POLICY
export const updatePolicy = async (req, res) => {
  try {
    const { title, description } = req.body;
    
    const policy = await Policy.findById(req.params.id);
    if (!policy) return res.status(404).json({ message: "Policy not found" });

    const store = await Store.findOne({ _id: policy.storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    policy.title = title || policy.title;
    policy.description = description || policy.description;
    
    const updatedPolicy = await policy.save();
    res.json(updatedPolicy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE POLICY
export const deletePolicy = async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id);
    if (!policy) return res.status(404).json({ message: "Policy not found" });

    const store = await Store.findOne({ _id: policy.storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized" });

    await policy.deleteOne();
    res.json({ message: "Policy deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET PUBLIC POLICIES FOR A STORE (Storefront access)
export const getPublicPolicies = async (req, res) => {
  try {
    // req.store is populated by storeResolver middleware
    if (!req.store || !req.store._id) {
      // This should ideally not happen if storeResolver runs, but for safety
      return res.status(404).json({ message: "Store context not found for policies." });
    }

    const policies = await Policy.find({ storeId: req.store._id })
      .select('title description') // Only send what's needed for the storefront
      .sort({ title: 1 });
    res.json(policies);
  } catch (error) {
    res.status(500).json({ message: "Internal server error fetching public policies: " + error.message });
  }
};