import { getMongoClient } from './mongodb';
import { getAppDatabase } from './appdb';
import { uploadFile, deleteFile } from './googleDrive';
import { sendTelegramNotification, formatBackupTelegramMessage } from './telegram';
import { ObjectId } from 'mongodb';
import JSZip from 'jszip';

/**
 * Execute a backup for a schedule
 * @param {string} scheduleId - Schedule ID
 * @returns {Promise<{success: boolean, logId?: string, error?: string}>}
 */
export async function executeBackup(scheduleId) {
  const { db } = await getAppDatabase();
  const schedulesCollection = db.collection('backup_schedules');
  const logsCollection = db.collection('backup_logs');
  const connectionsCollection = db.collection('connections');

  // Get schedule
  const schedule = await schedulesCollection.findOne({ _id: new ObjectId(scheduleId) });
  if (!schedule || !schedule.enabled) {
    return { success: false, error: 'Schedule not found or disabled' };
  }

  // Get connection
  const connection = await connectionsCollection.findOne({ _id: new ObjectId(schedule.connectionId) });
  if (!connection) {
    return { success: false, error: 'Connection not found' };
  }

  // Decrypt connection string
  const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
  let connectionString;
  try {
    const { decrypt } = await import('./encryption');
    connectionString = decrypt(connection.encryptedConnectionString, encryptionKey);
  } catch (error) {
    return { success: false, error: 'Failed to decrypt connection string' };
  }

  // Create log entry
  const logEntry = {
    scheduleId: new ObjectId(scheduleId),
    userId: schedule.userId,
    connectionName: connection.displayName, // Store connection name for display
    databaseName: schedule.databaseName, // Store database name for display
    status: 'running',
    startedAt: new Date(),
    collectionsBackedUp: [],
    fileSize: 0,
    filePath: null,
    error: null,
  };

  const logResult = await logsCollection.insertOne(logEntry);
  const logId = logResult.insertedId.toString();

  try {
    // Connect to MongoDB
    const client = await getMongoClient(connectionString);
    const mongoDb = client.db(schedule.databaseName);

    // Get collections to backup
    const collectionsToBackup = schedule.collections && schedule.collections.length > 0
      ? schedule.collections
      : await mongoDb.listCollections().toArray().then(cols => 
          cols.map(c => c.name).filter(name => !name.startsWith('system.'))
        );

    if (collectionsToBackup.length === 0) {
      throw new Error('No collections to backup');
    }

    // Create ZIP file
    const zip = new JSZip();
    const collectionsBackedUp = [];

    // Process each collection
    for (const collectionName of collectionsToBackup) {
      try {
        const collection = mongoDb.collection(collectionName);
        const documents = await collection.find({}).toArray();
        
        // Add to ZIP
        const jsonString = JSON.stringify(documents, null, 2);
        zip.file(`${collectionName}.json`, jsonString);
        collectionsBackedUp.push(collectionName);
      } catch (error) {
        console.error(`Error backing up collection ${collectionName}:`, error);
        // Add error file to ZIP
        zip.file(`${collectionName}.json`, JSON.stringify({
          error: `Failed to backup: ${error.message}`
        }, null, 2));
      }
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ 
      type: 'nodebuffer', 
      compression: 'DEFLATE', 
      compressionOptions: { level: 9 } 
    });

    // Generate filename with connection name and database name
    const now = new Date();
    const dateTimeStr = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    // Sanitize connection name for filename (remove special characters)
    const sanitizedConnectionName = connection.displayName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `backup_${sanitizedConnectionName}_${schedule.databaseName}_${dateTimeStr}.zip`;

    // Upload to Google Drive - create folder structure: backup/connectionName/databaseName
    // The "backup" folder will be created automatically if it doesn't exist
    // All backups will go into this folder, organized by connection and database name
    const folderName = `backup/${connection.displayName}/${schedule.databaseName}`;
    const uploadResult = await uploadFile(
      schedule.userId,
      zipBuffer,
      fileName,
      'application/zip',
      folderName
    );

    // Update log entry with success
    const completedAt = new Date();
    const duration = completedAt.getTime() - logEntry.startedAt.getTime();

    await logsCollection.updateOne(
      { _id: new ObjectId(logId) },
      {
        $set: {
          status: 'success',
          completedAt,
          duration,
          collectionsBackedUp,
          fileSize: zipBuffer.length,
          filePath: uploadResult.fileId,
          fileLink: uploadResult.webViewLink, // Save the web view link
        },
      }
    );

    // Enforce retention policy - keep only the last N backups
    await enforceRetentionPolicy(schedule.userId, scheduleId, schedule.retentionDays);

    // Send Telegram notification if configured at organization level
    if (schedule.organizationId) {
      try {
        const organizationsCollection = db.collection('organizations');
        const organization = await organizationsCollection.findOne({
          _id: new ObjectId(schedule.organizationId)
        });

        if (organization && organization.telegramBotToken && organization.telegramChatId) {
          const updatedLog = await logsCollection.findOne({ _id: new ObjectId(logId) });
          const message = formatBackupTelegramMessage(updatedLog, schedule);
          await sendTelegramNotification(
            organization.telegramBotToken,
            organization.telegramChatId,
            message
          );
        }
      } catch (telegramError) {
        console.error('Failed to send Telegram notification:', telegramError);
        // Don't fail the backup if Telegram notification fails
      }
    }

    return { success: true, logId };
  } catch (error) {
    console.error('Backup execution error:', error);
    
    // Update log entry with error
    const completedAt = new Date();
    const duration = completedAt.getTime() - logEntry.startedAt.getTime();

    await logsCollection.updateOne(
      { _id: new ObjectId(logId) },
      {
        $set: {
          status: 'error',
          completedAt,
          duration,
          error: error.message || 'Backup failed',
        },
      }
    );

    // Send Telegram notification for error if configured at organization level
    if (schedule.organizationId) {
      try {
        const organizationsCollection = db.collection('organizations');
        const organization = await organizationsCollection.findOne({
          _id: new ObjectId(schedule.organizationId)
        });

        if (organization && organization.telegramBotToken && organization.telegramChatId) {
          const errorLog = await logsCollection.findOne({ _id: new ObjectId(logId) });
          const message = formatBackupTelegramMessage(errorLog, schedule);
          await sendTelegramNotification(
            organization.telegramBotToken,
            organization.telegramChatId,
            message
          );
        }
      } catch (telegramError) {
        console.error('Failed to send Telegram notification:', telegramError);
        // Don't fail the backup if Telegram notification fails
      }
    }

    return { success: false, error: error.message, logId };
  }
}

