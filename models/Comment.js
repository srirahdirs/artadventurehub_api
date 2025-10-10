import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
    submission_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CampaignSubmission',
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    likes: {
        type: Number,
        default: 0
    },
    liked_by: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    is_reported: {
        type: Boolean,
        default: false
    },
    is_approved: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for efficient queries
commentSchema.index({ submission_id: 1, created_at: -1 });
commentSchema.index({ user_id: 1 });

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;
