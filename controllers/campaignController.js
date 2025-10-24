import mongoose from 'mongoose';
import Campaign from '../models/Campaign.js';
import CampaignSubmission from '../models/CampaignSubmission.js';
import Comment from '../models/Comment.js';
import WalletTransaction from '../models/WalletTransaction.js';
import { awardReferralPoints } from './referralController.js';

// ============ ADMIN OPERATIONS ============

// Create a new campaign (Admin)
export const createCampaign = async (req, res) => {
    try {
        console.log('📝 Creating campaign with data:', req.body);

        const {
            name,
            description,
            reference_image,
            max_participants,
            campaign_type,
            entry_fee_amount,
            entry_fee_type,
            points_required,
            first_prize,
            second_prize,
            platform_share,
            start_date,
            end_date,
            submission_deadline,
            result_date,
            rules,
            category,
            age_group,
            submission_type
        } = req.body;

        // Validate required fields
        if (!name || !reference_image) {
            return res.status(400).json({
                success: false,
                message: 'Campaign name and reference image are required'
            });
        }

        // Check MongoDB connection
        if (mongoose.connection.readyState !== 1) {
            console.error('❌ MongoDB not connected. State:', mongoose.connection.readyState);
            return res.status(500).json({
                success: false,
                message: 'Database connection error. Please try again.',
                error: 'MongoDB not connected'
            });
        }

        const campaign = new Campaign({
            name,
            description,
            reference_image,
            max_participants: max_participants || 20,
            campaign_type: campaign_type || 'premium', // premium or point-based
            entry_fee: {
                amount: entry_fee_amount || 100,
                type: entry_fee_type || 'rupees'
            },
            points_required: points_required || 500, // Points needed for point-based campaigns
            prizes: {
                first_prize: first_prize || 1000,
                second_prize: second_prize || 500,
                platform_share: platform_share || 500
            },
            start_date,
            end_date,
            submission_deadline,
            result_date,
            rules,
            category: category || 'drawing',
            age_group: age_group || 'all',
            submission_type: submission_type || 'offline',
            created_by: req.user?.username || 'Admin'
        });

        console.log('💾 Saving campaign to database...');
        await campaign.save();
        console.log('✅ Campaign saved successfully:', campaign._id);

        res.status(201).json({
            success: true,
            message: 'Campaign created successfully',
            campaign
        });
    } catch (error) {
        console.error('❌ Create Campaign Error:', error);

        // Handle specific MongoDB errors
        if (error.name === 'MongoNetworkError') {
            return res.status(500).json({
                success: false,
                message: 'Database connection error. Please check your internet connection and try again.',
                error: 'Network error'
            });
        }

        if (error.name === 'MongoTimeoutError') {
            return res.status(500).json({
                success: false,
                message: 'Database operation timed out. Please try again.',
                error: 'Timeout error'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error creating campaign',
            error: error.message
        });
    }
};

// Get all campaigns (Admin)
export const getAllCampaigns = async (req, res) => {
    try {
        const { status, category } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (category) filter.category = category;

        const campaigns = await Campaign.find(filter).sort({ createdAt: -1 });

        // Get submission counts for each campaign
        const campaignsWithCounts = await Promise.all(
            campaigns.map(async (campaign) => {
                const submissionCount = await CampaignSubmission.countDocuments({
                    campaign_id: campaign._id
                });

                return {
                    ...campaign.toObject(),
                    total_submissions: submissionCount,
                    is_full: campaign.current_participants >= campaign.max_participants
                };
            })
        );

        res.json({
            success: true,
            count: campaignsWithCounts.length,
            campaigns: campaignsWithCounts
        });
    } catch (error) {
        console.error('Get All Campaigns Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching campaigns',
            error: error.message
        });
    }
};

// Get single campaign by ID (Admin)
export const getCampaignById = async (req, res) => {
    try {
        const { id } = req.params;

        const campaign = await Campaign.findById(id);

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        // Get all submissions for this campaign
        const submissions = await CampaignSubmission.find({ campaign_id: id })
            .populate('user_id', 'username mobile_number')
            .sort({ admin_rating: -1, submitted_at: -1 });

        res.json({
            success: true,
            campaign: {
                ...campaign.toObject(),
                total_submissions: submissions.length
            },
            submissions
        });
    } catch (error) {
        console.error('Get Campaign Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching campaign',
            error: error.message
        });
    }
};

// Update campaign (Admin)
export const updateCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Handle nested entry_fee update
        if (updateData.entry_fee_amount || updateData.entry_fee_type) {
            updateData.entry_fee = {
                amount: updateData.entry_fee_amount,
                type: updateData.entry_fee_type
            };
            delete updateData.entry_fee_amount;
            delete updateData.entry_fee_type;
        }

        // Handle nested prizes update
        if (updateData.first_prize || updateData.second_prize || updateData.platform_share) {
            updateData.prizes = {
                first_prize: updateData.first_prize,
                second_prize: updateData.second_prize,
                platform_share: updateData.platform_share
            };
            delete updateData.first_prize;
            delete updateData.second_prize;
            delete updateData.platform_share;
        }

        const campaign = await Campaign.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        res.json({
            success: true,
            message: 'Campaign updated successfully',
            campaign
        });
    } catch (error) {
        console.error('Update Campaign Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating campaign',
            error: error.message
        });
    }
};

