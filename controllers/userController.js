import User from '../models/User.js';
import axios from 'axios';

// Create or update user after OTP verification
export const createOrUpdateUser = async (req, res) => {
    try {
        const { mobile_number, username } = req.body;

        if (!mobile_number) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number is required'
            });
        }

        // Check if user already exists
        let user = await User.findOne({ mobile_number });

        if (user) {
            // Update existing user
            user.status = 'verified';
            if (username) {
                user.username = username;
            }
            await user.save();

            return res.json({
                success: true,
                message: 'User verified successfully',
                user: {
                    id: user._id,
                    mobile_number: user.mobile_number,
                    username: user.username,
                    bio: user.bio,
                    avatar: user.avatar,
                    status: user.status,
                    points: user.points,
                    referral_code: user.referral_code
                }
            });
        } else {
            // Create new user
            user = new User({
                mobile_number,
                username: username || null,
                status: 'verified'
            });

            await user.save();

            return res.status(201).json({
                success: true,
                message: 'User created successfully',
                user: {
                    id: user._id,
                    mobile_number: user.mobile_number,
                    username: user.username,
                    bio: user.bio,
                    avatar: user.avatar,
                    status: user.status,
                    points: user.points,
                    referral_code: user.referral_code
                }
            });
        }
    } catch (error) {
        console.error('Create/Update User Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating/updating user',
            error: error.message
        });
    }
};

// Get user by mobile number
export const getUserByMobile = async (req, res) => {
    try {
        const { mobile_number } = req.params;

        const user = await User.findOne({ mobile_number });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                mobile_number: user.mobile_number,
                username: user.username,
                bio: user.bio,
                avatar: user.avatar,
                status: user.status,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error('Get User Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user',
            error: error.message
        });
    }
};

// Get all users
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            count: users.length,
            users: users.map(user => ({
                id: user._id,
                mobile_number: user.mobile_number,
                username: user.username,
                bio: user.bio,
                avatar: user.avatar,
                status: user.status,
                points: user.points,
                referral_code: user.referral_code,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }))
        });
    } catch (error) {
        console.error('Get All Users Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching users',
            error: error.message
        });
    }
};

// Update username and password
export const updateUsername = async (req, res) => {
    try {
        const { mobile_number, username, password } = req.body;

        if (!mobile_number) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number is required'
            });
        }

        if (!username || !username.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Username is required'
            });
        }

        if (!password || !password.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Password is required'
            });
        }

        const user = await User.findOne({ mobile_number });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update username if provided and not empty
        if (username && username.trim()) {
            user.username = username.trim();
        }

        // Update password if provided
        if (password) {
            user.password = password; // Will be hashed by pre-save hook
        }

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                mobile_number: user.mobile_number,
                username: user.username,
                bio: user.bio,
                avatar: user.avatar,
                status: user.status,
                hasPassword: !!user.password
            }
        });
    } catch (error) {
        console.error('Update Profile Error:', error);

        // Check for duplicate username error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Username already taken'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: error.message
        });
    }
};

// Sign in with username and password
export const signInWithPassword = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        // Find user by username
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        res.json({
            success: true,
            message: 'Sign in successful',
            user: {
                id: user._id,
                mobile_number: user.mobile_number,
                username: user.username,
                bio: user.bio,
                avatar: user.avatar,
                status: user.status,
                points: user.points,
                referral_code: user.referral_code
            }
        });
    } catch (error) {
        console.error('Sign In Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error signing in',
            error: error.message
        });
    }
};

// Request OTP for mobile sign in
export const requestOTPSignIn = async (req, res) => {
    try {
        const { mobile_number } = req.body;

        if (!mobile_number) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number is required'
            });
        }

        // Check if user exists
        const user = await User.findOne({ mobile_number });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this mobile number'
            });
        }

        // Send OTP via MSG91
        const MSG91_AUTH_KEY = '359982A8vCrxRiouE6751fc50P1';
        const MSG91_TEMPLATE_ID = '68e7558206919a034322f582';

        const response = await axios.post(
            `https://control.msg91.com/api/v5/otp?mobile=91${mobile_number}&authkey=${MSG91_AUTH_KEY}&template_id=${MSG91_TEMPLATE_ID}&otp_length=4&realTimeResponse=1`,
            {
                Param1: 'ArtAdventureHub',
                Param2: 'Sign In',
                Param3: 'Welcome Back'
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            message: 'OTP sent successfully',
            data: response.data
        });
    } catch (error) {
        console.error('Request OTP Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending OTP',
            error: error.response?.data || error.message
        });
    }
};

// Sign in with mobile and OTP
export const signInWithOTP = async (req, res) => {
    try {
        const { mobile_number, otp } = req.body;

        if (!mobile_number || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number and OTP are required'
            });
        }

        // Verify OTP with MSG91
        const MSG91_AUTH_KEY = '359982A8vCrxRiouE6751fc50P1';

        const response = await axios.get(
            `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=91${mobile_number}`,
            {
                headers: {
                    'authkey': MSG91_AUTH_KEY
                }
            }
        );

        if (response.data.type !== 'success') {
            return res.status(400).json({
                success: false,
                message: response.data.message || 'Invalid OTP'
            });
        }

        // Find user
        const user = await User.findOne({ mobile_number });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Sign in successful',
            user: {
                id: user._id,
                mobile_number: user.mobile_number,
                username: user.username,
                bio: user.bio,
                avatar: user.avatar,
                status: user.status,
                points: user.points,
                referral_code: user.referral_code
            }
        });
    } catch (error) {
        console.error('Sign In with OTP Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error signing in',
            error: error.response?.data || error.message
        });
    }
};

