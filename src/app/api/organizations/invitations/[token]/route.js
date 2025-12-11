import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { ObjectId } from 'mongodb';

// GET - Get invitation details
export async function GET(request, { params }) {
  try {
    // In Next.js App Router, params is a Promise that needs to be awaited
    const resolvedParams = await params;
    const token = resolvedParams.token;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const invitationsCollection = db.collection('organization_invitations');
    const organizationsCollection = db.collection('organizations');
    const usersCollection = db.collection('users');

    // Find invitation
    const invitation = await invitationsCollection.findOne({ token });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: 'Invalid invitation token' },
        { status: 404 }
      );
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      await invitationsCollection.updateOne(
        { _id: invitation._id },
        { $set: { status: 'expired' } }
      );
      return NextResponse.json(
        { success: false, error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Check if already accepted
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Invitation has already been used' },
        { status: 400 }
      );
    }

    // Get organization details
    const organization = await organizationsCollection.findOne({
      _id: invitation.organizationId
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get inviter details
    const inviter = await usersCollection.findOne({
      _id: new ObjectId(invitation.invitedBy)
    });

    return NextResponse.json({
      success: true,
      invitation: {
        organizationId: organization._id.toString(),
        organizationName: organization.name,
        email: invitation.email,
        invitedBy: inviter ? inviter.email : 'Unknown',
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error('Get invitation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get invitation' },
      { status: 500 }
    );
  }
}

// POST - Accept invitation
export async function POST(request, { params }) {
  try {
    // In Next.js App Router, params is a Promise that needs to be awaited
    const resolvedParams = await params;
    const token = resolvedParams.token;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const sessionToken = authHeader.substring(7);
    const { db } = await getAppDatabase();
    const sessionsCollection = db.collection('sessions');
    const usersCollection = db.collection('users');
    const invitationsCollection = db.collection('organization_invitations');
    const membersCollection = db.collection('organization_members');

    // Get user from session
    const session = await sessionsCollection.findOne({ token: sessionToken });
    if (!session || new Date() > session.expiresAt) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(session.userId) });
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    // Find invitation
    const invitation = await invitationsCollection.findOne({ token });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: 'Invalid invitation token' },
        { status: 404 }
      );
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      await invitationsCollection.updateOne(
        { _id: invitation._id },
        { $set: { status: 'expired' } }
      );
      return NextResponse.json(
        { success: false, error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Check if already accepted
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Invitation has already been used' },
        { status: 400 }
      );
    }

    // Verify email matches
    if (user.email.toLowerCase().trim() !== invitation.email.toLowerCase().trim()) {
      return NextResponse.json(
        { success: false, error: 'This invitation was sent to a different email address' },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const existingMember = await membersCollection.findOne({
      organizationId: invitation.organizationId,
      userId: user._id.toString()
    });

    if (existingMember) {
      // Mark invitation as accepted even if already a member
      await invitationsCollection.updateOne(
        { _id: invitation._id },
        { $set: { status: 'accepted' } }
      );
      return NextResponse.json(
        { success: false, error: 'You are already a member of this organization' },
        { status: 400 }
      );
    }

    // Add user as member (default role: member)
    await membersCollection.insertOne({
      organizationId: invitation.organizationId,
      userId: user._id.toString(),
      role: 'member',
      joinedAt: new Date(),
      createdAt: new Date()
    });

    // Update invitation status
    await invitationsCollection.updateOne(
      { _id: invitation._id },
      { $set: { status: 'accepted' } }
    );

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully'
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}


