import { NextResponse } from 'next/server';
import { getAppDatabase } from '@/lib/appdb';
import { encrypt, decrypt } from '@/lib/encryption';
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

// GET - List all connections for the user
export async function GET(request) {
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

    const { db } = await getAppDatabase();
    const connectionsCollection = db.collection('connections');

    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
    
    const connections = await connectionsCollection
      .find({ userId: user.id })
      .sort({ lastUsed: -1, createdAt: -1 })
      .toArray();

    // Decrypt connection strings
    const decryptedConnections = connections.map(conn => {
      try {
        // Check if encrypted connection string exists
        if (!conn.encryptedConnectionString) {
          console.warn(`Connection ${conn._id} has no encrypted connection string`);
          return null;
        }

        // Validate encrypted data format
        if (typeof conn.encryptedConnectionString !== 'string') {
          console.warn(`Connection ${conn._id} has invalid encrypted connection string format`);
          return null;
        }

        const decrypted = decrypt(conn.encryptedConnectionString, encryptionKey);
        
        // Validate decrypted result
        if (!decrypted || decrypted.trim() === '') {
          console.warn(`Connection ${conn._id} decrypted to empty string`);
          return null;
        }

        return {
          id: conn._id.toString(),
          displayName: conn.displayName,
          connectionString: decrypted,
          createdAt: conn.createdAt,
          lastUsed: conn.lastUsed
        };
      } catch (error) {
        // Log connection ID for debugging but don't fail the entire request
        console.warn(`Failed to decrypt connection ${conn._id} (${conn.displayName || 'unnamed'}):`, error.message);
        return null;
      }
    }).filter(Boolean);

    return NextResponse.json({
      success: true,
      connections: decryptedConnections
    });
  } catch (error) {
    console.error('Get connections error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get connections' },
      { status: 500 }
    );
  }
}

// POST - Create a new connection
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

    const body = await request.json();
    const { displayName, connectionString } = body;

    if (!displayName || !connectionString) {
      return NextResponse.json(
        { success: false, error: 'Display name and connection string are required' },
        { status: 400 }
      );
    }

    const { db } = await getAppDatabase();
    const connectionsCollection = db.collection('connections');

    // Encrypt connection string
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
    const encrypted = encrypt(connectionString, encryptionKey);

    const connection = {
      userId: user.id,
      displayName,
      encryptedConnectionString: encrypted,
      createdAt: new Date(),
      lastUsed: null
    };

    const result = await connectionsCollection.insertOne(connection);

    return NextResponse.json({
      success: true,
      connection: {
        id: result.insertedId.toString(),
        displayName,
        connectionString, // Return decrypted for immediate use
        createdAt: connection.createdAt,
        lastUsed: null
      }
    });
  } catch (error) {
    console.error('Create connection error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create connection' },
      { status: 500 }
    );
  }
}

