import { getAppDatabase } from './appdb';
import { encrypt, decrypt } from './encryption';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google-drive/auth/callback';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

/**
 * Get Google OAuth authorization URL
 * @param {string} userId - User ID
 * @returns {string} Authorization URL
 */
export function getGoogleAuthUrl(userId) {
  const scopes = [
    'https://www.googleapis.com/auth/drive.file', // Access to files created by the app
  ].join(' ');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
    state: userId, // Pass userId in state for callback
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from OAuth callback
 * @returns {Promise<{accessToken: string, refreshToken: string, expiresIn: number}>}
 */
export async function exchangeCodeForTokens(code) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to exchange code for tokens');
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Store Google Drive tokens for a user
 * @param {string} userId - User ID
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 * @param {number} expiresIn - Expires in seconds
 */
export async function storeTokens(userId, accessToken, refreshToken, expiresIn) {
  const { db } = await getAppDatabase();
  const tokensCollection = db.collection('google_drive_tokens');

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

  const encryptedAccessToken = encrypt(accessToken, ENCRYPTION_KEY);
  const encryptedRefreshToken = encrypt(refreshToken, ENCRYPTION_KEY);

  await tokensCollection.updateOne(
    { userId },
    {
      $set: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

/**
 * Get stored tokens for a user
 * @param {string} userId - User ID
 * @returns {Promise<{accessToken: string, refreshToken: string} | null>}
 */
export async function getTokens(userId) {
  const { db } = await getAppDatabase();
  const tokensCollection = db.collection('google_drive_tokens');

  const tokenDoc = await tokensCollection.findOne({ userId });
  if (!tokenDoc) {
    return null;
  }

  const accessToken = decrypt(tokenDoc.accessToken, ENCRYPTION_KEY);
  const refreshToken = decrypt(tokenDoc.refreshToken, ENCRYPTION_KEY);

  return {
    accessToken,
    refreshToken,
    expiresAt: tokenDoc.expiresAt,
  };
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<{accessToken: string, expiresIn: number}>}
 */
export async function refreshAccessToken(refreshToken) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to refresh token');
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Get valid access token (refresh if needed)
 * @param {string} userId - User ID
 * @returns {Promise<string>} Valid access token
 */
export async function getValidAccessToken(userId) {
  const tokens = await getTokens(userId);
  if (!tokens) {
    throw new Error('Google Drive not connected');
  }

  // Check if token is expired (with 5 minute buffer)
  const now = new Date();
  const expiresAt = new Date(tokens.expiresAt);
  const bufferTime = 5 * 60 * 1000; // 5 minutes

  if (now.getTime() + bufferTime >= expiresAt.getTime()) {
    // Token expired or about to expire, refresh it
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    const expiresIn = refreshed.expiresIn || 3600;
    
    // Update stored tokens
    await storeTokens(userId, refreshed.accessToken, tokens.refreshToken, expiresIn);
    
    return refreshed.accessToken;
  }

  return tokens.accessToken;
}

/**
 * Upload file to Google Drive
 * @param {string} userId - User ID
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - File name
 * @param {string} mimeType - MIME type
 * @param {string} folderName - Optional folder name to organize backups
 * @returns {Promise<{fileId: string, webViewLink: string}>}
 */
export async function uploadFile(userId, fileBuffer, fileName, mimeType = 'application/zip', folderName = null) {
  const accessToken = await getValidAccessToken(userId);

  // Create folder if specified (handles nested folders)
  let folderId = null;
  if (folderName) {
    folderId = await createFolderRecursive(userId, folderName);
  }

  // Upload file using resumable upload for better reliability
  // First, create the file metadata
  const metadata = {
    name: fileName,
    mimeType,
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  // Try resumable upload first, fallback to multipart for smaller files
  const fileSize = fileBuffer.length;
  const useMultipart = fileSize < 5 * 1024 * 1024; // Use multipart for files < 5MB

  let fileData;

  if (useMultipart) {
    // Use multipart upload for smaller files (simpler, more reliable)
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelim = '\r\n--' + boundary + '--';

    const multipartBody = Buffer.concat([
      Buffer.from(delimiter + 'Content-Type: application/json\r\n\r\n'),
      Buffer.from(JSON.stringify(metadata)),
      Buffer.from(delimiter + `Content-Type: ${mimeType}\r\n\r\n`),
      fileBuffer,
      Buffer.from(closeDelim),
    ]);

    const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': multipartBody.length.toString(),
      },
      body: multipartBody,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      let errorMessage = 'Failed to upload file to Google Drive';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error?.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    fileData = await uploadResponse.json();
  } else {
    // Use resumable upload for larger files
    // Step 1: Create file metadata and get upload URL
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      let errorMessage = 'Failed to create file in Google Drive';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error?.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const uploadUrl = createResponse.headers.get('Location');
    if (!uploadUrl) {
      // Fallback to multipart if Location header is missing
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const delimiter = '\r\n--' + boundary + '\r\n';
      const closeDelim = '\r\n--' + boundary + '--';

      const multipartBody = Buffer.concat([
        Buffer.from(delimiter + 'Content-Type: application/json\r\n\r\n'),
        Buffer.from(JSON.stringify(metadata)),
        Buffer.from(delimiter + `Content-Type: ${mimeType}\r\n\r\n`),
        fileBuffer,
        Buffer.from(closeDelim),
      ]);

      const fallbackResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': multipartBody.length.toString(),
        },
        body: multipartBody,
      });

      if (!fallbackResponse.ok) {
        const errorText = await fallbackResponse.text();
        let errorMessage = 'Failed to upload file to Google Drive';
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.error?.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      fileData = await fallbackResponse.json();
    } else {
      // Step 2: Upload file data using resumable URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileBuffer.length.toString(),
        },
        body: fileBuffer,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(errorText || 'Failed to upload file to Google Drive');
      }

      const responseText = await uploadResponse.text();
      if (responseText) {
        try {
          fileData = JSON.parse(responseText);
        } catch (e) {
          // Response is not JSON, will query for file below
        }
      }
    }
  }

  // If fileData is not available (e.g., from resumable upload with empty response), query for it
  if (!fileData || !fileData.id) {
    // Query for the file we just uploaded
    const accessToken = await getValidAccessToken(userId);
    let query = `name='${fileName.replace(/'/g, "\\'")}' and trashed=false`;
    if (folderId) {
      query += ` and '${folderId}' in parents`;
    } else {
      query += ` and 'root' in parents`;
    }
    
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&orderBy=createdTime desc&pageSize=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.files && searchData.files.length > 0) {
        fileData = searchData.files[0];
      } else {
        throw new Error('File uploaded but could not be found');
      }
    } else {
      throw new Error('File uploaded but could not retrieve file information');
    }
  }

  return {
    fileId: fileData.id,
    webViewLink: fileData.webViewLink || `https://drive.google.com/file/d/${fileData.id}/view`,
  };
}

