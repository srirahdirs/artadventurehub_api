import User from '../models/User.js';
import Referral from '../models/Referral.js';
import CampaignSubmission from '../models/CampaignSubmission.js';

// Generate unique referral code
const generateReferralCode = async () => {
    const code = 'ART' + Math.random().toString(36).substring(2, 8).toUpperCase();
    // Ensure uniqueness
    const exists = await User.findOne({ referral_code: code });
    if (exists) {
        return generateReferralCode(); // Recursive call if code exists
    }
    return code;
};

// Get user's referral history
export const getReferralHistory = async (req, res) => {
    try {
        const { userId } = req.params;

        const referrals = await Referral.find({ referrer_id: userId })
            .populate('referred_user_id', 'username mobile_number avatar createdAt')
            .sort({ createdAt: -1 });

        const user = await User.findById(userId).select('points referral_code total_referrals successful_referrals');

        // Generate referral code if user doesn't have one (for existing users)
        if (!user.referral_code) {
            user.referral_code = await generateReferralCode();
            await user.save();
            console.log(`✅ Generated referral code for existing user: ${user.referral_code}`);
        }

        res.json({
            success: true,
            referralCode: user.referral_code,
            points: user.points || 0,
            totalReferrals: user.total_referrals || 0,
            successfulReferrals: user.successful_referrals || 0,
            referrals: referrals.map(ref => ({
                id: ref._id,
                referredUser: {
                    id: ref.referred_user_id?._id,
                    username: ref.referred_user_id?.username,
                    mobile: ref.referred_user_id?.mobile_number,
                    avatar: ref.referred_user_id?.avatar,
                    joinedAt: ref.referred_user_id?.createdAt
                },
                status: ref.status,
                pointsAwarded: ref.points_awarded,
                signedUpAt: ref.createdAt,
                completedAt: ref.completed_at
            }))
        });
    } catch (error) {
        console.error('Get Referral History Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching referral history',
            error: error.message
        });
    }
};

// Validate and apply referral code during registration
export const applyReferralCode = async (req, res) => {
    try {
        const { referral_code, new_user_id } = req.body;

        if (!referral_code || !new_user_id) {
            return res.status(400).json({
                success: false,
                message: 'Referral code and user ID are required'
            });
        }

        // Find referrer by code
        const referrer = await User.findOne({ referral_code });

        if (!referrer) {
            return res.status(404).json({
                success: false,
                message: 'Invalid referral code'
            });
        }

        // Check if user is trying to refer themselves
        if (referrer._id.toString() === new_user_id) {
            return res.status(400).json({
                success: false,
                message: 'You cannot refer yourself'
            });
        }

        // Update new user's referred_by field
        const newUser = await User.findById(new_user_id);
        if (!newUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user already has a referrer
        if (newUser.referred_by) {
            return res.status(400).json({
                success: false,
                message: 'User already has a referrer'
            });
        }

        newUser.referred_by = referrer._id;
        await newUser.save();

        // Create referral record
        const referral = new Referral({
            referrer_id: referrer._id,
            referred_user_id: new_user_id,
            referral_code: referral_code,
            status: 'pending'
        });
        await referral.save();

        // Update referrer's total referrals count
        referrer.total_referrals += 1;
        await referrer.save();

        res.json({
            success: true,
            message: 'Referral code applied successfully',
            referrer: {
                username: referrer.username
            }
        });
    } catch (error) {
        console.error('Apply Referral Code Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error applying referral code',
            error: error.message
        });
    }
};

// Award points when referral joins first campaign
export const awardReferralPoints = async (userId) => {
    try {
        // Check if this is user's first campaign submission
        const submissionCount = await CampaignSubmission.countDocuments({ user_id: userId });

        if (submissionCount !== 1) {
            // Not first submission, no points to award
            return { success: false, message: 'Not first submission' };
        }

        // Find if this user was referred
        const newUser = await User.findById(userId);
        if (!newUser || !newUser.referred_by) {
            return { success: false, message: 'User was not referred' };
        }

        // Find the referral record
        const referral = await Referral.findOne({
            referred_user_id: userId,
            status: 'pending'
        });

        if (!referral) {
            return { success: false, message: 'Referral record not found' };
        }

        // Award 500 points to referrer
        const REFERRAL_POINTS = 500;
        const referrer = await User.findById(newUser.referred_by);

        if (referrer) {
            referrer.points += REFERRAL_POINTS;
            referrer.successful_referrals += 1;
            await referrer.save();

            // Update referral status
            referral.status = 'completed';
            referral.points_awarded = REFERRAL_POINTS;
            referral.completed_at = new Date();
            await referral.save();

            console.log(`✅ Awarded ${REFERRAL_POINTS} points to ${referrer.username || referrer.mobile_number} for referring ${newUser.username || newUser.mobile_number}`);

            return {
                success: true,
                message: `${REFERRAL_POINTS} points awarded to referrer`,
                pointsAwarded: REFERRAL_POINTS
            };
        }

        return { success: false, message: 'Referrer not found' };
    } catch (error) {
        console.error('Award Referral Points Error:', error);
        return { success: false, error: error.message };
    }
};

// Get referral stats for user
export const getReferralStats = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).select('points referral_code total_referrals successful_referrals');

        const pendingReferrals = await Referral.countDocuments({
            referrer_id: userId,
            status: 'pending'
        });

        const completedReferrals = await Referral.countDocuments({
            referrer_id: userId,
            status: 'completed'
        });

        res.json({
            success: true,
            stats: {
                referralCode: user.referral_code,
                currentPoints: user.points,
                totalReferrals: user.total_referrals,
                pendingReferrals,
                completedReferrals,
                pointsEarned: completedReferrals * 500
            }
        });
    } catch (error) {
        console.error('Get Referral Stats Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching referral stats',
            error: error.message
        });
    }
};

