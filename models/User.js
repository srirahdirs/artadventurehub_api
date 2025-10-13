import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    mobile_number: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        match: /^[6-9]\d{9}$/ // Indian mobile number validation
    },
    username: {
        type: String,
        trim: true,
        unique: true,
        sparse: true, // Allows multiple undefined values but ensures unique non-null values
        default: undefined
    },
    password: {
        type: String,
        default: undefined
    },
    bio: {
        type: String,
        trim: true,
        maxlength: 200,
        default: ''
    },
    avatar: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['verified', 'not_verified'],
        default: 'not_verified'
    },
    // Referral & Points System
    referral_code: {
        type: String,
        unique: true,
        sparse: true
    },
    referred_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    points: {
        type: Number,
        default: 0,
        min: 0
    },
    contests_participated: {
        type: Number,
        default: 0,
        min: 0
    },
    total_referrals: {
        type: Number,
        default: 0
    },
    successful_referrals: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true // This will add createdAt and updatedAt fields
});

// Generate unique referral code
const generateReferralCode = () => {
    return 'ART' + Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Convert empty fields to undefined and hash password before saving
userSchema.pre('save', async function (next) {
    if (this.username === '') {
        this.username = undefined;
    }
    if (this.password === '') {
        this.password = undefined;
    }

    // Generate referral code if new user and doesn't have one
    if (this.isNew && !this.referral_code) {
        let code = generateReferralCode();
        // Ensure uniqueness
        let exists = await mongoose.model('User').findOne({ referral_code: code });
        while (exists) {
            code = generateReferralCode();
            exists = await mongoose.model('User').findOne({ referral_code: code });
        }
        this.referral_code = code;
    }

    // Hash password if it's modified and not empty
    if (this.isModified('password') && this.password) {
        const bcrypt = (await import('bcryptjs')).default;
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    const bcrypt = (await import('bcryptjs')).default;
    return await bcrypt.compare(candidatePassword, this.password);
};

// Index for faster lookups
userSchema.index({ mobile_number: 1 });

export default mongoose.model('User', userSchema);