/**
 * Create a folder in Google Drive (handles nested paths like "Parent/Child")
 * @param {string} userId - User ID
 * @param {string} folderPath - Folder path (e.g., "Parent/Child")
 * @returns {Promise<string>} Folder ID
 */
async function createFolderRecursive(userId, folderPath) {
  const parts = folderPath.split('/').filter(p => p.trim());
  let parentId = null;

  for (const part of parts) {
    parentId = await getOrCreateFolder(userId, part, parentId);
  }

  return parentId;
}

/**
 * Get existing folder or create new one
 * @param {string} userId - User ID
 * @param {string} folderName - Folder name
 * @param {string|null} parentId - Parent folder ID
 * @returns {Promise<string>} Folder ID
 */
async function getOrCreateFolder(userId, folderName, parentId = null) {
  const accessToken = await getValidAccessToken(userId);

  // First, try to find existing folder
  let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  } else {
    query += ` and 'root' in parents`;
  }

  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (searchResponse.ok) {
    const searchData = await searchResponse.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
  }

  // Folder doesn't exist, create it
  const createBody = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    createBody.parents = [parentId];
  }

  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createBody),
  });

  if (!createResponse.ok) {
    const error = await createResponse.json();
    throw new Error(error.error?.message || 'Failed to create folder');
  }

  const folderData = await createResponse.json();
  return folderData.id;
}

/**
 * Delete file from Google Drive
 * @param {string} userId - User ID
 * @param {string} fileId - File ID
 */
export async function deleteFile(userId, fileId) {
  const accessToken = await getValidAccessToken(userId);

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to delete file from Google Drive');
  }
}

/**
 * Check if user has Google Drive connected
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
export async function isConnected(userId) {
  const tokens = await getTokens(userId);
  return tokens !== null;
}

/**
 * Disconnect Google Drive (delete tokens)
 * @param {string} userId - User ID
 */
export async function disconnect(userId) {
  const { db } = await getAppDatabase();
  const tokensCollection = db.collection('google_drive_tokens');
  await tokensCollection.deleteOne({ userId });
}

