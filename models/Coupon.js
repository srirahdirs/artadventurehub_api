import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        index: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    discount_type: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true,
        default: 'percentage'
    },
    discount_value: {
        type: Number,
        required: true,
        min: 0
    },
    min_purchase_amount: {
        type: Number,
        default: 0,
        min: 0
    },
    max_discount_amount: {
        type: Number,
        default: null, // For percentage type, cap the maximum discount
        min: 0
    },
    expiry_date: {
        type: Date,
        required: true
    },
    usage_limit: {
        type: Number,
        default: null, // null means unlimited
        min: 0
    },
    used_count: {
        type: Number,
        default: 0,
        min: 0
    },
    is_active: {
        type: Boolean,
        default: true
    },
    applicable_campaigns: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign'
    }], // Empty array means applicable to all campaigns
    created_by: {
        type: String,
        default: 'Admin'
    }
}, {
    timestamps: true
});

// Virtual to check if coupon is valid
couponSchema.virtual('is_valid').get(function () {
    const now = new Date();
    return this.is_active &&
        this.expiry_date >= now &&
        (this.usage_limit === null || this.used_count < this.usage_limit);
});

// Method to calculate discount amount
couponSchema.methods.calculateDiscount = function (amount) {
    if (amount < this.min_purchase_amount) {
        return 0;
    }

    let discount = 0;
    if (this.discount_type === 'percentage') {
        discount = (amount * this.discount_value) / 100;
        // Cap at max_discount_amount if specified
        if (this.max_discount_amount && discount > this.max_discount_amount) {
            discount = this.max_discount_amount;
        }
    } else {
        discount = this.discount_value;
    }

    // Ensure discount doesn't exceed the amount
    return Math.min(discount, amount);
};

// Method to increment used count
couponSchema.methods.incrementUsage = async function () {
    this.used_count += 1;
    await this.save();
};

// Index for faster lookups
couponSchema.index({ code: 1 });
couponSchema.index({ is_active: 1, expiry_date: 1 });

export default mongoose.model('Coupon', couponSchema);


