import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { getUserOrganizations } from '@/lib/permissions';
import { hashPassword } from '@/lib/encryption';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

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

// GET - List user's organizations
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

    const organizations = await getUserOrganizations(user.id);

    return NextResponse.json({
      success: true,
      organizations
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get organizations' },
      { status: 500 }
    );
  }
}

// POST - Create new organization
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
    const { name, backupPassword } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Organization name is required' },
        { status: 400 }
      );
    }

    if (!backupPassword || backupPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Backup password is required and must be at least 6 characters' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const organizationsCollection = db.collection('organizations');
    const membersCollection = db.collection('organization_members');

    // Hash backup password
    const hashedBackupPassword = hashPassword(backupPassword);

    // Create organization
    const organization = {
      name: name.trim(),
      backupPassword: hashedBackupPassword,
      createdBy: user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const orgResult = await organizationsCollection.insertOne(organization);
    const organizationId = orgResult.insertedId;

    // Add creator as admin member
    await membersCollection.insertOne({
      organizationId,
      userId: user.id,
      role: 'admin',
      joinedAt: new Date(),
      createdAt: new Date()
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: organizationId.toString(),
        name: organization.name,
        createdBy: organization.createdBy,
        createdAt: organization.createdAt
      }
    });
  } catch (error) {
    console.error('Create organization error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create organization' },
      { status: 500 }
    );
  }
}


