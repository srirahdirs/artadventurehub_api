import express from 'express';
import {
    createCoupon,
    getAllCoupons,
    getActiveCoupons,
    getCouponById,
    updateCoupon,
    deleteCoupon,
    validateCoupon,
    applyCoupon,
    toggleCouponStatus
} from '../controllers/couponController.js';

const router = express.Router();

// Admin routes
router.post('/', createCoupon);
router.get('/', getAllCoupons);
router.get('/active', getActiveCoupons);
router.get('/:id', getCouponById);
router.put('/:id', updateCoupon);
router.delete('/:id', deleteCoupon);
router.patch('/:id/toggle-status', toggleCouponStatus);

// Public routes
router.post('/validate', validateCoupon);
router.post('/apply', applyCoupon);

export default router;


