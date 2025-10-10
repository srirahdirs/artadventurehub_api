import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function activateCampaign() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        const Campaign = (await import('../models/Campaign.js')).default;

        // Find the "Bear Latest" campaign
        const campaign = await Campaign.findOne({ name: "Bear Latest" });

        if (!campaign) {
            console.log('❌ Campaign "Bear Latest" not found');
            process.exit(1);
        }

        console.log(`Found campaign: "${campaign.name}"`);
        console.log(`Current status: ${campaign.status}`);
        console.log(`Submission type: ${campaign.submission_type}`);

        // Activate it
        campaign.status = 'active';
        await campaign.save();

        console.log(`\n✅ Campaign activated successfully!`);
        console.log(`\n🎨 Now you can see it in the frontend campaigns page!\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

activateCampaign();

