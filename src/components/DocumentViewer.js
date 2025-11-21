'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FiChevronLeft, FiChevronRight, FiCopy, FiRefreshCw, FiGrid, FiCode, FiList } from 'react-icons/fi';

export default function DocumentViewer({
  connectionString,
  databaseName,
  collectionName,
  onRefresh
}) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [viewMode, setViewMode] = useState('table'); // 'table', 'json', 'list'

  // Track previous context to detect changes
  const prevContextRef = useRef({ connectionString, databaseName, collectionName });
  
  useEffect(() => {
    const contextChanged = 
      prevContextRef.current.connectionString !== connectionString ||
      prevContextRef.current.databaseName !== databaseName ||
      prevContextRef.current.collectionName !== collectionName;

    if (contextChanged) {
      // Context changed - reset to page 1
      prevContextRef.current = { connectionString, databaseName, collectionName };
      setPage(1);
      if (!connectionString || !databaseName || !collectionName) {
        setDocuments([]);
        setTotal(0);
      }
    }
  }, [connectionString, databaseName, collectionName]);

  const loadDocuments = useCallback(async () => {
    if (!connectionString || !databaseName || !collectionName) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString,
          databaseName,
          collectionName,
          query: {},
          options: {
            limit,
            skip: (page - 1) * limit,
            sort: { _id: 1 }
          }
        })
      });

      const result = await response.json();
      if (result.success) {
        setDocuments(result.documents || []);
        setTotal(result.total || 0);
      } else {
        setError(result.error || 'Failed to load documents');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [connectionString, databaseName, collectionName, page, limit]);

  // Load documents when context or page changes
  useEffect(() => {
    if (connectionString && databaseName && collectionName) {
      loadDocuments();
    }
    // loadDocuments is memoized with all necessary dependencies, so we don't need it in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionString, databaseName, collectionName, page]);

  const handleRefresh = () => {
    loadDocuments();
    if (onRefresh) onRefresh();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const formatDocument = (doc) => {
    return JSON.stringify(doc, null, 2);
  };

  const totalPages = Math.ceil(total / limit);

  // Extract headers for table view
  const tableHeaders = useMemo(() => {
    if (!documents || documents.length === 0) return [];
    const keys = new Set();
    // Check first 10 documents to get a good set of keys
    documents.slice(0, 10).forEach(doc => {
      Object.keys(doc).forEach(k => keys.add(k));
    });
    // Ensure _id is first
    const sortedKeys = Array.from(keys).sort((a, b) => {
        if (a === '_id') return -1;
        if (b === '_id') return 1;
        return a.localeCompare(b);
    });
    return sortedKeys;
  }, [documents]);

  const renderCellValue = (value) => {
    if (value === null) return <span className="text-muted-foreground italic">null</span>;
    if (value === undefined) return <span className="text-muted-foreground">-</span>;
    
    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            return <span className="text-xs font-mono text-blue-600 dark:text-blue-400">Array({value.length})</span>;
        }
        // Check for ObjectId
        if (value.$oid) return <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">ObjectId("{value.$oid}")</span>;
        // Check for Date
        if (value.$date) return <span className="text-xs font-mono text-purple-600 dark:text-purple-400">{new Date(value.$date).toISOString()}</span>;
        
        return <span className="text-xs font-mono text-muted-foreground">{'{...}'}</span>;
    }
    
    if (typeof value === 'boolean') {
      return <span className={`text-xs px-1.5 py-0.5 rounded ${value ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{String(value)}</span>;
    }
    
    return <span className="truncate block max-w-[200px]" title={String(value)}>{String(value)}</span>;
  };

  if (!connectionString || !databaseName || !collectionName) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p>Select a collection to view documents</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {collectionName}
            </h3>
            <p className="text-xs text-muted-foreground">
              {total.toLocaleString()} document{total !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="h-6 w-px bg-border mx-2" />

          <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border">
            <button 
                onClick={() => setViewMode('table')}
                className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                title="Table View"
            >
                <FiGrid size={14} /> Table
            </button>
            <button 
                onClick={() => setViewMode('json')}
                className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${viewMode === 'json' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                title="JSON View"
            >
                <FiCode size={14} /> JSON
            </button>
            <button 
                onClick={() => setViewMode('list')}
                className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                title="List View"
            >
                <FiList size={14} /> List
            </button>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors disabled:opacity-50"
        >
          <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="m-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-hidden relative">
        {loading && documents.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-muted-foreground">Loading documents...</p>
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <p>No documents found</p>
          </div>
        ) : (
            <div className="h-full overflow-auto">
                {viewMode === 'table' && (
                    <table className="w-full text-left border-collapse text-sm">
                        <thead className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-2 border-b border-border w-12 text-xs font-medium text-muted-foreground text-center">#</th>
                                {tableHeaders.map(header => (
                                    <th key={header} className="px-4 py-2 border-b border-border text-xs font-semibold text-foreground whitespace-nowrap">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card">
                            {documents.map((doc, i) => (
                                <tr key={doc._id || i} className="hover:bg-accent/50 transition-colors group">
                                    <td className="px-4 py-2 text-xs text-muted-foreground text-center font-mono border-r border-border/50 bg-muted/10">
                                        {(page - 1) * limit + i + 1}
                                    </td>
                                    {tableHeaders.map(header => (
                                        <td key={`${i}-${header}`} className="px-4 py-2 whitespace-nowrap max-w-xs truncate font-mono text-xs">
                                            {renderCellValue(doc[header])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {viewMode === 'json' && (
                    <div className="p-4">
                        <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                            {JSON.stringify(documents, null, 2)}
                        </pre>
                    </div>
                )}

                {viewMode === 'list' && (
                    <div className="p-4 space-y-4">
                        {documents.map((doc, index) => (
                        <div
                            key={doc._id || index}
                            className="border border-border rounded-lg overflow-hidden bg-card shadow-sm"
                        >
                            <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
                            <span className="text-xs font-mono text-muted-foreground">
                                Document {(page - 1) * limit + index + 1}
                                {doc._id && <span className="ml-2 text-foreground">• ID: {String(doc._id)}</span>}
                            </span>
                            <button
                                onClick={() => copyToClipboard(formatDocument(doc))}
                                className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                                title="Copy to clipboard"
                            >
                                <FiCopy size={12} />
                                Copy
                            </button>
                            </div>
                            <pre className="p-3 overflow-x-auto text-xs font-mono text-foreground bg-card whitespace-pre-wrap break-words">
                                {formatDocument(doc)}
                            </pre>
                        </div>
                        ))}
                    </div>
                )}
            </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-card shrink-0">
          <div className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="h-8 w-8 flex items-center justify-center border border-input rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FiChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="h-8 w-8 flex items-center justify-center border border-input rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FiChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
