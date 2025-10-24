import express from 'express';
import {
    subscribe,
    unsubscribe,
    getPublicKey,
    getUserSubscriptions,
    broadcastNotification,
    sendTestNotification,
    sendToUser,
    sendToCampaignParticipants,
    getStats
} from '../controllers/pushNotificationController.js';

const router = express.Router();

// ============ PUBLIC ROUTES ============

// Get VAPID public key (needed for frontend subscription)
router.get('/public-key', getPublicKey);

// Subscribe to push notifications
router.post('/subscribe', subscribe);

// Unsubscribe from push notifications
router.post('/unsubscribe', unsubscribe);

// ============ USER ROUTES ============

// Get user's active subscriptions
router.get('/user/:user_id/subscriptions', getUserSubscriptions);

// Send test notification to user
router.post('/test', sendTestNotification);

// ============ ADMIN ROUTES (should add auth middleware later) ============

// Get push notification statistics
router.get('/stats', getStats);

// Broadcast notification to all users
router.post('/broadcast', broadcastNotification);

// Send notification to specific user
router.post('/send-to-user', sendToUser);

// Send notification to campaign participants
router.post('/send-to-campaign-participants', sendToCampaignParticipants);

export default router;