// Delete campaign (Admin)
export const deleteCampaign = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if campaign has submissions
        const submissionCount = await CampaignSubmission.countDocuments({ campaign_id: id });

        if (submissionCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete campaign with ${submissionCount} submissions. Cancel it instead.`
            });
        }

        const campaign = await Campaign.findByIdAndDelete(id);

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        res.json({
            success: true,
            message: 'Campaign deleted successfully'
        });
    } catch (error) {
        console.error('Delete Campaign Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting campaign',
            error: error.message
        });
    }
};

// Update campaign status (Admin)
export const updateCampaignStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['draft', 'active', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const campaign = await Campaign.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        res.json({
            success: true,
            message: `Campaign ${status} successfully`,
            campaign
        });
    } catch (error) {
        console.error('Update Campaign Status Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating campaign status',
            error: error.message
        });
    }
};

// Rate submission and declare winners (Admin)
export const rateSubmission = async (req, res) => {
    try {
        const { id } = req.params; // submission_id
        const { rating, notes, status, prize_position } = req.body;

        const submission = await CampaignSubmission.findById(id);

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        // Update rating and notes
        if (rating !== undefined) {
            submission.admin_rating = rating;
        }
        if (notes) {
            submission.admin_notes = notes;
        }
        if (status) {
            submission.status = status;
        }

        // Set prize if winner
        if (prize_position) {
            const campaign = await Campaign.findById(submission.campaign_id);

            if (prize_position === 'first') {
                submission.prize_won = {
                    amount: campaign.prizes.first_prize,
                    position: 'first'
                };
                submission.status = 'winner';
            } else if (prize_position === 'second') {
                submission.prize_won = {
                    amount: campaign.prizes.second_prize,
                    position: 'second'
                };
                submission.status = 'runner_up';
            }
        }

        await submission.save();

        res.json({
            success: true,
            message: 'Submission rated successfully',
            submission
        });
    } catch (error) {
        console.error('Rate Submission Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error rating submission',
            error: error.message
        });
    }
};

// Get campaign statistics (Admin)
export const getCampaignStats = async (req, res) => {
    try {
        const totalCampaigns = await Campaign.countDocuments();
        const activeCampaigns = await Campaign.countDocuments({ status: 'active' });
        const completedCampaigns = await Campaign.countDocuments({ status: 'completed' });
        const totalSubmissions = await CampaignSubmission.countDocuments();

        // Total revenue calculation
        const submissions = await CampaignSubmission.find({ payment_status: 'paid' });
        const totalRevenue = submissions.reduce((sum, sub) => sum + sub.payment_amount, 0);

        res.json({
            success: true,
            stats: {
                total_campaigns: totalCampaigns,
                active_campaigns: activeCampaigns,
                completed_campaigns: completedCampaigns,
                total_submissions: totalSubmissions,
                total_revenue: totalRevenue
            }
        });
    } catch (error) {
        console.error('Get Campaign Stats Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching stats',
            error: error.message
        });
    }
};

// ============ USER OPERATIONS ============

// Get active campaigns (User/Public)
export const getActiveCampaigns = async (req, res) => {
    try {
        const campaigns = await Campaign.find({
            status: 'active'
        }).sort({ submission_deadline: 1 }); // Sort by submission deadline (closest first)

        const campaignsWithDetails = campaigns.map(campaign => ({
            id: campaign._id,
            name: campaign.name,
            description: campaign.description,
            reference_image: campaign.reference_image,
            max_participants: campaign.max_participants,
            current_participants: campaign.current_participants,
            campaign_type: campaign.campaign_type, // paid, free, or point-based
            entry_fee: campaign.entry_fee,
            points_required: campaign.points_required, // Points needed for point-based entry
            prizes: campaign.prizes,
            category: campaign.category,
            age_group: campaign.age_group,
            submission_type: campaign.submission_type,
            submission_deadline: campaign.submission_deadline,
            is_full: campaign.current_participants >= campaign.max_participants,
            slots_remaining: campaign.max_participants - campaign.current_participants
        }));

        res.json({
            success: true,
            count: campaignsWithDetails.length,
            campaigns: campaignsWithDetails
        });
    } catch (error) {
        console.error('Get Active Campaigns Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching active campaigns',
            error: error.message
        });
    }
};

// Submit artwork to campaign (User)
export const submitArtwork = async (req, res) => {
    try {
        const {
            campaign_id,
            user_id,
            submission_image,
            title,
            description,
            payment_method,
            coupon_code,
            original_amount,
            discount_amount,
            final_amount
        } = req.body;

        if (!campaign_id || !user_id || !submission_image) {
            return res.status(400).json({
                success: false,
                message: 'Campaign ID, User ID, and submission image are required'
            });
        }

        // Check if campaign exists and is active
        const campaign = await Campaign.findById(campaign_id);

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        if (campaign.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'Campaign is not active'
            });
        }

        // Check if campaign is full
        if (campaign.current_participants >= campaign.max_participants) {
            return res.status(400).json({
                success: false,
                message: 'Campaign is full'
            });
        }

        // Check if user already submitted (exclude drafts)
        const existingSubmission = await CampaignSubmission.findOne({
            campaign_id,
            user_id,
            is_draft: false // Only check for paid submissions, not drafts
        });

        if (existingSubmission) {
            return res.status(400).json({
                success: false,
                message: 'You have already submitted to this campaign'
            });
        }

        // Check if user has a draft for this campaign
        const existingDraft = await CampaignSubmission.findOne({
            campaign_id,
            user_id,
            is_draft: true
        });

        // If draft exists, delete it before creating new paid submission
        // This handles the case where user submits through regular form instead of completing draft
        if (existingDraft) {
            await CampaignSubmission.findByIdAndDelete(existingDraft._id);
            console.log(`🗑️ Deleted existing draft ${existingDraft._id} for user ${user_id} before creating new submission`);
        }

        // Get user
        const User = (await import('../models/User.js')).default;
        const user = await User.findById(user_id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Validate payment method based on campaign type
        if (campaign.campaign_type === 'premium') {
            // Premium campaigns: Must pay money ONLY, points NOT allowed (protect revenue!)
            if (payment_method === 'points') {
                return res.status(400).json({
                    success: false,
                    message: 'This is a premium campaign. Points cannot be used. Please pay the entry fee with money.'
                });
            }
            // Must pay with wallet - validate balance
            if (payment_method === 'wallet') {
                // Use final_amount if coupon applied, otherwise use campaign entry fee
                const entryFee = final_amount !== undefined ? final_amount : campaign.entry_fee.amount;

                // Initialize wallet if needed
                if (!user.wallet) {
                    user.wallet = {
                        deposit_balance: 0,
                        winning_balance: 0,
                        total_deposited: 0,
                        total_earned: 0,
                        total_withdrawn: 0
                    };
                }

                const depositBalance = user.wallet.deposit_balance || 0;
                const winningBalance = user.wallet.winning_balance || 0;
                const totalBalance = depositBalance + winningBalance;

                if (totalBalance < entryFee) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient wallet balance. You need ₹${entryFee} but have only ₹${totalBalance}. Please add money to wallet.`
                    });
                }

                // Record total balance before transaction
                const totalBalanceBefore = totalBalance;

                // Deduct from deposit_balance first, then winning_balance if needed
                let remainingFee = entryFee;
                if (depositBalance >= remainingFee) {
                    // Sufficient deposit balance
                    user.wallet.deposit_balance -= remainingFee;
                } else {
                    // Use all deposit balance, then deduct remainder from winning balance
                    remainingFee -= depositBalance;
                    user.wallet.deposit_balance = 0;
                    user.wallet.winning_balance -= remainingFee;
                }
                await user.save();

                const totalBalanceAfter = (user.wallet.deposit_balance || 0) + (user.wallet.winning_balance || 0);

                // Create wallet transaction record
                const transactionDescription = coupon_code
                    ? `Contest entry fee for "${campaign.name}" (Coupon: ${coupon_code}, Saved: ₹${discount_amount || 0})`
                    : `Contest entry fee for "${campaign.name}"`;

                await WalletTransaction.create({
                    user_id,
                    type: 'contest_entry',
                    amount: entryFee,
                    balance_before: totalBalanceBefore,
                    balance_after: totalBalanceAfter,
                    description: transactionDescription,
                    reference_id: campaign_id.toString(),
                    reference_type: 'campaign',
                    payment_method: 'wallet',
                    status: 'completed'
                });

                console.log(`✅ Deducted ₹${entryFee} from wallet for user ${user.username || user.mobile_number}${coupon_code ? ` (Coupon: ${coupon_code})` : ''}`);
            }
        } else if (campaign.campaign_type === 'point-based') {
            // Point-based campaigns: Can pay with wallet OR use points (user's choice)
            if (payment_method === 'points') {
                const POINTS_REQUIRED = campaign.points_required || 500;

                if (user.points < POINTS_REQUIRED) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient points. You need ${POINTS_REQUIRED} points but have only ${user.points} points. Pay ₹${campaign.entry_fee.amount} instead!`
                    });
                }

                // Deduct points
                user.points -= POINTS_REQUIRED;
                await user.save();

                console.log(`✅ Deducted ${POINTS_REQUIRED} points from user ${user.username || user.mobile_number}`);
            } else if (payment_method === 'wallet') {
                // Pay with wallet
                // Use final_amount if coupon applied, otherwise use campaign entry fee
                const entryFee = final_amount !== undefined ? final_amount : campaign.entry_fee.amount;

                // Initialize wallet if needed
                if (!user.wallet) {
                    user.wallet = {
                        deposit_balance: 0,
                        winning_balance: 0,
                        total_deposited: 0,
                        total_earned: 0,
                        total_withdrawn: 0
                    };
                }

                const depositBalance = user.wallet.deposit_balance || 0;
                const winningBalance = user.wallet.winning_balance || 0;
                const totalBalance = depositBalance + winningBalance;

                if (totalBalance < entryFee) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient wallet balance. You need ₹${entryFee} but have only ₹${totalBalance}. Please add money to wallet.`
                    });
                }

                // Record total balance before transaction
                const totalBalanceBefore = totalBalance;

                // Deduct from deposit_balance first, then winning_balance if needed
                let remainingFee = entryFee;
                if (depositBalance >= remainingFee) {
                    // Sufficient deposit balance
                    user.wallet.deposit_balance -= remainingFee;
                } else {
                    // Use all deposit balance, then deduct remainder from winning balance
                    remainingFee -= depositBalance;
                    user.wallet.deposit_balance = 0;
                    user.wallet.winning_balance -= remainingFee;
                }
                await user.save();

                const totalBalanceAfter = (user.wallet.deposit_balance || 0) + (user.wallet.winning_balance || 0);

                // Create wallet transaction record
                const transactionDescription = coupon_code
                    ? `Contest entry fee for "${campaign.name}" (Point-based campaign, Coupon: ${coupon_code}, Saved: ₹${discount_amount || 0})`
                    : `Contest entry fee for "${campaign.name}" (Point-based campaign)`;

                await WalletTransaction.create({
                    user_id,
                    type: 'contest_entry',
                    amount: entryFee,
                    balance_before: totalBalanceBefore,
                    balance_after: totalBalanceAfter,
                    description: transactionDescription,
                    reference_id: campaign_id.toString(),
                    reference_type: 'campaign',
                    payment_method: 'wallet',
                    status: 'completed'
                });

                console.log(`✅ Deducted ₹${entryFee} from wallet for user ${user.username || user.mobile_number}${coupon_code ? ` (Coupon: ${coupon_code})` : ''}`);
            }
        }

        // Create submission
        const actualPaymentAmount = final_amount !== undefined ? final_amount : campaign.entry_fee.amount;

        const submission = new CampaignSubmission({
            campaign_id,
            user_id,
            submission_image,
            title,
            description,
            payment_method: payment_method || campaign.entry_fee.type,
            payment_amount: actualPaymentAmount,
            original_amount: original_amount || campaign.entry_fee.amount,
            discount_amount: discount_amount || 0,
            coupon_code: coupon_code || null,
            payment_status: 'paid' // Update after actual payment integration
        });

        await submission.save();

        // Increment participant count
        campaign.current_participants += 1;
        await campaign.save();

        // Increment user's contests participated count
        user.contests_participated += 1;
        await user.save();

        // Award referral points if this is user's first campaign
        try {
            const referralResult = await awardReferralPoints(user_id);
            if (referralResult.success) {
                console.log('✅ Referral points awarded:', referralResult.pointsAwarded);
            }
        } catch (err) {
            console.error('Referral points award error (non-fatal):', err);
            // Don't fail submission if referral fails
        }

        res.status(201).json({
            success: true,
            message: 'Artwork submitted successfully',
            submission,
            note: 'Points will be awarded to non-winning participants after prize distribution'
        });
    } catch (error) {
        console.error('Submit Artwork Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting artwork',
            error: error.message
        });
    }
};

