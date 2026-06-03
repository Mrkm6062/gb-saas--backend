import express from "express";
import { createEmployee, getEmployees, updateEmployee } from "../controllers/superadminStaffController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply basic authentication middleware to ensure req.user exists.
// Specific role checks (Superadmin, HR, etc.) are handled inside the controllers.
router.use(protect);

router.route("/")
  .post(createEmployee)
  .get(getEmployees);

router.put("/:id", updateEmployee);

export default router;