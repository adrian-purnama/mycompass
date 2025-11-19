import { MongoClient } from 'mongodb';

// Connection pool to reuse connections
const connectionCache = new Map();

/**
 * Get or create a MongoDB client connection
 * @param {string} connectionString - MongoDB connection string
 * @returns {Promise<MongoClient>} MongoDB client
 */
export async function getMongoClient(connectionString) {
  // Check if we already have a connection for this URI
  if (connectionCache.has(connectionString)) {
    const client = connectionCache.get(connectionString);
    // Test if connection is still alive
    try {
      await client.db().admin().ping();
      return client;
    } catch (error) {
      // Connection is dead, remove from cache and create new one
      connectionCache.delete(connectionString);
      try {
        await client.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }

  // Create new connection
  const client = new MongoClient(connectionString, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  try {
    await client.connect();
    connectionCache.set(connectionString, client);
    return client;
  } catch (error) {
    throw new Error(`Failed to connect to MongoDB: ${error.message}`);
  }
}

/**
 * Test a MongoDB connection
 * @param {string} connectionString - MongoDB connection string
 * @returns {Promise<{success: boolean, error?: string, databases?: string[]}>}
 */
export async function testConnection(connectionString) {
  let client;
  try {
    client = await getMongoClient(connectionString);
    await client.db().admin().ping();
    
    // List databases to verify access
    const adminDb = client.db().admin();
    const { databases } = await adminDb.listDatabases();
    const dbNames = databases.map(db => db.name);

    return {
      success: true,
      databases: dbNames
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
  // Note: We don't close the client here as it's cached for reuse
}

/**
 * Get list of databases
 * @param {string} connectionString - MongoDB connection string
 * @returns {Promise<string[]>} Array of database names
 */
export async function listDatabases(connectionString) {
  const client = await getMongoClient(connectionString);
  const adminDb = client.db().admin();
  const { databases } = await adminDb.listDatabases();
  return databases.map(db => db.name);
}

/**
 * Get list of collections in a database
 * @param {string} connectionString - MongoDB connection string
 * @param {string} databaseName - Database name
 * @returns {Promise<Array<{name: string, count: number}>>} Array of collection info
 */
export async function listCollections(connectionString, databaseName) {
  const client = await getMongoClient(connectionString);
  const db = client.db(databaseName);
  const collections = await db.listCollections().toArray();
  
  // Get document counts for each collection
  const collectionsWithCount = await Promise.all(
    collections.map(async (coll) => {
      try {
        const count = await db.collection(coll.name).countDocuments();
        return { name: coll.name, count };
      } catch (error) {
        return { name: coll.name, count: 0 };
      }
    })
  );

  return collectionsWithCount;
}

/**
 * Get documents from a collection
 * @param {string} connectionString - MongoDB connection string
 * @param {string} databaseName - Database name
 * @param {string} collectionName - Collection name
 * @param {Object} query - MongoDB query filter
 * @param {Object} options - Query options (limit, skip, sort)
 * @returns {Promise<{documents: Array, total: number}>}
 */
export async function getDocuments(
  connectionString,
  databaseName,
  collectionName,
  query = {},
  options = {}
) {
  const client = await getMongoClient(connectionString);
  const db = client.db(databaseName);
  const collection = db.collection(collectionName);

  const { limit = 50, skip = 0, sort = {} } = options;

  const [documents, total] = await Promise.all([
    collection
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(query)
  ]);

  return { documents, total };
}

/**
 * Execute a MongoDB query
 * @param {string} connectionString - MongoDB connection string
 * @param {string} databaseName - Database name
 * @param {string} collectionName - Collection name
 * @param {Object} query - MongoDB query object
 * @returns {Promise<Array>} Query results
 */
export async function executeQuery(
  connectionString,
  databaseName,
  collectionName,
  query
) {
  const client = await getMongoClient(connectionString);
  const db = client.db(databaseName);
  const collection = db.collection(collectionName);

  // Support both find() and aggregate() queries
  if (query.type === 'aggregate') {
    return await collection.aggregate(query.pipeline || []).toArray();
  } else {
    const findQuery = collection.find(query.filter || {});
    if (query.sort) findQuery.sort(query.sort);
    if (query.limit) findQuery.limit(query.limit);
    if (query.skip) findQuery.skip(query.skip);
    return await findQuery.toArray();
  }
}

/**
 * Close a specific connection
 * @param {string} connectionString - MongoDB connection string
 */
export async function closeConnection(connectionString) {
  if (connectionCache.has(connectionString)) {
    const client = connectionCache.get(connectionString);
    connectionCache.delete(connectionString);
    try {
      await client.close();
    } catch (error) {
      // Ignore close errors
    }
  }
}

/**
 * Close all connections
 */
export async function closeAllConnections() {
  const promises = Array.from(connectionCache.values()).map(async (client) => {
    try {
      await client.close();
    } catch (error) {
      // Ignore close errors
    }
  });
  await Promise.all(promises);
  connectionCache.clear();
}


