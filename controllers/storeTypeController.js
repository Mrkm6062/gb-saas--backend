import StoreType from "../models/StoreType.js";
import Counter from "../models/Counter.js";

// GET ALL STORE TYPES (Admin)
export const getStoreTypes = async (req, res) => {
  try {
    const storeTypes = await StoreType.find().sort({ createdAt: -1 });
    res.json(storeTypes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ACTIVE STORE TYPES (Public for store creation / superadmin default products)
export const getActiveStoreTypes = async (req, res) => {
  try {
    const storeTypes = await StoreType.find({ isActive: true }).sort({ name: 1 });
    res.json(storeTypes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE STORE TYPE (Superadmin)
export const createStoreType = async (req, res) => {
  try {
    const { name, features, isActive } = req.body;
    
    const counter = await Counter.findOneAndUpdate(
      { _id: 'storeTypeId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const storetypeId = `ST${String(counter.seq).padStart(3, '0')}`;

    const storeType = await StoreType.create({
      storetypeId,
      name,
      features,
      isActive: isActive !== undefined ? isActive : true
    });
    res.status(201).json(storeType);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE STORE TYPE (Superadmin)
export const updateStoreType = async (req, res) => {
  try {
    const { name, features, isActive } = req.body;
    const storeType = await StoreType.findByIdAndUpdate(req.params.id, { name, features, isActive }, { new: true });
    if (!storeType) return res.status(404).json({ message: "Store Type not found" });
    res.json(storeType);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE STORE TYPE (Superadmin)
export const deleteStoreType = async (req, res) => {
  try {
    const storeType = await StoreType.findByIdAndDelete(req.params.id);
    if (!storeType) return res.status(404).json({ message: "Store Type not found" });
    res.json({ message: "Store Type deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};