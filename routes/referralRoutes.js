import express from 'express';
import {
    getReferralHistory,
    applyReferralCode,
    getReferralStats
} from '../controllers/referralController.js';

const router = express.Router();

// Get user's referral history
router.get('/:userId/history', getReferralHistory);

// Get user's referral stats
router.get('/:userId/stats', getReferralStats);

// Apply referral code during registration
router.post('/apply', applyReferralCode);

export default router;

