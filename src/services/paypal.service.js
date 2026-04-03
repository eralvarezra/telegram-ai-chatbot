const prisma = require('../config/database');
const logger = require('../utils/logger');

// PayPal SDK will be initialized lazily
let paypal = null;

const getPayPal = () => {
  if (!paypal && process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
    paypal = require('@paypal/checkout-server-sdk');

    // Determine environment
    const environment = process.env.PAYPAL_MODE === 'live'
      ? new paypal.core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET)
      : new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);

    return new paypal.core.PayPalHttpClient(environment);
  }
  return null;
};

// Plan definitions for PayPal
const PAYPAL_PLANS = {
  pro: {
    name: 'Pro Plan',
    description: 'Professional plan with advanced features',
    price: 29.00,
    currency: 'USD',
    interval: 'MONTH',
    intervalCount: 1
  },
  scale: {
    name: 'Scale Plan',
    description: 'Enterprise plan with unlimited features',
    price: 99.00,
    currency: 'USD',
    interval: 'MONTH',
    intervalCount: 1
  }
};

/**
 * Get or create PayPal product
 */
const getOrCreateProduct = async () => {
  const productId = process.env.PAYPAL_PRODUCT_ID || 'SAAS_BOT_PLATFORM';

  // In production, you'd check if product exists first
  // For now, we'll create it each time or use existing
  return productId;
};

/**
 * Create a billing plan in PayPal
 */
const createBillingPlan = async (planKey) => {
  const client = getPayPal();
  if (!client) {
    throw new Error('PayPal not configured');
  }

  const planConfig = PAYPAL_PLANS[planKey];
  if (!planConfig) {
    throw new Error('Invalid plan');
  }

  const productId = await getOrCreateProduct();

  const request = new paypal.subscriptions.PlansCreateRequest();
  request.requestBody({
    product_id: productId,
    name: planConfig.name,
    description: planConfig.description,
    billing_cycles: [
      {
        frequency: {
          interval_unit: planConfig.interval,
          interval_count: planConfig.intervalCount.toString()
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0, // Infinite cycles
        pricing_scheme: {
          fixed_price: {
            value: planConfig.price.toString(),
            currency_code: planConfig.currency
          }
        }
      }
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: {
        value: '0',
        currency_code: 'USD'
      },
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3
    },
    taxes: {
      percentage: '0',
      inclusive: false
    }
  });

  try {
    const response = await client.execute(request);
    return response.result;
  } catch (error) {
    logger.error('Error creating PayPal plan:', error.message);
    throw error;
  }
};

/**
 * Create PayPal subscription
 */
const createSubscription = async (userId, planKey) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  const client = getPayPal();
  if (!client) {
    throw new Error('PayPal not configured');
  }

  const user = await prisma.adminUser.findUnique({
    where: { id: userIdInt }
  });

  if (!user) {
    throw new Error('User not found');
  }

  const planConfig = PAYPAL_PLANS[planKey];
  if (!planConfig) {
    throw new Error('Invalid plan');
  }

  // Get or create plan ID (in production, store this in DB)
  let planId = await getStoredPlanId(planKey);

  if (!planId) {
    // Create plan if not exists
    const plan = await createBillingPlan(planKey);
    planId = plan.id;
    await storePlanId(planKey, planId);
  }

  const request = new paypal.subscriptions.SubscriptionsCreateRequest();
  request.requestBody({
    plan_id: planId,
    subscriber: {
      name: {
        given_name: user.name?.split(' ')[0] || 'User',
        surname: user.name?.split(' ').slice(1).join(' ') || 'User'
      },
      email_address: user.email
    },
    application_context: {
      brand_name: process.env.APP_NAME || 'SaaS Platform',
      locale: 'en-US',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      payment_method: {
        payer_selected: 'PAYPAL',
        payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
      },
      return_url: `${process.env.DASHBOARD_URL}/settings/account?paypal=success`,
      cancel_url: `${process.env.DASHBOARD_URL}/settings/account?paypal=cancelled`
    }
  });

  try {
    const response = await client.execute(request);
    const subscription = response.result;

    // Find approval URL
    const approvalUrl = subscription.links?.find(l => l.rel === 'approve')?.href;

    // Store pending subscription
    await prisma.subscription.upsert({
      where: { user_id: userIdInt },
      create: {
        user_id: userIdInt,
        plan: planKey,
        status: 'pending',
        stripe_subscription_id: subscription.id, // Reuse field for PayPal subscription ID
        stripe_price_id: planId // Reuse field for PayPal plan ID
      },
      update: {
        plan: planKey,
        status: 'pending',
        stripe_subscription_id: subscription.id,
        stripe_price_id: planId
      }
    });

    logger.info(`Created PayPal subscription ${subscription.id} for user ${userIdInt}`);

    return {
      subscriptionId: subscription.id,
      approvalUrl
    };
  } catch (error) {
    logger.error('Error creating PayPal subscription:', error.message);
    throw error;
  }
};