// Get user's submissions (excluding drafts)
export const getUserSubmissions = async (req, res) => {
    try {
        const { user_id } = req.params;

        const submissions = await CampaignSubmission.find({
            user_id,
            is_draft: false // Exclude drafts from regular submissions
        })
            .populate('campaign_id')
            .sort({ submitted_at: -1 });

        console.log(`📊 User ${user_id} submissions:`, submissions.map(s => ({
            id: s._id,
            status: s.status,
            prize_won: s.prize_won,
            campaign: s.campaign_id?.name
        })));

        res.json({
            success: true,
            count: submissions.length,
            submissions
        });
    } catch (error) {
        console.error('Get User Submissions Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching submissions',
            error: error.message
        });
    }
};

// ============ DRAFT SYSTEM ============

// Save artwork as draft (no payment required)
export const saveDraft = async (req, res) => {
    try {
        const { campaign_id, user_id, submission_image, title, description } = req.body;

        if (!campaign_id || !user_id || !submission_image) {
            return res.status(400).json({
                success: false,
                message: 'Campaign ID, User ID, and submission image are required'
            });
        }

        // Check if campaign exists and is active
        const campaign = await Campaign.findById(campaign_id);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        if (campaign.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'Campaign is not active'
            });
        }

        // Check if user already has a paid submission for this campaign
        const existingPaidSubmission = await CampaignSubmission.findOne({
            campaign_id,
            user_id,
            is_draft: false
        });

        if (existingPaidSubmission) {
            return res.status(400).json({
                success: false,
                message: 'You have already submitted to this campaign'
            });
        }

        // Check if user already has a draft for this campaign
        let draft = await CampaignSubmission.findOne({
            campaign_id,
            user_id,
            is_draft: true
        });

        if (draft) {
            // Update existing draft
            draft.submission_image = submission_image;
            draft.title = title || '';
            draft.description = description || '';
            draft.draft_saved_at = new Date();
            await draft.save();

            console.log(`📝 Updated draft for user ${user_id} in campaign ${campaign_id}`);
        } else {
            // Create new draft
            draft = new CampaignSubmission({
                campaign_id,
                user_id,
                submission_image,
                title: title || '',
                description: description || '',
                status: 'draft',
                is_draft: true,
                draft_saved_at: new Date(),
                payment_status: 'pending',
                payment_amount: campaign.entry_fee.amount
            });

            await draft.save();
            console.log(`📝 Created new draft for user ${user_id} in campaign ${campaign_id}`);
        }

        res.status(201).json({
            success: true,
            message: 'Draft saved successfully! Complete payment to participate.',
            draft: {
                id: draft._id,
                campaign_id: draft.campaign_id,
                submission_image: draft.submission_image,
                title: draft.title,
                description: draft.description,
                draft_saved_at: draft.draft_saved_at
            }
        });
    } catch (error) {
        console.error('Save Draft Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving draft',
            error: error.message
        });
    }
};

