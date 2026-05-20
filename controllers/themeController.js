import Theme from "../models/Theme.js";

// ==========================================
// SUPERADMIN THEME CONTROLLERS
// ==========================================

// @desc    Create a new theme
// @route   POST /api/superadmin/themes
// @access  Private/SuperAdmin
export const createTheme = async (req, res) => {
  try {
    const { name, themeId, type, category, description, previewImage, themeFolder, isActive, price, version } = req.body;

    const themeExists = await Theme.findOne({ themeId });
    if (themeExists) {
      return res.status(400).json({ message: "A theme with this ID already exists." });
    }

    const theme = await Theme.create({
      name,
      themeId,
      type,
      category,
      description,
      previewImage,
      themeFolder,
      isActive,
      price,
      version,
      createdBy: req.user?._id, // Tracks which superadmin added the theme
    });

    res.status(201).json(theme);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all themes (for Superadmin management)
// @route   GET /api/superadmin/themes
// @access  Private/SuperAdmin
export const getSuperadminThemes = async (req, res) => {
  try {
    const themes = await Theme.find({}).sort({ createdAt: -1 });
    res.status(200).json(themes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a theme
// @route   PUT /api/superadmin/themes/:id
// @access  Private/SuperAdmin
export const updateTheme = async (req, res) => {
  try {
    const updatedTheme = await Theme.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedTheme) {
      return res.status(404).json({ message: "Theme not found." });
    }

    res.status(200).json(updatedTheme);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a theme
// @route   DELETE /api/superadmin/themes/:id
// @access  Private/SuperAdmin
export const deleteTheme = async (req, res) => {
  try {
    const theme = await Theme.findById(req.params.id);
    if (!theme) {
      return res.status(404).json({ message: "Theme not found." });
    }

    // If necessary, add logic here to prevent deleting themes that are currently assigned to stores

    await theme.deleteOne();
    res.status(200).json({ message: "Theme deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// STORE OWNER / PUBLIC THEME CONTROLLERS
// ==========================================

// @desc    Get all active themes for store owners to choose from
// @route   GET /api/themes
// @access  Public (or Private depending on your setup)
export const getActiveThemes = async (req, res) => {
  try {
    const themes = await Theme.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json(themes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};