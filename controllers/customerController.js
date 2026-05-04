import CustomerNote from "../models/CustomerNote.js";
import Store from "../models/Store.js";

export const getCustomerNote = async (req, res) => {
  try {
    const { storeId, identifier } = req.query;
    
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Unauthorized" });

    const customerNote = await CustomerNote.findOne({ storeId, identifier });
    res.json({ note: customerNote ? customerNote.note : "" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const saveCustomerNote = async (req, res) => {
  try {
    const { storeId, identifier, note } = req.body;

    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Unauthorized" });

    const customerNote = await CustomerNote.findOneAndUpdate(
      { storeId, identifier }, { note }, { new: true, upsert: true }
    );
    res.json({ message: "Note saved successfully", note: customerNote });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};