// Get user's draft submissions
export const getUserDrafts = async (req, res) => {
    try {
        const { user_id } = req.params;

        const drafts = await CampaignSubmission.find({
            user_id,
            is_draft: true
        })
            .populate('campaign_id')
            .sort({ draft_saved_at: -1 });

        // Filter out drafts for inactive/completed/cancelled campaigns
        const activeDrafts = drafts.filter(draft =>
            draft.campaign_id &&
            draft.campaign_id.status === 'active'
        );

        console.log(`📊 User ${user_id} has ${activeDrafts.length} active drafts`);

        res.json({
            success: true,
            count: activeDrafts.length,
            drafts: activeDrafts.map(draft => ({
                id: draft._id,
                campaign: {
                    id: draft.campaign_id._id,
                    name: draft.campaign_id.name,
                    description: draft.campaign_id.description,
                    reference_image: draft.campaign_id.reference_image,
                    entry_fee: draft.campaign_id.entry_fee,
                    campaign_type: draft.campaign_id.campaign_type,
                    points_required: draft.campaign_id.points_required,
                    prizes: draft.campaign_id.prizes,
                    submission_deadline: draft.campaign_id.submission_deadline,
                    is_full: draft.campaign_id.current_participants >= draft.campaign_id.max_participants
                },
                submission_image: draft.submission_image,
                title: draft.title,
                description: draft.description,
                draft_saved_at: draft.draft_saved_at,
                payment_amount: draft.payment_amount
            }))
        });
    } catch (error) {
        console.error('Get User Drafts Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching drafts',
            error: error.message
        });
    }
};

