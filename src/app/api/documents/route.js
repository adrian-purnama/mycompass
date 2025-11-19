import { NextResponse } from 'next/server';
import { getDocuments } from '@/lib/mongodb';

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

    const { connectionString, databaseName, collectionName, query = {}, options = {} } =
      body || {};

    if (!connectionString || !databaseName || !collectionName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Connection string, database name, and collection name are required'
        },
        { status: 400 }
      );
    }

    const result = await getDocuments(
      connectionString,
      databaseName,
      collectionName,
      query,
      options
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Get documents error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get documents' },
      { status: 500 }
    );
  }
}

