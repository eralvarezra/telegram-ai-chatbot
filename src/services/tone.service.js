const OpenAI = require('openai');
const setupService = require('./setup.service');
const logger = require('../utils/logger');

// Valid tone values
const VALID_TONES = ['friendly', 'playful', 'dry', 'interested', 'cold', 'negative'];

// Tone adaptation instructions
const TONE_INSTRUCTIONS = {
  playful: 'Sé juguetona, un poco bromista, usa emojis con moderación. Mantén las cosas divertidas y ligeras.',
  friendly: 'Sé amigable, cálida y cercana. Como una buena amiga conversando naturalmente.',
  dry: 'Sé breve, directa, usa pocas palabras. Sin rodeos, al grano.',
  interested: 'Sé segura de ti misma, guía sutilmente hacia la oferta. Muestra interés genuino.',
  cold: 'Re-engancha suavemente, haz preguntas para reavivar el interés. No seas insistente.',
  negative: 'Sé calmada, respetuosa, no presiones. Escucha activamente y valida sus sentimientos.'
};

/**
 * Detect the tone of a user message using AI
 * @param {string} message - The user's message
 * @returns {Promise<string>} - Detected tone (one of VALID_TONES)
 */
const detectTone = async (message) => {
  try {
    const aiCreds = await setupService.getAICredentials();

    if (!aiCreds || !aiCreds.apiKey) {
      logger.warn('AI credentials not available for tone detection, defaulting to friendly');
      return 'friendly';
    }

    const client = new OpenAI({
      apiKey: aiCreds.apiKey,
      baseURL: aiCreds.provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined
    });

    const completion = await client.chat.completions.create({
      model: aiCreds.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a tone classifier. Analyze the user's message and classify its tone into EXACTLY ONE of these categories:
- friendly: Warm, happy, enthusiastic, positive vibes
- playful: Flirty, teasing, joking, fun energy
- dry: Short, uninterested, minimal effort, bored
- interested: Engaged, asking questions, curious, invested
- cold: Distant, dismissive, annoyed, impatient
- negative: Complaining, sad, angry, frustrated, upset

IMPORTANT: Return ONLY the tone word, nothing else. No explanation, no punctuation.
Example responses: friendly, playful, dry, interested, cold, negative`
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 10,
      temperature: 0.3
    });

    const detectedTone = completion.choices[0]?.message?.content?.trim().toLowerCase();

    // Validate the detected tone
    if (VALID_TONES.includes(detectedTone)) {
      logger.info(`Tone detected: "${detectedTone}" for message: "${message.substring(0, 50)}..."`);
      return detectedTone;
    }

    logger.warn(`Invalid tone detected: "${detectedTone}", defaulting to friendly`);
    return 'friendly';

  } catch (error) {
    logger.error(`Tone detection error: ${error.message}`);
    return 'friendly'; // Default fallback
  }
};

/**
 * Get tone adaptation instructions for AI response
 * @param {string} tone - Detected tone
 * @returns {string} - Instructions for adapting response tone
 */
const adaptTone = (tone) => {
  return TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.friendly;
};

/**
 * Get all valid tones
 * @returns {string[]} - Array of valid tone values
 */
const getValidTones = () => [...VALID_TONES];

module.exports = {
  detectTone,
  adaptTone,
  getValidTones,
  TONE_INSTRUCTIONS,
  VALID_TONES
};