/**
 * Log Worker - Handles log parsing in a background thread
 *
 * Supports multiple modes:
 * 1. Index Mode: Parse file and return lightweight index (for large files)
 * 2. Streaming Index Mode: True streaming for very large files (100MB+)
 * 3. Fetch Mode: Given byte ranges, return full log entries for display
 * 4. Legacy Parse Mode: Full parsing for backwards compatibility
 */

import {
  parseLogsGenerator,
  parseLogs,
  StructuredLog,
  parseContentToIndexWithProgress,
  parseTimestampToMs,
  createStreamingParseState,
  processTextLogChunk,
} from './logParser';
import type { ParsedFileIndex, LogEntryIndex, IndexGroupSummary } from './logIndex';
import {
  createEmptyFileIndex,
  sliceUtf8Bytes,
  matchesIdQuery,
  compareLogOrder,
} from './logIndex';

interface IndexEntryWithPath extends LogEntryIndex {
  opfsPath: string;
}

/* eslint-disable no-restricted-globals */

// Singleton TextDecoder for streaming
const DECODER = new TextDecoder();

// Cache for fetched logs (small memory footprint)
let lastLogs: StructuredLog[] = [];

// =====================================================
// MEMORY SAFETY CONFIGURATION
// =====================================================
const MEMORY_SAFETY = {
  // Max entries before we skip grouping cache (4M entries)
  MAX_ENTRIES_FOR_GROUPING_CACHE: 4_000_000,
  // Max entries before we warn user (3M entries)
  WARNING_THRESHOLD: 3_000_000,
  // Max entries per file before we recommend splitting (1M)
  MAX_ENTRIES_PER_FILE_RECOMMENDED: 1_000_000,
  // Max total cached entries across all files
  MAX_TOTAL_CACHED_ENTRIES: 5_000_000,
  // Max files to keep in cache
  MAX_CACHED_FILES: 10,
};

// Track current session files (to detect when user switches analysis data)
let currentSessionFileKeys: string[] = [];

// Track total cached entry count for memory management
let totalCachedEntryCount = 0;

// Cache for file indices (Worker memory)
// Map<opfsPath, ParsedFileIndex>
const fileIndicesCache = new Map<string, ParsedFileIndex>();
const hydratingFiles = new Set<string>();

// Cache for current grouped results (Map<groupId, IndexEntryWithPath[]>)
// This allows main thread to ask for details of a group without re-calculating
let groupedResultsCache = new Map<string, IndexEntryWithPath[]>();

// Smart cache for grouping results to avoid recomputation
// Key: hash of filter parameters, Value: { summaries, groupedResults }
let groupingSummaryCache: {
  cacheKey: string;
  summaries: IndexGroupSummary[];
  groupedResults: Map<string, IndexEntryWithPath[]>;
  computeTimeMs: number;
  entryCount: number; // Track entry count for memory decisions
} | null = null;

// Clear caches to free memory
function clearGroupingCaches() {
  groupedResultsCache = new Map();
  groupingSummaryCache = null;
  console.log('[Worker] Cleared grouping caches to free memory');
}

// Evict oldest file from cache if we exceed limits
function evictOldestFileIfNeeded() {
  if (fileIndicesCache.size > MEMORY_SAFETY.MAX_CACHED_FILES) {
    const firstKey = fileIndicesCache.keys().next().value;
    if (firstKey) {
      const evicted = fileIndicesCache.get(firstKey);
      if (evicted) {
        totalCachedEntryCount -= evicted.entries.length;
      }
      fileIndicesCache.delete(firstKey);
      console.log(`[Worker] Evicted oldest file from cache: ${firstKey}`);
    }
  }
}

// Check if we should enable grouping cache for this dataset
function shouldCacheGrouping(entryCount: number): boolean {
  return entryCount <= MEMORY_SAFETY.MAX_ENTRIES_FOR_GROUPING_CACHE;
}

// Get memory status (if available)
function getMemoryStatus(): { usedMB: number; limitMB: number; percentUsed: number } | null {
  try {
    // @ts-ignore - performance.memory is non-standard but available in Chrome
    const mem = performance.memory;
    if (mem) {
      return {
        usedMB: Math.round(mem.usedJSHeapSize / 1024 / 1024),
        limitMB: Math.round(mem.jsHeapSizeLimit / 1024 / 1024),
        percentUsed: Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100),
      };
    }
  } catch {}
  return null;
}

// Generate a cache key from filter parameters
function generateCacheKey(
  files: { opfsPath: string }[],
  selectedLevels: string[],
  selectedVerbs: string[],
  selectedSources: string[],
  filterRequestId: string,
  groupingMode: string,
  showSlowQueriesOnly: boolean
): string {
  return JSON.stringify({
    files: files.map((f) => f.opfsPath).sort(),
    levels: [...selectedLevels].sort(),
    verbs: [...selectedVerbs].sort(),
    sources: [...selectedSources].sort(),
    filterRequestId,
    groupingMode,
    showSlowQueriesOnly,
  });
}

