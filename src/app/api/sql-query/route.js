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

    const { connectionString, databaseName, sqlQuery } = body || {};

    if (!connectionString || !databaseName || !sqlQuery) {
      return NextResponse.json(
        {
          success: false,
          error: 'Connection string, database name, and SQL query are required'
        },
        { status: 400 }
      );
    }

    // Try to use QueryLeaf
    try {
      // Import QueryLeaf as a named export
      const { QueryLeaf } = await import('@queryleaf/lib');

      // Get MongoDB client (QueryLeaf needs the client, not the database)
      const client = await getMongoClient(connectionString);

      // Initialize QueryLeaf with client and database name
      // QueryLeaf constructor: new QueryLeaf(mongoClient, databaseName)
      const queryLeaf = new QueryLeaf(client, databaseName);

      // Execute SQL query
      // ExecutionResult is: Document[] | Document | null
      const executionResult = await queryLeaf.execute(sqlQuery);

      // Handle the result - it can be an array, a single document, or null
      let results = [];
      if (Array.isArray(executionResult)) {
        results = executionResult;
      } else if (executionResult !== null && executionResult !== undefined) {
        // Single document
        results = [executionResult];
      }

      return NextResponse.json({
        success: true,
        results: results,
        count: results.length
      });
    } catch (queryLeafError) {
      console.error('QueryLeaf error:', queryLeafError);
      
      return NextResponse.json(
        {
          success: false,
          error: `QueryLeaf execution failed: ${queryLeafError.message}. Please ensure QueryLeaf is properly installed and compatible with your MongoDB driver version.`
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('SQL query error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to execute SQL query' },
      { status: 500 }
    );
  }
}

