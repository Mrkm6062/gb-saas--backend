import SalaryCommission from "../models/SalaryCommission.js";
import SuperAdminStaff from "../models/SuperAdminStaff.js";

// @desc    Generate Payout (Salary or Commission Invoice)
// @route   POST /api/salary-commission/payout
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

    // Create a payout entry inside SalaryCommission
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
// @route   GET /api/salary-commission/my-payouts
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

// @desc    Get all payouts (Superadmin only)
// @route   GET /api/salary-commission/all
// @access  Private (Superadmin only)
export const getAllPayouts = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({ message: "Not authorized. Superadmin access required." });
    }

    const payouts = await SalaryCommission.find().sort({ createdAt: -1 });
    res.json(payouts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
