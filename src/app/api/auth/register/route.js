import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { hashPassword } from '@/lib/encryption';

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

    // Check if user already exists
    const existingUser = await usersCollection.findOne({
      $or: [{ email }, ...(username ? [{ username }] : [])]
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User with this email or username already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = hashPassword(password);

    // Create user
    const user = {
      email: email.toLowerCase().trim(),
      username: username?.toLowerCase().trim() || null,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await usersCollection.insertOne(user);

    return NextResponse.json({
      success: true,
      userId: result.insertedId.toString()
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to register user' },
      { status: 500 }
    );
  }
}


