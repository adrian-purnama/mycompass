import { NextResponse } from 'next/server';
import { listDatabases } from '@/lib/mongodb';

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

    const databases = await listDatabases(connectionString);

    return NextResponse.json({ success: true, databases });
  } catch (error) {
    console.error('List databases error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list databases' },
      { status: 500 }
    );
  }
}

