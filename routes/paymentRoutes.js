import express from "express";
import { createPayment } from "../controllers/paymentController.js";

const router = express.Router();

router.post("/create", createPayment);
router.post("/create-order", createPayment);

export default router;
