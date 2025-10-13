import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const initializeWallets = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Find all users without wallet field
        const users = await User.find({
            $or: [
                { wallet: { $exists: false } },
                { wallet: null }
            ]
        });

        console.log(`📊 Found ${users.length} users without wallet`);

        for (const user of users) {
            user.wallet = {
                balance: 0,
                total_earned: 0,
                total_withdrawn: 0
            };
            await user.save();
            console.log(`✅ Initialized wallet for user: ${user.username || user.mobile_number}`);
        }

        console.log('✅ Wallet initialization complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

initializeWallets();
