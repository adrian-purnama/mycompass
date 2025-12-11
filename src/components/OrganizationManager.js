'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiUsers, FiSettings, FiChevronRight, FiRefreshCw, FiAlertCircle, FiX } from 'react-icons/fi';

export default function OrganizationManager({ onSelectOrganization, selectedOrganizationId }) {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedOrgForSettings, setSelectedOrgForSettings] = useState(null);

  const loadOrganizations = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/organizations', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setOrganizations(result.organizations || []);
        // Auto-select first organization if none selected
        if (!selectedOrganizationId && result.organizations && result.organizations.length > 0) {
          onSelectOrganization(result.organizations[0].id);
        }
      } else {
        setError(result.error || 'Failed to load organizations');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedOrganizationId, onSelectOrganization]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const handleCreate = () => {
    setShowCreateModal(true);
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    loadOrganizations();
  };

  const handleOpenSettings = (e, org) => {
    e.stopPropagation(); // Prevent selecting organization when clicking settings
    setSelectedOrgForSettings(org);
    setShowSettingsModal(true);
  };

  const handleCloseSettings = () => {
    setShowSettingsModal(false);
    setSelectedOrgForSettings(null);
    loadOrganizations(); // Refresh to get updated member counts
  };

  if (showCreateModal) {
    return (
      <CreateOrganizationModal
        onSuccess={handleCreateSuccess}
        onCancel={() => setShowCreateModal(false)}
      />
    );
  }

  if (showSettingsModal && selectedOrgForSettings) {
    return (
      <OrganizationSettings
        organization={selectedOrgForSettings}
        onClose={handleCloseSettings}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Organizations</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={loadOrganizations}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            title="Refresh"
          >
            <FiRefreshCw size={16} />
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <FiPlus size={16} />
            Create
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="flex items-center gap-2">
              <FiAlertCircle className="text-destructive" size={16} />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <FiRefreshCw className="inline animate-spin mr-2" size={20} />
            Loading organizations...
          </div>
        ) : organizations.length === 0 ? (
          <div className="text-center py-12">
            <FiUsers size={48} className="mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Organizations</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first organization to get started. You can create multiple organizations and switch between them.
            </p>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <FiPlus className="inline mr-2" size={16} />
              Create Your First Organization
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {organizations.map((org) => (
              <div
                key={org.id}
                onClick={() => onSelectOrganization(org.id)}
                className={`p-4 border border-border rounded-lg cursor-pointer transition-all ${
                  selectedOrganizationId === org.id
                    ? 'bg-primary/10 border-primary shadow-sm'
                    : 'bg-card hover:bg-accent/50 hover:shadow-sm'
                }`}
              >
                  <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FiUsers size={18} className="text-primary" />
                      <h3 className="font-semibold text-foreground">{org.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        org.role === 'admin'
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {org.role}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(org.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleOpenSettings(e, org)}
                      className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
                      title="Organization Settings"
                    >
                      <FiSettings size={16} />
                    </button>
                    <FiChevronRight
                      size={20}
                      className={`text-muted-foreground transition-transform ${
                        selectedOrganizationId === org.id ? 'transform rotate-90' : ''
                      }`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateOrganizationModal({ onSuccess, onCancel }) {
  const [name, setName] = useState('');
  const [backupPassword, setBackupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }

    if (!backupPassword || backupPassword.length < 6) {
      setError('Backup password must be at least 6 characters');
      return;
    }

    if (backupPassword !== confirmPassword) {
      setError('Backup passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          backupPassword,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to create organization');
      }

      onSuccess();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-2xl font-semibold text-black dark:text-zinc-50 mb-4">
          Create Organization
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Organization Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Organization"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Backup Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={backupPassword}
              onChange={(e) => setBackupPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              minLength={6}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              This password will be required for all backup operations in this organization
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              Confirm Backup Password <span className="text-red-500">*</span>
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Organization'}
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

