import express from 'express';
import {
    createOrUpdateUser,
    getUserByMobile,
    getAllUsers,
    updateUsername,
    updateUsernameAuth,
    signInWithPassword,
    requestOTPSignIn,
    signInWithOTP,
    requestPasswordReset,
    resetPasswordWithOTP,
    getUserProfile,
    updateUserProfile,
    searchUsers
} from '../controllers/userController.js';

const router = express.Router();

// Simple auth middleware
const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        // For simplicity, we'll decode the user from localStorage
        // In production, you should use JWT tokens
        const user = JSON.parse(Buffer.from(token, 'base64').toString());
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
};

// Create or update user
router.post('/create', createOrUpdateUser);

// Search users (must come before other GET routes)
router.get('/search', searchUsers);

// Get all users
router.get('/', getAllUsers);

// Authentication routes
router.post('/signin/password', signInWithPassword);
router.post('/signin/otp/request', requestOTPSignIn);
router.post('/signin/otp/verify', signInWithOTP);

// Password reset routes
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPasswordWithOTP);

// Update username and password
router.put('/username', updateUsername);

// Update username for authenticated user
router.put('/update-username', authMiddleware, updateUsernameAuth);

// Profile routes (must come before :mobile_number route)
router.get('/:userId/profile', getUserProfile);
router.put('/:userId/profile', updateUserProfile);

// Get user by mobile number (must be last to avoid conflicts)
router.get('/:mobile_number', getUserByMobile);

export default router;

