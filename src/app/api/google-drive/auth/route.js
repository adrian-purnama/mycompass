import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { getGoogleAuthUrl, exchangeCodeForTokens, storeTokens } from '@/lib/googleDrive';
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

// GET - Get OAuth authorization URL
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

    const authUrl = getGoogleAuthUrl(user.id);

    return NextResponse.json({
      success: true,
      authUrl,
    });
  } catch (error) {
    console.error('Get auth URL error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get auth URL' },
      { status: 500 }
    );
  }
}

// POST - Handle OAuth callback and store tokens
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
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Store tokens
    await storeTokens(user.id, tokens.accessToken, tokens.refreshToken, tokens.expiresIn);

    return NextResponse.json({
      success: true,
      message: 'Google Drive connected successfully',
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to connect Google Drive' },
      { status: 500 }
    );
  }
}


