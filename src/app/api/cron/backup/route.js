import { NextResponse } from 'next/server';
import { getDueSchedules, executeBackup } from '@/lib/backupExecutor';
import { getAppDatabase } from '@/lib/appdb';

const CRON_API_KEY = process.env.CRON_API_KEY || 'change-this-in-production';
const CRON_LOCK_TTL_MS = 15 * 60 * 1000; // 15 minutes - released when run finishes, or auto-expires if process dies

// POST - Endpoint for cron job to call (protected with API key)
export async function POST(request) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ===== CRON API ENDPOINT CALLED =====`);
  
  // Verify API key
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error(`[${timestamp}] ✗ Unauthorized: No Bearer token`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    if (apiKey !== CRON_API_KEY) {
      console.error(`[${timestamp}] ✗ Invalid API key provided`);
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    console.log(`[${timestamp}] ✓ API key verified`);

    // Global cron lock: only one backup cron run at a time (atomic acquire to prevent race when many cron invocations hit at once)
    const { db } = await getAppDatabase();
    const locksCollection = db.collection('cron_locks');
    const now = new Date();
    const lockId = 'backup_cron';
    const lockExpires = new Date(now.getTime() + CRON_LOCK_TTL_MS);

    const acquired = await locksCollection.findOneAndUpdate(
      {
        _id: lockId,
        $or: [
          { lockedUntil: { $exists: false } },
          { lockedUntil: { $lte: now } },
        ],
      },
      { $set: { lockedUntil: lockExpires, lockedAt: now } },
      { upsert: true, returnDocument: 'after' }
    );

    if (!acquired) {
      console.log(`[${timestamp}] ℹ Cron lock held by another run, skipping this invocation`);
      return NextResponse.json({
        success: true,
        message: 'Cron already running - skipped to prevent duplicate backups',
        executed: 0,
      });
    }

    try {
      console.log(`[${timestamp}] ===== CHECKING FOR DUE BACKUP SCHEDULES =====`);
      console.log(`[${timestamp}] Querying database for schedules that are due to run...`);

      // Get schedules that are due to run
      const dueSchedules = await getDueSchedules();
      console.log(`[${timestamp}] ===== SCHEDULE QUERY COMPLETE =====`);
    console.log(`[${timestamp}] Found ${dueSchedules.length} schedule(s) due to run`);

    if (dueSchedules.length === 0) {
      console.log(`[${timestamp}] ℹ No schedules due to run at this time`);
      console.log(`[${timestamp}] ===== CRON API COMPLETED: No backups needed =====`);
      return NextResponse.json({
        success: true,
        message: 'No schedules due to run',
        executed: 0,
      });
    }

    // Log detailed schedule information
    console.log(`[${timestamp}] ===== SCHEDULES TO EXECUTE =====`);
    dueSchedules.forEach((schedule, index) => {
      const scheduleId = schedule._id.toString();
      const collections = schedule.collections && schedule.collections.length > 0 
        ? schedule.collections.join(', ') 
        : 'ALL COLLECTIONS';
      const times = schedule.schedule?.times?.join(', ') || 'N/A';
      const days = schedule.schedule?.days?.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') || 'N/A';
      
      console.log(`[${timestamp}] ┌─ Schedule ${index + 1}/${dueSchedules.length}:`);
      console.log(`[${timestamp}] │  ID: ${scheduleId}`);
      console.log(`[${timestamp}] │  Database: ${schedule.databaseName}`);
      console.log(`[${timestamp}] │  Collections: ${collections}`);
      console.log(`[${timestamp}] │  Connection ID: ${schedule.connectionId}`);
      console.log(`[${timestamp}] │  Schedule: ${days} at ${times} UTC`);
      console.log(`[${timestamp}] │  Destination: ${schedule.destination || 'N/A'}`);
      console.log(`[${timestamp}] └─`);
    });
    console.log(`[${timestamp}] ===============================================`);

    console.log(`[${timestamp}] ===== STARTING BACKUP EXECUTION =====`);
    console.log(`[${timestamp}] Executing ${dueSchedules.length} backup(s) in parallel...`);

    // Execute backups for due schedules
    const results = await Promise.allSettled(
      dueSchedules.map((schedule, index) => {
        const scheduleId = schedule._id.toString();
        console.log(`[${timestamp}] [${index + 1}/${dueSchedules.length}] Starting backup for schedule ${scheduleId} (DB: ${schedule.databaseName})...`);
        return executeBackup(scheduleId);
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    // Log detailed results
    console.log(`[${timestamp}] ===== BACKUP EXECUTION RESULTS =====`);
    results.forEach((result, index) => {
      const schedule = dueSchedules[index];
      const scheduleId = schedule._id.toString();
      
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          console.log(`[${timestamp}] ✓ [${index + 1}/${dueSchedules.length}] Schedule ${scheduleId} (DB: ${schedule.databaseName}) - SUCCESS`);
          console.log(`[${timestamp}]   Log ID: ${result.value.logId || 'N/A'}`);
        } else {
          console.error(`[${timestamp}] ✗ [${index + 1}/${dueSchedules.length}] Schedule ${scheduleId} (DB: ${schedule.databaseName}) - FAILED`);
          console.error(`[${timestamp}]   Error: ${result.value.error || 'Unknown error'}`);
        }
      } else {
        console.error(`[${timestamp}] ✗ [${index + 1}/${dueSchedules.length}] Schedule ${scheduleId} (DB: ${schedule.databaseName}) - REJECTED`);
        console.error(`[${timestamp}]   Reason: ${result.reason?.message || 'Unknown error'}`);
        if (result.reason?.stack) {
          console.error(`[${timestamp}]   Stack: ${result.reason.stack}`);
        }
      }
    });
    console.log(`[${timestamp}] =====================================`);

    const message = `Executed ${successful} backups, ${failed} failed`;
    console.log(`[${timestamp}] ===== CRON API COMPLETED =====`);
    console.log(`[${timestamp}] Summary: ${message}`);
    console.log(`[${timestamp}]   - Successful: ${successful}`);
    console.log(`[${timestamp}]   - Failed: ${failed}`);
    console.log(`[${timestamp}]   - Total: ${dueSchedules.length}`);
    console.log(`[${timestamp}] =====================================`);

    return NextResponse.json({
      success: true,
      message,
      executed: successful,
      failed,
      total: dueSchedules.length,
    });
  } catch (error) {
    console.error(`[${timestamp}] ✗ Cron backup error:`, error);
    console.error(`[${timestamp}] Error stack:`, error.stack);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to execute cron backup' },
      { status: 500 }
    );
  } finally {
    try {
      await locksCollection.updateOne(
        { _id: lockId },
        { $set: { lockedUntil: new Date(0) } }
      );
      console.log(`[${timestamp}] Cron lock released`);
    } catch (releaseErr) {
      console.error(`[${timestamp}] Failed to release cron lock:`, releaseErr.message);
    }
  }
}
