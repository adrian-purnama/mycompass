'use client';

import { useState } from 'react';
import { FiX, FiLock, FiMail, FiUser, FiAlertCircle } from 'react-icons/fi';

export default function AuthModal({ isOpen, onClose, onLogin, onRegister }) {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setVerificationSent(false);

    try {
      if (mode === 'login') {
        await onLogin(email, password);
        // Reset form on success
        setEmail('');
        setPassword('');
      } else {
        await onRegister(email, username, password);
        // Show verification message, don't auto-login
        setVerificationSent(true);
        setEmail('');
        setUsername('');
        setPassword('');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setEmail('');
    setUsername('');
    setPassword('');
    setVerificationSent(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FiLock size={24} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
              {mode === 'login' ? 'Login' : 'Register'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full pl-10 pr-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                autoFocus
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
                Username (optional)
              </label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" size={18} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  className="w-full pl-10 pr-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'login' ? 'Enter your password' : 'At least 6 characters'}
                className="w-full pl-10 pr-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                minLength={mode === 'register' ? 6 : undefined}
              />
            </div>
            {mode === 'register' && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Password must be at least 6 characters
              </p>
            )}
          </div>

          {verificationSent && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <div className="flex items-center gap-2">
                <FiMail className="text-blue-600 dark:text-blue-400" size={16} />
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Registration successful! Please check your email to verify your account before logging in.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-center gap-2">
                <FiAlertCircle className="text-red-600 dark:text-red-400" size={16} />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiLock size={16} />
              {loading ? 'Please wait...' : (mode === 'login' ? 'Login' : 'Register')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md font-medium transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={switchMode}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {mode === 'login'
                ? "Don't have an account? Register"
                : 'Already have an account? Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


