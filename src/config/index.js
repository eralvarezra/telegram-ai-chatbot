require('dotenv').config();
const Joi = require('joi');

const envSchema = Joi.object({
  PORT: Joi.number().port().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  DATABASE_URL: Joi.string().required(),
  // Optional - can be configured via dashboard
  TELEGRAM_API_ID: Joi.string().optional(),
  TELEGRAM_API_HASH: Joi.string().optional(),
  TELEGRAM_PHONE: Joi.string().optional(),
  TELEGRAM_SESSION: Joi.string().optional(),
  AI_API_KEY: Joi.string().optional(),
  // Dual API key system
  API_KEY_ENCRYPTION_KEY: Joi.string().length(64).optional(), // 32 bytes = 64 hex chars
  DAILY_MESSAGE_LIMIT_FREE: Joi.number().default(50),
  MONTHLY_TOKEN_LIMIT_PREMIUM: Joi.number().default(1000000),
  PLATFORM_OPENAI_KEY: Joi.string().optional(),
  PLATFORM_GROQ_KEY: Joi.string().optional(),
}).unknown();

const { error, value: env } = envSchema.validate(process.env);
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  databaseUrl: env.DATABASE_URL,
  telegramApiId: env.TELEGRAM_API_ID,
  telegramApiHash: env.TELEGRAM_API_HASH,
  telegramPhone: env.TELEGRAM_PHONE,
  telegramSession: env.TELEGRAM_SESSION,
  aiApiKey: env.AI_API_KEY,
  isDev: env.NODE_ENV === 'development',
  contextMessageLimit: 20,
  // Dual API key system
  apiKeyEncryptionKey: env.API_KEY_ENCRYPTION_KEY,
  dailyMessageLimitFree: env.DAILY_MESSAGE_LIMIT_FREE,
  monthlyTokenLimitPremium: env.MONTHLY_TOKEN_LIMIT_PREMIUM,
  platformOpenaiKey: env.PLATFORM_OPENAI_KEY,
  platformGroqKey: env.PLATFORM_GROQ_KEY
};