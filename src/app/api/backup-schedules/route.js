import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { ObjectId } from 'mongodb';

// Password required for backup operations
const BACKUP_PASSWORD = process.env.BACKUP_PASSWORD || 'adriangacor';

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

// GET - List all backup schedules for the user
export async function GET(request) {
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

    const { db } = await getAppDatabase();
    const schedulesCollection = db.collection('backup_schedules');
    const logsCollection = db.collection('backup_logs');
    const connectionsCollection = db.collection('connections');

    const schedules = await schedulesCollection
      .find({ userId: user.id })
      .sort({ createdAt: -1 })
      .toArray();

    // Get all connections for this user to map connection names
    const connections = await connectionsCollection
      .find({ userId: user.id })
      .toArray();
    
    const connectionMap = {};
    connections.forEach(conn => {
      connectionMap[conn._id.toString()] = conn.displayName;
    });

    // Get last run and next run for each schedule
    const schedulesWithStatus = await Promise.all(
      schedules.map(async (schedule) => {
        // Get last log entry
        const lastLog = await logsCollection
          .findOne(
            { scheduleId: schedule._id },
            { sort: { startedAt: -1 } }
          );

        // Calculate next run time
        const nextRun = calculateNextRun(schedule.schedule);

        return {
          id: schedule._id.toString(),
          connectionId: schedule.connectionId,
          connectionName: connectionMap[schedule.connectionId] || 'Unknown Connection',
          databaseName: schedule.databaseName,
          collections: schedule.collections,
          destination: schedule.destination,
          schedule: schedule.schedule,
          retentionDays: schedule.retentionDays,
          enabled: schedule.enabled,
          createdAt: schedule.createdAt,
          updatedAt: schedule.updatedAt,
          lastRun: lastLog ? {
            status: lastLog.status,
            startedAt: lastLog.startedAt,
            completedAt: lastLog.completedAt,
            error: lastLog.error,
          } : null,
          nextRun,
        };
      })
    );

    return NextResponse.json({
      success: true,
      schedules: schedulesWithStatus,
    });
  } catch (error) {
    console.error('Get schedules error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get schedules' },
      { status: 500 }
    );
  }
}

// POST - Create a new backup schedule
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
    const {
      connectionId,
      databaseName,
      collections,
      destination,
      schedule,
      retentionDays,
      password,
    } = body;

    // Validation
    if (!connectionId || !databaseName) {
      return NextResponse.json(
        { success: false, error: 'Connection ID and database name are required' },
        { status: 400 }
      );
    }

    if (!password || password !== BACKUP_PASSWORD) {
      return NextResponse.json(
        { success: false, error: 'Invalid backup password. Access denied.' },
        { status: 401 }
      );
    }

    if (!schedule || !schedule.days || schedule.days.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one day must be selected' },
        { status: 400 }
      );
    }

    if (!schedule.times || schedule.times.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one time must be specified' },
        { status: 400 }
      );
    }

    if (!retentionDays || retentionDays < 1) {
      return NextResponse.json(
        { success: false, error: 'Retention days must be at least 1' },
        { status: 400 }
      );
    }

    if (!destination || destination.type !== 'google_drive') {
      return NextResponse.json(
        { success: false, error: 'Google Drive destination is required' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const schedulesCollection = db.collection('backup_schedules');

    const newSchedule = {
      userId: user.id,
      connectionId,
      databaseName,
      collections: collections || [],
      destination,
      schedule: {
        days: schedule.days,
        times: schedule.times,
        timezone: schedule.timezone || 'UTC',
      },
      retentionDays,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await schedulesCollection.insertOne(newSchedule);

    return NextResponse.json({
      success: true,
      schedule: {
        id: result.insertedId.toString(),
        ...newSchedule,
      },
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create schedule' },
      { status: 500 }
    );
  }
}

/**
 * Calculate next run time for a schedule
 * @param {Object} schedule - Schedule object with days and times
 * @returns {Date | null} Next run time
 */
function calculateNextRun(schedule) {
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const days = schedule.days || [];
  const times = schedule.times || [];

  // Sort times
  const sortedTimes = [...times].sort();

  // Check if there's a time later today
  for (const time of sortedTimes) {
    if (days.includes(currentDay) && time > currentTime) {
      const [hours, minutes] = time.split(':').map(Number);
      const nextRun = new Date(now);
      nextRun.setHours(hours, minutes, 0, 0);
      return nextRun;
    }
  }

  // Find next day with scheduled times
  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const checkDay = (currentDay + dayOffset) % 7;
    if (days.includes(checkDay) && sortedTimes.length > 0) {
      const [hours, minutes] = sortedTimes[0].split(':').map(Number);
      const nextRun = new Date(now);
      nextRun.setDate(nextRun.getDate() + dayOffset);
      nextRun.setHours(hours, minutes, 0, 0);
      return nextRun;
    }
  }

  return null;
}


