import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { StructuredLog } from '../../lib/parser/logParser';
import type { ParsedFileMetadata, IndexGroupSummary } from '../../lib/parser/logIndex';
import { Play, Filter, X, Clock, ChevronRight, ChevronsUpDown, FileText, Layers, AlertCircle, RefreshCw, Database } from 'lucide-react';

interface LogTimelineProps {
  logs: StructuredLog[];                    // Legacy - can be empty
  fileMetadata?: ParsedFileMetadata[];      // NEW - lightweight metadata
  workerRef?: React.RefObject<Worker | null>; // NEW - for background grouping
  onParse?: () => void;
  onOpenRequest?: (id: string) => void;
  hasContent?: boolean;
  isParsing?: boolean;
  externalUniqueIds?: { requestIds: string[]; correlationIds: string[] };
}




const HTTP_VERBS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
const PAGE_SIZE = 50;

export function LogTimeline({ 
  logs, 
  fileMetadata,
  workerRef,
  onOpenRequest, 
  isParsing = false, 
  externalUniqueIds 
}: LogTimelineProps) {
  const [filterRequestId, setFilterRequestId] = useState('');
  const [isRequestIdFocused, setIsRequestIdFocused] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set(['INF', 'WRN', 'ERR', 'DBG']));
  const [selectedVerbs, setSelectedVerbs] = useState<Set<string>>(new Set(HTTP_VERBS));
  const [allExpanded, setAllExpanded] = useState(false);
  const [groupingMode, setGroupingMode] = useState<'requestId' | 'correlationId'>('requestId');
  const [showSlowQueriesOnly, setShowSlowQueriesOnly] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  
  // Async Calculation State
  const [isCalculating, setIsCalculating] = useState(false);
  const [indexGroups, setIndexGroups] = useState<IndexGroupSummary[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  
  // Cache for fetched log content (group ID -> logs)
  const [fetchedLogs, setFetchedLogs] = useState<Map<string, StructuredLog[]>>(new Map());
  const [fetchingGroups, setFetchingGroups] = useState<Set<string>>(new Set());
  
  // Compute time tracking
  const [computeTimeMs, setComputeTimeMs] = useState<number | null>(null);
  const [fromCache, setFromCache] = useState(false);

  // Determine mode: index-based or legacy
  const isIndexMode = fileMetadata && fileMetadata.length > 0;
  
  // Total event count
  const totalEvents = useMemo(() => {
    if (isIndexMode) {
      // NOTE: With metadata only, we might rely on stats.total or similar
      // But ParsedFileMetadata removed entries but KEPT stats? 
      // Yes, stats object is there.
      return fileMetadata.reduce((sum, f) => sum + f.stats.total, 0);
    }
    return logs.length;
  }, [isIndexMode, fileMetadata, logs.length]);

  // Merge all index entries with OPFS paths
  // DEPRECATED/REMOVED: We don't have entries here anymore.
  // const allEntries = useMemo(() => { ... });
  const allEntries: any[] = []; 
  
  // Source filtering logic needs updates too if it relied on allEntries
  // Ideally, unique sources should come from metadata (if we stored uniqueSources in metadata)
  // Worker handles filtering now, so we might just need list of ALL available sources from metadata?
  // ParsedFileMetadata usually has sourceStats which keys are sources.
  const uniqueSources = useMemo(() => {
    if (isIndexMode) {
      const sources = new Set<string>();
      fileMetadata.forEach(f => {
        if (f.sourceStats) {
          Object.keys(f.sourceStats).forEach(s => sources.add(s));
        }
      });
      return Array.from(sources);
    }
    const sources = new Set<string>();
    logs.forEach(l => { if (l.source) sources.add(l.source); });
    return Array.from(sources);
  }, [isIndexMode, fileMetadata, logs]);
  
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (uniqueSources.length > 0) {
      setSelectedSources(prev => {
        const next = new Set(prev);
        uniqueSources.forEach(s => next.add(s));
        return next;
      });
    }
  }, [uniqueSources]);

  // Listen for worker results
  useEffect(() => {
    if (!workerRef?.current) return;

    const handler = (e: MessageEvent) => {
      const { type, payload } = e.data;
      if (type === 'groupResult') {
        setIndexGroups(payload.groups);
        setFetchedLogs(new Map());
        setFetchingGroups(new Set());
        setVisibleCount(PAGE_SIZE);
        setIsCalculating(false);
        // Extract compute time info
        if (payload.computeTimeMs !== undefined) {
          setComputeTimeMs(payload.computeTimeMs);
        }
        setFromCache(payload.fromCache || false);
      } else if (type === 'groupDetailsResult') {
        // payload: { groupId, logs }
        const { groupId, logs } = payload;
        setFetchedLogs(prev => new Map(prev).set(groupId, logs));
        setFetchingGroups(prev => {
           const next = new Set(prev);
           next.delete(groupId);
           return next;
        });
      }
    };

    workerRef.current.addEventListener('message', handler);
    return () => {
      workerRef.current?.removeEventListener('message', handler);
    };
  }, [workerRef]);

  // Group index entries (INDEX MODE) - delegated to worker
  useEffect(() => {
    if (!isIndexMode || !workerRef?.current) return;
    
    // If we have no indices, clear groups
    if (!fileMetadata || fileMetadata.length === 0) {
      setIndexGroups([]);
      return;
    }

    setIsCalculating(true);
    
    // Send grouping request to worker
    // Debounce slightly to avoid rapid updates
    const timer = setTimeout(() => {
      workerRef.current?.postMessage({
        type: 'groupEntries',
        payload: {
          files: fileMetadata, // Send metadata (contains opfsPath)
          selectedLevels: Array.from(selectedLevels),
          selectedVerbs: Array.from(selectedVerbs),
          selectedSources: Array.from(selectedSources),
          filterRequestId,
          groupingMode,
          showSlowQueriesOnly
        }
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [isIndexMode, fileMetadata, selectedLevels, selectedVerbs, selectedSources, filterRequestId, groupingMode, showSlowQueriesOnly, workerRef]);

  // LEGACY MODE: Group full logs
  const [legacyGroupedEntries, setLegacyGroupedEntries] = useState<[string, StructuredLog[]][]>([]);

  useEffect(() => {
    if (isIndexMode || logs.length === 0) {
      setLegacyGroupedEntries([]);
      return;
    }

    setIsCalculating(true);
    
    const timer = setTimeout(() => {
      const filtered = logs.filter(log => {
        if (!selectedLevels.has(log.level)) return false;
        if (log.httpMethod && !selectedVerbs.has(log.httpMethod)) return false;
        if (log.source && !selectedSources.has(log.source)) return false;
        if (showSlowQueriesOnly && !log.isSlowSql) return false;
        if (filterRequestId) {
          const idToMatch = groupingMode === 'requestId' ? log.requestId : (log.metadata?.CorrelationId || '');
          if (!idToMatch.toLowerCase().includes(filterRequestId.toLowerCase())) return false;
        }
        return true;
      });

      const groups: Record<string, StructuredLog[]> = {};
      filtered.forEach((log) => {
        let id = groupingMode === 'requestId' ? log.requestId : (log.metadata?.CorrelationId || 'Global / Startup');
        if (!id) id = 'Global / Startup';
        if (!groups[id]) groups[id] = [];
        groups[id].push(log);
      });

      setLegacyGroupedEntries(Object.entries(groups));
      setVisibleCount(PAGE_SIZE);
      setIsCalculating(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [isIndexMode, logs, selectedLevels, selectedVerbs, selectedSources, filterRequestId, groupingMode, showSlowQueriesOnly]);

  /**
   * Fetch actual log content for a group (INDEX MODE)
   */
  const fetchGroupLogs = useCallback(async (group: IndexGroupSummary) => {
    if (fetchedLogs.has(group.id) || fetchingGroups.has(group.id) || !workerRef?.current) return;
    
    setFetchingGroups(prev => new Set(prev).add(group.id));
    
    // Request details from worker
    workerRef.current.postMessage({
       type: 'fetchGroupDetails',
       payload: { groupId: group.id }
    });
  }, [fetchedLogs, fetchingGroups, workerRef]);

  const requestIdInputRef = useRef<HTMLDivElement>(null);

  const toggleLevel = (level: string) => {
    const next = new Set(selectedLevels);
    if (next.has(level)) next.delete(level);
    else next.add(level);
    setSelectedLevels(next);
  };

  const toggleVerb = (verb: string) => {
    const next = new Set(selectedVerbs);
    if (next.has(verb)) next.delete(verb);
    else next.add(verb);
    setSelectedVerbs(next);
  };

  const toggleSource = (source: string) => {
    const next = new Set(selectedSources);
    if (next.has(source)) next.delete(source);
    else next.add(source);
    setSelectedSources(next);
  };

  const uniqueRequestIds = useMemo(() => {
    if (externalUniqueIds) return externalUniqueIds.requestIds;
    if (isIndexMode) {
      const ids = new Set<string>();
      allEntries.filter(e => !e.source || selectedSources.has(e.source))
          .forEach(e => { if (e.requestId) ids.add(e.requestId); });
      return Array.from(ids);
    }
    const ids = new Set<string>();
    logs.filter(l => !l.source || selectedSources.has(l.source))
        .forEach(l => { if (l.requestId) ids.add(l.requestId); });
    return Array.from(ids);
  }, [isIndexMode, allEntries, logs, selectedSources, externalUniqueIds]);

  const hasCorrelationIds = useMemo(() => {
    if (externalUniqueIds) return externalUniqueIds.correlationIds.length > 0;
    if (isIndexMode) return allEntries.some(e => e.correlationId);
    return logs.some(l => l.metadata?.CorrelationId);
  }, [isIndexMode, allEntries, logs, externalUniqueIds]);

  const uniqueCorrelationIds = useMemo(() => {
    if (externalUniqueIds) return externalUniqueIds.correlationIds;
    if (isIndexMode) {
      const ids = new Set<string>();
      allEntries.filter(e => !e.source || selectedSources.has(e.source))
          .forEach(e => { if (e.correlationId) ids.add(e.correlationId); });
      return Array.from(ids);
    }
    const ids = new Set<string>();
    logs.filter(l => !l.source || selectedSources.has(l.source))
        .forEach(l => { if (l.metadata?.CorrelationId) ids.add(l.metadata.CorrelationId); });
    return Array.from(ids);
  }, [isIndexMode, allEntries, logs, selectedSources, externalUniqueIds]);

  const activeUniqueIds = useMemo(() => {
    return groupingMode === 'requestId' ? uniqueRequestIds : uniqueCorrelationIds;
  }, [groupingMode, uniqueRequestIds, uniqueCorrelationIds]);

  const filteredRequestIds = useMemo(() => {
    return activeUniqueIds.filter(id => id.toLowerCase().includes(filterRequestId.toLowerCase()));
  }, [activeUniqueIds, filterRequestId]);

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString.replace(' ', 'T'));
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      }).format(date);
    } catch { return isoString; }
  };

  const getGroupDuration = (groupLogs: StructuredLog[]) => {
    if (groupLogs.length < 2) return null;
    try {
      const start = new Date(groupLogs[0].timestamp.replace(' ', 'T')).getTime();
      const end = new Date(groupLogs[groupLogs.length - 1].timestamp.replace(' ', 'T')).getTime();
      const diff = end - start;
      if (diff <= 0) return '<1ms';
      if (diff < 1000) return `${diff}ms`;
      return `${(diff / 1000).toFixed(2)}s`;
    } catch { return null; }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (requestIdInputRef.current && !requestIdInputRef.current.contains(e.target as Node)) {
        setIsRequestIdFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine group count to show
  const groupCount = isIndexMode ? indexGroups.length : legacyGroupedEntries.length;

  return (
    <div className="flex flex-col h-full bg-bg-app text-text-primary border-l border-border relative overflow-hidden">
      {(isParsing || isCalculating) && (
        <div className="absolute inset-0 z-[100] bg-bg-app/50 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-300">
           <div className="flex flex-col items-center space-y-4 p-8 rounded-3xl bg-bg-panel border border-border shadow-2xl">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-text-primary">{isCalculating ? 'Computing Timeline...' : 'Processing Logs...'}</span>
                <span className="text-[10px] text-text-muted mt-1">Hanging tight while we crunch the data</span>
              </div>
           </div>
        </div>
      )}
      
      {/* Search & Toolbars */}
      <div className="border-b border-border bg-bg-panel/95 backdrop-blur-md z-30 sticky top-0 flex flex-col shadow-sm">
        <div className="px-4 py-2.5 border-b border-border/50 flex flex-wrap items-center justify-between bg-bg-panel/50 gap-3">
          <div className="flex items-center space-x-4 flex-wrap gap-y-2">
            <h2 className="font-black text-[10px] text-text-primary uppercase tracking-[0.2em] flex items-center shrink-0">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              Timeline
            </h2>
            <span className="text-[10px] font-mono bg-bg-app border border-border px-2 py-0.5 rounded text-text-secondary shrink-0">
              {totalEvents.toLocaleString()} events / {groupCount} groups
            </span>
            {isIndexMode && (
              <span className="text-[10px] font-bold bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded text-purple-500 flex items-center gap-1 shrink-0">
                <Database className="w-3 h-3" /> Streamed
              </span>
            )}
            {computeTimeMs !== null && !isCalculating && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1 shrink-0 ${
                fromCache 
                  ? 'bg-green-500/10 border border-green-500/20 text-green-500' 
                  : 'bg-amber-500/10 border border-amber-500/20 text-amber-500'
              }`}>
                <Clock className="w-3 h-3" />
                {fromCache ? 'Cached' : `${computeTimeMs >= 1000 ? (computeTimeMs / 1000).toFixed(2) + 's' : computeTimeMs + 'ms'}`}
              </span>
            )}

            <div className="hidden sm:block h-4 w-px bg-border mx-2" />

            <div className="flex items-center p-1 bg-bg-app border border-border rounded-xl shrink-0">
              <button
                onClick={() => setGroupingMode('requestId')}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  groupingMode === 'requestId' ? 'bg-blue-600 text-white shadow-lg' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Request ID
              </button>
              <button
                onClick={() => hasCorrelationIds && setGroupingMode('correlationId')}
                disabled={!hasCorrelationIds}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  !hasCorrelationIds ? 'hidden' : groupingMode === 'correlationId' ? 'bg-purple-600 text-white shadow-lg' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Correlation
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className={`p-1.5 rounded-lg transition-all ${isFiltersExpanded ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-bg-panel-hover text-text-muted hover:text-text-primary border border-transparent hover:border-border'}`}
              title={isFiltersExpanded ? "Hide Filters" : "Show Filters"}
            >
              <Filter className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-border mx-1" />
            <button 
              onClick={() => setAllExpanded(!allExpanded)}
              className={`p-1.5 rounded-lg transition-all ${allExpanded ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-bg-panel-hover text-text-muted hover:text-text-primary'}`}
              title={allExpanded ? "Collapse All Groups" : "Expand All Groups"}
            >
              <ChevronsUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isFiltersExpanded && (
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap min-w-0 border-b border-border/50 bg-bg-panel/30 animate-in slide-in-from-top-2 duration-200">
            <div className="relative w-full md:max-w-xs group" ref={requestIdInputRef}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FileText className="h-3.5 w-3.5 text-text-muted transition-colors" />
              </div>
              <input 
                type="text" 
                placeholder={`Search by ID...`}
                value={filterRequestId}
                onFocus={() => setIsRequestIdFocused(true)}
                onChange={(e) => setFilterRequestId(e.target.value)}
                className="w-full bg-bg-app border border-border rounded-xl pl-9 pr-8 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500/10 transition-all font-medium"
              />
              {filterRequestId && (
                <button onClick={() => setFilterRequestId('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              )}
              {isRequestIdFocused && filteredRequestIds.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-bg-panel border border-border rounded-xl shadow-2xl z-[100] custom-scrollbar">
                  {filteredRequestIds.slice(0, 50).map((id) => (
                    <button
                      key={id}
                      onClick={() => { setFilterRequestId(id); setIsRequestIdFocused(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-text-secondary hover:bg-bg-app hover:text-blue-500 transition-colors border-b border-border/50 last:border-none font-mono"
                    >
                      {id}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <FilterDropdown label="Levels" icon={<AlertCircle className="w-3.5 h-3.5" />} options={['INF', 'WRN', 'ERR', 'DBG']} selected={selectedLevels} onToggle={toggleLevel} activeColor="blue" />
              <FilterDropdown label="Methods" icon={<Play className="w-3.5 h-3.5" />} options={HTTP_VERBS} selected={selectedVerbs} onToggle={toggleVerb} activeColor="indigo" />
              <FilterDropdown label="Sources" icon={<Layers className="w-3.5 h-3.5" />} options={uniqueSources} selected={selectedSources} onToggle={toggleSource} activeColor="emerald" isSearchable />
              <button onClick={() => setShowSlowQueriesOnly(!showSlowQueriesOnly)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${showSlowQueriesOnly ? 'bg-purple-600 text-white' : 'bg-bg-app border-border text-text-muted hover:text-purple-400'}`}>
                <Clock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Slow</span>
              </button>
            </div>
            

          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-6 custom-scrollbar">
        {groupCount === 0 && !isCalculating && (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
             <Filter className="w-8 h-8 mb-3 opacity-20" />
             <p className="text-sm">No logs match your filters</p>
          </div>
        )}

        {/* INDEX MODE RENDERING */}
        {isIndexMode && indexGroups.slice(0, visibleCount).map((group, index) => {
          const cachedLogs = fetchedLogs.get(group.id);
          const isFetching = fetchingGroups.has(group.id);
          const startTime = formatTime(group.firstTimestamp);
          
          return (
            <details 
              key={`${group.id}-${allExpanded}`} 
              className={`group border rounded-xl shadow-sm overflow-hidden ${group.hasError ? 'bg-red-500/5 border-l-4 border-l-red-500' : 'bg-bg-panel border-border'}`} 
              open={allExpanded || (!allExpanded && index === 0)}
              onToggle={(e) => {
                if ((e.target as HTMLDetailsElement).open && !cachedLogs && !isFetching) {
                  fetchGroupLogs(group);
                }
              }}
            >
              <summary className="list-none cursor-pointer bg-bg-element/20 hover:bg-bg-element/40 transition-colors p-3 select-none outline-none border-b border-transparent group-open:border-border">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-2 md:space-x-3 overflow-hidden">
                    <ChevronRight className="w-4 h-4 text-text-muted group-open:rotate-90 transition-transform shrink-0" />
                    <span className="text-[10px] md:text-xs font-mono font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded truncate max-w-[120px] md:max-w-[200px]">{group.id}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onOpenRequest?.(group.id); }}
                      className="p-1 hover:bg-blue-500/10 text-blue-400 rounded transition-all shrink-0"
                      title="Open as Note"
                    >
                      <FileText className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                    <span className="text-[9px] text-text-muted bg-bg-app px-2 py-0.5 rounded border border-border shrink-0">{group.count.toLocaleString()} events</span>
                    {group.duration && <span className="text-[9px] md:text-[10px] text-text-secondary bg-bg-panel px-2 py-0.5 rounded border border-border shrink-0">{group.duration}</span>}
                  </div>
                  <div className="text-[9px] md:text-[10px] text-text-secondary opacity-70 font-mono shrink-0">{startTime}</div>
                </div>
              </summary>
              <div className="p-2 space-y-1">
                <div className="w-full">
                  {isFetching ? (
                    <div className="flex items-center justify-center py-8 text-text-muted">
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading logs...
                    </div>
                  ) : cachedLogs ? (
                    cachedLogs.map((log, idx) => <LogEntry key={idx} log={log} />)
                  ) : (
                    <div className="flex items-center justify-center py-8 text-text-muted text-xs">
                      Click to load {group.count.toLocaleString()} log entries
                    </div>
                  )}
                </div>
              </div>
            </details>
          );
        })}

        {/* LEGACY MODE RENDERING */}
        {!isIndexMode && legacyGroupedEntries.slice(0, visibleCount).map(([requestId, group], index) => {
          const duration = getGroupDuration(group);
          const startTime = group[0] ? formatTime(group[0].timestamp) : '';
          
          return (
            <details key={`${requestId}-${allExpanded}`} className={`group border rounded-xl shadow-sm overflow-hidden ${group.some(l => l.level === 'ERR') ? 'bg-red-500/5 border-l-4 border-l-red-500' : 'bg-bg-panel border-border'}`} open={allExpanded || (!allExpanded && index === 0)}>
              <summary className="list-none cursor-pointer bg-bg-element/20 hover:bg-bg-element/40 transition-colors p-3 select-none outline-none border-b border-transparent group-open:border-border">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-2 md:space-x-3 overflow-hidden">
                    <ChevronRight className="w-4 h-4 text-text-muted group-open:rotate-90 transition-transform shrink-0" />
                    <span className="text-[10px] md:text-xs font-mono font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded truncate max-w-[120px] md:max-w-[200px]">{requestId}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onOpenRequest?.(requestId); }}
                      className="p-1 hover:bg-blue-500/10 text-blue-400 rounded transition-all shrink-0"
                      title="Open as Note"
                    >
                      <FileText className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                    {duration && <span className="text-[9px] md:text-[10px] text-text-secondary bg-bg-panel px-2 py-0.5 rounded border border-border shrink-0">{duration}</span>}
                  </div>
                  <div className="text-[9px] md:text-[10px] text-text-secondary opacity-70 font-mono shrink-0">{startTime}</div>
                </div>
              </summary>
              <div className="p-2 space-y-1">
                <div className="w-full">
                  {group.map((log, idx) => <LogEntry key={idx} log={log} />)}
                </div>
              </div>
            </details>
          );
        })}

        {visibleCount < groupCount && (
          <button 
            onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
            className="w-full py-4 text-xs font-bold text-blue-500 hover:text-blue-400 flex items-center justify-center gap-2 bg-bg-panel/50 rounded-xl border border-dashed border-border transition-colors hover:bg-bg-panel"
          >
            <RefreshCw className="w-3 h-3" />
            Load More Groups ({groupCount - visibleCount} remaining)
          </button>
        )}
      </div>
    </div>
  );
}

function FilterDropdown({ label, icon, options, selected, onToggle, isSearchable }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const isActive = selected.size < options.length && options.length > 0;

  useEffect(() => {
    const handle = (e: any) => { if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filtered = isSearchable ? options.filter((o: string) => o.toLowerCase().includes(search.toLowerCase())) : options;

  return (
    <div className="relative" ref={containerRef}>
      <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${isOpen || isActive ? 'border-blue-500 text-blue-500 bg-blue-500/5' : 'bg-bg-app border-border text-text-muted'}`}>
        {icon} <span>{label}</span> {isActive && <span className="bg-blue-600 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center">{selected.size}</span>}
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 lg:left-0 mt-2 w-64 bg-bg-panel border border-border rounded-xl shadow-2xl z-50 p-2">
          {isSearchable && <input autoFocus placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-bg-app border border-border rounded-lg px-3 py-1.5 text-xs mb-2" />}
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {filtered.map((o: string) => (
              <label key={o} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-bg-app/50 transition-colors">
                <input type="checkbox" checked={selected.has(o)} onChange={() => onToggle(o)} />
                <span className="text-xs truncate">{o}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex justify-between px-2 text-[10px] font-bold text-blue-500">
            <button onClick={() => options.forEach((o: string) => !selected.has(o) && onToggle(o))}>Select All</button>
            <button onClick={() => selected.forEach((o: string) => onToggle(o))}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LogEntry({ log }: { log: StructuredLog }) {
  const levelStyles = {
    ERR: 'text-red-500 font-bold',
    WRN: 'text-amber-500',
    INF: 'text-blue-500',
    DBG: 'text-text-muted',
  }[log.level] || '';

  return (
    <div className={`pl-4 py-1 flex items-start text-xs font-mono gap-4 hover:bg-bg-panel-hover rounded transition-colors ${log.isSlowSql ? 'bg-purple-500/5 border-r-2 border-purple-500' : ''}`}>
      <span className="text-text-muted shrink-0 opacity-60 w-24">{log.timestamp.split(' ')[1]}</span>
      <span className={`w-10 shrink-0 font-bold ${levelStyles}`}>{log.level}</span>
      <span className="flex-1 min-w-0 whitespace-pre-wrap break-words">{log.message}</span>
      {log.source && <span className="text-[10px] text-text-muted px-1 border border-border rounded shrink-0">{log.source.replace(/[^a-zA-Z.]/g, '')}</span>}
    </div>
  );
}
