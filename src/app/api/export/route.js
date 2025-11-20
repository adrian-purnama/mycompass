import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';

// Password required for export operations
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
      connectionString,
      databaseName,
      collections, // Array of collection names, or null for all collections
      format = 'json', // 'json' or 'bson'
      password
    } = body || {};

    if (!connectionString || !databaseName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Connection string and database name are required'
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

    const client = await getMongoClient(connectionString);
    const db = client.db(databaseName);

    // Get collections to export
    let collectionsToExport = collections;
    if (!collectionsToExport || collectionsToExport.length === 0) {
      const allCollections = await db.listCollections().toArray();
      collectionsToExport = allCollections
        .map((c) => c.name)
        .filter((name) => !name.startsWith('system.'));
    }

    // For JSON format, we'll return a JSON response
    // For BSON, we'd need to use a different approach (streaming binary)
    if (format === 'json') {
      const exportData = {};

      for (const collectionName of collectionsToExport) {
        const collection = db.collection(collectionName);
        const documents = await collection.find({}).toArray();
        exportData[collectionName] = documents;
      }

      return NextResponse.json({
        success: true,
        database: databaseName,
        collections: collectionsToExport,
        data: exportData,
        format: 'json'
      });
    } else {
      // BSON format - return as binary stream
      // For now, we'll convert to JSON and let the client handle it
      // In a production app, you'd want to use actual BSON streaming
      const exportData = {};

      for (const collectionName of collectionsToExport) {
        const collection = db.collection(collectionName);
        const documents = await collection.find({}).toArray();
        exportData[collectionName] = documents;
      }

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      return new NextResponse(blob, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${databaseName}_export.json"`
        }
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to export database'
      },
      { status: 500 }
    );
  }
}

