import mongoose from 'mongoose';

const withdrawalSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 1
    },
    withdrawal_method: {
        type: String,
        enum: ['upi', 'bank'],
        required: true
    },
    withdrawal_details: {
        upi_id: {
            type: String,
            trim: true
        },
        bank_details: {
            account_holder_name: {
                type: String,
                trim: true
            },
            account_number: {
                type: String,
                trim: true
            },
            ifsc_code: {
                type: String,
                trim: true
            },
            bank_name: {
                type: String,
                trim: true
            }
        }
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'rejected'],
        default: 'pending'
    },
    admin_notes: {
        type: String,
        trim: true,
        default: ''
    },
    processed_at: {
        type: Date,
        default: null
    },
    processed_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    rejection_reason: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true
});

// Index for efficient queries
withdrawalSchema.index({ user_id: 1, status: 1 });
withdrawalSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Withdrawal', withdrawalSchema);
