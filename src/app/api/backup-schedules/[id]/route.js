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

// GET - Get specific schedule details
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
    const schedulesCollection = db.collection('backup_schedules');

    const schedule = await schedulesCollection.findOne({
      _id: new ObjectId(id),
      userId: user.id,
    });

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      schedule: {
        id: schedule._id.toString(),
        connectionId: schedule.connectionId,
        databaseName: schedule.databaseName,
        collections: schedule.collections,
        destination: schedule.destination,
        schedule: schedule.schedule,
        retentionDays: schedule.retentionDays,
        enabled: schedule.enabled,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get schedule error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get schedule' },
      { status: 500 }
    );
  }
}

// PUT - Update a schedule
export async function PUT(request, { params }) {
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
    const body = await request.json();
    const { password } = body;

    // Validate backup password
    if (!password || password !== BACKUP_PASSWORD) {
      return NextResponse.json(
        { success: false, error: 'Invalid backup password. Access denied.' },
        { status: 401 }
      );
    }

    const { db } = await getAppDatabase();
    const schedulesCollection = db.collection('backup_schedules');

    // Verify schedule belongs to user
    const existing = await schedulesCollection.findOne({
      _id: new ObjectId(id),
      userId: user.id,
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      );
    }

    const update = {
      updatedAt: new Date(),
    };

    if (body.connectionId !== undefined) update.connectionId = body.connectionId;
    if (body.databaseName !== undefined) update.databaseName = body.databaseName;
    if (body.collections !== undefined) update.collections = body.collections;
    if (body.destination !== undefined) update.destination = body.destination;
    if (body.schedule !== undefined) {
      if (!body.schedule.days || body.schedule.days.length === 0) {
        return NextResponse.json(
          { success: false, error: 'At least one day must be selected' },
          { status: 400 }
        );
      }
      if (!body.schedule.times || body.schedule.times.length === 0) {
        return NextResponse.json(
          { success: false, error: 'At least one time must be specified' },
          { status: 400 }
        );
      }
      update.schedule = {
        days: body.schedule.days,
        times: body.schedule.times,
        timezone: body.schedule.timezone || 'UTC',
      };
    }
    if (body.retentionDays !== undefined) {
      if (body.retentionDays < 1) {
        return NextResponse.json(
          { success: false, error: 'Retention days must be at least 1' },
          { status: 400 }
        );
      }
      update.retentionDays = body.retentionDays;
    }
    if (body.enabled !== undefined) update.enabled = body.enabled;

    await schedulesCollection.updateOne(
      { _id: new ObjectId(id), userId: user.id },
      { $set: update }
    );

    // Get updated schedule
    const updated = await schedulesCollection.findOne({ _id: new ObjectId(id) });

    return NextResponse.json({
      success: true,
      schedule: {
        id: updated._id.toString(),
        connectionId: updated.connectionId,
        databaseName: updated.databaseName,
        collections: updated.collections,
        destination: updated.destination,
        schedule: updated.schedule,
        retentionDays: updated.retentionDays,
        enabled: updated.enabled,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update schedule' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a schedule
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
    const schedulesCollection = db.collection('backup_schedules');

    const result = await schedulesCollection.deleteOne({
      _id: new ObjectId(id),
      userId: user.id,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete schedule error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}


