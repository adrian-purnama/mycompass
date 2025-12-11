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

// GET - List pending invitations for organization (admin only)
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

    // Check admin permission
    await requireAdminPermission(user.id, organizationId);

    const { db } = await getAppDatabase();
    const invitationsCollection = db.collection('organization_invitations');
    const usersCollection = db.collection('users');

    // Get all pending invitations
    const invitations = await invitationsCollection
      .find({
        organizationId: new ObjectId(organizationId),
        status: 'pending'
      })
      .sort({ createdAt: -1 })
      .toArray();

    // Get inviter details
    const inviterIds = [...new Set(invitations.map(inv => inv.invitedBy))];
    const inviters = await usersCollection
      .find({ _id: { $in: inviterIds.map(id => new ObjectId(id)) } })
      .toArray();

    const inviterMap = {};
    inviters.forEach(inviter => {
      inviterMap[inviter._id.toString()] = inviter.email;
    });

    const formattedInvitations = invitations.map(invitation => ({
      id: invitation._id.toString(),
      email: invitation.email,
      token: invitation.token,
      invitedBy: inviterMap[invitation.invitedBy] || 'Unknown',
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt
    }));

    return NextResponse.json({
      success: true,
      invitations: formattedInvitations
    });
  } catch (error) {
    console.error('Get invitations error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get invitations' },
      { status: 500 }
    );
  }
}


