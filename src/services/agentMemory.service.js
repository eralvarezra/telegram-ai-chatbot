const prisma = require('../config/database');
const logger = require('../utils/logger');

// Memory update frequency (messages between summaries)
const MEMORY_SUMMARY_THRESHOLD = 20;
// Maximum messages to keep in recent context
const MAX_RECENT_MESSAGES = 10;

/**
 * Get conversation memory for an agent-contact pair
 * @param {number} agentId - The agent ID
 * @param {number} contactId - The contact (Telegram user) ID
 * @returns {Promise<object|null>} - Memory or null
 */
const getMemory = async (agentId, contactId) => {
  return prisma.conversationMemory.findUnique({
    where: {
      agent_id_contact_id: {
        agent_id: agentId,
        contact_id: contactId
      }
    }
  });
};

/**
 * Create or update conversation memory
 * @param {number} agentId - The agent ID
 * @param {number} contactId - The contact ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} - Updated memory
 */
const upsertMemory = async (agentId, contactId, updates = {}) => {
  const existing = await getMemory(agentId, contactId);

  if (existing) {
    const newCount = (existing.message_count || 0) + 1;
    const updateData = {
      last_message_at: new Date(),
      message_count: newCount,
      ...updates
    };

    return prisma.conversationMemory.update({
      where: {
        agent_id_contact_id: {
          agent_id: agentId,
          contact_id: contactId
        }
      },
      data: updateData
    });
  }

  return prisma.conversationMemory.create({
    data: {
      agent_id: agentId,
      contact_id: contactId,
      message_count: 1,
      last_message_at: new Date(),
      ...updates
    }
  });
};

/**
 * Update memory after a conversation turn
 * @param {number} agentId - The agent ID
 * @param {number} contactId - The contact ID
 * @param {string} userMessage - User's message
 * @param {string} botResponse - Bot's response
 * @param {object} metadata - Additional metadata (tone, intent, etc.)
 * @returns {Promise<object>} - Updated memory
 */
const updateAfterMessage = async (agentId, contactId, userMessage, botResponse, metadata = {}) => {
  const memory = await getMemory(agentId, contactId);
  const messageCount = (memory?.message_count || 0) + 1;

  // Extract key facts from message
  const newFacts = await extractKeyFacts(userMessage, metadata);
  const existingFacts = memory?.key_facts || {};
  const mergedFacts = mergeKeyFacts(existingFacts, newFacts);

  // Update intent and sentiment
  const updates = {
    key_facts: mergedFacts,
    last_topic: extractTopic(userMessage),
    sentiment: metadata.sentiment || memory?.sentiment,
    intent: metadata.intent || memory?.intent,
    purchase_intent: calculatePurchaseIntent(userMessage, metadata, memory?.purchase_intent)
  };

  // Check if we need to generate a summary
  if (messageCount >= MEMORY_SUMMARY_THRESHOLD && messageCount % MEMORY_SUMMARY_THRESHOLD === 0) {
    logger.debug(`Generating memory summary for agent ${agentId}, contact ${contactId}`);
    // Summary generation would go here (using AI to compress)
    // For now, we'll use a simpler approach
  }

  return upsertMemory(agentId, contactId, updates);
};

/**
 * Get memory context for AI prompt
 * @param {number} agentId - The agent ID
 * @param {number} contactId - The contact ID
 * @returns {Promise<string>} - Formatted context string
 */
