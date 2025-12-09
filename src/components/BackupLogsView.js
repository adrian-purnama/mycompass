'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiRefreshCw, FiCheckCircle, FiXCircle, FiClock, FiTrash2, FiExternalLink, FiMinusCircle, FiX, FiAlertCircle } from 'react-icons/fi';

export default function BackupLogsView({ schedules, selectedScheduleId, onSelectSchedule }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [logToDelete, setLogToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState({
    scheduleId: selectedScheduleId || '',
    status: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  const loadLogs = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.scheduleId) params.append('scheduleId', filters.scheduleId);
      if (filters.status) params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`/api/backup-logs?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setLogs(result.logs || []);
        setPagination(result.pagination || pagination);
      } else {
        setError(result.error || 'Failed to load logs');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (selectedScheduleId) {
      setFilters(prev => ({ ...prev, scheduleId: selectedScheduleId }));
    }
  }, [selectedScheduleId]);

  const handleDelete = (log) => {
    setLogToDelete(log);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!logToDelete) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/backup-logs/${logToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setShowDeleteModal(false);
        setLogToDelete(null);
        await loadLogs();
      } else {
        setError(result.error || 'Failed to delete log');
      }
    } catch (error) {
      setError(error.message || 'Failed to delete log');
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setLogToDelete(null);
    setError(null);
  };

  const formatDuration = (ms) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <FiCheckCircle size={18} className="text-green-600" />;
      case 'error':
        return <FiXCircle size={18} className="text-red-600" />;
      case 'running':
        return <FiClock size={18} className="text-blue-600 animate-spin" />;
      case 'deleted':
        return <FiMinusCircle size={18} className="text-orange-600" />;
      default:
        return <FiClock size={18} className="text-gray-400" />;
    }
  };

  const getScheduleName = (log) => {
    // Use connection name and database name from log if available
    if (log.connectionName && log.databaseName) {
      return `${log.connectionName} / ${log.databaseName}`;
    }
    // Fallback to schedule lookup
    const schedule = schedules.find(s => s.id === log.scheduleId);
    if (schedule) {
      return schedule.connectionName ? `${schedule.connectionName} / ${schedule.databaseName}` : schedule.databaseName;
    }
    return log.scheduleId;
  };

  return (
    <div className="h-full flex flex-col p-4">
      {/* Filters */}
      <div className="mb-4 p-4 bg-card border border-border rounded-lg space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              Schedule
            </label>
            <select
              value={filters.scheduleId}
              onChange={(e) => setFilters(prev => ({ ...prev, scheduleId: e.target.value, page: 1 }))}
              className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background text-foreground"
            >
              <option value="">All Schedules</option>
              {schedules.map(s => (
                <option key={s.id} value={s.id}>
                  {s.connectionName ? `${s.connectionName} / ${s.databaseName}` : s.databaseName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
              className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background text-foreground"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="running">Running</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value, page: 1 }))}
              className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value, page: 1 }))}
              className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background text-foreground"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setFilters({ scheduleId: '', status: '', startDate: '', endDate: '' });
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear Filters
          </button>
          <button
            onClick={loadLogs}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md"
          >
            <FiRefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Logs Table */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          <FiRefreshCw className="inline animate-spin mr-2" size={20} />
          Loading logs...
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <FiClock size={48} className="mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Backup Logs</h3>
          <p className="text-sm text-muted-foreground">
            Backup logs will appear here after scheduled backups run
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border">Status</th>
                  <th className="px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border">Schedule</th>
                  <th className="px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border">Started</th>
                  <th className="px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border">Duration</th>
                  <th className="px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border">Collections</th>
                  <th className="px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border">Size</th>
                  <th className="px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-accent/50 border-b border-border">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <span className="text-xs font-medium capitalize">{log.status}</span>
                        </div>
                        {log.status === 'deleted' && log.deletedReason && (
                          <span className="text-xs text-muted-foreground italic">{log.deletedReason}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {getScheduleName(log)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {new Date(log.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDuration(log.duration)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {log.collectionsBackedUp?.length || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatFileSize(log.fileSize)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {log.filePath && log.status === 'success' && !log.deletedAt && (
                          <a
                            href={`https://drive.google.com/file/d/${log.filePath}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                            title="Open in Google Drive"
                          >
                            <FiExternalLink size={14} />
                          </a>
                        )}
                        {log.status !== 'deleted' && (
                          <button
                            onClick={() => handleDelete(log)}
                            className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                            title="Delete"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 text-xs border border-border rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 text-xs border border-border rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && logToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <FiTrash2 size={24} className="text-red-600 dark:text-red-400" />
                <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
                  Delete Backup
                </h2>
              </div>
              <button
                onClick={cancelDelete}
                disabled={deleting}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg">
              <div className="flex items-start gap-3">
                <FiAlertCircle size={20} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
                    Delete Backup File
                  </p>
                  <p className="text-xs text-red-800 dark:text-red-300">
                    This will delete the backup file from Google Drive. The log entry will remain with a "deleted" status for record keeping.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold">Schedule:</span> {getScheduleName(logToDelete)}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                <span className="font-semibold">Started:</span> {new Date(logToDelete.startedAt).toLocaleString()}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                <span className="font-semibold">Status:</span> {logToDelete.status}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <FiRefreshCw className="animate-spin" size={16} />
                    Deleting...
                  </>
                ) : (
                  <>
                    <FiTrash2 size={16} />
                    Delete File
                  </>
                )}
              </button>
              <button
                onClick={cancelDelete}
                disabled={deleting}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


