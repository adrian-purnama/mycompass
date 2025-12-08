import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
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

// GET - Get backup logs with pagination and filters
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

    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const { db } = await getAppDatabase();
    const logsCollection = db.collection('backup_logs');

    // Build query
    const query = { userId: user.id };
    if (scheduleId) {
      query.scheduleId = new ObjectId(scheduleId);
    }
    if (status) {
      query.status = status;
    }
    if (startDate || endDate) {
      query.startedAt = {};
      if (startDate) {
        query.startedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.startedAt.$lte = new Date(endDate);
      }
    }

    // Get total count
    const total = await logsCollection.countDocuments(query);

    // Get logs with pagination
    const logs = await logsCollection
      .find(query)
      .sort({ startedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const formattedLogs = logs.map(log => ({
      id: log._id.toString(),
      scheduleId: log.scheduleId.toString(),
      status: log.status,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
      duration: log.duration,
      collectionsBackedUp: log.collectionsBackedUp || [],
      fileSize: log.fileSize,
      filePath: log.filePath,
      error: log.error,
      retentionExpiresAt: log.retentionExpiresAt,
    }));

    return NextResponse.json({
      success: true,
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get logs error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get logs' },
      { status: 500 }
    );
  }
}


