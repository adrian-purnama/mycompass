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

// PUT - Update a connection
export async function PUT(request, { params }) {
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

    const { id } = await params;
    const body = await request.json();
    const { displayName, connectionString } = body;

    const { db } = await getAppDatabase();
    const connectionsCollection = db.collection('connections');

    // Verify connection belongs to user
    const existing = await connectionsCollection.findOne({ _id: new ObjectId(id), userId: user.id });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Connection not found' },
        { status: 404 }
      );
    }

    const update = {
      updatedAt: new Date()
    };

    if (displayName !== undefined) {
      update.displayName = displayName;
    }

    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
    
    if (connectionString !== undefined) {
      update.encryptedConnectionString = encrypt(connectionString, encryptionKey);
    }

    await connectionsCollection.updateOne(
      { _id: new ObjectId(id), userId: user.id },
      { $set: update }
    );

    // Get updated connection
    const updated = await connectionsCollection.findOne({ _id: new ObjectId(id) });
    
    let decrypted;
    try {
      if (!updated.encryptedConnectionString) {
        throw new Error('Connection has no encrypted connection string');
      }
      decrypted = decrypt(updated.encryptedConnectionString, encryptionKey);
      if (!decrypted || decrypted.trim() === '') {
        throw new Error('Decryption resulted in empty string');
      }
    } catch (error) {
      console.error(`Failed to decrypt connection ${id}:`, error.message);
      return NextResponse.json(
        { success: false, error: 'Failed to decrypt connection string. The connection may have been encrypted with a different key.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      connection: {
        id: updated._id.toString(),
        displayName: updated.displayName,
        connectionString: decrypted,
        createdAt: updated.createdAt,
        lastUsed: updated.lastUsed
      }
    });
  } catch (error) {
    console.error('Update connection error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update connection' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a connection
export async function DELETE(request, { params }) {
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

    const { id } = await params;
    const { db } = await getAppDatabase();
    const connectionsCollection = db.collection('connections');

    const result = await connectionsCollection.deleteOne({ _id: new ObjectId(id), userId: user.id });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Connection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete connection error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete connection' },
      { status: 500 }
    );
  }
}

