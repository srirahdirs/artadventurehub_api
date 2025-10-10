import mongoose from 'mongoose';
import Campaign from '../models/Campaign.js';
import dotenv from 'dotenv';

dotenv.config();

const checkCampaigns = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        const allCampaigns = await Campaign.find();

        console.log(`📊 Total Campaigns: ${allCampaigns.length}\n`);

        if (allCampaigns.length === 0) {
            console.log('❌ No campaigns found in database!');
            console.log('Create a campaign in admin panel first.\n');
        } else {
            console.log('📋 All Campaigns:\n');
            allCampaigns.forEach((camp, index) => {
                console.log(`${index + 1}. ${camp.name}`);
                console.log(`   ID: ${camp._id}`);
                console.log(`   Status: ${camp.status} ${camp.status === 'active' ? '✅' : '⚠️'}`);
                console.log(`   Participants: ${camp.current_participants}/${camp.max_participants}`);
                console.log(`   Entry Fee: ₹${camp.entry_fee.amount}`);
                console.log('');
            });

            const activeCampaigns = allCampaigns.filter(c => c.status === 'active');
            console.log(`\n✅ Active Campaigns (visible to users): ${activeCampaigns.length}`);

            if (activeCampaigns.length === 0) {
                console.log('\n⚠️  No active campaigns!');
                console.log('💡 To make campaigns visible to users:');
                console.log('   1. Go to Admin Panel → Campaign Management');
                console.log('   2. Click "Activate" button on a campaign');
                console.log('   OR change status from "draft" to "active"');
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

checkCampaigns();

