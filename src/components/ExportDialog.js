'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiX, FiDownload, FiDatabase, FiCheckSquare, FiSquare } from 'react-icons/fi';

export default function ExportDialog({
  isOpen,
  onClose,
  connectionString,
  connectionId,
  organizationId,
  databaseName: initialDatabaseName,
  availableCollections = []
}) {
  const [selectedDatabase, setSelectedDatabase] = useState(initialDatabaseName || '');
  const [databases, setDatabases] = useState([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [exportAll, setExportAll] = useState(false);
  const [format, setFormat] = useState('json');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Load databases when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadDatabases();
      setSelectedDatabase(initialDatabaseName || '');
      setSelectedCollections([]);
      setCollections([]);
      setExportAll(false);
      setFormat('json');
      setProgress(null);
      setError(null);
      setPassword('');
      setShowPasswordModal(false);
    }
  }, [isOpen, connectionString, connectionId, organizationId]);

  // Load collections when database is selected
  useEffect(() => {
    if (isOpen && selectedDatabase) {
      loadCollections(selectedDatabase);
    } else {
      setCollections([]);
      setSelectedCollections([]);
    }
  }, [isOpen, selectedDatabase, connectionString, connectionId, organizationId]);

  const loadDatabases = async () => {
    setLoadingDatabases(true);
    try {
      const token = localStorage.getItem('auth_token');
      const body = {};

      // If connectionString is available (admin), use it. Otherwise use connectionId (member)
      if (connectionString) {
        body.connectionString = connectionString;
      } else if (connectionId && organizationId) {
        body.connectionId = connectionId;
        body.organizationId = organizationId;
      } else {
        setError('Connection information is missing');
        setLoadingDatabases(false);
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
        setDatabases(result.databases || []);
      } else {
        setError(result.error || 'Failed to load databases');
      }
    } catch (error) {
      console.error('Failed to load databases:', error);
      setError('Failed to load databases');
    } finally {
      setLoadingDatabases(false);
    }
  };

  const loadCollections = async (dbName) => {
    setLoadingCollections(true);
    try {
      const token = localStorage.getItem('auth_token');
      const body = {
        databaseName: dbName,
        includeCounts: true
      };

      // If connectionString is available (admin), use it. Otherwise use connectionId (member)
      if (connectionString) {
        body.connectionString = connectionString;
      } else if (connectionId && organizationId) {
        body.connectionId = connectionId;
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
        const allCollections = result.collections || [];
        const filtered = allCollections.filter(c => !c.name.startsWith('system.'));
        setCollections(filtered);
        setSelectedCollections([]);
      } else {
        setError(result.error || 'Failed to load collections');
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
      setError('Failed to load collections');
    } finally {
      setLoadingCollections(false);
    }
  };
  
  // Prevent re-renders from causing issues
  const handleClose = useCallback(() => {
    setError(null);
    setProgress(null);
    setLoading(false);
    onClose();
  }, [onClose]);

  const toggleCollection = (collectionName) => {
    setSelectedCollections((prev) =>
      prev.includes(collectionName)
        ? prev.filter((c) => c !== collectionName)
        : [...prev, collectionName]
    );
    // Uncheck "export all" if manually selecting collections
    if (exportAll) {
      setExportAll(false);
    }
  };

  const handleExportAllChange = (checked) => {
    setExportAll(checked);
    if (checked) {
      // Select all collections when "export all" is checked
      setSelectedCollections(collections.map((c) => c.name));
    } else {
      // Clear selection when "export all" is unchecked
      setSelectedCollections([]);
    }
  };

  const handleExport = async () => {
    if (!selectedDatabase) {
      setError('Please select a database');
      return;
    }

    if (!exportAll && selectedCollections.length === 0) {
      setError('Please select at least one collection to export or check "Export All"');
      return;
    }

    if (!password || password.trim() === '') {
      setError('Password is required to export');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress('Preparing export...');

    try {
      const collectionsToExport = exportAll ? null : selectedCollections;

      const token = localStorage.getItem('auth_token');
      const body = {
        databaseName: selectedDatabase,
        collections: collectionsToExport,
        format,
        password: password.trim(),
        organizationId
      };

      // If connectionString is available (admin), use it. Otherwise use connectionId (member)
      if (connectionString) {
        body.connectionString = connectionString;
      } else if (connectionId && organizationId) {
        body.connectionId = connectionId;
      } else {
        setError('Connection information is missing');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        // Try to get error message from response
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Export failed');
        } catch (e) {
          // If response is not JSON, use the error message
          throw new Error(e.message || 'Export failed');
        }
      }

      // Export always returns a ZIP file now
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${selectedDatabase}_export.zip`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const collectionCount = exportAll ? collections.length : selectedCollections.length;
      setProgress(`Successfully exported ${collectionCount} collection(s) as ZIP file`);
      setTimeout(() => {
        handleClose();
      }, 2000);
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
          <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">Export Database</h2>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Step 1: Select Database */}
          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Step 1: Select Database <span className="text-red-500">*</span>
            </label>
            {loadingDatabases ? (
              <div className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-zinc-50 dark:bg-zinc-800 text-zinc-500">
                Loading databases...
              </div>
            ) : (
              <select
                value={selectedDatabase}
                onChange={(e) => setSelectedDatabase(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a database</option>
                {databases.map((dbName) => (
                  <option key={dbName} value={dbName}>
                    {dbName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Step 2: Export All Option */}
          {selectedDatabase && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                <input
                  type="checkbox"
                  checked={exportAll}
                  onChange={(e) => handleExportAllChange(e.target.checked)}
                  className="text-blue-600 w-4 h-4"
                />
                <span className="text-sm font-medium text-black dark:text-zinc-50">
                  Export All Collections
                </span>
              </label>
            </div>
          )}

          {/* Step 3: Select Collections (if not exporting all) */}
          {selectedDatabase && !exportAll && (
            <div>
              <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
                Step 2: Select Collections to Export <span className="text-red-500">*</span>
              </label>
              {loadingCollections ? (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm text-zinc-500 text-center">
                  Loading collections...
                </div>
              ) : collections.length === 0 ? (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm text-zinc-500 text-center">
                  No collections available
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-md p-2 bg-white dark:bg-zinc-900">
                  {collections.map((coll) => (
                    <label
                      key={coll.name}
                      className="flex items-center gap-2 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCollections.includes(coll.name)}
                        onChange={() => toggleCollection(coll.name)}
                        className="text-blue-600"
                      />
                      <span className="text-sm text-black dark:text-zinc-50 flex-1">
                        {coll.name}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {coll.count?.toLocaleString() || 0} docs
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
          )}

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
              <span className="font-semibold">Required</span> to authorize export operation
            </p>
          </div>

          {/* Export Format */}
          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Export Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="json">JSON</option>
              <option value="bson">BSON (JSON format)</option>
            </select>
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

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleExport}
              disabled={
                loading ||
                !selectedDatabase ||
                (!exportAll && selectedCollections.length === 0) ||
                (!connectionString && !connectionId) ||
                !organizationId ||
                !password ||
                password.trim() === ''
              }
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiDownload size={16} />
              {loading ? 'Exporting...' : 'Export'}
            </button>
          <button
            onClick={handleClose}
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

