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

// POST - Toggle enable/disable a schedule
export async function POST(request, { params }) {
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

    // Get current schedule
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

    // Toggle enabled status
    const newEnabled = !schedule.enabled;

    await schedulesCollection.updateOne(
      { _id: new ObjectId(id), userId: user.id },
      {
        $set: {
          enabled: newEnabled,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      enabled: newEnabled,
    });
  } catch (error) {
    console.error('Toggle schedule error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to toggle schedule' },
      { status: 500 }
    );
  }
}


