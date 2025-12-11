import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';
import { getAppDatabase } from '@/lib/appdb';
import { verifyPassword, decrypt } from '@/lib/encryption';
import { requireBackupPermission, requireConnectionAccess } from '@/lib/permissions';
import archiver from 'archiver';
import { PassThrough } from 'stream';
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

// Convert Node.js Readable stream to Web ReadableStream
function nodeStreamToWebStream(nodeStream) {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => {
        controller.enqueue(chunk);
      });
      nodeStream.on('end', () => {
        controller.close();
      });
      nodeStream.on('error', (err) => {
        controller.error(err);
      });
    },
    cancel() {
      nodeStream.destroy();
    }
  });
}

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

    const { connectionString, connectionId, databaseName, password, organizationId } = body || {};

    if ((!connectionString && !connectionId) || !databaseName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Connection information and database name are required'
        },
        { status: 400 }
      );
    }

    if (!organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization ID is required'
        },
        { status: 400 }
      );
    }

    // Get user from session (for permission check)
    const authHeader = request.headers.get('authorization');
    let user = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = await getUserFromToken(token);
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required'
        },
        { status: 401 }
      );
    }

    // Check backup permission
    await requireBackupPermission(user.id, organizationId);

    // Get organization backup password
    const { db } = await getAppDatabase();
    const organizationsCollection = db.collection('organizations');
    const organization = await organizationsCollection.findOne({
      _id: new ObjectId(organizationId)
    });

    if (!organization) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization not found'
        },
        { status: 404 }
      );
    }

    // Verify backup password
    if (!password || !verifyPassword(password, organization.backupPassword)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid backup password. Access denied.'
        },
        { status: 401 }
      );
    }

    // Get connection string (decrypt if needed for members)
    let finalConnectionString = connectionString;
    if (connectionId && organizationId) {
      // Verify user has access to this connection
      await requireConnectionAccess(user.id, connectionId, organizationId);

      // Get and decrypt connection string
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

      const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
      try {
        finalConnectionString = decrypt(connection.encryptedConnectionString, encryptionKey);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to decrypt connection string' },
          { status: 500 }
        );
      }
    }

    const client = await getMongoClient(finalConnectionString);
    const db = client.db(databaseName);

    // Get all collections (excluding system collections)
    const allCollections = await db.listCollections().toArray();
    const collectionsToBackup = allCollections
      .map((c) => c.name)
      .filter((name) => !name.startsWith('system.'));

    if (collectionsToBackup.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No collections found to backup'
        },
        { status: 400 }
      );
    }

    // Create a PassThrough stream to pipe archiver output
    const passThrough = new PassThrough();

    // Create archiver and pipe to PassThrough
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      passThrough.destroy(err);
    });

    archive.pipe(passThrough);

    // Process collections asynchronously
    (async () => {
      try {
        for (const collectionName of collectionsToBackup) {
          try {
            const collection = db.collection(collectionName);
            const documents = await collection.find({}).toArray();
            
            // Convert documents to JSON string
            const jsonString = JSON.stringify(documents, null, 2);
            
            // Add to archive with collection name as filename
            archive.append(jsonString, { name: `${collectionName}.json` });
          } catch (error) {
            console.error(`Error backing up collection ${collectionName}:`, error);
            // Continue with other collections even if one fails
            archive.append(
              JSON.stringify({ error: `Failed to backup: ${error.message}` }, null, 2),
              { name: `${collectionName}.json` }
            );
          }
        }

        // Finalize the archive
        await archive.finalize();
      } catch (error) {
        console.error('Error during backup:', error);
        passThrough.destroy(error);
      }
    })();

    // Convert Node.js stream to Web ReadableStream
    const webStream = nodeStreamToWebStream(passThrough);

    // Generate filename with date/time
    const now = new Date();
    const dateTimeStr = now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: 2024-01-01T12-30-45
    const filename = `backup for ${databaseName} at ${dateTimeStr}.zip`;

    // Return the ZIP file as a stream
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Backup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create backup'
      },
      { status: 500 }
    );
  }
}

