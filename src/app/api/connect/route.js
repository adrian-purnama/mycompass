import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/mongodb';

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { connectionString } = body || {};

    if (!connectionString) {
      return NextResponse.json(
        { success: false, error: 'Connection string is required' },
        { status: 400 }
      );
    }

    const result = await testConnection(connectionString);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Connection test error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to test connection' },
      { status: 500 }
    );
  }
}