// Update username for authenticated user
export const updateUsernameAuth = async (req, res) => {
    try {
        const { username } = req.body;
        const userId = req.user?.id; // Assuming middleware adds user to req

        if (!username) {
            return res.status(400).json({
                success: false,
                message: 'Username is required'
            });
        }

        // Validate username format
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({
                success: false,
                message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores'
            });
        }

        // Check if username is already taken
        const existingUser = await User.findOne({ username, _id: { $ne: userId } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Username already taken'
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.username = username;
        await user.save();

        res.json({
            success: true,
            message: 'Username updated successfully',
            user: {
                id: user._id,
                mobile_number: user.mobile_number,
                username: user.username,
                bio: user.bio,
                avatar: user.avatar,
                status: user.status
            }
        });
    } catch (error) {
        console.error('Update Username Error:', error);

        // Check for duplicate username error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Username already taken'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error updating username',
            error: error.message
        });
    }
};

// Request password reset with OTP
export const requestPasswordReset = async (req, res) => {
    try {
        const { mobile_number } = req.body;

        if (!mobile_number) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number is required'
            });
        }

        // Find user by mobile number
        const user = await User.findOne({ mobile_number });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found with this mobile number'
            });
        }

        // Check if user has a username and password set
        if (!user.username || !user.password) {
            return res.status(400).json({
                success: false,
                message: 'No password set for this account. Please sign up first.'
            });
        }

        // Send OTP via MSG91 for password reset
        const MSG91_AUTH_KEY = '359982A8vCrxRiouE6751fc50P1';
        const MSG91_TEMPLATE_ID = '68e7558206919a034322f582';

        const response = await axios.post(
            `https://control.msg91.com/api/v5/otp?mobile=91${mobile_number}&authkey=${MSG91_AUTH_KEY}&template_id=${MSG91_TEMPLATE_ID}&otp_length=4&realTimeResponse=1`,
            {
                Param1: 'ArtAdventureHub',
                Param2: 'Password Reset',
                Param3: 'Reset Your Password'
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('MSG91 Password Reset OTP Response:', response.data);

        res.json({
            success: true,
            message: 'OTP sent successfully for password reset',
            data: {
                mobile_number: mobile_number,
                username: user.username,
                msg91_response: response.data
            }
        });

    } catch (error) {
        console.error('Request Password Reset Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error requesting password reset',
            error: error.message
        });
    }
};

// Reset password with OTP verification
export const resetPasswordWithOTP = async (req, res) => {
    try {
        const { mobile_number, otp, new_password } = req.body;

        if (!mobile_number || !otp || !new_password) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number, OTP, and new password are required'
            });
        }

        if (new_password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        // Find user by mobile number
        const user = await User.findOne({ mobile_number });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify OTP with MSG91
        const MSG91_AUTH_KEY = '359982A8vCrxRiouE6751fc50P1';

        const response = await axios.get(
            `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=91${mobile_number}`,
            {
                headers: {
                    'authkey': MSG91_AUTH_KEY
                }
            }
        );

        console.log('MSG91 Password Reset Verify Response:', response.data);

        if (response.data.type !== 'success') {
            return res.status(400).json({
                success: false,
                message: response.data.message || 'Invalid OTP'
            });
        }

        // Update password
        user.password = new_password;
        await user.save();

        res.json({
            success: true,
            message: 'Password reset successfully',
            data: {
                username: user.username,
                mobile_number: user.mobile_number
            }
        });

    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error resetting password',
            error: error.message
        });
    }
};

// Get user profile by ID
export const getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;

        console.log('📍 Get Profile Request for userId:', userId);

        // Validate MongoDB ObjectId format
        if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
            console.log('❌ Invalid user ID format:', userId);
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID format'
            });
        }

        const user = await User.findById(userId).select('-password');

        if (!user) {
            console.log('❌ User not found for ID:', userId);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('✅ User profile found:', user.username || user.mobile_number);

        res.json({
            success: true,
            user: {
                id: user._id,
                mobile_number: user.mobile_number,
                username: user.username,
                bio: user.bio,
                avatar: user.avatar,
                status: user.status,
                points: user.points,
                referral_code: user.referral_code,
                wallet: user.wallet || {
                    deposit_balance: 0,
                    winning_balance: 0,
                    total_deposited: 0,
                    total_earned: 0,
                    total_withdrawn: 0
                },
                withdrawal_details: user.withdrawal_details || { upi_id: '', bank_details: {} },
                total_referrals: user.total_referrals,
                successful_referrals: user.successful_referrals,
                contests_participated: user.contests_participated || 0,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error('❌ Get User Profile Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user profile',
            error: error.message
        });
    }
};

// Update user profile (bio, avatar ONLY - username is immutable)
export const updateUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const { bio, avatar } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Username is immutable - cannot be changed via this endpoint
        // Users can only set username once via updateUsername endpoint

        // Update bio if provided
        if (bio !== undefined) {
            if (bio.length > 200) {
                return res.status(400).json({
                    success: false,
                    message: 'Bio must not exceed 200 characters'
                });
            }
            user.bio = bio;
        }

        // Update avatar if provided
        if (avatar !== undefined) {
            user.avatar = avatar;
        }

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                mobile_number: user.mobile_number,
                username: user.username,
                bio: user.bio,
                avatar: user.avatar,
                status: user.status
            }
        });
    } catch (error) {
        console.error('Update Profile Error:', error);

        res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: error.message
        });
    }
};

