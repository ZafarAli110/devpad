import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { AnimatedNumber } from '../Common/AnimatedNumber';
import { useParams, useNavigate } from 'react-router-dom';
import { LogTimeline } from '../LogViewer/LogTimeline';
import { ANALYSIS_EXPORT_SIGNATURE, isAnalysisExport } from '../../lib/parser/logParser';
import type { ParsedFileMetadata } from '../../lib/parser/logIndex';
import { combineIndexStats, combineUniqueIds } from '../../lib/parser/logIndex';
import {
  UploadCloud,
  X,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  Save,
  FileJson,
  Zap,
  HardDrive,
  Trash2,
  FileText,
  Clock,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../lib/storage/db';
import { streamFileToOPFS, deleteFromOPFS } from '../../lib/storage/opfsStreaming';
import { readFromOPFS } from '../../lib/storage/opfs';
import { ConfirmationModal } from '../Layout/ConfirmationModal';

/**
 * Loaded file - now stores lightweight index instead of full content/logs
 */
interface LoadedFile {
  name: string;
  opfsPath: string; // Where raw content is stored
  stats: ParsedFileMetadata;
}

const COLORS = {
  error: '#ef4444',
  warn: '#d97706',
  info: '#2563eb',
  debug: '#059669',
};

export function LogDashboardView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('New Analysis');
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [activeTab, setActiveTab] = useState<'insights' | 'timeline'>('insights');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success, error } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [processingStage, setProcessingStage] = useState<'idle' | 'reading' | 'parsing'>('idle');
  const [currentProcessingFileSize, setCurrentProcessingFileSize] = useState<number>(0);
  const [lastParseTimeMs, setLastParseTimeMs] = useState<number | null>(null);
  const [totalEntryCount, setTotalEntryCount] = useState(0);
  const [processingRowCount, setProcessingRowCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hiddenLevels, setHiddenLevels] = useState<Set<string>>(new Set());
  const workerRef = useRef<Worker | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [histogramData, setHistogramData] = useState<any[]>([]);
  const [hydratingFiles, setHydratingFiles] = useState<Set<string>>(new Set());

  // Session ID for OPFS paths (generated once per dashboard instance)
  const sessionIdRef = useRef<string>(id || crypto.randomUUID());

  const toggleLevel = (id: string) => {
    const level = id.toLowerCase().startsWith('error')
      ? 'error'
      : id.toLowerCase().startsWith('warn')
        ? 'warn'
        : 'info';
    setHiddenLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(new URL('../../lib/parser/log.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    const handler = (e: MessageEvent) => {
      const { type, payload } = e.data;

      if (type === 'progress') {
        // Progress updates now contain row counts (if available)
        if (typeof payload === 'object' && payload.rowCount) {
          setProcessingRowCount(payload.rowCount);
        }
      } else if (type === 'indexResult') {
        // Payload includes additional fields from worker: count, parseTimeMs
        const stats = payload as ParsedFileMetadata & { count?: number; parseTimeMs?: number };
        const entryCount = stats.count ?? stats.totalLogs ?? 0;

        console.log('indexResult received:', {
          fileName: stats.fileName,
          entryCount,
          parseTimeMs: stats.parseTimeMs,
        });

        // Update processing row count to final value
        setProcessingRowCount(entryCount);

        setFiles((prev) => [
          ...prev,
          {
            name: stats.fileName,
            opfsPath: stats.opfsPath,
            stats,
          },
        ]);
        // Update total entry count
        setTotalEntryCount((prev) => prev + entryCount);
        // Track parse time and show status toast (Toast removed to prevent spam)
        if (stats.parseTimeMs) {
          setLastParseTimeMs(stats.parseTimeMs);
        }
        // Close loading modal and reset stage
        setIsParsing(false);
        setProcessingStage('idle');
      } else if (type === 'indicesLoaded') {
        // Indices loaded in worker - update files with real metadata
        console.log('Indices loaded in worker:', payload.count);
        if (payload.files && payload.files.length > 0) {
          setFiles((prev) =>
            prev.map((file) => {
              const loaded = payload.files.find((f: any) => f.opfsPath === file.opfsPath);
              if (loaded) {
                return {
                  ...file,
                  name: loaded.fileName || file.name,
                  stats: loaded.stats,
                };
              }
              return file;
            })
          );
          // Update hydration state
          const newHydrating = new Set<string>();
          payload.files.forEach((f: any) => {
            if (f.entriesOmitted) {
              newHydrating.add(f.opfsPath);
            }
          });
          if (newHydrating.size > 0) {
            setHydratingFiles((prev) => {
              const next = new Set(prev);
              newHydrating.forEach((p) => next.add(p));
              return next;
            });
          }

          // Update total entry count
          const totalEntries = payload.files.reduce(
            (sum: number, f: any) => sum + (f.stats?.totalLogs || 0),
            0
          );
          setTotalEntryCount(totalEntries);
        }
      } else if (type === 'hydrationComplete') {
        const { fileName, opfsPath, entryCount } = payload;
        console.log(`Hydration complete for ${fileName}`);
        // success(`${fileName} fully loaded - charts ready`);

        // Remove from hydration list
        setHydratingFiles((prev) => {
          const next = new Set(prev);
          next.delete(opfsPath);
          return next;
        });

        // Update file stats with Hydrated entry count
        // This state update will trigger the histogram fetch effect automatically
        setFiles((prev) =>
          prev.map((f) => {
            if (f.opfsPath === opfsPath) {
              // Create new stats object to ensure reference change triggers effects
              return {
                ...f,
                stats: {
                  ...f.stats,
                  totalLogs: entryCount,
                  // We could likely update other stats here if we passed them back
                },
              };
            }
            return f;
          })
        );

        // Also update total count
        setTotalEntryCount((prev) => {
          // Re-calculate total from files, careful about the one we just updated
          // Actually it's safer to just let the header stats update on next render
          // but we can optimistic update here or wait for effect.
          // Let's just trigger the state update above which is enough.
          return prev;
        });
      } else if (type === 'histogramResult') {
        setHistogramData(payload);
      } else if (type === 'error') {
        console.error('Worker error:', payload.message || payload);
        // Only show toast for actual errors, ignore cancellation/abort errors if any
        if (payload.message) error(payload.message);
        setIsParsing(false);
        setProcessingStage('idle');
      }
    };

    worker.addEventListener('message', handler);

    return () => {
      worker.removeEventListener('message', handler);
      worker.terminate();
    };
  }, [error, success]);

  // Timer for elapsed time during parsing (only runs during 'parsing' stage)
  useEffect(() => {
    if (processingStage !== 'parsing') return;

    setElapsedSeconds(0);
    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000); // Update every second to reduce re-renders

    return () => clearInterval(timer);
  }, [processingStage]);

  // Load existing analysis
  useEffect(() => {
    if (id) {
      sessionIdRef.current = id;
      db.analyses.get(id).then(async (analysis) => {
        if (analysis) {
          setTitle(analysis.title);

          // Reconstruct loaded files from metadata
          const loadedFiles: LoadedFile[] = analysis.fileMetadata.map((meta) => ({
            name: meta.name,
            opfsPath: meta.opfsPath,
            // Construct basic stats from stored metadata (size is mostly what we have)
            // Ideally we should have stored full metadata. For now we rely on re-loading or
            // the worker has to provide it.
            // Wait - we can't fully reconstruct ParsedFileMetadata from just size/name.
            // We need to fetch it from OPFS or rely on worker.
            //
            // Better approach: Since we don't store full metadata in IndexedDB (only size/name),
            // we MUST load the index header from OPFS to get the stats.
            // BUT we only read the JSON without entries.
            //
            // Let's defer adding to 'files' until worker confirms load?
            // No, UI needs to show something.
            //
            // Let's fetch the index JSON from OPFS (main thread) BUT discard entries immediately.
            // This is still heavy if JSON parse creates the huge object.
            //
            // ALTERNATIVE: Ask worker to load and SEND BACK metadata.
            // Yes.
            stats: {
              version: 1,
              fileName: meta.name,
              opfsPath: meta.opfsPath,
              totalLogs: 0,
              totalBytes: meta.size,
              stats: { total: 0, errors: 0, warnings: 0, infos: 0 },
              entries: [], // Dummy
              uniqueRequestIds: [],
              uniqueCorrelationIds: [],
              createdAt: Date.now(),
            } as any,
          }));

          // Ask worker to load indices and return metadata
          // We need a new message type 'refreshMetadata' or just 'loadIndices' and expect 'indexResult' back?
          // 'loadIndices' currently just caches.
          // Let's blindly trust 'loadIndices' for now and maybe fetch metadata manually?
          // Actually, we can use `opfsStreaming.ts` helper to read just the start of the file? No.

          // Let's try loading index from OPFS but strip entries immediately to save memory.
          // The JSON.parse will still spike memory.
          //
          // Best way: Worker loads it and sends back metadata.
          //
          // Check 'analysis' object - does it have stats?
          // The 'analysis' object has 'stats' which is COMBINED stats.
          // It doesn't have per-file stats.
          //
          // OK, for now let's set empty stats and let the user know, or trigger a re-parse?
          //
          // Let's trigger 'loadIndices' and update the UI when worker confirms?
          //
          // Actually, for this fix, let's just send 'loadIndices' to worker.
          // And populate 'files' with dummy stats.

          setFiles(loadedFiles);

          if (workerRef.current) {
            workerRef.current.postMessage({
              type: 'loadIndices',
              payload: { files: analysis.fileMetadata },
            });
          }
        }
      });
    } else {
      setFiles([]);
      setTitle('New Analysis');
      setActiveTab('insights');
      sessionIdRef.current = crypto.randomUUID();
    }
  }, [id]);

  /**
   * Handle file upload - STREAM DIRECTLY TO OPFS, then index
   * This is the key change: file never fully loads into JS memory
   */
  const handleFilesSelected = async (selectedFiles: File[]) => {
    console.log(
      '[handleFilesSelected] Starting, files:',
      selectedFiles.map((f) => f.name)
    );

    // Clear worker caches to avoid stale data when uploading new files
    workerRef.current?.postMessage({ type: 'clearAllCaches' });

    for (const file of selectedFiles) {
      try {
        console.log('[handleFilesSelected] Processing file:', file.name);

        // Check if file with same name already exists - remove it first (re-upload case)
        const existingFile = files.find((f) => f.name === file.name);
        if (existingFile) {
          console.log('[handleFilesSelected] Re-upload detected, removing existing file');
          // Remove old entry count from total
          setTotalEntryCount((prev) => Math.max(0, prev - (existingFile.stats.totalLogs || 0)));
          // Remove from files list
          setFiles((prev) => prev.filter((f) => f.name !== file.name));
          // Clean up old OPFS data
          try {
            await deleteFromOPFS(existingFile.opfsPath);
            await deleteFromOPFS(`${existingFile.opfsPath}_index`);
            console.log('[handleFilesSelected] Old OPFS files deleted');
          } catch {
            /* ignore cleanup errors */
          }
        }

        setIsParsing(true);
        setProcessingStage('reading');
        setCurrentProcessingFileSize(file.size);
        setProcessingRowCount(0); // Reset row count for new file

        // Check if it's an analysis export JSON
        if (file.name.endsWith('.json') && file.size < 10 * 1024 * 1024) {
          const text = await file.text();
          if (isAnalysisExport(text)) {
            const exportData = JSON.parse(text);
            if (exportData.__type === ANALYSIS_EXPORT_SIGNATURE) {
              // Restore each file from the export
              for (const f of exportData.files) {
                const opfsPath = `analysis_${sessionIdRef.current}_${f.name}`;
                // For exports, we need to save content manually
                const blob = new Blob([f.content], { type: 'text/plain' });
                const tempFile = new File([blob], f.name);
                await streamFileToOPFS(tempFile, opfsPath);

                // Index the content
                workerRef.current?.postMessage({
                  type: 'indexFile',
                  payload: { content: f.content, opfsPath, fileName: f.name },
                });
              }
              if (exportData.title) setTitle(exportData.title);
              success(`Restoring analysis: ${exportData.title || file.name}`);
              continue;
            }
          }
        }

        // Stream file directly to OPFS (no memory copy!)
        const opfsPath = `analysis_${sessionIdRef.current}_${file.name}`;
        console.log('[handleFilesSelected] Streaming to OPFS:', opfsPath);
        await streamFileToOPFS(file, opfsPath);
        // success(`Saved ${file.name} to storage`);

        // Now read content for indexing (still needed for parsing)
        console.log('[handleFilesSelected] Reading content from OPFS');
        const content = await readFromOPFS(opfsPath);
        console.log('[handleFilesSelected] Content read, length:', content?.length);

        if (!content) {
          console.error('[handleFilesSelected] Failed to read content from OPFS!');
          error(`Failed to read ${file.name} from storage`);
          setIsParsing(false);
          setProcessingStage('idle');
          continue;
        }

        // Send to worker for indexing
        console.log('[handleFilesSelected] Sending indexFile to worker');
        setProcessingStage('parsing');
        workerRef.current?.postMessage({
          type: 'indexFile',
          payload: { content, opfsPath, fileName: file.name },
        });
        console.log('[handleFilesSelected] indexFile message sent');
      } catch (e) {
        console.error('Failed to process file', file.name, e);
        error(`Failed to process ${file.name}`);
        setIsParsing(false);
        setProcessingStage('idle');
      }
    }
  };

  const handleRemoveFile = async (opfsPath: string) => {
    const file = files.find((f) => f.opfsPath === opfsPath);
    if (file) {
      try {
        await deleteFromOPFS(file.opfsPath);
        await deleteFromOPFS(`${file.opfsPath}_index`);

        // Notify worker to clear cache
        workerRef.current?.postMessage({
          type: 'removeFile',
          payload: { opfsPath },
        });
      } catch (e) {
        // Ignore deletion errors
      }
    }

    const remainingFiles = files.filter((f) => f.opfsPath !== opfsPath);
    setFiles(remainingFiles);

    // Update or delete IndexedDB entry
    const sessionId = sessionIdRef.current;
    if (remainingFiles.length === 0) {
      // No files left - delete the analysis from IndexedDB
      try {
        await db.analyses.delete(sessionId);
        // Navigate to analysis list if we were viewing a saved analysis
        if (id) {
          navigate('/log-analysis');
        }
      } catch (e) {
        console.error('Failed to delete analysis', e);
      }
    } else {
      // Some files remain - update IndexedDB with remaining files
      try {
        const existingAnalysis = await db.analyses.get(sessionId);
        if (existingAnalysis) {
          const updatedStats = combineIndexStats(remainingFiles.map((f) => f.stats));
          const fileMetadata = remainingFiles.map((f) => ({
            name: f.name,
            opfsPath: f.opfsPath,
            size: f.stats.totalBytes,
          }));
          await db.analyses.put({
            ...existingAnalysis,
            fileMetadata,
            stats: updatedStats,
            updatedAt: Date.now(),
          });
        }
      } catch (e) {
        console.error('Failed to update analysis', e);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(Array.from(e.target.files));
    }
    if (e.target) e.target.value = '';
  };

  // Combined stats from all file indices
  const stats = useMemo(() => combineIndexStats(files.map((f) => f.stats)), [files]);
  const combinedUniqueIds = useMemo(() => combineUniqueIds(files.map((f) => f.stats)), [files]);

  // Save analysis - indices are already in OPFS, just save metadata
  const saveAnalysis = useCallback(
    async (silent = false) => {
      if (files.length === 0) return;
      if (!silent) setIsSaving(true);
      try {
        // NOTE: We assume worker has already saved the index to OPFS during parsing.
        // But if we modify anything we might need to verify.
        // Since we just save metadata here, we assume indices exist.

        const sessionId = sessionIdRef.current;
        const fileMetadata = [];

        for (const file of files) {
          fileMetadata.push({
            name: file.name,
            opfsPath: file.opfsPath,
            size: file.stats.totalBytes,
          });
        }

        const existingAnalysis = await db.analyses.get(sessionId);
        const analysisData = {
          id: sessionId,
          title,
          fileMetadata,
          stats,
          createdAt: existingAnalysis?.createdAt || Date.now(),
          updatedAt: Date.now(),
        };

        await db.analyses.put(analysisData as any);
        if (!silent) success('Analysis saved successfully');
        // Update URL to include ID if not already there
        if (!id) {
          window.history.replaceState(null, '', `#/log-analysis/${sessionId}`);
        }
      } catch (e) {
        console.error('Save failed', e);
        if (!silent) error('Failed to save analysis');
      } finally {
        if (!silent) setIsSaving(false);
      }
    },
    [files, title, stats, id, success, error]
  );

  // NOTE: Auto-save removed - user must explicitly click Save to persist analysis
  // This prevents creating phantom entries in recent list when data isn't properly saved

  // Delete analysis - remove from IndexedDB and OPFS
  const deleteAnalysis = async () => {
    if (!id) {
      // Not saved yet, just clear files
      setFiles([]);
      setTitle('New Analysis');
      setConfirmDelete(false);
      return;
    }

    setIsDeleting(true);
    try {
      // Delete OPFS files
      for (const file of files) {
        try {
          await deleteFromOPFS(file.opfsPath);
          await deleteFromOPFS(`${file.opfsPath}_index`);
        } catch (e) {
          // Ignore deletion errors for individual files
        }
      }

      // Delete from IndexedDB
      await db.analyses.delete(id);

      success('Analysis deleted successfully');
      navigate('/log-analysis');
    } catch (e) {
      console.error('Delete failed', e);
      error('Failed to delete analysis');
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  // Download analysis export
  const downloadAnalysis = async () => {
    if (files.length === 0) return;

    try {
      const filesWithContent = [];
      for (const file of files) {
        const content = await readFromOPFS(file.opfsPath);
        filesWithContent.push({ name: file.name, content });
      }

      const exportData = {
        __type: ANALYSIS_EXPORT_SIGNATURE,
        title,
        exportedAt: new Date().toISOString(),
        files: filesWithContent,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}_analysis.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success('Analysis exported as JSON');
    } catch (e) {
      error('Failed to export analysis');
    }
  };

  // Calculate aggregated time stats for bucket sizing
  const timeStats = useMemo(() => {
    if (files.length === 0) return null;
    let minTs: number | null = null;
    let maxTs: number | null = null;

    files.forEach((f) => {
      if (f.stats.timeStats?.first) {
        const first = new Date(f.stats.timeStats.first.replace(' ', 'T')).getTime();
        if (minTs === null || first < minTs) minTs = first;
      }
      if (f.stats.timeStats?.last) {
        const last = new Date(f.stats.timeStats.last.replace(' ', 'T')).getTime();
        if (maxTs === null || last > maxTs) maxTs = last;
      }
    });

    return { minTs, maxTs };
  }, [files]);

  // Request histogram data from worker
  useEffect(() => {
    if (files.length === 0 || !workerRef.current || !timeStats?.minTs || !timeStats?.maxTs) {
      setHistogramData([]);
      return;
    }

    const range = timeStats.maxTs - timeStats.minTs;
    let bucketSizeMs = 60 * 1000; // 1 min default

    if (range > 24 * 60 * 60 * 1000)
      bucketSizeMs = 60 * 60 * 1000; // 1 hour
    else if (range > 60 * 60 * 1000) bucketSizeMs = 5 * 60 * 1000; // 5 mins

    workerRef.current.postMessage({
      type: 'getHistogram',
      payload: {
        files: files.map((f) => ({ opfsPath: f.opfsPath })),
        bucketSizeMs,
      },
    });
  }, [files, timeStats]);

  // Chart data from worker histogram
  const timeChartData = useMemo(() => {
    if (histogramData.length === 0) return [];

    // Sort and format for chart
    const range = (timeStats?.maxTs || 0) - (timeStats?.minTs || 0);
    const isMultiDay = range > 24 * 60 * 60 * 1000;

    return histogramData.map((bucket) => {
      const dateObj = new Date(bucket.timestamp);
      const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const label = isMultiDay
        ? `${dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`
        : timeStr;

      return {
        ...bucket,
        time: label,
      };
    });
  }, [histogramData, timeStats]);

  const pieChartData = useMemo(
    () =>
      [
        { name: 'Error', value: stats.errors, color: COLORS.error },
        { name: 'Warning', value: stats.warnings, color: COLORS.warn },
        { name: 'Info', value: stats.infos, color: COLORS.info },
      ].filter((d) => d.value > 0),
    [stats]
  );

  const visiblePieData = useMemo(
    () =>
      pieChartData
        .map((d) => ({
          ...d,
          name: `${d.name} (${d.value.toLocaleString()})`,
        }))
        .filter((d) => !hiddenLevels.has(d.name.split(' ')[0].toLowerCase())),
    [pieChartData, hiddenLevels]
  );

  // Memory indicator
  const totalBytes = files.reduce((sum, f) => sum + f.stats.totalBytes, 0);
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="h-full flex flex-col bg-bg-app overflow-hidden">
      {/* Header / Toolbar */}
      <div className="border-b border-border bg-bg-panel flex flex-col shrink-0">
        {/* Row 1: Primary Navigation & Primary Action */}
        <div className="h-14 flex items-center px-4 justify-between border-b border-border/50">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent-primary shrink-0" />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/30 rounded px-1 w-full max-w-[140px] md:max-w-[200px]"
                placeholder="Analysis Title..."
              />
            </h1>

            {files.length > 0 && (
              <nav className="flex items-center p-1 bg-bg-app border border-border rounded-xl">
                <button
                  onClick={() => setActiveTab('insights')}
                  className={`px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'insights'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Insights
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  disabled={hydratingFiles.size > 0}
                  className={`px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'timeline'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : hydratingFiles.size > 0
                        ? 'text-text-muted/50 cursor-not-allowed'
                        : 'text-text-muted hover:text-text-primary'
                  }`}
                  title={
                    hydratingFiles.size > 0
                      ? 'Timeline disabled while restoring data...'
                      : 'View Timeline'
                  }
                >
                  Timeline
                </button>
              </nav>
            )}
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95 text-xs"
          >
            <UploadCloud className="w-4 h-4" />
            <span className="hidden sm:inline">Add Files</span>
            <span className="sm:hidden text-[10px]">Add Logs</span>
          </button>
        </div>

        {/* Row 2: Context Stats & Secondary Actions */}
        <div className="min-h-12 py-2 px-4 flex flex-wrap items-center justify-between gap-3 bg-bg-panel/50">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {totalEntryCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  {totalEntryCount.toLocaleString()} rows
                </span>
              </div>
            )}
            {lastParseTimeMs !== null && lastParseTimeMs > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  {lastParseTimeMs >= 1000
                    ? `${(lastParseTimeMs / 1000).toFixed(2)}s`
                    : `${lastParseTimeMs}ms`}
                </span>
              </div>
            )}
            {totalBytes > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full">
                <HardDrive className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                  {formatBytes(totalBytes)} in OPFS
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <Zap className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Streaming Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:ml-auto">
            <input
              type="file"
              multiple
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".log,.txt,.json"
            />
            <button
              onClick={() => saveAnalysis()}
              disabled={files.length === 0 || isSaving}
              className="flex items-center space-x-2 px-3 py-1.5 bg-bg-panel hover:bg-bg-panel-hover border border-border text-text-primary rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
              title="Save locally"
            >
              <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
            <button
              onClick={() => downloadAnalysis()}
              disabled={files.length === 0}
              className="flex items-center space-x-2 px-3 py-1.5 bg-bg-panel hover:bg-bg-panel-hover border border-border text-text-primary rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
              title="Export as JSON"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export JSON</span>
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={files.length === 0}
              className="flex items-center space-x-2 px-3 py-1.5 bg-bg-panel hover:bg-red-500/10 border border-border hover:border-red-500/50 text-text-muted hover:text-red-500 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
              title="Delete analysis"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}

      <div className="flex-1 overflow-hidden relative">
        {/* Parsing overlay */}
        {isParsing && (
          <div className="absolute inset-0 z-50 bg-bg-app/80 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-bg-panel border border-border rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl min-w-[280px]">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                {processingStage === 'reading' ? (
                  <>
                    <p className="text-sm font-bold text-text-primary">Reading file content...</p>
                    <p className="text-xs text-text-muted mt-1">
                      Size: {formatBytes(currentProcessingFileSize)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-text-primary">Parsing file...</p>
                    <p className="text-xs text-text-muted mt-1">
                      {processingRowCount > 0
                        ? `Processed ${processingRowCount.toLocaleString()} rows`
                        : 'Starting parser...'}
                    </p>
                  </>
                )}
              </div>
              {processingStage === 'parsing' && (
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-mono">{elapsedSeconds}s</span>
                </div>
              )}
            </div>
          </div>
        )}

        {files.length === 0 && !isParsing ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
            <div className="p-10 rounded-full bg-blue-500/5 border border-blue-500/10 mb-6">
              <UploadCloud className="w-16 h-16 text-blue-500/40" />
            </div>
            <h3 className="text-2xl font-black text-text-primary mb-2">Ready for Analysis</h3>
            <p className="text-text-secondary max-w-sm mb-4">
              Upload one or more log files or <b>import a previously exported analysis JSON</b> to
              get insights.
            </p>
            <p className="text-xs text-text-muted max-w-sm mb-8">
              <span className="text-emerald-500 font-bold">✓ Streaming Engine</span> — Files are
              saved directly to storage without loading into memory.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black transition-all shadow-xl shadow-blue-600/30 active:scale-95 flex items-center gap-2"
              >
                <UploadCloud className="w-5 h-5" />
                Start Uploading
              </button>
            </div>
          </div>
        ) : (
          files.length > 0 && (
            <div className="h-full">
              {activeTab === 'insights' ? (
                <div className="h-full overflow-y-auto p-6 space-y-6 custom-scrollbar bg-bg-app">
                  {/* Summary Section */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-bg-panel border border-border rounded-2xl p-4 md:p-6 flex flex-col justify-center">
                      <span className="text-[10px] md:text-xs text-text-muted font-bold uppercase tracking-wider mb-1">
                        Total Events
                      </span>
                      <AnimatedNumber
                        value={stats.total}
                        className="text-2xl md:text-3xl lg:text-4xl font-black text-text-primary"
                      />
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 md:p-6 flex flex-col justify-center shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="w-3 md:w-4 h-3 md:h-4 text-red-600" />
                        <span className="text-[10px] md:text-xs text-red-600 font-bold uppercase tracking-wider">
                          Errors
                        </span>
                      </div>
                      <AnimatedNumber
                        value={stats.errors}
                        className="text-2xl md:text-3xl lg:text-4xl font-black text-red-600"
                      />
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 md:p-6 flex flex-col justify-center shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-3 md:w-4 h-3 md:h-4 text-amber-600" />
                        <span className="text-[10px] md:text-xs text-amber-600 font-bold uppercase tracking-wider">
                          Warnings
                        </span>
                      </div>
                      <AnimatedNumber
                        value={stats.warnings}
                        className="text-2xl md:text-3xl lg:text-4xl font-black text-amber-600"
                      />
                    </div>
                    <div className="bg-bg-panel border border-border rounded-2xl p-4 md:p-6 flex flex-col overflow-hidden">
                      <span className="text-[10px] md:text-xs text-text-muted font-bold uppercase tracking-wider mb-2">
                        Parsed Files
                      </span>
                      <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1 max-h-[60px] md:max-h-[80px]">
                        {files.map((f) => (
                          <div
                            key={f.name}
                            className="flex items-center justify-between text-[9px] md:text-[10px] p-1.5 bg-bg-app rounded-lg border border-border group hover:border-blue-500/50 transition-colors"
                          >
                            <span className="truncate text-text-secondary pr-2" title={f.name}>
                              {f.name} ({formatBytes(f.stats.totalBytes)})
                            </span>
                            <button
                              onClick={() => handleRemoveFile(f.opfsPath)}
                              className="text-text-muted hover:text-red-500"
                            >
                              <X className="w-2.5 md:w-3 h-2.5 md:h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Stats Charts */}

                  {/* Chart Area */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Time Chart */}
                    <div className="lg:col-span-2 bg-bg-panel border border-border rounded-3xl p-4 md:p-6 h-[300px] md:h-[400px] flex flex-col shadow-sm relative overflow-hidden">
                      {hydratingFiles.size > 0 && (
                        <div className="absolute inset-0 bg-bg-panel/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center animate-in fade-in duration-300">
                          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                          <p className="text-sm font-bold text-text-primary">
                            Restoring full timeline...
                          </p>
                          <p className="text-xs text-text-muted mt-1">Reading data from storage</p>
                        </div>
                      )}
                      <h3 className="text-xs md:text-sm font-bold text-text-primary mb-6 flex items-center gap-2">
                        Logs Distribution Over Time
                        <span className="text-[9px] md:text-[10px] bg-bg-app px-2 py-0.5 rounded-full text-text-muted font-normal border border-border">
                          Temporal Analysis
                        </span>
                      </h3>
                      <div className="flex-1 w-full min-h-[1px] min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                          <AreaChart data={timeChartData}>
                            <defs>
                              <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.error} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={COLORS.error} stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorWarn" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.warn} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={COLORS.warn} stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorInfo" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.info} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={COLORS.info} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#333"
                              opacity={0.05}
                              vertical={false}
                            />
                            <XAxis
                              dataKey="time"
                              fontSize={9}
                              stroke="#888"
                              axisLine={false}
                              tickLine={false}
                              minTickGap={30}
                            />
                            <YAxis
                              fontSize={9}
                              stroke="#888"
                              axisLine={false}
                              tickLine={false}
                              scale="sqrt"
                            />
                            <RechartsTooltip
                              contentStyle={{
                                backgroundColor: '#1a1a1a',
                                borderColor: '#333',
                                borderRadius: '12px',
                                border: '1px solid #333',
                              }}
                              itemStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#fff' }}
                              cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                              itemSorter={(item) =>
                                item.name === 'Errors' ? 0 : item.name === 'Warnings' ? 1 : 2
                              }
                            />
                            <Legend
                              verticalAlign="top"
                              align="right"
                              iconType="circle"
                              wrapperStyle={{
                                paddingBottom: '20px',
                                fontSize: '10px',
                                cursor: 'pointer',
                              }}
                              onClick={(e) => toggleLevel(e.dataKey as string)}
                              formatter={(value: string) => {
                                const key = value.toLowerCase().startsWith('error')
                                  ? 'error'
                                  : value.toLowerCase().startsWith('warn')
                                    ? 'warn'
                                    : 'info';
                                return (
                                  <span
                                    style={{
                                      opacity: hiddenLevels.has(key) ? 0.3 : 1,
                                      textDecoration: hiddenLevels.has(key)
                                        ? 'line-through'
                                        : 'none',
                                    }}
                                  >
                                    {value}
                                  </span>
                                );
                              }}
                            />
                            <Area
                              name="Errors"
                              dataKey="error"
                              stackId="1"
                              stroke={COLORS.error}
                              fill="url(#colorError)"
                              hide={hiddenLevels.has('error')}
                              isAnimationActive={false}
                              type="monotone"
                            />
                            <Area
                              name="Warnings"
                              dataKey="warn"
                              stackId="1"
                              stroke={COLORS.warn}
                              fill="url(#colorWarn)"
                              hide={hiddenLevels.has('warn')}
                              isAnimationActive={false}
                              type="monotone"
                            />
                            <Area
                              name="Info"
                              dataKey="info"
                              stackId="1"
                              stroke={COLORS.info}
                              fill="url(#colorInfo)"
                              hide={hiddenLevels.has('info')}
                              isAnimationActive={false}
                              type="monotone"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Pie Chart */}
                    <div className="bg-bg-panel border border-border rounded-3xl p-4 md:p-6 h-[300px] md:h-[400px] flex flex-col shadow-sm">
                      <h3 className="text-xs md:text-sm font-bold text-text-primary mb-6">
                        Log Level Mix
                      </h3>
                      <div className="flex-1 w-full min-h-[1px] min-w-0 relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                          <PieChart>
                            <Pie
                              data={visiblePieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="value"
                              stroke="none"
                              minAngle={15}
                              isAnimationActive={false}
                            >
                              {visiblePieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              contentStyle={{
                                backgroundColor: '#1a1a1a',
                                borderColor: '#333',
                                borderRadius: '12px',
                              }}
                              itemStyle={{ color: '#fff', fontSize: '10px' }}
                            />
                            <Legend
                              verticalAlign="bottom"
                              align="center"
                              iconType="circle"
                              wrapperStyle={{ fontSize: '10px' }}
                              formatter={(value, _entry) => (
                                <span className="text-text-secondary font-medium ml-1">
                                  {value}
                                </span>
                              )}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-20px]">
                          <span className="text-[9px] text-text-muted font-bold uppercase tracking-tighter">
                            Total
                          </span>
                          <AnimatedNumber
                            value={stats.total}
                            className="text-lg md:text-2xl font-black text-text-primary"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <LogTimeline
                  logs={[]} // Empty - timeline will use index
                  fileMetadata={files.map((f) => f.stats)}
                  workerRef={workerRef}
                  hasContent={true}
                  onParse={() => {}}
                  onOpenRequest={() => {}}
                  isParsing={isParsing}
                  externalUniqueIds={combinedUniqueIds}
                />
              )}
            </div>
          )
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteAnalysis}
        title="Delete Analysis?"
        message={`This will permanently delete "${title}" and all associated log files. This action cannot be undone.`}
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        isDestructive={true}
      />
    </div>
  );
}
