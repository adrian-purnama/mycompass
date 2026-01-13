'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { FiPlay, FiCopy, FiX, FiChevronLeft, FiChevronRight, FiGrid, FiDatabase, FiCode, FiDownload, FiPlus } from 'react-icons/fi';

export default function QueryEditor({
  connectionString,
  connectionId,
  organizationId,
  databaseName,
  collectionName,
  onResults
}) {
  // Tab state management
  const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const generateInitialTabs = () => {
    if (collectionName) {
      const firstTab = {
        id: generateTabId(),
        collectionName,
        query: '{\n  "filter": {},\n  "limit": 10\n}',
        results: null,
        history: [],
        error: null,
        currentPage: 1,
        viewMode: 'table',
        resultsVisible: true
      };
      return { tabs: [firstTab], activeId: firstTab.id };
    }
    return { tabs: [], activeId: null };
  };

  const initialTabs = generateInitialTabs();
  const [tabs, setTabs] = useState(initialTabs.tabs);
  const [activeTabId, setActiveTabId] = useState(initialTabs.activeId);
  
  const [loading, setLoading] = useState(false);
  const [showCollectionSelector, setShowCollectionSelector] = useState(false);
  const [availableCollections, setAvailableCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const rowsPerPage = 50;
  const textareaRef = useRef(null);
  
  // Get active tab
  const activeTab = useMemo(() => {
    return tabs.find(tab => tab.id === activeTabId) || null;
  }, [tabs, activeTabId]);
  
  // Derived state from active tab
  const query = activeTab?.query || '{\n  "filter": {},\n  "limit": 10\n}';
  const results = activeTab?.results || null;
  const error = activeTab?.error || null;
  const queryHistory = activeTab?.history || [];
  const currentPage = activeTab?.currentPage || 1;
  const viewMode = activeTab?.viewMode || 'table';
  const resultsVisible = activeTab?.resultsVisible !== false;

  // Initialize tab when collectionName prop changes
  useEffect(() => {
    if (collectionName) {
      // Check if tab already exists for this collection
      const existingTab = tabs.find(tab => tab.collectionName === collectionName);
      if (existingTab) {
        setActiveTabId(existingTab.id);
      } else if (tabs.length === 0) {
        // Create first tab if none exist
        const newTab = {
          id: generateTabId(),
          collectionName,
          query: '{\n  "filter": {},\n  "limit": 10\n}',
          results: null,
          history: [],
          error: null,
          currentPage: 1,
          viewMode: 'table',
          resultsVisible: true
        };
        setTabs([newTab]);
        setActiveTabId(newTab.id);
      }
    }
  }, [collectionName]);

  // Load available collections
  const loadCollections = useCallback(async () => {
    if (!databaseName || (!connectionString && !connectionId)) {
      return;
    }

    setLoadingCollections(true);
    try {
      const token = localStorage.getItem('auth_token');
      const body = {
        databaseName,
        includeCounts: false
      };

      if (connectionString) {
        body.connectionString = connectionString;
      } else if (connectionId && organizationId) {
        body.connectionId = connectionId;
        body.organizationId = organizationId;
      } else {
        return;
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
        const collectionsList = (result.collections || []).map(c => c.name);
        setAvailableCollections(collectionsList);
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setLoadingCollections(false);
    }
  }, [databaseName, connectionString, connectionId, organizationId]);

  // Load collections when selector opens
  useEffect(() => {
    if (showCollectionSelector) {
      loadCollections();
    }
  }, [showCollectionSelector, loadCollections]);

  // Update tab query
  const updateTabQuery = useCallback((tabId, newQuery) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, query: newQuery } : tab
    ));
  }, []);

  // Update tab state
  const updateTabState = useCallback((tabId, updates) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, ...updates } : tab
    ));
  }, []);

  // Switch tab
  const switchTab = useCallback((tabId) => {
    setActiveTabId(tabId);
  }, []);

  // Close tab
  const closeTab = useCallback((tabId) => {
    setTabs(prev => {
      if (prev.length <= 1) return prev; // Don't close last tab
      
      const newTabs = prev.filter(tab => tab.id !== tabId);
      // If closing active tab, switch to another tab
      if (tabId === activeTabId) {
        const newActiveId = newTabs.length > 0 ? newTabs[0].id : null;
        setActiveTabId(newActiveId);
      }
      return newTabs;
    });
  }, [activeTabId]);

  // Add new tab
  const addTab = useCallback((newCollectionName) => {
    // Check if tab already exists for this collection
    const existingTab = tabs.find(tab => tab.collectionName === newCollectionName);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      setShowCollectionSelector(false);
      return;
    }

    const newTab = {
      id: generateTabId(),
      collectionName: newCollectionName,
      query: '{\n  "filter": {},\n  "limit": 10\n}',
      results: null,
      history: [],
      error: null,
      currentPage: 1,
      viewMode: 'table',
      resultsVisible: true
    };
    
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setShowCollectionSelector(false);
  }, [tabs]);

  const executeQuery = async () => {
    if (!activeTab) {
      return;
    }

    if ((!connectionString && !connectionId) || !databaseName || !activeTab.collectionName) {
      updateTabState(activeTabId, { error: 'Please select a database and collection first' });
      return;
    }

    setLoading(true);
    updateTabState(activeTabId, { error: null });

    try {
      let parsedQuery;
      try {
        parsedQuery = JSON.parse(query);
      } catch (e) {
        updateTabState(activeTabId, { error: 'Invalid JSON format. Please check your query syntax.' });
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('auth_token');
      const body = {
        databaseName,
        collectionName: activeTab.collectionName,
        query: parsedQuery
      };

      if (connectionString) {
        body.connectionString = connectionString;
      } else if (connectionId && organizationId) {
        body.connectionId = connectionId;
        body.organizationId = organizationId;
      } else {
        updateTabState(activeTabId, { error: 'Connection information is missing' });
        setLoading(false);
        return;
      }

      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      if (result.success) {
        updateTabState(activeTabId, {
          results: result.results,
          history: [query, ...(activeTab.history || []).slice(0, 9)],
          currentPage: 1,
          resultsVisible: true
        });
        if (onResults) {
          onResults(result.results);
        }
      } else {
        updateTabState(activeTabId, { error: result.error || 'Query execution failed' });
      }
    } catch (error) {
      updateTabState(activeTabId, { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      executeQuery();
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const formatResults = (data) => JSON.stringify(data, null, 2);

  const downloadResults = (format = 'json') => {
    if (!results || results.length === 0) return;

    let content, filename, mimeType;

    if (format === 'json') {
      content = formatResults(results);
      filename = `query-results-${databaseName}-${activeTab?.collectionName || 'collection'}-${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
    } else if (format === 'csv') {
      if (results.length === 0) return;
      
      const allKeys = new Set();
      results.forEach(doc => {
        Object.keys(doc).forEach(k => allKeys.add(k));
      });
      const headers = Array.from(allKeys).sort((a, b) => {
        if (a === '_id') return -1;
        if (b === '_id') return 1;
        return a.localeCompare(b);
      });

      const csvRows = [];
      csvRows.push(headers.join(','));

      results.forEach(doc => {
        const row = headers.map(header => {
          const value = doc[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          }
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        });
        csvRows.push(row.join(','));
      });

      content = csvRows.join('\n');
      filename = `query-results-${databaseName}-${activeTab?.collectionName || 'collection'}-${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSetCurrentPage = (page) => {
    if (activeTab) {
      updateTabState(activeTabId, { currentPage: page });
    }
  };

  const handleSetViewMode = (mode) => {
    if (activeTab) {
      updateTabState(activeTabId, { viewMode: mode });
    }
  };

  const getPaginatedResults = useMemo(() => {
    if (!results || !Array.isArray(results)) return [];
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return results.slice(startIndex, endIndex);
  }, [results, currentPage, rowsPerPage]);

  const totalPages = results ? Math.ceil(results.length / rowsPerPage) : 0;

  useEffect(() => {
    if (activeTab && activeTab.results !== results) {
      updateTabState(activeTabId, { currentPage: 1 });
    }
  }, [results, activeTab, activeTabId, updateTabState]);

  const tableHeaders = useMemo(() => {
    if (!results || results.length === 0) return [];
    const keys = new Set();
    results.slice(0, 5).forEach(item => {
      Object.keys(item).forEach(k => keys.add(k));
    });
    return Array.from(keys).sort((a, b) => {
        if (a === '_id') return -1;
        if (b === '_id') return 1;
        return a.localeCompare(b);
    });
  }, [results]);

  const renderCellValue = (value) => {
    if (value === null) return <span className="text-muted-foreground italic">null</span>;
    if (value === undefined) return <span className="text-muted-foreground">-</span>;

    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            return <span className="text-xs font-mono text-blue-600 dark:text-blue-400">Array({value.length})</span>;
        }
        if (value.$oid) return <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">ObjectId("{value.$oid}")</span>;
        if (value.$date) return <span className="text-xs font-mono text-purple-600 dark:text-purple-400">{new Date(value.$date).toISOString()}</span>;
        
        return <span className="text-xs font-mono text-muted-foreground">{'{...}'}</span>;
    }

    if (typeof value === 'boolean') {
      return <span className={`text-xs px-1.5 py-0.5 rounded ${value ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{String(value)}</span>;
    }
    return <span className="truncate block max-w-[200px]" title={String(value)}>{String(value)}</span>;
  };

  if (!activeTab) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>No collection selected</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background rounded-none border-none shadow-none overflow-hidden">
      {/* Tabs Bar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-card overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md border-b-2 transition-colors cursor-pointer group ${
              tab.id === activeTabId
                ? 'bg-background border-primary text-foreground'
                : 'bg-muted/50 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            onClick={() => switchTab(tab.id)}
          >
            <FiDatabase size={12} className="flex-shrink-0" />
            <span className="text-xs font-medium whitespace-nowrap">{tab.collectionName}</span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 hover:bg-destructive/20 rounded transition-opacity"
              >
                <FiX size={12} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setShowCollectionSelector(true)}
          className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Add new tab"
        >
          <FiPlus size={14} />
        </button>
      </div>

      {/* Collection Selector */}
      {showCollectionSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCollectionSelector(false)}>
          <div className="bg-card border border-border rounded-lg shadow-xl p-4 w-full max-w-md mx-4 bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Select Collection</h3>
              <button
                onClick={() => setShowCollectionSelector(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <FiX size={18} />
              </button>
            </div>
            {loadingCollections ? (
              <div className="py-8 text-center text-muted-foreground">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs">Loading collections...</p>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {availableCollections.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No collections available</p>
                ) : (
                  <div className="space-y-1">
                    {availableCollections
                      .filter(coll => !tabs.some(tab => tab.collectionName === coll))
                      .map((coll) => (
                        <button
                          key={coll}
                          onClick={() => addTab(coll)}
                          className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent text-foreground transition-colors flex items-center gap-2"
                        >
                          <FiDatabase size={14} className="text-muted-foreground" />
                          <span>{coll}</span>
                        </button>
                      ))}
                    {availableCollections.filter(coll => !tabs.some(tab => tab.collectionName === coll)).length === 0 && (
                      <p className="text-sm text-muted-foreground py-4 text-center">All collections are already open in tabs</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-3">
            <div>
                <h3 className="text-sm font-semibold text-foreground">MongoDB Query</h3>
                <p className="text-xs text-muted-foreground">JSON Filter / Aggregation</p>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
          {queryHistory.length > 0 && (
            <select
              onChange={(e) => e.target.value && updateTabQuery(activeTabId, e.target.value)}
              className="text-xs h-8 px-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
              defaultValue=""
            >
              <option value="">🕒 History</option>
              {queryHistory.map((q, i) => (
                <option key={i} value={q}>Query {i + 1}</option>
              ))}
            </select>
          )}
          <button
            onClick={executeQuery}
            disabled={loading || (!connectionString && !connectionId) || !databaseName || !activeTab.collectionName}
            className="flex items-center gap-2 px-4 h-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
                <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
                <FiPlay size={12} className="fill-current" />
            )}
            {loading ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Editor Section */}
        <div className={`flex flex-col border-b md:border-b-0 md:border-r border-border transition-all duration-300 ${results && resultsVisible ? 'h-1/3 md:h-full md:w-1/3' : 'h-full w-full'}`}>
          <div className="px-4 py-2 bg-muted/30 border-b border-border flex justify-between items-center">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Input
            </label>
            <div className="flex items-center gap-3">
              {results && !resultsVisible && (
                <button
                  onClick={() => updateTabState(activeTabId, { resultsVisible: true })}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  title="Show results"
                >
                  <FiDatabase size={12} />
                  <span>Show Results ({results.length})</span>
                </button>
              )}
              <span className="text-xs text-muted-foreground">Cmd + Enter to run</span>
            </div>
          </div>
          <div className="flex-1 relative group bg-card">
            <textarea
              ref={textareaRef}
              value={query}
              onKeyDown={handleKeyDown}
              onChange={(e) => updateTabQuery(activeTabId, e.target.value)}
              className="w-full h-full p-4 bg-transparent text-foreground font-mono text-sm resize-none focus:outline-none leading-relaxed"
              placeholder='{"filter": {}, "limit": 10}'
              spellCheck="false"
            />
          </div>
          {error && (
            <div className="p-3 bg-destructive/10 border-t border-destructive/20 text-destructive text-xs flex justify-between items-start">
              <span className="font-medium">{error}</span>
              <button onClick={() => updateTabState(activeTabId, { error: null })}><FiX /></button>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className={`flex flex-col flex-1 bg-muted/10 min-w-0 ${!results || !resultsVisible ? 'hidden md:flex justify-center items-center' : ''}`}>
            {!results || !resultsVisible ? (
                <div className="text-center text-muted-foreground p-8">
                    <FiDatabase size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Execute a query to see results here.</p>
                </div>
            ) : (
                <>
                    <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-card">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium text-foreground">
                                Results <span className="text-muted-foreground font-normal">({results.length} docs)</span>
                            </span>
                            <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border">
                                <button 
                                    onClick={() => handleSetViewMode('table')}
                                    className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <FiGrid size={14} /> Table
                                </button>
                                <button 
                                    onClick={() => handleSetViewMode('json')}
                                    className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${viewMode === 'json' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <FiCode size={14} /> JSON
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => copyToClipboard(formatResults(results))}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                                title="Copy results to clipboard"
                            >
                                <FiCopy size={14} /> Copy
                            </button>
                            <button
                                onClick={() => downloadResults('json')}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                                title="Download as JSON"
                            >
                                <FiDownload size={14} /> JSON
                            </button>
                            <button
                                onClick={() => downloadResults('csv')}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                                title="Download as CSV"
                            >
                                <FiDownload size={14} /> CSV
                            </button>
                            <button
                                onClick={() => updateTabState(activeTabId, { resultsVisible: false })}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                                title="Close results"
                            >
                                <FiX size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden relative bg-background">
                        <div className="absolute inset-0 overflow-auto">
                            {viewMode === 'json' ? (
                                <pre className="p-4 text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                                    {formatResults(getPaginatedResults)}
                                </pre>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-2 border-b border-border bg-muted/50 w-12 text-xs font-medium text-muted-foreground text-center">#</th>
                                            {tableHeaders.map(header => (
                                                <th key={header} className="px-4 py-2 border-b border-border text-xs font-semibold text-foreground whitespace-nowrap">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border bg-card">
                                        {getPaginatedResults.map((row, i) => (
                                            <tr key={i} className="hover:bg-accent/50 transition-colors group">
                                                <td className="px-4 py-2 text-xs text-muted-foreground text-center font-mono border-r border-border/50 bg-muted/10">
                                                    {((currentPage - 1) * rowsPerPage) + i + 1}
                                                </td>
                                                {tableHeaders.map(header => (
                                                    <td key={`${i}-${header}`} className="px-4 py-2 text-xs font-mono whitespace-nowrap max-w-xs truncate">
                                                        {row[header] !== undefined ? renderCellValue(row[header]) : <span className="text-muted-foreground">-</span>}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-4 py-2 border-t border-border bg-card flex items-center justify-between shrink-0">
                            <span className="text-xs text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleSetCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="h-8 w-8 flex items-center justify-center border border-input rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <FiChevronLeft size={14} />
                                </button>
                                <button
                                    onClick={() => handleSetCurrentPage(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className="h-8 w-8 flex items-center justify-center border border-input rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <FiChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
      </div>
    </div>
  );
}
