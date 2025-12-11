'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FiChevronRight, FiChevronDown, FiDatabase, FiFolder, FiFile, FiLayers } from 'react-icons/fi';

export default function DatabaseTree({ connectionString, connectionId, organizationId, onSelectCollection, onSelectDatabase }) {
  const [databases, setDatabases] = useState([]);
  const [expandedDbs, setExpandedDbs] = useState(new Set());
  const [collections, setCollections] = useState({});
  const [loadingCounts, setLoadingCounts] = useState({}); // Track which collections are loading counts
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadingRef = useRef(false);

  const loadDatabases = useCallback(async () => {
    // Check if we have either a valid connectionString (non-empty) or connectionId
    const hasConnectionString = connectionString && typeof connectionString === 'string' && connectionString.trim().length > 0;
    const hasConnectionId = connectionId && organizationId;
    const hasValidConnection = hasConnectionString || hasConnectionId;
    
    if (!hasValidConnection || loadingRef.current) {
      console.log('DatabaseTree loadDatabases: Skipping - no valid connection or already loading', {
        hasConnectionString,
        hasConnectionId,
        loading: loadingRef.current
      });
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const body = {};
      
      // If connectionString is available and not empty (admin), use it. Otherwise use connectionId (member)
      if (hasConnectionString) {
        body.connectionString = connectionString;
        console.log('DatabaseTree: Using connectionString');
      } else if (hasConnectionId) {
        body.connectionId = connectionId;
        body.organizationId = organizationId;
        console.log('DatabaseTree: Using connectionId and organizationId', { connectionId, organizationId });
      } else {
        throw new Error('Connection information is missing');
      }

      const response = await fetch('/api/databases', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      console.log('DatabaseTree: API response', { success: result.success, error: result.error, databasesCount: result.databases?.length || 0 });
      if (result.success) {
        setDatabases(result.databases || []);
      } else {
        const errorMsg = result.error || 'Failed to load databases';
        console.error('DatabaseTree: API error', errorMsg);
        setError(errorMsg);
      }
    } catch (error) {
      console.error('DatabaseTree: Exception', error);
      setError(error.message);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [connectionString, connectionId, organizationId]);

  useEffect(() => {
    // Check if we have either a valid connectionString (non-empty) or connectionId
    // connectionString can be null, undefined, or empty string - all should be treated as "no connection string"
    const hasConnectionString = connectionString && typeof connectionString === 'string' && connectionString.trim().length > 0;
    const hasConnectionId = connectionId && organizationId;
    const hasValidConnection = hasConnectionString || hasConnectionId;
    
    console.log('DatabaseTree useEffect:', {
      connectionString: connectionString ? `"${connectionString.substring(0, 20)}..."` : 'null/empty',
      connectionId,
      organizationId,
      hasConnectionString,
      hasConnectionId,
      hasValidConnection
    });
    
    if (hasValidConnection) {
      console.log('DatabaseTree: Loading databases...');
      loadDatabases();
    } else {
      console.log('DatabaseTree: No valid connection, clearing data');
      setDatabases([]);
      setCollections({});
      setExpandedDbs(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionString, connectionId, organizationId]);

  const toggleDatabase = async (dbName) => {
    const newExpanded = new Set(expandedDbs);
    if (newExpanded.has(dbName)) {
      newExpanded.delete(dbName);
    } else {
      newExpanded.add(dbName);
      // Load collections if not already loaded
      if (!collections[dbName]) {
        await loadCollections(dbName);
      }
    }
    setExpandedDbs(newExpanded);
  };

  const loadCollections = useCallback(async (dbName) => {
    // Check if we have either a valid connectionString (non-empty) or connectionId
    const hasConnectionString = connectionString && typeof connectionString === 'string' && connectionString.trim().length > 0;
    const hasConnectionId = connectionId && organizationId;
    const hasValidConnection = hasConnectionString || hasConnectionId;
    
    if (!hasValidConnection) {
      console.log('DatabaseTree loadCollections: No valid connection', { hasConnectionString, hasConnectionId });
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('DatabaseTree loadCollections: No auth token');
        return;
      }
      
      const body = {
        databaseName: dbName,
        includeCounts: false
      };

      // If connectionString is available and not empty (admin), use it. Otherwise use connectionId (member)
      if (hasConnectionString) {
        body.connectionString = connectionString;
      } else if (hasConnectionId) {
        body.connectionId = connectionId;
        body.organizationId = organizationId;
      } else {
        return;
      }

      // First, get collection names quickly (without counts)
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      if (result.success) {
        const collectionsList = result.collections || [];
        
        // Set collections immediately with null counts (shows loading state)
        setCollections((prev) => {
          // Prevent duplicate loading
          if (prev[dbName]) return prev;
          const collectionsWithLoading = collectionsList.map(coll => ({
            ...coll,
            count: coll.count === undefined ? null : coll.count
          }));
          return {
            ...prev,
            [dbName]: collectionsWithLoading
          };
        });

        // Mark collections as loading counts if count is null
        const collectionsNeedingCounts = collectionsList.filter(coll => coll.count === null || coll.count === undefined);
        if (collectionsNeedingCounts.length > 0) {
          setLoadingCounts((prev) => ({
            ...prev,
            [dbName]: new Set(collectionsNeedingCounts.map(c => c.name))
          }));

          // Fetch counts incrementally (don't await all, update as they come in)
          collectionsNeedingCounts.forEach(async (coll) => {
            try {
              const token = localStorage.getItem('auth_token');
              const countBody = {
                databaseName: dbName,
                collectionName: coll.name
              };

              // If connectionString is available and not empty (admin), use it. Otherwise use connectionId (member)
              if (hasConnectionString) {
                countBody.connectionString = connectionString;
              } else if (hasConnectionId) {
                countBody.connectionId = connectionId;
                countBody.organizationId = organizationId;
              } else {
                return;
              }

              // Fetch count for this collection
              const countResponse = await fetch('/api/collections/count', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify(countBody)
              });
              
              const countResult = await countResponse.json();
              const count = countResult.success ? countResult.count : 0;
              
              // Update this collection's count
              setCollections((prev) => {
                const dbColls = prev[dbName] || [];
                return {
                  ...prev,
                  [dbName]: dbColls.map(c => 
                    c.name === coll.name ? { ...c, count } : c
                  )
                };
              });

              // Remove from loading set
              setLoadingCounts((prev) => {
                const loadingSet = prev[dbName] || new Set();
                const newSet = new Set(loadingSet);
                newSet.delete(coll.name);
                return {
                  ...prev,
                  [dbName]: newSet.size > 0 ? newSet : undefined
                };
              });
            } catch (error) {
              console.error(`Failed to load count for ${coll.name}:`, error);
              // Update with 0 on error
              setCollections((prev) => {
                const dbColls = prev[dbName] || [];
                return {
                  ...prev,
                  [dbName]: dbColls.map(c => 
                    c.name === coll.name ? { ...c, count: 0 } : c
                  )
                };
              });
              
              // Remove from loading set
              setLoadingCounts((prev) => {
                const loadingSet = prev[dbName] || new Set();
                const newSet = new Set(loadingSet);
                newSet.delete(coll.name);
                return {
                  ...prev,
                  [dbName]: newSet.size > 0 ? newSet : undefined
                };
              });
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
    }
  }, [connectionString, connectionId, organizationId]);

  const handleCollectionClick = (dbName, collectionName) => {
    if (onSelectCollection) {
      onSelectCollection(dbName, collectionName);
    }
  };

  const handleDatabaseClick = (dbName) => {
    if (onSelectDatabase) {
      onSelectDatabase(dbName);
    }
  };

  // Check if we have a valid connection (either connectionString or connectionId)
  const hasConnectionString = connectionString && typeof connectionString === 'string' && connectionString.trim().length > 0;
  const hasConnectionId = connectionId && organizationId;
  const hasValidConnection = hasConnectionString || hasConnectionId;

  if (!hasValidConnection) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <FiDatabase size={32} className="mx-auto mb-3 opacity-20" />
        <p className="text-sm">No connection selected</p>
        <p className="text-xs mt-1">Connect to a database to view its structure</p>
      </div>
    );
  }

  if (loading && databases.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading databases...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
          <p className="text-xs text-destructive">{error}</p>
          <button
            onClick={loadDatabases}
            className="mt-2 text-xs text-destructive hover:underline font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (databases.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm">No databases found</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="space-y-0.5">
        {databases.map((dbName) => {
          const isExpanded = expandedDbs.has(dbName);
          const dbCollections = collections[dbName] || [];

          return (
            <div key={dbName} className="select-none">
              <div
                className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer group transition-colors"
                onClick={() => toggleDatabase(dbName)}
              >
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {isExpanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                </span>
                <FiDatabase size={14} className="text-blue-500" />
                <span
                  className="flex-1 text-sm font-medium text-foreground truncate"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDatabaseClick(dbName);
                  }}
                >
                  {dbName}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {dbCollections.length}
                </span>
              </div>

              {isExpanded && (
                <div className="ml-4 pl-2 border-l border-border mt-0.5 space-y-0.5">
                  {loading && !collections[dbName] ? (
                    <div className="px-2 py-1 text-xs text-muted-foreground flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                      Loading collections...
                    </div>
                  ) : dbCollections.length === 0 ? (
                    <div className="px-2 py-1 text-xs text-muted-foreground italic">
                      No collections
                    </div>
                  ) : (
                    dbCollections.map((coll) => {
                      const isLoadingCount = loadingCounts[dbName]?.has(coll.name);
                      const hasCount = coll.count !== null && coll.count !== undefined;
                      
                      return (
                        <div
                          key={coll.name}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer group transition-colors"
                          onClick={() => handleCollectionClick(dbName, coll.name)}
                        >
                          <FiLayers size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                          <span className="flex-1 text-sm text-muted-foreground group-hover:text-foreground truncate transition-colors">
                            {coll.name}
                          </span>
                          {isLoadingCount || !hasCount ? (
                            <div className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin flex-shrink-0" />
                          ) : (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {coll.count?.toLocaleString() || 0}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
