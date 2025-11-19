// QueryLeaf integration helper
import { getMongoClient } from './mongodb';

/**
 * Execute a SQL query using QueryLeaf
 * @param {string} connectionString - MongoDB connection string
 * @param {string} databaseName - Database name
 * @param {string} sqlQuery - SQL query string
 * @returns {Promise<Array>} Query results
 */
export async function executeSQLQuery(connectionString, databaseName, sqlQuery) {
  try {
    // Import QueryLeaf as a named export
    const { QueryLeaf } = await import('@queryleaf/lib');
    
    // Get MongoDB client (QueryLeaf needs the client, not the database)
    const client = await getMongoClient(connectionString);

    // Initialize QueryLeaf with client and database name
    // QueryLeaf constructor: new QueryLeaf(mongoClient, databaseName)
    const queryLeaf = new QueryLeaf(client, databaseName);

    // Execute SQL query
    // ExecutionResult is: Document[] | Document | null
    const executionResult = await queryLeaf.execute(sqlQuery);

    // Handle the result - it can be an array, a single document, or null
    if (Array.isArray(executionResult)) {
      return executionResult;
    } else if (executionResult !== null && executionResult !== undefined) {
      // Single document
      return [executionResult];
    } else {
      // Null result
      return [];
    }
  } catch (error) {
    // If QueryLeaf fails, provide a helpful error message
    throw new Error(`SQL query execution failed: ${error.message}`);
  }
}

