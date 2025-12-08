'use client';

import { useState, useEffect } from 'react';
import { FiCloud, FiCheckCircle, FiXCircle } from 'react-icons/fi';

export default function GoogleDriveAuth({ onConnect }) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setChecking(false);
      return;
    }

    try {
      const response = await fetch('/api/google-drive/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setConnected(result.connected);
      }
    } catch (error) {
      console.error('Failed to check Google Drive status:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleConnect = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch('/api/google-drive/auth', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        // Open OAuth URL in new window
        window.open(result.authUrl, 'google-drive-auth', 'width=500,height=600');
        
        // Poll for connection status (user will be redirected back)
        const pollInterval = setInterval(async () => {
          await checkStatus();
          if (connected) {
            clearInterval(pollInterval);
            setLoading(false);
            if (onConnect) onConnect();
          }
        }, 2000);

        // Stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setLoading(false);
        }, 300000);
      } else {
        alert(result.error || 'Failed to get authorization URL');
        setLoading(false);
      }
    } catch (error) {
      alert(error.message || 'Failed to connect Google Drive');
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Drive? This will prevent scheduled backups from running.')) {
      return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch('/api/google-drive/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setConnected(false);
      } else {
        alert(result.error || 'Failed to disconnect Google Drive');
      }
    } catch (error) {
      alert(error.message || 'Failed to disconnect Google Drive');
    } finally {
      setLoading(false);
    }
  };

  // Check for OAuth callback in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('google_drive_connected') === 'true') {
      checkStatus();
      if (onConnect) onConnect();
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  if (checking) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <FiCloud size={16} />
        Checking...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {connected ? (
        <>
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-sm">
            <FiCheckCircle size={16} className="text-green-600 dark:text-green-400" />
            <span className="text-green-700 dark:text-green-300">Google Drive Connected</span>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors disabled:opacity-50"
          >
            Disconnect
          </button>
        </>
      ) : (
        <button
          onClick={handleConnect}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <FiCloud size={16} />
          {loading ? 'Connecting...' : 'Connect Google Drive'}
        </button>
      )}
    </div>
  );
}


