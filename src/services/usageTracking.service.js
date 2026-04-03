const prisma = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Record token usage for a user
 * @param {number} userId - The user ID
 * @param {number} tokensIn - Input tokens
 * @param {number} tokensOut - Output tokens
 * @param {string} model - The model used
 * @param {string} keyType - 'user' or 'platform'
 * @returns {Promise<void>}
 */
const recordTokenUsage = async (userId, tokensIn, tokensOut, model = null, keyType = 'user') => {
  try {
    // Record in UsageTracking table
    await prisma.usageTracking.create({
      data: {
        user_id: userId,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        model,
        api_key_type: keyType,
        cost_usd: calculateCost(tokensIn, tokensOut, model)
      }
    });

    // Update user's total usage
    await prisma.adminUser.update({
      where: { id: userId },
      data: {
        total_tokens_used: { increment: tokensIn + tokensOut },
        monthly_tokens_used: { increment: tokensIn + tokensOut }
      }
    });

    logger.debug(`Recorded token usage for user ${userId}: ${tokensIn}+${tokensOut}`);
  } catch (error) {
    logger.error('Error recording token usage:', error);
    // Don't throw - usage tracking shouldn't break the flow
  }
};

/**
 * Get monthly usage for a user
 * @param {number} userId - The user ID
 * @returns {Promise<{ tokensIn: number, tokensOut: number, costUsd: number, used: number, limit: number }>}
 */
const getMonthlyUsage = async (userId) => {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      monthly_tokens_used: true,
      token_reset_date: true
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get current month's usage from UsageTracking
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const usageRecords = await prisma.usageTracking.findMany({
    where: {
      user_id: userId,
      timestamp: { gte: startOfMonth }
    },
    select: {
      tokens_in: true,
      tokens_out: true,
      cost_usd: true
    }
  });

  const tokensIn = usageRecords.reduce((sum, r) => sum + r.tokens_in, 0);
  const tokensOut = usageRecords.reduce((sum, r) => sum + r.tokens_out, 0);
  const costUsd = usageRecords.reduce((sum, r) => sum + (r.cost_usd || 0), 0);

  const limit = user.plan === 'premium'
    ? (config.monthlyTokenLimitPremium || 1000000)
    : -1; // Free users tracked by messages, not tokens

  return {
    tokensIn,
    tokensOut,
    totalTokens: tokensIn + tokensOut,
    costUsd,
    used: user.monthly_tokens_used || 0,
    limit
  };
};

/**
 * Check if user is within monthly token limit
 * @param {number} userId - The user ID
 * @returns {Promise<{ allowed: boolean, remaining: number, used: number }>}
 */
const checkMonthlyLimit = async (userId) => {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      monthly_tokens_used: true
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Free users are limited by messages, not tokens
  if (user.plan !== 'premium') {
    return {
      allowed: true,
      remaining: -1,
      used: user.monthly_tokens_used || 0,
      limit: -1,
      plan: 'free'
    };
  }

  const limit = config.monthlyTokenLimitPremium || 1000000;
  const used = user.monthly_tokens_used || 0;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: used < limit,
    remaining,
    used,
    limit,
    plan: 'premium'
  };
};

/**
 * Reset monthly token counts (for cron job)
 * @returns {Promise<void>}
 */
const resetMonthlyUsage = async () => {
  const result = await prisma.adminUser.updateMany({
    where: { plan: 'premium' },
    data: {
      monthly_tokens_used: 0,
      token_reset_date: new Date()
    }
  });

  logger.info(`Reset monthly token counts for ${result.count} premium users`);
  return result;
};

/**
 * Calculate cost in USD based on tokens and model
 * @param {number} tokensIn - Input tokens
 * @param {number} tokensOut - Output tokens
 * @param {string} model - The model used
 * @returns {number} Cost in USD
 */
const calculateCost = (tokensIn, tokensOut, model) => {
  // Approximate costs per 1M tokens
  const costs = {
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'llama-3.3-70b-versatile': { input: 0.05, output: 0.10 }, // Groq approximate
    'default': { input: 0.10, output: 0.30 }
  };

  const pricing = costs[model] || costs.default;

  const inputCost = (tokensIn / 1000000) * pricing.input;
  const outputCost = (tokensOut / 1000000) * pricing.output;

  return inputCost + outputCost;
};

/**
 * Get usage statistics for a user
 * @param {number} userId - The user ID
 * @returns {Promise<object>}
 */
const getUsageStats = async (userId) => {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      daily_message_count: true,
      last_reset_date: true,
      monthly_tokens_used: true,
      total_tokens_used: true
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  const dailyLimit = config.dailyMessageLimitFree || 50;
  const monthlyLimit = config.monthlyTokenLimitPremium || 1000000;

  // Get next reset time
  let dailyResetTime = null;
  if (user.last_reset_date) {
    dailyResetTime = new Date(user.last_reset_date);
    dailyResetTime.setHours(dailyResetTime.getHours() + 24);
  }

  if (user.plan === 'free') {
    return {
      plan: 'free',
      dailyMessages: {
        used: user.daily_message_count || 0,
        limit: dailyLimit,
        remaining: Math.max(0, dailyLimit - (user.daily_message_count || 0)),
        resetsAt: dailyResetTime
      },
      monthlyTokens: null,
      totalTokens: user.total_tokens_used || 0
    };
  }

  // Premium user
  const monthlyUsage = await getMonthlyUsage(userId);

  return {
    plan: 'premium',
    dailyMessages: null,
    monthlyTokens: {
      used: monthlyUsage.totalTokens,
      limit: monthlyLimit,
      remaining: Math.max(0, monthlyLimit - monthlyUsage.totalTokens),
      costUsd: monthlyUsage.costUsd
    },
    totalTokens: user.total_tokens_used || 0
  };
};

module.exports = {
  recordTokenUsage,
  getMonthlyUsage,
  checkMonthlyLimit,
  resetMonthlyUsage,
  calculateCost,
  getUsageStats
};