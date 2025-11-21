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

  return (
    <div className="h-full flex flex-col bg-background rounded-none border-none shadow-none overflow-hidden">
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
              onChange={(e) => e.target.value && setQuery(e.target.value)}
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
            disabled={loading || !connectionString || !databaseName || !collectionName}
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
        <div className={`flex flex-col border-b md:border-b-0 md:border-r border-border transition-all duration-300 ${results ? 'h-1/3 md:h-full md:w-1/3' : 'h-full w-full'}`}>
          <div className="px-4 py-2 bg-muted/30 border-b border-border flex justify-between items-center">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Input
            </label>
            <span className="text-xs text-muted-foreground">Cmd + Enter to run</span>
          </div>
          <div className="flex-1 relative group bg-card">
            <textarea
              ref={textareaRef}
              value={query}
              onKeyDown={handleKeyDown}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-full p-4 bg-transparent text-foreground font-mono text-sm resize-none focus:outline-none leading-relaxed"
              placeholder='{"filter": {}, "limit": 10}'
              spellCheck="false"
            />
          </div>
          {error && (
            <div className="p-3 bg-destructive/10 border-t border-destructive/20 text-destructive text-xs flex justify-between items-start">
              <span className="font-medium">{error}</span>
              <button onClick={() => setError(null)}><FiX /></button>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className={`flex flex-col flex-1 bg-muted/10 min-w-0 ${!results ? 'hidden md:flex justify-center items-center' : ''}`}>
            {!results ? (
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
                                    onClick={() => setViewMode('table')}
                                    className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <FiGrid size={14} /> Table
                                </button>
                                <button 
                                    onClick={() => setViewMode('json')}
                                    className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${viewMode === 'json' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <FiCode size={14} /> JSON
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={() => copyToClipboard(formatResults(results))}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                        >
                            <FiCopy size={14} /> Copy
                        </button>
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
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="h-8 w-8 flex items-center justify-center border border-input rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <FiChevronLeft size={14} />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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