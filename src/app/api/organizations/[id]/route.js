import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { isOrganizationMember, requireAdminPermission } from '@/lib/permissions';
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

// GET - Get organization details
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

    const { id } = params;
    const organizationId = id;

    // Check if user is a member
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

    // Don't return backup password hash
    return NextResponse.json({
      success: true,
      organization: {
        id: organization._id.toString(),
        name: organization.name,
        createdBy: organization.createdBy,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt
      }
    });
  } catch (error) {
    console.error('Get organization error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get organization' },
      { status: 500 }
    );
  }
}

// PUT - Update organization (admin only)
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
    const { name } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Organization name is required' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const organizationsCollection = db.collection('organizations');

    const result = await organizationsCollection.updateOne(
      { _id: new ObjectId(organizationId) },
      {
        $set: {
          name: name.trim(),
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
      message: 'Organization updated successfully'
    });
  } catch (error) {
    console.error('Update organization error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update organization' },
      { status: 500 }
    );
  }
}

// DELETE - Delete organization (admin only)
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

    const { id } = params;
    const organizationId = id;

    // Check admin permission
    await requireAdminPermission(user.id, organizationId);

    const { db } = await getAppDatabase();
    const organizationsCollection = db.collection('organizations');
    const membersCollection = db.collection('organization_members');
    const invitationsCollection = db.collection('organization_invitations');

    // Delete organization
    const result = await organizationsCollection.deleteOne({
      _id: new ObjectId(organizationId)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Delete all memberships
    await membersCollection.deleteMany({
      organizationId: new ObjectId(organizationId)
    });

    // Delete all pending invitations
    await invitationsCollection.deleteMany({
      organizationId: new ObjectId(organizationId),
      status: 'pending'
    });

    return NextResponse.json({
      success: true,
      message: 'Organization deleted successfully'
    });
  } catch (error) {
    console.error('Delete organization error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete organization' },
      { status: 500 }
    );
  }
}


