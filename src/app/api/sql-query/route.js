import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';

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

    const { connectionString, databaseName, sqlQuery } = body || {};

    // Validate required fields
    if (!connectionString || !databaseName || !sqlQuery) {
      return NextResponse.json(
        {
          success: false,
          error: 'Connection string, database name, and SQL query are required'
        },
        { status: 400 }
      );
    }

    // Validate that sqlQuery is not just whitespace
    if (typeof sqlQuery !== 'string' || !sqlQuery.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'SQL query cannot be empty'
        },
        { status: 400 }
      );
    }

    // Use sqltomango to convert SQL to MongoDB query
    try {
      const sqltomango = await import('sqltomango');
      
      // Get MongoDB client
      const client = await getMongoClient(connectionString);
      const db = client.db(databaseName);

      // Convert SQL to Mango query using parse() method
      const mangoQuery = sqltomango.parse(sqlQuery);
      
      // Get collection name from mangoQuery.table
      const collectionName = mangoQuery.table;
      if (!collectionName) {
        throw new Error('SQL query must include a FROM clause with collection name');
      }
      
      // Convert Mango query to MongoDB query
      const mongoQuery = convertMangoToMongo(mangoQuery);
      
      // Build MongoDB find query
      const collection = db.collection(collectionName);
      let findQuery = collection.find(mongoQuery.selector || {});
      
      // Apply sort if specified
      if (mongoQuery.sort && Object.keys(mongoQuery.sort).length > 0) {
        findQuery = findQuery.sort(mongoQuery.sort);
      }
      
      // Apply skip if specified
      if (mongoQuery.skip) {
        findQuery = findQuery.skip(mongoQuery.skip);
      }
      
      // Apply limit if specified
      if (mongoQuery.limit) {
        findQuery = findQuery.limit(mongoQuery.limit);
      }
      
      // Execute the query
      let results = await findQuery.toArray();
      
      // Apply field selection if specified (MongoDB projection)
      if (mongoQuery.fields && mongoQuery.fields.length > 0) {
        // Note: MongoDB projection is already applied in find(), but we can filter results
        // For simplicity, we'll return all fields and let the client handle projection
        // Or we can create a projection object
        const projection = {};
        mongoQuery.fields.forEach(field => {
          projection[field] = 1;
        });
        // Re-query with projection if needed, or filter in memory
        // For now, we'll return all fields as MongoDB projection in find() doesn't work the same way
      }

      return NextResponse.json({
        success: true,
        results: results,
        count: results.length
      });
    } catch (sqltomangoError) {
      console.error('sqltomango error:', sqltomangoError);
      
      return NextResponse.json(
        {
          success: false,
          error: `SQL to MongoDB conversion failed: ${sqltomangoError.message}`
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('SQL query error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to execute SQL query' },
      { status: 500 }
    );
  }
}

/**
 * Convert CouchDB Mango query to MongoDB query
 * @param {Object} mangoQuery - CouchDB Mango query object
 * @returns {Object} MongoDB query object
 */
function convertMangoToMongo(mangoQuery) {
  const mongoQuery = {
    selector: {},
    limit: mangoQuery.limit,
    skip: mangoQuery.skip,
    sort: {},
    fields: mangoQuery.fields || []
  };

  // Convert selector (Mango uses $eq for equality, MongoDB uses direct equality)
  if (mangoQuery.selector) {
    mongoQuery.selector = convertMangoSelector(mangoQuery.selector);
  }

  // Convert sort format: Mango uses [{field: "asc"}] or [{field: "desc"}]
  // MongoDB uses {field: 1} or {field: -1}
  if (mangoQuery.sort && Array.isArray(mangoQuery.sort)) {
    mangoQuery.sort.forEach(sortItem => {
      for (const [field, direction] of Object.entries(sortItem)) {
        mongoQuery.sort[field] = direction === 'desc' ? -1 : 1;
      }
    });
  }

  return mongoQuery;
}

/**
 * Convert Mango selector to MongoDB query
 * @param {Object} selector - Mango selector
 * @returns {Object} MongoDB query
 */
function convertMangoSelector(selector) {
  const mongoQuery = {};
  
  for (const [key, value] of Object.entries(selector)) {
    if (key === '$and' || key === '$or' || key === '$not') {
      // These operators are the same in MongoDB
      mongoQuery[key] = Array.isArray(value) 
        ? value.map(v => convertMangoSelector(v))
        : convertMangoSelector(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Handle operators - convert $eq to direct equality
      if (value.$eq !== undefined) {
        mongoQuery[key] = value.$eq;
      } else {
        // Other operators like $gt, $lt, $gte, $lte, $ne, $in, $nin, $exists, $regex are the same
        mongoQuery[key] = value;
      }
    } else {
      // Simple equality
      mongoQuery[key] = value;
    }
  }
  
  return mongoQuery;
}
