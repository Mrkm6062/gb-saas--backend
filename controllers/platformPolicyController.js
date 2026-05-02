import PlatformPolicy from "../models/PlatformPolicy.js";

// GET ALL PLATFORM POLICIES (Superadmin)
export const getPlatformPolicies = async (req, res) => {
  try {
    const policies = await PlatformPolicy.find().sort({ updatedAt: -1 });
    res.json(policies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ACTIVE PUBLIC PLATFORM POLICIES
export const getPublicPlatformPolicies = async (req, res) => {
  try {
    const policies = await PlatformPolicy.find({ isActive: true });
    res.json(policies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE OR UPDATE PLATFORM POLICY (Upsert via Type)
export const createOrUpdatePlatformPolicy = async (req, res) => {
  try {
    const { type, title, content, version, isActive } = req.body;
    
    if (!type || !title || !content) {
      return res.status(400).json({ message: "Type, title, and content are required" });
    }

    const policy = await PlatformPolicy.findOneAndUpdate(
      { type },
      { title, content, version: version || "1.0", isActive: isActive !== undefined ? isActive : true },
      { new: true, upsert: true }
    );
    res.json(policy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE PLATFORM POLICY
export const deletePlatformPolicy = async (req, res) => {
  try {
    await PlatformPolicy.findByIdAndDelete(req.params.id);
    res.json({ message: "Policy deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};