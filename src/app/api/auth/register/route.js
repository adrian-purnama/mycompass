import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { hashPassword } from '@/lib/encryption';
import { sendVerificationEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, username, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const usersCollection = db.collection('users');
    const verificationsCollection = db.collection('email_verifications');

    // Check if user already exists
    const existingUser = await usersCollection.findOne({
      $or: [{ email: email.toLowerCase().trim() }, ...(username ? [{ username: username.toLowerCase().trim() }] : [])]
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User with this email or username already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = hashPassword(password);

    // Create user with emailVerified: false
    const user = {
      email: email.toLowerCase().trim(),
      username: username?.toLowerCase().trim() || null,
      passwordHash,
      emailVerified: false,
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await usersCollection.insertOne(user);
    const userId = result.insertedId.toString();

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

    // Store verification record
    await verificationsCollection.insertOne({
      userId,
      token: verificationToken,
      email: email.toLowerCase().trim(),
      expiresAt,
      createdAt: new Date()
    });

    // Send verification email
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
        (request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'http://localhost:3000');
      await sendVerificationEmail(email, verificationToken, baseUrl);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails, but log it
    }

    return NextResponse.json({
      success: true,
      userId,
      message: 'Registration successful. Please check your email to verify your account.'
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to register user' },
      { status: 500 }
    );
  }
}


