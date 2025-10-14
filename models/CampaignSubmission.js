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
        enum: ['rupees', 'points'],
        default: 'rupees'
    },
    payment_amount: {
        type: Number,
        required: true
    },
    transaction_id: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['submitted', 'under_review', 'approved', 'rejected', 'winner', 'runner_up'],
        default: 'submitted'
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

// Compound index to ensure one submission per user per campaign
campaignSubmissionSchema.index({ campaign_id: 1, user_id: 1 }, { unique: true });

// Index for faster lookups
campaignSubmissionSchema.index({ status: 1 });
campaignSubmissionSchema.index({ campaign_id: 1, admin_rating: -1 });

export default mongoose.model('CampaignSubmission', campaignSubmissionSchema);

