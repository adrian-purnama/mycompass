'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FiChevronRight, FiChevronDown, FiDatabase, FiFolder, FiFile } from 'react-icons/fi';

export default function DatabaseTree({ connectionString, onSelectCollection, onSelectDatabase }) {
  const [databases, setDatabases] = useState([]);
  const [expandedDbs, setExpandedDbs] = useState(new Set());
  const [collections, setCollections] = useState({});
  const [loadingCounts, setLoadingCounts] = useState({}); // Track which collections are loading counts
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadingRef = useRef(false);

  const loadDatabases = useCallback(async () => {
    if (!connectionString || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString })
      });

      const result = await response.json();
      if (result.success) {
        setDatabases(result.databases || []);
      } else {
        setError(result.error || 'Failed to load databases');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [connectionString]);

  useEffect(() => {
    if (connectionString) {
      loadDatabases();
    } else {
      setDatabases([]);
      setCollections({});
      setExpandedDbs(new Set());
    }
  }, [connectionString, loadDatabases]);

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
    if (!connectionString) return;

    try {
      // First, get collection names quickly (without counts)
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString, databaseName: dbName, includeCounts: false })
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
              // Fetch count for this collection
              const countResponse = await fetch('/api/collections/count', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  connectionString,
                  databaseName: dbName,
                  collectionName: coll.name
                })
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
  }, [connectionString]);

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

  if (!connectionString) {
    return (
      <div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
        <p>No connection selected</p>
        <p className="text-sm mt-2">Connect to a database to view its structure</p>
      </div>
    );
  }

  if (loading && databases.length === 0) {
    return (
      <div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
        <p>Loading databases...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={loadDatabases}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (databases.length === 0) {
    return (
      <div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
        <p>No databases found</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="space-y-1">
        {databases.map((dbName) => {
          const isExpanded = expandedDbs.has(dbName);
          const dbCollections = collections[dbName] || [];

          return (
            <div key={dbName} className="select-none">
              <div
                className="flex items-center gap-1 px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded cursor-pointer group"
                onClick={() => toggleDatabase(dbName)}
              >
                {isExpanded ? (
                  <FiChevronDown className="text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                ) : (
                  <FiChevronRight className="text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                )}
                <FiDatabase className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span
                  className="flex-1 text-sm font-medium text-black dark:text-zinc-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDatabaseClick(dbName);
                  }}
                >
                  {dbName}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {dbCollections.length}
                </span>
              </div>

              {isExpanded && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {loading && !collections[dbName] ? (
                    <div className="px-2 py-1 text-xs text-zinc-400 dark:text-zinc-500">
                      Loading collections...
                    </div>
                  ) : dbCollections.length === 0 ? (
                    <div className="px-2 py-1 text-xs text-zinc-400 dark:text-zinc-500">
                      No collections
                    </div>
                  ) : (
                    dbCollections.map((coll) => {
                      const isLoadingCount = loadingCounts[dbName]?.has(coll.name);
                      const hasCount = coll.count !== null && coll.count !== undefined;
                      
                      return (
                        <div
                          key={coll.name}
                          className="flex items-center gap-2 px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded cursor-pointer"
                          onClick={() => handleCollectionClick(dbName, coll.name)}
                        >
                          <FiFile className="text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                          <span className="flex-1 text-sm text-black dark:text-zinc-50">
                            {coll.name}
                          </span>
                          {isLoadingCount || !hasCount ? (
                            <div className="w-4 h-4 border-2 border-zinc-300 dark:border-zinc-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
                          ) : (
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">
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

