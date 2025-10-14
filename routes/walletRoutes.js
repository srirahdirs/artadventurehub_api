import express from 'express';
import {
    createWalletTopupOrder,
    verifyWalletTopup,
    getWalletTransactions
} from '../controllers/walletController.js';

const router = express.Router();

// Wallet top-up routes
router.post('/topup/create-order', createWalletTopupOrder);
router.post('/topup/verify', verifyWalletTopup);
router.get('/:user_id/transactions', getWalletTransactions);

export default router;

