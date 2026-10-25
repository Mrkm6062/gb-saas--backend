import Store from "../models/Store.js";

// Helper to normalize and strip duplicate .galibrand.cloud
const sanitizeStoreDomain = (rawDomain, subdomain) => {
  let d = (rawDomain || '').trim();
  if (d) {
    while (d.toLowerCase().includes('.galibrand.cloud.galibrand.cloud')) {
      d = d.replace(/\.galibrand\.cloud\.galibrand\.cloud/gi, '.galibrand.cloud');
    }
    if (!/^https?:\/\//i.test(d)) {
      d = `https://${d}`;
    }
    return d.replace(/\/+$/, '');
  }
  if (subdomain) {
    let sub = String(subdomain).trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    while (sub.toLowerCase().includes('.galibrand.cloud.galibrand.cloud')) {
      sub = sub.replace(/\.galibrand\.cloud\.galibrand\.cloud/gi, '.galibrand.cloud');
    }
    if (sub.includes('.')) {
      return `https://${sub}`;
    }
    return `https://${sub}.galibrand.cloud`;
  }
  return '';
};

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

    const seoSettings = store.seoSettings ? (store.seoSettings.toObject ? store.seoSettings.toObject() : { ...store.seoSettings }) : {};

    // Prioritize and resolve SEO fields from websiteTitle, metaDescription, metaKeywords, and canonicalDomain
    const metaTitle = seoSettings.metaTitle || store.websiteTitle || store.storeName || '';
    const metaDescription = seoSettings.metaDescription || store.metaDescription || '';
    const metaKeywords = (seoSettings.metaKeywords && Array.isArray(seoSettings.metaKeywords) && seoSettings.metaKeywords.length > 0)
      ? seoSettings.metaKeywords
      : (store.metaKeywords || []);
    const canonicalDomain = sanitizeStoreDomain(seoSettings.canonicalDomain || store.canonicalDomain, store.subdomain);

    res.json({
      ...seoSettings,
      metaTitle,
      websiteTitle: store.websiteTitle || store.storeName || '',
      storeName: store.storeName || '',
      metaDescription,
      metaKeywords,
      canonicalDomain
    });
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
    
    // Update both seoSettings and Store top-level fields
    if (metaTitle !== undefined) {
      store.seoSettings.metaTitle = metaTitle;
      store.websiteTitle = metaTitle;
    }
    if (metaDescription !== undefined) {
      store.seoSettings.metaDescription = metaDescription;
      store.metaDescription = metaDescription;
    }
    if (metaKeywords !== undefined) {
      const keywordsArr = Array.isArray(metaKeywords) 
        ? metaKeywords 
        : (typeof metaKeywords === 'string' ? metaKeywords.split(',').map(k => k.trim()).filter(Boolean) : []);
      store.seoSettings.metaKeywords = keywordsArr;
      store.metaKeywords = keywordsArr;
    }
    if (canonicalDomain !== undefined) {
      const cleanCanonical = sanitizeStoreDomain(canonicalDomain, store.subdomain);
      store.seoSettings.canonicalDomain = cleanCanonical;
      store.canonicalDomain = cleanCanonical;
    }
    if (customRobotsContent !== undefined) store.seoSettings.customRobotsContent = customRobotsContent;
    if (customLlmsContent !== undefined) store.seoSettings.customLlmsContent = customLlmsContent;

    await store.save();

    res.json({ 
      message: "SEO & AI settings updated successfully!", 
      seoSettings: store.seoSettings,
      websiteTitle: store.websiteTitle,
      metaDescription: store.metaDescription,
      metaKeywords: store.metaKeywords,
      canonicalDomain: store.canonicalDomain
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
