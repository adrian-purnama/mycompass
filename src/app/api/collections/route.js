import { NextResponse } from 'next/server';
import { listCollections } from '@/lib/mongodb';

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

    const { connectionString, databaseName } = body || {};

    if (!connectionString || !databaseName) {
      return NextResponse.json(
        { success: false, error: 'Connection string and database name are required' },
        { status: 400 }
      );
    }

    const collections = await listCollections(connectionString, databaseName);

    return NextResponse.json({ success: true, collections });
  } catch (error) {
    console.error('List collections error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list collections' },
      { status: 500 }
    );
  }
}

