import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/mongodb';

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

    const { connectionString, databaseName, collectionName, query } = body || {};

    if (!connectionString || !databaseName || !collectionName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Connection string, database name, and collection name are required'
        },
        { status: 400 }
      );
    }

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    // Validate query structure
    let parsedQuery;
    try {
      parsedQuery = typeof query === 'string' ? JSON.parse(query) : query;
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON query format' },
        { status: 400 }
      );
    }

    const results = await executeQuery(
      connectionString,
      databaseName,
      collectionName,
      parsedQuery
    );

    return NextResponse.json({ success: true, results, count: results.length });
  } catch (error) {
    console.error('Query execution error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to execute query' },
      { status: 500 }
    );
  }
}

