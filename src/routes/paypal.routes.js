const express = require('express');
const router = express.Router();
const paypalService = require('../services/paypal.service');
const authMiddleware = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

/**
 * GET /api/paypal/plans
 * Get available PayPal plans
 */
router.get('/plans', (req, res) => {
  const plans = paypalService.getPlans();
  res.json({ success: true, plans });
});

/**
 * POST /api/paypal/create-subscription
 * Create PayPal subscription and return approval URL
 */
router.post('/create-subscription', authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user.id;

    if (!['pro', 'scale'].includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan. Choose pro or scale.'
      });
    }

    const result = await paypalService.createSubscription(userId, plan);

    res.json({
      success: true,
      subscriptionId: result.subscriptionId,
      approvalUrl: result.approvalUrl
    });
  } catch (error) {
    logger.error('Create PayPal subscription error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create subscription'
    });
  }
});

/**
 * GET /api/paypal/success
 * Handle PayPal success redirect (frontend handles this)
 */
router.get('/success', async (req, res) => {
  try {
    const { subscription_id, ba_token, token } = req.query;

    if (!subscription_id) {
      return res.redirect(`${process.env.DASHBOARD_URL}/settings/account?paypal=error&message=no_subscription`);
    }

    // Verify subscription status
    const subscription = await paypalService.verifySubscription(subscription_id);

    // Find local subscription record
    const localSubscription = await require('../config/database').subscription.findFirst({
      where: { stripe_subscription_id: subscription_id }
    });

    if (localSubscription && subscription.status === 'ACTIVE') {
      // Update to active
      await require('../config/database').subscription.update({
        where: { id: localSubscription.id },
        data: {
          status: 'active',
          current_period_start: new Date(subscription.start_time),
          current_period_end: new Date(subscription.billing_info?.next_billing_time)
        }
      });

      logger.info(`PayPal subscription ${subscription_id} activated via return URL`);
    }

    // Redirect to frontend with success
    res.redirect(`${process.env.DASHBOARD_URL}/settings/account?paypal=success`);
  } catch (error) {
    logger.error('PayPal success handler error:', error);
    res.redirect(`${process.env.DASHBOARD_URL}/settings/account?paypal=error`);
  }
});

/**
 * GET /api/paypal/cancel
 * Handle PayPal cancel redirect
 */
router.get('/cancel', async (req, res) => {
  const { subscription_id } = req.query;

  if (subscription_id) {
    try {
      // Find and update subscription
      const localSubscription = await require('../config/database').subscription.findFirst({
        where: { stripe_subscription_id: subscription_id }
      });

      if (localSubscription) {
        await require('../config/database').subscription.update({
          where: { id: localSubscription.id },
          data: { status: 'cancelled' }
        });
      }
    } catch (error) {
      logger.error('PayPal cancel handler error:', error);
    }
  }

  res.redirect(`${process.env.DASHBOARD_URL}/settings/account?paypal=cancelled`);
});

/**
 * POST /api/paypal/webhook
 * Handle PayPal webhook events
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify webhook signature
    const isValid = await paypalService.verifyWebhookSignature(req.headers, req.body);

    if (!isValid) {
      logger.warn('Invalid PayPal webhook signature');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    // Parse the event
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Handle the event
    await paypalService.handleWebhookEvent(event);

    res.json({ success: true });
  } catch (error) {
    logger.error('PayPal webhook error:', error);
    res.status(500).json({ success: false, error: 'Webhook handler failed' });
  }
});

/**
 * POST /api/paypal/cancel-subscription
 * Cancel PayPal subscription
 */
router.post('/cancel-subscription', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's subscription
    const subscription = await require('../config/database').subscription.findUnique({
      where: { user_id: userId }
    });

    if (!subscription || !subscription.stripe_subscription_id) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    // Cancel in PayPal
    await paypalService.cancelSubscription(subscription.stripe_subscription_id, 'User requested cancellation');

    // Update local record
    await require('../config/database').subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'cancelled',
        cancel_at_period_end: true
      }
    });

    res.json({ success: true, message: 'Subscription cancelled successfully' });
  } catch (error) {
    logger.error('Cancel PayPal subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
});

/**
 * GET /api/paypal/subscription/:id/status
 * Get PayPal subscription status
 */
router.get('/subscription/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const subscription = await paypalService.getSubscriptionDetails(id);

    res.json({
      success: true,
      status: subscription.status,
      nextBillingTime: subscription.billing_info?.next_billing_time
    });
  } catch (error) {
    logger.error('Get PayPal subscription status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription status'
    });
  }
});

module.exports = router;