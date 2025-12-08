// This file now uses API calls instead of localStorage
// All data is stored in the database and linked to user accounts

/**
 * Get authentication token from localStorage
 * @returns {string|null}
 */
function getAuthToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

/**
 * Set authentication token in localStorage
 * @param {string} token
 */
function setAuthToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

/**
 * Make authenticated API request
 * @param {string} url
 * @param {Object} options
 * @returns {Promise<Response>}
 */
async function apiRequest(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Token expired or invalid, clear it
    setAuthToken(null);
    throw new Error('Session expired. Please login again.');
  }

  return response;
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!getAuthToken();
}

/**
 * Set authentication token (called after login)
 * @param {string} token
 */
export function setAuthTokenStorage(token) {
  setAuthToken(token);
}

/**
 * Clear authentication token (called on logout)
 */
export function clearAuthToken() {
  setAuthToken(null);
}

/**
 * Get all saved connections (from API)
 * @returns {Promise<Array>} Array of connection objects
 */
export async function getConnections() {
  const response = await apiRequest('/api/connections');
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to load connections');
  }

  return result.connections || [];
}

/**
 * Save connections (via API)
 * Note: This is kept for backward compatibility but now uses addConnection
 * @param {Array} connections - Array of connection objects
 */
export async function saveConnections(connections) {
  // This function is kept for compatibility but doesn't do bulk saves
  // Individual connections should be added via addConnection
  console.warn('saveConnections is deprecated. Use addConnection, updateConnection, or deleteConnection instead.');
}

/**
 * Add a new connection
 * @param {Object} connection - Connection object { displayName, connectionString }
 * @returns {Promise<Object>} Created connection
 */
export async function addConnection(connection) {
  const response = await apiRequest('/api/connections', {
    method: 'POST',
    body: JSON.stringify({
      displayName: connection.displayName,
      connectionString: connection.connectionString
    })
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to add connection');
  }

  return result.connection;
}

/**
 * Update an existing connection
 * @param {string} id - Connection ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<boolean>} True if connection was found and updated
 */
export async function updateConnection(id, updates) {
  const response = await apiRequest(`/api/connections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to update connection');
  }

  return true;
}

/**
 * Delete a connection
 * @param {string} id - Connection ID
 * @returns {Promise<boolean>} True if connection was found and deleted
 */
export async function deleteConnection(id) {
  const response = await apiRequest(`/api/connections/${id}`, {
    method: 'DELETE'
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to delete connection');
  }

  return true;
}

/**
 * Get active connection ID (from localStorage)
 * @returns {string|null}
 */
export function getActiveConnectionId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('active_connection_id');
}

/**
 * Set active connection ID (in localStorage)
 * @param {string} id - Connection ID
 */
export function setActiveConnectionId(id) {
  if (typeof window === 'undefined') return;
  if (id) {
    localStorage.setItem('active_connection_id', id);
  } else {
    localStorage.removeItem('active_connection_id');
  }
}

/**
 * Update last used timestamp for a connection
 * @param {string} id - Connection ID
 */
export async function updateLastUsed(id) {
  try {
    await updateConnection(id, { lastUsed: new Date().toISOString() });
  } catch (error) {
    console.error('Failed to update last used:', error);
  }
}

/**
 * Clear all stored data (use with caution)
 */
export function clearAllData() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('active_connection_id');
  // Note: We don't clear the auth token here as user might want to stay logged in
}

/**
 * Clear only connections data (keeps auth token)
 */
export function clearConnections() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('active_connection_id');
}

// Legacy functions for backward compatibility (no longer used but kept to prevent errors)
export function hasMasterPassword() {
  return isAuthenticated();
}

export function setMasterPassword() {
  // No longer used - password is set during registration
  console.warn('setMasterPassword is deprecated. Use registration API instead.');
}

export function verifyMasterPassword() {
  // No longer used - password is verified during login
  console.warn('verifyMasterPassword is deprecated. Use login API instead.');
}

export function changeMasterPassword() {
  // No longer used
  console.warn('changeMasterPassword is deprecated.');
  return false;
}

export function testPasswordDecryption() {
  // No longer used
  return true;
}

export function fixPasswordMismatch() {
  // No longer used
  return true;
}

export function resetMasterPassword() {
  // No longer used - user should logout and register again
  clearAuthToken();
  return true;
}
