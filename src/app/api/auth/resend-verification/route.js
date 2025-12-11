import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { sendVerificationEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const usersCollection = db.collection('users');
    const verificationsCollection = db.collection('email_verifications');

    // Find user
    const user = await usersCollection.findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a verification email has been sent.'
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { success: false, error: 'Email is already verified' },
        { status: 400 }
      );
    }

    // Delete old verification tokens for this user
    await verificationsCollection.deleteMany({ userId: user._id.toString() });

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

    // Store verification record
    await verificationsCollection.insertOne({
      userId: user._id.toString(),
      token: verificationToken,
      email: user.email,
      expiresAt,
      createdAt: new Date()
    });

    // Send verification email
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
        (request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'http://localhost:3000');
      await sendVerificationEmail(user.email, verificationToken, baseUrl);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      return NextResponse.json(
        { success: false, error: 'Failed to send verification email. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email has been sent. Please check your inbox.'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to resend verification email' },
      { status: 500 }
    );
  }
}


