import Plan from "../models/Plan.js";
import Store from "../models/Store.js";

// GET ALL PLANS
export const getPlans = async (req, res) => {
  try {
    // Sort by price ascending to ensure a consistent order on the pricing page
    const plans = await Plan.find().sort({ price: 1 });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE OR UPDATE PLAN
export const createOrUpdatePlan = async (req, res) => {
  try {
    const { name, price, features } = req.body;
    const plan = await Plan.findOneAndUpdate(
      { name },
      { price, features },
      { new: true, upsert: true } // Creates if it doesn't exist, updates if it does
    );
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ASSIGN PLAN TO STORE
export const assignPlanToStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { planId, trialDays } = req.body; // e.g., trialDays: 7 for a 1-week trial

    const store = await Store.findById(id);
    if (!store) return res.status(404).json({ message: "Store not found" });

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    store.planId = planId;
    store.subscriptionStatus = trialDays ? 'trial' : 'active';
    store.isTrialActive = !!trialDays;
    store.planStartDate = new Date();
    store.planExpiryDate = new Date();
    store.planExpiryDate.setDate(store.planExpiryDate.getDate() + (trialDays || 30)); // Default 30 days if not trial

    await store.save();
    res.json({ message: "Plan assigned successfully", store });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};