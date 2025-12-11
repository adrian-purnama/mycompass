import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { requireAdminPermission, isOrganizationMember } from '@/lib/permissions';
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

// GET - List all members with access to a connection (admin only)
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

    // In Next.js App Router, params is a Promise that needs to be awaited
    const resolvedParams = await params;
    const organizationId = resolvedParams.id;
    const connectionId = resolvedParams.connectionId;

    if (!organizationId || !connectionId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID and Connection ID are required' },
        { status: 400 }
      );
    }

    // Check admin permission
    await requireAdminPermission(user.id, organizationId);

    const { db } = await getAppDatabase();
    const permissionsCollection = db.collection('connection_permissions');
    const usersCollection = db.collection('users');
    const connectionsCollection = db.collection('connections');

    // Verify connection exists and belongs to organization
    const connection = await connectionsCollection.findOne({
      _id: new ObjectId(connectionId),
      organizationId: new ObjectId(organizationId)
    });

    if (!connection) {
      return NextResponse.json(
        { success: false, error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Get all permissions for this connection
    const permissions = await permissionsCollection
      .find({
        connectionId: new ObjectId(connectionId),
        organizationId: new ObjectId(organizationId)
      })
      .toArray();

    // Get user details
    const userIds = permissions.map(p => p.userId);
    const users = await usersCollection
      .find({ _id: { $in: userIds.map(id => new ObjectId(id)) } })
      .toArray();

    const userMap = {};
    users.forEach(u => {
      userMap[u._id.toString()] = u;
    });

    const formattedPermissions = permissions.map(permission => {
      const user = userMap[permission.userId];
      return {
        userId: permission.userId,
        email: user ? user.email : 'Unknown',
        username: user ? user.username : null,
        grantedAt: permission.grantedAt,
        grantedBy: permission.grantedBy
      };
    });

    return NextResponse.json({
      success: true,
      permissions: formattedPermissions
    });
  } catch (error) {
    console.error('Get connection permissions error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get connection permissions' },
      { status: 500 }
    );
  }
}

// POST - Grant access to a member (admin only)
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

    // In Next.js App Router, params is a Promise that needs to be awaited
    const resolvedParams = await params;
    const organizationId = resolvedParams.id;
    const connectionId = resolvedParams.connectionId;

    if (!organizationId || !connectionId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID and Connection ID are required' },
        { status: 400 }
      );
    }

    // Check admin permission
    await requireAdminPermission(user.id, organizationId);

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const permissionsCollection = db.collection('connection_permissions');
    const connectionsCollection = db.collection('connections');
    const membersCollection = db.collection('organization_members');

    // Verify connection exists and belongs to organization
    const connection = await connectionsCollection.findOne({
      _id: new ObjectId(connectionId),
      organizationId: new ObjectId(organizationId)
    });

    if (!connection) {
      return NextResponse.json(
        { success: false, error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Verify user is a member of the organization
    const isMember = await isOrganizationMember(userId, organizationId);
    if (!isMember) {
      return NextResponse.json(
        { success: false, error: 'User is not a member of this organization' },
        { status: 400 }
      );
    }

    // Check if permission already exists
    const existingPermission = await permissionsCollection.findOne({
      userId: String(userId),
      connectionId: new ObjectId(connectionId),
      organizationId: new ObjectId(organizationId)
    });

    if (existingPermission) {
      return NextResponse.json(
        { success: false, error: 'User already has access to this connection' },
        { status: 400 }
      );
    }

    // Create permission
    await permissionsCollection.insertOne({
      userId: String(userId),
      connectionId: new ObjectId(connectionId),
      organizationId: new ObjectId(organizationId),
      grantedAt: new Date(),
      grantedBy: user.id,
      createdAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Access granted successfully'
    });
  } catch (error) {
    console.error('Grant connection permission error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to grant access' },
      { status: 500 }
    );
  }
}

// DELETE - Revoke access from a member (admin only)
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

    // In Next.js App Router, params is a Promise that needs to be awaited
    const resolvedParams = await params;
    const organizationId = resolvedParams.id;
    const connectionId = resolvedParams.connectionId;

    if (!organizationId || !connectionId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID and Connection ID are required' },
        { status: 400 }
      );
    }

    // Check admin permission
    await requireAdminPermission(user.id, organizationId);

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const permissionsCollection = db.collection('connection_permissions');

    // Delete permission
    const result = await permissionsCollection.deleteOne({
      userId: String(userId),
      connectionId: new ObjectId(connectionId),
      organizationId: new ObjectId(organizationId)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Permission not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Access revoked successfully'
    });
  } catch (error) {
    console.error('Revoke connection permission error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to revoke access' },
      { status: 500 }
    );
  }
}

