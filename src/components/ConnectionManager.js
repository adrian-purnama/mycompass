'use client';

import { useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiDatabase, FiChevronRight } from 'react-icons/fi';
import { useConnections } from '@/hooks/useConnections';
import ConnectionForm from './ConnectionForm';

export default function ConnectionManager({ masterPassword, onConnect }) {
  const {
    connections,
    activeConnectionId,
    addConnection,
    updateConnection,
    deleteConnection,
    setActiveConnection,
    error
  } = useConnections(masterPassword);

  const [showForm, setShowForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleAdd = () => {
    setEditingConnection(null);
    setShowForm(true);
  };

  const handleEdit = (connection) => {
    setEditingConnection(connection);
    setShowForm(true);
  };

  const handleSave = async (connectionData) => {
    try {
      if (connectionData.id) {
        const success = updateConnection(connectionData.id, connectionData);
        if (!success) {
          console.error('Failed to update connection');
          return;
        }
      } else {
        const success = addConnection(connectionData);
        if (!success) {
          console.error('Failed to add connection');
          return;
        }
      }
      setShowForm(false);
      setEditingConnection(null);
    } catch (error) {
      console.error('Error saving connection:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this connection?')) {
      return;
    }
    setDeletingId(id);
    deleteConnection(id);
    setDeletingId(null);
  };

  const handleConnect = (connection) => {
    setActiveConnection(connection.id);
    if (onConnect) {
      onConnect(connection);
    }
  };

  if (showForm) {
    return (
      <ConnectionForm
        connection={editingConnection}
        onSave={handleSave}
        onCancel={() => {
          setShowForm(false);
          setEditingConnection(null);
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Connections</h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
        >
          <FiPlus size={16} />
          Add
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {connections.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
            <FiDatabase size={48} className="mx-auto mb-4 opacity-50" />
            <p>No connections saved</p>
            <p className="text-sm mt-2">Click "Add" to create your first connection</p>
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className={`p-3 border rounded-lg transition-colors ${
                  activeConnectionId === connection.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FiDatabase
                        className={`flex-shrink-0 ${
                          activeConnectionId === connection.id
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      />
                      <h3 className="font-medium text-black dark:text-zinc-50 truncate">
                        {connection.displayName}
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate font-mono">
                      {connection.connectionString.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}
                    </p>
                    {connection.lastUsed && (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                        Last used: {new Date(connection.lastUsed).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => handleConnect(connection)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      activeConnectionId === connection.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-zinc-50 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {activeConnectionId === connection.id ? (
                      <>
                        <FiChevronRight size={16} />
                        Connected
                      </>
                    ) : (
                      'Connect'
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(connection)}
                    className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                    title="Edit"
                  >
                    <FiEdit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(connection.id)}
                    disabled={deletingId === connection.id}
                    className="p-1.5 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