// Complete draft by processing payment
export const completeDraft = async (req, res) => {
    try {
        const { draft_id, payment_method } = req.body;

        if (!draft_id) {
            return res.status(400).json({
                success: false,
                message: 'Draft ID is required'
            });
        }

        // Get the draft
        const draft = await CampaignSubmission.findById(draft_id);
        if (!draft || !draft.is_draft) {
            return res.status(404).json({
                success: false,
                message: 'Draft not found'
            });
        }

        // Get campaign
        const campaign = await Campaign.findById(draft.campaign_id);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        if (campaign.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'Campaign is no longer active'
            });
        }

        // Check if campaign is full
        if (campaign.current_participants >= campaign.max_participants) {
            return res.status(400).json({
                success: false,
                message: 'Campaign is full'
            });
        }

        // Get user
        const User = (await import('../models/User.js')).default;
        const user = await User.findById(draft.user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Process payment based on campaign type (same logic as submitArtwork)
        if (campaign.campaign_type === 'premium') {
            if (payment_method === 'points') {
                return res.status(400).json({
                    success: false,
                    message: 'This is a premium campaign. Points cannot be used.'
                });
            }

            if (payment_method === 'wallet') {
                const entryFee = campaign.entry_fee.amount;
                if (!user.wallet) {
                    user.wallet = {
                        deposit_balance: 0,
                        winning_balance: 0,
                        total_deposited: 0,
                        total_earned: 0,
                        total_withdrawn: 0
                    };
                }

                const depositBalance = user.wallet.deposit_balance || 0;
                const winningBalance = user.wallet.winning_balance || 0;
                const totalBalance = depositBalance + winningBalance;

                if (totalBalance < entryFee) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient wallet balance. You need ₹${entryFee} but have only ₹${totalBalance}.`
                    });
                }

                const totalBalanceBefore = totalBalance;
                let remainingFee = entryFee;
                if (depositBalance >= remainingFee) {
                    user.wallet.deposit_balance -= remainingFee;
                } else {
                    remainingFee -= depositBalance;
                    user.wallet.deposit_balance = 0;
                    user.wallet.winning_balance -= remainingFee;
                }
                await user.save();

                const totalBalanceAfter = (user.wallet.deposit_balance || 0) + (user.wallet.winning_balance || 0);

                await WalletTransaction.create({
                    user_id: user._id,
                    type: 'contest_entry',
                    amount: entryFee,
                    balance_before: totalBalanceBefore,
                    balance_after: totalBalanceAfter,
                    description: `Contest entry fee for "${campaign.name}" (from draft)`,
                    reference_id: campaign._id.toString(),
                    reference_type: 'campaign',
                    payment_method: 'wallet',
                    status: 'completed'
                });
            }
        } else if (campaign.campaign_type === 'point-based') {
            if (payment_method === 'points') {
                const POINTS_REQUIRED = campaign.points_required || 500;
                if (user.points < POINTS_REQUIRED) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient points. You need ${POINTS_REQUIRED} points but have only ${user.points} points.`
                    });
                }
                user.points -= POINTS_REQUIRED;
                await user.save();
            } else if (payment_method === 'wallet') {
                const entryFee = campaign.entry_fee.amount;
                if (!user.wallet) {
                    user.wallet = {
                        deposit_balance: 0,
                        winning_balance: 0,
                        total_deposited: 0,
                        total_earned: 0,
                        total_withdrawn: 0
                    };
                }

                const depositBalance = user.wallet.deposit_balance || 0;
                const winningBalance = user.wallet.winning_balance || 0;
                const totalBalance = depositBalance + winningBalance;

                if (totalBalance < entryFee) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient wallet balance. You need ₹${entryFee} but have only ₹${totalBalance}.`
                    });
                }

                const totalBalanceBefore = totalBalance;
                let remainingFee = entryFee;
                if (depositBalance >= remainingFee) {
                    user.wallet.deposit_balance -= remainingFee;
                } else {
                    remainingFee -= depositBalance;
                    user.wallet.deposit_balance = 0;
                    user.wallet.winning_balance -= remainingFee;
                }
                await user.save();

                const totalBalanceAfter = (user.wallet.deposit_balance || 0) + (user.wallet.winning_balance || 0);

                await WalletTransaction.create({
                    user_id: user._id,
                    type: 'contest_entry',
                    amount: entryFee,
                    balance_before: totalBalanceBefore,
                    balance_after: totalBalanceAfter,
                    description: `Contest entry fee for "${campaign.name}" (from draft)`,
                    reference_id: campaign._id.toString(),
                    reference_type: 'campaign',
                    payment_method: 'wallet',
                    status: 'completed'
                });
            }
        }

        // Convert draft to submission
        draft.is_draft = false;
        draft.status = 'submitted';
        draft.payment_status = 'paid';
        draft.payment_method = payment_method;
        draft.submitted_at = new Date();
        await draft.save();

        // Increment participant count
        campaign.current_participants += 1;
        await campaign.save();

        // Increment user's contests participated count
        user.contests_participated += 1;
        await user.save();

        // Award referral points if this is user's first campaign
        try {
            const referralResult = await awardReferralPoints(user._id);
            if (referralResult.success) {
                console.log('✅ Referral points awarded:', referralResult.pointsAwarded);
            }
        } catch (err) {
            console.error('Referral points award error (non-fatal):', err);
        }

        res.json({
            success: true,
            message: '🎉 Draft completed successfully! Your submission is now live.',
            submission: draft
        });
    } catch (error) {
        console.error('Complete Draft Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error completing draft',
            error: error.message
        });
    }
};

// Delete a draft
export const deleteDraft = async (req, res) => {
    try {
        const { draft_id } = req.params;
        const { user_id } = req.body;

        if (!draft_id || !user_id) {
            return res.status(400).json({
                success: false,
                message: 'Draft ID and User ID are required'
            });
        }

        const draft = await CampaignSubmission.findOne({
            _id: draft_id,
            user_id,
            is_draft: true
        });

        if (!draft) {
            return res.status(404).json({
                success: false,
                message: 'Draft not found'
            });
        }

        await CampaignSubmission.findByIdAndDelete(draft_id);

        res.json({
            success: true,
            message: 'Draft deleted successfully'
        });
    } catch (error) {
        console.error('Delete Draft Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting draft',
            error: error.message
        });
    }
};

// Get campaign participants list
export const getCampaignParticipants = async (req, res) => {
    try {
        const { campaign_id } = req.params;

        const participants = await CampaignSubmission.find({
            campaign_id,
            is_draft: false // Exclude drafts from participants list
        })
            .populate('user_id', 'username mobile_number bio avatar')
            .select('user_id submitted_at status')
            .sort({ submitted_at: -1 });

        const participantsList = participants.map(participant => ({
            id: participant.user_id._id,
            username: participant.user_id.username,
            mobile_number: participant.user_id.mobile_number,
            bio: participant.user_id.bio,
            avatar: participant.user_id.avatar,
            submitted_at: participant.submitted_at,
            status: participant.status
        }));

        res.json({
            success: true,
            count: participantsList.length,
            participants: participantsList
        });
    } catch (error) {
        console.error('Get Campaign Participants Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching participants',
            error: error.message
        });
    }
};

// Get campaign leaderboard (Public)
export const getCampaignLeaderboard = async (req, res) => {
    try {
        const { campaign_id } = req.params;

        const submissions = await CampaignSubmission.find({
            campaign_id,
            status: { $in: ['approved', 'winner', 'runner_up'] }
        })
            .populate('user_id', 'username mobile_number bio avatar')
            .sort({ admin_rating: -1, votes: -1, likes: -1 })
            .limit(20);

        res.json({
            success: true,
            count: submissions.length,
            leaderboard: submissions.map((sub, index) => ({
                rank: index + 1,
                user: {
                    username: sub.user_id?.username && sub.user_id.username.trim() ? sub.user_id.username : 'Anonymous',
                    mobile: sub.user_id?.mobile_number
                },
                submission_image: sub.submission_image,
                title: sub.title,
                rating: sub.admin_rating,
                votes: sub.votes,
                likes: sub.likes,
                status: sub.status,
                prize: sub.prize_won
            }))
        });
    } catch (error) {
        console.error('Get Leaderboard Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching leaderboard',
            error: error.message
        });
    }
};

// ============ SOCIAL FEED FEATURES ============

// Get all submissions feed (Facebook-style feed)
export const getSubmissionsFeed = async (req, res) => {
    try {
        const { limit = 20, page = 1, skip = 0 } = req.query;

        // Calculate skip based on page if page is provided
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skipNum = skip ? parseInt(skip) : (pageNum - 1) * limitNum;

        const submissions = await CampaignSubmission.find({
            status: { $in: ['submitted', 'approved', 'winner', 'runner_up'] }
        })
            .populate('user_id', 'username mobile_number bio avatar')
            .populate('campaign_id')
            .sort({ submitted_at: -1 })
            .limit(limitNum)
            .skip(skipNum);

        // Get comment counts for each submission
        const submissionIds = submissions.map(sub => sub._id);
        const commentCounts = await Comment.aggregate([
            { $match: { submission_id: { $in: submissionIds } } },
            { $group: { _id: '$submission_id', count: { $sum: 1 } } }
        ]);

        // Create a map of submission_id to comment count
        const commentCountMap = {};
        commentCounts.forEach(item => {
            commentCountMap[item._id.toString()] = item.count;
        });

        const total = await CampaignSubmission.countDocuments({
            status: { $in: ['submitted', 'approved', 'winner', 'runner_up'] }
        });

        res.json({
            success: true,
            count: submissions.length,
            total,
            page: pageNum,
            limit: limitNum,
            hasMore: skipNum + submissions.length < total,
            submissions: submissions.map(sub => ({
                id: sub._id,
                user: {
                    id: sub.user_id?._id,
                    username: sub.user_id?.username && sub.user_id.username.trim() ? sub.user_id.username : 'Anonymous',
                    mobile: sub.user_id?.mobile_number,
                    bio: sub.user_id?.bio,
                    avatar: sub.user_id?.avatar
                },
                campaign: sub.campaign_id ? {
                    _id: sub.campaign_id._id,
                    id: sub.campaign_id._id,
                    name: sub.campaign_id.name,
                    description: sub.campaign_id.description,
                    category: sub.campaign_id.category,
                    prizes: sub.campaign_id.prizes,
                    entry_fee: sub.campaign_id.entry_fee,
                    max_participants: sub.campaign_id.max_participants,
                    current_participants: sub.campaign_id.current_participants,
                    reference_image: sub.campaign_id.reference_image,
                    submission_type: sub.campaign_id.submission_type,
                    status: sub.campaign_id.status,
                    start_date: sub.campaign_id.start_date,
                    end_date: sub.campaign_id.end_date,
                    submission_deadline: sub.campaign_id.submission_deadline,
                    result_date: sub.campaign_id.result_date,
                    rules: sub.campaign_id.rules
                } : null,
                submission_image: sub.submission_image,
                title: sub.title,
                description: sub.description,
                status: sub.status,
                votes: sub.votes,
                likes: sub.likes,
                comments: commentCountMap[sub._id.toString()] || 0,
                rating: sub.admin_rating,
                prize: sub.prize_won,
                submitted_at: sub.submitted_at
            }))
        });
    } catch (error) {
        console.error('Get Feed Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching feed',
            error: error.message
        });
    }
};

// Like a submission
export const likeSubmission = async (req, res) => {
    try {
        const { submission_id, user_id } = req.body;

        if (!submission_id || !user_id) {
            return res.status(400).json({
                success: false,
                message: 'Submission ID and User ID are required'
            });
        }

        const submission = await CampaignSubmission.findById(submission_id);

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        // Check if user already liked
        if (submission.liked_by && submission.liked_by.includes(user_id)) {
            return res.status(400).json({
                success: false,
                message: 'You have already liked this submission'
            });
        }

        // Add user to liked_by array and increment likes
        if (!submission.liked_by) {
            submission.liked_by = [];
        }
        submission.liked_by.push(user_id);
        submission.likes += 1;
        await submission.save();

        res.json({
            success: true,
            message: 'Liked successfully',
            likes: submission.likes
        });
    } catch (error) {
        console.error('Like Submission Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error liking submission',
            error: error.message
        });
    }
};

// Vote for a submission
export const voteSubmission = async (req, res) => {
    try {
        const { submission_id, user_id } = req.body;

        if (!submission_id || !user_id) {
            return res.status(400).json({
                success: false,
                message: 'Submission ID and User ID are required'
            });
        }

        const submission = await CampaignSubmission.findById(submission_id);

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        // Check if user already voted
        if (submission.voted_by && submission.voted_by.includes(user_id)) {
            return res.status(400).json({
                success: false,
                message: 'You have already voted for this submission'
            });
        }

        // Add user to voted_by array and increment votes
        if (!submission.voted_by) {
            submission.voted_by = [];
        }
        submission.voted_by.push(user_id);
        submission.votes += 1;
        await submission.save();

        res.json({
            success: true,
            message: 'Voted successfully',
            votes: submission.votes
        });
    } catch (error) {
        console.error('Vote Submission Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error voting submission',
            error: error.message
        });
    }
};

// Unvote a submission
export const unvoteSubmission = async (req, res) => {
    try {
        const { submission_id, user_id } = req.body;

        if (!submission_id || !user_id) {
            return res.status(400).json({
                success: false,
                message: 'Submission ID and User ID are required'
            });
        }

        const submission = await CampaignSubmission.findById(submission_id);

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        // Remove user from voted_by array
        if (submission.voted_by && submission.voted_by.includes(user_id)) {
            submission.voted_by = submission.voted_by.filter(id => id.toString() !== user_id.toString());
            // Decrement votes (ensure it doesn't go below 0)
            submission.votes = Math.max(0, submission.votes - 1);
            await submission.save();
        }

        res.json({
            success: true,
            message: 'Unvoted successfully',
            votes: submission.votes
        });
    } catch (error) {
        console.error('Unvote Submission Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error unvoting submission',
            error: error.message
        });
    }
};

// Unlike a submission
export const unlikeSubmission = async (req, res) => {
    try {
        const { submission_id, user_id } = req.body;

        if (!submission_id || !user_id) {
            return res.status(400).json({
                success: false,
                message: 'Submission ID and User ID are required'
            });
        }

        const submission = await CampaignSubmission.findById(submission_id);

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        // Remove user from liked_by array
        if (submission.liked_by && submission.liked_by.includes(user_id)) {
            submission.liked_by = submission.liked_by.filter(id => id.toString() !== user_id.toString());
            // Decrement likes (ensure it doesn't go below 0)
            submission.likes = Math.max(0, submission.likes - 1);
            await submission.save();
        }

        res.json({
            success: true,
            message: 'Unliked successfully',
            likes: submission.likes
        });
    } catch (error) {
        console.error('Unlike Submission Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error unliking submission',
            error: error.message
        });
    }
};

// ============ COMMENT FEATURES ============

// Add a comment to a submission
export const addComment = async (req, res) => {
    try {
        const { submission_id, user_id, content } = req.body;

        if (!submission_id || !user_id || !content) {
            return res.status(400).json({
                success: false,
                message: 'Submission ID, User ID, and content are required'
            });
        }

        // Validate content length
        if (content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Comment cannot be empty'
            });
        }

        if (content.length > 500) {
            return res.status(400).json({
                success: false,
                message: 'Comment cannot exceed 500 characters'
            });
        }

        // Check if submission exists
        const submission = await CampaignSubmission.findById(submission_id);
        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        // Create comment
        const comment = new Comment({
            submission_id,
            user_id,
            content: content.trim()
        });

        await comment.save();

        // Populate user data for response
        await comment.populate('user_id', 'username mobile_number bio avatar');

        res.status(201).json({
            success: true,
            message: 'Comment added successfully',
            comment: {
                id: comment._id,
                content: comment.content,
                user: {
                    id: comment.user_id._id,
                    username: comment.user_id.username && comment.user_id.username.trim() ? comment.user_id.username : 'Anonymous',
                    mobile: comment.user_id.mobile_number,
                    bio: comment.user_id.bio,
                    avatar: comment.user_id.avatar
                },
                likes: comment.likes,
                created_at: comment.created_at
            }
        });
    } catch (error) {
        console.error('Add Comment Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding comment',
            error: error.message
        });
    }
};

// Get comments for a submission
export const getComments = async (req, res) => {
    try {
        const { submission_id } = req.params;
        const { limit = 20, page = 1 } = req.query;

        if (!submission_id) {
            return res.status(400).json({
                success: false,
                message: 'Submission ID is required'
            });
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skipNum = (pageNum - 1) * limitNum;

        const comments = await Comment.find({
            submission_id,
            is_approved: true
        })
            .populate('user_id', 'username mobile_number bio avatar')
            .sort({ created_at: -1 })
            .limit(limitNum)
            .skip(skipNum);

        const total = await Comment.countDocuments({
            submission_id,
            is_approved: true
        });

        res.json({
            success: true,
            count: comments.length,
            total,
            page: pageNum,
            limit: limitNum,
            hasMore: skipNum + comments.length < total,
            comments: comments.map(comment => ({
                id: comment._id,
                content: comment.content,
                user: {
                    id: comment.user_id._id,
                    username: comment.user_id.username && comment.user_id.username.trim() ? comment.user_id.username : 'Anonymous',
                    mobile: comment.user_id.mobile_number,
                    bio: comment.user_id.bio,
                    avatar: comment.user_id.avatar
                },
                likes: comment.likes,
                created_at: comment.created_at
            }))
        });
    } catch (error) {
        console.error('Get Comments Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching comments',
            error: error.message
        });
    }
};

// Delete a comment (user can only delete their own comments)
export const deleteComment = async (req, res) => {
    try {
        const { comment_id } = req.params;
        const { user_id } = req.body;

        if (!comment_id || !user_id) {
            return res.status(400).json({
                success: false,
                message: 'Comment ID and User ID are required'
            });
        }

        const comment = await Comment.findById(comment_id);
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        // Check if user owns the comment
        if (comment.user_id.toString() !== user_id) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own comments'
            });
        }

        await Comment.findByIdAndDelete(comment_id);

        res.json({
            success: true,
            message: 'Comment deleted successfully'
        });
    } catch (error) {
        console.error('Delete Comment Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting comment',
            error: error.message
        });
    }
};

// Like/Unlike a comment
export const likeComment = async (req, res) => {
    try {
        const { comment_id } = req.params;
        const { user_id } = req.body;

        if (!comment_id || !user_id) {
            return res.status(400).json({
                success: false,
                message: 'Comment ID and User ID are required'
            });
        }

        const comment = await Comment.findById(comment_id);
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        // Check if user already liked this comment
        const likedIndex = comment.liked_by.indexOf(user_id);
        const isLiked = likedIndex !== -1;

        if (isLiked) {
            // Unlike: remove user from liked_by array and decrease likes count
            comment.liked_by.splice(likedIndex, 1);
            comment.likes = Math.max(0, comment.likes - 1);
        } else {
            // Like: add user to liked_by array and increase likes count
            comment.liked_by.push(user_id);
            comment.likes += 1;
        }

        await comment.save();

        res.json({
            success: true,
            message: isLiked ? 'Comment unliked successfully' : 'Comment liked successfully',
            data: {
                comment_id: comment._id,
                likes: comment.likes,
                is_liked: !isLiked
            }
        });

    } catch (error) {
        console.error('Error liking comment:', error);
        res.status(500).json({
            success: false,
            message: 'Error liking comment',
            error: error.message
        });
    }
};

// Get public submission view (no authentication required)
export const getPublicSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;

        if (!submissionId) {
            return res.status(400).json({
                success: false,
                message: 'Submission ID is required'
            });
        }

        const submission = await CampaignSubmission.findById(submissionId)
            .populate('user_id', 'username mobile')
            .populate('campaign_id', 'title description image_url submission_type');

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        // Return public data (no sensitive information)
        const publicSubmission = {
            id: submission._id,
            artwork_url: submission.submission_image,
            submission_type: submission.campaign_id?.submission_type || 'offline',
            likes: submission.likes || 0,
            votes: submission.votes || 0,
            created_at: submission.createdAt || submission.submitted_at,
            user: {
                id: submission.user_id?._id,
                username: submission.user_id?.username,
                mobile: submission.user_id?.mobile ?
                    submission.user_id.mobile.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2') : null
            },
            campaign: submission.campaign_id ? {
                id: submission.campaign_id._id,
                title: submission.campaign_id.title,
                description: submission.campaign_id.description,
                image_url: submission.campaign_id.image_url,
                submission_type: submission.campaign_id.submission_type
            } : null
        };

        res.json({
            success: true,
            submission: publicSubmission,
            campaign: publicSubmission.campaign
        });

    } catch (error) {
        console.error('Error fetching public submission:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching submission',
            error: error.message
        });
    }
};

// Distribute prizes and award points to non-winners (Admin)
export const distributePrizes = async (req, res) => {
    try {
        const { campaign_id, first_winner_id, second_winner_id } = req.body;

        if (!campaign_id || !first_winner_id || !second_winner_id) {
            return res.status(400).json({
                success: false,
                message: 'Campaign ID, first winner ID, and second winner ID are required'
            });
        }

        // Get campaign
        const campaign = await Campaign.findById(campaign_id);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        // Get all submissions for this campaign
        const submissions = await CampaignSubmission.find({ campaign_id });
        if (submissions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No submissions found for this campaign'
            });
        }

        // Get User model
        const User = (await import('../models/User.js')).default;
        const PARTICIPATION_POINTS = 100;

        // Award prizes to winners
        console.log(`🏆 Setting first winner: ${first_winner_id}`);
        const firstWinner = await CampaignSubmission.findByIdAndUpdate(
            first_winner_id,
            {
                status: 'winner',
                prize_won: {
                    amount: campaign.prizes.first_prize,
                    position: 'first'
                },
                admin_notes: 'First Prize Winner'
            },
            { new: true }
        );

        console.log(`🥈 Setting second winner: ${second_winner_id}`);
        const secondWinner = await CampaignSubmission.findByIdAndUpdate(
            second_winner_id,
            {
                status: 'runner_up',
                prize_won: {
                    amount: campaign.prizes.second_prize,
                    position: 'second'
                },
                admin_notes: 'Second Prize Winner'
            },
            { new: true }
        );

        console.log(`✅ First winner updated:`, firstWinner ? 'SUCCESS' : 'FAILED');
        console.log(`✅ Second winner updated:`, secondWinner ? 'SUCCESS' : 'FAILED');

        if (!firstWinner || !secondWinner) {
            return res.status(400).json({
                success: false,
                message: 'Invalid winner IDs'
            });
        }

        // Add prize money to winners' wallets
        const firstWinnerUser = await User.findById(firstWinner.user_id);
        const secondWinnerUser = await User.findById(secondWinner.user_id);

        if (firstWinnerUser) {
            // Initialize wallet if it doesn't exist
            if (!firstWinnerUser.wallet) {
                firstWinnerUser.wallet = {
                    deposit_balance: 0,
                    winning_balance: 0,
                    total_deposited: 0,
                    total_earned: 0,
                    total_withdrawn: 0
                };
            }

            // Record total balance before prize
            const totalBalanceBefore = (firstWinnerUser.wallet.deposit_balance || 0) + (firstWinnerUser.wallet.winning_balance || 0);

            // Add prize to WINNING balance (withdrawable)
            firstWinnerUser.wallet.winning_balance = (firstWinnerUser.wallet.winning_balance || 0) + campaign.prizes.first_prize;
            firstWinnerUser.wallet.total_earned = (firstWinnerUser.wallet.total_earned || 0) + campaign.prizes.first_prize;
            await firstWinnerUser.save();

            const totalBalanceAfter = (firstWinnerUser.wallet.deposit_balance || 0) + firstWinnerUser.wallet.winning_balance;

            // Create wallet transaction record for prize
            await WalletTransaction.create({
                user_id: firstWinnerUser._id,
                type: 'prize_won',
                amount: campaign.prizes.first_prize,
                balance_before: totalBalanceBefore,
                balance_after: totalBalanceAfter,
                description: `🏆 First Prize Winner - "${campaign.name}" (Withdrawable)`,
                reference_id: campaign_id.toString(),
                reference_type: 'campaign',
                status: 'completed'
            });

            console.log(`💰 Added ₹${campaign.prizes.first_prize} to first winner's WINNING balance (withdrawable). New balance: ₹${totalBalanceAfter}`);
        }

        if (secondWinnerUser) {
            // Initialize wallet if it doesn't exist
            if (!secondWinnerUser.wallet) {
                secondWinnerUser.wallet = {
                    deposit_balance: 0,
                    winning_balance: 0,
                    total_deposited: 0,
                    total_earned: 0,
                    total_withdrawn: 0
                };
            }

            // Record total balance before prize
            const totalBalanceBefore = (secondWinnerUser.wallet.deposit_balance || 0) + (secondWinnerUser.wallet.winning_balance || 0);

            // Add prize to WINNING balance (withdrawable)
            secondWinnerUser.wallet.winning_balance = (secondWinnerUser.wallet.winning_balance || 0) + campaign.prizes.second_prize;
            secondWinnerUser.wallet.total_earned = (secondWinnerUser.wallet.total_earned || 0) + campaign.prizes.second_prize;
            await secondWinnerUser.save();

            const totalBalanceAfter = (secondWinnerUser.wallet.deposit_balance || 0) + secondWinnerUser.wallet.winning_balance;

            // Create wallet transaction record for prize
            await WalletTransaction.create({
                user_id: secondWinnerUser._id,
                type: 'prize_won',
                amount: campaign.prizes.second_prize,
                balance_before: totalBalanceBefore,
                balance_after: totalBalanceAfter,
                description: `🥈 Second Prize Winner - "${campaign.name}" (Withdrawable)`,
                reference_id: campaign_id.toString(),
                reference_type: 'campaign',
                status: 'completed'
            });

            console.log(`💰 Added ₹${campaign.prizes.second_prize} to second winner's WINNING balance (withdrawable). New balance: ₹${totalBalanceAfter}`);
        }

        // Award points to non-winning participants
        const nonWinners = submissions.filter(sub =>
            sub._id.toString() !== first_winner_id &&
            sub._id.toString() !== second_winner_id
        );

        let pointsAwarded = 0;
        let participantsUpdated = 0;

        for (const submission of nonWinners) {
            const user = await User.findById(submission.user_id);
            if (user) {
                user.points = (user.points || 0) + PARTICIPATION_POINTS;
                await user.save();

                pointsAwarded += PARTICIPATION_POINTS;
                participantsUpdated += 1;

                console.log(`🎁 Awarded ${PARTICIPATION_POINTS} points to ${user.username || user.mobile_number} (non-winner). New points: ${user.points}`);
            }
        }

        // Update campaign status to completed
        campaign.status = 'completed';
        await campaign.save();

        res.json({
            success: true,
            message: 'Prizes distributed successfully',
            results: {
                first_winner: {
                    id: firstWinner._id,
                    user_id: firstWinner.user_id,
                    prize_amount: campaign.prizes.first_prize,
                    wallet_balance: firstWinnerUser?.wallet?.balance || 0
                },
                second_winner: {
                    id: secondWinner._id,
                    user_id: secondWinner.user_id,
                    prize_amount: campaign.prizes.second_prize,
                    wallet_balance: secondWinnerUser?.wallet?.balance || 0
                },
                participation_rewards: {
                    non_winners_count: participantsUpdated,
                    points_awarded_per_person: PARTICIPATION_POINTS,
                    total_points_awarded: pointsAwarded
                }
            }
        });

    } catch (error) {
        console.error('Distribute Prizes Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error distributing prizes',
            error: error.message
        });
    }
};

