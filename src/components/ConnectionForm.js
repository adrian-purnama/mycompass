'use client';

import { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';

export default function ConnectionForm({ connection, onSave, onCancel, onTest }) {
  const [displayName, setDisplayName] = useState(connection?.displayName || '');
  const [connectionString, setConnectionString] = useState(connection?.connectionString || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Update form state when connection prop changes
  useEffect(() => {
    if (connection) {
      setDisplayName(connection.displayName || '');
      setConnectionString(connection.connectionString || '');
    } else {
      setDisplayName('');
      setConnectionString('');
    }
    setTestResult(null);
    setSaveError(null);
  }, [connection]);

  const handleTest = async () => {
    if (!connectionString.trim()) {
      setTestResult({ success: false, error: 'Connection string is required' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString })
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim() || !connectionString.trim()) {
      setSaveError('Display name and connection string are required');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      if (onSave) {
        await onSave({
          id: connection?.id,
          displayName: displayName.trim(),
          connectionString: connectionString.trim()
        });
      }
    } catch (error) {
      setSaveError(error.message || 'Failed to save connection');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-black dark:text-zinc-50">
          {connection ? 'Edit Connection' : 'Add New Connection'}
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <FiX size={20} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="My MongoDB Server"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
            Connection String
          </label>
          <textarea
            value={connectionString}
            onChange={(e) => setConnectionString(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder="mongodb://localhost:27017"
            rows={3}
            required
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Example: mongodb://username:password@host:port/database
          </p>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-md ${
              testResult.success
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}
          >
            <p
              className={`text-sm ${
                testResult.success
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {testResult.success
                ? `✓ Connection successful! Found ${testResult.databases?.length || 0} database(s).`
                : `✗ Connection failed: ${testResult.error}`}
            </p>
          </div>
        )}

        {saveError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !connectionString.trim()}
            className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            type="submit"
            disabled={saving || !displayName.trim() || !connectionString.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : connection ? 'Update' : 'Save'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

