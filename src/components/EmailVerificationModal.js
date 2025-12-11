'use client';

import { useState } from 'react';
import { FiX, FiMail, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

export default function EmailVerificationModal({ isOpen, onClose, email }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleResend = async () => {
    if (!email) return;

    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const result = await response.json();
      if (result.success) {
        setMessage('Verification email sent! Please check your inbox.');
      } else {
        setMessage(result.error || 'Failed to resend verification email');
      }
    } catch (error) {
      setMessage(error.message || 'Failed to resend verification email');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FiMail size={24} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
              Verify Your Email
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg">
          <div className="flex items-start gap-3">
            <FiAlertCircle size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                Email Verification Required
              </p>
              <p className="text-xs text-blue-800 dark:text-blue-300">
                We've sent a verification email to <strong>{email}</strong>. Please check your inbox and click the verification link to activate your account.
              </p>
            </div>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-md ${
            message.includes('sent')
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {message.includes('sent') ? (
                <FiCheckCircle className="text-green-600 dark:text-green-400" size={16} />
              ) : (
                <FiAlertCircle className="text-red-600 dark:text-red-400" size={16} />
              )}
              <p className={`text-sm ${
                message.includes('sent')
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {message}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleResend}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
          >
            <FiMail size={16} />
            {loading ? 'Sending...' : 'Resend Email'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


