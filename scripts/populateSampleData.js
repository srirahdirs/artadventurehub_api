import mongoose from 'mongoose';
import Campaign from '../models/Campaign.js';
import CampaignSubmission from '../models/CampaignSubmission.js';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const populateData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Create sample campaigns
        const campaigns = [
            {
                name: 'Tajmahal Drawing Competition',
                description: 'Paint the iconic Taj Mahal and showcase your artistic skills!',
                reference_image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Taj_Mahal%2C_Agra%2C_India_edit3.jpg/800px-Taj_Mahal%2C_Agra%2C_India_edit3.jpg',
                max_participants: 20,
                entry_fee: { amount: 100, type: 'rupees' },
                prizes: { first_prize: 1000, second_prize: 500, platform_share: 500 },
                status: 'active',
                category: 'drawing',
                age_group: 'all',
                created_by: 'Admin'
            },
            {
                name: 'Nature Coloring Contest',
                description: 'Color beautiful nature scenes and win exciting prizes!',
                reference_image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
                max_participants: 30,
                entry_fee: { amount: 50, type: 'rupees' },
                prizes: { first_prize: 800, second_prize: 400, platform_share: 300 },
                status: 'active',
                category: 'coloring',
                age_group: 'all',
                created_by: 'Admin'
            },
            {
                name: 'Superhero Drawing Challenge',
                description: 'Draw your favorite superhero and compete with other artists!',
                reference_image: 'https://images.unsplash.com/photo-1635863138275-d9b33299680b?w=800',
                max_participants: 25,
                entry_fee: { amount: 75, type: 'rupees' },
                prizes: { first_prize: 1200, second_prize: 600, platform_share: 450 },
                status: 'active',
                category: 'drawing',
                age_group: 'all',
                created_by: 'Admin'
            }
        ];

        console.log('📝 Creating sample campaigns...\n');
        const createdCampaigns = await Campaign.insertMany(campaigns);
        console.log(`✅ Created ${createdCampaigns.length} campaigns\n`);

        createdCampaigns.forEach((camp, index) => {
            console.log(`${index + 1}. ${camp.name}`);
            console.log(`   ID: ${camp._id}`);
            console.log(`   Entry: ₹${camp.entry_fee.amount} | Prize: ₹${camp.prizes.first_prize}`);
            console.log('');
        });

        // Get existing users to create sample submissions
        const users = await User.find().limit(3);

        if (users.length > 0) {
            console.log('\n📸 Creating sample submissions for feed...\n');

            const sampleSubmissions = [];

            // Create submissions for each campaign
            createdCampaigns.forEach((campaign, campIndex) => {
                users.forEach((user, userIndex) => {
                    if (campIndex + userIndex < 4) { // Create a few submissions
                        sampleSubmissions.push({
                            campaign_id: campaign._id,
                            user_id: user._id,
                            submission_image: `https://via.placeholder.com/600x400/a78bfa/ffffff?text=Artwork+by+${user.username || 'User'}`,
                            title: `My ${campaign.name} Artwork`,
                            description: 'Created with passion and creativity!',
                            payment_status: 'paid',
                            payment_method: campaign.entry_fee.type,
                            payment_amount: campaign.entry_fee.amount,
                            status: 'approved',
                            votes: Math.floor(Math.random() * 50),
                            likes: Math.floor(Math.random() * 100),
                            admin_rating: Math.floor(Math.random() * 5) + 5,
                            submitted_at: new Date()
                        });
                    }
                });
            });

            await CampaignSubmission.insertMany(sampleSubmissions);
            console.log(`✅ Created ${sampleSubmissions.length} sample submissions\n`);
        }

        console.log('🎉 Sample data populated successfully!');
        console.log('\n📊 Summary:');
        console.log(`   Campaigns: ${createdCampaigns.length}`);
        console.log(`   Sample Submissions: ${users.length > 0 ? users.length * 2 : 0}`);
        console.log('\n✨ You can now view the social feed in the app!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

populateData();

