'use client';

import { useState, useEffect } from 'react';
import { FiX, FiHardDrive, FiCheckSquare, FiSquare, FiDatabase } from 'react-icons/fi';

export default function BackupSelectionModal({
  isOpen,
  onConfirm,
  onCancel,
  databaseName,
  connectionString,
  availableCollections = []
}) {
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load collections with counts when modal opens
  useEffect(() => {
    if (isOpen && connectionString && databaseName) {
      loadCollectionsWithCounts();
    }
  }, [isOpen, connectionString, databaseName]);

  const loadCollectionsWithCounts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString,
          databaseName,
          includeCounts: true
        })
      });

      const result = await response.json();
      if (result.success) {
        const allCollections = result.collections || [];
        const filtered = allCollections.filter(c => !c.name.startsWith('system.'));
        setCollections(filtered);
        // Select all collections by default
        setSelectedCollections(filtered.map(c => c.name));
        setSelectAll(true);
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
      // Fallback to availableCollections if fetch fails
      const fallback = Array.isArray(availableCollections) ? availableCollections : [];
      setCollections(fallback.filter(c => !c.name.startsWith('system.')));
      setSelectedCollections(fallback.filter(c => !c.name.startsWith('system.')).map(c => c.name));
      setSelectAll(true);
    } finally {
      setLoading(false);
    }
  };

  const toggleCollection = (collectionName) => {
    setSelectedCollections((prev) => {
      const newSelection = prev.includes(collectionName)
        ? prev.filter((c) => c !== collectionName)
        : [...prev, collectionName];
      // Update selectAll state based on selection
      setSelectAll(newSelection.length === collections.length && collections.length > 0);
      return newSelection;
    });
  };

  const handleSelectAll = () => {
    if (selectedCollections.length === collections.length) {
      setSelectedCollections([]);
      setSelectAll(false);
    } else {
      setSelectedCollections(collections.map((c) => c.name));
      setSelectAll(true);
    }
  };

  const handleConfirm = () => {
    if (selectedCollections.length === 0) {
      return;
    }
    onConfirm(selectedCollections);
  };

  const handleCancel = () => {
    setSelectedCollections([]);
    setSelectAll(false);
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FiHardDrive size={24} className="text-green-600 dark:text-green-400" />
            <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
              Select Collections to Backup
            </h2>
          </div>
          <button
            onClick={handleCancel}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Database Info */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg">
          <div className="flex items-center gap-3">
            <FiDatabase size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                📁 Database: <span className="font-bold text-lg">{databaseName}</span>
              </p>
              <p className="text-xs text-blue-800 dark:text-blue-300">
                Select which collections (folders) you want to include in the backup
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Collections Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-black dark:text-zinc-50">
                Collections (Folders) <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {selectAll ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-md p-2">
              {loading ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
                  Loading collections...
                </p>
              ) : collections.length === 0 ? (
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
                    {selectedCollections.includes(coll.name) ? (
                      <FiCheckSquare size={18} className="text-blue-600 dark:text-blue-400" />
                    ) : (
                      <FiSquare size={18} className="text-zinc-400 dark:text-zinc-500" />
                    )}
                    <span className="text-sm text-black dark:text-zinc-50 flex-1">
                      {coll.name}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      ({coll.count?.toLocaleString() || 0} docs)
                    </span>
                  </label>
                ))
              )}
            </div>
            {selectedCollections.length > 0 && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold">{selectedCollections.length}</span> collection(s) selected for backup
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleConfirm}
              disabled={selectedCollections.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiHardDrive size={16} />
              Start Backup ({selectedCollections.length})
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