const getMemoryContext = async (agentId, contactId) => {
  const memory = await getMemory(agentId, contactId);

  if (!memory) {
    return '';
  }

  let context = '';

  // Add conversation summary if available
  if (memory.context_summary) {
    context += `Resumen previo: ${memory.context_summary}\n\n`;
  }

  // Add key facts
  if (memory.key_facts && Object.keys(memory.key_facts).length > 0) {
    const facts = memory.key_facts;
    context += 'Datos conocidos del usuario:\n';

    if (facts.name) context += `- Nombre: ${facts.name}\n`;
    if (facts.location) context += `- Ubicación: ${facts.location}\n`;
    if (facts.interests?.length) context += `- Intereses: ${facts.interests.join(', ')}\n`;
    if (facts.preferences) context += `- Preferencias: ${facts.preferences}\n`;
    if (facts.budget) context += `- Presupuesto: ${facts.budget}\n`;
    if (facts.lastPurchase) context += `- Última compra: ${facts.lastPurchase}\n`;
    if (facts.notes) context += `- Notas: ${facts.notes}\n`;

    context += '\n';
  }

  // Add last topic
  if (memory.last_topic) {
    context += `Último tema de conversación: ${memory.last_topic}\n`;
  }

  // Add sentiment if available
  if (memory.sentiment) {
    const sentimentLabels = {
      positive: 'positivo',
      negative: 'negativo',
      neutral: 'neutral'
    };
    context += `Estado emocional: ${sentimentLabels[memory.sentiment] || memory.sentiment}\n`;
  }

  // Add purchase intent
  if (memory.purchase_intent !== null && memory.purchase_intent !== undefined) {
    const intentLevel = memory.purchase_intent > 0.7 ? 'alto' :
                       memory.purchase_intent > 0.4 ? 'medio' : 'bajo';
    context += `Interés de compra: ${intentLevel}\n`;
  }

  return context.trim();
};

/**
 * Extract key facts from a message
 * @param {string} message - User message
 * @param {object} metadata - Additional metadata
 * @returns {Promise<object>} - Extracted facts
 */
