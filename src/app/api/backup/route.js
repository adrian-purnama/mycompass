import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';
import archiver from 'archiver';
import { PassThrough } from 'stream';

// Password required for backup operations
const BACKUP_PASSWORD = process.env.BACKUP_PASSWORD || 'adriangacor';

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

    const { connectionString, databaseName, password } = body || {};

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

