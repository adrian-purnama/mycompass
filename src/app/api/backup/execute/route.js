import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { executeBackup } from '@/lib/backupExecutor';
import { ObjectId } from 'mongodb';

// Helper to get user from session token
async function getUserFromToken(token) {
  if (!token) return null;

  const { db } = await getAppDatabase();
  const sessionsCollection = db.collection('sessions');
  const usersCollection = db.collection('users');

  const session = await sessionsCollection.findOne({ token });
  if (!session || new Date() > session.expiresAt) {
    return null;
  }

  const user = await usersCollection.findOne({ _id: new ObjectId(session.userId) });
  return user ? { id: user._id.toString(), email: user.email } : null;
}

// POST - Manually trigger a backup (for testing)
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await getUserFromToken(token);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { scheduleId } = body;

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    // Verify schedule belongs to user
    const { db } = await getAppDatabase();
    const schedulesCollection = db.collection('backup_schedules');

    const schedule = await schedulesCollection.findOne({
      _id: new ObjectId(scheduleId),
      userId: user.id,
    });

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Execute backup
    const result = await executeBackup(scheduleId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      logId: result.logId,
      message: 'Backup executed successfully',
    });
  } catch (error) {
    console.error('Execute backup error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to execute backup' },
      { status: 500 }
    );
  }
}


