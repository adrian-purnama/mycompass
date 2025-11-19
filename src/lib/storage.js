import { encrypt, decrypt, hashPassword, verifyPassword } from './encryption';

const STORAGE_KEYS = {
  MASTER_PASSWORD_HASH: 'mycompass_master_password_hash',
  CONNECTIONS: 'mycompass_connections',
  ACTIVE_CONNECTION: 'mycompass_active_connection'
};

/**
 * Check if master password is set
 * @returns {boolean}
 */
export function hasMasterPassword() {
  return !!localStorage.getItem(STORAGE_KEYS.MASTER_PASSWORD_HASH);
}

/**
 * Set master password (first time setup)
 * @param {string} password - Master password
 */
export function setMasterPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required');
  }
  // Trim password to ensure consistency (passwords with leading/trailing spaces are problematic)
  const trimmedPassword = password.trim();
  if (!trimmedPassword) {
    throw new Error('Password cannot be empty');
  }
  const hash = hashPassword(trimmedPassword);
  localStorage.setItem(STORAGE_KEYS.MASTER_PASSWORD_HASH, hash);
}

/**
 * Verify master password
 * @param {string} password - Password to verify
 * @returns {boolean}
 */
export function verifyMasterPassword(password) {
  if (!password || typeof password !== 'string') {
    console.error('verifyMasterPassword: Invalid password input');
    return false;
  }
  
  const hash = localStorage.getItem(STORAGE_KEYS.MASTER_PASSWORD_HASH);
  if (!hash) {
    console.error('verifyMasterPassword: No hash found in storage');
    return false;
  }
  
  console.log('Verifying password, hash format:', hash.substring(0, 50) + '...');
  
  try {
    // Try with trimmed password first (current standard)
    const trimmedPassword = password.trim();
    console.log('Trying with trimmed password, length:', trimmedPassword.length);
    if (verifyPassword(trimmedPassword, hash)) {
      console.log('Password verified successfully with trimmed version');
      return true;
    }
    
    // Fallback: try with original password (in case it was set with whitespace before trimming was added)
    // This handles backward compatibility for passwords set before the trimming fix
    if (password !== trimmedPassword) {
      console.log('Trying with original password (with whitespace), length:', password.length);
      if (verifyPassword(password, hash)) {
        console.warn('Password verified with whitespace. Consider resetting your password for better security.');
        return true;
      }
    }
    
    console.error('Password verification failed for all attempts');
    return false;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Attempt to fix password mismatch by re-encrypting connections
 * This tries to decrypt with various password variants and re-encrypts with the correct password
 * @param {string} masterPassword - Master password that verifies the hash
 * @returns {boolean} True if connections were successfully re-encrypted
 */
export function fixPasswordMismatch(masterPassword) {
  const encrypted = localStorage.getItem(STORAGE_KEYS.CONNECTIONS);
  if (!encrypted) {
    console.log('fixPasswordMismatch: No connections to fix');
    return true; // No connections to fix
  }
  
  if (!masterPassword || typeof masterPassword !== 'string') {
    console.error('fixPasswordMismatch: Invalid password');
    return false;
  }
  
  const trimmedPassword = masterPassword.trim();
  if (!trimmedPassword) {
    console.error('fixPasswordMismatch: Password is empty after trimming');
    return false;
  }
  
  console.log('fixPasswordMismatch: Attempting to fix password mismatch...');
  console.log('fixPasswordMismatch: Password length:', masterPassword.length, 'Trimmed length:', trimmedPassword.length);
  
  // Try to decrypt with various password variants
  let decrypted = null;
  let workingPassword = null;
  let lastError = null;
  
  // Try trimmed password first (standard)
  try {
    console.log('fixPasswordMismatch: Trying with trimmed password...');
    decrypted = decrypt(encrypted, trimmedPassword);
    if (decrypted && decrypted.trim() !== '') {
      try {
        const parsed = JSON.parse(decrypted);
        if (Array.isArray(parsed)) {
          workingPassword = trimmedPassword;
          console.log('fixPasswordMismatch: Successfully decrypted with trimmed password');
        }
      } catch (e) {
        console.error('fixPasswordMismatch: Decrypted data is not valid JSON:', e);
        lastError = e;
      }
    } else {
      console.log('fixPasswordMismatch: Decryption with trimmed password resulted in empty data');
    }
  } catch (e) {
    console.error('fixPasswordMismatch: Failed to decrypt with trimmed password:', e.message);
    lastError = e;
  }
  
  // If trimmed didn't work and password has whitespace, try original
  if (!workingPassword && masterPassword !== trimmedPassword) {
    try {
      console.log('fixPasswordMismatch: Trying with original (untrimmed) password...');
      decrypted = decrypt(encrypted, masterPassword);
      if (decrypted && decrypted.trim() !== '') {
        try {
          const parsed = JSON.parse(decrypted);
          if (Array.isArray(parsed)) {
            workingPassword = masterPassword;
            console.log('fixPasswordMismatch: Successfully decrypted with original password');
          }
        } catch (e) {
          console.error('fixPasswordMismatch: Decrypted data is not valid JSON:', e);
          lastError = e;
        }
      } else {
        console.log('fixPasswordMismatch: Decryption with original password resulted in empty data');
      }
    } catch (e) {
      console.error('fixPasswordMismatch: Failed to decrypt with original password:', e.message);
      lastError = e;
    }
  }
  
  // If we found a working password, re-encrypt with the standard (trimmed) password
  if (workingPassword && decrypted) {
    try {
      const connections = JSON.parse(decrypted);
      // Re-encrypt with trimmed password (standard)
      saveConnections(connections, trimmedPassword);
      console.log('fixPasswordMismatch: Successfully re-encrypted connections with correct password');
      return true;
    } catch (e) {
      console.error('fixPasswordMismatch: Failed to re-encrypt connections:', e);
      return false;
    }
  }
  
  console.error('fixPasswordMismatch: Could not decrypt connections with any password variant. Last error:', lastError?.message);
  return false;
}

/**
 * Change master password
 * @param {string} oldPassword - Current master password
 * @param {string} newPassword - New master password
 * @returns {boolean} True if successful
 */
export function changeMasterPassword(oldPassword, newPassword) {
  if (!verifyMasterPassword(oldPassword)) {
    return false;
  }

  // Re-encrypt all connections with new password
  const connections = getConnections(oldPassword);
  setMasterPassword(newPassword);
  saveConnections(connections, newPassword);
  return true;
}

/**
 * Test if password can decrypt the stored connections
 * @param {string} masterPassword - Master password to test
 * @returns {boolean} True if password can decrypt connections
 */
export function testPasswordDecryption(masterPassword) {
  const encrypted = localStorage.getItem(STORAGE_KEYS.CONNECTIONS);
  if (!encrypted) return true; // No connections to decrypt, password is valid
  
  if (!masterPassword || typeof masterPassword !== 'string') {
    console.error('testPasswordDecryption: Invalid password');
    return false;
  }
  
  // Try with trimmed password first
  const trimmedPassword = masterPassword.trim();
  try {
    const decrypted = decrypt(encrypted, trimmedPassword);
    if (!decrypted || decrypted.trim() === '') {
      // Try with original password if it has whitespace
      if (masterPassword !== trimmedPassword) {
        try {
          const decrypted2 = decrypt(encrypted, masterPassword);
          if (decrypted2 && decrypted2.trim() !== '') {
            JSON.parse(decrypted2);
            return true;
          }
        } catch (e) {
          // Ignore
        }
      }
      return false;
    }
    // Try to parse to ensure it's valid JSON
    JSON.parse(decrypted);
    return true;
  } catch (error) {
    console.error('Password decryption test failed:', error.message);
    // Try with original password if it has whitespace
    if (masterPassword !== trimmedPassword) {
      try {
        const decrypted = decrypt(encrypted, masterPassword);
        if (decrypted && decrypted.trim() !== '') {
          JSON.parse(decrypted);
          return true;
        }
      } catch (e) {
        // Ignore
      }
    }
    return false;
  }
}

/**
 * Get all saved connections (decrypted)
 * @param {string} masterPassword - Master password
 * @returns {Array} Array of connection objects
 */
export function getConnections(masterPassword) {
  const encrypted = localStorage.getItem(STORAGE_KEYS.CONNECTIONS);
  if (!encrypted) return [];

  if (!masterPassword || typeof masterPassword !== 'string') {
    throw new Error('Master password is required');
  }

  // Try with trimmed password first (standard)
  const trimmedPassword = masterPassword.trim();
  if (!trimmedPassword) {
    throw new Error('Master password cannot be empty');
  }

  try {
    // Try decrypting with trimmed password
    let decrypted = decrypt(encrypted, trimmedPassword);
    if (!decrypted || decrypted.trim() === '') {
      // If trimmed fails and password has whitespace, try original
      if (masterPassword !== trimmedPassword) {
        try {
          decrypted = decrypt(encrypted, masterPassword);
        } catch (e) {
          // Ignore, will throw error below
        }
      }
      if (!decrypted || decrypted.trim() === '') {
        throw new Error('Decryption resulted in empty data. The password may be incorrect or the data is corrupted.');
      }
    }
    
    const parsed = JSON.parse(decrypted);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to decrypt connections:', error);
    // If decryption fails, it might be due to wrong password or corrupted data
    if (error.message.includes('Invalid password') || 
        error.message.includes('wrong password') || 
        error.message.includes('incorrect') ||
        error.message.includes('empty string')) {
      throw new Error('Incorrect master password. The password cannot decrypt your saved connections. If you recently changed your password or the connections were saved with a different password, you may need to reset and re-add your connections.');
    }
    throw new Error('Failed to load connections. The data may be corrupted or encrypted with a different password.');
  }
}

/**
 * Save connections (encrypted)
 * @param {Array} connections - Array of connection objects
 * @param {string} masterPassword - Master password
 */
export function saveConnections(connections, masterPassword) {
  if (!masterPassword || typeof masterPassword !== 'string') {
    throw new Error('Master password is required to save connections');
  }
  // Ensure password is trimmed for consistency
  const trimmedPassword = masterPassword.trim();
  if (!trimmedPassword) {
    throw new Error('Master password cannot be empty');
  }
  const data = JSON.stringify(connections);
  const encrypted = encrypt(data, trimmedPassword);
  localStorage.setItem(STORAGE_KEYS.CONNECTIONS, encrypted);
}

/**
 * Add a new connection
 * @param {Object} connection - Connection object { id, displayName, connectionString, createdAt, lastUsed }
 * @param {string} masterPassword - Master password
 */
export function addConnection(connection, masterPassword) {
  const connections = getConnections(masterPassword);
  connections.push({
    ...connection,
    id: connection.id || Date.now().toString(),
    createdAt: connection.createdAt || new Date().toISOString(),
    lastUsed: connection.lastUsed || null
  });
  saveConnections(connections, masterPassword);
}

/**
 * Update an existing connection
 * @param {string} id - Connection ID
 * @param {Object} updates - Fields to update
 * @param {string} masterPassword - Master password
 * @returns {boolean} True if connection was found and updated
 */
export function updateConnection(id, updates, masterPassword) {
  const connections = getConnections(masterPassword);
  const index = connections.findIndex(conn => conn.id === id);
  if (index === -1) return false;

  connections[index] = {
    ...connections[index],
    ...updates,
    id // Ensure ID doesn't change
  };
  saveConnections(connections, masterPassword);
  return true;
}

/**
 * Delete a connection
 * @param {string} id - Connection ID
 * @param {string} masterPassword - Master password
 * @returns {boolean} True if connection was found and deleted
 */
export function deleteConnection(id, masterPassword) {
  const connections = getConnections(masterPassword);
  const filtered = connections.filter(conn => conn.id !== id);
  if (filtered.length === connections.length) return false;

  saveConnections(filtered, masterPassword);
  return true;
}

/**
 * Get active connection ID
 * @returns {string|null}
 */
export function getActiveConnectionId() {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_CONNECTION);
}

/**
 * Set active connection ID
 * @param {string} id - Connection ID
 */
export function setActiveConnectionId(id) {
  if (id) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CONNECTION, id);
  } else {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONNECTION);
  }
}

