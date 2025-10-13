import express from 'express';
import {
    requestWithdrawal,
    getUserWithdrawals,
    updateWithdrawalDetails,
    getAllWithdrawals,
    processWithdrawal
} from '../controllers/withdrawalController.js';

const router = express.Router();

// User routes
router.post('/request', requestWithdrawal);
router.get('/user/:user_id', getUserWithdrawals);
router.put('/user/:user_id/details', updateWithdrawalDetails);

// Admin routes
router.get('/admin/all', getAllWithdrawals);
router.put('/admin/:withdrawal_id/process', processWithdrawal);

export default router;
