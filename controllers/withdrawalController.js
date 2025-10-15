import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import WalletTransaction from '../models/WalletTransaction.js';

// Request withdrawal
export const requestWithdrawal = async (req, res) => {
    try {
        const { user_id, amount, withdrawal_method, withdrawal_details } = req.body;

        if (!user_id || !amount || !withdrawal_method || !withdrawal_details) {
            return res.status(400).json({
                success: false,
                message: 'User ID, amount, withdrawal method, and details are required'
            });
        }

        // Get user and check wallet balance
        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Initialize wallet if it doesn't exist
        if (!user.wallet) {
            user.wallet = {
                deposit_balance: 0,
                winning_balance: 0,
                total_deposited: 0,
                total_earned: 0,
                total_withdrawn: 0
            };
        }

        const winningBalance = user.wallet.winning_balance || 0;

        // ✅ KEY CHANGE: Only winning_balance is withdrawable, NOT deposit_balance
        if (winningBalance < amount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient withdrawable balance. Available for withdrawal: ₹${winningBalance} (Only winnings can be withdrawn, deposits are non-withdrawable)`
            });
        }

        if (amount < 100) {
            return res.status(400).json({
                success: false,
                message: 'Minimum withdrawal amount is ₹100'
            });
        }

        // Record total balance before transaction
        const totalBalanceBefore = (user.wallet.deposit_balance || 0) + (user.wallet.winning_balance || 0);

        // Deduct amount from WINNING balance only
        user.wallet.winning_balance -= amount;

        // Update user's withdrawal details for future use
        if (withdrawal_method === 'upi') {
            user.withdrawal_details.upi_id = withdrawal_details.upi_id;
        } else if (withdrawal_method === 'bank') {
            user.withdrawal_details.bank_details = withdrawal_details.bank_details;
        }
        await user.save();

        // Create withdrawal request
        const withdrawal = new Withdrawal({
            user_id,
            amount,
            withdrawal_method,
            withdrawal_details
        });

        await withdrawal.save();

        const totalBalanceAfter = (user.wallet.deposit_balance || 0) + user.wallet.winning_balance;

        // Create wallet transaction record
        await WalletTransaction.create({
            user_id,
            type: 'withdrawal',
            amount: amount,
            balance_before: totalBalanceBefore,
            balance_after: totalBalanceAfter,
            description: `Withdrawal from winnings via ${withdrawal_method === 'upi' ? 'UPI' : 'Bank Transfer'}`,
            reference_id: withdrawal._id.toString(),
            reference_type: 'withdrawal',
            payment_method: withdrawal_method === 'upi' ? 'upi' : 'bank_transfer',
            status: 'pending'
        });

        res.status(201).json({
            success: true,
            message: 'Withdrawal request submitted successfully',
            withdrawal: {
                id: withdrawal._id,
                amount: withdrawal.amount,
                method: withdrawal.withdrawal_method,
                status: withdrawal.status,
                requested_at: withdrawal.createdAt
            },
            note: 'Withdrawal will be processed within 24 hours'
        });

    } catch (error) {
        console.error('Request Withdrawal Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing withdrawal request',
            error: error.message
        });
    }
};

// Get user's withdrawal history
export const getUserWithdrawals = async (req, res) => {
    try {
        const { user_id } = req.params;

        const withdrawals = await Withdrawal.find({ user_id })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            withdrawals: withdrawals.map(w => ({
                id: w._id,
                amount: w.amount,
                method: w.withdrawal_method,
                status: w.status,
                requested_at: w.createdAt,
                processed_at: w.processed_at,
                admin_notes: w.admin_notes,
                rejection_reason: w.rejection_reason
            }))
        });

    } catch (error) {
        console.error('Get User Withdrawals Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching withdrawal history',
            error: error.message
        });
    }
};

// Update user withdrawal details
export const updateWithdrawalDetails = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { withdrawal_details } = req.body;

        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.withdrawal_details = withdrawal_details;
        await user.save();

        res.json({
            success: true,
            message: 'Withdrawal details updated successfully',
            withdrawal_details: user.withdrawal_details
        });

    } catch (error) {
        console.error('Update Withdrawal Details Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating withdrawal details',
            error: error.message
        });
    }
};

// Admin: Get all withdrawal requests
export const getAllWithdrawals = async (req, res) => {
    try {
        const { status = 'pending' } = req.query;

        const withdrawals = await Withdrawal.find(status ? { status } : {})
            .populate('user_id', 'username mobile_number')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            withdrawals: withdrawals.map(w => ({
                id: w._id,
                user: {
                    id: w.user_id._id,
                    username: w.user_id.username || 'Anonymous',
                    mobile: w.user_id.mobile_number
                },
                amount: w.amount,
                method: w.withdrawal_method,
                details: w.withdrawal_details,
                status: w.status,
                requested_at: w.createdAt,
                processed_at: w.processed_at,
                admin_notes: w.admin_notes,
                rejection_reason: w.rejection_reason
            }))
        });

    } catch (error) {
        console.error('Get All Withdrawals Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching withdrawals',
            error: error.message
        });
    }
};

// User: Cancel/Reverse pending withdrawal
export const cancelWithdrawal = async (req, res) => {
    try {
        const { withdrawal_id } = req.params;
        const { user_id } = req.body;

        const withdrawal = await Withdrawal.findById(withdrawal_id);

        if (!withdrawal) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        // Check if user owns this withdrawal
        if (withdrawal.user_id.toString() !== user_id) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to cancel this withdrawal'
            });
        }

        // Check if withdrawal is still pending
        if (withdrawal.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel ${withdrawal.status} withdrawal`
            });
        }

        // Refund amount back to wallet
        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Initialize wallet if needed
        if (!user.wallet) {
            user.wallet = {
                deposit_balance: 0,
                winning_balance: 0,
                total_deposited: 0,
                total_earned: 0,
                total_withdrawn: 0
            };
        }

        // Record total balance before refund
        const totalBalanceBefore = (user.wallet.deposit_balance || 0) + (user.wallet.winning_balance || 0);

        // Refund to WINNING balance (where it was deducted from)
        user.wallet.winning_balance = (user.wallet.winning_balance || 0) + withdrawal.amount;
        await user.save();

        const totalBalanceAfter = (user.wallet.deposit_balance || 0) + user.wallet.winning_balance;

        // Update withdrawal status to cancelled
        withdrawal.status = 'cancelled';
        withdrawal.processed_at = new Date();
        withdrawal.admin_notes = 'Cancelled by user';
        await withdrawal.save();

        // Create wallet transaction record for refund
        await WalletTransaction.create({
            user_id,
            type: 'refund',
            amount: withdrawal.amount,
            balance_before: totalBalanceBefore,
            balance_after: totalBalanceAfter,
            description: `Withdrawal cancellation refund (back to winning balance)`,
            reference_id: withdrawal_id,
            reference_type: 'withdrawal',
            payment_method: withdrawal.withdrawal_method === 'upi' ? 'upi' : 'bank_transfer',
            status: 'completed'
        });

        res.json({
            success: true,
            message: 'Withdrawal cancelled successfully. Amount refunded to winning balance.',
            refunded_amount: withdrawal.amount,
            winning_balance: user.wallet.winning_balance,
            total_balance: totalBalanceAfter
        });

    } catch (error) {
        console.error('Cancel Withdrawal Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling withdrawal',
            error: error.message
        });
    }
};

