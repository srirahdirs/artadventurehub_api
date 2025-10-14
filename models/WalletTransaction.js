import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['deposit', 'withdrawal', 'contest_entry', 'prize_won', 'refund', 'referral_bonus'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    balance_before: {
        type: Number,
        required: true
    },
    balance_after: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    reference_id: {
        type: String,
        default: null // For linking to specific contests, withdrawals, etc.
    },
    reference_type: {
        type: String,
        enum: ['campaign', 'withdrawal', 'topup', 'referral'],
        default: null
    },
    payment_method: {
        type: String,
        enum: ['razorpay', 'wallet', 'upi', 'bank_transfer'],
        default: null
    },
    transaction_id: {
        type: String,
        default: null // Razorpay transaction ID or other payment gateway ID
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled'],
        default: 'completed'
    },
    admin_notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Index for efficient queries
walletTransactionSchema.index({ user_id: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1, createdAt: -1 });

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);

export default WalletTransaction;
