import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { requireAdminPermission } from '@/lib/permissions';
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

// GET - Get Telegram settings for organization
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

    const resolvedParams = await params;
    const organizationId = resolvedParams.id;

    // Check if user is a member
    const { isOrganizationMember } = await import('@/lib/permissions');
    const isMember = await isOrganizationMember(user.id, organizationId);
    if (!isMember) {
      return NextResponse.json(
        { success: false, error: 'You are not a member of this organization' },
        { status: 403 }
      );
    }

    const { db } = await getAppDatabase();
    const organizationsCollection = db.collection('organizations');

    const organization = await organizationsCollection.findOne({
      _id: new ObjectId(organizationId)
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      telegramBotToken: organization.telegramBotToken || null,
      telegramChatId: organization.telegramChatId || null,
    });
  } catch (error) {
    console.error('Get Telegram settings error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get Telegram settings' },
      { status: 500 }
    );
  }
}

// PUT - Update Telegram settings for organization (admin only)
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

    const resolvedParams = await params;
    const organizationId = resolvedParams.id;

    // Check admin permission
    await requireAdminPermission(user.id, organizationId);

    const body = await request.json();
    const { telegramBotToken, telegramChatId } = body;

    const { db } = await getAppDatabase();
    const organizationsCollection = db.collection('organizations');

    const update = {
      updatedAt: new Date(),
    };

    if (telegramBotToken !== undefined) {
      update.telegramBotToken = telegramBotToken || null;
    }
    if (telegramChatId !== undefined) {
      update.telegramChatId = telegramChatId || null;
    }

    const result = await organizationsCollection.updateOne(
      { _id: new ObjectId(organizationId) },
      { $set: update }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Telegram settings updated successfully',
    });
  } catch (error) {
    console.error('Update Telegram settings error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update Telegram settings' },
      { status: 500 }
    );
  }
}

