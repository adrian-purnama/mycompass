import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/mongodb';
import { getAppDatabase } from '@/lib/appdb';
import { decrypt } from '@/lib/encryption';
import { requireConnectionAccess } from '@/lib/permissions';
import { ObjectId } from 'mongodb';

// Helper to get user from session token
async function getUserFromToken(token) {
  if (!token) return null;

  const { db } = await getAppDatabase();
  const sessionsCollection = db.collection('sessions');
  const usersCollection = db.collection('users');

  const session = await sessionsCollection.findOne({ token });
  if (!session || new Date() > session.expiresAt) {
    return null;
  }

  const user = await usersCollection.findOne({ _id: new ObjectId(session.userId) });
  return user ? { id: user._id.toString(), email: user.email } : null;
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await getUserFromToken(token);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { connectionString, connectionId, organizationId, databaseName, collectionName, query } = body || {};

    if (!databaseName || !collectionName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database name and collection name are required'
        },
        { status: 400 }
      );
    }

    // If connectionId is provided, verify permissions and get connection string
    let finalConnectionString = connectionString;
    if (connectionId && organizationId) {
      // Verify user has access to this connection
      await requireConnectionAccess(user.id, connectionId, organizationId);

      // Get connection string from database
      const { db } = await getAppDatabase();
      const connectionsCollection = db.collection('connections');
      const connection = await connectionsCollection.findOne({
        _id: new ObjectId(connectionId),
        organizationId: new ObjectId(organizationId)
      });

      if (!connection) {
        return NextResponse.json(
          { success: false, error: 'Connection not found' },
          { status: 404 }
        );
      }

      // Decrypt connection string
      const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
      try {
        finalConnectionString = decrypt(connection.encryptedConnectionString, encryptionKey);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to decrypt connection string' },
          { status: 500 }
        );
      }
    } else if (!connectionString) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either connectionString or (connectionId and organizationId) are required'
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
      finalConnectionString,
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

