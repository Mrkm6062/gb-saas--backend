import CustomMenu from "../models/CustomMenu.js";
import Store from "../models/Store.js";
import { customMenuSchemaVal } from "../validators/customBuilderValidator.js";

const verifyStoreOwner = async (storeId, userId, role) => {
  const storeQuery = { _id: storeId };
  if (role !== "superadmin") {
    storeQuery.ownerId = userId;
  }
  const store = await Store.findOne(storeQuery);
  return !!store;
};

const sanitizeMenuItems = (items) => {
  if (!items) return [];
  return items.map(item => {
    let pageId = item.pageId;
    if (pageId && typeof pageId === 'object') {
      pageId = pageId._id;
    }
    const children = item.children ? sanitizeMenuItems(item.children) : [];
    return {
      ...item,
      pageId,
      children
    };
  });
};

// CREATE MENU
export const createMenu = async (req, res) => {
  try {
    const { storeId } = req.body;
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const isOwner = await verifyStoreOwner(storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    const parsed = customMenuSchemaVal.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation error", errors: parsed.error.format() });
    }

    const cleanedMenuItems = sanitizeMenuItems(parsed.data.menuItems);

    const menu = await CustomMenu.create({
      storeId,
      menuName: parsed.data.menuName,
      menuItems: cleanedMenuItems,
    });

    res.status(201).json(menu);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE MENU
export const updateMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const menu = await CustomMenu.findById(id);
    if (!menu) {
      return res.status(404).json({ message: "Menu not found" });
    }

    const isOwner = await verifyStoreOwner(menu.storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    const parsed = customMenuSchemaVal.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Validation error", errors: parsed.error.format() });
    }

    menu.menuName = parsed.data.menuName;
    menu.menuItems = sanitizeMenuItems(parsed.data.menuItems);

    const updatedMenu = await menu.save();
    res.json(updatedMenu);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE MENU
export const deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const menu = await CustomMenu.findById(id);
    if (!menu) {
      return res.status(404).json({ message: "Menu not found" });
    }

    const isOwner = await verifyStoreOwner(menu.storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    await menu.deleteOne();
    res.json({ message: "Menu deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET MENU BY ID (Private)
export const getMenuById = async (req, res) => {
  try {
    const { id } = req.params;
    const menu = await CustomMenu.findById(id).populate("menuItems.pageId");
    if (!menu) {
      return res.status(404).json({ message: "Menu not found" });
    }

    const isOwner = await verifyStoreOwner(menu.storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    res.json(menu);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ALL MENUS (Private - Store Owner Dashboard)
export const getAllMenus = async (req, res) => {
  try {
    const { storeId } = req.query;
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const isOwner = await verifyStoreOwner(storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    const menus = await CustomMenu.find({ storeId }).populate("menuItems.pageId");
    res.json(menus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// REORDER MENU ITEMS (Private)
export const reorderMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { menuItems } = req.body;
    if (!Array.isArray(menuItems)) {
      return res.status(400).json({ message: "menuItems must be an array" });
    }

    const menu = await CustomMenu.findById(id);
    if (!menu) {
      return res.status(404).json({ message: "Menu not found" });
    }

    const isOwner = await verifyStoreOwner(menu.storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    menu.menuItems = menuItems;
    await menu.save();

    res.json({ message: "Menu items reordered successfully", menu });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET MENU BY NAME (Public - Storefront fetching, e.g. "header" or "footer")
export const getPublicMenuByName = async (req, res) => {
  try {
    const { menuName } = req.params;

    if (!req.store) {
      return res.status(404).json({ message: "Store context not found" });
    }

    const menu = await CustomMenu.findOne({
      storeId: req.store._id,
      menuName: { $regex: new RegExp(`^${menuName}$`, "i") },
    }).populate("menuItems.pageId");

    if (!menu) {
      return res.status(404).json({ message: `Menu '${menuName}' not found` });
    }

    res.json(menu);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
