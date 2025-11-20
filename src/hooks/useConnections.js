'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getConnections,
  addConnection as addConnectionStorage,
  updateConnection as updateConnectionStorage,
  deleteConnection as deleteConnectionStorage,
  getActiveConnectionId,
  setActiveConnectionId,
  updateLastUsed
} from '@/lib/storage';

export function useConnections(masterPassword) {
  const [connections, setConnections] = useState([]);
  const [activeConnectionId, setActiveConnectionIdState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadingRef = useRef(false);
  const masterPasswordRef = useRef(masterPassword);

  // Update ref when masterPassword changes
  useEffect(() => {
    masterPasswordRef.current = masterPassword;
  }, [masterPassword]);

  // Load connections from storage
  const loadConnections = useCallback(() => {
    // Prevent concurrent calls
    if (loadingRef.current) {
      return;
    }

    const currentPassword = masterPasswordRef.current;
    if (!currentPassword) {
      setConnections([]);
      return;
    }

    loadingRef.current = true;
    try {
      const loaded = getConnections(currentPassword);
      setConnections(loaded);
      const activeId = getActiveConnectionId();
      setActiveConnectionIdState(activeId);
      setError(null); // Clear errors on success
    } catch (error) {
      console.error('Failed to load connections:', error);
      // Set a more user-friendly error message
      if (error.message.includes('Incorrect master password') || error.message.includes('cannot decrypt')) {
        setError('The password cannot decrypt your saved connections. This usually means the connections were encrypted with a different password. You may need to reset your password and re-add your connections.');
      } else {
        setError('Failed to load connections: ' + error.message);
      }
      setConnections([]); // Clear connections on error
      setActiveConnectionIdState(null); // Clear active connection
    } finally {
      loadingRef.current = false;
    }
  }, []); // Empty deps - we use refs to access current values

  useEffect(() => {
    if (masterPassword) {
      // Load connections when masterPassword changes
      // Use setTimeout to ensure it runs after render
      const timeoutId = setTimeout(() => {
        loadConnections();
      }, 0);
      return () => clearTimeout(timeoutId);
    } else {
      setConnections([]);
      setError(null);
      setActiveConnectionIdState(null);
    }
    // loadConnections is stable (empty deps), so we can safely include it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterPassword]);

  // Add a new connection
  const addConnection = useCallback(
    (connection) => {
      if (!masterPassword) {
        setError('Master password required');
        return false;
      }

      try {
        addConnectionStorage(connection, masterPassword);
        loadConnections();
        return true;
      } catch (error) {
        setError('Failed to add connection: ' + error.message);
        console.error(error);
        return false;
      }
    },
    [masterPassword, loadConnections]
  );

  // Update an existing connection
  const updateConnection = useCallback(
    (id, updates) => {
      if (!masterPassword) {
        setError('Master password required');
        return false;
      }

      try {
        const success = updateConnectionStorage(id, updates, masterPassword);
        if (success) {
          loadConnections();
        }
        return success;
      } catch (error) {
        setError('Failed to update connection: ' + error.message);
        console.error(error);
        return false;
      }
    },
    [masterPassword, loadConnections]
  );

  // Set active connection
  const setActiveConnection = useCallback(
    (id) => {
      setActiveConnectionId(id);
      setActiveConnectionIdState(id);
      if (id && masterPassword) {
        updateLastUsed(id, masterPassword);
        loadConnections();
      }
    },
    [masterPassword, loadConnections]
  );

  // Delete a connection
  const deleteConnection = useCallback(
    (id) => {
      if (!masterPassword) {
        setError('Master password required');
        return false;
      }

      try {
        const success = deleteConnectionStorage(id, masterPassword);
        if (success) {
          loadConnections();
          // If deleted connection was active, clear active connection
          if (activeConnectionId === id) {
            setActiveConnection(null);
          }
        }
        return success;
      } catch (error) {
        setError('Failed to delete connection: ' + error.message);
        console.error(error);
        return false;
      }
    },
    [masterPassword, loadConnections, activeConnectionId, setActiveConnection]
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

