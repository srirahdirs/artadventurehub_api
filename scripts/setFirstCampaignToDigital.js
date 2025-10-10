import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function setToDigital() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const Campaign = (await import('../models/Campaign.js')).default;

        // Find the first active campaign
        const campaign = await Campaign.findOne({ status: 'active' });

        if (!campaign) {
            console.log('❌ No active campaigns found');
            process.exit(1);
        }

        console.log(`\nUpdating campaign: "${campaign.name}"`);
        console.log(`Current submission_type: ${campaign.submission_type}`);

        // Update to digital
        campaign.submission_type = 'digital';
        await campaign.save();

        console.log(`✅ Updated to: digital (Digital Canvas)`);
        console.log(`\n🎨 Now you can test the digital canvas tool with this campaign!\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

setToDigital();

