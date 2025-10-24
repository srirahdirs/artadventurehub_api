import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    endpoint: {
        type: String,
        required: true,
        unique: true
    },
    keys: {
        p256dh: {
            type: String,
            required: true
        },
        auth: {
            type: String,
            required: true
        }
    },
    user_agent: String,
    device_type: {
        type: String,
        enum: ['mobile', 'desktop', 'tablet', 'unknown'],
        default: 'unknown'
    },
    browser: String,
    created_at: {
        type: Date,
        default: Date.now
    },
    last_used: {
        type: Date,
        default: Date.now
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for faster lookups
pushSubscriptionSchema.index({ user_id: 1 });
pushSubscriptionSchema.index({ endpoint: 1 });
pushSubscriptionSchema.index({ active: 1 });
pushSubscriptionSchema.index({ user_id: 1, active: 1 });

// Method to mark subscription as inactive
pushSubscriptionSchema.methods.deactivate = async function () {
    this.active = false;
    await this.save();
};

// Method to update last used timestamp
pushSubscriptionSchema.methods.updateLastUsed = async function () {
    this.last_used = Date.now();
    await this.save();
};

export default mongoose.model('PushSubscription', pushSubscriptionSchema);

