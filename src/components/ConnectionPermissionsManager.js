'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiDatabase, FiUsers, FiCheck, FiX, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';

export default function ConnectionPermissionsManager({ organizationId }) {
  const [connections, setConnections] = useState([]);
  const [members, setMembers] = useState([]);
  const [permissions, setPermissions] = useState({}); // { connectionId: [userId1, userId2, ...] }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState({}); // { connectionId_userId: true/false }

  const loadData = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token || !organizationId) return;

    setLoading(true);
    setError(null);
    try {
      // Load connections
      const connectionsResponse = await fetch(`/api/connections?organizationId=${organizationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const connectionsResult = await connectionsResponse.json();
      if (connectionsResult.success) {
        setConnections(connectionsResult.connections || []);
      }

      // Load members
      const membersResponse = await fetch(`/api/organizations/${organizationId}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const membersResult = await membersResponse.json();
      if (membersResult.success) {
        setMembers(membersResult.members || []);
      }

      // Load permissions for each connection
      const permissionsMap = {};
      if (connectionsResult.success && connectionsResult.connections) {
        for (const connection of connectionsResult.connections) {
          try {
            const permResponse = await fetch(
              `/api/organizations/${organizationId}/connections/${connection.id}/permissions`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              }
            );
            const permResult = await permResponse.json();
            if (permResult.success) {
              permissionsMap[connection.id] = permResult.permissions.map(p => p.userId);
            }
          } catch (err) {
            console.error(`Failed to load permissions for connection ${connection.id}:`, err);
            permissionsMap[connection.id] = [];
          }
        }
      }
      setPermissions(permissionsMap);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const togglePermission = async (connectionId, userId, hasAccess) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const key = `${connectionId}_${userId}`;
    setUpdating(prev => ({ ...prev, [key]: true }));

    try {
      if (hasAccess) {
        // Revoke access
        const response = await fetch(
          `/api/organizations/${organizationId}/connections/${connectionId}/permissions?userId=${userId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to revoke access');
        }
      } else {
        // Grant access
        const response = await fetch(
          `/api/organizations/${organizationId}/connections/${connectionId}/permissions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
          }
        );
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to grant access');
        }
      }

      // Update local state
      setPermissions(prev => {
        const newPerms = { ...prev };
        if (!newPerms[connectionId]) {
          newPerms[connectionId] = [];
        }
        if (hasAccess) {
          newPerms[connectionId] = newPerms[connectionId].filter(id => id !== userId);
        } else {
          newPerms[connectionId] = [...newPerms[connectionId], userId];
        }
        return newPerms;
      });
    } catch (error) {
      setError(error.message);
      console.error('Toggle permission error:', error);
    } finally {
      setUpdating(prev => {
        const newUpdating = { ...prev };
        delete newUpdating[key];
        return newUpdating;
      });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FiRefreshCw className="inline animate-spin mr-2" size={20} />
        Loading connection permissions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
        <div className="flex items-center gap-2">
          <FiAlertCircle className="text-destructive" size={16} />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FiDatabase size={32} className="mx-auto mb-3 opacity-20" />
        <p className="text-sm">No connections in this organization</p>
        <p className="text-xs mt-1">Create a connection first to manage access</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FiDatabase size={18} />
          Connection Access Control
        </h3>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          <FiRefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {connections.map((connection) => {
          const connectionPermissions = permissions[connection.id] || [];
          return (
            <div
              key={connection.id}
              className="p-4 border border-border rounded-lg bg-card"
            >
              <div className="flex items-center gap-2 mb-4">
                <FiDatabase size={16} className="text-primary" />
                <h4 className="font-semibold text-foreground">{connection.displayName}</h4>
              </div>

              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members in this organization</p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => {
                    const hasAccess = connectionPermissions.includes(member.userId);
                    const key = `${connection.id}_${member.userId}`;
                    const isUpdating = updating[key];

                    return (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between p-2 border border-border rounded-md hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <FiUsers size={14} className="text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{member.email}</p>
                            {member.username && (
                              <p className="text-xs text-muted-foreground">{member.username}</p>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            member.role === 'admin'
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {member.role}
                          </span>
                        </div>
                        <button
                          onClick={() => togglePermission(connection.id, member.userId, hasAccess)}
                          disabled={isUpdating || member.role === 'admin'}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                            hasAccess
                              ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/30'
                              : 'bg-muted text-muted-foreground hover:bg-accent'
                          }`}
                          title={member.role === 'admin' ? 'Admins have access to all connections' : hasAccess ? 'Revoke access' : 'Grant access'}
                        >
                          {isUpdating ? (
                            <FiRefreshCw className="animate-spin" size={12} />
                          ) : hasAccess ? (
                            <>
                              <FiCheck size={12} />
                              Has Access
                            </>
                          ) : (
                            <>
                              <FiX size={12} />
                              No Access
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

