import Store from "../models/Store.js";

// GET /api/seo-settings/:storeId
export const getSeoSettings = async (req, res) => {
  try {
    const { storeId } = req.params;

    const query = { ownerId: req.user.userId };
    if (storeId.match(/^[0-9a-fA-F]{24}$/)) {
      query._id = storeId;
    } else {
      query.storeId = storeId;
    }
    query.isDeleted = { $ne: true };

    const store = await Store.findOne(query);
    if (!store) {
      return res.status(404).json({ message: "Store not found or unauthorized" });
    }

    // Return current seoSettings, or empty object if not set (will fall back to schema defaults)
    res.json(store.seoSettings || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/seo-settings/:storeId
export const updateSeoSettings = async (req, res) => {
  try {
    const { storeId } = req.params;
    const {
      indexWebsite,
      generateSitemap,
      sitemapIncludeProducts,
      sitemapIncludeCategories,
      sitemapIncludePages,
      allowAllBots,
      allowAiSearch,
      allowAiInput,
      allowAiTraining,
      blockGPTBot,
      blockClaudeBot,
      blockGoogleExtended,
      blockMetaExternalAgent,
      blockAmazonBot,
      blockApplebotExtended,
      metaTitle,
      metaDescription,
      metaKeywords,
      canonicalDomain,
      customRobotsContent,
      customLlmsContent
    } = req.body;

    const query = { ownerId: req.user.userId };
    if (storeId.match(/^[0-9a-fA-F]{24}$/)) {
      query._id = storeId;
    } else {
      query.storeId = storeId;
    }
    query.isDeleted = { $ne: true };

    const store = await Store.findOne(query);
    if (!store) {
      return res.status(404).json({ message: "Store not found or unauthorized" });
    }

    if (!store.seoSettings) {
      store.seoSettings = {};
    }

    if (indexWebsite !== undefined) store.seoSettings.indexWebsite = indexWebsite;
    if (generateSitemap !== undefined) store.seoSettings.generateSitemap = generateSitemap;
    if (sitemapIncludeProducts !== undefined) store.seoSettings.sitemapIncludeProducts = sitemapIncludeProducts;
    if (sitemapIncludeCategories !== undefined) store.seoSettings.sitemapIncludeCategories = sitemapIncludeCategories;
    if (sitemapIncludePages !== undefined) store.seoSettings.sitemapIncludePages = sitemapIncludePages;
    if (allowAllBots !== undefined) store.seoSettings.allowAllBots = allowAllBots;
    if (allowAiSearch !== undefined) store.seoSettings.allowAiSearch = allowAiSearch;
    if (allowAiInput !== undefined) store.seoSettings.allowAiInput = allowAiInput;
    if (allowAiTraining !== undefined) store.seoSettings.allowAiTraining = allowAiTraining;
    if (blockGPTBot !== undefined) store.seoSettings.blockGPTBot = blockGPTBot;
    if (blockClaudeBot !== undefined) store.seoSettings.blockClaudeBot = blockClaudeBot;
    if (blockGoogleExtended !== undefined) store.seoSettings.blockGoogleExtended = blockGoogleExtended;
    if (blockMetaExternalAgent !== undefined) store.seoSettings.blockMetaExternalAgent = blockMetaExternalAgent;
    if (blockAmazonBot !== undefined) store.seoSettings.blockAmazonBot = blockAmazonBot;
    if (blockApplebotExtended !== undefined) store.seoSettings.blockApplebotExtended = blockApplebotExtended;
    if (metaTitle !== undefined) store.seoSettings.metaTitle = metaTitle;
    if (metaDescription !== undefined) store.seoSettings.metaDescription = metaDescription;
    if (metaKeywords !== undefined) store.seoSettings.metaKeywords = metaKeywords;
    if (canonicalDomain !== undefined) store.seoSettings.canonicalDomain = canonicalDomain;
    if (customRobotsContent !== undefined) store.seoSettings.customRobotsContent = customRobotsContent;
    if (customLlmsContent !== undefined) store.seoSettings.customLlmsContent = customLlmsContent;

    await store.save();

    res.json({ message: "SEO & AI settings updated successfully!", seoSettings: store.seoSettings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
