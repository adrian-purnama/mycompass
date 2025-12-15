'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiX, FiUsers, FiMail, FiCopy, FiTrash2, FiShield, FiLock, FiRefreshCw, FiAlertCircle, FiCheckCircle, FiUserPlus, FiDatabase } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import ConnectionPermissionsManager from './ConnectionPermissionsManager';

export default function OrganizationSettings({ organization, onClose }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(null);

  const loadData = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      // Load members
      const membersResponse = await fetch(`/api/organizations/${organization.id}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const membersResult = await membersResponse.json();
      if (membersResult.success) {
        setMembers(membersResult.members || []);
      }

      // Load pending invitations
      const invitationsResponse = await fetch(`/api/organizations/${organization.id}/invitations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const invitationsResult = await invitationsResponse.json();
      if (invitationsResult.success) {
        setPendingInvitations(invitationsResult.invitations || []);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [organization.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyLink = (link) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(link);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleInvite = async (email) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/organizations/${organization.id}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
        return { success: true, invitationLink: result.invitationLink, token: result.token };
      } else {
        throw new Error(result.error || 'Failed to send invitation');
      }
    } catch (error) {
      throw error;
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/organizations/${organization.id}/members?userId=${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
      } else {
        setError(result.error || 'Failed to remove member');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/organizations/${organization.id}/members`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, role: newRole }),
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
      } else {
        setError(result.error || 'Failed to update role');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  const generateInvitationLink = (token) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/invite?token=${token}`;
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <FiUsers size={24} className="text-primary" />
            <div>
              <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
                {organization.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {organization.role === 'admin' ? 'Administrator' : 'Member'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <div className="flex items-center gap-2">
                <FiAlertCircle className="text-destructive" size={16} />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}

          {/* Members Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <FiUsers size={18} />
                Members ({members.length})
              </h3>
              {organization.role === 'admin' && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <FiUserPlus size={16} />
                  Invite User
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <FiRefreshCw className="inline animate-spin mr-2" size={20} />
                Loading...
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.userId}
                    className="p-4 border border-border rounded-lg bg-card flex items-center justify-between hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <FiUsers size={18} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-foreground">{member.email}</p>
                          <span className="text-muted-foreground">=</span>
                          <span className={`text-sm font-medium px-2.5 py-1 rounded ${
                            member.role === 'admin'
                              ? 'bg-primary/20 text-primary border border-primary/30'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}>
                            {member.role === 'admin' ? 'Admin' : 'Member'}
                          </span>
                        </div>
                        {member.username && (
                          <p className="text-xs text-muted-foreground">{member.username}</p>
                        )}
                      </div>
                    </div>
                    {organization.role === 'admin' && member.userId !== user?.id && (
                      <div className="flex items-center gap-1 ml-3">
                        <button
                          onClick={() => handleUpdateRole(member.userId, member.role === 'admin' ? 'member' : 'admin')}
                          className="p-2 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
                          title={member.role === 'admin' ? 'Demote to Member' : 'Promote to Admin'}
                        >
                          <FiShield size={16} />
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          className="p-2 hover:bg-destructive/10 rounded-md text-destructive hover:text-destructive transition-colors"
                          title="Remove Member"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Invitations Section */}
          {organization.role === 'admin' && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                <FiMail size={18} />
                Pending Invitations ({pendingInvitations.length})
              </h3>

              {pendingInvitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending invitations.</p>
              ) : (
                <div className="space-y-2">
                  {pendingInvitations.map((invitation) => {
                    const invitationLink = generateInvitationLink(invitation.token);
                    return (
                      <div
                        key={invitation.id}
                        className="p-3 border border-border rounded-lg bg-card"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-foreground">{invitation.email}</p>
                            <p className="text-xs text-muted-foreground">
                              Invited by {invitation.invitedBy} • Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleCopyLink(invitationLink)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-sm font-medium transition-colors"
                          >
                            {copiedLink === invitationLink ? (
                              <>
                                <FiCheckCircle size={14} />
                                Copied!
                              </>
                            ) : (
                              <>
                                <FiCopy size={14} />
                                Copy Link
                              </>
                            )}
                          </button>
                        </div>
                        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono text-muted-foreground break-all">
                          {invitationLink}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Connection Access Section */}
          {organization.role === 'admin' && (
            <div className="mb-6">
              <ConnectionPermissionsManager organizationId={organization.id} />
            </div>
          )}

          {/* Backup Password Section */}
          {organization.role === 'admin' && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                <FiLock size={18} />
                Backup Password
              </h3>
              <button
                onClick={() => setShowResetPasswordModal(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Reset Backup Password
              </button>
            </div>
          )}

          {/* Danger Zone Section */}
          {organization.role === 'admin' && (
            <div className="border-t border-destructive/20 pt-6 mt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-destructive flex items-center gap-2 mb-2">
                  <FiAlertCircle size={18} />
                  Danger Zone
                </h3>
                <p className="text-sm text-muted-foreground">
                  Irreversible and destructive actions
                </p>
              </div>
              <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Delete Organization</h4>
                    <p className="text-sm text-muted-foreground">
                      Once you delete an organization, there is no going back. Please be certain.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90 transition-colors flex items-center gap-2"
                  >
                    <FiTrash2 size={16} />
                    Delete Organization
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite User Modal */}
      {showInviteModal && (
        <InviteUserModal
          organizationName={organization.name}
          onInvite={async (email) => {
            try {
              const result = await handleInvite(email);
              setShowInviteModal(false);
              // Show invitation link
              if (result && result.invitationLink) {
                handleCopyLink(result.invitationLink);
                alert(`Invitation sent! The invitation link has been copied to your clipboard.`);
              }
            } catch (error) {
              setError(error.message);
            }
          }}
          onCancel={() => setShowInviteModal(false)}
        />
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && (
        <ResetPasswordModal
          organizationId={organization.id}
          onSuccess={() => {
            setShowResetPasswordModal(false);
            alert('Backup password reset successfully!');
          }}
          onCancel={() => setShowResetPasswordModal(false)}
        />
      )}

      {/* Delete Organization Modal */}
      {showDeleteModal && (
        <DeleteOrganizationModal
          organization={organization}
          onSuccess={() => {
            setShowDeleteModal(false);
            onClose();
            // Reload the page or redirect to organizations list
            window.location.reload();
          }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}

function InviteUserModal({ organizationName, onInvite, onCancel }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError('Valid email address is required');
      return;
    }

    setLoading(true);
    try {
      await onInvite(email);
      setEmail('');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
            Invite User to {organizationName}
          </h2>
          <button
            onClick={onCancel}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              autoFocus
            />
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
      </div>
    </div>
  );
}

function ResetPasswordModal({ organizationId, onSuccess, onCancel }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/organizations/${organizationId}/backup-password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to reset password');
      }

      onSuccess();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
            Reset Backup Password
          </h2>
          <button
            onClick={onCancel}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              New Backup Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              minLength={6}
            />
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
              <FiLock size={16} />
              {loading ? 'Resetting...' : 'Reset Password'}
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
      </div>
    </div>
  );
}

function DeleteOrganizationModal({ organization, onSuccess, onCancel }) {
  const [confirmName, setConfirmName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Frontend validation: check if typed name matches organization name
    if (confirmName.trim() !== organization.name.trim()) {
      setError('Organization name does not match');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete organization');
      }

      onSuccess();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-destructive">
            Delete Organization
          </h2>
          <button
            onClick={onCancel}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <div className="flex items-start gap-2">
            <FiAlertCircle className="text-destructive flex-shrink-0 mt-0.5" size={16} />
            <div className="text-sm text-foreground">
              <p className="font-semibold mb-1">This action cannot be undone.</p>
              <p className="text-muted-foreground">
                This will permanently delete the organization, all its members, connections, and associated data.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Type the organization name to confirm <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={organization.name}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-destructive"
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Type <span className="font-mono font-semibold">{organization.name}</span> to confirm
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || confirmName.trim() !== organization.name.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-destructive/90"
            >
              <FiTrash2 size={16} />
              {loading ? 'Deleting...' : 'Delete Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

