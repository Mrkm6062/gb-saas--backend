import CustomPage from "../models/CustomPage.js";
import Store from "../models/Store.js";
import { customPageSchemaVal, customPageUpdateSchemaVal } from "../validators/customBuilderValidator.js";
import { sanitizeHTML } from "../utils/sanitizer.js";

// Helper: Verify store ownership for non-superadmins
const verifyStoreOwner = async (storeId, userId, role) => {
  const storeQuery = { _id: storeId };
  if (role !== "superadmin") {
    storeQuery.ownerId = userId;
  }
  const store = await Store.findOne(storeQuery);
  return !!store;
};

// CREATE PAGE
export const createPage = async (req, res) => {
  try {
    const { storeId } = req.body;
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    // 1. Permissions check
    const isOwner = await verifyStoreOwner(storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    // 2. Validate input schema
    const parsed = customPageSchemaVal.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation error", errors: parsed.error.format() });
    }

    const pageData = parsed.data;

    // 3. Prevent duplicate slugs within the same store
    const slugExists = await CustomPage.findOne({ storeId, slug: pageData.slug, isDeleted: false });
    if (slugExists) {
      return res.status(400).json({ message: "Slug is already in use for this store" });
    }

    // 4. Sanitize HTML body
    if (pageData.bodyHTML) {
      pageData.bodyHTML = sanitizeHTML(pageData.bodyHTML);
    }
    if (pageData.headHTML) {
      pageData.headHTML = sanitizeHTML(pageData.headHTML);
    }

    // 5. If homepage is set, disable homepage flag on other pages in this store
    if (pageData.isHomepage) {
      await CustomPage.updateMany({ storeId }, { $set: { isHomepage: false } });
    }

    // 6. Create custom page
    const page = await CustomPage.create({
      storeId,
      ...pageData,
      isPublished: pageData.status === "published",
    });

    res.status(201).json(page);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE PAGE
export const updatePage = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await CustomPage.findById(id);
    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    // Permissions check
    const isOwner = await verifyStoreOwner(page.storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    // Validate update schema
    const parsed = customPageUpdateSchemaVal.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation error", errors: parsed.error.format() });
    }

    const pageData = parsed.data;

    // Check slug uniqueness if it is changing
    if (pageData.slug && pageData.slug !== page.slug) {
      const slugExists = await CustomPage.findOne({
        storeId: page.storeId,
        slug: pageData.slug,
        isDeleted: false,
        _id: { $ne: id },
      });
      if (slugExists) {
        return res.status(400).json({ message: "Slug is already in use for this store" });
      }
    }

    // Sanitize HTML body if updated
    if (pageData.bodyHTML !== undefined) {
      pageData.bodyHTML = sanitizeHTML(pageData.bodyHTML);
    }
    if (pageData.headHTML !== undefined) {
      pageData.headHTML = sanitizeHTML(pageData.headHTML);
    }

    // Handle homepage override
    if (pageData.isHomepage) {
      await CustomPage.updateMany({ storeId: page.storeId, _id: { $ne: id } }, { $set: { isHomepage: false } });
    }

    // Update fields
    Object.keys(pageData).forEach((key) => {
      if (pageData[key] !== undefined) {
        if (key === "seo") {
          page.seo = { ...page.seo, ...pageData.seo };
        } else {
          page[key] = pageData[key];
        }
      }
    });

    // Ensure status and isPublished remain in sync
    if (pageData.status !== undefined) {
      page.isPublished = pageData.status === "published";
    } else if (pageData.isPublished !== undefined) {
      page.status = pageData.isPublished ? "published" : "draft";
    }

    const updatedPage = await page.save();
    res.json(updatedPage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// HARD DELETE PAGE
export const deletePage = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await CustomPage.findById(id);
    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    const isOwner = await verifyStoreOwner(page.storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    await page.deleteOne();
    res.json({ message: "Page permanently deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// SOFT DELETE PAGE
export const softDeletePage = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await CustomPage.findById(id);
    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    const isOwner = await verifyStoreOwner(page.storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    page.isDeleted = true;
    page.deletedAt = new Date();
    // If it was a homepage, unset it so it doesn't block other homepages
    if (page.isHomepage) {
      page.isHomepage = false;
    }

    await page.save();
    res.json({ message: "Page soft-deleted successfully", page });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUBLISH PAGE
export const publishPage = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await CustomPage.findById(id);
    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    const isOwner = await verifyStoreOwner(page.storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    page.isPublished = true;
    page.status = "published";
    await page.save();

    res.json({ message: "Page published successfully", page });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UNPUBLISH PAGE
export const unpublishPage = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await CustomPage.findById(id);
    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    const isOwner = await verifyStoreOwner(page.storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    page.isPublished = false;
    page.status = "draft";
    await page.save();

    res.json({ message: "Page unpublished successfully", page });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DUPLICATE PAGE
export const duplicatePage = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await CustomPage.findById(id);
    if (!page) {
      return res.status(404).json({ message: "Page to duplicate not found" });
    }

    const isOwner = await verifyStoreOwner(page.storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    // Generate unique slug and title
    const timestamp = Date.now();
    const newTitle = `${page.title} (Copy)`;
    const newSlug = `${page.slug}-copy-${timestamp}`;

    const duplicatedData = {
      storeId: page.storeId,
      title: newTitle,
      slug: newSlug,
      pageType: page.pageType,
      description: page.description,
      isHomepage: false, // Never set duplicate as homepage directly
      isPublished: false,
      status: "draft",
      headHTML: page.headHTML,
      bodyHTML: page.bodyHTML,
      customCSS: page.customCSS,
      customJS: page.customJS,
      seo: { ...page.seo, metaTitle: `${page.seo.metaTitle || page.title} (Copy)` },
      favicon: page.favicon,
      author: page.author,
      pageIcon: page.pageIcon,
      thumbnail: page.thumbnail,
      sortOrder: page.sortOrder + 1,
    };

    const duplicate = await CustomPage.create(duplicatedData);
    res.status(201).json(duplicate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ALL PAGES (Private / Store Owner Dashboard)
export const getAllPages = async (req, res) => {
  try {
    const { storeId, search, status, pageType, isDeleted } = req.query;
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const isOwner = await verifyStoreOwner(storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    const filter = { storeId };

    // Handle soft deletion filters
    if (isDeleted === "true") {
      filter.isDeleted = true;
    } else if (isDeleted === "false") {
      filter.isDeleted = false;
    } else {
      filter.isDeleted = false; // Default: hide deleted pages
    }

    if (status) {
      filter.status = status;
    }

    if (pageType) {
      filter.pageType = pageType;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
      ];
    }

    const pages = await CustomPage.find(filter).sort({ sortOrder: 1, createdAt: -1 });
    res.json(pages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET PAGE BY ID (Private / Store Owner Dashboard)
export const getPageById = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await CustomPage.findById(id);
    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    const isOwner = await verifyStoreOwner(page.storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    res.json(page);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PREVIEW PAGE (Private / Drafts preview)
export const previewPage = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await CustomPage.findById(id);
    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    const isOwner = await verifyStoreOwner(page.storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    // Returns full data including draft HTML/CSS/JS for iframe rendering
    res.json(page);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// SEARCH PAGES (Private)
export const searchPages = async (req, res) => {
  try {
    const { storeId, query } = req.query;
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const isOwner = await verifyStoreOwner(storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    const pages = await CustomPage.find({
      storeId,
      isDeleted: false,
      title: { $regex: query || "", $options: "i" },
    }).limit(10);

    res.json(pages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET PAGE BY SLUG (Public / Storefront)
export const getPageBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Resolve storeId from storeResolver middleware (req.store)
    if (!req.store) {
      return res.status(404).json({ message: "Store context not found" });
    }

    const page = await CustomPage.findOne({
      storeId: req.store._id,
      slug: slug.toLowerCase(),
      isPublished: true,
      status: "published",
      isDeleted: false,
    });

    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    res.json(page);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET HOMEPAGE (Public / Storefront)
export const getHomepage = async (req, res) => {
  try {
    if (!req.store) {
      return res.status(404).json({ message: "Store context not found" });
    }

    const page = await CustomPage.findOne({
      storeId: req.store._id,
      isHomepage: true,
      isPublished: true,
      status: "published",
      isDeleted: false,
    });

    if (!page) {
      return res.status(404).json({ message: "Homepage not found" });
    }

    res.json(page);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
