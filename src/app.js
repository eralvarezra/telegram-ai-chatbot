const express = require('express');
const routes = require('./routes');
const mediaRoutes = require('./routes/media.routes');
const configRoutes = require('./routes/config.routes');
const setupRoutes = require('./routes/setup.routes');
const paymentRoutes = require('./routes/payment.routes');
const authRoutes = require('./routes/auth.routes');
const telegramRoutes = require('./routes/telegram.routes');
const credentialsRoutes = require('./routes/credentials.routes');
const botRoutes = require('./routes/bot.routes');
const notificationRoutes = require('./routes/notification.routes');
const aiConfigRoutes = require('./routes/aiConfig.routes');
const paymentMethodRoutes = require('./routes/paymentMethod.routes');
const accountRoutes = require('./routes/account.routes');
const paypalRoutes = require('./routes/paypal.routes');
const blockedUsersRoutes = require('./routes/blockedUsers.routes');
const productRoutes = require('./routes/product.routes');
const apiKeyRoutes = require('./routes/apiKey.routes');
const { errorHandler } = require('./middleware/error.middleware');
const logger = require('./utils/logger');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request logging (skip SSE and other frequent endpoints)
app.use((req, res, next) => {
  // Skip logging for SSE and static files
  if (!req.path.includes('/stream') && !req.path.startsWith('/uploads')) {
    logger.debug(`${req.method} ${req.path}`);
  }
  next();
});

// Routes
app.use('/api', routes);
app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/config', configRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai-config', aiConfigRoutes);
app.use('/api/payment-methods', paymentMethodRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/paypal', paypalRoutes);
app.use('/api/blocked-users', blockedUsersRoutes);
app.use('/api/products', productRoutes);
app.use('/api/api-key', apiKeyRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 'fail', message: 'Not found' });
});

// Global error handler
app.use(errorHandler);

module.exports = app;