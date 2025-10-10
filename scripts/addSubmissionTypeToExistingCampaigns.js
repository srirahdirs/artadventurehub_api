import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

async function addSubmissionType() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const Campaign = (await import('../models/Campaign.js')).default;

        // Find all campaigns without submission_type
        const campaignsWithoutType = await Campaign.find({
            $or: [
                { submission_type: { $exists: false } },
                { submission_type: null }
            ]
        });

        console.log(`\nFound ${campaignsWithoutType.length} campaigns without submission_type`);

        if (campaignsWithoutType.length === 0) {
            console.log('✅ All campaigns already have submission_type field');
            process.exit(0);
        }

        // Update each campaign to have default submission_type = 'offline'
        let updated = 0;
        for (const campaign of campaignsWithoutType) {
            campaign.submission_type = 'offline'; // Default to offline (print & paint)
            await campaign.save();
            updated++;
            console.log(`✅ Updated campaign: ${campaign.name} -> submission_type: offline`);
        }

        console.log(`\n✅ Successfully updated ${updated} campaigns`);
        console.log('\n📝 Note: All existing campaigns are set to "offline" (Paint by Hand).');
        console.log('   You can change them to "digital" or "both" in the admin panel if needed.\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

addSubmissionType();

