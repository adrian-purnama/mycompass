'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { FiPlay, FiCopy, FiX, FiChevronLeft, FiChevronRight, FiList, FiGrid, FiDatabase, FiCode } from 'react-icons/fi';

export default function QueryEditor({
  connectionString,
  databaseName,
  collectionName,
  onResults
}) {
  const [query, setQuery] = useState('{\n  "filter": {},\n  "limit": 10\n}');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queryHistory, setQueryHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(50); 
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'json'
  const textareaRef = useRef(null);

  const executeQuery = async () => {
    if (!connectionString || !databaseName || !collectionName) {
      setError('Please select a database and collection first');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      let parsedQuery;
      try {
        parsedQuery = JSON.parse(query);
      } catch (e) {
        setError('Invalid JSON format. Please check your query syntax.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString,
          databaseName,
          collectionName,
          query: parsedQuery
        })
      });

      const result = await response.json();
      if (result.success) {
        setResults(result.results);
        setQueryHistory((prev) => [query, ...prev.slice(0, 9)]);
        if (onResults) {
          onResults(result.results);
        }
      } else {
        setError(result.error || 'Query execution failed');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcut to execute
  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      executeQuery();
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Optional: Add toast notification here
  };

  const formatResults = (data) => JSON.stringify(data, null, 2);

  const getPaginatedResults = useMemo(() => {
    if (!results || !Array.isArray(results)) return [];
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return results.slice(startIndex, endIndex);
  }, [results, currentPage, rowsPerPage]);

  const totalPages = results ? Math.ceil(results.length / rowsPerPage) : 0;

  // Reset page when results change
  useEffect(() => {
    setCurrentPage(1);
  }, [results]);

  // Extract headers for table view
  const tableHeaders = useMemo(() => {
    if (!results || results.length === 0) return [];
    // Flatten first object keys or aggregate keys from first few items
    const keys = new Set();
    results.slice(0, 5).forEach(item => {
      Object.keys(item).forEach(k => keys.add(k));
    });
    return Array.from(keys);
  }, [results]);

  const renderCellValue = (value) => {
    if (typeof value === 'object' && value !== null) {
      return <span className="text-xs text-zinc-500 italic font-mono">{JSON.stringify(value).substring(0, 30) + (JSON.stringify(value).length > 30 ? '...' : '')}</span>;
    }
    if (typeof value === 'boolean') {
      return <span className={`text-xs px-1.5 py-0.5 rounded ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{String(value)}</span>;
    }
    return String(value);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FiDatabase className="text-blue-600 dark:text-blue-400" size={18} />
            </div>
            <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">MongoDB Query</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">JSON Filter / Aggregation</p>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
          {queryHistory.length > 0 && (
            <select
              onChange={(e) => e.target.value && setQuery(e.target.value)}
              className="text-xs h-9 px-3 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-blue-500 outline-none"
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
            disabled={loading || !connectionString || !databaseName || !collectionName}
            className="flex items-center gap-2 px-4 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <FiPlay size={16} className="fill-current" />
            )}
            {loading ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Editor Section */}
        <div className={`flex flex-col border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 ${results ? 'h-1/3 md:h-full md:w-1/3' : 'h-full w-full'}`}>
          <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Input
            </label>
            <span className="text-xs text-zinc-400">Cmd + Enter to run</span>
          </div>
          <div className="flex-1 relative group">
            <textarea
              ref={textareaRef}
              value={query}
              onKeyDown={handleKeyDown}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-full p-4 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-mono text-sm resize-none focus:outline-none leading-relaxed"
              placeholder='{"filter": {}, "limit": 10}'
              spellCheck="false"
            />
          </div>
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex justify-between items-start">
              <span className="font-medium">{error}</span>
              <button onClick={() => setError(null)}><FiX /></button>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className={`flex flex-col flex-1 bg-zinc-50/50 dark:bg-zinc-900/50 min-w-0 ${!results ? 'hidden md:flex justify-center items-center' : ''}`}>
            {!results ? (
                <div className="text-center text-zinc-400 p-8">
                    <FiDatabase size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Execute a query to see results here.</p>
                </div>
            ) : (
                <>
                    <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                Results <span className="text-zinc-400 font-normal">({results.length} docs)</span>
                            </span>
                            <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-md p-0.5">
                                <button 
                                    onClick={() => setViewMode('table')}
                                    className={`p-1.5 rounded text-xs flex items-center gap-1.5 transition-all ${viewMode === 'table' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                                >
                                    <FiGrid size={14} /> Table
                                </button>
                                <button 
                                    onClick={() => setViewMode('json')}
                                    className={`p-1.5 rounded text-xs flex items-center gap-1.5 transition-all ${viewMode === 'json' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                                >
                                    <FiCode size={14} /> JSON
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={() => copyToClipboard(formatResults(results))}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                        >
                            <FiCopy size={14} /> Copy
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                        <div className="absolute inset-0 overflow-auto">
                            {viewMode === 'json' ? (
                                <pre className="p-4 text-xs font-mono text-zinc-800 dark:text-zinc-200 whitespace-pre">
                                    {formatResults(getPaginatedResults)}
                                </pre>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-zinc-50 dark:bg-zinc-900 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 w-12 text-xs font-medium text-zinc-400 text-center">#</th>
                                            {tableHeaders.map(header => (
                                                <th key={header} className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50 bg-white dark:bg-zinc-950">
                                        {getPaginatedResults.map((row, i) => (
                                            <tr key={i} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors group">
                                                <td className="px-4 py-2 text-xs text-zinc-400 text-center font-mono">
                                                    {((currentPage - 1) * rowsPerPage) + i + 1}
                                                </td>
                                                {tableHeaders.map(header => (
                                                    <td key={`${i}-${header}`} className="px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap max-w-xs truncate">
                                                        {row[header] !== undefined ? renderCellValue(row[header]) : <span className="text-zinc-300">-</span>}
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
                        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between shrink-0">
                            <span className="text-xs text-zinc-500">
                                Page {currentPage} of {totalPages}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-600 dark:text-zinc-300"
                                >
                                    <FiChevronLeft size={16} />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-600 dark:text-zinc-300"
                                >
                                    <FiChevronRight size={16} />
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