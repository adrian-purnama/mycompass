'use client';

import { useState, useEffect } from 'react';
import { hasMasterPassword, setMasterPassword, verifyMasterPassword, resetMasterPassword, testPasswordDecryption } from '@/lib/storage';

export default function MasterPasswordModal({ onUnlock, isOpen, onClose }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSetup(!hasMasterPassword());
      setPassword('');
      setConfirmPassword('');
      setError('');
      setShowResetConfirm(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSetup) {
        // First time setup
        const trimmedPassword = password.trim();
        const trimmedConfirm = confirmPassword.trim();
        
        if (trimmedPassword.length < 8) {
          setError('Password must be at least 8 characters long');
          setLoading(false);
          return;
        }
        if (trimmedPassword !== trimmedConfirm) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        setMasterPassword(trimmedPassword);
        onUnlock(trimmedPassword);
      } else {
        // Unlock existing
        // Trim password to handle accidental whitespace
        const trimmedPassword = password.trim();
        if (!trimmedPassword) {
          setError('Password cannot be empty');
          setLoading(false);
          return;
        }
        
        // First verify the password hash matches
        if (!verifyMasterPassword(trimmedPassword)) {
          setError('Incorrect password. Please check for typos or extra spaces.');
          setLoading(false);
          return;
        }
        
        // Then test if it can actually decrypt the connections
        if (!testPasswordDecryption(trimmedPassword)) {
          // Try to fix the password mismatch by re-encrypting connections
          const { fixPasswordMismatch } = await import('@/lib/storage');
          const fixed = fixPasswordMismatch(trimmedPassword);
          
          if (fixed) {
            // Successfully fixed, proceed with unlock
            console.log('Password mismatch fixed - connections re-encrypted');
            onUnlock(trimmedPassword);
            return;
          } else {
            setError('Password verification passed but cannot decrypt connections. The connections may have been encrypted with a different password. You may need to reset and start fresh.');
            setLoading(false);
            return;
          }
        }
        
        onUnlock(trimmedPassword);
      }
    } catch (error) {
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset your master password?\n\nWARNING: This will delete ALL saved connections as they cannot be decrypted without the current password.\n\nThis action cannot be undone.')) {
      resetMasterPassword();
      setIsSetup(true);
      setPassword('');
      setConfirmPassword('');
      setError('');
      setShowResetConfirm(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-2xl font-semibold mb-4 text-black dark:text-zinc-50">
          {isSetup ? 'Set Master Password' : 'Enter Master Password'}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          {isSetup
            ? 'Create a master password to encrypt your MongoDB connection strings. This password cannot be recovered if lost.'
            : 'Enter your master password to access your saved connections.'}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-2 text-black dark:text-zinc-50"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter password"
              autoFocus
              required
            />
          </div>

          {isSetup && (
            <div className="mb-4">
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium mb-2 text-black dark:text-zinc-50"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm password"
                required
              />
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {!isSetup && !showResetConfirm && (
            <div className="mb-4 text-center">
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 underline"
              >
                Forgot password? Reset all data
              </button>
            </div>
          )}

          {showResetConfirm && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                <strong>Warning:</strong> Resetting will delete all saved connections.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
                >
                  Reset Everything
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || showResetConfirm}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : isSetup ? 'Set Password' : 'Unlock'}
            </button>
            {!isSetup && !showResetConfirm && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md font-medium transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

