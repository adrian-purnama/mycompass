'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiX, FiCopy, FiDatabase, FiCheckSquare, FiSquare } from 'react-icons/fi';

export default function CloneDialog({
  isOpen,
  onClose,
  availableConnections = [],
  organizationId,
  connectionsLoading = false,
  onRefreshConnections
}) {
  const [sourceConnectionId, setSourceConnectionId] = useState('');
  const [sourceDatabase, setSourceDatabase] = useState('');
  const [sourceDatabases, setSourceDatabases] = useState([]);
  const [loadingSourceDatabases, setLoadingSourceDatabases] = useState(false);
  const [targetConnectionId, setTargetConnectionId] = useState('');
  const [targetDatabase, setTargetDatabase] = useState('');
  const [targetDatabases, setTargetDatabases] = useState([]);
  const [loadingTargetDatabases, setLoadingTargetDatabases] = useState(false);
  const [availableCollections, setAvailableCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [password, setPassword] = useState('');

  // Ensure availableConnections is always an array (define early so it can be used in callbacks)
  const connections = Array.isArray(availableConnections) ? availableConnections : [];

  // Define load functions first (before useEffect hooks that use them)
  const loadSourceDatabases = useCallback(async () => {
    const sourceConnection = connections.find((c) => c.id === sourceConnectionId);
    if (!sourceConnection) return;

    setLoadingSourceDatabases(true);
    try {
      const token = localStorage.getItem('auth_token');
      const body = {};

      // If connectionString is available (admin), use it. Otherwise use connectionId (member)
      if (sourceConnection.connectionString) {
        body.connectionString = sourceConnection.connectionString;
      } else if (sourceConnectionId && organizationId) {
        body.connectionId = sourceConnectionId;
        body.organizationId = organizationId;
      } else {
        setError('Connection information is missing');
        setLoadingSourceDatabases(false);
        return;
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
      if (result.success) {
        setSourceDatabases(result.databases || []);
      } else {
        setError(result.error || 'Failed to load source databases');
      }
    } catch (error) {
      console.error('Failed to load source databases:', error);
      setError('Failed to load source databases');
    } finally {
      setLoadingSourceDatabases(false);
    }
  }, [sourceConnectionId, connections, organizationId]);

  const loadSourceCollections = useCallback(async () => {
    const sourceConnection = connections.find((c) => c.id === sourceConnectionId);
    if (!sourceConnection || !sourceDatabase) return;
    
    setLoadingCollections(true);
    try {
      const token = localStorage.getItem('auth_token');
      const body = {
        databaseName: sourceDatabase
      };

      // If connectionString is available (admin), use it. Otherwise use connectionId (member)
      if (sourceConnection.connectionString) {
        body.connectionString = sourceConnection.connectionString;
      } else if (sourceConnectionId && organizationId) {
        body.connectionId = sourceConnectionId;
        body.organizationId = organizationId;
      } else {
        setError('Connection information is missing');
        setLoadingCollections(false);
        return;
      }

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
        setAvailableCollections(result.collections || []);
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setLoadingCollections(false);
    }
  }, [sourceConnectionId, sourceDatabase, connections, organizationId]);

  const loadTargetDatabases = useCallback(async () => {
    const targetConnection = connections.find((c) => c.id === targetConnectionId);
    if (!targetConnection) return;

    setLoadingTargetDatabases(true);
    try {
      const token = localStorage.getItem('auth_token');
      const body = {};

      // If connectionString is available (admin), use it. Otherwise use connectionId (member)
      if (targetConnection.connectionString) {
        body.connectionString = targetConnection.connectionString;
      } else if (targetConnectionId && organizationId) {
        body.connectionId = targetConnectionId;
        body.organizationId = organizationId;
      } else {
        setError('Connection information is missing');
        setLoadingTargetDatabases(false);
        return;
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
      if (result.success) {
        setTargetDatabases(result.databases || []);
      }
    } catch (error) {
      console.error('Failed to load target databases:', error);
      setError('Failed to load target databases');
    } finally {
      setLoadingTargetDatabases(false);
    }
  }, [targetConnectionId, connections, organizationId]);

  // Load source databases when source connection is selected
  useEffect(() => {
    if (sourceConnectionId && isOpen) {
      loadSourceDatabases();
    } else {
      setSourceDatabases([]);
      setSourceDatabase('');
      setAvailableCollections([]);
      setSelectedCollections([]);
    }
  }, [sourceConnectionId, isOpen, loadSourceDatabases]);

  // Load available collections from source database
  useEffect(() => {
    if (isOpen && sourceConnectionId && sourceDatabase) {
      loadSourceCollections();
    } else {
      setAvailableCollections([]);
      setSelectedCollections([]);
    }
  }, [isOpen, sourceConnectionId, sourceDatabase, loadSourceCollections]);

  // Load target databases when target connection is selected
  useEffect(() => {
    if (targetConnectionId && isOpen) {
      loadTargetDatabases();
    } else {
      setTargetDatabases([]);
      setTargetDatabase('');
    }
  }, [targetConnectionId, isOpen, loadTargetDatabases]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setSourceConnectionId('');
      setSourceDatabase('');
      setSourceDatabases([]);
      setTargetConnectionId('');
      setTargetDatabase('');
      setTargetDatabases([]);
      setSelectedCollections([]);
      setProgress(null);
      setError(null);
      setSuccess(null);
      setPassword('');
      
      // Refresh connections when dialog opens (with a small delay to ensure state is ready)
      if (onRefreshConnections && organizationId) {
        // Use setTimeout to ensure the refresh happens after the component is fully mounted
        setTimeout(() => {
          console.log('Refreshing connections on dialog open...');
          onRefreshConnections();
        }, 100);
      }
      
      // Log connections for debugging
      console.log('CloneDialog opened - availableConnections:', availableConnections);
      console.log('CloneDialog opened - connections:', connections);
      console.log('CloneDialog opened - connections length:', connections.length);
      console.log('CloneDialog opened - organizationId:', organizationId);
      console.log('CloneDialog opened - connectionsLoading:', connectionsLoading);
    }
  }, [isOpen, organizationId, onRefreshConnections]);

  // Debug: Log availableConnections
  useEffect(() => {
    if (isOpen) {
      console.log('CloneDialog - availableConnections:', availableConnections);
      console.log('CloneDialog - organizationId:', organizationId);
      console.log('CloneDialog - connections length:', connections.length);
      console.log('CloneDialog - connections is array:', Array.isArray(connections));
      console.log('CloneDialog - connections:', connections);
    }
  }, [isOpen, availableConnections, organizationId, connections]);

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
    if (!sourceConnectionId || !sourceDatabase) {
      setError('Please select source connection and source database');
      return;
    }

    if (!targetConnectionId || !targetDatabase) {
      setError('Please select target connection and target database');
      return;
    }

    // Validate collection selection
    if (selectedCollections.length === 0) {
      setError('Please select at least one collection to clone');
      return;
    }

    // Validate password
    if (!password || password.trim() === '') {
      setError('Password is required');
      return;
    }

    const sourceConnection = connections.find((c) => c.id === sourceConnectionId);
    const targetConnection = connections.find((c) => c.id === targetConnectionId);
    
    if (!sourceConnection) {
      setError('Source connection not found');
      return;
    }
    
    if (!targetConnection) {
      setError('Target connection not found');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setProgress('Starting clone operation...');

    try {
      const token = localStorage.getItem('auth_token');
      const body = {
        sourceDatabase,
        targetDatabase,
        collectionNames: selectedCollections,
        password: password.trim(),
        organizationId
      };

      // Handle source connection
      if (sourceConnection.connectionString) {
        body.sourceConnectionString = sourceConnection.connectionString;
      } else if (sourceConnectionId && organizationId) {
        body.sourceConnectionId = sourceConnectionId;
      } else {
        setError('Source connection information is missing');
        setLoading(false);
        return;
      }

      // Handle target connection
      if (targetConnection.connectionString) {
        body.targetConnectionString = targetConnection.connectionString;
      } else if (targetConnectionId && organizationId) {
        body.targetConnectionId = targetConnectionId;
      } else {
        setError('Target connection information is missing');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/clone', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(body)
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
            Clone Collections
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Source Connection
            </label>
            {connectionsLoading ? (
              <div className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-zinc-50 dark:bg-zinc-800 text-zinc-500">
                Loading connections...
              </div>
            ) : (
              <>
                <select
                  value={sourceConnectionId}
                  onChange={(e) => setSourceConnectionId(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={connections.length === 0}
                >
                  <option value="">Select source connection</option>
                  {connections.length > 0 ? (
                    connections.map((conn) => (
                      <option key={conn.id} value={conn.id}>
                        {conn.displayName || conn.name || `Connection ${conn.id}`}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No connections available</option>
                  )}
                </select>
                {connections.length === 0 && organizationId && (
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      <strong>Debug Info:</strong> No connections found. availableConnections length: {availableConnections?.length || 0}, connections length: {connections.length}, organizationId: {organizationId || 'none'}
                    </p>
                    {onRefreshConnections && (
                      <button
                        onClick={() => {
                          console.log('Manually refreshing connections...');
                          onRefreshConnections();
                        }}
                        className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Refresh Connections
                      </button>
                    )}
                  </div>
                )}
                {!organizationId && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Please select an organization first.
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Source Database
            </label>
            {loadingSourceDatabases ? (
              <div className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-zinc-50 dark:bg-zinc-800 text-zinc-500">
                Loading databases...
              </div>
            ) : (
              <select
                value={sourceDatabase}
                onChange={(e) => setSourceDatabase(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!sourceConnectionId || loadingSourceDatabases}
              >
                <option value="">Select source database</option>
                {sourceDatabases.map((dbName) => (
                  <option key={dbName} value={dbName}>
                    {dbName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Target Connection
            </label>
            {connectionsLoading ? (
              <div className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-zinc-50 dark:bg-zinc-800 text-zinc-500">
                Loading connections...
              </div>
            ) : (
              <>
                <select
                  value={targetConnectionId}
                  onChange={(e) => setTargetConnectionId(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={connections.length === 0}
                >
                  <option value="">Select target connection</option>
                  {connections.length > 0 ? (
                    connections.map((conn) => (
                      <option key={conn.id} value={conn.id}>
                        {conn.displayName || conn.name || `Connection ${conn.id}`}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No connections available</option>
                  )}
                </select>
                {connections.length === 0 && organizationId && (
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      <strong>Debug Info:</strong> No connections found. availableConnections length: {availableConnections?.length || 0}, connections length: {connections.length}, organizationId: {organizationId || 'none'}
                    </p>
                    {onRefreshConnections && (
                      <button
                        onClick={() => {
                          console.log('Manually refreshing connections...');
                          onRefreshConnections();
                        }}
                        className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Refresh Connections
                      </button>
                    )}
                  </div>
                )}
                {!organizationId && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Please select an organization first.
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Target Database
            </label>
            {loadingTargetDatabases ? (
              <div className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-zinc-50 dark:bg-zinc-800 text-zinc-500">
                Loading databases...
              </div>
            ) : (
              <select
                value={targetDatabase}
                onChange={(e) => setTargetDatabase(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!targetConnectionId || loadingTargetDatabases}
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
              Select an existing database from the dropdown above
            </p>
            <div className="mt-2">
              <label className="block text-xs font-medium mb-1 text-zinc-600 dark:text-zinc-400">
                Or create a new database:
              </label>
              <input
                type="text"
                value={targetDatabase}
                onChange={(e) => setTargetDatabase(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new database name"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold">Note:</span> If you enter a new name here, it will create a new database in the target connection
              </p>
            </div>
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

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Backup Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter backup password"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold">Required</span> backup password to authorize clone operation
            </p>
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
                !sourceConnectionId ||
                !sourceDatabase ||
                !targetConnectionId ||
                !targetDatabase ||
                selectedCollections.length === 0 ||
                !password ||
                password.trim() === ''
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