// Admin: Process withdrawal
export const processWithdrawal = async (req, res) => {
    try {
        const { withdrawal_id } = req.params;
        const { status, admin_notes, rejection_reason } = req.body;

        if (!status || !['completed', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be either "completed" or "rejected"'
            });
        }

        const withdrawal = await Withdrawal.findById(withdrawal_id)
            .populate('user_id');

        if (!withdrawal) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        if (withdrawal.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Withdrawal request has already been processed'
            });
        }

        // Update withdrawal status
        withdrawal.status = status;
        withdrawal.admin_notes = admin_notes || '';
        withdrawal.processed_at = new Date();

        const user = withdrawal.user_id;

        if (status === 'rejected') {
            withdrawal.rejection_reason = rejection_reason || 'Request rejected';

            // Initialize wallet if needed
            if (!user.wallet) {
                user.wallet = {
                    deposit_balance: 0,
                    winning_balance: 0,
                    total_deposited: 0,
                    total_earned: 0,
                    total_withdrawn: 0
                };
            }

            // Record total balance before refund
            const totalBalanceBefore = (user.wallet.deposit_balance || 0) + (user.wallet.winning_balance || 0);

            // Refund amount back to WINNING balance on rejection
            user.wallet.winning_balance = (user.wallet.winning_balance || 0) + withdrawal.amount;
            await user.save();

            const totalBalanceAfter = (user.wallet.deposit_balance || 0) + user.wallet.winning_balance;

            // Create wallet transaction record for refund
            await WalletTransaction.create({
                user_id: user._id,
                type: 'refund',
                amount: withdrawal.amount,
                balance_before: totalBalanceBefore,
                balance_after: totalBalanceAfter,
                description: `Withdrawal rejection refund - ${rejection_reason || 'Request rejected'}`,
                reference_id: withdrawal_id,
                reference_type: 'withdrawal',
                payment_method: withdrawal.withdrawal_method === 'upi' ? 'upi' : 'bank_transfer',
                status: 'completed'
            });
        } else if (status === 'completed') {
            // Amount already deducted from winning_balance, just update total_withdrawn
            user.wallet.total_withdrawn = (user.wallet.total_withdrawn || 0) + withdrawal.amount;
            await user.save();

            // Update the original withdrawal transaction status
            await WalletTransaction.findOneAndUpdate(
                { reference_id: withdrawal_id, reference_type: 'withdrawal' },
                { status: 'completed' }
            );
        }

        await withdrawal.save();

        res.json({
            success: true,
            message: `Withdrawal request ${status} successfully`,
            withdrawal: {
                id: withdrawal._id,
                amount: withdrawal.amount,
                status: withdrawal.status,
                processed_at: withdrawal.processed_at,
                admin_notes: withdrawal.admin_notes
            }
        });

    } catch (error) {
        console.error('Process Withdrawal Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing withdrawal',
            error: error.message
        });
    }
};
