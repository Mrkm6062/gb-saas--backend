import Feature from "../models/Feature.js";

// @desc    Get all features
// @route   GET /api/superadmin/features or GET /api/features
// @access  Private (Superadmin) / Public (Active only)
export const getFeatures = async (req, res) => {
  try {
    const filter = {};
    // If not requested from superadmin, only show active features
    if (!req.originalUrl.includes("/superadmin/")) {
      filter.active = true;
    }
    const features = await Feature.find(filter).sort({ name: 1 });
    res.json(features);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new feature
// @route   POST /api/superadmin/features
// @access  Private (Superadmin)
export const createFeature = async (req, res) => {
  try {
    const { name, slug, description, active } = req.body;
    
    // Automatically generate slug if not provided
    const resolvedSlug = slug 
      ? slug.toLowerCase().trim()
      : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const feature = await Feature.create({
      name,
      slug: resolvedSlug,
      description,
      active
    });
    
    res.status(201).json(feature);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a feature
// @route   PUT /api/superadmin/features/:id
// @access  Private (Superadmin)
export const updateFeature = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, active } = req.body;

    const feature = await Feature.findById(id);
    if (!feature) {
      return res.status(404).json({ message: "Feature not found" });
    }

    if (name) feature.name = name;
    if (slug) feature.slug = slug.toLowerCase().trim();
    if (description !== undefined) feature.description = description;
    if (active !== undefined) feature.active = active;

    await feature.save();
    res.json(feature);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a feature
// @route   DELETE /api/superadmin/features/:id
// @access  Private (Superadmin)
export const deleteFeature = async (req, res) => {
  try {
    const { id } = req.params;
    const feature = await Feature.findByIdAndDelete(id);
    if (!feature) {
      return res.status(404).json({ message: "Feature not found" });
    }
    res.json({ message: "Feature deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
