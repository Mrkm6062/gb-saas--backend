import Plan from "../models/Plan.js";
import Store from "../models/Store.js";

// GET ALL PLANS
export const getPlans = async (req, res) => {
  try {
    const filter = {};
    // If not requested from superadmin, only show active plans
    if (!req.originalUrl.includes("/superadmin/")) {
      filter.active = true;
    }
    const plans = await Plan.find(filter).populate("features.feature");
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE OR UPDATE PLAN
export const createOrUpdatePlan = async (req, res) => {
  try {
    const { _id, name, description, active, popular, billing, limits, features } = req.body;

    let plan;
    if (_id) {
      plan = await Plan.findByIdAndUpdate(
        _id,
        { name, description, active, popular, billing, limits, features },
        { new: true }
      );
    } else {
      plan = await Plan.create({
        name,
        description,
        active,
        popular,
        billing,
        limits,
        features
      });
    }

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    // Populate reference data
    await plan.populate("features.feature");
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE PLAN
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findByIdAndDelete(id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json({ message: "Plan deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ASSIGN PLAN TO STORE
export const assignPlanToStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { planId, trialDays } = req.body;

    const store = await Store.findById(id);
    if (!store) return res.status(404).json({ message: "Store not found" });

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    store.planId = planId;
    store.subscriptionStatus = trialDays ? 'trial' : 'active';
    store.isTrialActive = !!trialDays;
    store.planStartDate = new Date();
    store.planExpiryDate = new Date();
    store.planExpiryDate.setDate(store.planExpiryDate.getDate() + (trialDays || 30));

    await store.save();
    res.json({ message: "Plan assigned successfully", store });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};