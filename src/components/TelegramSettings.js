'use client';

import { useState, useEffect } from 'react';
import { FiMessageCircle, FiCheckCircle, FiAlertCircle, FiX, FiSettings } from 'react-icons/fi';

export default function TelegramSettings({ organizationId }) {
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (organizationId) {
      loadSettings();
    }
  }, [organizationId]);

  const loadSettings = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token || !organizationId) {
      setChecking(false);
      return;
    }

    setChecking(true);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/telegram`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setBotToken(result.telegramBotToken || '');
        setChatId(result.telegramChatId || '');
      }
    } catch (error) {
      console.error('Failed to load Telegram settings:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleTest = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      setTestResult({ success: false, error: 'Please enter both bot token and chat ID' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botToken: botToken.trim(),
          chatId: chatId.trim(),
        }),
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, error: error.message || 'Failed to test Telegram notification' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!organizationId) return;

    setSaving(true);
    setTestResult(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/organizations/${organizationId}/telegram`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegramBotToken: botToken.trim() || null,
          telegramChatId: chatId.trim() || null,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setShowSettings(false);
        // Clear test result after successful save
        setTestResult(null);
      } else {
        setTestResult({ success: false, error: result.error || 'Failed to save settings' });
      }
    } catch (error) {
      setTestResult({ success: false, error: error.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setBotToken('');
    setChatId('');
    setTestResult(null);
  };

  if (checking) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <FiMessageCircle size={16} />
        Loading...
      </div>
    );
  }

  const isConfigured = botToken.trim() && chatId.trim();

  return (
    <div className="flex items-center gap-2">
      {isConfigured && !showSettings ? (
        <>
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-sm">
            <FiCheckCircle size={16} className="text-green-600 dark:text-green-400" />
            <span className="text-green-700 dark:text-green-300">Telegram Configured</span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          >
            <FiSettings size={16} />
          </button>
        </>
      ) : (
        <>
          {showSettings ? (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
              <div 
                className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4 bg-white"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <FiMessageCircle size={20} className="text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">Telegram Notifications</h3>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <FiX size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Configure Telegram notifications to receive alerts when any backup completes.
                  </p>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      Telegram Bot Token
                    </label>
                    <input
                      type="text"
                      value={botToken}
                      onChange={(e) => {
                        setBotToken(e.target.value);
                        setTestResult(null);
                      }}
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Get your bot token from <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@BotFather</a> on Telegram
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      Telegram Chat ID
                    </label>
                    <input
                      type="text"
                      value={chatId}
                      onChange={(e) => {
                        setChatId(e.target.value);
                        setTestResult(null);
                      }}
                      placeholder="123456789"
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Your Telegram user ID or group chat ID. Send a message to <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@userinfobot</a> to get your ID
                    </p>
                  </div>

                  {/* Test Button */}
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing || !botToken.trim() || !chatId.trim()}
                    className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {testing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending test message...
                      </>
                    ) : (
                      <>
                        <FiMessageCircle size={16} />
                        Send Test Message
                      </>
                    )}
                  </button>

                  {/* Test Result */}
                  {testResult && (
                    <div className={`p-3 rounded-lg border flex items-start gap-2 ${
                      testResult.success
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                    }`}>
                      {testResult.success ? (
                        <FiCheckCircle size={18} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      ) : (
                        <FiAlertCircle size={18} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          testResult.success
                            ? 'text-green-800 dark:text-green-200'
                            : 'text-red-800 dark:text-red-200'
                        }`}>
                          {testResult.success
                            ? testResult.message || 'Test message sent successfully! Check your Telegram.'
                            : testResult.error || 'Failed to send test message'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={handleClear}
                      disabled={saving}
                      className="px-4 py-2 border border-border hover:bg-accent text-foreground rounded-md font-medium transition-colors disabled:opacity-50"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSettings(false)}
                      disabled={saving}
                      className="px-4 py-2 border border-border hover:bg-accent text-foreground rounded-md font-medium transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowSettings(true)}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <FiMessageCircle size={16} />
              {loading ? 'Loading...' : 'Configure Telegram'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

