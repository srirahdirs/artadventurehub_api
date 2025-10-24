import webPush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

// VAPID configuration state
let isConfigured = false;

// Configure web-push with VAPID keys (lazy load - called when needed)
const ensureConfigured = () => {
    if (isConfigured) return true;

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:yzentechnologies@gmail.com';

    if (!publicKey || !privateKey) {
        console.warn('⚠️ VAPID keys not configured! Push notifications will not work.');
        return false;
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);
    console.log('✅ Web Push configured with VAPID keys');
    isConfigured = true;
    return true;
};

// Subscribe user to push notifications
export const subscribe = async (req, res) => {
    try {
        if (!ensureConfigured()) {
            return res.status(500).json({
                success: false,
                message: 'Push notifications not configured on server'
            });
        }

        const { user_id, subscription } = req.body;

        if (!user_id || !subscription) {
            return res.status(400).json({
                success: false,
                message: 'User ID and subscription are required'
            });
        }

        // Detect device type from user agent
        const userAgent = req.headers['user-agent'] || '';
        let deviceType = 'unknown';
        let browser = 'unknown';

        if (/mobile/i.test(userAgent)) {
            deviceType = 'mobile';
        } else if (/tablet/i.test(userAgent)) {
            deviceType = 'tablet';
        } else {
            deviceType = 'desktop';
        }

        if (/chrome/i.test(userAgent)) browser = 'Chrome';
        else if (/firefox/i.test(userAgent)) browser = 'Firefox';
        else if (/safari/i.test(userAgent)) browser = 'Safari';
        else if (/edge/i.test(userAgent)) browser = 'Edge';

        // Check if subscription already exists
        let existingSub = await PushSubscription.findOne({
            endpoint: subscription.endpoint
        });

        if (existingSub) {
            // Update existing subscription
            existingSub.user_id = user_id;
            existingSub.keys = subscription.keys;
            existingSub.last_used = Date.now();
            existingSub.active = true;
            existingSub.user_agent = userAgent;
            existingSub.device_type = deviceType;
            existingSub.browser = browser;
            await existingSub.save();

            console.log(`🔔 Updated push subscription for user: ${user_id} (${deviceType})`);

            return res.json({
                success: true,
                message: 'Subscription updated successfully',
                device_type: deviceType
            });
        }

        // Create new subscription
        const newSubscription = new PushSubscription({
            user_id,
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            user_agent: userAgent,
            device_type: deviceType,
            browser
        });

        await newSubscription.save();

        console.log(`🔔 New push subscription for user: ${user_id} (${deviceType})`);

        res.json({
            success: true,
            message: 'Subscribed to push notifications successfully',
            device_type: deviceType
        });
    } catch (error) {
        console.error('Subscribe Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error subscribing to notifications',
            error: error.message
        });
    }
};

// Unsubscribe user from push notifications
export const unsubscribe = async (req, res) => {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({
                success: false,
                message: 'Endpoint is required'
            });
        }

        const subscription = await PushSubscription.findOne({ endpoint });

        if (subscription) {
            await subscription.deactivate();
            console.log(`🔕 Unsubscribed: ${subscription.user_id}`);
        }

        res.json({
            success: true,
            message: 'Unsubscribed successfully'
        });
    } catch (error) {
        console.error('Unsubscribe Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error unsubscribing',
            error: error.message
        });
    }
};

// Get VAPID public key (for frontend)
export const getPublicKey = (req, res) => {
    if (!ensureConfigured()) {
        return res.status(500).json({
            success: false,
            message: 'Push notifications not configured'
        });
    }

    res.json({
        success: true,
        publicKey: process.env.VAPID_PUBLIC_KEY
    });
};

// Get user's active subscriptions
export const getUserSubscriptions = async (req, res) => {
    try {
        const { user_id } = req.params;

        const subscriptions = await PushSubscription.find({
            user_id,
            active: true
        }).select('device_type browser created_at last_used');

        res.json({
            success: true,
            count: subscriptions.length,
            subscriptions
        });
    } catch (error) {
        console.error('Get Subscriptions Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching subscriptions',
            error: error.message
        });
    }
};

