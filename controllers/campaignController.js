import Campaign from '../models/Campaign.js';
import CampaignSubmission from '../models/CampaignSubmission.js';
import Comment from '../models/Comment.js';

// ============ ADMIN OPERATIONS ============

// Create a new campaign (Admin)
export const createCampaign = async (req, res) => {
    try {
        const {
            name,
            description,
            reference_image,
            max_participants,
            entry_fee_amount,
            entry_fee_type,
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

        const campaign = new Campaign({
            name,
            description,
            reference_image,
            max_participants: max_participants || 20,
            entry_fee: {
                amount: entry_fee_amount || 100,
                type: entry_fee_type || 'rupees'
            },
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

        await campaign.save();

        res.status(201).json({
            success: true,
            message: 'Campaign created successfully',
            campaign
        });
    } catch (error) {
        console.error('Create Campaign Error:', error);
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
        }).sort({ start_date: -1 });

        const campaignsWithDetails = campaigns.map(campaign => ({
            id: campaign._id,
            name: campaign.name,
            description: campaign.description,
            reference_image: campaign.reference_image,
            max_participants: campaign.max_participants,
            current_participants: campaign.current_participants,
            entry_fee: campaign.entry_fee,
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
        const { campaign_id, user_id, submission_image, title, description, payment_method } = req.body;

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

        // Check if user already submitted
        const existingSubmission = await CampaignSubmission.findOne({
            campaign_id,
            user_id
        });

        if (existingSubmission) {
            return res.status(400).json({
                success: false,
                message: 'You have already submitted to this campaign'
            });
        }

        // Create submission
        const submission = new CampaignSubmission({
            campaign_id,
            user_id,
            submission_image,
            title,
            description,
            payment_method: payment_method || campaign.entry_fee.type,
            payment_amount: campaign.entry_fee.amount,
            payment_status: 'paid' // Update after actual payment integration
        });

        await submission.save();

        // Increment participant count
        campaign.current_participants += 1;
        await campaign.save();

        res.status(201).json({
            success: true,
            message: 'Artwork submitted successfully',
            submission
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

// Get user's submissions
export const getUserSubmissions = async (req, res) => {
    try {
        const { user_id } = req.params;

        const submissions = await CampaignSubmission.find({ user_id })
            .populate('campaign_id')
            .sort({ submitted_at: -1 });

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

// Get campaign participants list
export const getCampaignParticipants = async (req, res) => {
    try {
        const { campaign_id } = req.params;

        const participants = await CampaignSubmission.find({ campaign_id })
            .populate('user_id', 'username mobile_number')
            .select('user_id submitted_at status')
            .sort({ submitted_at: -1 });

        const participantsList = participants.map(participant => ({
            id: participant.user_id._id,
            username: participant.user_id.username,
            mobile_number: participant.user_id.mobile_number,
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
            .populate('user_id', 'username mobile_number')
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
            .populate('user_id', 'username mobile_number')
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
                    mobile: sub.user_id?.mobile_number
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

        // Increment likes
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

        // Increment votes
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

        // Decrement votes (ensure it doesn't go below 0)
        submission.votes = Math.max(0, submission.votes - 1);
        await submission.save();

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

        const submission = await CampaignSubmission.findById(submission_id);

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        // Decrement likes (ensure it doesn't go below 0)
        submission.likes = Math.max(0, submission.likes - 1);
        await submission.save();

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
        await comment.populate('user_id', 'username mobile_number');

        res.status(201).json({
            success: true,
            message: 'Comment added successfully',
            comment: {
                id: comment._id,
                content: comment.content,
                user: {
                    id: comment.user_id._id,
                    username: comment.user_id.username && comment.user_id.username.trim() ? comment.user_id.username : 'Anonymous',
                    mobile: comment.user_id.mobile_number
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
            .populate('user_id', 'username mobile_number')
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
                    mobile: comment.user_id.mobile_number
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

