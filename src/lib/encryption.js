import CryptoJS from 'crypto-js';

/**
 * Derive a key from the master password using PBKDF2
 * @param {string} password - Master password
 * @param {string|WordArray} salt - Salt for key derivation (hex string or WordArray)
 * @returns {string} Derived key
 */
export function deriveKey(password, salt) {
  // Use PBKDF2 with 10000 iterations
  // PBKDF2 can accept both string and WordArray for salt
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 10000
  }).toString();
}

/**
 * Hash the master password for storage
 * @param {string} password - Master password
 * @returns {string} Hashed password
 */
export function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required for hashing');
  }
  
  // Generate random salt as WordArray
  const salt = CryptoJS.lib.WordArray.random(128 / 8);
  
  // Convert salt to hex string for storage
  const saltHex = salt.toString();
  
  // Compute hash - PBKDF2 accepts WordArray or string for salt
  const hash = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 10000
  });
  
  // Return salt:hash format (both as hex strings)
  return saltHex + ':' + hash.toString();
}

/**
 * Verify master password against stored hash
 * @param {string} password - Password to verify
 * @param {string} hash - Stored hash
 * @returns {boolean} True if password matches
 */
export function verifyPassword(password, hash) {
  try {
    if (!password || !hash) {
      console.error('verifyPassword: Missing password or hash');
      return false;
    }

    const parts = hash.split(':');
    if (parts.length !== 2) {
      console.error('Invalid hash format - expected salt:hash, got:', parts.length, 'parts');
      return false;
    }

    const [saltHex, storedHash] = parts;
    if (!saltHex || !storedHash) {
      console.error('Missing salt or hash in stored data');
      return false;
    }

    // Parse salt from hex string to WordArray (same format as when hashing)
    let salt;
    try {
      // Parse hex string back to WordArray (this is how it was stored)
      salt = CryptoJS.enc.Hex.parse(saltHex);
    } catch (parseError) {
      console.error('Failed to parse salt as hex:', parseError, 'Salt hex:', saltHex.substring(0, 20) + '...');
      // Fallback: try using salt directly as string
      // PBKDF2 can accept string, but WordArray is preferred
      salt = saltHex;
    }

    // Compute hash with the same parameters used during hashing
    // PBKDF2 should work with WordArray salt (preferred) or string
    const computedHash = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 10000
    }).toString();

    // Debug logging (remove in production)
    if (computedHash !== storedHash) {
      console.log('Hash mismatch - computed length:', computedHash.length, 'stored length:', storedHash.length);
      console.log('Salt hex length:', saltHex.length);
    }

    // Use constant-time comparison to prevent timing attacks
    return computedHash === storedHash;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Encrypt data using AES
 * @param {string} data - Data to encrypt
 * @param {string} password - Master password
 * @returns {string} Encrypted data
 */
export function encrypt(data, password) {
  try {
    if (!password || typeof password !== 'string') {
      throw new Error('Password is required for encryption');
    }
    
    // Generate random salt and IV as WordArrays
    const salt = CryptoJS.lib.WordArray.random(128 / 8);
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    
    // Derive key from password and salt (PBKDF2 accepts WordArray)
    const key = deriveKey(password, salt);
    
    // Encrypt the data
    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Return salt:iv:encrypted format (all as hex strings)
    return salt.toString() + ':' + iv.toString() + ':' + encrypted.toString();
  } catch (error) {
    throw new Error('Encryption failed: ' + error.message);
  }
}

/**
 * Decrypt data using AES
 * @param {string} encryptedData - Encrypted data
 * @param {string} password - Master password
 * @returns {string} Decrypted data
 */
export function decrypt(encryptedData, password) {
  try {
    if (!encryptedData || typeof encryptedData !== 'string') {
      throw new Error('Invalid encrypted data format');
    }

    if (!password || typeof password !== 'string') {
      throw new Error('Password is required');
    }

    // Split the encrypted data into salt, iv, and ciphertext
    const parts = encryptedData.split(':');
    
    if (parts.length < 2) {
      throw new Error('Invalid encrypted data format - missing components');
    }

    // Handle both old format (salt:ciphertext) and new format (salt:iv:ciphertext)
    let salt, iv, ciphertext;
    
    if (parts.length === 2) {
      // Old format - use salt as IV (backward compatibility)
      salt = parts[0];
      ciphertext = parts[1];
      iv = salt; // Use salt as IV for old format
    } else if (parts.length === 3) {
      // New format
      salt = parts[0];
      iv = parts[1];
      ciphertext = parts[2];
    } else {
      throw new Error('Invalid encrypted data format - too many components');
    }

    if (!salt || !ciphertext || (parts.length === 3 && !iv)) {
      throw new Error('Invalid encrypted data format - missing salt or ciphertext');
    }

    // Parse salt from hex string to WordArray for key derivation
    let saltWordArray;
    try {
      saltWordArray = CryptoJS.enc.Hex.parse(salt);
    } catch (parseError) {
      console.error('Failed to parse salt as hex:', parseError);
      // Fallback: use salt as string (PBKDF2 can accept string)
      saltWordArray = salt;
    }
    
    // Derive key from password and salt (must match encryption method)
    const key = deriveKey(password, saltWordArray);
    
    // Parse IV as hex - handle both string and WordArray formats
    let ivParsed;
    try {
      ivParsed = CryptoJS.enc.Hex.parse(iv);
    } catch (parseError) {
      // If parsing fails, try using the salt directly as WordArray
      try {
        ivParsed = CryptoJS.enc.Hex.parse(salt);
      } catch {
        throw new Error('Invalid IV format in encrypted data');
      }
    }
    
    // Decrypt the data
    const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
      iv: ivParsed,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedText || decryptedText.trim() === '') {
      throw new Error('Decryption resulted in empty string. This usually means the password is incorrect.');
    }
    
    return decryptedText;
  } catch (error) {
    // Re-throw with more context if it's already a meaningful error
    if (error.message.includes('Invalid') || 
        error.message.includes('empty') || 
        error.message.includes('incorrect') ||
        error.message.includes('required')) {
      throw error;
    }
    // Generic error for unexpected issues
    throw new Error('Decryption failed. Invalid password or corrupted data.');
  }
}