// Send push notification to specific user
export const sendNotificationToUser = async (userId, payload) => {
    try {
        if (!ensureConfigured()) {
            console.warn('⚠️ Cannot send notification: Push not configured');
            return { success: false, message: 'Push not configured' };
        }

        // Get all active subscriptions for this user
        const subscriptions = await PushSubscription.find({
            user_id: userId,
            active: true
        });

        if (subscriptions.length === 0) {
            console.log(`📭 No active subscriptions for user: ${userId}`);
            return { success: false, message: 'No active subscriptions' };
        }

        const notificationPayload = JSON.stringify(payload);
        const results = [];
        let successCount = 0;
        let failCount = 0;

        // Send to all user's devices
        for (const subscription of subscriptions) {
            try {
                await webPush.sendNotification(
                    {
                        endpoint: subscription.endpoint,
                        keys: subscription.keys
                    },
                    notificationPayload
                );

                // Update last_used
                await subscription.updateLastUsed();

                results.push({ success: true, device: subscription.device_type });
                successCount++;

                console.log(`✅ Push sent to ${userId} (${subscription.device_type})`);
            } catch (error) {
                console.error(`❌ Push failed for ${userId}:`, error.message);

                // If subscription is no longer valid (410 Gone), deactivate it
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await subscription.deactivate();
                    console.log(`🗑️  Removed invalid subscription for ${userId}`);
                }

                results.push({ success: false, device: subscription.device_type, error: error.message });
                failCount++;
            }
        }

        return {
            success: successCount > 0,
            sent: successCount,
            failed: failCount,
            results
        };
    } catch (error) {
        console.error('Send Notification Error:', error);
        return { success: false, error: error.message };
    }
};

// Send notification to multiple users (broadcast to specific users)
export const sendNotificationToMultipleUsers = async (userIds, payload) => {
    try {
        const results = await Promise.all(
            userIds.map(userId => sendNotificationToUser(userId, payload))
        );

        const totalSent = results.reduce((sum, r) => sum + (r.sent || 0), 0);
        const totalFailed = results.reduce((sum, r) => sum + (r.failed || 0), 0);

        return {
            success: true,
            total_users: userIds.length,
            total_sent: totalSent,
            total_failed: totalFailed,
            results
        };
    } catch (error) {
        console.error('Broadcast to Users Error:', error);
        return { success: false, error: error.message };
    }
};

// Send notification to all users (admin broadcast)
export const broadcastNotification = async (req, res) => {
    try {
        if (!isConfigured) {
            return res.status(500).json({
                success: false,
                message: 'Push notifications not configured'
            });
        }

        const { title, body, icon, url, tag } = req.body;

        if (!title || !body) {
            return res.status(400).json({
                success: false,
                message: 'Title and body are required'
            });
        }

        // Get all active subscriptions
        const subscriptions = await PushSubscription.find({ active: true });

        if (subscriptions.length === 0) {
            return res.json({
                success: true,
                message: 'No active subscriptions',
                sent: 0
            });
        }

        const payload = JSON.stringify({
            title,
            body,
            icon: icon || '/logo_purple.png',
            url: url || '/',
            tag: tag || 'broadcast'
        });

        let sent = 0;
        let failed = 0;

        console.log(`📢 Broadcasting to ${subscriptions.length} subscriptions...`);

        // Send to all subscriptions (with rate limiting)
        for (const subscription of subscriptions) {
            try {
                await webPush.sendNotification(
                    {
                        endpoint: subscription.endpoint,
                        keys: subscription.keys
                    },
                    payload
                );
                sent++;
                await subscription.updateLastUsed();
            } catch (error) {
                failed++;

                // Deactivate invalid subscriptions
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await subscription.deactivate();
                }
            }

            // Small delay to avoid overwhelming the push service
            if (sent % 100 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`📢 Broadcast complete: ${sent} sent, ${failed} failed`);

        res.json({
            success: true,
            message: 'Broadcast sent',
            sent,
            failed,
            total: subscriptions.length
        });
    } catch (error) {
        console.error('Broadcast Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error broadcasting notification',
            error: error.message
        });
    }
};

