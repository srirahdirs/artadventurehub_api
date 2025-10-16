import User from '../models/User.js';
import WalletTransaction from '../models/WalletTransaction.js';
import crypto from 'crypto';
import Razorpay from 'razorpay';

// Get Razorpay credentials from environment variables or use defaults
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_live_RU7c0QfYUF6xe9';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'JejHML2EzTycLHHW1HFqelty';

// Validate Razorpay credentials
if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error('❌ ERROR: Razorpay API keys not found!');
    console.error('📝 Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file');
    console.error('🔗 Get your keys from: https://dashboard.razorpay.com/app/keys');
}

console.log('🔑 Razorpay initialized with Key ID:', RAZORPAY_KEY_ID);

// Initialize Razorpay instance
const razorpayInstance = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET
});

// Create Razorpay order for wallet top-up
export const createWalletTopupOrder = async (req, res) => {
    try {
        const { user_id, amount } = req.body;

        if (!user_id || !amount) {
            return res.status(400).json({
                success: false,
                message: 'User ID and amount are required'
            });
        }

        const topupAmount = parseFloat(amount);
        if (topupAmount < 10) {
            return res.status(400).json({
                success: false,
                message: 'Minimum top-up amount is ₹10'
            });
        }

        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Amount in paise (Razorpay requires amount in smallest currency unit)
        const amountInPaise = Math.round(topupAmount * 100);

        // Create a REAL Razorpay order through their API
        // Receipt must be ≤ 40 characters
        const timestamp = Date.now().toString().slice(-10); // Last 10 digits
        const userIdShort = user_id.toString().slice(-8); // Last 8 chars of user ID
        const receipt = `wlt_${userIdShort}_${timestamp}`; // Format: wlt_12345678_1234567890 (29 chars max)

        const orderOptions = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: receipt,
            notes: {
                user_id: user_id.toString(),
                purpose: 'Wallet Top-up',
                username: user.username || 'User'
            }
        };

        console.log('🔑 Creating Razorpay order with Key ID:', RAZORPAY_KEY_ID);
        console.log('💰 Order Options:', orderOptions);

        // Validate Razorpay credentials first
        if (RAZORPAY_KEY_ID === 'rzp_test_RTLfVuh0oeGyG5') {
            console.warn('⚠️  WARNING: Using placeholder Razorpay keys!');
            console.warn('📝 Get real test keys from: https://dashboard.razorpay.com/app/keys');
        }

        // Create order via Razorpay API
        const razorpayOrder = await razorpayInstance.orders.create(orderOptions);

        console.log('✅ Razorpay order created successfully:', razorpayOrder.id);

        res.json({
            success: true,
            order: {
                id: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                key_id: RAZORPAY_KEY_ID
            },
            user: {
                name: user.username || 'User',
                email: user.email || '',
                contact: user.mobile_number
            }
        });

    } catch (error) {
        console.error('Create Wallet Topup Order Error:', error);

        // Provide specific error messages for common issues
        let errorMessage = 'Error creating wallet top-up order';

        if (error.statusCode === 400) {
            if (error.error?.description?.includes('receipt')) {
                errorMessage = 'Receipt format error. Please try again.';
            } else if (error.error?.description?.includes('amount')) {
                errorMessage = 'Invalid amount. Minimum ₹10 required.';
            } else {
                errorMessage = 'Invalid payment details. Please check your information.';
            }
        } else if (error.statusCode === 401) {
            errorMessage = 'Invalid Razorpay API keys. Please contact support.';
        } else if (error.statusCode === 403) {
            errorMessage = 'Payment service temporarily unavailable. Please try again later.';
        }

        res.status(500).json({
            success: false,
            message: errorMessage,
            error: error.message,
            note: 'If this persists, please contact support or try with different payment details.'
        });
    }
};

// Verify Razorpay payment and add money to wallet
export const verifyWalletTopup = async (req, res) => {
    try {
        const {
            user_id,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            amount
        } = req.body;

        if (!user_id || !razorpay_payment_id || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Missing required payment details'
            });
        }

        // Verify signature
        if (razorpay_order_id && razorpay_signature) {
            const sign = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSign = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
                .update(sign.toString())
                .digest('hex');

            if (razorpay_signature !== expectedSign) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payment signature'
                });
            }
        }

        // Get user and add money to wallet
        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const topupAmount = parseFloat(amount);

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

        // Record balances before transaction
        const depositBalanceBefore = user.wallet.deposit_balance || 0;
        const totalBalance = (user.wallet.deposit_balance || 0) + (user.wallet.winning_balance || 0);

        // Add money to DEPOSIT balance (non-withdrawable)
        user.wallet.deposit_balance = depositBalanceBefore + topupAmount;
        user.wallet.total_deposited = (user.wallet.total_deposited || 0) + topupAmount;
        await user.save();

        const newTotalBalance = user.wallet.deposit_balance + (user.wallet.winning_balance || 0);

        // Create transaction record
        await WalletTransaction.create({
            user_id,
            type: 'deposit',
            amount: topupAmount,
            balance_before: totalBalance,
            balance_after: newTotalBalance,
            description: `Deposit via Razorpay (Non-withdrawable - Use for contests only)`,
            reference_type: 'topup',
            payment_method: 'razorpay',
            transaction_id: razorpay_payment_id,
            status: 'completed'
        });

        res.json({
            success: true,
            message: `₹${topupAmount} added to deposit balance! Use it to enter contests and win prizes.`,
            wallet: {
                deposit_balance: user.wallet.deposit_balance,
                winning_balance: user.wallet.winning_balance,
                total_balance: newTotalBalance,
                total_deposited: user.wallet.total_deposited,
                total_earned: user.wallet.total_earned,
                total_withdrawn: user.wallet.total_withdrawn
            },
            payment: {
                payment_id: razorpay_payment_id,
                order_id: razorpay_order_id,
                amount: topupAmount
            }
        });

    } catch (error) {
        console.error('Verify Wallet Topup Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying wallet top-up',
            error: error.message
        });
    }
};

// Get wallet transaction history
export const getWalletTransactions = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { page = 1, limit = 20, type } = req.query;

        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Build query filter
        const filter = { user_id };
        if (type && type !== 'all') {
            filter.type = type;
        }

        // Get transactions with pagination
        const transactions = await WalletTransaction.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await WalletTransaction.countDocuments(filter);

        res.json({
            success: true,
            transactions,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            },
            wallet: user.wallet || {
                deposit_balance: 0,
                winning_balance: 0,
                total_deposited: 0,
                total_earned: 0,
                total_withdrawn: 0
            }
        });

    } catch (error) {
        console.error('Get Wallet Transactions Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching wallet transactions',
            error: error.message
        });
    }
};

