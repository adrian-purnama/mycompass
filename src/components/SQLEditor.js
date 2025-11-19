"use client";

import { useState, useMemo, useEffect } from "react";
import {
  FiPlay,
  FiCopy,
  FiX,
  FiCode,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";

export default function SQLEditor({
  connectionString,
  databaseName,
  onResults,
}) {
  const [sqlQuery, setSqlQuery] = useState(
    "SELECT * FROM collection_name LIMIT 10"
  );
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queryHistory, setQueryHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(100); // Show 100 rows per page

  const executeQuery = async () => {
    if (!connectionString || !databaseName) {
      setError("Please select a database first");
      return;
    }

    if (!sqlQuery.trim()) {
      setError("Please enter a SQL query");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch("/api/sql-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionString,
          databaseName,
          sqlQuery: sqlQuery.trim(),
        }),
      });

      const result = await response.json();
      if (result.success) {
        setResults(result.results);
        setQueryHistory((prev) => [sqlQuery, ...prev.slice(0, 9)]); // Keep last 10 queries
        if (onResults) {
          onResults(result.results);
        }
      } else {
        setError(result.error || "Query execution failed");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const formatResults = (data) => {
    return JSON.stringify(data, null, 2);
  };


  // Get paginated JSON results
  const getPaginatedResults = useMemo(() => {
    if (!results || !Array.isArray(results)) return [];
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return results.slice(startIndex, endIndex);
  }, [results, currentPage, rowsPerPage]);

  const totalPages = results ? Math.ceil(results.length / rowsPerPage) : 0;

  const copyAsJSON = () => {
    copyToClipboard(formatResults(results));
  };

  // Reset to page 1 when results change
  useEffect(() => {
    setCurrentPage(1);
  }, [results]);

  const loadQueryFromHistory = (historyQuery) => {
    setSqlQuery(historyQuery);
  };

  return (
    <div className="h-full flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 min-h-0 min-w-0">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
        <h3 className="font-semibold text-black dark:text-zinc-50">
          SQL Query Editor (QueryLeaf)
        </h3>
        <div className="flex items-center gap-2">
          {queryHistory.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) loadQueryFromHistory(e.target.value);
              }}
              className="text-xs px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-black dark:text-zinc-50"
              defaultValue=""
            >
              <option value="">Query History</option>
              {queryHistory.map((q, i) => (
                <option key={i} value={q}>
                  Query {i + 1}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={executeQuery}
            disabled={loading || !connectionString || !databaseName}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiPlay size={16} />
            {loading ? "Executing..." : "Execute"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
            <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
              SQL Query
            </label>
            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="w-full h-48 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-950 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none overflow-x-auto break-words"
              placeholder="SELECT * FROM collection_name WHERE field = 'value' LIMIT 10"
            />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Use SQL syntax to query MongoDB collections. Example: SELECT *
              FROM users WHERE age &gt; 25
            </p>
          </div>

          {error && (
            <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-center justify-between">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
                <button
                  onClick={() => setError(null)}
                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  <FiX size={16} />
                </button>
              </div>
            </div>
          )}

          {results && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="flex items-center justify-between mb-4 px-4 pt-4 flex-shrink-0 overflow-hidden">
                <h4 className="font-medium text-black dark:text-zinc-50">
                  Results ({results.length} row{results.length !== 1 ? "s" : ""}
                  )
                  {totalPages > 1 && (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-2">
                      (Page {currentPage} of {totalPages})
                    </span>
                  )}
                </h4>
                <div className="flex items-center gap-2">
                  {/* Copy Button */}
                  <button
                    onClick={copyAsJSON}
                    className="flex items-center gap-1 px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md text-sm font-medium transition-colors"
                    title="Copy as JSON"
                  >
                    <FiCopy size={14} />
                    Copy JSON
                  </button>
                </div>
              </div>

              {/* JSON View */}
              <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4 min-h-0">
                <div className="flex-1 min-h-0 overflow-auto">
                  <pre
                    className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm font-mono text-black dark:text-zinc-50 whitespace-pre"
                    style={{ margin: 0, display: "block" }}
                  >
                    {formatResults(getPaginatedResults)}
                  </pre>
                </div>
                {results.length > rowsPerPage && (
                  <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                    Showing {getPaginatedResults.length} of {results.length}{" "}
                    results
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
                    {Math.min(currentPage * rowsPerPage, results.length)} of{" "}
                    {results.length} results
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiChevronLeft size={16} />
                      Previous
                    </button>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <FiChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
