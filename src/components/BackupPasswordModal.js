'use client';

import { useState } from 'react';
import { FiX, FiLock, FiAlertCircle } from 'react-icons/fi';

export default function BackupPasswordModal({
  isOpen,
  onConfirm,
  onCancel,
  databaseName,
  organizationId
}) {
  const [backupPassword, setBackupPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!backupPassword || backupPassword.trim() === '') {
      setError('Backup password is required');
      return;
    }

    onConfirm(backupPassword.trim());
  };

  const handleCancel = () => {
    setBackupPassword('');
    setError('');
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FiLock size={24} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
              Password Required
            </h2>
          </div>
          <button
            onClick={handleCancel}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Important Notice */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg">
          <div className="flex items-start gap-3">
            <FiAlertCircle size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                🔒 Password Protection Required
              </p>
              <p className="text-xs text-blue-800 dark:text-blue-300">
                <span className="font-semibold">Enter the backup password to authorize this operation.</span>
              </p>
            </div>
          </div>
        </div>

        {/* Database Info */}
        {databaseName && (
          <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Database: <span className="font-semibold text-black dark:text-zinc-50">{databaseName}</span>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Backup Password */}
            <div>
              <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
                Backup Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                placeholder="Enter backup password"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold">Required</span> to authorize backup, clone, and export operations
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
              >
                <FiLock size={16} />
                Continue
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

