import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { verifyPassword } from '@/lib/encryption';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

// Generate a secure session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const usersCollection = db.collection('users');
    const sessionsCollection = db.collection('sessions');

    // Find user by email
    const user = await usersCollection.findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Please verify your email address before logging in. Check your email for the verification link.',
          requiresVerification: true
        },
        { status: 403 }
      );
    }

    // Create session
    const token = generateSessionToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await sessionsCollection.insertOne({
      userId: user._id.toString(),
      token,
      expiresAt,
      createdAt: new Date(),
      userAgent: request.headers.get('user-agent') || '',
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    });

    // Return user info (without password hash) and token
    return NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        emailVerified: user.emailVerified || false
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to login' },
      { status: 500 }
    );
  }
}

