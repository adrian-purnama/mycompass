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
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [executeBackup] Starting backup execution for schedule: ${scheduleId}`);
  
  const { db } = await getAppDatabase();
  const schedulesCollection = db.collection('backup_schedules');
  const logsCollection = db.collection('backup_logs');
  const connectionsCollection = db.collection('connections');

  // Get schedule
  console.log(`[${timestamp}] [executeBackup] Fetching schedule from database...`);
  const schedule = await schedulesCollection.findOne({ _id: new ObjectId(scheduleId) });
  if (!schedule || !schedule.enabled) {
    console.error(`[${timestamp}] [executeBackup] Schedule ${scheduleId} not found or disabled`);
    return { success: false, error: 'Schedule not found or disabled' };
  }
  
  console.log(`[${timestamp}] [executeBackup] Schedule found: DB=${schedule.databaseName}, Collections=${schedule.collections?.length || 'ALL'}, Connection=${schedule.connectionId}`);

  // Get connection
  console.log(`[${timestamp}] [executeBackup] Fetching connection from database...`);
  const connection = await connectionsCollection.findOne({ _id: new ObjectId(schedule.connectionId) });
  if (!connection) {
    console.error(`[${timestamp}] [executeBackup] Connection ${schedule.connectionId} not found`);
    return { success: false, error: 'Connection not found' };
  }
  
  console.log(`[${timestamp}] [executeBackup] Connection found: ${connection.displayName}`);

  // Decrypt connection string
  console.log(`[${timestamp}] [executeBackup] Decrypting connection string...`);
  const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
  let connectionString;
  try {
    const { decrypt } = await import('./encryption');
    connectionString = decrypt(connection.encryptedConnectionString, encryptionKey);
    console.log(`[${timestamp}] [executeBackup] Connection string decrypted successfully`);
  } catch (error) {
    console.error(`[${timestamp}] [executeBackup] Failed to decrypt connection string: ${error.message}`);
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
  console.log(`[${timestamp}] [executeBackup] Created backup log entry: ${logId}`);

  try {
    // Connect to MongoDB
    console.log(`[${timestamp}] [executeBackup] Connecting to MongoDB...`);
    const client = await getMongoClient(connectionString);
    const mongoDb = client.db(schedule.databaseName);
    console.log(`[${timestamp}] [executeBackup] Connected to database: ${schedule.databaseName}`);

    // Get collections to backup
    console.log(`[${timestamp}] [executeBackup] Determining collections to backup...`);
    const collectionsToBackup = schedule.collections && schedule.collections.length > 0
      ? schedule.collections
      : await mongoDb.listCollections().toArray().then(cols => 
          cols.map(c => c.name).filter(name => !name.startsWith('system.'))
        );

    console.log(`[${timestamp}] [executeBackup] Collections to backup: ${collectionsToBackup.length} collection(s) - ${collectionsToBackup.join(', ')}`);

    if (collectionsToBackup.length === 0) {
      console.log(`[${timestamp}] [executeBackup] No collections to backup, skipping...`);
      throw new Error('No collections to backup');
    }

    // Create ZIP file
    console.log(`[${timestamp}] [executeBackup] Creating ZIP archive...`);
    const zip = new JSZip();
    const collectionsBackedUp = [];

    // Process each collection
    console.log(`[${timestamp}] [executeBackup] Starting collection backup process...`);
    for (let i = 0; i < collectionsToBackup.length; i++) {
      const collectionName = collectionsToBackup[i];
      console.log(`[${timestamp}] [executeBackup] [${i + 1}/${collectionsToBackup.length}] Backing up collection: ${collectionName}`);
      
      try {
        const collection = mongoDb.collection(collectionName);
        const documents = await collection.find({}).toArray();
        console.log(`[${timestamp}] [executeBackup] [${i + 1}/${collectionsToBackup.length}] Found ${documents.length} document(s) in ${collectionName}`);
        
        // Add to ZIP
        const jsonString = JSON.stringify(documents, null, 2);
        zip.file(`${collectionName}.json`, jsonString);
        collectionsBackedUp.push(collectionName);
        console.log(`[${timestamp}] [executeBackup] [${i + 1}/${collectionsToBackup.length}] ✓ ${collectionName} backed up successfully`);
      } catch (error) {
        console.error(`[${timestamp}] [executeBackup] [${i + 1}/${collectionsToBackup.length}] ✗ Error backing up collection ${collectionName}:`, error.message);
        // Add error file to ZIP
        zip.file(`${collectionName}.json`, JSON.stringify({
          error: `Failed to backup: ${error.message}`
        }, null, 2));
      }
    }

    // Generate ZIP buffer
    console.log(`[${timestamp}] [executeBackup] Generating ZIP archive (${collectionsBackedUp.length} collection(s))...`);
    const zipBuffer = await zip.generateAsync({ 
      type: 'nodebuffer', 
      compression: 'DEFLATE', 
      compressionOptions: { level: 9 } 
    });
    const zipSizeMB = (zipBuffer.length / (1024 * 1024)).toFixed(2);
    console.log(`[${timestamp}] [executeBackup] ZIP archive generated: ${zipSizeMB} MB`);

    // Generate filename with connection name and database name
    const now = new Date();
    const dateTimeStr = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    // Sanitize connection name for filename (remove special characters)
    const sanitizedConnectionName = connection.displayName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `backup_${sanitizedConnectionName}_${schedule.databaseName}_${dateTimeStr}.zip`;
    console.log(`[${timestamp}] [executeBackup] Backup filename: ${fileName}`);

    // Upload to Google Drive - create folder structure: backup/connectionName/databaseName
    // The "backup" folder will be created automatically if it doesn't exist
    // All backups will go into this folder, organized by connection and database name
    const folderName = `backup/${connection.displayName}/${schedule.databaseName}`;
    console.log(`[${timestamp}] [executeBackup] Uploading to Google Drive: ${folderName}/${fileName}...`);
    const uploadResult = await uploadFile(
      schedule.userId,
      zipBuffer,
      fileName,
      'application/zip',
      folderName
    );
    console.log(`[${timestamp}] [executeBackup] ✓ Uploaded to Google Drive successfully (File ID: ${uploadResult.fileId})`);

    // Update log entry with success
    const completedAt = new Date();
    const duration = completedAt.getTime() - logEntry.startedAt.getTime();
    const durationSeconds = (duration / 1000).toFixed(2);
    
    console.log(`[${timestamp}] [executeBackup] Updating backup log entry with success status...`);
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
    console.log(`[${timestamp}] [executeBackup] Enforcing retention policy (keep last ${schedule.retentionDays} backup(s))...`);
    await enforceRetentionPolicy(schedule.userId, scheduleId, schedule.retentionDays);
    console.log(`[${timestamp}] [executeBackup] Retention policy enforced`);

    // Send Telegram notification if configured at organization level
    if (schedule.organizationId) {
      console.log(`[${timestamp}] [executeBackup] Checking for Telegram notification configuration...`);
      try {
        const organizationsCollection = db.collection('organizations');
        const organization = await organizationsCollection.findOne({
          _id: new ObjectId(schedule.organizationId)
        });

        if (organization && organization.telegramBotToken && organization.telegramChatId) {
          const updatedLog = await logsCollection.findOne({ _id: new ObjectId(logId) });
          const message = formatBackupTelegramMessage(updatedLog, schedule);
          console.log(`[${timestamp}] [executeBackup] Sending Telegram notification...`);
          await sendTelegramNotification(
            organization.telegramBotToken,
            organization.telegramChatId,
            message
          );
          console.log(`[${timestamp}] [executeBackup] ✓ Telegram notification sent`);
        } else {
          console.log(`[${timestamp}] [executeBackup] Telegram not configured for this organization`);
        }
      } catch (telegramError) {
        console.error(`[${timestamp}] [executeBackup] Failed to send Telegram notification:`, telegramError.message);
        // Don't fail the backup if Telegram notification fails
      }
    } else {
      console.log(`[${timestamp}] [executeBackup] No organization ID, skipping Telegram notification`);
    }

    console.log(`[${timestamp}] [executeBackup] ===== BACKUP COMPLETED SUCCESSFULLY =====`);
    console.log(`[${timestamp}] [executeBackup] Schedule: ${scheduleId}`);
    console.log(`[${timestamp}] [executeBackup] Database: ${schedule.databaseName}`);
    console.log(`[${timestamp}] [executeBackup] Collections: ${collectionsBackedUp.join(', ')}`);
    console.log(`[${timestamp}] [executeBackup] File size: ${zipSizeMB} MB`);
    console.log(`[${timestamp}] [executeBackup] Duration: ${durationSeconds} seconds`);
    console.log(`[${timestamp}] [executeBackup] Log ID: ${logId}`);
    console.log(`[${timestamp}] [executeBackup] ===========================================`);

    return { success: true, logId };
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[${errorTimestamp}] [executeBackup] ===== BACKUP FAILED =====`);
    console.error(`[${errorTimestamp}] [executeBackup] Schedule: ${scheduleId}`);
    console.error(`[${errorTimestamp}] [executeBackup] Error: ${error.message}`);
    console.error(`[${errorTimestamp}] [executeBackup] Stack: ${error.stack}`);
    console.error(`[${errorTimestamp}] [executeBackup] ============================`);
    
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
  const logsCollection = db.collection('backup_logs');

  // Use UTC time for checking schedules (schedules are stored in UTC)
  const now = new Date();
  const currentDayUTC = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentTimeUTC = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
  const currentTimeInMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  
  // Also log local time for debugging
  const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const localDay = now.getDay();

  console.log(`[${timestamp}] UTC time: ${currentTimeUTC} (Day: ${currentDayUTC}, ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDayUTC]})`);
  console.log(`[${timestamp}] Local time: ${localTime} (Day: ${localDay}) - Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);

  // Get all enabled schedules
  const allSchedules = await schedulesCollection
    .find({ enabled: true })
    .toArray();

  console.log(`[${timestamp}] Found ${allSchedules.length} enabled schedule(s) total`);

  // Get start of today in UTC for checking executions
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // Filter schedules that are due (including overdue ones)
  const dueSchedules = await Promise.all(
    allSchedules.map(async (schedule) => {
      const scheduleId = schedule._id.toString();
      const scheduleTimezone = schedule.schedule?.timezone || 'UTC';
      
      // Use UTC for checking (schedules are stored in UTC by default)
      const checkDay = currentDayUTC;
      const checkTime = currentTimeUTC;
      
      // Check if today is in the schedule's days
      if (!schedule.schedule || !schedule.schedule.days || !schedule.schedule.days.includes(checkDay)) {
        console.log(`[${timestamp}] Schedule ${scheduleId}: Skipped - today (${checkDay}) not in schedule days: ${JSON.stringify(schedule.schedule?.days || [])}`);
        return null;
      }

      const times = schedule.schedule.times || [];
      console.log(`[${timestamp}] Schedule ${scheduleId}: Checking ${times.length} scheduled time(s): ${times.join(', ')} UTC`);
      
      // Check each scheduled time
      for (const scheduledTime of times) {
        const [scheduledHours, scheduledMinutes] = scheduledTime.split(':').map(Number);
        const scheduledTimeInMinutes = scheduledHours * 60 + scheduledMinutes;
        const timeDiff = currentTimeInMinutes - scheduledTimeInMinutes;
        
        console.log(`[${timestamp}] Schedule ${scheduleId}: Checking scheduled time ${scheduledTime} UTC (${scheduledTimeInMinutes} min) vs current ${checkTime} UTC (${currentTimeInMinutes} min) - diff: ${timeDiff} min`);
        
        // Case 1: Exact match - scheduled time is NOW
        if (timeDiff === 0) {
          console.log(`[${timestamp}] ✓ Schedule ${scheduleId}: DUE - exact match at ${checkTime} UTC (scheduled: ${scheduledTime})`);
          return schedule;
        }
        
        // Case 2: Overdue - scheduled time has passed today but hasn't been executed yet
        // Check any overdue time from today (not just last hour)
        if (timeDiff > 0) {
          console.log(`[${timestamp}] Schedule ${scheduleId}: Scheduled time ${scheduledTime} UTC is overdue by ${timeDiff} minutes. Checking execution history...`);
          
          // Check if this schedule was already executed for this scheduled time today
          const lastExecutions = await logsCollection
            .find({
              scheduleId: schedule._id,
              startedAt: { $gte: todayStart },
              status: { $in: ['success', 'error'] }
            })
            .sort({ startedAt: -1 })
            .toArray();
          
          console.log(`[${timestamp}] Schedule ${scheduleId}: Found ${lastExecutions.length} execution(s) today (since ${todayStart.toISOString()})`);
          
          let alreadyExecuted = false;
          let executionDetails = [];
          
          // Check if any execution happened at or after the scheduled time
          for (const execution of lastExecutions) {
            const execTime = new Date(execution.startedAt);
            const execTimeInMinutes = execTime.getUTCHours() * 60 + execTime.getUTCMinutes();
            const execTimeStr = `${String(execTime.getUTCHours()).padStart(2, '0')}:${String(execTime.getUTCMinutes()).padStart(2, '0')}`;
            
            executionDetails.push({
              time: execTimeStr,
              timeInMinutes: execTimeInMinutes,
              status: execution.status,
              startedAt: execution.startedAt
            });
            
            // If execution happened at or after the scheduled time, it was already executed
            if (execTimeInMinutes >= scheduledTimeInMinutes) {
              alreadyExecuted = true;
              console.log(`[${timestamp}] Schedule ${scheduleId}: Execution found at ${execTimeStr} UTC (${execTimeInMinutes} min) >= scheduled ${scheduledTime} UTC (${scheduledTimeInMinutes} min) - ALREADY EXECUTED`);
              break;
            } else {
              console.log(`[${timestamp}] Schedule ${scheduleId}: Execution at ${execTimeStr} UTC (${execTimeInMinutes} min) < scheduled ${scheduledTime} UTC (${scheduledTimeInMinutes} min) - before scheduled time`);
            }
          }
          
          if (!alreadyExecuted) {
            if (lastExecutions.length > 0) {
              console.log(`[${timestamp}] Schedule ${scheduleId}: Execution history: ${JSON.stringify(executionDetails.map(e => `${e.time} UTC (${e.status})`))}`);
            }
            console.log(`[${timestamp}] ✓ Schedule ${scheduleId}: DUE - overdue (scheduled: ${scheduledTime} UTC, ${timeDiff} min ago), not executed yet`);
            return schedule;
          } else {
            console.log(`[${timestamp}] Schedule ${scheduleId}: Skipped - overdue but already executed for ${scheduledTime} UTC today`);
          }
        } else {
          // Scheduled time is in the future
          const futureMinutes = Math.abs(timeDiff);
          console.log(`[${timestamp}] Schedule ${scheduleId}: Scheduled time ${scheduledTime} UTC is ${futureMinutes} minutes in the future - not due yet`);
        }
      }
      
      console.log(`[${timestamp}] Schedule ${scheduleId}: Not due - current time ${checkTime} UTC, checked all scheduled times`);
      return null;
    })
  );

  // Filter out null values
  const validDueSchedules = dueSchedules.filter(s => s !== null);

  console.log(`[${timestamp}] ===== getDueSchedules SUMMARY =====`);
  console.log(`[${timestamp}] Total enabled schedules: ${allSchedules.length}`);
  console.log(`[${timestamp}] Schedules due to run: ${validDueSchedules.length}`);
  if (validDueSchedules.length > 0) {
    validDueSchedules.forEach((schedule, index) => {
      console.log(`[${timestamp}]   ${index + 1}. Schedule ID: ${schedule._id.toString()}, DB: ${schedule.databaseName}, Times: ${schedule.schedule?.times?.join(', ') || 'N/A'}`);
    });
  }
  console.log(`[${timestamp}] ====================================`);
  
  return validDueSchedules;
}