// Test notification endpoint
export const sendTestNotification = async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const result = await sendNotificationToUser(user_id, {
            title: '🎨 Test Notification',
            body: 'Push notifications are working! You\'ll get updates about contests, winners, and more.',
            icon: '/logo_purple.png',
            url: '/',
            tag: 'test-notification'
        });

        res.json({
            success: result.success,
            message: result.success ? 'Test notification sent!' : 'Failed to send test notification',
            details: result
        });
    } catch (error) {
        console.error('Test Notification Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending test notification',
            error: error.message
        });
    }
};

// Send notification to specific user (admin endpoint)
export const sendToUser = async (req, res) => {
    try {
        const { user_id, title, body, icon, url, tag } = req.body;

        if (!user_id || !title || !body) {
            return res.status(400).json({
                success: false,
                message: 'User ID, title, and body are required'
            });
        }

        const result = await sendNotificationToUser(user_id, {
            title,
            body,
            icon: icon || '/logo_purple.png',
            url: url || '/',
            tag: tag || `admin-notification-${Date.now()}`
        });

        res.json(result);
    } catch (error) {
        console.error('Send To User Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending notification to user',
            error: error.message
        });
    }
};

// Send notification to campaign participants
export const sendToCampaignParticipants = async (req, res) => {
    try {
        const { campaign_id, title, body, icon, url, tag } = req.body;

        if (!campaign_id || !title || !body) {
            return res.status(400).json({
                success: false,
                message: 'Campaign ID, title, and body are required'
            });
        }

        // Import dynamically to avoid circular dependency
        const { default: CampaignSubmission } = await import('../models/CampaignSubmission.js');

        // Get all participants of this campaign
        const submissions = await CampaignSubmission.find({
            campaign_id,
            is_draft: false
        }).distinct('user_id');

        if (submissions.length === 0) {
            return res.json({
                success: true,
                message: 'No participants found',
                sent: 0,
                failed: 0
            });
        }

        console.log(`📢 Sending to ${submissions.length} campaign participants...`);

        const result = await sendNotificationToMultipleUsers(submissions, {
            title,
            body,
            icon: icon || '/logo_purple.png',
            url: url || '/',
            tag: tag || `campaign-${campaign_id}`
        });

        res.json({
            success: true,
            message: `Notification sent to ${result.total_sent} participants`,
            sent: result.total_sent,
            failed: result.total_failed
        });
    } catch (error) {
        console.error('Send To Campaign Participants Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending notification to participants',
            error: error.message
        });
    }
};

// Get push notification statistics
export const getStats = async (req, res) => {
    try {
        const totalSubscriptions = await PushSubscription.countDocuments({ active: true });
        const mobileSubscriptions = await PushSubscription.countDocuments({ active: true, device_type: 'mobile' });
        const desktopSubscriptions = await PushSubscription.countDocuments({ active: true, device_type: 'desktop' });

        // Get unique users with active subscriptions
        const uniqueUsers = await PushSubscription.distinct('user_id', { active: true });

        res.json({
            success: true,
            total_subscriptions: totalSubscriptions,
            unique_users: uniqueUsers.length,
            mobile_subscriptions: mobileSubscriptions,
            desktop_subscriptions: desktopSubscriptions
        });
    } catch (error) {
        console.error('Get Stats Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching statistics',
            error: error.message
        });
    }
};

export default {
    subscribe,
    unsubscribe,
    getPublicKey,
    getUserSubscriptions,
    sendNotificationToUser,
    sendNotificationToMultipleUsers,
    broadcastNotification,
    sendTestNotification,
    sendToUser,
    sendToCampaignParticipants,
    getStats
};

