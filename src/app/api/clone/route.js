import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';
import { getAppDatabase } from '@/lib/appdb';
import { verifyPassword } from '@/lib/encryption';
import { requireBackupPermission } from '@/lib/permissions';
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
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const {
      sourceConnectionString,
      sourceConnectionId,
      targetConnectionString,
      targetConnectionId,
      sourceDatabase,
      targetDatabase,
      collectionNames, // Array of collection names to clone
      password,
      organizationId
    } = body || {};

    if ((!sourceConnectionString && !sourceConnectionId) || (!targetConnectionString && !targetConnectionId) || !sourceDatabase || !targetDatabase) {
      return NextResponse.json(
        {
          success: false,
          error: 'Source and target connection information, and database names are required'
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
          error: 'Invalid password. Access denied.'
        },
        { status: 401 }
      );
    }

    if (!collectionNames || !Array.isArray(collectionNames) || collectionNames.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'At least one collection name is required'
        },
        { status: 400 }
      );
    }

    // Get connection strings (decrypt if needed for members)
    let finalSourceConnectionString = sourceConnectionString;
    let finalTargetConnectionString = targetConnectionString;

    if (sourceConnectionId && organizationId) {
      // Verify user has access to source connection
      await requireConnectionAccess(user.id, sourceConnectionId, organizationId);

      // Get and decrypt source connection string
      const { db } = await getAppDatabase();
      const connectionsCollection = db.collection('connections');
      const sourceConnection = await connectionsCollection.findOne({
        _id: new ObjectId(sourceConnectionId),
        organizationId: new ObjectId(organizationId)
      });

      if (!sourceConnection) {
        return NextResponse.json(
          { success: false, error: 'Source connection not found' },
          { status: 404 }
        );
      }

      const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
      try {
        finalSourceConnectionString = decrypt(sourceConnection.encryptedConnectionString, encryptionKey);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to decrypt source connection string' },
          { status: 500 }
        );
      }
    }

    if (targetConnectionId && organizationId) {
      // Verify user has access to target connection
      await requireConnectionAccess(user.id, targetConnectionId, organizationId);

      // Get and decrypt target connection string
      const { db } = await getAppDatabase();
      const connectionsCollection = db.collection('connections');
      const targetConnection = await connectionsCollection.findOne({
        _id: new ObjectId(targetConnectionId),
        organizationId: new ObjectId(organizationId)
      });

      if (!targetConnection) {
        return NextResponse.json(
          { success: false, error: 'Target connection not found' },
          { status: 404 }
        );
      }

      const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
      try {
        finalTargetConnectionString = decrypt(targetConnection.encryptedConnectionString, encryptionKey);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to decrypt target connection string' },
          { status: 500 }
        );
      }
    }

    const sourceClient = await getMongoClient(finalSourceConnectionString);
    const targetClient = await getMongoClient(finalTargetConnectionString);

    try {
      const sourceDb = sourceClient.db(sourceDatabase);
      const targetDb = targetClient.db(targetDatabase);

      let totalDocuments = 0;
      const clonedCollections = [];
      const errors = [];

      // Clone each selected collection
      for (const collectionName of collectionNames) {
        try {
          const sourceCollection = sourceDb.collection(collectionName);
          const targetCollection = targetDb.collection(collectionName);

          // Check if source collection exists
          const collections = await sourceDb.listCollections({ name: collectionName }).toArray();
          if (collections.length === 0) {
            errors.push(`Collection "${collectionName}" does not exist in source database`);
            continue;
          }

          // Get all documents from source
          const documents = await sourceCollection.find({}).toArray();

          if (documents.length === 0) {
            clonedCollections.push({ name: collectionName, count: 0 });
            continue;
          }

          // Drop target collection if it exists (to avoid duplicates)
          await targetCollection.drop().catch(() => {});

          // Insert documents into target
          if (documents.length > 0) {
            await targetCollection.insertMany(documents, { ordered: false });
            totalDocuments += documents.length;
            clonedCollections.push({ name: collectionName, count: documents.length });
          }
        } catch (error) {
          console.error(`Error cloning collection "${collectionName}":`, error);
          errors.push(`Failed to clone "${collectionName}": ${error.message}`);
        }
      }

      if (clonedCollections.length === 0 && errors.length > 0) {
        return NextResponse.json({
          success: false,
          error: `Failed to clone collections: ${errors.join('; ')}`
        }, { status: 500 });
      }

      const message = errors.length > 0
        ? `Cloned ${clonedCollections.length} collection(s) with ${totalDocuments} document(s). Some errors occurred: ${errors.join('; ')}`
        : `Successfully cloned ${clonedCollections.length} collection(s) with ${totalDocuments} document(s)`;

      return NextResponse.json({
        success: true,
        message,
        collectionsCloned: clonedCollections.length,
        documentsCloned: totalDocuments,
        collections: clonedCollections,
        errors: errors.length > 0 ? errors : undefined
      });
    } finally {
      // Note: We don't close clients here as they're cached for reuse
      // The connection pool will manage them
    }
  } catch (error) {
    console.error('Clone error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to clone database/collection'
      },
      { status: 500 }
    );
  }
}

