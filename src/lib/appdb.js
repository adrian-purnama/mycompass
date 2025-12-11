import { MongoClient } from 'mongodb';

// Connection to the app's own database (from .env)
let appDbClient = null;
let appDb = null;

/**
 * Get connection to the app's database
 * @returns {Promise<{client: MongoClient, db: any}>}
 */
export async function getAppDatabase() {
  if (appDb && appDbClient) {
    try {
      // Test if connection is still alive
      await appDbClient.db().admin().ping();
      return { client: appDbClient, db: appDb };
    } catch (error) {
      // Connection is dead, reconnect
      appDbClient = null;
      appDb = null;
    }
  }

  const connectionString = process.env.APP_DATABASE_URL || process.env.MONGODB_URI;
  if (!connectionString) {
    throw new Error('APP_DATABASE_URL or MONGODB_URI environment variable is required');
  }

  const client = new MongoClient(connectionString, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  await client.connect();
  appDbClient = client;
  appDb = client.db('mycompass'); // Database name for the app

  // Create indexes
  await appDb.collection('users').createIndex({ email: 1 }, { unique: true });
  await appDb.collection('users').createIndex({ username: 1 }, { unique: true, sparse: true });
  await appDb.collection('connections').createIndex({ userId: 1 });
  await appDb.collection('sessions').createIndex({ token: 1 }, { unique: true });
  await appDb.collection('sessions').createIndex({ userId: 1 });
  await appDb.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  // Backup scheduler indexes
  await appDb.collection('backup_schedules').createIndex({ userId: 1 });
  await appDb.collection('backup_schedules').createIndex({ connectionId: 1 });
  await appDb.collection('backup_schedules').createIndex({ enabled: 1 });
  await appDb.collection('backup_logs').createIndex({ scheduleId: 1 });
  await appDb.collection('backup_logs').createIndex({ userId: 1 });
  await appDb.collection('backup_logs').createIndex({ startedAt: -1 });
  await appDb.collection('backup_logs').createIndex({ status: 1 });
  await appDb.collection('backup_logs').createIndex({ retentionExpiresAt: 1 }, { expireAfterSeconds: 0 });
  await appDb.collection('google_drive_tokens').createIndex({ userId: 1 }, { unique: true });
  await appDb.collection('google_drive_tokens').createIndex({ expiresAt: 1 });

  // Organization indexes
  await appDb.collection('organizations').createIndex({ createdBy: 1 });
  await appDb.collection('organizations').createIndex({ name: 1 });
  
  // Organization members indexes
  await appDb.collection('organization_members').createIndex({ organizationId: 1 });
  await appDb.collection('organization_members').createIndex({ userId: 1 });
  await appDb.collection('organization_members').createIndex({ organizationId: 1, userId: 1 }, { unique: true });
  
  // Email verification indexes
  await appDb.collection('email_verifications').createIndex({ userId: 1 });
  await appDb.collection('email_verifications').createIndex({ token: 1 }, { unique: true });
  await appDb.collection('email_verifications').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  
  // Organization invitation indexes
  await appDb.collection('organization_invitations').createIndex({ organizationId: 1 });
  await appDb.collection('organization_invitations').createIndex({ email: 1 });
  await appDb.collection('organization_invitations').createIndex({ token: 1 }, { unique: true });
  await appDb.collection('organization_invitations').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await appDb.collection('organization_invitations').createIndex({ status: 1 });
  
  // Updated user indexes
  await appDb.collection('users').createIndex({ emailVerified: 1 });
  
  // Updated connection indexes
  await appDb.collection('connections').createIndex({ organizationId: 1 });
  await appDb.collection('connections').createIndex({ userId: 1, organizationId: 1 });
  
  // Connection permissions indexes
  await appDb.collection('connection_permissions').createIndex({ userId: 1, connectionId: 1 }, { unique: true });
  await appDb.collection('connection_permissions').createIndex({ connectionId: 1 });
  await appDb.collection('connection_permissions').createIndex({ organizationId: 1, userId: 1 });

  return { client: appDbClient, db: appDb };
}

/**
 * Close the app database connection
 */
export async function closeAppDatabase() {
  if (appDbClient) {
    await appDbClient.close();
    appDbClient = null;
    appDb = null;
  }
}