/**
 * Enforce retention policy - keep only the last N backups
 * @param {string} userId - User ID
 * @param {string} scheduleId - Schedule ID
 * @param {number} retentionCount - Number of backups to keep (e.g., 3 = keep last 3 backups)
 */
async function enforceRetentionPolicy(userId, scheduleId, retentionCount) {
  const { db } = await getAppDatabase();
  const logsCollection = db.collection('backup_logs');

  // Find all successful backups for this schedule (not already deleted), sorted by date (newest first)
  const allBackups = await logsCollection
    .find({
      scheduleId: new ObjectId(scheduleId),
      userId,
      status: 'success',
      filePath: { $ne: null },
    })
    .sort({ startedAt: -1 }) // Newest first
    .toArray();

  // If we have more backups than the retention count, mark the oldest ones as deleted
  if (allBackups.length > retentionCount) {
    const backupsToDelete = allBackups.slice(retentionCount); // Get all backups after the retention count

    // Delete old backups from Google Drive and mark as deleted in logs
    for (const backup of backupsToDelete) {
      try {
        // Delete file from Google Drive
        if (backup.filePath) {
          await deleteFile(userId, backup.filePath);
        }
        // Update log entry status to 'deleted' instead of deleting the record
        await logsCollection.updateOne(
          { _id: backup._id },
          {
            $set: {
              status: 'deleted',
              deletedAt: new Date(),
              deletedReason: 'Retention policy - exceeded retention count',
            },
          }
        );
      } catch (error) {
        console.error(`Failed to delete old backup ${backup._id}:`, error);
        // Continue with other backups even if one fails
      }
    }
  }
}

/**
 * Check which schedules are due to run
 * @returns {Promise<Array<Object>>} Array of schedules that should run now
 */
export async function getDueSchedules() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] getDueSchedules: Checking for due backup schedules...`);
  
  const { db } = await getAppDatabase();
  const schedulesCollection = db.collection('backup_schedules');

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  console.log(`[${timestamp}] Current time: ${currentTime} (Day: ${currentDay}, ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDay]})`);

  // Get all enabled schedules
  const allSchedules = await schedulesCollection
    .find({ enabled: true })
    .toArray();

  console.log(`[${timestamp}] Found ${allSchedules.length} enabled schedule(s) total`);

  // Filter schedules that are due
  const dueSchedules = allSchedules.filter(schedule => {
    const scheduleId = schedule._id.toString();
    
    // Check if today is in the schedule's days
    if (!schedule.schedule || !schedule.schedule.days || !schedule.schedule.days.includes(currentDay)) {
      console.log(`[${timestamp}] Schedule ${scheduleId}: Skipped - today (${currentDay}) not in schedule days: ${JSON.stringify(schedule.schedule?.days || [])}`);
      return false;
    }

    // Check if current time matches any of the schedule's times
    const times = schedule.schedule.times || [];
    const isDue = times.includes(currentTime);
    
    if (isDue) {
      console.log(`[${timestamp}] ✓ Schedule ${scheduleId}: DUE - matches time ${currentTime} (scheduled times: ${times.join(', ')})`);
    } else {
      console.log(`[${timestamp}] Schedule ${scheduleId}: Not due - current time ${currentTime} not in scheduled times: ${times.join(', ')}`);
    }
    
    return isDue;
  });

  console.log(`[${timestamp}] getDueSchedules: Found ${dueSchedules.length} schedule(s) due to run`);
  return dueSchedules;
}


