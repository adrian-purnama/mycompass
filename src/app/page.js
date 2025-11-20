'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FiDatabase, FiCode, FiCopy, FiDownload, FiChevronLeft, FiChevronRight, FiHardDrive } from 'react-icons/fi';
import { hasMasterPassword } from '@/lib/storage';
import { useConnections } from '@/hooks/useConnections';
import MasterPasswordModal from '@/components/MasterPasswordModal';
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

export default function Home() {
  const [masterPassword, setMasterPassword] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [activeConnection, setActiveConnection] = useState(null);
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [activeTab, setActiveTab] = useState('documents'); // 'documents', 'query', 'sql'
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
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(320); // Connection Manager width
  const [middleSidebarWidth, setMiddleSidebarWidth] = useState(256); // Database Tree width
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingMiddle, setIsResizingMiddle] = useState(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isMiddleCollapsed, setIsMiddleCollapsed] = useState(false);

  const { connections } = useConnections(masterPassword);

  useEffect(() => {
    // Check if master password is needed
    if (hasMasterPassword()) {
      setShowPasswordModal(true);
    } else {
      // First time - show setup modal
      setShowPasswordModal(true);
    }
  }, []);

  const loadCollections = useCallback(async () => {
    if (!activeConnection?.connectionString || !selectedDatabase || loadingCollectionsRef.current) {
      return;
    }

    loadingCollectionsRef.current = true;
    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString: activeConnection.connectionString,
          databaseName: selectedDatabase
        })
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
    if (activeConnection?.connectionString && selectedDatabase) {
      loadCollections();
    } else {
      setAvailableCollections([]);
    }
  }, [activeConnection?.connectionString, selectedDatabase, loadCollections]);

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

  const handleUnlock = (password) => {
    setMasterPassword(password);
    setShowPasswordModal(false);
  };

  const handleConnect = (connection) => {
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
    if (!activeConnection?.connectionString || !selectedDatabase) {
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
            const documentsResponse = await fetch('/api/documents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                connectionString: activeConnection.connectionString,
                databaseName: selectedDatabase,
                collectionName: collectionName,
                query: {},
                options: {
                  limit,
                  skip,
                  sort: { _id: 1 }
                }
              })
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

  if (!masterPassword) {
    return (
      <MasterPasswordModal
        isOpen={showPasswordModal}
        onUnlock={handleUnlock}
        onClose={() => {}}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-zinc-50">My Compass</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              MongoDB Management Tool
            </p>
          </div>
          {activeConnection && selectedDatabase && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCloneDialog(true)}
                className="flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md text-sm font-medium transition-colors"
              >
                <FiCopy size={16} />
                Clone
              </button>
              <button
                onClick={() => setShowExportDialog(true)}
                className="flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md text-sm font-medium transition-colors"
              >
                <FiDownload size={16} />
                Export
              </button>
              <button
                onClick={handleBackup}
                disabled={backupLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiHardDrive size={16} />
                {backupLoading ? 'Backing up...' : 'Backup'}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Connection Manager */}
        {!isLeftCollapsed ? (
          <div 
            className="border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col relative"
            style={{ width: `${leftSidebarWidth}px`, minWidth: '150px', maxWidth: '600px' }}
          >
            <div className="flex items-center justify-between p-2 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Connections</h2>
              <button
                onClick={() => setIsLeftCollapsed(true)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 dark:text-zinc-400"
                title="Collapse"
              >
                <FiChevronLeft size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ConnectionManager masterPassword={masterPassword} onConnect={handleConnect} />
            </div>
            {/* Resize Handle */}
            <div
              onMouseDown={handleMouseDownLeft}
              className="absolute right-0 top-0 bottom-0 w-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-blue-500 transition-colors z-10"
              style={{ cursor: 'col-resize', pointerEvents: 'auto' }}
              title="Drag to resize"
            />
          </div>
        ) : (
          <div className="border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col relative w-8">
            <button
              onClick={() => setIsLeftCollapsed(false)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
              title="Expand Connections"
            >
              <FiChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Middle Panel - Database Tree */}
        {!isMiddleCollapsed ? (
          <div 
            className="border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col relative"
            style={{ width: `${middleSidebarWidth}px`, minWidth: '100px', maxWidth: '500px' }}
          >
            <div className="flex items-center justify-between p-2 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Databases</h2>
              <button
                onClick={() => setIsMiddleCollapsed(true)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 dark:text-zinc-400"
                title="Collapse"
              >
                <FiChevronLeft size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <DatabaseTree
                connectionString={activeConnection?.connectionString || null}
                onSelectCollection={handleSelectCollection}
                onSelectDatabase={handleSelectDatabase}
              />
            </div>
            {/* Resize Handle */}
            <div
              onMouseDown={handleMouseDownMiddle}
              className="absolute right-0 top-0 bottom-0 w-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-blue-500 transition-colors z-10"
              style={{ cursor: 'col-resize', pointerEvents: 'auto' }}
              title="Drag to resize"
            />
          </div>
        ) : (
          <div className="border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col relative w-8">
            <button
              onClick={() => setIsMiddleCollapsed(false)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
              title="Expand Databases"
            >
              <FiChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Right Panel - Content Area */}
        <div className="flex-1 bg-white dark:bg-zinc-900 flex flex-col">
          {activeConnection && selectedDatabase && (
            <div className="border-b border-zinc-200 dark:border-zinc-800 flex">
              <button
                onClick={() => setActiveTab('documents')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'documents'
                    ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50'
                }`}
              >
                <FiDatabase size={16} className="inline mr-2" />
                Documents
              </button>
              <button
                onClick={() => setActiveTab('query')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'query'
                    ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50'
                }`}
              >
                <FiCode size={16} className="inline mr-2" />
                MongoDB Query
              </button>
              <button
                onClick={() => setActiveTab('sql')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'sql'
                    ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50'
                }`}
              >
                <FiCode size={16} className="inline mr-2" />
                SQL Query
              </button>
            </div>
          )}

          <div className="flex-1 overflow-hidden relative min-w-0">
            {/* Keep all components mounted but hide inactive ones */}
            <div className={`h-full min-w-0 ${activeTab === 'documents' ? 'block' : 'hidden'}`}>
              <DocumentViewer
                key={`documents_${selectedDatabase}_${selectedCollection}`}
                connectionString={activeConnection?.connectionString || null}
                databaseName={selectedDatabase}
                collectionName={selectedCollection}
              />
            </div>
            <div className={`h-full min-w-0 ${activeTab === 'query' ? 'block' : 'hidden'}`}>
              <QueryEditor
                key={`query_${selectedDatabase}_${selectedCollection}`}
                connectionString={activeConnection?.connectionString || null}
                databaseName={selectedDatabase}
                collectionName={selectedCollection}
              />
            </div>
            <div className={`h-full min-w-0 ${activeTab === 'sql' ? 'block' : 'hidden'}`}>
              <SQLEditor
                key={`sql_${selectedDatabase}`}
                connectionString={activeConnection?.connectionString || null}
                databaseName={selectedDatabase}
              />
            </div>
            {(!activeConnection || !selectedDatabase) && (
              <div className="h-full flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                <div className="text-center">
                  <p>Select a database to view documents or run queries</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clone Dialog */}
      {showCloneDialog && (
        <CloneDialog
          isOpen={showCloneDialog}
          onClose={() => setShowCloneDialog(false)}
          availableConnections={connections}
        />
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          connectionString={activeConnection?.connectionString}
          databaseName={selectedDatabase}
          availableCollections={availableCollections}
        />
      )}

      {/* Backup Progress Modal */}
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
            // Clear stored password and collections
            setBackupPassword(null);
            setSelectedBackupCollections([]);
          }
        }}
      />

      {/* Backup Password Modal */}
      <BackupPasswordModal
        isOpen={showBackupPasswordModal}
        databaseName={selectedDatabase}
        onConfirm={handleBackupPasswordConfirm}
        onCancel={() => {
          setShowBackupPasswordModal(false);
          setBackupPassword(null);
        }}
      />

      {/* Backup Selection Modal */}
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