/**
 * Verify PayPal subscription
 */
const verifySubscription = async (subscriptionId) => {
  const client = getPayPal();
  if (!client) {
    throw new Error('PayPal not configured');
  }

  const request = new paypal.subscriptions.SubscriptionsGetRequest(subscriptionId);

  try {
    const response = await client.execute(request);
    return response.result;
  } catch (error) {
    logger.error('Error verifying PayPal subscription:', error.message);
    throw error;
  }
};

/**
 * Cancel PayPal subscription
 */
const cancelSubscription = async (subscriptionId, reason = 'User requested cancellation') => {
  const client = getPayPal();
  if (!client) {
    throw new Error('PayPal not configured');
  }

  const request = new paypal.subscriptions.SubscriptionsCancelRequest(subscriptionId);
  request.requestBody({
    reason: reason
  });

  try {
    await client.execute(request);
    logger.info(`Cancelled PayPal subscription ${subscriptionId}`);
    return true;
  } catch (error) {
    logger.error('Error cancelling PayPal subscription:', error.message);
    throw error;
  }
};

/**
 * Get subscription details
 */
const getSubscriptionDetails = async (subscriptionId) => {
  const client = getPayPal();
  if (!client) {
    throw new Error('PayPal not configured');
  }

  const request = new paypal.subscriptions.SubscriptionsGetRequest(subscriptionId);

  try {
    const response = await client.execute(request);
    return response.result;
  } catch (error) {
    logger.error('Error getting PayPal subscription:', error.message);
    throw error;
  }
};

/**
 * Handle webhook event
 */
