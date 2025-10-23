import mongoose from 'mongoose';

const campaignSubmissionSchema = new mongoose.Schema({
    campaign_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    submission_image: {
        type: String, // URL or path to user's artwork
        required: true
    },
    title: {
        type: String,
        trim: true,
        default: ''
    },
    description: {
        type: String,
        default: ''
    },
    payment_status: {
        type: String,
        enum: ['pending', 'paid', 'refunded'],
        default: 'pending'
    },
    payment_method: {
        type: String,
        enum: ['rupees', 'points', 'wallet'],
        default: 'wallet'
    },
    payment_amount: {
        type: Number,
        required: true
    },
    original_amount: {
        type: Number,
        default: null
    },
    discount_amount: {
        type: Number,
        default: 0
    },
    coupon_code: {
        type: String,
        default: null,
        uppercase: true
    },
    transaction_id: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'winner', 'runner_up'],
        default: 'submitted'
    },
    is_draft: {
        type: Boolean,
        default: false
    },
    draft_saved_at: {
        type: Date,
        default: null
    },
    draft_reminder_sent: {
        type: Date,
        default: null
    },
    draft_reminder_count: {
        type: Number,
        default: 0
    },
    votes: {
        type: Number,
        default: 0
    },
    voted_by: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    likes: {
        type: Number,
        default: 0
    },
    liked_by: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    admin_rating: {
        type: Number,
        min: 0,
        max: 10,
        default: 0
    },
    admin_notes: {
        type: String,
        default: ''
    },
    prize_won: {
        amount: {
            type: Number,
            default: 0
        },
        position: {
            type: String,
            enum: ['first', 'second', 'none'],
            default: 'none'
        }
    },
    submitted_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index to ensure one PAID submission per user per campaign
// Partial index: only applies to paid submissions (is_draft: false), allows multiple drafts
campaignSubmissionSchema.index(
    { campaign_id: 1, user_id: 1 },
    {
        unique: true,
        partialFilterExpression: { is_draft: false }
    }
);

// Index for faster lookups
campaignSubmissionSchema.index({ status: 1 });
campaignSubmissionSchema.index({ campaign_id: 1, admin_rating: -1 });

export default mongoose.model('CampaignSubmission', campaignSubmissionSchema);

