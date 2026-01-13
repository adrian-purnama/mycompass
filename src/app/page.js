'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FiDatabase, FiCode, FiCopy, FiDownload, FiChevronLeft, FiChevronRight, FiHardDrive, FiSettings, FiPlus, FiLogOut, FiUser, FiUsers } from 'react-icons/fi';
import { useConnections } from '@/hooks/useConnections';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from '@/components/AuthModal';
import ConnectionManager from '@/components/ConnectionManager';
import DatabaseTree from '@/components/DatabaseTree';
import DocumentViewer from '@/components/DocumentViewer';
import QueryEditor from '@/components/QueryEditor';
import SQLEditor from '@/components/SQLEditor';
import CloneDialog from '@/components/CloneDialog';
import ExportDialog from '@/components/ExportDialog';
import BackupProgressModal from '@/components/BackupProgressModal';
import BackupPasswordModal from '@/components/BackupPasswordModal';
import BackupSelectionModal from '@/components/BackupSelectionModal';
import BackupScheduler from '@/components/BackupScheduler';
import OrganizationManager from '@/components/OrganizationManager';
import EmailVerificationModal from '@/components/EmailVerificationModal';
import CreateOrganizationModal from '@/components/CreateOrganizationModal';
import OrganizationSelector from '@/components/OrganizationSelector';
import OrganizationSettingsWrapper from '@/components/OrganizationSettingsWrapper';
import InviteUserModal from '@/components/InviteUserModal';

