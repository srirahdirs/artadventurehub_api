import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import userRoutes from './routes/userRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import referralRoutes from './routes/referralRoutes.js';
import withdrawalRoutes from './routes/withdrawalRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3033; // ✅ match your nginx config

// ✅ Increase payload limit for uploads (base64 / large images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ Allowed origins (only your sites)
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3001',
    'http://localhost:3033',
    'http://localhost:5000',
    'https://artadventurehub.com',
    'https://www.artadventurehub.com'
];

// ✅ Global CORS Middleware
app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps, curl, postman, or direct navigation)
            if (!origin) {
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                console.log('❌ CORS blocked for:', origin);
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);

// ✅ Serve uploads folder (with proper headers)
app.use(
    '/uploads',
    (req, res, next) => {
        const origin = req.headers.origin;
        if (allowedOrigins.includes(origin)) {
            res.header('Access-Control-Allow-Origin', origin);
            res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            res.header('Access-Control-Allow-Credentials', 'true');
        }
        if (req.method === 'OPTIONS') return res.sendStatus(200);
        next();
    },
    express.static(path.join(__dirname, 'uploads'))
);

// ✅ Optional: direct download endpoint
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', filename);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Download error:', err);
            res.status(404).json({ error: 'File not found' });
        }
    });
});

// ✅ MongoDB Connection with proper options
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 30000, // 30 seconds
            socketTimeoutMS: 45000, // 45 seconds
            bufferCommands: true, // Enable buffering to prevent connection issues
            maxPoolSize: 10,
            minPoolSize: 5,
            maxIdleTimeMS: 30000,
            connectTimeoutMS: 30000,
        });
        console.log('✅ Connected to MongoDB');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    }
};

// Connect to MongoDB before starting server
connectDB();

// ✅ Routes
app.use('/api/users', userRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api', uploadRoutes);

// ✅ MSG91 Configuration (keep these in .env for safety)
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY || '359982A8vCrxRiouE6751fc50P1';
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || '68e7558206919a034322f582';

// ✅ OTP Routes
app.post('/api/otp/send', async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile || mobile.length !== 10) {
            return res.status(400).json({ success: false, message: 'Invalid mobile number' });
        }

        const response = await axios.post(
            `https://control.msg91.com/api/v5/otp?mobile=91${mobile}&authkey=${MSG91_AUTH_KEY}&template_id=${MSG91_TEMPLATE_ID}&otp_length=4&realTimeResponse=1`,
            { Param1: 'ArtAdventureHub', Param2: 'Registration', Param3: 'Welcome' },
            { headers: { 'Content-Type': 'application/json' } }
        );

        console.log('MSG91 Send Response:', response.data);
        res.json({ success: true, message: 'OTP sent successfully', data: response.data });
    } catch (error) {
        console.error('OTP Send Error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
            error: error.response?.data || error.message,
        });
    }
});

app.post('/api/otp/verify', async (req, res) => {
    try {
        const { mobile, otp } = req.body;
        if (!mobile || !otp) {
            return res.status(400).json({ success: false, message: 'Mobile and OTP required' });
        }

        const response = await axios.get(
            `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=91${mobile}`,
            { headers: { authkey: MSG91_AUTH_KEY } }
        );

        console.log('MSG91 Verify Response:', response.data);

        if (response.data.type === 'success') {
            const User = (await import('./models/User.js')).default;
            let user = await User.findOne({ mobile_number: mobile });

            if (user) {
                user.status = 'verified';
                await user.save();
            } else {
                user = new User({ mobile_number: mobile, status: 'verified' });
                await user.save();
            }

            res.json({
                success: true,
                message: 'OTP verified successfully',
                user: {
                    id: user._id,
                    mobile_number: user.mobile_number,
                    username: user.username,
                    bio: user.bio,
                    avatar: user.avatar,
                    status: user.status,
                    points: user.points,
                    referral_code: user.referral_code,
                },
            });
        } else {
            res.status(400).json({
                success: false,
                message: response.data.message || 'OTP verification failed',
            });
        }
    } catch (error) {
        console.error('OTP Verify Error:', error.response?.data || error.message);
        res.status(400).json({
            success: false,
            message: 'Invalid OTP',
            error: error.response?.data || error.message,
        });
    }
});

app.post('/api/otp/resend', async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile || mobile.length !== 10) {
            return res.status(400).json({ success: false, message: 'Invalid mobile number' });
        }

        const response = await axios.post(
            `https://control.msg91.com/api/v5/otp/retry?mobile=91${mobile}&authkey=${MSG91_AUTH_KEY}&retrytype=text`,
            {},
            { headers: { 'Content-Type': 'application/json' } }
        );

        console.log('MSG91 Resend Response:', response.data);
        res.json({ success: true, message: 'OTP resent successfully', data: response.data });
    } catch (error) {
        console.error('OTP Resend Error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to resend OTP',
            error: error.response?.data || error.message,
        });
    }
});

// ✅ Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running ✅' });
});

// ✅ Start server
app.listen(3033, () => {
    console.log(`🚀 API running on port 3033`);
});
