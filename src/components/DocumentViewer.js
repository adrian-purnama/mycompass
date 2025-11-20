'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FiChevronLeft, FiChevronRight, FiCopy, FiRefreshCw } from 'react-icons/fi';

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

  if (!connectionString || !databaseName || !collectionName) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 dark:text-zinc-400">
        <div className="text-center">
          <p>Select a collection to view documents</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h3 className="font-semibold text-black dark:text-zinc-50">
            {databaseName}.{collectionName}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {total.toLocaleString()} document{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {loading && documents.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
            <p>Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
            <p>No documents found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc, index) => (
              <div
                key={doc._id || index}
                className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 break-words max-w-md truncate" title={doc._id ? `Document ${index + 1 + (page - 1) * limit} • ID: ${doc._id}` : `Document ${index + 1 + (page - 1) * limit}`}>
                    Document {index + 1 + (page - 1) * limit}
                    {doc._id && ` • ID: ${doc._id}`}
                  </span>
                  <button
                    onClick={() => copyToClipboard(formatDocument(doc))}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                    title="Copy to clipboard"
                  >
                    <FiCopy size={14} />
                    Copy
                  </button>
                </div>
                <pre className="p-4 overflow-x-auto text-sm font-mono text-black dark:text-zinc-50 bg-white dark:bg-zinc-950 whitespace-pre-wrap break-words max-w-full">
                  {formatDocument(doc)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="flex items-center gap-1 px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiChevronLeft size={16} />
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="flex items-center gap-1 px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <FiChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