export default function Home() {
  const { user, loading: authLoading, isAuthenticated, login, register, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(() => {
    // Load from localStorage on initial render
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedOrganizationId');
      return saved || null;
    }
    return null;
  });
  const [userRole, setUserRole] = useState(null);
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showOrgSettingsModal, setShowOrgSettingsModal] = useState(false);
  const [orgRefreshTrigger, setOrgRefreshTrigger] = useState(0);
  const [activeConnection, setActiveConnection] = useState(null);
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [activeTab, setActiveTab] = useState('documents'); // 'documents', 'query', 'sql', 'scheduler'
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [availableCollections, setAvailableCollections] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showBackupPasswordModal, setShowBackupPasswordModal] = useState(false);
  const [showBackupSelectionModal, setShowBackupSelectionModal] = useState(false);
  const [backupPassword, setBackupPassword] = useState(null);
  const [selectedBackupCollections, setSelectedBackupCollections] = useState([]);
  const [backupProgress, setBackupProgress] = useState({
    currentCollection: null,
    processedCollections: 0,
    totalCollections: 0,
    progress: 0,
    error: null,
    completedCollections: []
  });
  const loadingCollectionsRef = useRef(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(280); // Connection Manager width
  const [middleSidebarWidth, setMiddleSidebarWidth] = useState(240); // Database Tree width
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingMiddle, setIsResizingMiddle] = useState(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isMiddleCollapsed, setIsMiddleCollapsed] = useState(false);

  const { connections, loadConnections, loading: connectionsLoading } = useConnections(selectedOrganizationId);

  // Save selected organization to localStorage whenever it changes
  useEffect(() => {
    if (selectedOrganizationId) {
      localStorage.setItem('selectedOrganizationId', selectedOrganizationId);
    } else {
      localStorage.removeItem('selectedOrganizationId');
    }
  }, [selectedOrganizationId]);

  useEffect(() => {
    // Show auth modal if not authenticated (after loading)
    if (!authLoading && !isAuthenticated) {
      setShowAuthModal(true);
      // Clear saved organization when logged out
      localStorage.removeItem('selectedOrganizationId');
    }
    // Check email verification status
    if (!authLoading && isAuthenticated && user && !user.emailVerified) {
      setShowEmailVerificationModal(true);
    }
    // Check for invite token redirect after login
    if (!authLoading && isAuthenticated && user) {
      const inviteToken = localStorage.getItem('invite_token');
      if (inviteToken) {
        localStorage.removeItem('invite_token');
        window.location.href = `/invite?token=${inviteToken}`;
      }
    }
  }, [authLoading, isAuthenticated, user]);

  // Fetch user role in organization
  useEffect(() => {
    if (!user || !selectedOrganizationId) {
      setUserRole(null);
      return;
    }

    const fetchUserRole = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        const response = await fetch('/api/organizations', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const result = await response.json();
        if (result.success) {
          const org = result.organizations.find(o => o.id === selectedOrganizationId);
          setUserRole(org?.role || null);
        }
      } catch (error) {
        console.error('Failed to fetch user role:', error);
        setUserRole(null);
      }
    };

    fetchUserRole();
  }, [user, selectedOrganizationId]);

  const loadCollections = useCallback(async () => {
    if ((!activeConnection?.connectionString && !activeConnection?.id) || !selectedDatabase || loadingCollectionsRef.current) {
      return;
    }

    loadingCollectionsRef.current = true;
    try {
      const token = localStorage.getItem('auth_token');
      const body = {
        databaseName: selectedDatabase
      };

      // If connectionString is available (admin), use it. Otherwise use connectionId (member)
      if (activeConnection.connectionString) {
        body.connectionString = activeConnection.connectionString;
      } else if (activeConnection.id && selectedOrganizationId) {
        body.connectionId = activeConnection.id;
        body.organizationId = selectedOrganizationId;
      } else {
        throw new Error('Connection information is missing');
      }

      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      if (result.success) {
        setAvailableCollections(result.collections || []);
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
      setAvailableCollections([]);
    } finally {
      loadingCollectionsRef.current = false;
    }
  }, [activeConnection?.connectionString, selectedDatabase]);

  useEffect(() => {
    // Load collections when database/connection changes
    if ((activeConnection?.connectionString || (activeConnection?.id && selectedOrganizationId)) && selectedDatabase) {
      loadCollections();
    } else {
      setAvailableCollections([]);
    }
  }, [activeConnection?.connectionString, activeConnection?.id, selectedDatabase, selectedOrganizationId, loadCollections]);

  // Prevent page close during backup
  useEffect(() => {
    if (backupLoading && backupProgress.progress < 100) {
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = 'Backup is in progress. Are you sure you want to leave?';
        return e.returnValue;
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [backupLoading, backupProgress.progress]);

  // Authentication handled by useAuth hook

  const handleConnect = (connection) => {
    console.log('handleConnect called with connection:', {
      id: connection?.id,
      displayName: connection?.displayName,
      connectionString: connection?.connectionString ? 'present' : 'missing/empty',
      connectionStringLength: connection?.connectionString?.length || 0
    });
    setActiveConnection(connection);
    setSelectedDatabase(null);
    setSelectedCollection(null);
    setActiveTab('documents');
  };

  const handleSelectCollection = (databaseName, collectionName) => {
    setSelectedDatabase(databaseName);
    setSelectedCollection(collectionName);
    setActiveTab('documents');
  };

  const handleSelectDatabase = (databaseName) => {
    setSelectedDatabase(databaseName);
    setSelectedCollection(null);
  };

  const handleBackup = () => {
    if ((!activeConnection?.connectionString && !activeConnection?.id) || !selectedDatabase) {
      return;
    }

    if (!selectedOrganizationId) {
      alert('Please select an organization first');
      return;
    }

    // Show password modal first
    setShowBackupPasswordModal(true);
  };

  const handleBackupPasswordConfirm = (password) => {
    // Store password and close password modal
    setBackupPassword(password);
    setShowBackupPasswordModal(false);
    
    // Show collection selection modal
    setShowBackupSelectionModal(true);
  };

  const handleBackupSelectionConfirm = (collections) => {
    // Store selected collections and close selection modal
    setSelectedBackupCollections(collections);
    setShowBackupSelectionModal(false);
    
    // Start the actual backup process
    startBackupProcess(backupPassword, collections);
  };

  const startBackupProcess = async (backupPassword, collectionsToBackup) => {
    // Show modal and reset progress
    setShowBackupModal(true);
    setBackupProgress({
      currentCollection: null,
      processedCollections: 0,
      totalCollections: 0,
      progress: 0,
      error: null,
      completedCollections: [],
      currentDocumentCount: 0,
      totalDocumentCount: 0
    });
    setBackupLoading(true);

    try {
      // Use the selected collections passed to the function
      if (!collectionsToBackup || collectionsToBackup.length === 0) {
        throw new Error('No collections selected for backup');
      }

      const collectionsToProcess = collectionsToBackup;

      // Update total collections
      setBackupProgress(prev => ({
        ...prev,
        totalCollections: collectionsToProcess.length
      }));

      // Import JSZip dynamically
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Process each collection one by one
      for (let i = 0; i < collectionsToProcess.length; i++) {
        const collectionName = collectionsToProcess[i];
        
        // First, get the total document count for this collection
        let totalDocuments = 0;
        try {
          const countResponse = await fetch('/api/collections/count', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connectionString: activeConnection.connectionString,
              databaseName: selectedDatabase,
              collectionName: collectionName
            })
          });
          const countResult = await countResponse.json();
          if (countResult.success) {
            totalDocuments = countResult.count || 0;
          }
        } catch (error) {
          console.error(`Failed to get count for ${collectionName}:`, error);
        }
        
          // Update current collection with document count info
          setBackupProgress(prev => ({
            ...prev,
            currentCollection: collectionName,
            progress: Math.round((i / collectionsToProcess.length) * 100),
            currentDocumentCount: 0,
            totalDocumentCount: totalDocuments
          }));

        try {
          // Fetch all documents from this collection
          // We'll fetch in batches to handle large collections
          let allDocuments = [];
          let skip = 0;
          const limit = 1000;
          let hasMore = true;
          let currentCount = 0;

          while (hasMore) {
            const token = localStorage.getItem('auth_token');
            const body = {
              databaseName: selectedDatabase,
              collectionName: collectionName,
              query: {},
              options: {
                limit,
                skip,
                sort: { _id: 1 }
              }
            };

            // If connectionString is available (admin), use it. Otherwise use connectionId (member)
            if (activeConnection.connectionString) {
              body.connectionString = activeConnection.connectionString;
            } else if (activeConnection.id && selectedOrganizationId) {
              body.connectionId = activeConnection.id;
              body.organizationId = selectedOrganizationId;
            } else {
              throw new Error('Connection information is missing');
            }

            const documentsResponse = await fetch('/api/documents', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
              },
              body: JSON.stringify(body)
            });

            const documentsResult = await documentsResponse.json();
            if (!documentsResult.success) {
              throw new Error(documentsResult.error || `Failed to fetch documents from ${collectionName}`);
            }

            const documents = documentsResult.documents || [];
            allDocuments = allDocuments.concat(documents);
            currentCount += documents.length;
            
            // Update document progress
            setBackupProgress(prev => ({
              ...prev,
              currentDocumentCount: currentCount
            }));
            
            hasMore = documents.length === limit;
            skip += limit;
          }

          // Add collection to ZIP
          const jsonString = JSON.stringify(allDocuments, null, 2);
          zip.file(`${collectionName}.json`, jsonString);

          // Update processed count
          setBackupProgress(prev => ({
            ...prev,
            processedCollections: i + 1,
            progress: Math.round(((i + 1) / collectionsToProcess.length) * 100),
            completedCollections: [...prev.completedCollections, collectionName]
          }));
        } catch (error) {
          console.error(`Error backing up collection ${collectionName}:`, error);
          // Add error file to ZIP
          zip.file(`${collectionName}.json`, JSON.stringify({
            error: `Failed to backup: ${error.message}`
          }, null, 2));
          
          // Continue with next collection
          setBackupProgress(prev => ({
            ...prev,
            processedCollections: i + 1,
            progress: Math.round(((i + 1) / collectionsToProcess.length) * 100),
            completedCollections: [...prev.completedCollections, collectionName]
          }));
        }
      }

      // Generate ZIP file
      setBackupProgress(prev => ({
        ...prev,
        currentCollection: 'Generating ZIP file...',
        progress: 95
      }));

      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });

      // Generate filename
      const now = new Date();
      const dateTimeStr = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `backup for ${selectedDatabase} at ${dateTimeStr}.zip`;

      // Download the ZIP file
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Mark as complete
      setBackupProgress(prev => ({
        ...prev,
        currentCollection: null,
        progress: 100
      }));

      // Auto-close modal after 2 seconds
      setTimeout(() => {
        setShowBackupModal(false);
        setBackupLoading(false);
      }, 2000);
    } catch (error) {
      console.error('Backup error:', error);
      setBackupProgress(prev => ({
        ...prev,
        error: error.message || 'Backup failed',
        currentCollection: null
      }));
      setBackupLoading(false);
    }
  };

  // Resize handlers
  const handleMouseDownLeft = useCallback((e) => {
    e.preventDefault();
    setIsResizingLeft(true);
  }, []);

  const handleMouseDownMiddle = useCallback((e) => {
    e.preventDefault();
    setIsResizingMiddle(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingLeft) {
        const newWidth = e.clientX;
        if (newWidth < 150) {
          // Auto-collapse if too small
          setIsLeftCollapsed(true);
        } else if (newWidth >= 150 && newWidth <= 600) {
          setLeftSidebarWidth(newWidth);
          setIsLeftCollapsed(false);
        }
      }
      if (isResizingMiddle) {
        const newWidth = e.clientX - (isLeftCollapsed ? 0 : leftSidebarWidth);
        if (newWidth < 100) {
          // Auto-collapse if too small
          setIsMiddleCollapsed(true);
        } else if (newWidth >= 100 && newWidth <= 500) {
          setMiddleSidebarWidth(newWidth);
          setIsMiddleCollapsed(false);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingMiddle(false);
    };

    if (isResizingLeft || isResizingMiddle) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizingLeft, isResizingMiddle, leftSidebarWidth, isLeftCollapsed]);

  // Show loading overlay during initial auth check
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth modal if not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <AuthModal
        isOpen={showAuthModal}
        onLogin={login}
        onRegister={register}
        onClose={() => {
          // Don't allow closing if not authenticated
          if (!isAuthenticated) return;
          setShowAuthModal(false);
        }}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground font-sans overflow-hidden">
      {/* Header */}
      <header className="min-h-14 border-b border-border bg-card px-2 sm:px-4 flex flex-col sm:flex-row items-center shrink-0 z-20 gap-2 sm:gap-0 py-2 sm:py-0">
        {/* Left: Logo and Title */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="p-1 sm:p-1.5 bg-primary/10 rounded-lg">
            <FiDatabase className="text-primary w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-semibold leading-none">My Compass</h1>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 hidden sm:block">MongoDB Manager</p>
          </div>
        </div>

        {/* Middle: Navigation Tools */}
        <div className="flex-1 w-full sm:w-auto flex items-center justify-center gap-1 px-2 sm:px-4 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 min-w-max">
            {activeConnection && selectedDatabase && (
              <>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`h-8 px-2 sm:px-3 text-xs font-medium rounded-md transition-all flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                    activeTab === 'documents'
                      ? 'bg-secondary text-secondary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}
                >
                  <FiDatabase size={14} />
                  <span className="hidden sm:inline">Documents</span>
                </button>
                <button
                  onClick={() => setActiveTab('query')}
                  className={`h-8 px-2 sm:px-3 text-xs font-medium rounded-md transition-all flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                    activeTab === 'query'
                      ? 'bg-secondary text-secondary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}
                >
                  <FiCode size={14} />
                  <span className="hidden sm:inline">Query</span>
                </button>
                <button
                  onClick={() => setActiveTab('sql')}
                  className={`h-8 px-2 sm:px-3 text-xs font-medium rounded-md transition-all flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                    activeTab === 'sql'
                      ? 'bg-secondary text-secondary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}
                >
                  <FiCode size={14} />
                  <span className="hidden sm:inline">SQL</span>
                </button>
              </>
            )}
            <button
              onClick={() => setActiveTab('scheduler')}
              className={`h-8 px-2 sm:px-3 text-xs font-medium rounded-md transition-all flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                activeTab === 'scheduler'
                  ? 'bg-secondary text-secondary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <FiHardDrive size={14} />
              <span className="hidden sm:inline">Scheduler</span>
            </button>
          </div>
        </div>

        {/* Right: Organization Selector, User Name and Logout */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {user && isAuthenticated && (
            <>
              <OrganizationSelector
                selectedOrganizationId={selectedOrganizationId}
                onSelectOrganization={(orgId) => {
                  setSelectedOrganizationId(orgId);
                  // Clear active connection when switching organizations
                  setActiveConnection(null);
                  setSelectedDatabase(null);
                  setSelectedCollection(null);
                  // Reload connections for the new organization
                  if (orgId) {
                    setTimeout(() => {
                      loadConnections();
                    }, 100);
                  }
                }}
                onCreateNew={() => setShowCreateOrgModal(true)}
                onInvite={() => {
                  if (selectedOrganizationId) {
                    setShowInviteModal(true);
                  }
                }}
                onSettings={() => {
                  if (selectedOrganizationId) {
                    setShowOrgSettingsModal(true);
                  }
                }}
                refreshTrigger={orgRefreshTrigger}
              />
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FiUser size={14} />
                <span className="hidden sm:inline max-w-[120px] md:max-w-none truncate">{user.email}</span>
              </div>
              <button
                onClick={logout}
                className="h-8 px-2 sm:px-3 flex items-center gap-1.5 text-xs font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap"
                title="Logout"
              >
                <FiLogOut size={14} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Action Toolbar */}
      {activeConnection && selectedDatabase && userRole === 'admin' && (
        <div className="h-auto sm:h-10 border-b border-border bg-muted/30 px-2 sm:px-4 py-2 sm:py-0 flex items-center gap-1 sm:gap-2 shrink-0 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 sm:gap-2 min-w-max">
            <button
              onClick={() => setShowCloneDialog(true)}
              className="h-7 px-2 sm:px-3 flex items-center gap-1 sm:gap-2 text-xs font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap"
            >
              <FiCopy size={14} />
              <span className="hidden sm:inline">Clone</span>
            </button>
            <button
              onClick={() => setShowExportDialog(true)}
              className="h-7 px-2 sm:px-3 flex items-center gap-1 sm:gap-2 text-xs font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap"
            >
              <FiDownload size={14} />
              <span className="hidden sm:inline">Export</span>
            </button>
            {/* <button
              onClick={handleBackup}
              disabled={backupLoading}
              className="h-7 px-2 sm:px-3 flex items-center gap-1 sm:gap-2 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <FiHardDrive size={14} />
              <span className="hidden sm:inline">{backupLoading ? 'Backing up...' : 'Local Backup'}</span>
              <span className="sm:hidden">{backupLoading ? '...' : 'Backup'}</span>
            </button> */}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Organization Manager / Connection Manager */}
        {selectedOrganizationId ? (
          <div
            className={`border-r border-border bg-muted/30 flex flex-col relative transition-all duration-300 ease-in-out ${isLeftCollapsed ? 'w-10' : ''}`}
            style={!isLeftCollapsed ? { width: `${leftSidebarWidth}px`, minWidth: '200px', maxWidth: '600px' } : {}}
          >
            <div className="h-10 flex items-center justify-between px-3 border-b border-border bg-muted/50">
              {!isLeftCollapsed && <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Connections</span>}
              <button
                onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
                className="p-1 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors ml-auto"
              >
                {isLeftCollapsed ? <FiChevronRight size={14} /> : <FiChevronLeft size={14} />}
              </button>
            </div>
            
            {!isLeftCollapsed && (
              <div className="flex-1 overflow-hidden">
                <ConnectionManager onConnect={handleConnect} organizationId={selectedOrganizationId} loading={connectionsLoading} />
              </div>
            )}

            {/* Resize Handle */}
            {!isLeftCollapsed && (
              <div
                onMouseDown={handleMouseDownLeft}
                className="absolute right-0 top-0 bottom-0 w-1 hover:bg-primary/50 cursor-col-resize z-10 transition-colors"
              />
            )}
          </div>
        ) : (
          <div
            className={`border-r border-border bg-muted/30 flex flex-col relative transition-all duration-300 ease-in-out ${isLeftCollapsed ? 'w-10' : ''}`}
            style={!isLeftCollapsed ? { width: `${leftSidebarWidth}px`, minWidth: '200px', maxWidth: '600px' } : {}}
          >
            <div className="h-10 flex items-center justify-between px-3 border-b border-border bg-muted/50">
              {!isLeftCollapsed && <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Organizations</span>}
              <button
                onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
                className="p-1 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors ml-auto"
              >
                {isLeftCollapsed ? <FiChevronRight size={14} /> : <FiChevronLeft size={14} />}
              </button>
            </div>
            
            {!isLeftCollapsed && (
              <div className="flex-1 overflow-hidden">
                <OrganizationManager
                  onSelectOrganization={(orgId) => {
                    setSelectedOrganizationId(orgId);
                    // Clear active connection when switching organizations
                    setActiveConnection(null);
                    setSelectedDatabase(null);
                    setSelectedCollection(null);
                    // Reload connections for the new organization
                    if (orgId) {
                      setTimeout(() => {
                        loadConnections();
                      }, 100);
                    }
                  }}
                  selectedOrganizationId={selectedOrganizationId}
                />
              </div>
            )}

            {/* Resize Handle */}
            {!isLeftCollapsed && (
              <div
                onMouseDown={handleMouseDownLeft}
                className="absolute right-0 top-0 bottom-0 w-1 hover:bg-primary/50 cursor-col-resize z-10 transition-colors"
              />
            )}
          </div>
        )}

        {/* Middle Panel - Database Tree */}
        <div 
          className={`border-r border-border bg-card flex flex-col relative transition-all duration-300 ease-in-out ${isMiddleCollapsed ? 'w-10' : ''}`}
          style={!isMiddleCollapsed ? { width: `${middleSidebarWidth}px`, minWidth: '150px', maxWidth: '500px' } : {}}
        >
          <div className="h-10 flex items-center justify-between px-3 border-b border-border bg-card">
             {!isMiddleCollapsed && <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Explorer</span>}
            <button
              onClick={() => setIsMiddleCollapsed(!isMiddleCollapsed)}
              className="p-1 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              {isMiddleCollapsed ? <FiChevronRight size={14} /> : <FiChevronLeft size={14} />}
            </button>
          </div>

          {!isMiddleCollapsed && (
            <div className="flex-1 overflow-hidden">
              <DatabaseTree
                connectionString={activeConnection?.connectionString || null}
                connectionId={activeConnection?.id || null}
                organizationId={selectedOrganizationId}
                onSelectCollection={handleSelectCollection}
                onSelectDatabase={handleSelectDatabase}
              />
              {/* Debug info */}
              {process.env.NODE_ENV === 'development' && activeConnection && (
                <div className="p-2 text-xs text-muted-foreground border-t">
                  Debug: ID={activeConnection?.id}, Org={selectedOrganizationId}, 
                  ConnStr={activeConnection?.connectionString ? 'yes' : 'no'}
                </div>
              )}
            </div>
          )}

          {/* Resize Handle */}
          {!isMiddleCollapsed && (
            <div
              onMouseDown={handleMouseDownMiddle}
              className="absolute right-0 top-0 bottom-0 w-1 hover:bg-primary/50 cursor-col-resize z-10 transition-colors"
            />
          )}
        </div>

        {/* Right Panel - Content Area */}
        <div className="flex-1 bg-background flex flex-col min-w-0">
          <div className="flex-1 overflow-hidden relative">
              {activeTab === 'scheduler' ? (
                <BackupScheduler organizationId={selectedOrganizationId} />
              ) : activeConnection && selectedDatabase ? (
                <>
                  <div className={`h-full w-full ${activeTab === 'documents' ? 'block' : 'hidden'}`}>
                    <DocumentViewer
                      key={`documents_${selectedDatabase}_${selectedCollection}`}
                      connectionString={activeConnection?.connectionString || null}
                      connectionId={activeConnection?.id || null}
                      organizationId={selectedOrganizationId}
                      databaseName={selectedDatabase}
                      collectionName={selectedCollection}
                    />
                  </div>
                  <div className={`h-full w-full ${activeTab === 'query' ? 'block' : 'hidden'}`}>
                    <QueryEditor
                      connectionString={activeConnection?.connectionString || null}
                      connectionId={activeConnection?.id || null}
                      organizationId={selectedOrganizationId}
                      databaseName={selectedDatabase}
                      collectionName={selectedCollection}
                    />
                  </div>
                  <div className={`h-full w-full ${activeTab === 'sql' ? 'block' : 'hidden'}`}>
                    <SQLEditor
                      key={`sql_${selectedDatabase}`}
                      connectionString={activeConnection?.connectionString || null}
                      connectionId={activeConnection?.id || null}
                      organizationId={selectedOrganizationId}
                      databaseName={selectedDatabase}
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                  <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
                    <FiDatabase size={32} className="opacity-50" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">No Database Selected</h3>
                  <p className="text-sm max-w-xs text-center mt-2">
                    Select a database from the explorer to view documents or run queries.
                  </p>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showCloneDialog && (
        <CloneDialog
          isOpen={showCloneDialog}
          onClose={() => setShowCloneDialog(false)}
          availableConnections={connections}
          organizationId={selectedOrganizationId}
          connectionsLoading={connectionsLoading}
          onRefreshConnections={loadConnections}
        />
      )}

      {showExportDialog && (
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          connectionString={activeConnection?.connectionString}
          connectionId={activeConnection?.id}
          organizationId={selectedOrganizationId}
          databaseName={selectedDatabase}
          availableCollections={availableCollections}
        />
      )}

      <BackupProgressModal
        isOpen={showBackupModal}
        databaseName={selectedDatabase}
        currentCollection={backupProgress.currentCollection}
        processedCollections={backupProgress.processedCollections}
        totalCollections={backupProgress.totalCollections}
        progress={backupProgress.progress}
        error={backupProgress.error}
        completedCollections={backupProgress.completedCollections || []}
        currentDocumentCount={backupProgress.currentDocumentCount || 0}
        totalDocumentCount={backupProgress.totalDocumentCount || 0}
        onClose={() => {
          if (backupProgress.progress === 100 || backupProgress.error) {
            setShowBackupModal(false);
            setBackupLoading(false);
            setBackupProgress({
              currentCollection: null,
              processedCollections: 0,
              totalCollections: 0,
              progress: 0,
              error: null,
              completedCollections: [],
              currentDocumentCount: 0,
              totalDocumentCount: 0
            });
            setBackupPassword(null);
            setSelectedBackupCollections([]);
          }
        }}
      />

      <BackupPasswordModal
        isOpen={showBackupPasswordModal}
        databaseName={selectedDatabase}
        organizationId={selectedOrganizationId}
        onConfirm={handleBackupPasswordConfirm}
        onCancel={() => {
          setShowBackupPasswordModal(false);
          setBackupPassword(null);
        }}
      />

      <EmailVerificationModal
        isOpen={showEmailVerificationModal}
        email={user?.email}
        onClose={() => setShowEmailVerificationModal(false)}
      />

      {showCreateOrgModal && (
        <CreateOrganizationModal
          onSuccess={() => {
            setShowCreateOrgModal(false);
            // Trigger refresh of organization selector
            setOrgRefreshTrigger(prev => prev + 1);
          }}
          onCancel={() => setShowCreateOrgModal(false)}
        />
      )}

      {showInviteModal && selectedOrganizationId && (
        <InviteUserModal
          organizationId={selectedOrganizationId}
          onSuccess={() => {
            setShowInviteModal(false);
            setOrgRefreshTrigger(prev => prev + 1);
          }}
          onCancel={() => setShowInviteModal(false)}
        />
      )}

      {showOrgSettingsModal && selectedOrganizationId && (
        <OrganizationSettingsWrapper
          organizationId={selectedOrganizationId}
          onClose={() => setShowOrgSettingsModal(false)}
        />
      )}

      <BackupSelectionModal
        isOpen={showBackupSelectionModal}
        databaseName={selectedDatabase}
        connectionString={activeConnection?.connectionString}
        availableCollections={availableCollections}
        onConfirm={handleBackupSelectionConfirm}
        onCancel={() => {
          setShowBackupSelectionModal(false);
          setSelectedBackupCollections([]);
        }}
      />
    </div>
  );
}
