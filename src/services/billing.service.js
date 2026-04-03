const prisma = require('../config/database');
const logger = require('../utils/logger');

// Stripe will be initialized lazily when needed
let stripe = null;

const getStripe = () => {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
};

// Plan definitions
const PLANS = {
  free: {
    name: 'Free',
    nameEs: 'Gratis',
    price: 0,
    features: [
      '1 Bot instance',
      'Basic AI responses',
      'Limited messages',
      'Community support'
    ],
    limits: {
      bots: 1,
      messagesPerMonth: 1000,
      mediaFiles: 10
    }
  },
  pro: {
    name: 'Pro',
    nameEs: 'Pro',
    price: 29,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: [
      '3 Bot instances',
      'Advanced AI responses',
      'Unlimited messages',
      'Custom personality',
      'Priority support',
      'Media library'
    ],
    limits: {
      bots: 3,
      messagesPerMonth: -1, // unlimited
      mediaFiles: 100
    }
  },
  scale: {
    name: 'Scale',
    nameEs: 'Escala',
    price: 99,
    priceId: process.env.STRIPE_SCALE_PRICE_ID,
    features: [
      'Unlimited bots',
      'Premium AI responses',
      'Unlimited messages',
      'Custom AI training',
      'API access',
      'Dedicated support',
      'White label option'
    ],
    limits: {
      bots: -1, // unlimited
      messagesPerMonth: -1,
      mediaFiles: -1
    }
  }
};

/**
 * Get or create Stripe customer for user
 */
const getOrCreateCustomer = async (userId) => {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error('User not found');
  }

  const stripeClient = getStripe();
  if (!stripeClient) {
    throw new Error('Stripe not configured');
  }

  // If user already has Stripe customer ID, return it
  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }

  // Create new customer
  const customer = await stripeClient.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: {
      userId: userId.toString()
    }
  });

  // Save customer ID to user
  await prisma.adminUser.update({
    where: { id: userId },
    data: { stripe_customer_id: customer.id }
  });

  logger.info(`Created Stripe customer ${customer.id} for user ${userId}`);
  return customer.id;
};

/**
 * Create checkout session for subscription
 */
const createCheckoutSession = async (userId, plan) => {
  const planConfig = PLANS[plan];
  if (!planConfig || !planConfig.priceId) {
    throw new Error('Invalid plan or no price configured');
  }

  const customerId = await getOrCreateCustomer(userId);
  const stripeClient = getStripe();

  const session = await stripeClient.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price: planConfig.priceId,
      quantity: 1
    }],
    success_url: `${process.env.DASHBOARD_URL}/settings/billing?success=true`,
    cancel_url: `${process.env.DASHBOARD_URL}/settings/billing?cancelled=true`,
    metadata: {
      userId: userId.toString(),
      plan: plan
    }
  });

  return session.url;
};

/**
 * Create billing portal session
 */
