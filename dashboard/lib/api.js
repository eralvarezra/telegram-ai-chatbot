const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  // Get auth token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    ...options,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

// Users
export async function getUsers() {
  return fetchAPI('/api/users');
}

export async function getUser(id) {
  return fetchAPI(`/api/users/${id}`);
}

export async function getUserMessages(userId, limit = 50) {
  return fetchAPI(`/api/users/${userId}/messages?limit=${limit}`);
}

// Messages
export async function getMessages(params = {}) {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/api/messages?${query}`);
}

// Stats
export async function getStats() {
  return fetchAPI('/api/stats');
}

// Config
export async function getConfig() {
  return fetchAPI('/api/config');
}

export async function updateConfig(data) {
  return fetchAPI('/api/config', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Personality Config
export async function getPersonalityConfig() {
  return fetchAPI('/api/config/personality');
}

export async function updatePersonalityConfig(data) {
  return fetchAPI('/api/config/personality', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Conversations
export async function getConversations() {
  return fetchAPI('/api/conversations');
}

export async function getConversation(userId) {
  return fetchAPI(`/api/conversations/${userId}`);
}

// AI Config Generation
export async function generateAIConfig(description, language = null) {
  return fetchAPI('/api/ai-config/generate', {
    method: 'POST',
    body: JSON.stringify({ description, language }),
  });
}

export async function regenerateAIConfig(generationId, tweakInstruction) {
  return fetchAPI(`/api/ai-config/regenerate/${generationId}`, {
    method: 'POST',
    body: JSON.stringify({ tweakInstruction }),
  });
}

export async function applyAIConfig(generationId, editedConfig = null) {
  return fetchAPI(`/api/ai-config/apply/${generationId}`, {
    method: 'POST',
    body: JSON.stringify({ editedConfig }),
  });
}

export async function getAIConfigHistory(limit = 10) {
  return fetchAPI(`/api/ai-config/history?limit=${limit}`);
}

export async function getAIConfigGeneration(id) {
  return fetchAPI(`/api/ai-config/generation/${id}`);
}

// Blocked Users
export async function getBlockedUsers() {
  return fetchAPI('/api/blocked-users');
}

export async function blockUser(telegramId, username = null, displayName = null, reason = null) {
  return fetchAPI('/api/blocked-users', {
    method: 'POST',
    body: JSON.stringify({
      telegramId,
      username,
      displayName,
      reason
    }),
  });
}

export async function unblockUser(blockId) {
  return fetchAPI(`/api/blocked-users/${blockId}`, {
    method: 'DELETE',
  });
}

export async function unblockUserByTelegramId(telegramId) {
  return fetchAPI(`/api/blocked-users/telegram/${telegramId}`, {
    method: 'DELETE',
  });
}

export async function checkIfBlocked(telegramId) {
  return fetchAPI(`/api/blocked-users/check/${telegramId}`);
}