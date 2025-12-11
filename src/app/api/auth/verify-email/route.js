import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Verification token is required' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const verificationsCollection = db.collection('email_verifications');
    const usersCollection = db.collection('users');

    // Find verification record
    const verification = await verificationsCollection.findOne({ token });

    if (!verification) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (new Date() > verification.expiresAt) {
      await verificationsCollection.deleteOne({ _id: verification._id });
      return NextResponse.json(
        { success: false, error: 'Verification token has expired' },
        { status: 400 }
      );
    }

    // Update user emailVerified status
    await usersCollection.updateOne(
      { _id: new ObjectId(verification.userId) },
      {
        $set: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    // Delete verification record
    await verificationsCollection.deleteOne({ _id: verification._id });

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully. You can now log in.'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to verify email' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Verification token is required' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const verificationsCollection = db.collection('email_verifications');
    const usersCollection = db.collection('users');

    // Find verification record
    const verification = await verificationsCollection.findOne({ token });

    if (!verification) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (new Date() > verification.expiresAt) {
      await verificationsCollection.deleteOne({ _id: verification._id });
      return NextResponse.json(
        { success: false, error: 'Verification token has expired' },
        { status: 400 }
      );
    }

    // Update user emailVerified status
    await usersCollection.updateOne(
      { _id: new ObjectId(verification.userId) },
      {
        $set: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    // Delete verification record
    await verificationsCollection.deleteOne({ _id: verification._id });

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully. You can now log in.'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to verify email' },
      { status: 500 }
    );
  }
}


