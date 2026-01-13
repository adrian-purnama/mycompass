/**
 * Send Telegram notification
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Telegram chat ID
 * @param {string} message - Message to send
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendTelegramNotification(botToken, chatId, message) {
  if (!botToken || !chatId) {
    return { success: false, error: 'Bot token and chat ID are required' };
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      return {
        success: false,
        error: result.description || `HTTP ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Telegram notification error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send Telegram notification',
    };
  }
}

/**
 * Format backup completion message for Telegram
 * @param {Object} logEntry - Backup log entry
 * @param {Object} schedule - Backup schedule
 * @returns {string} Formatted message
 */
export function formatBackupTelegramMessage(logEntry, schedule) {
  const statusEmoji = logEntry.status === 'success' ? '✅' : '❌';
  const statusText = logEntry.status === 'success' ? 'SUCCESS' : 'FAILED';
  
  const duration = logEntry.duration
    ? `${Math.round(logEntry.duration / 1000)}s`
    : 'N/A';
  
  const fileSize = logEntry.fileSize
    ? formatFileSize(logEntry.fileSize)
    : 'N/A';

  let message = `<b>${statusEmoji} Backup ${statusText}</b>\n\n`;
  message += `<b>Connection:</b> ${logEntry.connectionName || 'N/A'}\n`;
  message += `<b>Database:</b> ${logEntry.databaseName || 'N/A'}\n`;
  message += `<b>Collections:</b> ${logEntry.collectionsBackedUp?.length || 0}\n`;
  
  if (logEntry.status === 'success') {
    message += `<b>File Size:</b> ${fileSize}\n`;
    message += `<b>Duration:</b> ${duration}\n`;
    if (logEntry.fileLink) {
      message += `\n<a href="${logEntry.fileLink}">View Backup</a>`;
    }
  } else {
    message += `<b>Error:</b> ${logEntry.error || 'Unknown error'}\n`;
  }
  
  const startedAt = logEntry.startedAt
    ? new Date(logEntry.startedAt).toLocaleString()
    : 'N/A';
  message += `\n<b>Started:</b> ${startedAt}`;

  return message;
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