// Helper to open an OPFS File handle in worker for exact byte-range slicing without loading full file into RAM
async function openOPFSFileWorker(path: string): Promise<File | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(path);
    return await fileHandle.getFile();
  } catch (e) {
    console.error('Worker file open failed', path, e);
    return null;
  }
}

// Helper to read text from OPFS in worker
async function readFromOPFSWorker(path: string): Promise<string> {
  try {
    const root = await navigator.storage.getDirectory();
    let fileHandle;
    try {
      fileHandle = await root.getFileHandle(path);
    } catch {
      return '';
    }
    const file = await fileHandle.getFile();
    return await file.text();
  } catch (e) {
    console.error('Worker read failed', path, e);
    return '';
  }
}

// Helper to read JSON from OPFS (duplicated from opfsStreaming to avoid import issues if any, or just import)
async function loadIndexFromOPFSWorker(path: string): Promise<ParsedFileIndex | null> {
  try {
    const root = await navigator.storage.getDirectory();

    // Check if index file exists
    let fileHandle;
    try {
      fileHandle = await root.getFileHandle(path);
    } catch {
      return null;
    }

    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as ParsedFileIndex;
  } catch (e) {
    console.error('Worker failed to load index', path, e);
    return null;
  }
}

// Helper to save index to OPFS (for persistence across sessions)
// Saves metadata ONLY (excluding entries array) to avoid JSON size limits for large files
async function saveIndexToOPFSWorker(path: string, index: ParsedFileIndex): Promise<void> {
  try {
    // Extract entries and save only metadata
    // This keeps the JSON size small even for millions of entries
    const { entries, ...metadata } = index;

    // Add a flag to indicate entries are not included (need re-parse)
    const metadataWithFlag = {
      ...metadata,
      entriesOmitted: true,
      entryCount: entries.length,
    };

    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(path, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(metadataWithFlag));
    await writable.close();
    console.log(
      `[Worker] Index metadata saved to OPFS: ${path} (${entries.length} entries omitted)`
    );
  } catch (e) {
    console.error('Worker failed to save index', path, e);
  }
}