const handleWebhookEvent = async (event) => {
  const eventType = event.event_type;
  const resource = event.resource;

  logger.info(`PayPal webhook received: ${eventType}`);

  switch (eventType) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED': {
      const subscriptionId = resource.id;
      const subscription = await prisma.subscription.findFirst({
        where: { stripe_subscription_id: subscriptionId }
      });

      if (subscription) {
        // Determine plan from billing info
        const planInfo = resource.billing_info?.billing_cycles?.[0];
        const plan = getPlanFromPayPalPlan(resource.plan_id);

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'active',
            plan: plan || subscription.plan,
            current_period_start: new Date(resource.start_time),
            current_period_end: new Date(resource.billing_info?.next_billing_time)
          }
        });

        logger.info(`Subscription ${subscriptionId} activated for user ${subscription.user_id}`);
      }
      break;
    }

    case 'BILLING.SUBSCRIPTION.CANCELLED': {
      const subscriptionId = resource.id;
      const subscription = await prisma.subscription.findFirst({
        where: { stripe_subscription_id: subscriptionId }
      });

      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'cancelled',
            plan: 'free',
            cancel_at_period_end: true
          }
        });

        logger.info(`Subscription ${subscriptionId} cancelled`);
      }
      break;
    }

    case 'BILLING.SUBSCRIPTION.EXPIRED': {
      const subscriptionId = resource.id;
      const subscription = await prisma.subscription.findFirst({
        where: { stripe_subscription_id: subscriptionId }
      });

      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'expired',
            plan: 'free'
          }
        });

        logger.info(`Subscription ${subscriptionId} expired`);
      }
      break;
    }

    case 'BILLING.SUBSCRIPTION.SUSPENDED': {
      const subscriptionId = resource.id;
      const subscription = await prisma.subscription.findFirst({
        where: { stripe_subscription_id: subscriptionId }
      });

      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'past_due' }
        });

        logger.info(`Subscription ${subscriptionId} suspended`);
      }
      break;
    }

    case 'PAYMENT.SALE.COMPLETED': {
      const paymentId = resource.id;
      const subscriptionId = resource.billing_agreement_id;
      const amount = parseFloat(resource.amount?.total || 0);
      const currency = resource.amount?.currency || 'USD';

      // Find subscription
      const subscription = await prisma.subscription.findFirst({
        where: { stripe_subscription_id: subscriptionId }
      });

      if (subscription) {
        // Record payment
        await prisma.invoice.create({
          data: {
            user_id: subscription.user_id,
            stripe_invoice_id: paymentId,
            amount: amount,
            currency: currency,
            status: 'paid',
            description: `PayPal payment for ${subscription.plan} plan`,
            period_start: new Date(),
            period_end: new Date()
          }
        });

        logger.info(`Payment ${paymentId} completed for subscription ${subscriptionId}`);
      }
      break;
    }

    case 'PAYMENT.SALE.DENIED':
    case 'PAYMENT.SALE.REFUNDED': {
      const paymentId = resource.id;
      const status = eventType.includes('DENIED') ? 'failed' : 'refunded';

      await prisma.invoice.updateMany({
        where: { stripe_invoice_id: paymentId },
        data: { status }
      });

      logger.info(`Payment ${paymentId} ${status}`);
      break;
    }

    default:
      logger.debug(`Unhandled PayPal webhook event: ${eventType}`);
  }
};

/**
 * Verify webhook signature
 */
const verifyWebhookSignature = async (headers, body) => {
  // PayPal webhook signature verification
  // In production, implement full signature verification
  // https://developer.paypal.com/docs/api/webhooks/rest/#verify-webhook-signature

  const transmissionId = headers['paypal-transmission-id'];
  const transmissionTime = headers['paypal-transmission-time'];
  const certUrl = headers['paypal-cert-url'];
  const authAlgo = headers['paypal-auth-algo'];
  const transmissionSig = headers['paypal-transmission-signature'];

  if (!transmissionId || !transmissionSig) {
    logger.warn('Missing PayPal webhook headers');
    return false;
  }

  // For now, basic validation
  // In production, implement full signature verification
  return true;
};

// Helper functions

/**
 * Get stored PayPal plan ID
 */
const getStoredPlanId = async (planKey) => {
  // In production, store this in database or environment
  const storedPlans = {
    pro: process.env.PAYPAL_PRO_PLAN_ID,
    scale: process.env.PAYPAL_SCALE_PLAN_ID
  };

  return storedPlans[planKey];
};

/**
 * Store PayPal plan ID
 */
const storePlanId = async (planKey, planId) => {
  // In production, store this in database
  logger.info(`Store PayPal plan ID: ${planKey} -> ${planId}`);
};

/**
 * Get plan key from PayPal plan ID
 */
const getPlanFromPayPalPlan = (planId) => {
  if (planId === process.env.PAYPAL_PRO_PLAN_ID) return 'pro';
  if (planId === process.env.PAYPAL_SCALE_PLAN_ID) return 'scale';
  return null;
};

/**
 * Get plan config
 */
const getPlans = () => {
  return PAYPAL_PLANS;
};

module.exports = {
  getPayPal,
  createSubscription,
  verifySubscription,
  cancelSubscription,
  getSubscriptionDetails,
  handleWebhookEvent,
  verifyWebhookSignature,
  getPlans,
  PAYPAL_PLANS
};