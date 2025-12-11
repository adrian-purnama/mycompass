'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getConnections,
  addConnection as addConnectionStorage,
  updateConnection as updateConnectionStorage,
  deleteConnection as deleteConnectionStorage,
  getActiveConnectionId,
  setActiveConnectionId,
  updateLastUsed,
  isAuthenticated
} from '@/lib/storage';

export function useConnections(organizationId) {
  const [connections, setConnections] = useState([]);
  const [activeConnectionId, setActiveConnectionIdState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadingRef = useRef(false);

  // Load connections from API
  const loadConnections = useCallback(async () => {
    // Prevent concurrent calls
    if (loadingRef.current) {
      return;
    }

    if (!isAuthenticated() || !organizationId) {
      setConnections([]);
      setActiveConnectionIdState(null);
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    try {
      const loaded = await getConnections(organizationId);
      setConnections(loaded);
      const activeId = getActiveConnectionId();
      setActiveConnectionIdState(activeId);
      setError(null); // Clear errors on success
    } catch (error) {
      console.error('Failed to load connections:', error);
      setError('Failed to load connections: ' + error.message);
      setConnections([]); // Clear connections on error
      setActiveConnectionIdState(null); // Clear active connection
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    // Load connections when component mounts, when auth state changes, or when organizationId changes
    const timeoutId = setTimeout(() => {
      loadConnections();
    }, 0);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, loadConnections]);

  // Add a new connection
  const addConnection = useCallback(
    async (connection) => {
      if (!isAuthenticated()) {
        setError('Authentication required');
        return false;
      }

      if (!organizationId) {
        setError('Organization ID is required');
        return false;
      }

      try {
        await addConnectionStorage({ ...connection, organizationId });
        await loadConnections();
        return true;
      } catch (error) {
        setError('Failed to add connection: ' + error.message);
        console.error(error);
        return false;
      }
    },
    [loadConnections, organizationId]
  );

  // Update an existing connection
  const updateConnection = useCallback(
    async (id, updates) => {
      if (!isAuthenticated()) {
        setError('Authentication required');
        return false;
      }

      try {
        await updateConnectionStorage(id, updates);
        await loadConnections();
        return true;
      } catch (error) {
        setError('Failed to update connection: ' + error.message);
        console.error(error);
        return false;
      }
    },
    [loadConnections]
  );

  // Set active connection
  const setActiveConnection = useCallback(
    async (id) => {
      setActiveConnectionId(id);
      setActiveConnectionIdState(id);
      if (id) {
        try {
          // Update lastUsed in the background without blocking
          updateLastUsed(id).catch(err => console.error('Failed to update last used:', err));
          // Update local state optimistically to avoid reload
          setConnections(prev => prev.map(conn => 
            conn.id === id ? { ...conn, lastUsed: new Date().toISOString() } : conn
          ));
        } catch (error) {
          console.error('Failed to set active connection:', error);
        }
      }
    },
    [] // No dependencies to prevent loops
  );

  // Delete a connection
  const deleteConnection = useCallback(
    async (id) => {
      if (!isAuthenticated()) {
        setError('Authentication required');
        return false;
      }

      try {
        const wasActive = activeConnectionId === id;
        await deleteConnectionStorage(id);
        // If deleted connection was active, clear active connection first
        if (wasActive) {
          setActiveConnectionId(null);
          setActiveConnectionIdState(null);
        }
        await loadConnections();
        return true;
      } catch (error) {
        setError('Failed to delete connection: ' + error.message);
        console.error(error);
        return false;
      }
    },
    [loadConnections, activeConnectionId]
  );

  // Get active connection object
  const getActiveConnection = useCallback(() => {
    if (!activeConnectionId) return null;
    return connections.find((conn) => conn.id === activeConnectionId) || null;
  }, [activeConnectionId, connections]);

  return {
    connections,
    activeConnectionId,
    activeConnection: getActiveConnection(),
    loading,
    error,
    addConnection,
    updateConnection,
    deleteConnection,
    setActiveConnection,
    loadConnections,
    clearError: () => setError(null)
  };
}

