import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import userRoutes from './routes/userRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;


const allowedOrigins = [
    'http://localhost:5173',
    'https://artadventurehub.com',
    'https://www.artadventurehub.com'
];

// ✅ Apply CORS globally (handles all routes including /api and /uploads)
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (for mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            return callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Handle preflight globally (optional, improves compatibility)
app.options('*', cors());

// ✅ Serve static files (no need for duplicate CORS logic)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Special route for downloading images
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', filename);

    // Set headers to force download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Send the file
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Download error:', err);
            res.status(404).json({ error: 'File not found' });
        }
    });
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001', 'https://artadventurehub.com', 'https://www.artadventurehub.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
// Increase payload size limit to 50MB for image uploads (base64 images can be large)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MSG91 Configuration
const MSG91_AUTH_KEY = '359982A8vCrxRiouE6751fc50P1';
const MSG91_TEMPLATE_ID = '68e7558206919a034322f582';

// Routes
app.use('/api/users', userRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api', uploadRoutes);

// Send OTP
app.post('/api/otp/send', async (req, res) => {
    try {
        const { mobile } = req.body;

        if (!mobile || mobile.length !== 10) {
            return res.status(400).json({
                success: false,
                message: 'Invalid mobile number'
            });
        }

        const response = await axios.post(
            `https://control.msg91.com/api/v5/otp?mobile=91${mobile}&authkey=${MSG91_AUTH_KEY}&template_id=${MSG91_TEMPLATE_ID}&otp_length=4&realTimeResponse=1`,
            {
                Param1: 'ArtAdventureHub',
                Param2: 'Registration',
                Param3: 'Welcome'
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('MSG91 Send Response:', response.data);

        res.json({
            success: true,
            message: 'OTP sent successfully',
            data: response.data
        });
    } catch (error) {
        console.error('OTP Send Error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
            error: error.response?.data || error.message
        });
    }
});

// Verify OTP
app.post('/api/otp/verify', async (req, res) => {
    try {
        const { mobile, otp } = req.body;

        if (!mobile || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number and OTP are required'
            });
        }

        const response = await axios.get(
            `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=91${mobile}`,
            {
                headers: {
                    'authkey': MSG91_AUTH_KEY
                }
            }
        );

        console.log('MSG91 Verify Response:', response.data);

        // Check if MSG91 verification was successful
        if (response.data.type === 'success') {
            // Create or update user in database
            const User = (await import('./models/User.js')).default;

            let user = await User.findOne({ mobile_number: mobile });

            if (user) {
                // Update existing user to verified
                user.status = 'verified';
                await user.save();
            } else {
                // Create new user (don't set username field at all - let it be undefined)
                const userData = {
                    mobile_number: mobile,
                    status: 'verified'
                };
                // Do not include username field at all if not provided
                user = new User(userData);
                await user.save();
            }

            res.json({
                success: true,
                message: 'OTP verified successfully',
                user: {
                    id: user._id,
                    mobile_number: user.mobile_number,
                    username: user.username,
                    status: user.status
                },
                data: response.data
            });
        } else {
            // OTP verification failed
            res.status(400).json({
                success: false,
                message: response.data.message || 'OTP verification failed',
                error: response.data
            });
        }
    } catch (error) {
        console.error('OTP Verify Error:', error.response?.data || error.message);
        res.status(400).json({
            success: false,
            message: 'Invalid OTP',
            error: error.response?.data || error.message
        });
    }
});

// Resend OTP
app.post('/api/otp/resend', async (req, res) => {
    try {
        const { mobile } = req.body;

        if (!mobile || mobile.length !== 10) {
            return res.status(400).json({
                success: false,
                message: 'Invalid mobile number'
            });
        }

        const response = await axios.post(
            `https://control.msg91.com/api/v5/otp/retry?mobile=91${mobile}&authkey=${MSG91_AUTH_KEY}&retrytype=text`,
            {},
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('MSG91 Resend Response:', response.data);

        res.json({
            success: true,
            message: 'OTP resent successfully',
            data: response.data
        });
    } catch (error) {
        console.error('OTP Resend Error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to resend OTP',
            error: error.response?.data || error.message
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