const createPortalSession = async (userId) => {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId }
  });

  if (!user?.stripe_customer_id) {
    throw new Error('No Stripe customer found');
  }

  const stripeClient = getStripe();

  const session = await stripeClient.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${process.env.DASHBOARD_URL}/settings/billing`
  });

  return session.url;
};

/**
 * Handle webhook event from Stripe
 */
const handleWebhookEvent = async (event) => {
  const stripeClient = getStripe();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = parseInt(session.metadata.userId);
      const plan = session.metadata.plan;

      if (userId && plan) {
        // Get subscription details
        const subscription = await stripeClient.subscriptions.retrieve(session.subscription);

        await prisma.subscription.upsert({
          where: { user_id: userId },
          create: {
            user_id: userId,
            plan: plan,
            status: subscription.status,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0]?.price.id,
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000)
          },
          update: {
            plan: plan,
            status: subscription.status,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0]?.price.id,
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000)
          }
        });

        logger.info(`Subscription created for user ${userId}, plan: ${plan}`);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const userId = parseInt(subscription.metadata.userId);

      if (userId) {
        await prisma.subscription.update({
          where: { user_id: userId },
          data: {
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000),
            cancel_at_period_end: subscription.cancel_at_period_end
          }
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const userId = parseInt(subscription.metadata.userId);

      if (userId) {
        await prisma.subscription.update({
          where: { user_id: userId },
          data: {
            status: 'cancelled',
            plan: 'free'
          }
        });
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const customerId = invoice.customer;

      // Store invoice record
      const user = await prisma.adminUser.findFirst({
        where: { stripe_customer_id: customerId }
      });

      if (user) {
        await prisma.invoice.upsert({
          where: { stripe_invoice_id: invoice.id },
          create: {
            user_id: user.id,
            stripe_invoice_id: invoice.id,
            amount: invoice.amount_paid / 100,
            currency: invoice.currency,
            status: invoice.status,
            invoice_url: invoice.hosted_invoice_url,
            invoice_pdf: invoice.invoice_pdf,
            description: invoice.lines.data[0]?.description,
            period_start: new Date(invoice.period_start * 1000),
            period_end: new Date(invoice.period_end * 1000)
          },
          update: {
            status: invoice.status,
            invoice_url: invoice.hosted_invoice_url,
            invoice_pdf: invoice.invoice_pdf
          }
        });
      }
      break;
    }

    case 'payment_method.attached': {
      const paymentMethod = event.data.object;
      const customerId = paymentMethod.customer;

      const user = await prisma.adminUser.findFirst({
        where: { stripe_customer_id: customerId }
      });

      if (user) {
        // Check if this is the first payment method
        const existingMethods = await prisma.userPaymentMethod.count({
          where: { user_id: user.id }
        });

        await prisma.userPaymentMethod.create({
          data: {
            user_id: user.id,
            stripe_payment_method_id: paymentMethod.id,
            type: paymentMethod.type,
            brand: paymentMethod.card?.brand,
            last4: paymentMethod.card?.last4,
            exp_month: paymentMethod.card?.exp_month,
            exp_year: paymentMethod.card?.exp_year,
            is_default: existingMethods === 0
          }
        });

        logger.info(`Payment method attached for user ${user.id}`);
      }
      break;
    }

    case 'payment_method.detached': {
      const paymentMethod = event.data.object;

      await prisma.userPaymentMethod.deleteMany({
        where: { stripe_payment_method_id: paymentMethod.id }
      });
      break;
    }

    default:
      logger.debug(`Unhandled Stripe event: ${event.type}`);
  }
};

/**
 * Get user's subscription
 */
const getSubscription = async (userId) => {
  const subscription = await prisma.subscription.findUnique({
    where: { user_id: userId }
  });

  if (!subscription) {
    // Return free plan by default
    return {
      plan: 'free',
      status: 'active',
      limits: PLANS.free.limits
    };
  }

  return {
    ...subscription,
    limits: PLANS[subscription.plan]?.limits || PLANS.free.limits
  };
};

/**
 * Get user's payment methods
 */
const getPaymentMethods = async (userId) => {
  return prisma.userPaymentMethod.findMany({
    where: { user_id: userId },
    orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }]
  });
};

/**
 * Add a payment method
 */
const addPaymentMethod = async (userId, paymentMethodId) => {
  const stripeClient = getStripe();
  const customerId = await getOrCreateCustomer(userId);

  // Attach payment method to customer
  const paymentMethod = await stripeClient.paymentMethods.attach(paymentMethodId, {
    customer: customerId
  });

  // Check if this is the first payment method
  const existingMethods = await prisma.userPaymentMethod.count({
    where: { user_id: userId }
  });

  // Save to database
  const savedMethod = await prisma.userPaymentMethod.create({
    data: {
      user_id: userId,
      stripe_payment_method_id: paymentMethod.id,
      type: paymentMethod.type,
      brand: paymentMethod.card?.brand,
      last4: paymentMethod.card?.last4,
      exp_month: paymentMethod.card?.exp_month,
      exp_year: paymentMethod.card?.exp_year,
      is_default: existingMethods === 0
    }
  });

  return savedMethod;
};

/**
 * Remove a payment method
 */
const removePaymentMethod = async (userId, paymentMethodId) => {
  const paymentMethod = await prisma.userPaymentMethod.findFirst({
    where: { id: paymentMethodId, user_id: userId }
  });

  if (!paymentMethod) {
    throw new Error('Payment method not found');
  }

  const stripeClient = getStripe();

  // Detach from Stripe
  try {
    await stripeClient.paymentMethods.detach(paymentMethod.stripe_payment_method_id);
  } catch (error) {
    logger.warn('Could not detach payment method from Stripe:', error.message);
  }

  // Delete from database
  await prisma.userPaymentMethod.delete({
    where: { id: paymentMethodId }
  });

  // If this was the default, set another as default
  if (paymentMethod.is_default) {
    const nextMethod = await prisma.userPaymentMethod.findFirst({
      where: { user_id: userId }
    });

    if (nextMethod) {
      await prisma.userPaymentMethod.update({
        where: { id: nextMethod.id },
        data: { is_default: true }
      });
    }
  }
};

/**
 * Set default payment method
 */
const setDefaultPaymentMethod = async (userId, paymentMethodId) => {
  const paymentMethod = await prisma.userPaymentMethod.findFirst({
    where: { id: paymentMethodId, user_id: userId }
  });

  if (!paymentMethod) {
    throw new Error('Payment method not found');
  }

  const user = await prisma.adminUser.findUnique({
    where: { id: userId }
  });

  if (user?.stripe_customer_id) {
    const stripeClient = getStripe();

    // Update default in Stripe
    await stripeClient.customers.update(user.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethod.stripe_payment_method_id
      }
    });
  }

  // Update in database
  await prisma.$transaction([
    prisma.userPaymentMethod.updateMany({
      where: { user_id: userId },
      data: { is_default: false }
    }),
    prisma.userPaymentMethod.update({
      where: { id: paymentMethodId },
      data: { is_default: true }
    })
  ]);
};

/**
 * Get invoices for user
 */
const getInvoices = async (userId, limit = 10) => {
  return prisma.invoice.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: limit
  });
};

/**
 * Get plan definitions
 */
const getPlans = () => {
  return PLANS;
};

/**
 * Check if user can perform action based on plan limits
 */
const checkLimit = async (userId, resource) => {
  const subscription = await getSubscription(userId);
  const limit = subscription.limits[resource];

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, remaining: -1 };
  }

  // Get current usage
  let usage = 0;

  if (resource === 'bots') {
    usage = await prisma.botConfig.count();
  } else if (resource === 'messagesPerMonth') {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    usage = await prisma.message.count({
      where: {
        timestamp: { gte: startOfMonth }
      }
    });
  } else if (resource === 'mediaFiles') {
    usage = await prisma.mediaContent.count();
  }

  const remaining = limit - usage;
  return {
    allowed: usage < limit,
    remaining: Math.max(0, remaining),
    used: usage,
    limit
  };
};

module.exports = {
  getStripe,
  getOrCreateCustomer,
  createCheckoutSession,
  createPortalSession,
  handleWebhookEvent,
  getSubscription,
  getPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
  getInvoices,
  getPlans,
  checkLimit,
  PLANS
};