// Get user's votes (to prevent duplicate voting after page refresh)
export const getUserVotes = async (req, res) => {
    try {
        const { user_id } = req.params;

        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Find all submissions where this user has voted
        const votedSubmissions = await CampaignSubmission.find({
            voted_by: user_id
        }).select('_id');

        // Return array of voted submission IDs
        const votes = votedSubmissions.map(sub => ({
            submission_id: sub._id
        }));

        res.json({
            success: true,
            votes
        });
    } catch (error) {
        console.error('Get User Votes Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user votes',
            error: error.message
        });
    }
};

// Get user's likes (to prevent duplicate liking after page refresh)
export const getUserLikes = async (req, res) => {
    try {
        const { user_id } = req.params;

        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Find all submissions where this user has liked
        const likedSubmissions = await CampaignSubmission.find({
            liked_by: user_id
        }).select('_id');

        // Return array of liked submission IDs
        const likes = likedSubmissions.map(sub => ({
            submission_id: sub._id
        }));

        res.json({
            success: true,
            likes
        });
    } catch (error) {
        console.error('Get User Likes Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user likes',
            error: error.message
        });
    }
};

// Get user's liked comments (to show correct like state after page refresh)
export const getUserLikedComments = async (req, res) => {
    try {
        const { user_id } = req.params;

        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Find all comments where this user has liked
        const likedComments = await Comment.find({
            liked_by: user_id
        }).select('_id');

        // Return array of liked comment IDs
        const comments = likedComments.map(comment => ({
            comment_id: comment._id
        }));

        res.json({
            success: true,
            comments
        });
    } catch (error) {
        console.error('Get User Liked Comments Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user liked comments',
            error: error.message
        });
    }
};

