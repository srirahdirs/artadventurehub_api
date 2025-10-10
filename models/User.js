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
    status: {
        type: String,
        enum: ['verified', 'not_verified'],
        default: 'not_verified'
    }
}, {
    timestamps: true // This will add createdAt and updatedAt fields
});

// Convert empty fields to undefined and hash password before saving
userSchema.pre('save', async function (next) {
    if (this.username === '') {
        this.username = undefined;
    }
    if (this.password === '') {
        this.password = undefined;
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

