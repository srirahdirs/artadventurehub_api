import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    reference_image: {
        type: String, // URL or path to the image users need to paint
        required: true
    },
    max_participants: {
        type: Number,
        required: true,
        default: 20
    },
    current_participants: {
        type: Number,
        default: 0
    },
    campaign_type: {
        type: String,
        enum: ['premium', 'point-based'], // premium: must pay money only, point-based: pay money OR use points
        default: 'premium',
        required: true
    },
    entry_fee: {
        amount: {
            type: Number,
            required: true,
            default: 100
        },
        type: {
            type: String,
            enum: ['rupees', 'points'], // Payment type: cash or gamification points
            default: 'rupees'
        }
    },
    points_required: {
        type: Number,
        default: 500, // Points needed to join point-based campaigns
        min: 0
    },
    prizes: {
        first_prize: {
            type: Number,
            required: true,
            default: 1000
        },
        second_prize: {
            type: Number,
            required: true,
            default: 500
        },
        platform_share: {
            type: Number,
            required: true,
            default: 500
        }
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'completed', 'cancelled'],
        default: 'draft'
    },
    start_date: {
        type: Date,
        default: null
    },
    end_date: {
        type: Date,
        default: null
    },
    submission_deadline: {
        type: Date,
        default: null
    },
    result_date: {
        type: Date,
        default: null
    },
    rules: {
        type: String,
        default: ''
    },
    category: {
        type: String,
        enum: ['drawing', 'coloring', 'painting', 'mixed'],
        default: 'drawing'
    },
    age_group: {
        type: String,
        enum: ['kids', 'teens', 'adults', 'all'],
        default: 'all'
    },
    submission_type: {
        type: String,
        enum: ['offline', 'digital', 'both'], // offline: print & paint, digital: paint on platform, both: user choice
        default: 'offline',
        required: true
    },
    created_by: {
        type: String,
        required: true,
        default: 'Admin'
    }
}, {
    timestamps: true
});

// Calculate total prize pool
campaignSchema.virtual('total_prize_pool').get(function () {
    return this.prizes.first_prize + this.prizes.second_prize + this.prizes.platform_share;
});

// Check if campaign is full
campaignSchema.virtual('is_full').get(function () {
    return this.current_participants >= this.max_participants;
});

// Check if campaign is ongoing
campaignSchema.virtual('is_ongoing').get(function () {
    const now = new Date();
    return this.status === 'active' &&
        (!this.start_date || this.start_date <= now) &&
        (!this.end_date || this.end_date >= now);
});

// Index for faster lookups
campaignSchema.index({ status: 1, start_date: -1 });
campaignSchema.index({ category: 1 });

export default mongoose.model('Campaign', campaignSchema);

