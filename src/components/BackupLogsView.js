'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiRefreshCw, FiCheckCircle, FiXCircle, FiClock, FiTrash2, FiExternalLink } from 'react-icons/fi';

export default function BackupLogsView({ schedules, selectedScheduleId, onSelectSchedule }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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

  const handleDelete = async (logId, filePath) => {
    if (!confirm('Delete this backup log and file?')) {
      return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/backup-logs/${logId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        await loadLogs();
      } else {
        alert(result.error || 'Failed to delete log');
      }
    } catch (error) {
      alert(error.message || 'Failed to delete log');
    }
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
      default:
        return <FiClock size={18} className="text-gray-400" />;
    }
  };

  const getScheduleName = (scheduleId) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    return schedule ? `${schedule.databaseName}` : scheduleId;
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
                  {s.databaseName}
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
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        <span className="text-xs font-medium capitalize">{log.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {getScheduleName(log.scheduleId)}
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
                        {log.filePath && log.status === 'success' && (
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
                        <button
                          onClick={() => handleDelete(log.id, log.filePath)}
                          className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                          title="Delete"
                        >
                          <FiTrash2 size={14} />
                        </button>
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
    </div>
  );
}


