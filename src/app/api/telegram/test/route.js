import { NextResponse } from 'next/server';
import { sendTelegramNotification } from '@/lib/telegram';

// Helper to get user from session token
async function getUserFromToken(token) {
  if (!token) return null;

  const { getAppDatabase } = await import('@/lib/appdb');
  const { ObjectId } = await import('mongodb');
  
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

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { botToken, chatId } = body || {};

    if (!botToken || !chatId) {
      return NextResponse.json(
        { success: false, error: 'Bot token and chat ID are required' },
        { status: 400 }
      );
    }

    // Send test message
    const testMessage = `<b>✅ Test Notification</b>\n\n` +
      `This is a test message from your MongoDB Compass backup system.\n\n` +
      `If you received this message, your Telegram configuration is working correctly! 🎉\n\n` +
      `<i>Time: ${new Date().toLocaleString()}</i>`;

    const result = await sendTelegramNotification(botToken, chatId, testMessage);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test message sent successfully! Check your Telegram.',
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send test message' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Telegram test error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to test Telegram notification' },
      { status: 500 }
    );
  }
}

