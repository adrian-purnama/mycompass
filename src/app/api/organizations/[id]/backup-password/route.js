import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { requireAdminPermission } from '@/lib/permissions';
import { hashPassword } from '@/lib/encryption';
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

// PUT - Reset backup password (admin only)
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

    const { id } = params;
    const organizationId = id;

    // Check admin permission
    await requireAdminPermission(user.id, organizationId);

    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'New backup password is required and must be at least 6 characters' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const organizationsCollection = db.collection('organizations');

    // Hash new backup password
    const hashedBackupPassword = hashPassword(newPassword);

    // Update organization backup password
    const result = await organizationsCollection.updateOne(
      { _id: new ObjectId(organizationId) },
      {
        $set: {
          backupPassword: hashedBackupPassword,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Backup password updated successfully'
    });
  } catch (error) {
    console.error('Reset backup password error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reset backup password' },
      { status: 500 }
    );
  }
}


