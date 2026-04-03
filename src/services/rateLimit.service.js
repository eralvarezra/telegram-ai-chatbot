const prisma = require('../config/database');
const config = require('../config');
const { RateLimitError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Check if user has exceeded daily message limit
 * @param {number} userId - The user ID
 * @returns {Promise<{ allowed: boolean, remaining: number, resetTime: Date, used: number }>}
 */
const checkDailyLimit = async (userId) => {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      daily_message_count: true,
      last_reset_date: true
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Premium users have no limits (or very high limit)
  if (user.plan === 'premium') {
    return {
      allowed: true,
      remaining: -1, // Unlimited
      resetTime: null,
      used: 0,
      limit: -1
    };
  }

  const now = new Date();
  const limit = config.dailyMessageLimitFree || 50;

  // Check if we need to reset the counter
  let resetTime = user.last_reset_date || now;
  const hoursSinceReset = (now - resetTime) / (1000 * 60 * 60);

  // Reset if 24 hours have passed
  if (hoursSinceReset >= 24 || !user.last_reset_date) {
    await resetDailyCount(userId);
    return {
      allowed: true,
      remaining: limit,
      resetTime: getNextResetTime(),
      used: 0,
      limit
    };
  }

  // Calculate remaining messages
  const used = user.daily_message_count || 0;
  const remaining = Math.max(0, limit - used);

  // Calculate next reset time
  const nextReset = getNextResetTime(resetTime);

  return {
    allowed: used < limit,
    remaining,
    resetTime: nextReset,
    used,
    limit
  };
};

/**
 * Increment daily message count for a user
 * @param {number} userId - The user ID
 * @returns {Promise<void>}
 */
const incrementDailyCount = async (userId) => {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { plan: true, daily_message_count: true }
  });

  if (!user || user.plan === 'premium') {
    // Don't track for premium users
    return;
  }

  const newCount = (user.daily_message_count || 0) + 1;

  await prisma.adminUser.update({
    where: { id: userId },
    data: { daily_message_count: newCount }
  });

  logger.debug(`Daily message count incremented for user ${userId}: ${newCount}`);
};

/**
 * Reset daily message count for a user
 * @param {number} userId - The user ID
 * @returns {Promise<void>}
 */
const resetDailyCount = async (userId) => {
  await prisma.adminUser.update({
    where: { id: userId },
    data: {
      daily_message_count: 0,
      last_reset_date: new Date()
    }
  });

  logger.info(`Daily message count reset for user ${userId}`);
};

/**
 * Reset all daily counts (for cron job)
 * @returns {Promise<void>}
 */
const resetAllDailyCounts = async () => {
  const result = await prisma.adminUser.updateMany({
    where: { plan: 'free' },
    data: {
      daily_message_count: 0,
      last_reset_date: new Date()
    }
  });

  logger.info(`Reset daily message counts for ${result.count} free users`);
  return result;
};

/**
 * Get next reset time (24 hours from last reset or now)
 * @param {Date} lastReset - The last reset time
 * @returns {Date}
 */
const getNextResetTime = (lastReset = null) => {
  const base = lastReset || new Date();
  const next = new Date(base);
  next.setHours(next.getHours() + 24);
  return next;
};

/**
 * Get daily limit for a plan
 * @param {string} plan - The plan ('free' or 'premium')
 * @returns {number}
 */
const getDailyLimitForPlan = (plan) => {
  if (plan === 'premium') {
    return -1; // Unlimited
  }
  return config.dailyMessageLimitFree || 50;
};

/**
 * Check if user can send a message (throws if not)
 * @param {number} userId - The user ID
 * @throws {RateLimitError} If limit exceeded
 */
const enforceDailyLimit = async (userId) => {
  const status = await checkDailyLimit(userId);

  if (!status.allowed) {
    throw new RateLimitError(
      `Daily limit reached. You've used ${status.used}/${status.limit} messages. Limit resets at ${status.resetTime.toISOString()}`,
      status.resetTime
    );
  }

  return status;
};

module.exports = {
  checkDailyLimit,
  incrementDailyCount,
  resetDailyCount,
  resetAllDailyCounts,
  getDailyLimitForPlan,
  enforceDailyLimit,
  getNextResetTime
};