import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';

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

        if (user.wallet.balance < amount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient wallet balance. Available: ₹${user.wallet.balance}`
            });
        }

        if (amount < 100) {
            return res.status(400).json({
                success: false,
                message: 'Minimum withdrawal amount is ₹100'
            });
        }

        // Create withdrawal request
        const withdrawal = new Withdrawal({
            user_id,
            amount,
            withdrawal_method,
            withdrawal_details
        });

        await withdrawal.save();

        // Update user's withdrawal details for future use
        if (withdrawal_method === 'upi') {
            user.withdrawal_details.upi_id = withdrawal_details.upi_id;
        } else if (withdrawal_method === 'bank') {
            user.withdrawal_details.bank_details = withdrawal_details.bank_details;
        }
        await user.save();

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

        if (status === 'rejected') {
            withdrawal.rejection_reason = rejection_reason || 'Request rejected';
        } else if (status === 'completed') {
            // Deduct amount from user's wallet
            const user = withdrawal.user_id;
            user.wallet.balance -= withdrawal.amount;
            user.wallet.total_withdrawn += withdrawal.amount;
            await user.save();
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
