const prisma = require('../config/database');
const logger = require('../utils/logger');

// In-memory cache for conversation states
// Structure: Map<telegram_id, { state: string, data: object, expires: Date }>
const stateCache = new Map();

// State expiration time (10 minutes)
const STATE_EXPIRY = 10 * 60 * 1000;

// Conversation states
const STATES = {
  IDLE: 'idle',
  AWAITING_SERVICE_SELECTION: 'awaiting_service_selection',
  AWAITING_PAYMENT_METHOD: 'awaiting_payment_method'
};

/**
 * Get user's current conversation state
 * @param {string} telegramId
 * @returns {{state: string, data: object}|null}
 */
const getState = (telegramId) => {
  const cached = stateCache.get(telegramId);

  if (!cached) {
    return null;
  }

  // Check if expired
  if (cached.expires < new Date()) {
    stateCache.delete(telegramId);
    return null;
  }

  return {
    state: cached.state,
    data: cached.data
  };
};

/**
 * Set user's conversation state
 * @param {string} telegramId
 * @param {string} state
 * @param {object} data
 */
const setState = (telegramId, state, data = {}) => {
  stateCache.set(telegramId, {
    state,
    data,
    expires: new Date(Date.now() + STATE_EXPIRY)
  });

  logger.debug(`State set for ${telegramId}: ${state}`);
};

/**
 * Clear user's conversation state
 * @param {string} telegramId
 */
const clearState = (telegramId) => {
  stateCache.delete(telegramId);
  logger.debug(`State cleared for ${telegramId}`);
};

/**
 * Check if user is in a specific state
 * @param {string} telegramId
 * @param {string} state
 * @returns {boolean}
 */
const isInState = (telegramId, state) => {
  const current = getState(telegramId);
  return current?.state === state;
};

/**
 * Get pending service selection data
 * @param {string} telegramId
 * @returns {object|null}
 */
const getPendingSelection = (telegramId) => {
  const current = getState(telegramId);
  if (current?.state === STATES.AWAITING_SERVICE_SELECTION) {
    return current.data;
  }
  return null;
};

/**
 * Set user as awaiting service selection
 * @param {string} telegramId
 * @param {array} services - List of available services
 */
const setAwaitingSelection = (telegramId, services) => {
  setState(telegramId, STATES.AWAITING_SERVICE_SELECTION, {
    services,
    startedAt: new Date()
  });
};

module.exports = {
  STATES,
  getState,
  setState,
  clearState,
  isInState,
  getPendingSelection,
  setAwaitingSelection
};