'use client';

import { useState, useEffect } from 'react';
import { FiX, FiCopy, FiDatabase, FiCheckSquare, FiSquare } from 'react-icons/fi';

export default function CloneDialog({
  isOpen,
  onClose,
  sourceConnectionString,
  sourceDatabase,
  collectionName,
  availableConnections
}) {
  const [targetConnectionId, setTargetConnectionId] = useState('');
  const [targetDatabase, setTargetDatabase] = useState('');
  const [targetDatabases, setTargetDatabases] = useState([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [availableCollections, setAvailableCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [cloneType, setCloneType] = useState(collectionName ? 'collection' : 'database');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load available collections from source database
  useEffect(() => {
    if (isOpen && sourceConnectionString && sourceDatabase) {
      loadSourceCollections();
    }
  }, [isOpen, sourceConnectionString, sourceDatabase]);

  // Load target databases when target connection is selected
  useEffect(() => {
    if (targetConnectionId && isOpen) {
      loadTargetDatabases();
    } else {
      setTargetDatabases([]);
      setTargetDatabase('');
    }
  }, [targetConnectionId, isOpen]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setTargetConnectionId('');
      setTargetDatabase('');
      setTargetDatabases([]);
      setSelectedCollections([]);
      setCloneType(collectionName ? 'collection' : 'database');
      setProgress(null);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, collectionName]);

  const loadSourceCollections = async () => {
    if (!sourceConnectionString || !sourceDatabase) return;
    
    setLoadingCollections(true);
    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString: sourceConnectionString,
          databaseName: sourceDatabase
        })
      });

      const result = await response.json();
      if (result.success) {
        setAvailableCollections(result.collections || []);
        // If cloning a specific collection, pre-select it
        if (collectionName) {
          setSelectedCollections([collectionName]);
        }
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setLoadingCollections(false);
    }
  };

  const loadTargetDatabases = async () => {
    const targetConnection = availableConnections.find((c) => c.id === targetConnectionId);
    if (!targetConnection) return;

    setLoadingDatabases(true);
    try {
      const response = await fetch('/api/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString: targetConnection.connectionString
        })
      });

      const result = await response.json();
      if (result.success) {
        setTargetDatabases(result.databases || []);
      }
    } catch (error) {
      console.error('Failed to load target databases:', error);
      setError('Failed to load target databases');
    } finally {
      setLoadingDatabases(false);
    }
  };

  const toggleCollection = (collectionName) => {
    setSelectedCollections((prev) =>
      prev.includes(collectionName)
        ? prev.filter((c) => c !== collectionName)
        : [...prev, collectionName]
    );
  };

  const selectAllCollections = () => {
    if (selectedCollections.length === availableCollections.length) {
      setSelectedCollections([]);
    } else {
      setSelectedCollections(availableCollections.map((c) => c.name));
    }
  };

  const handleClone = async () => {
    if (!targetConnectionId || !targetDatabase) {
      setError('Please select target connection and target database');
      return;
    }

    // Validate collection selection
    if (selectedCollections.length === 0) {
      setError('Please select at least one collection to clone');
      return;
    }

    const targetConnection = availableConnections.find((c) => c.id === targetConnectionId);
    if (!targetConnection) {
      setError('Target connection not found');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setProgress('Starting clone operation...');

    try {
      const response = await fetch('/api/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceConnectionString,
          targetConnectionString: targetConnection.connectionString,
          sourceDatabase,
          targetDatabase,
          collectionNames: selectedCollections
        })
      });

      const result = await response.json();
      if (result.success) {
        setSuccess(result.message);
        setProgress(null);
        if (result.collections) {
          setProgress(
            `Cloned ${result.collectionsCloned} collection(s) with ${result.documentsCloned} document(s)`
          );
        } else {
          setProgress(`Cloned ${result.documentsCloned} document(s)`);
        }
      } else {
        setError(result.error || 'Clone operation failed');
        setProgress(null);
      }
    } catch (error) {
      setError(error.message);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Clone {cloneType === 'collection' ? 'Collection' : 'Database'}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
            <h3 className="text-sm font-medium mb-2 text-black dark:text-zinc-50">Source</h3>
            <div className="space-y-1 text-sm">
              <p className="text-zinc-600 dark:text-zinc-400">
                <span className="font-medium">Database:</span> {sourceDatabase}
              </p>
              {collectionName && (
                <p className="text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">Collection:</span> {collectionName}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Target Connection
            </label>
            <select
              value={targetConnectionId}
              onChange={(e) => setTargetConnectionId(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select target connection</option>
              {availableConnections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Target Database
            </label>
            {loadingDatabases ? (
              <div className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-zinc-50 dark:bg-zinc-800 text-zinc-500">
                Loading databases...
              </div>
            ) : (
              <select
                value={targetDatabase}
                onChange={(e) => setTargetDatabase(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!targetConnectionId || loadingDatabases}
              >
                <option value="">Select target database</option>
                {targetDatabases.map((dbName) => (
                  <option key={dbName} value={dbName}>
                    {dbName}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Select an existing database or enter a new name below
            </p>
            {targetDatabases.length > 0 && (
              <input
                type="text"
                value={targetDatabase}
                onChange={(e) => setTargetDatabase(e.target.value)}
                className="mt-2 w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Or enter new database name"
              />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-black dark:text-zinc-50">
                Select Collections to Clone
              </label>
              <button
                type="button"
                onClick={selectAllCollections}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {selectedCollections.length === availableCollections.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>
              {loadingCollections ? (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm text-zinc-500">
                  Loading collections...
                </div>
              ) : availableCollections.length === 0 ? (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm text-zinc-500">
                  No collections found
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 p-2">
                  {availableCollections.map((coll) => (
                    <label
                      key={coll.name}
                      className="flex items-center gap-2 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCollections.includes(coll.name)}
                        onChange={() => toggleCollection(coll.name)}
                        className="w-4 h-4 text-blue-600 border-zinc-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-black dark:text-zinc-50 flex-1">
                        {coll.name}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        ({coll.count || 0} docs)
                      </span>
                    </label>
                  ))}
                </div>
              )}
            {selectedCollections.length > 0 && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {selectedCollections.length} collection(s) selected
              </p>
            )}
          </div>

          {progress && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-sm text-blue-600 dark:text-blue-400">{progress}</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleClone}
              disabled={
                loading ||
                !targetConnectionId ||
                !targetDatabase ||
                selectedCollections.length === 0
              }
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiCopy size={16} />
              {loading ? 'Cloning...' : 'Clone'}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

