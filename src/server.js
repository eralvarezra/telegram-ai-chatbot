require('dotenv').config();
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const setupService = require('./services/setup.service');
const schedulerService = require('./services/scheduler.service');

const PORT = config.port;

// Start Express server
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

// Initialize credentials from .env if available
const initCredentialsFromEnv = async () => {
  try {
    const setup = await setupService.getSetupStatus();

    // If Telegram credentials are in .env but not in database, save them
    if (config.telegramApiId && config.telegramApiHash && config.telegramPhone) {
      if (!setup.telegram_api_id || !setup.telegram_api_hash) {
        logger.info('Saving Telegram credentials from .env to database...');
        await setupService.saveTelegramCredentials(
          config.telegramApiId,
          config.telegramApiHash,
          config.telegramPhone
        );

        // If session is also in .env, save it
        if (config.telegramSession) {
          logger.info('Saving Telegram session from .env to database...');
          await setupService.saveTelegramSession(config.telegramSession);
        }
      }
    }

    // If AI API key is in .env but not in database, save it
    if (config.aiApiKey && !setup.ai_api_key) {
      logger.info('Saving AI credentials from .env to database...');
      await setupService.saveAICredentials(config.aiApiKey, 'groq');
    }
  } catch (error) {
    logger.error('Error initializing credentials from .env:', error.message);
  }
};

// Initialize credentials on startup (for backward compatibility with .env)
initCredentialsFromEnv().catch(err => {
  logger.error('Error initializing credentials:', err.message);
});

// Start the scheduler for daily/monthly resets
schedulerService.startScheduler();
logger.info('Scheduler started for daily message reset and monthly token reset');

// NOTE: Global bot initialization is DISABLED.
// Each user now starts their own bot via the /api/bot/start endpoint.
// The botManager.service handles per-user bot instances.
logger.info('Server started. Bots must be started manually per user via /api/bot/start');

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection', err);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  schedulerService.stopScheduler();
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

module.exports = server;