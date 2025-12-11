'use client';

import { useState, useEffect, useCallback } from 'react';
import { isAuthenticated, setAuthTokenStorage, clearAuthToken } from '@/lib/storage';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/session', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const result = await response.json();

      if (result.success) {
        setUser(result.user);
      } else {
        clearAuthToken();
        setUser(null);
      }
    } catch (error) {
      console.error('Session check error:', error);
      clearAuthToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Login failed');
      }

      setAuthTokenStorage(result.token);
      setUser(result.user);
      return result.user;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }, []);

  const register = useCallback(async (email, username, password) => {
    setError(null);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username: username || null, password })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Registration failed');
      }

      // Don't auto-login - user needs to verify email first
      return { message: result.message || 'Registration successful. Please check your email to verify your account.' };
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch('/api/auth/session', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuthToken();
      setUser(null);
    }
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    checkSession
  };
}


