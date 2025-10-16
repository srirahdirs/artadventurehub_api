import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/artadventurehub';

async function updateIndex() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('campaignsubmissions');

        // Get existing indexes
        const indexes = await collection.indexes();
        console.log('\n📋 Current indexes:', JSON.stringify(indexes, null, 2));

        // Drop the old unique index
        try {
            await collection.dropIndex('campaign_id_1_user_id_1');
            console.log('✅ Dropped old unique index: campaign_id_1_user_id_1');
        } catch (err) {
            console.log('⚠️  Old index not found or already dropped:', err.message);
        }

        // Create new partial unique index
        await collection.createIndex(
            { campaign_id: 1, user_id: 1 },
            {
                unique: true,
                partialFilterExpression: { is_draft: false },
                name: 'campaign_user_unique_paid'
            }
        );
        console.log('✅ Created new partial unique index for paid submissions only');

        // Verify new indexes
        const newIndexes = await collection.indexes();
        console.log('\n📋 Updated indexes:', JSON.stringify(newIndexes, null, 2));

        console.log('\n🎉 Index migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating index:', error);
        process.exit(1);
    }
}

updateIndex();

