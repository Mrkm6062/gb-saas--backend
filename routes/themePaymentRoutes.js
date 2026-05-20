import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { createThemePurchaseOrder, verifyThemePurchase, getPublicKey } from '../controllers/themePaymentController.js';

const router = express.Router();

router.get('/public-key', protect, getPublicKey); 
router.post('/create-theme-order', protect, createThemePurchaseOrder);
router.post('/verify-theme-payment', protect, verifyThemePurchase);

export default router;