const extractKeyFacts = async (message, metadata = {}) => {
  const facts = {};

  // Simple extraction patterns
  const namePatterns = [
    /(?:me llamo|soy|mi nombre es)\s+(\w+)/i,
    /(?:i'm|i am|my name is)\s+(\w+)/i
  ];

  const locationPatterns = [
    /(?:soy de|vivo en|estoy en)\s+([A-Za-záéíóúñ\s]+)/i,
    /(?:from|in|live in)\s+([A-Za-z\s]+)/i
  ];

  // Extract name
  for (const pattern of namePatterns) {
    const match = message.match(pattern);
    if (match) {
      facts.name = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      break;
    }
  }

  // Extract location
  for (const pattern of locationPatterns) {
    const match = message.match(pattern);
    if (match) {
      facts.location = match[1].trim();
      break;
    }
  }

  // Extract interests (keywords)
  const interestKeywords = ['video', 'foto', 'foto', 'pack', 'llamada', 'call', 'video', 'photo',
                            'premium', 'contenido', 'content', 'sexo', 'sex', 'citar', 'meet'];
  const foundInterests = [];

  for (const keyword of interestKeywords) {
    if (message.toLowerCase().includes(keyword)) {
      foundInterests.push(keyword);
    }
  }

  if (foundInterests.length > 0) {
    facts.interests = [...new Set(foundInterests)];
  }

  // Extract budget signals
  const budgetPatterns = [
    /(?:presupuesto|budget|cuánto puedo gastar|hasta\s+\d+)/i,
    /(?:\$\d+|₡\d+|€\d+)/
  ];

  for (const pattern of budgetPatterns) {
    if (pattern.test(message)) {
      facts.budget = 'mentioned';
      break;
    }
  }

  return facts;
};

/**
 * Merge new facts with existing facts
 * @param {object} existing - Existing facts
 * @param {object} newFacts - New facts to merge
 * @returns {object} - Merged facts
 */
const mergeKeyFacts = (existing, newFacts) => {
  if (!existing) return newFacts;
  if (!newFacts || Object.keys(newFacts).length === 0) return existing;

  const merged = { ...existing };

  for (const [key, value] of Object.entries(newFacts)) {
    if (key === 'interests') {
      // Merge arrays
      const existingInterests = merged.interests || [];
      merged.interests = [...new Set([...existingInterests, ...value])];
    } else if (!merged[key]) {
      // Only add if not already present
      merged[key] = value;
    }
  }

  return merged;
};

/**
 * Extract main topic from message
 * @param {string} message - User message
 * @returns {string|null} - Extracted topic
 */
const extractTopic = (message) => {
  const topicPatterns = [
    { pattern: /(?:precio|cuánto|costo|precio)/i, topic: 'precios' },
    { pattern: /(?:foto|video|contenido|content)/i, topic: 'contenido' },
    { pattern: /(?:llamada|call|videollamada)/i, topic: 'llamadas' },
    { pattern: /(?:pago|pagar|payment|transferencia)/i, topic: 'pagos' },
    { pattern: /(?:hora|cuando|when|cita)/i, topic: 'citas' },
    { pattern: /(?:ubicación|donde|location)/i, topic: 'ubicación' }
  ];

  for (const { pattern, topic } of topicPatterns) {
    if (pattern.test(message)) {
      return topic;
    }
  }

  return null;
};

/**
 * Calculate purchase intent probability
 * @param {string} message - User message
 * @param {object} metadata - Additional metadata
 * @param {number|null} currentIntent - Current intent value
 * @returns {number} - Probability 0-1
 */
const calculatePurchaseIntent = (message, metadata = {}, currentIntent = null) => {
  let score = currentIntent || 0.5;

  // Positive signals
  const positiveSignals = [
    /(?:quiero|dame|necesito|buy|comprar|pedir)/i,
    /(?:cuánto|precio|cost|price)/i,
    /(?:disponible|available)/i,
    /(?:pago|pagar|transferir)/i
  ];

  // Negative signals
  const negativeSignals = [
    /(?:no|nope|not|don't)/i,
    /(?:caro|expensive|mucho)/i,
    /(?:pensar|pensarlo|después|later)/i
  ];

  for (const pattern of positiveSignals) {
    if (pattern.test(message)) {
      score = Math.min(1, score + 0.15);
    }
  }

  for (const pattern of negativeSignals) {
    if (pattern.test(message)) {
      score = Math.max(0, score - 0.1);
    }
  }

  // Decay current intent slightly
  if (currentIntent !== null) {
    score = score * 0.95 + 0.025;
  }

  return Math.round(score * 100) / 100;
};

/**
 * Clear memory for a contact
 * @param {number} agentId - The agent ID
 * @param {number} contactId - The contact ID
 * @returns {Promise<void>}
 */
const clearMemory = async (agentId, contactId) => {
  await prisma.conversationMemory.delete({
    where: {
      agent_id_contact_id: {
        agent_id: agentId,
        contact_id: contactId
      }
    }
  }).catch(err => {
    if (err.code !== 'P2025') throw err; // Not found is ok
  });

  logger.info(`Cleared memory for agent ${agentId}, contact ${contactId}`);
};

/**
 * Get all memories for an agent (for analytics)
 * @param {number} agentId - The agent ID
 * @returns {Promise<array>} - Array of memories
 */
const getAgentMemories = async (agentId) => {
  return prisma.conversationMemory.findMany({
    where: { agent_id: agentId },
    orderBy: { last_message_at: 'desc' },
    include: {
      contact: {
        select: {
          id: true,
          telegram_id: true,
          display_name: true,
          username: true
        }
      }
    }
  });
};

/**
 * Update key facts manually
 * @param {number} agentId - The agent ID
 * @param {number} contactId - The contact ID
 * @param {object} facts - Facts to update
 * @returns {Promise<object>} - Updated memory
 */
const updateKeyFacts = async (agentId, contactId, facts) => {
  const memory = await getMemory(agentId, contactId);
  const existingFacts = memory?.key_facts || {};
  const mergedFacts = { ...existingFacts, ...facts };

  return upsertMemory(agentId, contactId, { key_facts: mergedFacts });
};

/**
 * Get contacts with high purchase intent
 * @param {number} agentId - The agent ID
 * @param {number} threshold - Minimum intent threshold (0-1)
 * @returns {Promise<array>} - Array of contacts
 */
const getHighIntentContacts = async (agentId, threshold = 0.7) => {
  return prisma.conversationMemory.findMany({
    where: {
      agent_id: agentId,
      purchase_intent: { gte: threshold }
    },
    orderBy: { purchase_intent: 'desc' },
    include: {
      contact: {
        select: {
          id: true,
          telegram_id: true,
          display_name: true,
          username: true
        }
      }
    }
  });
};

module.exports = {
  getMemory,
  upsertMemory,
  updateAfterMessage,
  getMemoryContext,
  extractKeyFacts,
  mergeKeyFacts,
  extractTopic,
  calculatePurchaseIntent,
  clearMemory,
  getAgentMemories,
  updateKeyFacts,
  getHighIntentContacts,
  MEMORY_SUMMARY_THRESHOLD,
  MAX_RECENT_MESSAGES
};