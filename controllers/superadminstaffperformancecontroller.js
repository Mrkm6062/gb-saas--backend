import Store from "../models/Store.js";
import SuperAdminStaff from "../models/SuperAdminStaff.js";
import Domain from "../models/Domain.js";
import AdminPerformance from "../models/AdminPerformance.js";
import SalaryCommission from "../models/SalaryCommission.js";

// @desc    Get current employee's performance stores list (legacy/assigned stores compat)
// @route   GET /api/staff-performance/my-stores
// @access  Private (Authenticated Staff)
export const getMyStoresPerformance = async (req, res) => {
  try {
    if (!req.user || !req.user.EmployeeId) {
      return res.status(401).json({ message: "Not authorized. Employee ID not found." });
    }

    const employeeId = req.user.EmployeeId;
    
    // Find all stores created/onboarded by this employee
    const stores = await Store.find({ empID: employeeId, isDeleted: false })
      .populate('planId')
      .sort({ createdAt: -1 })
      .lean();

    const storeDetails = await Promise.all(stores.map(async store => {
      const customDomainDoc = await Domain.findOne({ storeId: store._id, status: 'connected' });
      return {
        _id: store._id,
        storeId: store.storeId,
        storeName: store.storeName,
        subdomain: store.subdomain,
        customDomain: customDomainDoc ? customDomainDoc.domain : null,
        status: store.status,
        subscriptionStatus: store.subscriptionStatus,
        isTrialActive: store.isTrialActive,
        planExpiryDate: store.planExpiryDate,
        plan: store.planId ? {
          _id: store.planId._id,
          name: store.planId.name,
          price: store.planId.price,
          features: store.planId.features
        } : {
          name: "Free",
          price: 0,
          features: {}
        }
      };
    }));

    res.json(storeDetails);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current employee's performance & commission summary
// @route   GET /api/staff-performance/details
// @access  Private (Authenticated Staff)
export const getMyPerformanceDetails = async (req, res) => {
  try {
    if (!req.user || !req.user.EmployeeId) {
      return res.status(401).json({ message: "Not authorized. Employee ID not found." });
    }

    const employeeId = req.user.EmployeeId;
    const employeeDbId = req.user._id;

    // 1. Get performance/goal settings
    let perfSettings = await AdminPerformance.findOne({ employeeId: employeeDbId });
    if (!perfSettings) {
      perfSettings = await AdminPerformance.create({
        employeeId: employeeDbId,
        monthlyTarget: 10,
        performanceRating: 5.0,
        keyPerformanceSettings: "Acquire new merchants and onboard them onto the platform.",
        commissionPercentage: 10
      });
    }

    // 2. Find onboarded stores
    const stores = await Store.find({ empID: employeeId, isDeleted: false })
      .populate('planId')
      .sort({ createdAt: -1 })
      .lean();

    const commissionPercentage = perfSettings.commissionPercentage || 10;
    let totalCommission = 0;
    
    const storeDetails = await Promise.all(stores.map(async store => {
      const customDomainDoc = await Domain.findOne({ storeId: store._id, status: 'connected' });
      
      // Calculate one-time commission from billingHistory
      let hasSelectedPlan = false;
      let planPaidAmount = 0;
      let commissionEarned = 0;
      let firstPaymentDate = null;
      let firstPaymentPlan = "N/A";

      if (store.billingHistory && store.billingHistory.length > 0) {
        // Find the first paid plan (amount > 0)
        const firstPaidPlan = store.billingHistory.find(b => b.amount > 0);
        if (firstPaidPlan) {
          hasSelectedPlan = true;
          planPaidAmount = firstPaidPlan.amount;
          commissionEarned = (planPaidAmount * commissionPercentage) / 100;
          firstPaymentDate = firstPaidPlan.date;
          firstPaymentPlan = firstPaidPlan.planName;
          totalCommission += commissionEarned;
        }
      }

      return {
        _id: store._id,
        storeId: store.storeId,
        storeName: store.storeName,
        subdomain: store.subdomain,
        customDomain: customDomainDoc ? customDomainDoc.domain : null,
        status: store.status,
        subscriptionStatus: store.subscriptionStatus,
        isTrialActive: store.isTrialActive,
        planExpiryDate: store.planExpiryDate,
        createdAt: store.createdAt,
        hasSelectedPlan,
        planPaidAmount,
        commissionEarned,
        firstPaymentDate,
        firstPaymentPlan
      };
    }));

    res.json({
      performanceSettings: perfSettings,
      onboardedCount: stores.length,
      totalCommission,
      stores: storeDetails
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get performance of a specific staff member (for Superadmin/HR)
// @route   GET /api/staff-performance/:id
// @access  Private (Superadmin/HR only)
export const getStaffPerformanceById = async (req, res) => {
  try {
    const allowedRoles = ['superadmin', 'HR Executive', 'HR Manager'];
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Not authorized to view staff performance." });
    }

    const staff = await SuperAdminStaff.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ message: "Employee not found." });
    }

    if (!staff.EmployeeId) {
      return res.status(400).json({ message: "Employee does not have a valid Employee ID." });
    }

    let perfSettings = await AdminPerformance.findOne({ employeeId: staff._id });
    if (!perfSettings) {
      perfSettings = await AdminPerformance.create({
        employeeId: staff._id,
        monthlyTarget: 10,
        performanceRating: 5.0,
        keyPerformanceSettings: "Acquire new merchants and onboard them onto the platform.",
        commissionPercentage: 10
      });
    }

    const stores = await Store.find({ empID: staff.EmployeeId, isDeleted: false })
      .populate('planId')
      .sort({ createdAt: -1 })
      .lean();

    const commissionPercentage = perfSettings.commissionPercentage || 10;
    let totalCommission = 0;

    const storeDetails = await Promise.all(stores.map(async store => {
      const customDomainDoc = await Domain.findOne({ storeId: store._id, status: 'connected' });
      
      let hasSelectedPlan = false;
      let planPaidAmount = 0;
      let commissionEarned = 0;
      let firstPaymentDate = null;
      let firstPaymentPlan = "N/A";

      if (store.billingHistory && store.billingHistory.length > 0) {
        const firstPaidPlan = store.billingHistory.find(b => b.amount > 0);
        if (firstPaidPlan) {
          hasSelectedPlan = true;
          planPaidAmount = firstPaidPlan.amount;
          commissionEarned = (planPaidAmount * commissionPercentage) / 100;
          firstPaymentDate = firstPaidPlan.date;
          firstPaymentPlan = firstPaidPlan.planName;
          totalCommission += commissionEarned;
        }
      }

      return {
        _id: store._id,
        storeId: store.storeId,
        storeName: store.storeName,
        subdomain: store.subdomain,
        customDomain: customDomainDoc ? customDomainDoc.domain : null,
        status: store.status,
        subscriptionStatus: store.subscriptionStatus,
        isTrialActive: store.isTrialActive,
        planExpiryDate: store.planExpiryDate,
        createdAt: store.createdAt,
        hasSelectedPlan,
        planPaidAmount,
        commissionEarned,
        firstPaymentDate,
        firstPaymentPlan
      };
    }));

    res.json({
      employee: {
        _id: staff._id,
        EmployeeId: staff.EmployeeId,
        name: staff.name,
        role: staff.role,
        Designation: staff.Designation,
        Department: staff.Department
      },
      performanceSettings: perfSettings,
      onboardedCount: stores.length,
      totalCommission,
      stores: storeDetails
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update employee's goal / performance settings (Superadmin only)
// @route   POST /api/staff-performance/settings
// @access  Private (Superadmin only)
export const updatePerformanceSettings = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({ message: "Not authorized. Superadmin access required." });
    }

    const { employeeId, monthlyTarget, performanceRating, keyPerformanceSettings, commissionPercentage } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee DB ID is required." });
    }

    const updatedSettings = await AdminPerformance.findOneAndUpdate(
      { employeeId },
      {
        monthlyTarget: Number(monthlyTarget),
        performanceRating: Number(performanceRating),
        keyPerformanceSettings,
        commissionPercentage: Number(commissionPercentage)
      },
      { new: true, upsert: true }
    );

    res.json({ message: "Performance settings updated successfully.", settings: updatedSettings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Generate Payout (Salary or Commission Invoice)
// @route   POST /api/staff-performance/payout
// @access  Private (Superadmin only)
export const generatePayout = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({ message: "Not authorized. Superadmin access required." });
    }

    const { employeeId, type, amount, month, invoiceId } = req.body;

    if (!employeeId || !type || !amount || !month || !invoiceId) {
      return res.status(400).json({ message: "Please provide employeeId, type (salary/commission), amount, month, and invoiceId." });
    }

    const staff = await SuperAdminStaff.findOne({ EmployeeId: employeeId });
    if (!staff) {
      return res.status(404).json({ message: "Employee not found with provided ID." });
    }

    // Create a payout entry inside SalaryCommission (regrading to PlatformPolicy)
    const payoutDoc = await SalaryCommission.create({
      employeeId,
      employeeName: staff.name,
      amount: Number(amount),
      month,
      type,
      invoiceId,
      status: "Paid",
      paidAt: new Date()
    });

    res.json({ message: "Payout invoice generated successfully.", payout: payoutDoc });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current employee's payout history (Salary & Commission)
// @route   GET /api/staff-performance/my-payouts
// @access  Private (Authenticated Staff)
export const getMyPayouts = async (req, res) => {
  try {
    if (!req.user || !req.user.EmployeeId) {
      return res.status(401).json({ message: "Not authorized. Employee ID not found." });
    }

    const employeeId = req.user.EmployeeId;

    // Fetch from SalaryCommission collection
    const payouts = await SalaryCommission.find({ employeeId }).sort({ createdAt: -1 });

    res.json(payouts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
