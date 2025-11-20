'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiX, FiDownload, FiDatabase, FiCheckSquare, FiSquare } from 'react-icons/fi';

export default function ExportDialog({
  isOpen,
  onClose,
  connectionString,
  databaseName,
  availableCollections = []
}) {
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [exportType, setExportType] = useState('selected'); // 'selected', 'all', 'single'
  const [format, setFormat] = useState('json');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Ensure availableCollections is always an array
  const collections = Array.isArray(availableCollections) ? availableCollections : [];

  useEffect(() => {
    if (isOpen) {
      setSelectedCollections([]);
      setExportType('selected');
      setFormat('json');
      setProgress(null);
      setError(null);
      setPassword('');
      setShowPasswordModal(false);
    }
  }, [isOpen]);
  
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
  };

  const selectAll = () => {
    if (selectedCollections.length === collections.length) {
      setSelectedCollections([]);
    } else {
      setSelectedCollections(collections.map((c) => c.name));
    }
  };

  const handleExport = async () => {
    if (exportType === 'selected' && selectedCollections.length === 0) {
      setError('Please select at least one collection to export');
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
      const collectionsToExport =
        exportType === 'all' ? null : selectedCollections;

      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString,
          databaseName,
          collections: collectionsToExport,
          format,
          password: password.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      if (format === 'json') {
        const data = await response.json();
        if (data.success) {
          // Download as JSON file
          const jsonString = JSON.stringify(data.data, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${databaseName}_export.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setProgress(`Successfully exported ${data.collections.length} collection(s)`);
          setTimeout(() => {
            handleClose();
          }, 2000);
        } else {
          setError(data.error || 'Export failed');
        }
      } else {
        // BSON or other format - download directly
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${databaseName}_export.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setProgress('Export completed successfully');
        setTimeout(() => {
          handleClose();
        }, 2000);
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
          <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">Export Database</h2>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
            <h3 className="text-sm font-medium mb-2 text-black dark:text-zinc-50">Source</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-medium">Database:</span> {databaseName}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Export Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="all"
                  checked={exportType === 'all'}
                  onChange={(e) => setExportType(e.target.value)}
                  className="text-blue-600"
                />
                <span className="text-sm text-black dark:text-zinc-50">All Collections</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="selected"
                  checked={exportType === 'selected'}
                  onChange={(e) => setExportType(e.target.value)}
                  className="text-blue-600"
                />
                <span className="text-sm text-black dark:text-zinc-50">Selected Collections</span>
              </label>
            </div>
          </div>

          {exportType === 'selected' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-black dark:text-zinc-50">
                  Select Collections
                </label>
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {selectedCollections.length === collections.length
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-md p-2">
                {collections.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
                    No collections available
                  </p>
                ) : (
                  collections.map((coll) => (
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
                  ))
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Export Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                (exportType === 'selected' && selectedCollections.length === 0) ||
                !connectionString ||
                !databaseName ||
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

