import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
    referrer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    referred_user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    referral_code: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed'],
        default: 'pending'
        // pending = user signed up
        // completed = user joined first campaign (points awarded)
    },
    points_awarded: {
        type: Number,
        default: 0
    },
    completed_at: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Index for faster queries
referralSchema.index({ referrer_id: 1 });
referralSchema.index({ referred_user_id: 1 });
referralSchema.index({ referral_code: 1 });

export default mongoose.model('Referral', referralSchema);

