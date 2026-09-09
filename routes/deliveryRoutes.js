import express from "express";
import { 
  getDeliverySettings, 
  updateDeliverySettings, 
  getPublicDeliverySettings, 
  calculatePublicDelivery,
  getStatesAndDistricts, 
  getOfficesByDistrict, 
  getDetailsByPincode,
  getDeliveryAreas,
  createDeliveryArea,
  updateDeliveryArea,
  deleteDeliveryArea
} from "../controllers/deliveryController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes for store frontend
router.get("/public", getPublicDeliverySettings);
router.post("/public/calculate", calculatePublicDelivery);
router.get("/public/pincode/:pincode", getDetailsByPincode);

// Admin protected routes for store dashboard
router.get("/locations", protect, getStatesAndDistricts);
router.get("/offices", protect, getOfficesByDistrict);
router.get("/", protect, getDeliverySettings);
router.put("/", protect, updateDeliverySettings);

// Delivery Area CRUD routes
router.get("/areas", protect, getDeliveryAreas);
router.post("/areas", protect, createDeliveryArea);
router.put("/areas/:id", protect, updateDeliveryArea);
router.delete("/areas/:id", protect, deleteDeliveryArea);

export default router;