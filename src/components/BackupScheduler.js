'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiClock, FiDatabase, FiHardDrive, FiToggleLeft, FiToggleRight, FiPlay, FiRefreshCw } from 'react-icons/fi';
import BackupScheduleForm from './BackupScheduleForm';
import BackupLogsView from './BackupLogsView';
import GoogleDriveAuth from './GoogleDriveAuth';

export default function BackupScheduler() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [activeView, setActiveView] = useState('schedules'); // 'schedules' or 'logs'

  const loadSchedules = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/backup-schedules', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setSchedules(result.schedules || []);
      } else {
        setError(result.error || 'Failed to load schedules');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedules();
    // Refresh schedules every 30 seconds to get updated status
    const interval = setInterval(loadSchedules, 30000);
    return () => clearInterval(interval);
  }, [loadSchedules]);

  const handleAdd = () => {
    setEditingSchedule(null);
    setShowForm(true);
  };

  const handleEdit = (schedule) => {
    setEditingSchedule(schedule);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this backup schedule?')) {
      return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/backup-schedules/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        await loadSchedules();
      } else {
        setError(result.error || 'Failed to delete schedule');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  const handleToggle = async (id, currentEnabled) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch(`/api/backup-schedules/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        await loadSchedules();
      } else {
        setError(result.error || 'Failed to toggle schedule');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  const handleExecute = async (id) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    if (!confirm('Execute this backup now?')) {
      return;
    }

    try {
      const response = await fetch('/api/backup/execute', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scheduleId: id }),
      });

      const result = await response.json();
      if (result.success) {
        alert('Backup started! Check the logs tab to see progress.');
        await loadSchedules();
      } else {
        setError(result.error || 'Failed to execute backup');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  const formatDays = (days) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(d => dayNames[d]).join(', ');
  };

  const formatTime = (time) => {
    // Ensure time is in 24-hour format (HH:MM)
    if (!time) return '';
    // If time is already in HH:MM format, return as is
    if (/^\d{2}:\d{2}$/.test(time)) {
      return time;
    }
    // If time is in HH:MM:SS format, remove seconds
    if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
      return time.substring(0, 5);
    }
    // Try to parse and format if it's in a different format
    try {
      const [hours, minutes] = time.split(':');
      return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    } catch {
      return time;
    }
  };

  const formatNextRun = (nextRun) => {
    if (!nextRun) return 'N/A';
    const date = new Date(nextRun);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) return 'Overdue';
    if (diff < 60000) return 'In less than a minute';
    
    // Calculate hours and minutes
    const totalMinutes = Math.floor(diff / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    // Format based on time remaining
    if (hours === 0) {
      return `In ${minutes}min`;
    } else if (hours < 24) {
      if (minutes === 0) {
        return `In ${hours}hr`;
      } else {
        return `In ${hours}hr ${minutes}min`;
      }
    } else {
      // More than 24 hours - show date and time
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (days === 1) {
        return `In 1 day${remainingHours > 0 ? ` ${remainingHours}hr` : ''}${minutes > 0 ? ` ${minutes}min` : ''}`;
      } else {
        return date.toLocaleString();
      }
    }
  };

  if (showForm) {
    return (
      <BackupScheduleForm
        schedule={editingSchedule}
        onSave={async () => {
          setShowForm(false);
          setEditingSchedule(null);
          await loadSchedules();
        }}
        onCancel={() => {
          setShowForm(false);
          setEditingSchedule(null);
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with tabs */}
      <div className="border-b border-border bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('schedules')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeView === 'schedules'
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <FiClock className="inline mr-2" size={16} />
              Schedules
            </button>
            <button
              onClick={() => setActiveView('logs')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeView === 'logs'
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <FiHardDrive className="inline mr-2" size={16} />
              Logs
            </button>
          </div>
          <div className="flex items-center gap-2">
            <GoogleDriveAuth onConnect={loadSchedules} />
            {activeView === 'schedules' && (
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <FiPlus size={16} />
                Add Schedule
              </button>
            )}
            <button
              onClick={loadSchedules}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              title="Refresh"
            >
              <FiRefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {activeView === 'schedules' ? (
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <FiRefreshCw className="inline animate-spin mr-2" size={20} />
                Loading schedules...
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-12">
                <FiClock size={48} className="mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Backup Schedules</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a schedule to automatically backup your databases
                </p>
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <FiPlus className="inline mr-2" size={16} />
                  Create Schedule
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="border border-border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FiDatabase size={18} className="text-primary" />
                          <h3 className="font-semibold text-foreground">
                            {schedule.connectionName} / {schedule.databaseName}
                          </h3>
                          <button
                            onClick={() => handleToggle(schedule.id, schedule.enabled)}
                            className="ml-2"
                            title={schedule.enabled ? 'Disable' : 'Enable'}
                          >
                            {schedule.enabled ? (
                              <FiToggleRight size={24} className="text-green-600 dark:text-green-400" />
                            ) : (
                              <FiToggleLeft size={24} className="text-red-600 dark:text-red-400" />
                            )}
                          </button>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1 ml-7">
                          <p>
                            <span className="font-medium">Days:</span> {formatDays(schedule.schedule.days)}
                          </p>
                          <p>
                            <span className="font-medium">Times:</span> {schedule.schedule.times.map(formatTime).join(', ')}
                          </p>
                          <p>
                            <span className="font-medium">Collections:</span> {schedule.collections.length > 0 ? schedule.collections.join(', ') : 'All'}
                          </p>
                          <p>
                            <span className="font-medium">Retention:</span> Keep last {schedule.retentionDays} backup(s)
                          </p>
                          {schedule.lastRun && (
                            <p>
                              <span className="font-medium">Last Run:</span>{' '}
                              {new Date(schedule.lastRun.startedAt).toLocaleString()} -{' '}
                              <span className={schedule.lastRun.status === 'success' ? 'text-green-600' : schedule.lastRun.status === 'error' ? 'text-red-600' : 'text-yellow-600'}>
                                {schedule.lastRun.status}
                              </span>
                            </p>
                          )}
                          <p>
                            <span className="font-medium">Next Run:</span> {formatNextRun(schedule.nextRun)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleExecute(schedule.id)}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                          title="Execute Now"
                        >
                          <FiPlay size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(schedule)}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                          title="Edit"
                        >
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(schedule.id)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <BackupLogsView
            schedules={schedules}
            selectedScheduleId={selectedScheduleId}
            onSelectSchedule={setSelectedScheduleId}
          />
        )}
      </div>
    </div>
  );
}


