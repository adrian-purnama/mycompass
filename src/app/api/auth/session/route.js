import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { db } = await getAppDatabase();
    const sessionsCollection = db.collection('sessions');
    const usersCollection = db.collection('users');

    // Find session
    const session = await sessionsCollection.findOne({ token });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Check if session expired
    if (new Date() > session.expiresAt) {
      await sessionsCollection.deleteOne({ _id: session._id });
      return NextResponse.json(
        { success: false, error: 'Session expired' },
        { status: 401 }
      );
    }

    // Get user info
    const user = await usersCollection.findOne({ _id: new ObjectId(session.userId) });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        emailVerified: user.emailVerified || false
      }
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to verify session' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { db } = await getAppDatabase();
    const sessionsCollection = db.collection('sessions');

    await sessionsCollection.deleteOne({ token });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to logout' },
      { status: 500 }
    );
  }
}

