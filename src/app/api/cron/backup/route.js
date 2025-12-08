import { NextResponse } from 'next/server';
import { getDueSchedules, executeBackup } from '@/lib/backupExecutor';

const CRON_API_KEY = process.env.CRON_API_KEY || 'change-this-in-production';

// POST - Endpoint for cron job to call (protected with API key)
export async function POST(request) {
  try {
    // Verify API key
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    if (apiKey !== CRON_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Get schedules that are due to run
    const dueSchedules = await getDueSchedules();

    if (dueSchedules.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No schedules due to run',
        executed: 0,
      });
    }

    // Execute backups for due schedules
    const results = await Promise.allSettled(
      dueSchedules.map(schedule => executeBackup(schedule._id.toString()))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    return NextResponse.json({
      success: true,
      message: `Executed ${successful} backups, ${failed} failed`,
      executed: successful,
      failed,
      total: dueSchedules.length,
    });
  } catch (error) {
    console.error('Cron backup error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to execute cron backup' },
      { status: 500 }
    );
  }
}


