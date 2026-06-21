import Store from "../models/Store.js";
import SuperAdminStaff from "../models/SuperAdminStaff.js";
import Domain from "../models/Domain.js";

// @desc    Get current employee's performance (stores list they onboarded)
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

    const stores = await Store.find({ empID: staff.EmployeeId, isDeleted: false })
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

    res.json({
      employee: {
        _id: staff._id,
        EmployeeId: staff.EmployeeId,
        name: staff.name,
        role: staff.role
      },
      stores: storeDetails
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
