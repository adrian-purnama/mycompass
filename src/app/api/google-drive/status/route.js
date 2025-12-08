import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { isConnected } from '@/lib/googleDrive';
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

// GET - Check if user has Google Drive connected
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

    const connected = await isConnected(user.id);

    return NextResponse.json({
      success: true,
      connected,
    });
  } catch (error) {
    console.error('Get Google Drive status error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get status' },
      { status: 500 }
    );
  }
}


