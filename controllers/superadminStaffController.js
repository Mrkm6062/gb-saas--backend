import SuperAdminStaff from "../models/SuperAdminStaff.js";
import Counter from "../models/Counter.js";

// @desc    Create a new employee
// @route   POST /api/staff
// @access  Private (Superadmin & HR Executive)
export const createEmployee = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      role,
      DOB,
      DOJ,
      Designation,
      Department,
      Location,
      password // Optional: passed from frontend or fallback to default
    } = req.body;

    // Check permissions: only superadmin and HR can create
    const allowedRoles = ['superadmin', 'HR Executive', 'HR Manager'];
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Not authorized. Only Superadmin or HR can create employees." });
    }

    // Check if email already exists
    const existingEmployee = await SuperAdminStaff.findOne({ email });
    if (existingEmployee) {
      return res.status(400).json({ message: "An employee with this email already exists." });
    }

    // Generate EmployeeId like GBE0001
    const counter = await Counter.findOneAndUpdate(
      { _id: 'employeeId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const EmployeeId = `GBE${String(counter.seq).padStart(4, '0')}`;

    const employee = await SuperAdminStaff.create({
      EmployeeId,
      name,
      phone,
      email,
      role: role || 'staff',
      DOB,
      DOJ,
      Designation,
      Department,
      Location,
      password: password || 'GBStaff@123', // Default password if none provided
    });

    res.status(201).json({
      message: "Employee created successfully",
      employee: {
        _id: employee._id,
        EmployeeId: employee.EmployeeId,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        Department: employee.Department
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update employee details (Address, Bank, Stores, etc.)
// @route   PUT /api/staff/:id
// @access  Private (Superadmin & HR)
export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    // Check permissions
    const allowedRoles = ['superadmin', 'HR Executive', 'HR Manager'];
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Not authorized. Only Superadmin or HR can update employees." });
    }

    const employee = await SuperAdminStaff.findById(id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    // Fields that are allowed to be updated
    const updatableFields = [
      'name', 'phone', 'email', 'CompanyEmail', 'role', 'DOB', 'DOJ',
      'Designation', 'Department', 'Location', 'Pofileimage', 'Address',
      'BankDetails', 'UPI', 'assignedStores', 'Suspended'
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        employee[field] = req.body[field];
      }
    });

    const updatedEmployee = await employee.save();

    res.json({
      message: "Employee updated successfully",
      employee: updatedEmployee
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all employees
// @route   GET /api/staff
// @access  Private (Superadmin only)
export const getEmployees = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({ message: "Not authorized. Only Superadmin can view all employees." });
    }

    const employees = await SuperAdminStaff.find().select('-password').sort({ createdAt: -1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current logged-in employee profile
// @route   GET /api/staff/me
// @access  Private (Any authenticated employee/staff)
export const getSelfProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized." });
    }
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update current logged-in employee profile
// @route   PUT /api/staff/me
// @access  Private (Any authenticated employee/staff)
export const updateSelfProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized." });
    }

    const employee = await SuperAdminStaff.findById(req.user._id);
    if (!employee) {
      return res.status(404).json({ message: "Employee profile not found." });
    }

    // Fields that employees are allowed to update on their own profiles
    const selfUpdatableFields = [
      'name', 'phone', 'Pofileimage', 'Address', 'BankDetails', 'UPI', 'password'
    ];

    selfUpdatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        employee[field] = req.body[field];
      }
    });

    const updatedEmployee = await employee.save();
    
    // Hide password before returning
    const returnUser = updatedEmployee.toObject();
    delete returnUser.password;

    res.json({
      message: "Profile updated successfully",
      employee: returnUser
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};