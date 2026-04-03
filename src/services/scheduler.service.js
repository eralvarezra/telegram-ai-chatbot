const cron = require('node-cron');
const rateLimitService = require('./rateLimit.service');
const usageTrackingService = require('./usageTracking.service');
const logger = require('../utils/logger');

// Track scheduled jobs
const scheduledJobs = new Map();

/**
 * Start the scheduler with daily and monthly reset jobs
 */
const startScheduler = () => {
  logger.info('Starting scheduler service...');

  // Daily reset at midnight (00:00)
  const dailyJob = cron.schedule('0 0 * * *', async () => {
    logger.info('Running daily message count reset...');
    try {
      await rateLimitService.resetAllDailyCounts();
      logger.info('Daily reset completed successfully');
    } catch (error) {
      logger.error('Error during daily reset:', error);
    }
  }, {
    timezone: 'UTC'
  });

  scheduledJobs.set('dailyReset', dailyJob);
  logger.info('Scheduled daily reset job at 00:00 UTC');

  // Monthly reset on the 1st of each month at 00:05
  const monthlyJob = cron.schedule('5 0 1 * *', async () => {
    logger.info('Running monthly token reset...');
    try {
      await usageTrackingService.resetMonthlyUsage();
      logger.info('Monthly reset completed successfully');
    } catch (error) {
      logger.error('Error during monthly reset:', error);
    }
  }, {
    timezone: 'UTC'
  });

  scheduledJobs.set('monthlyReset', monthlyJob);
  logger.info('Scheduled monthly reset job at 00:05 UTC on the 1st of each month');
};

/**
 * Stop all scheduled jobs
 */
const stopScheduler = () => {
  logger.info('Stopping scheduler service...');

  for (const [name, job] of scheduledJobs) {
    job.stop();
    logger.info(`Stopped job: ${name}`);
  }

  scheduledJobs.clear();
};

/**
 * Get status of scheduled jobs
 * @returns {object}
 */
const getSchedulerStatus = () => {
  const status = {};
  for (const [name, job] of scheduledJobs) {
    status[name] = {
      running: job.running || true,
      nextRun: job.nextDate ? job.nextDate().toISOString() : null
    };
  }
  return status;
};

/**
 * Manually trigger daily reset (for testing)
 */
const triggerDailyReset = async () => {
  logger.info('Manually triggering daily reset...');
  try {
    const result = await rateLimitService.resetAllDailyCounts();
    logger.info('Manual daily reset completed');
    return result;
  } catch (error) {
    logger.error('Error during manual daily reset:', error);
    throw error;
  }
};

/**
 * Manually trigger monthly reset (for testing)
 */
const triggerMonthlyReset = async () => {
  logger.info('Manually triggering monthly reset...');
  try {
    const result = await usageTrackingService.resetMonthlyUsage();
    logger.info('Manual monthly reset completed');
    return result;
  } catch (error) {
    logger.error('Error during manual monthly reset:', error);
    throw error;
  }
};

module.exports = {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  triggerDailyReset,
  triggerMonthlyReset
};