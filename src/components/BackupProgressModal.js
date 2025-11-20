'use client';

import { FiX, FiAlertTriangle, FiHardDrive } from 'react-icons/fi';

export default function BackupProgressModal({
  isOpen,
  databaseName,
  currentCollection,
  processedCollections,
  totalCollections,
  progress,
  error,
  completedCollections = [],
  currentDocumentCount = 0,
  totalDocumentCount = 0,
  onClose
}) {
  if (!isOpen) return null;

  const percentage = totalCollections > 0 
    ? Math.round((processedCollections / totalCollections) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FiHardDrive size={24} className="text-green-600 dark:text-green-400" />
            <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
              Creating Backup
            </h2>
          </div>
          {!error && (
            <button
              onClick={onClose}
              disabled={progress < 100}
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title={progress < 100 ? "Please wait for backup to complete" : "Close"}
            >
              <FiX size={24} />
            </button>
          )}
        </div>

        {/* Warning Banner */}
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-3">
            <FiAlertTriangle size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                ⚠️ Do not close this page or navigate away
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                Closing the page during backup will cancel the process and may result in an incomplete backup file.
              </p>
            </div>
          </div>
        </div>

        {/* Progress Info */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-black dark:text-zinc-50">
              Database: <span className="font-semibold">{databaseName}</span>
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {processedCollections} of {totalCollections} collections
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-green-600 h-full transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-right">
            {percentage}%
          </p>
        </div>

        {/* Current Collection */}
        {currentCollection && progress < 100 && (
          <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
              Currently processing:
            </p>
            <p className="text-sm font-medium text-black dark:text-zinc-50 mb-2">
              {currentCollection}
            </p>
            {totalDocumentCount > 0 && (
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                  Documents: {currentDocumentCount.toLocaleString()} / {totalDocumentCount.toLocaleString()}
                </p>
                <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, (currentDocumentCount / totalDocumentCount) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-right">
                  {Math.round((currentDocumentCount / totalDocumentCount) * 100)}%
                </p>
              </div>
            )}
          </div>
        )}

        {/* Completed Collections List */}
        {completedCollections.length > 0 && (
          <div className="mb-4 max-h-32 overflow-y-auto">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
              Completed collections ({completedCollections.length}):
            </p>
            <div className="space-y-1">
              {completedCollections.map((name, i) => (
                <div
                  key={i}
                  className="text-xs text-zinc-500 dark:text-zinc-400 px-2 py-1 bg-zinc-50 dark:bg-zinc-800 rounded"
                >
                  ✓ {name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {progress === 100 && !error && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
              ✓ Backup completed successfully! The download should start automatically.
            </p>
          </div>
        )}

        {/* Close button when complete or error */}
        {(progress === 100 || error) && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              {error ? 'Close' : 'Done'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

