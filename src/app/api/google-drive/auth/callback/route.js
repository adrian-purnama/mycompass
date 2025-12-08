import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { exchangeCodeForTokens, storeTokens } from '@/lib/googleDrive';
import { ObjectId } from 'mongodb';

// Handle OAuth callback from Google
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // userId
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?google_drive_error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?google_drive_error=missing_code_or_state`
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Store tokens
    await storeTokens(state, tokens.accessToken, tokens.refreshToken, tokens.expiresIn);

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?google_drive_connected=true`
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?google_drive_error=${encodeURIComponent(error.message)}`
    );
  }
}


