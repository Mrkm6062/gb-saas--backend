import express from "express";
import { getDeliverySettings, updateDeliverySettings, getPublicDeliverySettings, getStatesAndDistricts, getOfficesByDistrict, getDetailsByPincode } from "../controllers/deliveryController.js";
// Note: Adjust this import based on your exact auth middleware file name
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/public", getPublicDeliverySettings);
router.get("/public/pincode/:pincode", getDetailsByPincode);
router.get("/", protect, getDeliverySettings);
router.put("/", protect, updateDeliverySettings);

export default router;