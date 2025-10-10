import mongoose from 'mongoose';
import Campaign from '../models/Campaign.js';
import dotenv from 'dotenv';

dotenv.config();

const testCampaign = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Create a sample campaign
        const campaign = new Campaign({
            name: 'Tajmahal Campaign',
            description: 'Paint the iconic Taj Mahal and showcase your artistic skills! Best artwork wins amazing prizes.',
            reference_image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Taj_Mahal%2C_Agra%2C_India_edit3.jpg/800px-Taj_Mahal%2C_Agra%2C_India_edit3.jpg',
            max_participants: 20,
            entry_fee: {
                amount: 100,
                type: 'rupees'
            },
            prizes: {
                first_prize: 1000,
                second_prize: 500,
                platform_share: 500
            },
            status: 'active',
            start_date: new Date('2025-10-15'),
            end_date: new Date('2025-10-30'),
            submission_deadline: new Date('2025-10-28'),
            result_date: new Date('2025-11-01'),
            rules: '1. Submit original artwork only\n2. Follow the Taj Mahal theme\n3. Any medium allowed (pencil, colors, digital)\n4. One submission per participant',
            category: 'drawing',
            age_group: 'all',
            created_by: 'Admin'
        });

        await campaign.save();

        console.log('✅ Campaign Created Successfully!\n');
        console.log('📋 Campaign Details:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Name: ${campaign.name}`);
        console.log(`ID: ${campaign._id}`);
        console.log(`Max Participants: ${campaign.max_participants}`);
        console.log(`Entry Fee: ₹${campaign.entry_fee.amount} (${campaign.entry_fee.type})`);
        console.log(`\n💰 Prizes:`);
        console.log(`  🥇 First Prize: ₹${campaign.prizes.first_prize}`);
        console.log(`  🥈 Second Prize: ₹${campaign.prizes.second_prize}`);
        console.log(`  🏢 Platform Share: ₹${campaign.prizes.platform_share}`);
        console.log(`\n📅 Important Dates:`);
        console.log(`  Start: ${campaign.start_date.toLocaleDateString()}`);
        console.log(`  End: ${campaign.end_date.toLocaleDateString()}`);
        console.log(`  Submission Deadline: ${campaign.submission_deadline.toLocaleDateString()}`);
        console.log(`  Result: ${campaign.result_date.toLocaleDateString()}`);
        console.log(`\n📊 Status: ${campaign.status.toUpperCase()}`);
        console.log(`🎨 Category: ${campaign.category}`);
        console.log(`👥 Age Group: ${campaign.age_group}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // List all campaigns
        const allCampaigns = await Campaign.find();
        console.log(`\n📌 Total Campaigns in Database: ${allCampaigns.length}\n`);

        allCampaigns.forEach((camp, index) => {
            console.log(`${index + 1}. ${camp.name} - ${camp.status} (${camp.current_participants}/${camp.max_participants} participants)`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

testCampaign();

