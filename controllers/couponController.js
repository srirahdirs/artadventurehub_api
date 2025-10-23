import Coupon from '../models/Coupon.js';
import Campaign from '../models/Campaign.js';

// Create a new coupon
export const createCoupon = async (req, res) => {
    try {
        const {
            code,
            description,
            discount_type,
            discount_value,
            min_purchase_amount,
            max_discount_amount,
            expiry_date,
            usage_limit,
            applicable_campaigns
        } = req.body;

        // Validate required fields
        if (!code || !description || !discount_type || discount_value === undefined || !expiry_date) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Check if coupon code already exists
        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code already exists'
            });
        }

        // Validate discount value
        if (discount_type === 'percentage' && (discount_value < 0 || discount_value > 100)) {
            return res.status(400).json({
                success: false,
                message: 'Percentage discount must be between 0 and 100'
            });
        }

        // Create new coupon
        const coupon = new Coupon({
            code: code.toUpperCase(),
            description,
            discount_type,
            discount_value,
            min_purchase_amount: min_purchase_amount || 0,
            max_discount_amount: max_discount_amount || null,
            expiry_date: new Date(expiry_date),
            usage_limit: usage_limit || null,
            applicable_campaigns: applicable_campaigns || []
        });

        await coupon.save();

        res.status(201).json({
            success: true,
            message: 'Coupon created successfully',
            coupon
        });
    } catch (error) {
        console.error('Create coupon error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create coupon',
            error: error.message
        });
    }
};

// Get all coupons
export const getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find()
            .populate('applicable_campaigns', 'name')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            coupons
        });
    } catch (error) {
        console.error('Get coupons error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch coupons',
            error: error.message
        });
    }
};

// Get active coupons only
export const getActiveCoupons = async (req, res) => {
    try {
        const now = new Date();
        const coupons = await Coupon.find({
            is_active: true,
            expiry_date: { $gte: now }
        })
            .populate('applicable_campaigns', 'name')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            coupons
        });
    } catch (error) {
        console.error('Get active coupons error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch active coupons',
            error: error.message
        });
    }
};

// Get coupon by ID
export const getCouponById = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findById(id)
            .populate('applicable_campaigns', 'name');

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        res.json({
            success: true,
            coupon
        });
    } catch (error) {
        console.error('Get coupon error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch coupon',
            error: error.message
        });
    }
};

// Update coupon
export const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Don't allow changing the code
        delete updateData.code;
        // Don't allow direct manipulation of used_count
        delete updateData.used_count;

        const coupon = await Coupon.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('applicable_campaigns', 'name');

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        res.json({
            success: true,
            message: 'Coupon updated successfully',
            coupon
        });
    } catch (error) {
        console.error('Update coupon error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update coupon',
            error: error.message
        });
    }
};

// Delete coupon
export const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findByIdAndDelete(id);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        res.json({
            success: true,
            message: 'Coupon deleted successfully'
        });
    } catch (error) {
        console.error('Delete coupon error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete coupon',
            error: error.message
        });
    }
};

// Validate and apply coupon
export const validateCoupon = async (req, res) => {
    try {
        const { code, campaign_id, amount } = req.body;

        if (!code || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code and amount are required'
            });
        }

        // Find the coupon
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Invalid coupon code'
            });
        }

        // Check if coupon is active
        if (!coupon.is_active) {
            return res.status(400).json({
                success: false,
                message: 'This coupon is no longer active'
            });
        }

        // Check expiry date
        const now = new Date();
        if (coupon.expiry_date < now) {
            return res.status(400).json({
                success: false,
                message: 'This coupon has expired'
            });
        }

        // Check usage limit
        if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
            return res.status(400).json({
                success: false,
                message: 'This coupon has reached its usage limit'
            });
        }

        // Check minimum purchase amount
        if (amount < coupon.min_purchase_amount) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase amount of ₹${coupon.min_purchase_amount} required`
            });
        }

        // Check if coupon is applicable to this campaign
        if (campaign_id && coupon.applicable_campaigns.length > 0) {
            const isApplicable = coupon.applicable_campaigns.some(
                campaignId => campaignId.toString() === campaign_id
            );

            if (!isApplicable) {
                return res.status(400).json({
                    success: false,
                    message: 'This coupon is not applicable to this campaign'
                });
            }
        }

        // Calculate discount
        const discountAmount = coupon.calculateDiscount(amount);
        const finalAmount = amount - discountAmount;

        res.json({
            success: true,
            message: 'Coupon applied successfully',
            coupon: {
                code: coupon.code,
                description: coupon.description,
                discount_type: coupon.discount_type,
                discount_value: coupon.discount_value
            },
            original_amount: amount,
            discount_amount: discountAmount,
            final_amount: finalAmount
        });
    } catch (error) {
        console.error('Validate coupon error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate coupon',
            error: error.message
        });
    }
};

// Apply coupon (increment usage count)
export const applyCoupon = async (req, res) => {
    try {
        const { code } = req.body;

        const coupon = await Coupon.findOne({ code: code.toUpperCase() });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        await coupon.incrementUsage();

        res.json({
            success: true,
            message: 'Coupon applied successfully',
            used_count: coupon.used_count
        });
    } catch (error) {
        console.error('Apply coupon error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to apply coupon',
            error: error.message
        });
    }
};

// Toggle coupon status
export const toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        coupon.is_active = !coupon.is_active;
        await coupon.save();

        res.json({
            success: true,
            message: `Coupon ${coupon.is_active ? 'activated' : 'deactivated'} successfully`,
            coupon
        });
    } catch (error) {
        console.error('Toggle coupon status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle coupon status',
            error: error.message
        });
    }
};


