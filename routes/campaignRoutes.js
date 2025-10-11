import express from 'express';
import {
    // Admin operations
    createCampaign,
    getAllCampaigns,
    getCampaignById,
    updateCampaign,
    deleteCampaign,
    updateCampaignStatus,
    rateSubmission,
    getCampaignStats,
    // User operations
    getActiveCampaigns,
    submitArtwork,
    getUserSubmissions,
    getCampaignParticipants,
    getCampaignLeaderboard,
    // Social features
    getSubmissionsFeed,
    likeSubmission,
    voteSubmission,
    unlikeSubmission,
    unvoteSubmission,
    // Comment features
    addComment,
    getComments,
    likeComment,
    deleteComment,
    // Public features
    getPublicSubmission
} from '../controllers/campaignController.js';

const router = express.Router();

// ============ ADMIN ROUTES ============
// Statistics (MUST come before /:id routes)
router.get('/admin/stats', getCampaignStats);

// Campaign management
router.post('/admin/create', createCampaign);
router.get('/admin/all', getAllCampaigns);
router.get('/admin/:id', getCampaignById);
router.put('/admin/:id', updateCampaign);
router.delete('/admin/:id', deleteCampaign);
router.patch('/admin/:id/status', updateCampaignStatus);

// Submission management
router.put('/admin/submission/:id/rate', rateSubmission);

// ============ USER/PUBLIC ROUTES ============
// View campaigns
router.get('/active', getActiveCampaigns);

// Search campaigns
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 1) {
            return res.json({
                success: true,
                campaigns: []
            });
        }

        const Campaign = (await import('../models/Campaign.js')).default;

        const campaigns = await Campaign.find({
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
                { category: { $regex: q, $options: 'i' } }
            ],
            status: { $in: ['active', 'upcoming'] }
        }).limit(10);

        res.json({
            success: true,
            campaigns
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Search failed',
            error: error.message
        });
    }
});

router.get('/:campaign_id/leaderboard', getCampaignLeaderboard);

// Submit artwork
router.post('/submit', submitArtwork);
router.get('/user/:user_id/submissions', getUserSubmissions);
router.get('/:campaign_id/participants', getCampaignParticipants);

// ============ SOCIAL FEED ROUTES ============
router.get('/feed', getSubmissionsFeed);
router.post('/like', likeSubmission);
router.post('/unlike', unlikeSubmission);
router.post('/vote', voteSubmission);
router.post('/unvote', unvoteSubmission);

// ============ COMMENT ROUTES ============
router.post('/comment', addComment);
router.get('/comment/:submission_id', getComments);
router.delete('/comment/:comment_id', deleteComment);
router.post('/comment/:comment_id/like', likeComment);

// ============ PUBLIC ROUTES (NO AUTH REQUIRED) ============
router.get('/submission/:submissionId', getPublicSubmission);

export default router;