/**
 * Update last used timestamp for a connection
 * @param {string} id - Connection ID
 * @param {string} masterPassword - Master password
 */
export function updateLastUsed(id, masterPassword) {
  updateConnection(id, { lastUsed: new Date().toISOString() }, masterPassword);
}

/**
 * Clear all stored data (use with caution - this will delete all connections)
 */
export function clearAllData() {
  localStorage.removeItem(STORAGE_KEYS.CONNECTIONS);
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONNECTION);
  // Note: We don't clear the master password hash, so user can set a new password
}

/**
 * Clear only connections data (keeps master password)
 */
export function clearConnections() {
  localStorage.removeItem(STORAGE_KEYS.CONNECTIONS);
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONNECTION);
}

/**
 * Reset master password (clears everything and allows setting a new password)
 * WARNING: This will delete all saved connections as they cannot be decrypted without the old password
 * @returns {boolean} True if reset was successful
 */
export function resetMasterPassword() {
  try {
    // Clear all data including the master password hash
    localStorage.removeItem(STORAGE_KEYS.MASTER_PASSWORD_HASH);
    localStorage.removeItem(STORAGE_KEYS.CONNECTIONS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONNECTION);
    return true;
  } catch (error) {
    console.error('Failed to reset master password:', error);
    return false;
  }
}