// Worker message handler
self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    // =====================================================
    // INDEX MODE: Create lightweight index from content
    // =====================================================
    case 'indexFile': {
      const { content, opfsPath, fileName } = payload;

      try {
        // Send immediate progress to unblock UI (interval won't fire during sync parsing)
        self.postMessage({
          type: 'progress',
          payload: 5,
          message: 'Reading file...',
        });

        // Track start time for parse duration
        const parseStartTime = performance.now();

        // Parse content to index with progress reporting (async, 500ms throttled updates)
        const index = await parseContentToIndexWithProgress(
          content,
          opfsPath,
          fileName,
          (rowCount: number) => {
            // Send progress update to main thread
            self.postMessage({
              type: 'progress',
              payload: { rowCount },
            });
          }
        );
        const entryCount = index.entries.length;
        const parseTimeMs = Math.round(performance.now() - parseStartTime);

        // MEMORY SAFETY: Check if we're exceeding limits
        // For re-uploads, remove the existing cached entry for this file first
        if (fileIndicesCache.has(opfsPath)) {
          const existing = fileIndicesCache.get(opfsPath);
          if (existing) {
            totalCachedEntryCount -= existing.entries.length;
          }
          fileIndicesCache.delete(opfsPath);
          console.log(`[Worker] Removed existing cache entry for re-upload: ${opfsPath}`);
        }

        const wouldExceedLimit =
          totalCachedEntryCount + entryCount > MEMORY_SAFETY.MAX_TOTAL_CACHED_ENTRIES;

        if (wouldExceedLimit) {
          // Clear grouping caches to free memory
          clearGroupingCaches();
          // Force evict oldest files until we have room (even if below MAX_CACHED_FILES)
          while (
            totalCachedEntryCount + entryCount > MEMORY_SAFETY.MAX_TOTAL_CACHED_ENTRIES &&
            fileIndicesCache.size > 0
          ) {
            const firstKey = fileIndicesCache.keys().next().value;
            if (firstKey) {
              const evicted = fileIndicesCache.get(firstKey);
              if (evicted) {
                totalCachedEntryCount -= evicted.entries.length;
              }
              fileIndicesCache.delete(firstKey);
              console.log(`[Worker] Force evicted file to free memory: ${firstKey}`);
            } else {
              break; // Safety: exit if no key found
            }
          }
        }

        // Evict if too many files
        evictOldestFileIfNeeded();
        // Cache index in worker memory
        fileIndicesCache.set(opfsPath, index);
        totalCachedEntryCount += entryCount;

        // Save index to OPFS for persistence across sessions
        const indexPath = `${opfsPath}_index`;
        await saveIndexToOPFSWorker(indexPath, index);

        // Check for warnings
        const warnings: string[] = [];
        if (entryCount > MEMORY_SAFETY.WARNING_THRESHOLD) {
          warnings.push(
            `Very large file (${(entryCount / 1_000_000).toFixed(1)}M entries). Performance may be affected.`
          );
        } else if (entryCount > MEMORY_SAFETY.MAX_ENTRIES_PER_FILE_RECOMMENDED) {
          warnings.push(
            `Large file (${Math.round(entryCount / 1000)}K entries). Consider splitting for better performance.`
          );
        }

        // Return only stats/metadata to main thread
        const { entries, ...metaData } = index;
        const memStatus = getMemoryStatus();

        console.log('[Worker] Sending indexResult:', {
          fileName,
          entryCount,
          parseTimeMs,
          cachedFiles: fileIndicesCache.size,
        });

        self.postMessage({
          type: 'indexResult',
          payload: {
            ...metaData,
            count: entryCount,
            parseTimeMs,
            warnings,
            memoryStatus: memStatus,
          },
        });
      } catch (err) {
        self.postMessage({
          type: 'error',
          payload: { message: `Indexing failed: ${err}` },
        });
      }
      break;
    }

    // =====================================================
    // STREAMING INDEX MODE: True streaming for very large files
    // Processes file in chunks without loading entire content
    // =====================================================
    case 'streamIndexFile': {
      const { opfsPath, fileName } = payload;

      try {
        self.postMessage({
          type: 'progress',
          payload: 5,
          message: 'Starting streaming parse...',
        });

        const parseStartTime = performance.now();

        // Get file handle from OPFS
        const root = await navigator.storage.getDirectory();
        let fileHandle;
        try {
          fileHandle = await root.getFileHandle(opfsPath);
        } catch {
          throw new Error(`File not found: ${opfsPath}`);
        }

        const file = await fileHandle.getFile();
        const totalBytes = file.size;

        // Create index with streaming
        const index = createEmptyFileIndex(opfsPath, fileName);
        index.totalBytes = totalBytes;

        const uniqueRequestIds = new Set<string>();
        const uniqueCorrelationIds = new Set<string>();
        const sourceStats: Record<string, number> = {};

        const state = createStreamingParseState();
        let bytesProcessed = 0;
        let firstTs = '';
        let lastTs = '';
        let lastProgressTime = performance.now();
        const PROGRESS_INTERVAL_MS = 500;

        // Stream the file
        const reader = file.stream().getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = DECODER.decode(value, { stream: true });
          bytesProcessed += value.byteLength;

          for (const entry of processTextLogChunk(chunk, state, fileName, false)) {
            index.entries.push(entry);
            index.stats.total++;

            if (!firstTs) firstTs = entry.timestamp;
            lastTs = entry.timestamp;

            const source = entry.source || 'Unknown';
            sourceStats[source] = (sourceStats[source] || 0) + 1;

            const lvl = (entry.level || '').toUpperCase();
            if (
              entry.hasError ||
              lvl === 'ERR' ||
              lvl === 'ERROR' ||
              lvl === 'FTL' ||
              lvl === 'FATAL'
            ) {
              index.stats.errors++;
            } else if (lvl === 'WRN' || lvl === 'WARN' || lvl === 'WARNING') {
              index.stats.warnings++;
            } else {
              index.stats.infos++;
            }

            if (entry.requestId) uniqueRequestIds.add(entry.requestId);
            if (entry.correlationId) uniqueCorrelationIds.add(entry.correlationId);
          }

          // Throttled progress reporting
          const now = performance.now();
          if (now - lastProgressTime >= PROGRESS_INTERVAL_MS) {
            const progress = Math.round((bytesProcessed / totalBytes) * 100);
            self.postMessage({
              type: 'progress',
              payload: {
                rowCount: index.entries.length,
                bytesProcessed,
                totalBytes,
                percent: progress,
              },
            });
            lastProgressTime = now;
          }
        }

        // Process any remaining content
        for (const entry of processTextLogChunk('', state, fileName, true)) {
          index.entries.push(entry);
          index.stats.total++;

          if (!firstTs) firstTs = entry.timestamp;
          lastTs = entry.timestamp;

          const source = entry.source || 'Unknown';
          sourceStats[source] = (sourceStats[source] || 0) + 1;

          const lvl = (entry.level || '').toUpperCase();
          if (
            entry.hasError ||
            lvl === 'ERR' ||
            lvl === 'ERROR' ||
            lvl === 'FTL' ||
            lvl === 'FATAL'
          ) {
            index.stats.errors++;
          } else if (lvl === 'WRN' || lvl === 'WARN' || lvl === 'WARNING') {
            index.stats.warnings++;
          } else {
            index.stats.infos++;
          }

          if (entry.requestId) uniqueRequestIds.add(entry.requestId);
          if (entry.correlationId) uniqueCorrelationIds.add(entry.correlationId);
        }

        // Finalize index
        const entryCount = index.entries.length;
        index.totalLogs = entryCount;
        index.uniqueRequestIds = Array.from(uniqueRequestIds);
        index.uniqueCorrelationIds = Array.from(uniqueCorrelationIds);
        index.sourceStats = sourceStats;

        // Calculate duration
        let duration = '0ms';
        if (firstTs && lastTs) {
          const start = parseTimestampToMs(firstTs);
          const end = parseTimestampToMs(lastTs);
          const diff = end - start;
          if (diff < 1000) duration = `${diff}ms`;
          else if (diff < 60000) duration = `${(diff / 1000).toFixed(1)}s`;
          else if (diff < 3600000) duration = `${(diff / 60000).toFixed(1)}m`;
          else duration = `${(diff / 3600000).toFixed(1)}h`;
        }

        index.timeStats = { first: firstTs, last: lastTs, duration };

        const parseTimeMs = Math.round(performance.now() - parseStartTime);

        // Cache management (same as regular indexFile)
        if (fileIndicesCache.has(opfsPath)) {
          const existing = fileIndicesCache.get(opfsPath);
          if (existing) {
            totalCachedEntryCount -= existing.entries.length;
          }
          fileIndicesCache.delete(opfsPath);
        }

        const wouldExceedLimit =
          totalCachedEntryCount + entryCount > MEMORY_SAFETY.MAX_TOTAL_CACHED_ENTRIES;

        if (wouldExceedLimit) {
          clearGroupingCaches();
          while (
            totalCachedEntryCount + entryCount > MEMORY_SAFETY.MAX_TOTAL_CACHED_ENTRIES &&
            fileIndicesCache.size > 0
          ) {
            const firstKey = fileIndicesCache.keys().next().value;
            if (firstKey) {
              const evicted = fileIndicesCache.get(firstKey);
              if (evicted) {
                totalCachedEntryCount -= evicted.entries.length;
              }
              fileIndicesCache.delete(firstKey);
            } else {
              break;
            }
          }
        }

        evictOldestFileIfNeeded();
        fileIndicesCache.set(opfsPath, index);
        totalCachedEntryCount += entryCount;

        // Save index metadata
        const indexPath = `${opfsPath}_index`;
        await saveIndexToOPFSWorker(indexPath, index);

        // Warnings
        const warnings: string[] = [];
        if (entryCount > MEMORY_SAFETY.WARNING_THRESHOLD) {
          warnings.push(
            `Very large file (${(entryCount / 1_000_000).toFixed(1)}M entries). Performance may be affected.`
          );
        } else if (entryCount > MEMORY_SAFETY.MAX_ENTRIES_PER_FILE_RECOMMENDED) {
          warnings.push(
            `Large file (${Math.round(entryCount / 1000)}K entries). Consider splitting for better performance.`
          );
        }

        const { entries, ...metaData } = index;
        const memStatus = getMemoryStatus();

        console.log('[Worker] Streaming indexResult:', {
          fileName,
          entryCount,
          parseTimeMs,
          streamingMode: true,
        });

        self.postMessage({
          type: 'indexResult',
          payload: {
            ...metaData,
            count: entryCount,
            parseTimeMs,
            warnings,
            memoryStatus: memStatus,
            streamingMode: true,
          },
        });
      } catch (err) {
        self.postMessage({
          type: 'error',
          payload: { message: `Streaming indexing failed: ${err}` },
        });
      }
      break;
    }

    // =====================================================
    // LOAD INDICES: Load indices from OPFS into Worker memory
    // =====================================================
    // =====================================================
    // LOAD INDICES: Load indices from OPFS into Worker memory
    // =====================================================
    case 'loadIndices': {
      const { files } = payload as { files: { opfsPath: string; name?: string }[] };
      let loadedCount = 0;
      const loadedMetadata: Array<{
        opfsPath: string;
        fileName: string;
        stats: any;
        entriesOmitted?: boolean;
      }> = [];
      const filesToHydrate: { opfsPath: string; fileName: string }[] = [];

      try {
        for (const file of files) {
          let index: ParsedFileIndex | null = null;
          let isCached = false;

          if (fileIndicesCache.has(file.opfsPath)) {
            index = fileIndicesCache.get(file.opfsPath)!;
            isCached = true;
          } else {
            // Try loading from cache
            const indexPath = `${file.opfsPath}_index`;
            index = await loadIndexFromOPFSWorker(indexPath);

            // If no saved index exists yet (e.g., seeded session or cleared index), build it from raw OPFS content
            if (!index) {
              const rawContent = await readFromOPFSWorker(file.opfsPath);
              if (rawContent) {
                const fileName = file.name || file.opfsPath;
                index = await parseContentToIndexWithProgress(
                  rawContent,
                  file.opfsPath,
                  fileName,
                  () => {}
                );
                await saveIndexToOPFSWorker(indexPath, index);
              }
            }
          }

          if (index) {
            // Check if this is a metadata-only index (entries omitted)
            const entriesOmitted = (index as any).entriesOmitted === true;

            // If entries are missing/omitted, initialize empty array ensuring no crash
            if (!index.entries) index.entries = [];

            if (!isCached) {
              fileIndicesCache.set(file.opfsPath, index);
              // Use entryCount from metadata if available (for omitted entries case)
              const count = entriesOmitted ? (index as any).entryCount || 0 : index.entries.length;
              totalCachedEntryCount += count;
            } else {
              // If cached but entries omitted, we might need to hydrate (if not already hydrating)
              // But for now assume cache is source of truth
            }

            loadedCount++;

            // Extract metadata to send back
            // Use type assertion to handle the temporary entriesOmitted property
            const { entries, ...metaData } = index as any;

            loadedMetadata.push({
              opfsPath: file.opfsPath,
              fileName: index.fileName,
              stats: metaData,
              // Flag if hydration is needed so UI can show loading state
              entriesOmitted: entriesOmitted && index.entries.length === 0,
            });

            // If entries were omitted, we need to hydrate them from raw content
            if (entriesOmitted && index.entries.length === 0) {
              if (!hydratingFiles.has(file.opfsPath)) {
                filesToHydrate.push({
                  opfsPath: file.opfsPath,
                  fileName: index.fileName,
                });
                hydratingFiles.add(file.opfsPath);
              }
            }
          }
        }

        // Send metadata to UI immediately
        self.postMessage({
          type: 'indicesLoaded',
          payload: { count: loadedCount, files: loadedMetadata },
        });

        // Hydrate files in background (restore entries)
        for (const file of filesToHydrate) {
          console.log(`[Worker] Hydrating entries for ${file.fileName}...`);
          try {
            const content = await readFromOPFSWorker(file.opfsPath);
            if (content) {
              // Re-parse to get entries
              // We use the progress version but can ignore progress callback since UI already has stats
              // Or we could send a 'hydrating' status? For now just silent.
              const fullIndex = await parseContentToIndexWithProgress(
                content,
                file.opfsPath,
                file.fileName,
                () => {} // No progress updates needed for hydration
              );

              // Update cache with full index
              // Maintain the ID/stats from previous load if possible, but fullIndex should be accurate
              if (fileIndicesCache.has(file.opfsPath)) {
                // Adjust total count: remove old (likely 0 or cached count), add new
                // Actually we already added the count from metadata, so we might double count if we aren't careful?
                // Wait, we added `totalCachedEntryCount += count` above based on metadata.
                // fullIndex.entries.length should be same as count.
                // So no change to totalCachedEntryCount needed ideally.
                // But let's be safe:
                // If old index had entries, remove them (but it likely didn't)
                // Actually the `totalCachedEntryCount` logic is global.
                // Let's just swap the index.
                fileIndicesCache.set(file.opfsPath, fullIndex);
                console.log(`[Worker] Hydration complete for ${file.fileName}`);

                // Notify main thread that hydration is complete so it can request full stats (histogram, timeline)
                self.postMessage({
                  type: 'hydrationComplete',
                  payload: {
                    opfsPath: file.opfsPath,
                    fileName: file.fileName,
                    entryCount: fullIndex.entries.length,
                  },
                });
              }
            }
          } catch (e) {
            console.error(`[Worker] Failed to hydrate ${file.fileName}`, e);
          } finally {
            hydratingFiles.delete(file.opfsPath);
          }
        }
      } catch (err) {
        self.postMessage({ type: 'error', payload: { message: `Failed to load indices: ${err}` } });
      }
      break;
    }

    // =====================================================
    // REMOVE FILE: Clear from cache
    // =====================================================
    case 'removeFile': {
      const { opfsPath } = payload;
      fileIndicesCache.delete(opfsPath);
      break;
    }

    // =====================================================
    // CLEAR ALL CACHES: Called when user uploads new data or switches analysis
    // =====================================================
    case 'clearAllCaches': {
      clearGroupingCaches();
      currentSessionFileKeys = [];
      console.log('[Worker] All grouping caches cleared by main thread');
      self.postMessage({ type: 'cachesCleared' });
      break;
    }

    // =====================================================
    // HISTOGRAM: Aggregate log counts by time bucket
    // =====================================================
    case 'getHistogram': {
      const { files, bucketSizeMs } = payload as {
        files: { opfsPath: string }[];
        bucketSizeMs: number;
      };

      try {
        const buckets: Record<
          number,
          { timestamp: number; error: number; warn: number; info: number }
        > = {};

        for (const file of files) {
          let entries: { timestamp: string; level: string; hasError: boolean }[] | null = null;

          // Try to get from cache first
          const index = fileIndicesCache.get(file.opfsPath);
          if (index) {
            entries = index.entries;
          } else {
            // Fallback: File evicted or not found? Try loading from OPFS
            // For histogram we need to iterate entries. Re-parsing is safer than loading huge JSON.
            try {
              const content = await readFromOPFSWorker(file.opfsPath);
              if (content) {
                // Use generator for memory efficiency during iteration
                const generator = parseLogsGenerator(content);
                for (const log of generator) {
                  // Process log directly here to avoid storing array
                  const ts = parseTimestampToMs(log.timestamp);
                  const bucketTime = Math.floor(ts / bucketSizeMs) * bucketSizeMs;

                  if (!buckets[bucketTime]) {
                    buckets[bucketTime] = { timestamp: bucketTime, error: 0, warn: 0, info: 0 };
                  }

                  const lvl = (log.level || '').toUpperCase();
                  const isError =
                    lvl === 'ERR' ||
                    lvl === 'ERROR' ||
                    lvl === 'FTL' ||
                    lvl === 'FATAL' ||
                    lvl === 'CRITICAL';
                  const isWarn = lvl === 'WRN' || lvl === 'WARN' || lvl === 'WARNING';

                  if (isError) buckets[bucketTime].error++;
                  else if (isWarn) buckets[bucketTime].warn++;
                  else buckets[bucketTime].info++;
                }
                // Entries processed via generator, set null to skip array loop
                entries = null;
              }
            } catch (e) {
              console.warn(`[Worker] Failed to re-parse ${file.opfsPath} for histogram`, e);
            }
          }

          // If we have cached entries array, use it (faster with pre-computed timestampMs)
          if (entries) {
            for (const entry of entries) {
              // Use pre-computed timestampMs if available, fallback to parsing
              const ts = (entry as any).timestampMs || parseTimestampToMs(entry.timestamp);
              const bucketTime = Math.floor(ts / bucketSizeMs) * bucketSizeMs;

              if (!buckets[bucketTime]) {
                buckets[bucketTime] = { timestamp: bucketTime, error: 0, warn: 0, info: 0 };
              }

              const lvl = (entry.level || '').toUpperCase();
              if (
                entry.hasError ||
                lvl === 'ERR' ||
                lvl === 'ERROR' ||
                lvl === 'FTL' ||
                lvl === 'FATAL'
              ) {
                buckets[bucketTime].error++;
              } else if (lvl === 'WRN' || lvl === 'WARN' || lvl === 'WARNING') {
                buckets[bucketTime].warn++;
              } else {
                buckets[bucketTime].info++;
              }
            }
          }
        }

        const result = Object.values(buckets).sort((a, b) => a.timestamp - b.timestamp);

        self.postMessage({
          type: 'histogramResult',
          payload: result,
        });
      } catch (err) {
        self.postMessage({ type: 'error', payload: { message: `Histogram failed: ${err}` } });
      }
      break;
    }

    // =====================================================
    // FETCH MODE: Load specific log entries by byte range
    // =====================================================
    case 'fetchLogs': {
      const { content, ranges } = payload as {
        content: string;
        ranges: { start: number; end: number; lineNumber: number }[];
      };

      try {
        const logs: StructuredLog[] = [];

        for (const range of ranges) {
          const logContent = sliceUtf8Bytes(content, range.start, range.end - range.start);
          const parsed = parseLogs(logContent);
          if (parsed.length > 0) {
            // Fix line number to match original
            parsed[0].lineNumber = range.lineNumber;
            logs.push(parsed[0]);
          }
        }

        self.postMessage({
          type: 'fetchResult',
          payload: logs,
        });
      } catch (err) {
        self.postMessage({
          type: 'error',
          payload: { message: `Fetch failed: ${err}` },
        });
      }
      break;
    }

    // =====================================================
    // GROUP MODE: Group index entries (CPU heavy)
    // =====================================================
    case 'groupEntries': {
      const {
        files,
        selectedLevels,
        selectedVerbs,
        selectedSources,
        filterRequestId,
        groupingMode,
        showSlowQueriesOnly,
      } = payload as {
        files: { opfsPath: string }[];
        selectedLevels: string[];
        selectedVerbs: string[];
        selectedSources: string[];
        filterRequestId: string;
        groupingMode: 'requestId' | 'correlationId';
        showSlowQueriesOnly: boolean;
      };

      try {
        // Generate cache key
        const cacheKey = generateCacheKey(
          files,
          selectedLevels,
          selectedVerbs,
          selectedSources,
          filterRequestId,
          groupingMode,
          showSlowQueriesOnly
        );

        // SESSION TRACKING: Detect if user switched to different analysis data
        const newSessionKeys = files
          .map((f) => f.opfsPath)
          .sort()
          .join('|');
        const currentSessionKey = currentSessionFileKeys.join('|');
        const isNewSession = newSessionKeys !== currentSessionKey;

        if (isNewSession) {
          // User switched to different data - clear all grouping caches
          clearGroupingCaches();
          currentSessionFileKeys = files.map((f) => f.opfsPath).sort();
          console.log('[Worker] New session detected, cleared grouping caches');
        }

        // Check if we have cached results for this exact configuration
        if (groupingSummaryCache && groupingSummaryCache.cacheKey === cacheKey) {
          // Use cached results
          groupedResultsCache = groupingSummaryCache.groupedResults;
          self.postMessage({
            type: 'groupResult',
            payload: {
              groups: groupingSummaryCache.summaries,
              computeTimeMs: 0, // Instant from cache
              fromCache: true,
            },
          });
          break;
        }

        const startTime = performance.now();

        const levels = new Set(selectedLevels);
        const verbs = new Set(selectedVerbs);
        const sources = new Set(selectedSources);

        // 1. Flatten all entries FROM CACHE - avoid object spread for performance
        const allEntries: IndexEntryWithPath[] = [];
        const fileList = files; // files are { opfsPath: string }

        for (const fileMeta of fileList) {
          const index = fileIndicesCache.get(fileMeta.opfsPath);
          if (index) {
            for (const entry of index.entries) {
              // Avoid spread operator - directly assign opfsPath to entry
              (entry as IndexEntryWithPath).opfsPath = fileMeta.opfsPath;
              allEntries.push(entry as IndexEntryWithPath);
            }
          }
        }

        // 2. Group all entries first so expanding a matched request preserves its full timeline context
        const allGroups = new Map<string, IndexEntryWithPath[]>();
        for (const entry of allEntries) {
          let id =
            groupingMode === 'requestId'
              ? entry.requestId || 'Global / Startup'
              : entry.correlationId || 'Global / Startup';
          if (!id) id = 'Global / Startup';

          if (!allGroups.has(id)) {
            allGroups.set(id, []);
          }
          allGroups.get(id)!.push(entry);
        }

        const entryMatchesFilters = (entry: IndexEntryWithPath): boolean => {
          if (levels.size > 0 && !levels.has(entry.level)) return false;
          if (verbs.size > 0 && entry.httpMethod && !verbs.has(entry.httpMethod)) return false;
          if (sources.size > 0 && entry.source && !sources.has(entry.source)) return false;
          if (showSlowQueriesOnly && !entry.isSlowSql) return false;
          if (filterRequestId && !matchesIdQuery(entry, filterRequestId)) return false;
          return true;
        };

        // 3. Keep groups that have at least one matching entry; preserve full request timeline for named groups
        const groups = new Map<string, IndexEntryWithPath[]>();
        let totalFilteredEntries = 0;

        for (const [id, groupEntries] of allGroups) {
          if (id === 'Global / Startup') {
            const matched = groupEntries.filter(entryMatchesFilters);
            if (matched.length > 0) {
              groups.set(id, matched);
              totalFilteredEntries += matched.length;
            }
          } else if (groupEntries.some(entryMatchesFilters)) {
            const scoped =
              sources.size > 0
                ? groupEntries.filter((e) => !e.source || sources.has(e.source))
                : groupEntries;
            if (scoped.length > 0) {
              groups.set(id, scoped);
              totalFilteredEntries += scoped.length;
            }
          }
        }

        // Cache results
        groupedResultsCache = groups;

        // 4. Transform to Summaries (Lightweight)
        const summaries: IndexGroupSummary[] = [];
        for (const [id, entries] of groups) {
          // Sort entries chronologically with lineNumber tie-breaker
          entries.sort((a, b) => compareLogOrder(a, b, parseTimestampToMs));

          const first = entries[0];
          const last = entries[entries.length - 1];

          let duration: string | null = null;
          // Use timestampMs for fast duration calculation
          const startMs = first.timestampMs || parseTimestampToMs(first.timestamp);
          const endMs = last.timestampMs || parseTimestampToMs(last.timestamp);
          const diff = endMs - startMs;
          if (diff < 1000) duration = `${diff}ms`;
          else duration = `${(diff / 1000).toFixed(2)}s`;

          const hasError = entries.some((e) => e.hasError);

          summaries.push({
            id,
            count: entries.length,
            hasError,
            firstTimestamp: first.timestamp,
            duration,
          });
        }
        // 5. Sort groups using timestampMs
        summaries.sort((a, b) => {
          return parseTimestampToMs(b.firstTimestamp) - parseTimestampToMs(a.firstTimestamp);
        });

        const computeTimeMs = Math.round(performance.now() - startTime);

        // MEMORY SAFETY: Only cache if dataset is reasonably sized
        if (shouldCacheGrouping(totalFilteredEntries)) {
          groupingSummaryCache = {
            cacheKey,
            summaries,
            groupedResults: groups,
            computeTimeMs,
            entryCount: totalFilteredEntries,
          };
        } else {
          // Clear old cache to free memory, don't store new one
          groupingSummaryCache = null;
          console.log(
            `[Worker] Skipping grouping cache for large dataset (${totalFilteredEntries.toLocaleString()} entries)`
          );
        }

        self.postMessage({
          type: 'groupResult',
          payload: {
            groups: summaries,
            computeTimeMs,
            fromCache: false,
            entryCount: totalFilteredEntries,
            cachingEnabled: shouldCacheGrouping(totalFilteredEntries),
          },
        });
      } catch (err) {
        self.postMessage({ type: 'error', payload: { message: `Grouping failed: ${err}` } });
      }
      break;
    }

    // =====================================================
    // FETCH GROUP DETAILS: Retrieve full logs for a specific group
    // =====================================================
    case 'fetchGroupDetails': {
      const { groupId } = payload as { groupId: string };
      const entries = groupedResultsCache.get(groupId);

      if (!entries) {
        self.postMessage({ type: 'groupDetailsResult', payload: { groupId, logs: [] } });
        break;
      }

      try {
        // LIMIT to avoid OOM for large groups
        const MAX_LOGS = 1000;
        const limitedEntries = entries.length > MAX_LOGS ? entries.slice(0, MAX_LOGS) : entries;

        // Optimization: Group by file path to minimize file reads
        const entriesByPath = new Map<string, IndexEntryWithPath[]>();
        for (const entry of limitedEntries) {
          if (!entriesByPath.has(entry.opfsPath)) entriesByPath.set(entry.opfsPath, []);
          entriesByPath.get(entry.opfsPath)!.push(entry);
        }

        const logs: StructuredLog[] = [];

        for (const [path, fileEntries] of entriesByPath) {
          const file = await openOPFSFileWorker(path);
          if (!file) continue;
          const index = fileIndicesCache.get(path);
          const sourceName = index?.fileName || '';
          for (const entry of fileEntries) {
            const chunk = await file
              .slice(entry.byteOffset, entry.byteOffset + entry.byteLength)
              .text();
            const parsed = parseLogs(chunk);
            if (parsed.length > 0) {
              parsed[0].lineNumber = entry.lineNumber;
              if (sourceName) parsed[0].source = sourceName;
              logs.push(parsed[0]);
            }
          }
        }

        // Sort logs chronologically with lineNumber tie-breaker
        logs.sort((a, b) => compareLogOrder(a, b, parseTimestampToMs));

        self.postMessage({
          type: 'groupDetailsResult',
          payload: { groupId, logs },
        });
      } catch (err) {
        console.error('Fetch group details failed', err);
        self.postMessage({ type: 'error', payload: { message: `Fetch details failed: ${err}` } });
      }
      break;
    }

    // =====================================================
    // LEGACY PARSE MODE: Full parsing (old behavior)
    // =====================================================
    case 'parse': {
      const { content, sourceName, context } = payload;
      lastLogs = [];
      const generator = parseLogsGenerator(content, sourceName);

      let count = 0;
      const stats = { total: 0, errors: 0, warnings: 0, infos: 0 };
      const uniqueRequestIds = new Set<string>();
      const uniqueCorrelationIds = new Set<string>();

      for (const log of generator) {
        lastLogs.push(log);
        count++;

        const lvl = (log.level || '').toUpperCase();
        if (
          lvl === 'ERR' ||
          lvl === 'ERROR' ||
          lvl === 'FTL' ||
          lvl === 'FATAL' ||
          lvl === 'CRITICAL'
        )
          stats.errors++;
        else if (lvl === 'WRN' || lvl === 'WARN' || lvl === 'WARNING') stats.warnings++;
        else stats.infos++;

        if (log.requestId) uniqueRequestIds.add(log.requestId);
        if (log.metadata?.CorrelationId) uniqueCorrelationIds.add(log.metadata.CorrelationId);

        if (count % 5000 === 0) {
          self.postMessage({ type: 'progress', payload: count });
        }
      }
      stats.total = count;

      self.postMessage({
        type: 'result',
        payload: lastLogs,
        stats,
        context,
        uniqueIds: {
          requestIds: Array.from(uniqueRequestIds),
          correlationIds: Array.from(uniqueCorrelationIds),
        },
      });
      break;
    }

    default:
      self.postMessage({
        type: 'error',
        payload: { message: `Unknown message type: ${type}` },
      });
  }
};

// Type definitions for worker messages
export type WorkerMessage =
  | { type: 'indexFile'; payload: { content: string; opfsPath: string; fileName: string } }
  | {
      type: 'fetchLogs';
      payload: { content: string; ranges: { start: number; end: number; lineNumber: number }[] };
    }
  | { type: 'parse'; payload: { content: string; sourceName: string; context: unknown } };

export type WorkerResponse =
  | { type: 'indexResult'; payload: ParsedFileIndex }
  | { type: 'fetchResult'; payload: StructuredLog[] }
  | { type: 'result'; payload: StructuredLog[]; stats: object; context: unknown; uniqueIds: object }
  | { type: 'progress'; payload: number; message?: string }
  | { type: 'error'; payload: { message: string } };
