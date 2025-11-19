import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';

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

    const { connectionString, databaseName, collectionName } = body || {};

    if (!connectionString || !databaseName || !collectionName) {
      return NextResponse.json(
        { success: false, error: 'Connection string, database name, and collection name are required' },
        { status: 400 }
      );
    }

    const client = await getMongoClient(connectionString);
    const db = client.db(databaseName);
    
    try {
      const count = await db.collection(collectionName).countDocuments();
      return NextResponse.json({ success: true, count });
    } catch (error) {
      console.error(`Failed to count documents in ${collectionName}:`, error);
      return NextResponse.json({ success: true, count: 0 });
    }
  } catch (error) {
    console.error('Count collection error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to count collection' },
      { status: 500 }
    );
  }
}

