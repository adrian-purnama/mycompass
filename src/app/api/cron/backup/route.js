import { NextResponse } from 'next/server';
import { getDueSchedules, executeBackup } from '@/lib/backupExecutor';

const CRON_API_KEY = process.env.CRON_API_KEY || 'change-this-in-production';

// POST - Endpoint for cron job to call (protected with API key)
export async function POST(request) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ===== CRON API ENDPOINT CALLED =====`);
  
  try {
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
    console.log(`[${timestamp}] Checking for due backup schedules...`);

    // Get schedules that are due to run
    const dueSchedules = await getDueSchedules();
    console.log(`[${timestamp}] Found ${dueSchedules.length} schedule(s) due to run`);

    if (dueSchedules.length === 0) {
      console.log(`[${timestamp}] ℹ No schedules due to run`);
      return NextResponse.json({
        success: true,
        message: 'No schedules due to run',
        executed: 0,
      });
    }

    // Log schedule details
    dueSchedules.forEach((schedule, index) => {
      console.log(`[${timestamp}] Schedule ${index + 1}: ID=${schedule._id}, DB=${schedule.databaseName}, Connection=${schedule.connectionId}`);
    });

    console.log(`[${timestamp}] Executing ${dueSchedules.length} backup(s)...`);

    // Execute backups for due schedules
    const results = await Promise.allSettled(
      dueSchedules.map(schedule => executeBackup(schedule._id.toString()))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    // Log detailed results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          console.log(`[${timestamp}] ✓ Schedule ${index + 1} executed successfully: ${result.value.logId || 'N/A'}`);
        } else {
          console.error(`[${timestamp}] ✗ Schedule ${index + 1} failed: ${result.value.error || 'Unknown error'}`);
        }
      } else {
        console.error(`[${timestamp}] ✗ Schedule ${index + 1} rejected: ${result.reason?.message || 'Unknown error'}`);
      }
    });

    const message = `Executed ${successful} backups, ${failed} failed`;
    console.log(`[${timestamp}] ===== CRON API COMPLETED: ${message} =====`);

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
  }
}


