'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { FiCheckCircle, FiAlertCircle, FiX, FiUsers, FiMail } from 'react-icons/fi';

function InvitePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided');
      setLoading(false);
      return;
    }

    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`/api/organizations/invitations/${token}`);
      const result = await response.json();

      if (result.success) {
        setInvitation(result.invitation);
      } else {
        setError(result.error || 'Invalid invitation');
      }
    } catch (error) {
      setError(error.message || 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token) return;
    
    if (!isAuthenticated) {
      // Redirect to login, then back here
      localStorage.setItem('invite_token', token);
      router.push('/?login=true');
      return;
    }

    setAccepting(true);
    try {
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch(`/api/organizations/invitations/${token}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        // Redirect to main app
        router.push('/');
      } else {
        setError(result.error || 'Failed to accept invitation');
      }
    } catch (error) {
      setError(error.message || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card border border-border rounded-lg shadow-xl p-6 w-full max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <FiAlertCircle size={24} className="text-destructive" />
            <h1 className="text-2xl font-semibold text-foreground">Invalid Invitation</h1>
          </div>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FiUsers size={24} className="text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">Organization Invitation</h1>
          </div>
          <button
            onClick={() => router.push('/')}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">You've been invited to join</p>
            <p className="text-lg font-semibold text-foreground">{invitation.organizationName}</p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <FiMail size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Invited by:</span>
              <span className="text-foreground">{invitation.invitedBy}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiMail size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Email:</span>
              <span className="text-foreground">{invitation.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiAlertCircle size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Expires:</span>
              <span className="text-foreground">{new Date(invitation.expiresAt).toLocaleDateString()}</span>
            </div>
          </div>

          {!isAuthenticated ? (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-200 mb-3">
                You need to be logged in to accept this invitation.
              </p>
              <button
                onClick={handleAccept}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
              >
                Login to Accept
              </button>
            </div>
          ) : user.email.toLowerCase() !== invitation.email.toLowerCase() ? (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-900 dark:text-yellow-200">
                This invitation was sent to <strong>{invitation.email}</strong>, but you're logged in as <strong>{user.email}</strong>. 
                Please log in with the correct account to accept this invitation.
              </p>
            </div>
          ) : (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <FiCheckCircle size={16} />
              {accepting ? 'Accepting...' : 'Accept Invitation'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <InvitePageContent />
    </Suspense>
  );
}
