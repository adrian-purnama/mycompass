'use client';

import { useState } from 'react';
import { FiX, FiMail, FiCheckCircle } from 'react-icons/fi';

export default function InviteUserModal({ organizationId, onSuccess, onCancel }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [invitationLink, setInvitationLink] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email || !email.includes('@')) {
      setError('Valid email address is required');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/organizations/${organizationId}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to send invitation');
      }

      setInvitationLink(result.invitationLink || '');
      setSuccess(true);
      
      // Auto-copy link to clipboard
      if (result.invitationLink) {
        navigator.clipboard.writeText(result.invitationLink);
      }

      // Reset form after 2 seconds and call onSuccess
      setTimeout(() => {
        setEmail('');
        setSuccess(false);
        setInvitationLink('');
        onSuccess();
      }, 2000);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
            Invite User
          </h2>
          <button
            onClick={onCancel}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <FiX size={24} />
          </button>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <FiCheckCircle size={20} />
                <p className="font-medium">Invitation sent successfully!</p>
              </div>
              {invitationLink && (
                <div className="mt-3">
                  <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                    Invitation link copied to clipboard:
                  </p>
                  <div className="p-2 bg-white dark:bg-zinc-800 rounded border border-green-200 dark:border-green-800">
                    <p className="text-xs font-mono text-green-800 dark:text-green-200 break-all">
                      {invitationLink}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full pl-10 pr-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
              >
                <FiMail size={16} />
                {loading ? 'Sending...' : 'Send Invitation'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


