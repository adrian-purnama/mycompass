'use client';

import { useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiDatabase, FiChevronRight } from 'react-icons/fi';
import { useConnections } from '@/hooks/useConnections';
import ConnectionForm from './ConnectionForm';

export default function ConnectionManager({ onConnect }) {
  const {
    connections,
    activeConnectionId,
    addConnection,
    updateConnection,
    deleteConnection,
    setActiveConnection,
    error
  } = useConnections();

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
        await updateConnection(connectionData.id, connectionData);
      } else {
        await addConnection(connectionData);
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
    try {
      await deleteConnection(id);
    } catch (error) {
      console.error('Error deleting connection:', error);
    } finally {
      setDeletingId(null);
    }
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
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saved Connections</h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-2 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs font-medium transition-colors"
        >
          <FiPlus size={12} />
          Add
        </button>
      </div>

      {error && (
        <div className="mx-3 mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {connections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FiDatabase size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No connections</p>
            <p className="text-xs mt-1">Add a connection to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className={`group p-3 border rounded-lg transition-all ${
                  activeConnectionId === connection.id
                    ? 'border-primary/50 bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`p-1.5 rounded-md ${activeConnectionId === connection.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        <FiDatabase size={14} />
                      </div>
                      <h3 className="font-medium text-sm text-foreground truncate">
                        {connection.displayName}
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-mono pl-8">
                      {connection.connectionString.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-8">
                  <button
                    onClick={() => handleConnect(connection)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeConnectionId === connection.id
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {activeConnectionId === connection.id ? (
                      <>
                        <FiChevronRight size={12} />
                        Connected
                      </>
                    ) : (
                      'Connect'
                    )}
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => handleEdit(connection)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                        title="Edit"
                    >
                        <FiEdit2 size={12} />
                    </button>
                    <button
                        onClick={() => handleDelete(connection.id)}
                        disabled={deletingId === connection.id}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50"
                        title="Delete"
                    >
                        <FiTrash2 size={12} />
                    </button>
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
