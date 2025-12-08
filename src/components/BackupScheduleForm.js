'use client';

import { useState, useEffect } from 'react';
import { FiX, FiPlus, FiTrash2, FiDatabase, FiClock, FiHardDrive } from 'react-icons/fi';
import { useConnections } from '@/hooks/useConnections';

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function BackupScheduleForm({ schedule, onSave, onCancel }) {
  const { connections } = useConnections();
  const [connectionId, setConnectionId] = useState('');
  const [databaseName, setDatabaseName] = useState('');
  const [databases, setDatabases] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [selectedDays, setSelectedDays] = useState([]);
  const [times, setTimes] = useState(['14:00']); // Default 2 PM
  const [retentionDays, setRetentionDays] = useState(7);
  const [backupPassword, setBackupPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [googleDriveConnected, setGoogleDriveConnected] = useState(false);

  useEffect(() => {
    checkGoogleDriveStatus();
    if (schedule) {
      // Edit mode - populate form
      setConnectionId(schedule.connectionId);
      setDatabaseName(schedule.databaseName);
      setSelectedCollections(schedule.collections || []);
      setSelectedDays(schedule.schedule.days || []);
      setTimes(schedule.schedule.times || ['14:00']);
      setRetentionDays(schedule.retentionDays || 7);
      setBackupPassword(''); // Clear password - user must re-enter for security
    } else {
      // New schedule - clear password
      setBackupPassword('');
    }
  }, [schedule]);

  useEffect(() => {
    if (connectionId) {
      loadDatabases();
    } else {
      setDatabases([]);
      setDatabaseName('');
      setCollections([]);
      setSelectedCollections([]);
    }
  }, [connectionId]);

  useEffect(() => {
    if (connectionId && databaseName) {
      loadCollections();
    } else {
      setCollections([]);
      setSelectedCollections([]);
    }
  }, [connectionId, databaseName]);

  const checkGoogleDriveStatus = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const response = await fetch('/api/google-drive/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setGoogleDriveConnected(result.connected);
      }
    } catch (error) {
      console.error('Failed to check Google Drive status:', error);
    }
  };

  const loadDatabases = async () => {
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return;

    setLoading(true);
    try {
      const response = await fetch('/api/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString: connection.connectionString,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setDatabases(result.databases || []);
      }
    } catch (error) {
      console.error('Failed to load databases:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCollections = async () => {
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return;

    setLoading(true);
    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString: connection.connectionString,
          databaseName,
          includeCounts: true,
        }),
      });

      const result = await response.json();
      if (result.success) {
        const allCollections = result.collections || [];
        const filtered = allCollections.filter(c => !c.name.startsWith('system.'));
        setCollections(filtered);
        if (selectedCollections.length === 0) {
          // Auto-select all if none selected
          setSelectedCollections(filtered.map(c => c.name));
        }
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (dayValue) => {
    setSelectedDays(prev =>
      prev.includes(dayValue)
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue]
    );
  };

  const addTime = () => {
    setTimes(prev => [...prev, '14:00']);
  };

  const removeTime = (index) => {
    setTimes(prev => prev.filter((_, i) => i !== index));
  };

  const updateTime = (index, value) => {
    setTimes(prev => {
      const newTimes = [...prev];
      newTimes[index] = value;
      return newTimes;
    });
  };

  const toggleCollection = (collectionName) => {
    setSelectedCollections(prev =>
      prev.includes(collectionName)
        ? prev.filter(c => c !== collectionName)
        : [...prev, collectionName]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!connectionId || !databaseName) {
      setError('Please select a connection and database');
      return;
    }

    if (selectedDays.length === 0) {
      setError('Please select at least one day');
      return;
    }

    if (times.length === 0 || times.some(t => !t)) {
      setError('Please specify at least one time');
      return;
    }

    if (!backupPassword || backupPassword.trim() === '') {
      setError('Backup password is required');
      return;
    }

    if (!googleDriveConnected) {
      setError('Please connect Google Drive first');
      return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    try {
      const scheduleData = {
        connectionId,
        databaseName,
        collections: selectedCollections,
        destination: {
          type: 'google_drive',
          config: {},
        },
        schedule: {
          days: selectedDays,
          times: times.filter(t => t), // Remove empty times
          timezone: 'UTC',
        },
        retentionDays,
        password: backupPassword.trim(),
      };

      const url = schedule
        ? `/api/backup-schedules/${schedule.id}`
        : '/api/backup-schedules';
      const method = schedule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scheduleData),
      });

      const result = await response.json();
      if (result.success) {
        onSave();
      } else {
        setError(result.error || 'Failed to save schedule');
      }
    } catch (error) {
      setError(error.message || 'Failed to save schedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-auto">
      <div className="border-b border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            {schedule ? 'Edit Backup Schedule' : 'Create Backup Schedule'}
          </h2>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            <FiX size={24} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-6">
        {/* Google Drive Status */}
        <div className={`p-4 rounded-lg border-2 ${
          googleDriveConnected
            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
        }`}>
          <div className="flex items-center gap-2">
            <FiHardDrive size={20} className={googleDriveConnected ? 'text-green-600' : 'text-yellow-600'} />
            <span className={`font-medium ${
              googleDriveConnected ? 'text-green-800 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'
            }`}>
              {googleDriveConnected
                ? 'Google Drive Connected'
                : 'Google Drive Not Connected - Please connect in the Scheduler tab'}
            </span>
          </div>
        </div>

        {/* Connection Selection */}
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">
            Connection <span className="text-red-500">*</span>
          </label>
          <select
            value={connectionId}
            onChange={(e) => setConnectionId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
            disabled={!!schedule}
          >
            <option value="">Select a connection</option>
            {connections.map(conn => (
              <option key={conn.id} value={conn.id}>
                {conn.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Database Selection */}
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">
            Database <span className="text-red-500">*</span>
          </label>
          {loading ? (
            <div className="w-full px-3 py-2 border border-border rounded-md bg-muted text-muted-foreground">
              Loading databases...
            </div>
          ) : (
            <select
              value={databaseName}
              onChange={(e) => setDatabaseName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
              disabled={!connectionId || !!schedule}
            >
              <option value="">Select a database</option>
              {databases.map(db => (
                <option key={db} value={db}>
                  {db}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Collections Selection */}
        {databaseName && (
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              Collections (leave empty for all)
            </label>
            <div className="max-h-48 overflow-y-auto border border-border rounded-md p-2 bg-muted/30">
              {collections.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {loading ? 'Loading...' : 'No collections found'}
                </p>
              ) : (
                collections.map(coll => (
                  <label
                    key={coll.name}
                    className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCollections.includes(coll.name)}
                      onChange={() => toggleCollection(coll.name)}
                      className="text-primary"
                    />
                    <span className="text-sm text-foreground flex-1">
                      {coll.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({coll.count?.toLocaleString() || 0} docs)
                    </span>
                  </label>
                ))
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedCollections.length > 0
                ? `${selectedCollections.length} collection(s) selected`
                : 'All collections will be backed up'}
            </p>
          </div>
        )}

        {/* Days Selection */}
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">
            Days of Week <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {DAYS.map(day => (
              <label
                key={day.value}
                className="flex items-center gap-2 p-2 border border-border rounded-md hover:bg-accent cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedDays.includes(day.value)}
                  onChange={() => toggleDay(day.value)}
                  className="text-primary"
                />
                <span className="text-sm text-foreground">{day.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Times Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-foreground">
              Backup Times (24-hour format) <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={addTime}
              className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded-md"
            >
              <FiPlus size={14} />
              Add Time
            </button>
          </div>
          <div className="space-y-2">
            {times.map((time, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => updateTime(index, e.target.value)}
                  className="px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                {times.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTime(index)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                  >
                    <FiTrash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Retention Days */}
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">
            Retention Period (days) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={retentionDays}
            onChange={(e) => setRetentionDays(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Backups older than this will be automatically deleted
          </p>
        </div>

        {/* Backup Password */}
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">
            Backup Password <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={backupPassword}
            onChange={(e) => setBackupPassword(e.target.value)}
            placeholder="Enter backup password"
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Required to authorize scheduled backup operations
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading || !googleDriveConnected}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : (schedule ? 'Update Schedule' : 'Create Schedule')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-border hover:bg-accent text-foreground rounded-md font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}


