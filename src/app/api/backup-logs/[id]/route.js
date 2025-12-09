import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { deleteFile } from '@/lib/googleDrive';
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

// GET - Get specific log details
export async function GET(request, { params }) {
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

    const { id } = await params;
    const { db } = await getAppDatabase();
    const logsCollection = db.collection('backup_logs');

    const log = await logsCollection.findOne({
      _id: new ObjectId(id),
      userId: user.id,
    });

    if (!log) {
      return NextResponse.json(
        { success: false, error: 'Log not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      log: {
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
        deletedAt: log.deletedAt,
        deletedReason: log.deletedReason,
      },
    });
  } catch (error) {
    console.error('Get log error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get log' },
      { status: 500 }
    );
  }
}

// DELETE - Manually delete a backup log (and file if exists)
export async function DELETE(request, { params }) {
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

    const { id } = await params;
    const { db } = await getAppDatabase();
    const logsCollection = db.collection('backup_logs');

    // Get log to check if file exists
    const log = await logsCollection.findOne({
      _id: new ObjectId(id),
      userId: user.id,
    });

    if (!log) {
      return NextResponse.json(
        { success: false, error: 'Log not found' },
        { status: 404 }
      );
    }

    // Delete file from Google Drive if exists and not already deleted
    if (log.filePath && log.status === 'success' && !log.deletedAt) {
      try {
        await deleteFile(user.id, log.filePath);
      } catch (error) {
        console.error('Failed to delete file from Google Drive:', error);
        // Continue with marking as deleted even if file deletion fails
      }
    }

    // Mark log as deleted instead of actually deleting it
    await logsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'deleted',
          deletedAt: new Date(),
          deletedReason: `Deleted by user ${user.email}`,
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete log error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete log' },
      { status: 500 }
    );
  }
}


