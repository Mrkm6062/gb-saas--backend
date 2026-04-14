import Store from "../models/Store.js";

// GET CURRENT STORE
export const getMyStore = async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user._id });

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    res.json(store);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET STORE BY SUBDOMAIN (PUBLIC)
export const getStoreBySubdomain = async (req, res) => {
  try {
    const { subdomain } = req.params;

    const store = await Store.findOne({ subdomain });

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    res.json(store);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};