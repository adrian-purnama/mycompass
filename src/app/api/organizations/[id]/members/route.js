import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { isOrganizationMember, requireAdminPermission, getUserRoleInOrganization } from '@/lib/permissions';
import { sendInvitationEmail } from '@/lib/email';
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

// GET - List organization members
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

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Check if user is a member
    const isMember = await isOrganizationMember(user.id, organizationId);
    if (!isMember) {
      return NextResponse.json(
        { success: false, error: 'You are not a member of this organization' },
        { status: 403 }
      );
    }

    const { db } = await getAppDatabase();
    const membersCollection = db.collection('organization_members');
    const usersCollection = db.collection('users');
    const organizationsCollection = db.collection('organizations');

    // Get organization name
    const organization = await organizationsCollection.findOne({
      _id: new ObjectId(organizationId)
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get all members
    const memberships = await membersCollection
      .find({ organizationId: new ObjectId(organizationId) })
      .toArray();

    // Get user details
    const userIds = memberships.map(m => m.userId);
    const users = await usersCollection
      .find({ _id: { $in: userIds.map(id => new ObjectId(id)) } })
      .toArray();

    const userMap = {};
    users.forEach(u => {
      userMap[u._id.toString()] = u;
    });

    const members = memberships.map(membership => {
      const user = userMap[membership.userId];
      return {
        userId: membership.userId,
        email: user ? user.email : 'Unknown',
        username: user ? user.username : null,
        role: membership.role,
        joinedAt: membership.joinedAt
      };
    });

    return NextResponse.json({
      success: true,
      members,
      organizationName: organization.name
    });
  } catch (error) {
    console.error('Get members error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get members' },
      { status: 500 }
    );
  }
}

// POST - Invite user by email (admin only)
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

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Check admin permission
    await requireAdminPermission(user.id, organizationId);

    const body = await request.json();
    const { email } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email address is required' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const invitationsCollection = db.collection('organization_invitations');
    const organizationsCollection = db.collection('organizations');
    const membersCollection = db.collection('organization_members');

    // Get organization
    const organization = await organizationsCollection.findOne({
      _id: new ObjectId(organizationId)
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingMember = await membersCollection.findOne({
      organizationId: new ObjectId(organizationId),
      userId: { $exists: true }
    });

    // Check if there's already a pending invitation
    const existingInvitation = await invitationsCollection.findOne({
      organizationId: new ObjectId(organizationId),
      email: email.toLowerCase().trim(),
      status: 'pending'
    });

    if (existingInvitation) {
      return NextResponse.json(
        { success: false, error: 'An invitation has already been sent to this email' },
        { status: 400 }
      );
    }

    // Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Create invitation record
    await invitationsCollection.insertOne({
      organizationId: new ObjectId(organizationId),
      email: email.toLowerCase().trim(),
      token: invitationToken,
      invitedBy: user.id,
      expiresAt,
      status: 'pending',
      createdAt: new Date()
    });

    // Generate invitation link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'http://localhost:3000');
    const invitationLink = `${baseUrl}/invite?token=${invitationToken}`;

    // Send invitation email
    try {
      await sendInvitationEmail(
        email,
        organization.name,
        user.email,
        invitationToken,
        baseUrl
      );
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't delete invitation if email fails - user can still copy the link
      // Just log the error
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation created successfully',
      invitationLink,
      token: invitationToken
    });
  } catch (error) {
    console.error('Invite member error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to invite member' },
      { status: 500 }
    );
  }
}

// PUT - Update member role (admin only - elevate permissions)
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

    // In Next.js App Router, params is a Promise that needs to be awaited
    const resolvedParams = await params;
    const organizationId = resolvedParams.id;

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Check admin permission
    await requireAdminPermission(user.id, organizationId);

    const body = await request.json();
    const { userId, role } = body;

    if (!userId || !role || !['admin', 'member'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Valid userId and role (admin or member) are required' },
        { status: 400 }
      );
    }

    // Don't allow demoting yourself
    if (userId === user.id && role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'You cannot demote yourself from admin' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const membersCollection = db.collection('organization_members');

    // Check if member exists
    const membership = await membersCollection.findOne({
      organizationId: new ObjectId(organizationId),
      userId
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }

    // Update role
    await membersCollection.updateOne(
      {
        organizationId: new ObjectId(organizationId),
        userId
      },
      {
        $set: {
          role
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Member role updated successfully'
    });
  } catch (error) {
    console.error('Update member role error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update member role' },
      { status: 500 }
    );
  }
}

// DELETE - Remove member (admin only)
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

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Check admin permission
    await requireAdminPermission(user.id, organizationId);

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    // Don't allow removing yourself
    if (userId === user.id) {
      return NextResponse.json(
        { success: false, error: 'You cannot remove yourself from the organization' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const membersCollection = db.collection('organization_members');

    // Remove member
    const result = await membersCollection.deleteOne({
      organizationId: new ObjectId(organizationId),
      userId
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to remove member' },
      { status: 500 }
    );
  }
}

