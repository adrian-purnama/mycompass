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

  // Helper to normalize time to 24-hour format (HH:MM)
  const normalizeTime = (time) => {
    if (!time) return '14:00';
    // If already in HH:MM format, return as is
    if (/^\d{2}:\d{2}$/.test(time)) {
      return time;
    }
    // If in HH:MM:SS format, remove seconds
    if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
      return time.substring(0, 5);
    }
    // Try to parse and format
    try {
      const parts = time.split(':');
      const hours = parts[0].padStart(2, '0');
      const minutes = (parts[1] || '00').padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '14:00';
    }
  };

  useEffect(() => {
    checkGoogleDriveStatus();
    if (schedule) {
      // Edit mode - populate form
      setConnectionId(schedule.connectionId);
      setSelectedCollections(schedule.collections || []);
      setSelectedDays(schedule.schedule.days || []);
      // Normalize times to 24-hour format
      const normalizedTimes = (schedule.schedule.times || ['14:00']).map(normalizeTime);
      setTimes(normalizedTimes);
      setRetentionDays(schedule.retentionDays || 7);
      setBackupPassword(''); // Clear password - user must re-enter for security
    } else {
      // New schedule - clear password
      setBackupPassword('');
      setDatabaseName('');
    }
  }, [schedule]);

  useEffect(() => {
    if (connectionId && connections.length > 0) {
      // Make sure connections are loaded before trying to load databases
      const connection = connections.find(c => c.id === connectionId);
      if (connection) {
        loadDatabases();
      }
    } else {
      setDatabases([]);
      // Only clear databaseName if we're not editing
      if (!schedule) {
        setDatabaseName('');
      }
      setCollections([]);
      setSelectedCollections([]);
    }
  }, [connectionId, connections]);

  // Set database name after databases are loaded (when editing)
  useEffect(() => {
    // Only run when we have a schedule, databases are loaded, and connection matches
    if (schedule?.databaseName && 
        databases.length > 0 && 
        connectionId === schedule.connectionId &&
        databases.includes(schedule.databaseName)) {
      // Set the database name from schedule
      setDatabaseName(schedule.databaseName);
    }
  }, [databases, schedule, connectionId]);

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
    if (!connectionId) return;
    
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) {
      console.warn('Connection not found:', connectionId);
      return;
    }

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
        const databasesList = result.databases || [];
        setDatabases(databasesList);
      } else {
        console.error('Failed to load databases:', result.error);
        setDatabases([]);
      }
    } catch (error) {
      console.error('Failed to load databases:', error);
      setDatabases([]);
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
    setTimes(prev => [...prev, '14:00']); // Default to 14:00 (2 PM) in 24-hour format
  };

  const removeTime = (index) => {
    setTimes(prev => prev.filter((_, i) => i !== index));
  };

  const updateTime = (index, value) => {
    setTimes(prev => {
      const newTimes = [...prev];
      // Ensure time is in HH:MM format (24-hour)
      newTimes[index] = normalizeTime(value);
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
              disabled={!connectionId}
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
              Backup Times (24-hour format, e.g., 21:00) <span className="text-red-500">*</span>
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
                  type="text"
                  value={time}
                  onChange={(e) => {
                    let value = e.target.value;
                    // Remove any non-digit characters except colon
                    value = value.replace(/[^\d:]/g, '');
                    
                    // Allow empty input
                    if (value.length === 0) {
                      setTimes(prev => {
                        const newTimes = [...prev];
                        newTimes[index] = '';
                        return newTimes;
                      });
                      return;
                    }
                    
                    // Detect if user is adding (typing) or deleting
                    const isAdding = value.length > time.length;
                    
                    // Only auto-insert colon when adding (typing), not when deleting
                    if (isAdding && value.length === 2 && !value.includes(':')) {
                      value = value + ':';
                    }
                    
                    // Limit to 5 characters max (HH:MM format)
                    if (value.length <= 5) {
                      // Only do minimal formatting while typing - no validation
                      if (value.includes(':')) {
                        const parts = value.split(':');
                        let hours = parts[0] || '';
                        let minutes = parts[1] || '';
                        
                        // Only limit length - no value validation while typing
                        if (hours.length > 2) {
                          hours = hours.slice(0, 2);
                        }
                        if (minutes.length > 2) {
                          minutes = minutes.slice(0, 2);
                        }
                        
                        // Reconstruct preserving the colon
                        value = hours + ':' + minutes;
                      }
                      
                      // Update state - allow any partial input
                      setTimes(prev => {
                        const newTimes = [...prev];
                        newTimes[index] = value;
                        return newTimes;
                      });
                    }
                  }}
                  onBlur={(e) => {
                    // Only normalize and validate on blur
                    const normalized = normalizeTime(e.target.value);
                    setTimes(prev => {
                      const newTimes = [...prev];
                      newTimes[index] = normalized;
                      return newTimes;
                    });
                  }}
                  placeholder="21:00"
                  pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]"
                  className="px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
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
          <p className="mt-1 text-xs text-muted-foreground">
            Times are in 24-hour format (00:00 to 23:59)
          </p>
        </div>

        {/* Retention Count */}
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">
            Retention Period (number of backups) <span className="text-red-500">*</span>
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
            Number of backups to keep. When a new backup is created, older backups beyond this count will be automatically deleted. (e.g., 3 = keep only the last 3 backups)
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


