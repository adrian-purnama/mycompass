'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { FiPlay, FiCopy, FiX, FiChevronLeft, FiChevronRight, FiList, FiGrid, FiTerminal, FiDownload, FiDatabase } from 'react-icons/fi';

export default function SQLEditor({
  connectionString,
  connectionId,
  organizationId,
  databaseName,
  onResults,
}) {
  const [sqlQuery, setSqlQuery] = useState(
    "SELECT * FROM collection_name LIMIT 10"
  );
  const [results, setResults] = useState(null);
  const [resultsVisible, setResultsVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queryHistory, setQueryHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(50); 
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'json'
  const textareaRef = useRef(null);
  const executingRef = useRef(false);
  
  // Autocomplete state
  const [collections, setCollections] = useState([]);
  const [fieldNamesCache, setFieldNamesCache] = useState({}); // { collectionName: [field1, field2, ...] }
  const fieldNamesCacheRef = useRef({}); // Ref to always have latest cache
  const [autocompleteState, setAutocompleteState] = useState({
    show: false,
    suggestions: [],
    selectedIndex: 0,
    startPos: 0,
    endPos: 0,
    type: null, // 'collection' or 'field'
    collectionName: null
  });
  const autocompleteRef = useRef(null);
  
  // Keep ref in sync with state
  useEffect(() => {
    fieldNamesCacheRef.current = fieldNamesCache;
  }, [fieldNamesCache]);

  const executeQuery = async () => {
    // Prevent concurrent executions
    if (loading || executingRef.current) {
      return;
    }

    if ((!connectionString && !connectionId) || !databaseName) {
      setError("Please select a database first");
      return;
    }

    if (!sqlQuery || !sqlQuery.trim()) {
      setError("Please enter a SQL query");
      return;
    }

    executingRef.current = true;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const token = localStorage.getItem('auth_token');
      const body = {
        databaseName,
        sqlQuery: sqlQuery.trim(),
      };

      // If connectionString is available (admin), use it. Otherwise use connectionId (member)
      if (connectionString) {
        body.connectionString = connectionString;
      } else if (connectionId && organizationId) {
        body.connectionId = connectionId;
        body.organizationId = organizationId;
      } else {
        setError("Connection information is missing");
        setLoading(false);
        executingRef.current = false;
        return;
      }

      const response = await fetch("/api/sql-query", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (result.success) {
        setResults(result.results);
        setResultsVisible(true);
        setQueryHistory((prev) => [sqlQuery, ...prev.slice(0, 9)]);
        if (onResults) {
          onResults(result.results);
        }
      } else {
        setError(result.error || "Query execution failed");
      }
    } catch (error) {
      setError(error.message || 'Failed to execute query');
    } finally {
      setLoading(false);
      executingRef.current = false;
    }
  };

  // Extract all field names from a document (including nested fields)
  const extractFieldNames = (obj, prefix = '') => {
    const fields = [];
    if (obj === null || obj === undefined) return fields;
    
    if (Array.isArray(obj) && obj.length > 0) {
      // For arrays, extract fields from first element
      return extractFieldNames(obj[0], prefix);
    }
    
    if (typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        fields.push(fieldPath);
        
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          fields.push(...extractFieldNames(obj[key], fieldPath));
        } else if (Array.isArray(obj[key]) && obj[key].length > 0 && typeof obj[key][0] === 'object') {
          fields.push(...extractFieldNames(obj[key][0], fieldPath));
        }
      });
    }
    
    return fields;
  };

  // Fetch field names from a collection
  const loadFieldNames = useCallback(async (collectionName) => {
    if (!collectionName || !databaseName || (!connectionString && !connectionId)) {
      return [];
    }

    // Check cache first using ref to get latest value
    const cached = fieldNamesCacheRef.current[collectionName];
    if (cached) {
      return cached;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const body = {
        databaseName,
        collectionName,
        query: {},
        options: {
          limit: 1,
          skip: 0,
          sort: { _id: 1 }
        }
      };

      if (connectionString) {
        body.connectionString = connectionString;
      } else if (connectionId && organizationId) {
        body.connectionId = connectionId;
        body.organizationId = organizationId;
      } else {
        return [];
      }

      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      if (result.success && result.documents && result.documents.length > 0) {
        const doc = result.documents[0];
        const fields = extractFieldNames(doc);
        const newCache = { ...fieldNamesCacheRef.current, [collectionName]: fields };
        fieldNamesCacheRef.current = newCache;
        setFieldNamesCache(newCache);
        return fields;
      }
    } catch (error) {
      console.error('Failed to load field names:', error);
    }

    return [];
  }, [databaseName, connectionString, connectionId, organizationId]);

  // Autocomplete detection
  const detectAutocomplete = useCallback(async (text, cursorPos) => {
    if (!text || cursorPos < 0 || collections.length === 0) {
      setAutocompleteState(prev => ({ ...prev, show: false }));
      return;
    }

    // Get text before cursor
    const textBefore = text.substring(0, cursorPos);
    
    // Check for collection.field pattern (most specific first)
    const fieldPattern = /(\w+)\.(\w*)$/;
    const fieldMatch = textBefore.match(fieldPattern);
    
    if (fieldMatch) {
      const collectionName = fieldMatch[1];
      const partialField = fieldMatch[2] || '';
      
      // Check if collection exists
      if (collections.includes(collectionName)) {
        const fields = await loadFieldNames(collectionName);
        const filtered = fields.filter(f => f.toLowerCase().startsWith(partialField.toLowerCase()));
        
        if (filtered.length > 0) {
          const startPos = cursorPos - partialField.length;
          setAutocompleteState({
            show: true,
            suggestions: filtered,
            selectedIndex: 0,
            startPos,
            endPos: cursorPos,
            type: 'field',
            collectionName
          });
          return;
        }
      }
    }
    
    // Check for collection name context (after FROM)
    // Match: FROM collection_name or SELECT * FROM collection_name
    const fromPattern = /FROM\s+(\w*)$/i;
    const fromMatch = textBefore.match(fromPattern);
    
    if (fromMatch) {
      const partialCollection = fromMatch[1] || '';
      const filtered = collections.filter(c => 
        c.toLowerCase().startsWith(partialCollection.toLowerCase())
      );
      
      // Show autocomplete if we have matches OR if we just typed "FROM " (empty partial)
      if (filtered.length > 0 || partialCollection.length === 0) {
        const startPos = cursorPos - partialCollection.length;
        setAutocompleteState({
          show: true,
          suggestions: filtered.length > 0 ? filtered : collections.slice(0, 20),
          selectedIndex: 0,
          startPos,
          endPos: cursorPos,
          type: 'collection',
          collectionName: null
        });
        return;
      }
    }
    
    // Check for SELECT field list (simpler pattern)
    const selectPattern = /SELECT\s+(\w*)$/i;
    const selectMatch = textBefore.match(selectPattern);
    
    if (selectMatch && !textBefore.match(/FROM/i)) {
      // Only show if we haven't reached FROM yet
      const partialField = selectMatch[1] || '';
      // For SELECT, we could show collections or common fields, but let's show collections
      const filtered = collections.filter(c => 
        c.toLowerCase().startsWith(partialField.toLowerCase())
      );
      
      if (filtered.length > 0 || partialField.length === 0) {
        const startPos = cursorPos - partialField.length;
        setAutocompleteState({
          show: true,
          suggestions: filtered.length > 0 ? filtered : collections.slice(0, 10),
          selectedIndex: 0,
          startPos,
          endPos: cursorPos,
          type: 'collection',
          collectionName: null
        });
        return;
      }
    }
    
    // Hide autocomplete if no match
    setAutocompleteState(prev => ({ ...prev, show: false }));
  }, [collections, loadFieldNames]);

  // Handle textarea change
  const handleTextChange = (e) => {
    const newValue = e.target.value;
    setSqlQuery(newValue);
    
    // Detect autocomplete
    const cursorPos = e.target.selectionStart;
    setTimeout(() => {
      detectAutocomplete(newValue, cursorPos);
    }, 0);
  };

  // Handle cursor position change
  const handleCursorChange = () => {
    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart;
      detectAutocomplete(sqlQuery, cursorPos);
    }
  };

  // Insert autocomplete suggestion
  const insertAutocompleteSuggestion = () => {
    if (!autocompleteState.show || autocompleteState.suggestions.length === 0) return;
    
    const suggestion = autocompleteState.suggestions[autocompleteState.selectedIndex];
    if (!suggestion) return;
    
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const before = sqlQuery.substring(0, autocompleteState.startPos);
    const after = sqlQuery.substring(autocompleteState.endPos);
    const newText = before + suggestion + after;
    
    setSqlQuery(newText);
    
    // Set cursor position after inserted text
    const newCursorPos = autocompleteState.startPos + suggestion.length;
    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        detectAutocomplete(newText, newCursorPos);
      }
    }, 0);
    
    setAutocompleteState(prev => ({ ...prev, show: false }));
  };

  // Calculate autocomplete dropdown position
  const calculateAutocompletePosition = () => {
    const textarea = textareaRef.current;
    if (!textarea) return { top: 0, left: 0 };

    // Get cursor position in textarea
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = sqlQuery.substring(0, cursorPos);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines.length - 1;
    const column = lines[currentLine].length;

    // Create a temporary span to measure text width accurately
    const textareaStyle = window.getComputedStyle(textarea);
    const font = textareaStyle.font;
    const fontSize = parseFloat(textareaStyle.fontSize);
    const lineHeight = parseFloat(textareaStyle.lineHeight) || fontSize * 1.2;
    const charWidth = fontSize * 0.6; // Approximate for monospace
    
    // Get textarea position relative to viewport
    const rect = textarea.getBoundingClientRect();
    const scrollTop = textarea.scrollTop;
    const scrollLeft = textarea.scrollLeft;
    
    // Calculate position relative to textarea container
    const padding = 16; // Padding from textarea
    const top = (currentLine * lineHeight) - scrollTop + lineHeight + padding;
    const left = (column * charWidth) - scrollLeft + padding;

    return { top, left };
  };

  // Keyboard shortcut and autocomplete navigation
  const handleKeyDown = (e) => {
    // Handle autocomplete navigation
    if (autocompleteState.show && autocompleteState.suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteState(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, prev.suggestions.length - 1)
        }));
        return;
      }
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteState(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, 0)
        }));
        return;
      }
      
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertAutocompleteSuggestion();
        return;
      }
      
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocompleteState(prev => ({ ...prev, show: false }));
        return;
      }
    }
    
    // Execute query shortcut
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
      filename = `sql-query-results-${databaseName}-${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
    } else if (format === 'csv') {
      // Convert to CSV
      if (results.length === 0) return;
      
      // Get all unique keys from all documents
      const allKeys = new Set();
      results.forEach(doc => {
        Object.keys(doc).forEach(k => allKeys.add(k));
      });
      const headers = Array.from(allKeys).sort((a, b) => {
        if (a === '_id') return -1;
        if (b === '_id') return 1;
        return a.localeCompare(b);
      });

      // Create CSV rows
      const csvRows = [];
      csvRows.push(headers.join(',')); // Header row

      results.forEach(doc => {
        const row = headers.map(header => {
          const value = doc[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') {
            // Convert objects/arrays to JSON string and escape quotes
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          }
          // Escape quotes and wrap in quotes if contains comma, newline, or quote
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        });
        csvRows.push(row.join(','));
      });

      content = csvRows.join('\n');
      filename = `sql-query-results-${databaseName}-${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
    }

    // Create download link
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

  const getPaginatedResults = useMemo(() => {
    if (!results || !Array.isArray(results)) return [];
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return results.slice(startIndex, endIndex);
  }, [results, currentPage, rowsPerPage]);

  const totalPages = results ? Math.ceil(results.length / rowsPerPage) : 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [results]);

  // Fetch collections when databaseName changes
  const loadCollections = useCallback(async () => {
    if (!databaseName || (!connectionString && !connectionId)) {
      setCollections([]);
      return;
    }

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
        setCollections(collectionsList);
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
    }
  }, [databaseName, connectionString, connectionId, organizationId]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target)
      ) {
        setAutocompleteState(prev => ({ ...prev, show: false }));
      }
    };

    if (autocompleteState.show) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [autocompleteState.show]);

  // Get Headers for Table
  const tableHeaders = useMemo(() => {
    if (!results || results.length === 0) return [];
    return Object.keys(results[0]);
  }, [results]);

  const renderCellValue = (value) => {
    if (value === null) return <span className="text-zinc-400 italic">NULL</span>;
    if (typeof value === 'object') return <span className="text-zinc-500 italic font-mono">[Object]</span>;
    return String(value);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <FiTerminal className="text-emerald-600 dark:text-emerald-400" size={18} />
            </div>
            <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">SQL Editor</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">sqltomango</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
          {queryHistory.length > 0 && (
            <select
              onChange={(e) => e.target.value && setSqlQuery(e.target.value)}
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
            disabled={loading || (!connectionString && !connectionId) || !databaseName}
            className="flex items-center gap-2 px-4 h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
                 <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <FiPlay size={16} className="fill-current" />
            )}
            {loading ? "Running..." : "Run"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Editor Input */}
        <div className={`flex flex-col border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 ${results && resultsVisible ? 'h-1/3 md:h-full md:w-1/3' : 'h-full w-full'}`}>
            <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                SQL Query
                </label>
                <div className="flex items-center gap-3">
                  {results && !resultsVisible && (
                    <button
                      onClick={() => setResultsVisible(true)}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                      title="Show results"
                    >
                      <FiDatabase size={12} />
                      <span>Show Results ({results.length})</span>
                    </button>
                  )}
                <span className="text-xs text-zinc-400">Cmd + Enter to run</span>
                </div>
            </div>
            <div className="flex-1 relative overflow-visible">
                <textarea
                    ref={textareaRef}
                    value={sqlQuery}
                    onKeyDown={handleKeyDown}
                    onChange={handleTextChange}
                    onClick={handleCursorChange}
                    onSelect={handleCursorChange}
                    className="w-full h-full p-4 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-mono text-sm resize-none focus:outline-none leading-relaxed"
                    placeholder="SELECT * FROM users WHERE age > 25"
                    spellCheck="false"
                />
                
                {/* Autocomplete Dropdown */}
                {autocompleteState.show && autocompleteState.suggestions.length > 0 && (
                  <div
                    ref={autocompleteRef}
                    className="absolute z-[100] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl max-h-60 overflow-y-auto min-w-[200px]"
                    style={{
                      top: `${calculateAutocompletePosition().top}px`,
                      left: `${calculateAutocompletePosition().left}px`
                    }}
                  >
                    {autocompleteState.suggestions.map((suggestion, index) => (
                      <div
                        key={suggestion}
                        onClick={() => {
                          setAutocompleteState(prev => ({ ...prev, selectedIndex: index }));
                          insertAutocompleteSuggestion();
                        }}
                        onMouseEnter={() => setAutocompleteState(prev => ({ ...prev, selectedIndex: index }))}
                        className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-sm ${
                          index === autocompleteState.selectedIndex
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {autocompleteState.type === 'collection' ? (
                          <FiDatabase size={14} className="text-zinc-400" />
                        ) : (
                          <span className="text-zinc-400 text-xs">•</span>
                        )}
                        <span className="font-mono">{suggestion}</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
            {error && (
                 <div className="p-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex justify-between items-start">
                 <span className="font-medium">{error}</span>
                 <button onClick={() => setError(null)}><FiX /></button>
               </div>
            )}
        </div>

        {/* Results Display */}
        <div className={`flex flex-col flex-1 bg-zinc-50/50 dark:bg-zinc-900/50 min-w-0 ${!results || !resultsVisible ? 'hidden md:flex justify-center items-center' : ''}`}>
          {!results || !resultsVisible ? (
             <div className="text-center text-zinc-400 p-8">
                <FiTerminal size={48} className="mx-auto mb-4 opacity-20" />
                <p>Execute a SQL query to see results.</p>
            </div>
          ) : (
            <>
              <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            Results <span className="text-zinc-400 font-normal">({results.length} rows)</span>
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
                                <FiList size={14} /> JSON
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => copyToClipboard(formatResults(results))}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                            title="Copy results to clipboard"
                        >
                            <FiCopy size={14} /> Copy
                        </button>
                        <button
                            onClick={() => downloadResults('json')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                            title="Download as JSON"
                        >
                            <FiDownload size={14} /> JSON
                        </button>
                        <button
                            onClick={() => downloadResults('csv')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                            title="Download as CSV"
                        >
                            <FiDownload size={14} /> CSV
                        </button>
                        <button
                            onClick={() => setResultsVisible(false)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                            title="Close results"
                        >
                            <FiX size={14} />
                        </button>
                    </div>
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
                                    <tr key={i} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors group">
                                        <td className="px-4 py-2 text-xs text-zinc-400 text-center font-mono">
                                            {((currentPage - 1) * rowsPerPage) + i + 1}
                                        </td>
                                        {tableHeaders.map(header => (
                                            <td key={`${i}-${header}`} className="px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap max-w-xs truncate">
                                                {renderCellValue(row[header])}
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
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                     Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-600 dark:text-zinc-300"
                    >
                      <FiChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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