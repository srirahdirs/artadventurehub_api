import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function checkData() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        const Campaign = (await import('../models/Campaign.js')).default;

        // Get all campaigns
        const campaigns = await Campaign.find({});

        console.log(`Found ${campaigns.length} campaigns:\n`);

        campaigns.forEach((campaign, index) => {
            console.log(`${index + 1}. ${campaign.name}`);
            console.log(`   ID: ${campaign._id}`);
            console.log(`   Status: ${campaign.status}`);
            console.log(`   Category: ${campaign.category}`);
            console.log(`   Submission Type: ${campaign.submission_type || 'UNDEFINED'}`);
            console.log(`   Created: ${campaign.createdAt}`);
            console.log('');
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkData();

