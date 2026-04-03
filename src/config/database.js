const { PrismaClient } = require('@prisma/client');
const config = require('./index');
const logger = require('../utils/logger');

const prisma = new PrismaClient({
  log: config.isDev ? ['query', 'info', 'warn', 'error'] : ['error']
});

prisma.$connect()
  .then(() => logger.info('Database connected'))
  .catch((err) => {
    logger.error('Database connection failed', err);
    process.exit(1);
  });

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;