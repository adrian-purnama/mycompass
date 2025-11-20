import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';

// Password required for clone operations (uses same password as backup)
const BACKUP_PASSWORD = process.env.BACKUP_PASSWORD || 'adriangacor';

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
      targetConnectionString,
      sourceDatabase,
      targetDatabase,
      collectionNames, // Array of collection names to clone
      password
    } = body || {};

    if (!sourceConnectionString || !targetConnectionString || !sourceDatabase || !targetDatabase) {
      return NextResponse.json(
        {
          success: false,
          error: 'Source and target connection strings, and database names are required'
        },
        { status: 400 }
      );
    }

    if (!password || password !== BACKUP_PASSWORD) {
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

    const sourceClient = await getMongoClient(sourceConnectionString);
    const targetClient = await getMongoClient(targetConnectionString);

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

