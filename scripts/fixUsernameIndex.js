import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const fixUsernameIndex = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // 1. Drop the existing username index
        try {
            await usersCollection.dropIndex('username_1');
            console.log('✅ Dropped old username_1 index');
        } catch (err) {
            console.log('ℹ️  username_1 index does not exist or already dropped');
        }

        // 2. Delete all users with null username (keep only one if needed)
        const usersWithNullUsername = await usersCollection.find({ username: null }).toArray();
        console.log(`Found ${usersWithNullUsername.length} users with null username`);

        if (usersWithNullUsername.length > 0) {
            // Unset username field for all users with null username
            const result = await usersCollection.updateMany(
                { username: null },
                { $unset: { username: '' } }
            );
            console.log(`✅ Updated ${result.modifiedCount} users - removed null username field`);
        }

        // 3. Create new sparse unique index
        await usersCollection.createIndex(
            { username: 1 },
            { unique: true, sparse: true }
        );
        console.log('✅ Created new sparse unique index on username');

        // 4. Verify the fix
        const allUsers = await usersCollection.find({}).toArray();
        console.log(`\n📊 Total users: ${allUsers.length}`);
        allUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.mobile_number} - username: ${user.username === undefined ? 'undefined' : user.username}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

fixUsernameIndex();

