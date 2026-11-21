export interface StructuredLog {
  lineNumber: number;
  timestamp: string;
  timezone: string;
  requestId: string;
  level: string;
  message: string;
  sql?: string;
  sqlDuration?: number;
  isSlowSql?: boolean;
  httpMethod?: string;
  exception?: string;
  source?: string;
  metadata?: Record<string, string>;
}

// =====================================================
// SINGLETON INSTANCES - Avoid repeated instantiation
// =====================================================
const DECODER = new TextDecoder();

// =====================================================
// MODULE-LEVEL REGEX PATTERNS - Avoid recompilation
// =====================================================

// Serilog text format regex (handles optional UTF-8 BOM on line 1 and multiple bracketed fields)
const LOG_REGEX =
  /^\uFEFF?(?<ts>[\d-]+\s[\d:.]+)\s(?<tz>[\+\-]\d{2}:\d{2})\s+(?<meta>(?:\[[^\]]+\]\s*)+)(?<msg>.*)$/;

// Level pattern for text logs
const LEVEL_PATTERN =
  /\[(INF|WRN|ERR|DBG|VRB|FTL|INFORMATION|WARNING|ERROR|DEBUG|VERBOSE|FATAL)\]/i;
const LEVEL_ALT_PATTERN = /\[Level:([^\]]+)\]/i;

// Request ID pattern
const REQUEST_ID_PATTERN = /\[RequestId:([^\]]+)\]/;

// Metadata pattern
const META_PATTERN = /\[([^:\]]+):([^\]]+)\]/g;

// HTTP method patterns
const HTTP_METHOD_PATTERN = /Request starting HTTP\/[\d.]+\s+([A-Z]+)/;
const HTTP_METHOD_ALT_PATTERN = /HTTP\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+/;

// Duration pattern
const DURATION_PATTERN =
  /\[(\d+)ms\]|\((\d+)ms\)|duration:?\s*(\d+)ms|in\s*(\d+\.?\d*)ms|DbCommand\s*\((\d+)ms\)/i;

// Level mapping for JSON logs
const LEVEL_MAP: Record<string, string> = {
  INFORMATION: 'INF',
  WARNING: 'WRN',
  ERROR: 'ERR',
  DEBUG: 'DBG',
  VERBOSE: 'VRB',
  FATAL: 'FTL',
};

// Long level name mapping
const LONG_LEVEL_MAP: Record<string, string> = {
  INFORMATION: 'INF',
  WARNING: 'WRN',
  ERROR: 'ERR',
  DEBUG: 'DBG',
  VERBOSE: 'VRB',
  FATAL: 'FTL',
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Parse timestamp string to milliseconds
 * Only called when needed for sorting/grouping, not during indexing
 */
export function parseTimestampToMs(timestamp: string): number {
  try {
    return new Date(timestamp.replace(' ', 'T')).getTime();
  } catch {
    return 0;
  }
}

/**
 * Fast byte length approximation for ASCII-dominated text
 * For log files which are mostly ASCII, this is ~99% accurate and 100x faster
 * than TextEncoder.encode().length
 */
const ENCODER = new TextEncoder();

function fastByteLength(str: string): number {
  // Fast path for pure ASCII (common in logs): length === byte length
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127) {
      // Exact UTF-8 byte length (handles surrogate pairs / 4-byte emoji accurately)
      return ENCODER.encode(str).byteLength;
    }
  }
  return str.length;
}

/**
 * Get byte length of a string
 * Uses fast path for ASCII, falls back to proper encoding for non-ASCII
 */
export function getByteLength(str: string): number {
  return fastByteLength(str);
}

export const ANALYSIS_EXPORT_SIGNATURE = 'devpad_log_analysis_v1';

export function isAnalysisExport(content: string): boolean {
  if (!content) return false;
  const start = content.substring(0, 200);
  return (
    start.includes(`"__type":"${ANALYSIS_EXPORT_SIGNATURE}"`) ||
    start.includes(`"__type": "${ANALYSIS_EXPORT_SIGNATURE}"`)
  );
}

export function parseLogs(content: string, sourceName?: string): StructuredLog[] {
  const logs: StructuredLog[] = [];
  const generator = parseLogsGenerator(content, sourceName);
  for (const log of generator) {
    logs.push(log);
  }
  return logs;
}

export function* parseLogsGenerator(
  content: string,
  sourceName?: string
): Generator<StructuredLog, void, unknown> {
  const trimmed = content.trim();

  // Protect against our own analysis exports being parsed as raw logs
  if (isAnalysisExport(trimmed)) {
    return;
  }

  // Try parsing as JSON first
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const isArray = trimmed.startsWith('[');
      if (isArray) {
        const jsonData = JSON.parse(trimmed) as unknown[];
        for (let i = 0; i < jsonData.length; i++) {
          const entry = jsonData[i] as Record<string, unknown>;
          const log = parseJsonLogEntry(entry, i + 1, sourceName);
          if (log) yield log;
        }
        return;
      } else {
        // Newline-delimited JSON
        let start = 0;
        let lineIdx = 1;
        while (start < content.length) {
          let end = content.indexOf('\n', start);
          if (end === -1) end = content.length;

          const line = content.substring(start, end).trim();
          if (line.startsWith('{')) {
            try {
              const entry = JSON.parse(line);
              const log = parseJsonLogEntry(entry, lineIdx, sourceName);
              if (log) yield log;
            } catch {
              /* skip */
            }
          }
          start = end + 1;
          lineIdx++;
        }
        return;
      }
    } catch {
      // Fall through
    }
  }

  // Parse as Serilog text format if no JSON logs found
  yield* parseTextLogsGenerator(content, sourceName);
}

export function parseJsonLogs(content: string, sourceName?: string): StructuredLog[] {
  const logs: StructuredLog[] = [];
  const isArray = content.startsWith('[');

  if (isArray) {
    const jsonData = JSON.parse(content) as unknown[];
    for (let i = 0; i < jsonData.length; i++) {
      const entry = jsonData[i] as Record<string, unknown>;
      const log = parseJsonLogEntry(entry, i + 1, sourceName);
      if (log) logs.push(log);
    }
  } else {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('{')) {
        try {
          const entry = JSON.parse(line);
          const log = parseJsonLogEntry(entry, i + 1, sourceName);
          if (log) logs.push(log);
        } catch {
          /* skip */
        }
      }
    }
  }
  return logs;
}

function parseJsonLogEntry(
  entry: Record<string, unknown>,
  lineNumber: number,
  sourceName?: string
): StructuredLog | null {
  // Extract timestamp
  const timestamp = (entry.Timestamp || entry.timestamp || entry['@t'] || '') as string;
  if (!timestamp) return null;

  // Extract level
  const rawLevel = (entry.Level || entry.level || entry['@l'] || 'Information') as string;
  const level = LEVEL_MAP[rawLevel] || rawLevel.substring(0, 3).toUpperCase();

  // Extract message
  const messageTemplate = (entry.MessageTemplate ||
    entry.messageTemplate ||
    entry['@mt'] ||
    entry.message ||
    entry.Message ||
    '') as string;

  // Extract properties
  const props = (entry.Properties || entry.properties || {}) as Record<string, unknown>;

  // Extract request ID
  const requestId =
    (props.RequestId as string) || (props.requestId as string) || (entry.RequestId as string) || '';

  // Extract HTTP method
  const httpMethod = (props.HttpMethod as string) || (props.httpMethod as string) || undefined;

  // Extract exception
  const exception = (entry.Exception || entry.exception) as string | undefined;

  // Extract SQL duration
  let sqlDuration: number | undefined;
  let isSlowSql = false;

  const elapsed = (props.Elapsed || props.elapsed || props.ElapsedMilliseconds) as
    | number
    | undefined;
  if (elapsed !== undefined) {
    sqlDuration = elapsed;
    isSlowSql = elapsed > 500;
  }

  // Build message with SQL if present
  let message = messageTemplate;
  const sql = (props.Sql || props.sql) as string | undefined;
  if (sql) {
    message += '\n' + sql;
  }

  // Replace placeholders in message template with property values
  message = message.replace(/\{(\w+)\}/g, (_, key) => {
    const val = props[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });

  // Parse timezone from timestamp
  const tzMatch = timestamp.match(/([+-]\d{2}:\d{2})$/);
  const timezone = tzMatch ? tzMatch[1] : '+00:00';

  // Collect all other properties as metadata
  const metadata: Record<string, string> = {};
  Object.entries(props).forEach(([key, value]) => {
    if (
      key !== 'RequestId' &&
      key !== 'requestId' &&
      key !== 'Sql' &&
      key !== 'sql' &&
      key !== 'Elapsed' &&
      key !== 'elapsed' &&
      key !== 'HttpMethod' &&
      key !== 'httpMethod'
    ) {
      metadata[key] = String(value);
    }
  });

  return {
    lineNumber,
    timestamp: timestamp
      .replace(/([+-]\d{2}:\d{2})$/, '')
      .replace('T', ' ')
      .replace('Z', ''),
    timezone,
    requestId,
    level,
    message,
    httpMethod,
    sqlDuration,
    isSlowSql,
    exception,
    source: sourceName,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

export function parseTextLogs(content: string, sourceName?: string): StructuredLog[] {
  const logs: StructuredLog[] = [];
  const generator = parseTextLogsGenerator(content, sourceName);
  for (const log of generator) {
    logs.push(log);
  }
  return logs;
}

function* parseTextLogsGenerator(
  content: string,
  sourceName?: string
): Generator<StructuredLog, void, unknown> {
  let currentLog: StructuredLog | null = null;
  let start = 0;
  let lineIdx = 1;

  while (start < content.length) {
    let end = content.indexOf('\n', start);
    if (end === -1) end = content.length;

    let line = content.substring(start, end);
    if (line.endsWith('\r')) line = line.slice(0, -1);

    const match = line.match(LOG_REGEX);

    if (match && match.groups) {
      if (currentLog) yield processLog(currentLog);

      const { ts, tz, meta, msg } = match.groups;
      const reqIdMatch = meta.match(/\[RequestId:([^\]]+)\]/);
      const reqId = reqIdMatch ? reqIdMatch[1] : '';

      const metadata: Record<string, string> = {};
      const metaPattern = /\[([^:\]]+):([^\]]+)\]/g;
      let metaMatch;
      while ((metaMatch = metaPattern.exec(meta)) !== null) {
        const key = metaMatch[1].trim();
        const val = metaMatch[2].trim();
        if (key !== 'RequestId') metadata[key] = val;
      }

      let lvl = 'INF';
      const levelPattern =
        /\[(INF|WRN|ERR|DBG|VRB|FTL|INFORMATION|WARNING|ERROR|DEBUG|VERBOSE|FATAL)\]/i;
      const lvlMatch = meta.match(levelPattern) || meta.match(/\[Level:([^\]]+)\]/i);

      if (lvlMatch) {
        const rawLvl = lvlMatch[1].toUpperCase();
        if (LEVEL_MAP[rawLvl]) {
          lvl = LEVEL_MAP[rawLvl];
        } else if (rawLvl.length > 3) {
          const longMap: Record<string, string> = {
            INFORMATION: 'INF',
            WARNING: 'WRN',
            ERROR: 'ERR',
            DEBUG: 'DBG',
            VERBOSE: 'VRB',
            FATAL: 'FTL',
          };
          lvl = longMap[rawLvl] || rawLvl.substring(0, 3);
        } else {
          lvl = rawLvl;
        }
      }

      currentLog = {
        lineNumber: lineIdx,
        timestamp: ts,
        timezone: tz,
        requestId: reqId,
        level: lvl,
        message: msg.trim(),
        source: sourceName,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    } else if (currentLog) {
      currentLog.message += '\n' + line;
    }

    start = end + 1;
    lineIdx++;
  }

  if (currentLog) yield processLog(currentLog);
}

function processLog(log: StructuredLog): StructuredLog {
  // Extract HTTP Method using module-level patterns
  const methodMatch = log.message.match(HTTP_METHOD_PATTERN);
  if (methodMatch) {
    log.httpMethod = methodMatch[1];
  }

  // Fallback: try other patterns
  if (!log.httpMethod) {
    const altMatch = log.message.match(HTTP_METHOD_ALT_PATTERN);
    if (altMatch) {
      log.httpMethod = altMatch[1];
    }
  }

  // Extract duration using module-level pattern
  const durationMatch = log.message.match(DURATION_PATTERN);
  if (durationMatch) {
    const durationStr =
      durationMatch[1] ||
      durationMatch[2] ||
      durationMatch[3] ||
      durationMatch[4] ||
      durationMatch[5];
    const duration = parseInt(durationStr);
    if (!isNaN(duration)) {
      log.sqlDuration = duration;
      if (duration > 500) {
        log.isSlowSql = true;
      }
    }
  }

  return log;
}

// Helper to merge and sort logs from multiple sources
export function mergeLogs(logSets: StructuredLog[][]): StructuredLog[] {
  const flattened = logSets.flat();
  return flattened.sort((a, b) => {
    return parseTimestampToMs(a.timestamp) - parseTimestampToMs(b.timestamp);
  });
}

// Keep for single line testing if needed, but parseLogs is the main entry
export function parseLogLine(line: string, _lineNumber: number): StructuredLog | null {
  const logs = parseLogs(line);
  return logs.length > 0 ? logs[0] : null;
}

// =====================================================
// STREAMING INDEX PARSER - For large file handling
// Creates lightweight index without storing message content
// =====================================================

import type { LogEntryIndex, ParsedFileIndex } from './logIndex';
import { createEmptyFileIndex } from './logIndex';

/**
 * Parse content to create an index with byte offsets
 * Used for streaming large files - only stores metadata, not message content
 */
export function* parseLogsToIndexGenerator(
  content: string,
  baseOffset: number,
  sourceName?: string
): Generator<LogEntryIndex, void, unknown> {
  const trimmed = content.trim();

  if (isAnalysisExport(trimmed)) {
    return;
  }

  // Try JSON parsing
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const isArray = trimmed.startsWith('[');
      if (isArray) {
        // JSON array - need to track positions
        const jsonData = JSON.parse(trimmed) as unknown[];
        let currentOffset = baseOffset + 1; // Skip '['

        for (let i = 0; i < jsonData.length; i++) {
          const entry = jsonData[i] as Record<string, unknown>;
          const entryStr = JSON.stringify(entry);
          const log = parseJsonLogEntry(entry, i + 1, sourceName);

          if (log) {
            yield createIndexEntry(log, currentOffset, entryStr.length);
          }
          currentOffset += entryStr.length + 1; // +1 for comma/bracket
        }
        return;
      } else {
        // Newline-delimited JSON
        let start = 0;
        let lineIdx = 1;

        while (start < content.length) {
          let end = content.indexOf('\n', start);
          if (end === -1) end = content.length;

          const line = content.substring(start, end);
          const trimmedLine = line.trim();
          const byteLength = getByteLength(line + '\n');

          if (trimmedLine.startsWith('{')) {
            try {
              const entry = JSON.parse(trimmedLine);
              const log = parseJsonLogEntry(entry, lineIdx, sourceName);
              if (log) {
                yield createIndexEntry(log, baseOffset + start, byteLength);
              }
            } catch {
              /* skip */
            }
          }
          start = end + 1;
          lineIdx++;
        }
        return;
      }
    } catch {
      // Fall through to text parsing
    }
  }

  // Parse as text format with offset tracking
  yield* parseTextLogsToIndexGenerator(content, baseOffset, sourceName);
}

/**
 * Parse text logs to index with byte offset tracking
 */
function* parseTextLogsToIndexGenerator(
  content: string,
  baseOffset: number,
  sourceName?: string
): Generator<LogEntryIndex, void, unknown> {
  let currentLogStartByte = 0;
  let currentByteOffset = 0;
  let currentLog: StructuredLog | null = null;
  let start = 0;
  let lineIdx = 1;

  while (start < content.length) {
    let end = content.indexOf('\n', start);
    const hasNewline = end !== -1;
    if (!hasNewline) end = content.length;

    const rawSliceEnd = hasNewline ? end + 1 : end;
    const lineByteLength = getByteLength(content.substring(start, rawSliceEnd));

    let line = content.substring(start, end);
    if (line.endsWith('\r')) line = line.slice(0, -1);

    const match = line.match(LOG_REGEX);

    if (match && match.groups) {
      // New log entry detected - yield previous if exists
      if (currentLog) {
        const byteLength = currentByteOffset - currentLogStartByte;
        yield createIndexEntry(processLog(currentLog), baseOffset + currentLogStartByte, byteLength);
      }

      currentLogStartByte = currentByteOffset;
      const { ts, tz, meta, msg } = match.groups;
      const reqIdMatch = meta.match(REQUEST_ID_PATTERN);
      const reqId = reqIdMatch ? reqIdMatch[1] : '';

      const metadata: Record<string, string> = {};
      // Create a new regex instance for exec loop (stateful)
      const metaRegex = new RegExp(META_PATTERN.source, META_PATTERN.flags);
      let metaMatch;
      while ((metaMatch = metaRegex.exec(meta)) !== null) {
        const key = metaMatch[1].trim();
        const val = metaMatch[2].trim();
        if (key !== 'RequestId') metadata[key] = val;
      }

      let lvl = 'INF';
      const lvlMatch = meta.match(LEVEL_PATTERN) || meta.match(LEVEL_ALT_PATTERN);

      if (lvlMatch) {
        const rawLvl = lvlMatch[1].toUpperCase();
        if (LEVEL_MAP[rawLvl]) {
          lvl = LEVEL_MAP[rawLvl];
        } else if (rawLvl.length > 3) {
          lvl = LONG_LEVEL_MAP[rawLvl] || rawLvl.substring(0, 3);
        } else {
          lvl = rawLvl;
        }
      }

      currentLog = {
        lineNumber: lineIdx,
        timestamp: ts,
        timezone: tz,
        requestId: reqId,
        level: lvl,
        message: msg.trim(),
        source: sourceName,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    } else if (currentLog) {
      // Multi-line log continuation
      currentLog.message += '\n' + line;
    }

    currentByteOffset += lineByteLength;
    start = end + 1;
    lineIdx++;
  }

  // Yield last log
  if (currentLog) {
    const byteLength = currentByteOffset - currentLogStartByte;
    yield createIndexEntry(processLog(currentLog), baseOffset + currentLogStartByte, byteLength);
  }
}

/**
 * Create a lightweight index entry from a parsed log
 * Note: timestampMs is set to 0 here and computed lazily when needed for sorting
 */
function createIndexEntry(
  log: StructuredLog,
  byteOffset: number,
  byteLength: number
): LogEntryIndex {
  const lvl = (log.level || '').toUpperCase();
  const isError = lvl === 'ERR' || lvl === 'ERROR' || lvl === 'FTL' || lvl === 'FATAL';

  return {
    lineNumber: log.lineNumber,
    byteOffset,
    byteLength,
    timestamp: log.timestamp,
    timestampMs: 0, // Computed lazily when needed for sorting/grouping
    level: log.level,
    requestId: log.requestId || '',
    correlationId: log.metadata?.CorrelationId,
    httpMethod: log.httpMethod,
    hasError: isError || !!log.exception,
    hasSql: !!log.sql || !!log.sqlDuration,
    isSlowSql: !!log.isSlowSql,
    source: log.source,
  };
}

/**
 * Parse entire content and build complete file index
 */
export function parseContentToIndex(
  content: string,
  opfsPath: string,
  fileName: string
): ParsedFileIndex {
  const index = createEmptyFileIndex(opfsPath, fileName);
  index.totalBytes = getByteLength(content);

  const uniqueRequestIds = new Set<string>();
  const uniqueCorrelationIds = new Set<string>();
  const sourceStats: Record<string, number> = {};

  const generator = parseLogsToIndexGenerator(content, 0, fileName);

  let firstTs = '';
  let lastTs = '';

  for (const entry of generator) {
    index.entries.push(entry);
    index.stats.total++;

    // Time stats
    if (!firstTs) firstTs = entry.timestamp;
    lastTs = entry.timestamp;

    // Source stats
    const source = entry.source || 'Unknown';
    sourceStats[source] = (sourceStats[source] || 0) + 1;

    const lvl = (entry.level || '').toUpperCase();
    if (entry.hasError || lvl === 'ERR' || lvl === 'ERROR' || lvl === 'FTL' || lvl === 'FATAL') {
      index.stats.errors++;
    } else if (lvl === 'WRN' || lvl === 'WARN' || lvl === 'WARNING') {
      index.stats.warnings++;
    } else {
      index.stats.infos++;
    }

    if (entry.requestId) uniqueRequestIds.add(entry.requestId);
    if (entry.correlationId) uniqueCorrelationIds.add(entry.correlationId);
  }

  index.totalLogs = index.entries.length;
  index.uniqueRequestIds = Array.from(uniqueRequestIds);
  index.uniqueCorrelationIds = Array.from(uniqueCorrelationIds);
  index.sourceStats = sourceStats;

  // Calculate duration using pre-computed timestamps from first/last entries
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

  index.timeStats = {
    first: firstTs,
    last: lastTs,
    duration,
  };

  return index;
}

/**
 * Parse content with time-throttled progress reporting (500ms intervals)
 * This allows UI to show "Processed X rows" without blocking
 * Uses batch processing for better performance
 */
export async function parseContentToIndexWithProgress(
  content: string,
  opfsPath: string,
  fileName: string,
  onProgress: (rowCount: number) => void
): Promise<ParsedFileIndex> {
  const index = createEmptyFileIndex(opfsPath, fileName);
  index.totalBytes = getByteLength(content);

  const uniqueRequestIds = new Set<string>();
  const uniqueCorrelationIds = new Set<string>();
  const sourceStats: Record<string, number> = {};

  const generator = parseLogsToIndexGenerator(content, 0, fileName);

  let firstTs = '';
  let lastTs = '';
  let lastProgressTime = performance.now();
  const PROGRESS_INTERVAL_MS = 500; // Report every 500ms
  const BATCH_SIZE = 5000; // Process entries in batches before yielding

  for (const entry of generator) {
    index.entries.push(entry);
    index.stats.total++;

    // Time stats
    if (!firstTs) firstTs = entry.timestamp;
    lastTs = entry.timestamp;

    // Source stats
    const source = entry.source || 'Unknown';
    sourceStats[source] = (sourceStats[source] || 0) + 1;

    const lvl = (entry.level || '').toUpperCase();
    if (entry.hasError || lvl === 'ERR' || lvl === 'ERROR' || lvl === 'FTL' || lvl === 'FATAL') {
      index.stats.errors++;
    } else if (lvl === 'WRN' || lvl === 'WARN' || lvl === 'WARNING') {
      index.stats.warnings++;
    } else {
      index.stats.infos++;
    }

    if (entry.requestId) uniqueRequestIds.add(entry.requestId);
    if (entry.correlationId) uniqueCorrelationIds.add(entry.correlationId);

    // Batch-based progress reporting with time throttling
    if (index.entries.length % BATCH_SIZE === 0) {
      const now = performance.now();
      if (now - lastProgressTime >= PROGRESS_INTERVAL_MS) {
        onProgress(index.entries.length);
        lastProgressTime = now;
        // Yield to event loop to allow message sending
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  // Final progress update
  onProgress(index.entries.length);

  index.totalLogs = index.entries.length;
  index.uniqueRequestIds = Array.from(uniqueRequestIds);
  index.uniqueCorrelationIds = Array.from(uniqueCorrelationIds);
  index.sourceStats = sourceStats;

  // Calculate duration using parseTimestampToMs
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

  index.timeStats = {
    first: firstTs,
    last: lastTs,
    duration,
  };

  return index;
}

// =====================================================
// TRUE STREAMING PARSER - Processes files in chunks
// Never loads entire file in memory
// =====================================================

/**
 * State for streaming text log parsing
 * Maintains context across chunk boundaries
 */
interface StreamingParseState {
  lineIdx: number;
  byteOffset: number;
  pendingLine: string; // Incomplete line from previous chunk
  pendingLogStart: number; // Byte offset where current log started
  currentLog: StructuredLog | null;
}

/**
 * Create initial streaming parse state
 */
export function createStreamingParseState(): StreamingParseState {
  return {
    lineIdx: 1,
    byteOffset: 0,
    pendingLine: '',
    pendingLogStart: 0,
    currentLog: null,
  };
}

/**
 * Process a single chunk of text log data
 * Returns log entries found in this chunk, updating state for next chunk
 * This enables true streaming without loading entire file in memory
 */
export function* processTextLogChunk(
  chunk: string,
  state: StreamingParseState,
  sourceName?: string,
  isLastChunk: boolean = false
): Generator<LogEntryIndex, void, unknown> {
  // Prepend any pending line from previous chunk
  const content = state.pendingLine + chunk;
  let start = 0;

  while (start < content.length) {
    let end = content.indexOf('\n', start);

    // If no newline found and not last chunk, save for next chunk
    if (end === -1) {
      if (!isLastChunk) {
        state.pendingLine = content.substring(start);
        // Update byte offset for what we processed
        state.byteOffset += getByteLength(content.substring(0, start));
        return;
      }
      end = content.length;
    }

    let line = content.substring(start, end);
    if (line.endsWith('\r')) line = line.slice(0, -1);

    const match = line.match(LOG_REGEX);

    if (match && match.groups) {
      // New log entry detected - yield previous if exists
      if (state.currentLog) {
        const byteLength =
          state.byteOffset + getByteLength(content.substring(0, start)) - state.pendingLogStart;
        yield createIndexEntry(processLog(state.currentLog), state.pendingLogStart, byteLength);
      }

      state.pendingLogStart = state.byteOffset + getByteLength(content.substring(0, start));
      const { ts, tz, meta, msg } = match.groups;

      const reqIdMatch = meta.match(REQUEST_ID_PATTERN);
      const reqId = reqIdMatch ? reqIdMatch[1] : '';

      const metadata: Record<string, string> = {};
      const metaRegex = new RegExp(META_PATTERN.source, META_PATTERN.flags);
      let metaMatch;
      while ((metaMatch = metaRegex.exec(meta)) !== null) {
        const key = metaMatch[1].trim();
        const val = metaMatch[2].trim();
        if (key !== 'RequestId') metadata[key] = val;
      }

      let lvl = 'INF';
      const lvlMatch = meta.match(LEVEL_PATTERN) || meta.match(LEVEL_ALT_PATTERN);
      if (lvlMatch) {
        const rawLvl = lvlMatch[1].toUpperCase();
        lvl = LEVEL_MAP[rawLvl] || LONG_LEVEL_MAP[rawLvl] || rawLvl.substring(0, 3);
      }

      state.currentLog = {
        lineNumber: state.lineIdx,
        timestamp: ts,
        timezone: tz,
        requestId: reqId,
        level: lvl,
        message: msg.trim(),
        source: sourceName,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    } else if (state.currentLog) {
      // Multi-line log continuation
      state.currentLog.message += '\n' + line;
    }

    start = end + 1;
    state.lineIdx++;
  }

  // Update byte offset for processed content
  state.byteOffset += getByteLength(content);
  state.pendingLine = '';

  // If last chunk, yield any pending log
  if (isLastChunk && state.currentLog) {
    const byteLength = state.byteOffset - state.pendingLogStart;
    yield createIndexEntry(processLog(state.currentLog), state.pendingLogStart, byteLength);
    state.currentLog = null;
  }
}

/**
 * Stream parse a file using OPFS file handle
 * Processes file in configurable chunks to minimize memory usage
 * Ideal for files > 50MB
 */
export async function* streamParseFileHandle(
  fileHandle: FileSystemFileHandle,
  sourceName: string,
  chunkSize: number = 1024 * 1024 // 1MB default chunks
): AsyncGenerator<LogEntryIndex, ParsedFileIndex, unknown> {
  const file = await fileHandle.getFile();
  const totalBytes = file.size;

  // Create index metadata
  const index = createEmptyFileIndex('', sourceName);
  index.totalBytes = totalBytes;

  const uniqueRequestIds = new Set<string>();
  const uniqueCorrelationIds = new Set<string>();
  const sourceStats: Record<string, number> = {};

  const state = createStreamingParseState();
  let offset = 0;
  let firstTs = '';
  let lastTs = '';

  while (offset < totalBytes) {
    const end = Math.min(offset + chunkSize, totalBytes);
    const blob = file.slice(offset, end);
    const chunk = await blob.text();
    const isLastChunk = end >= totalBytes;

    for (const entry of processTextLogChunk(chunk, state, sourceName, isLastChunk)) {
      // Collect stats
      index.stats.total++;
      if (!firstTs) firstTs = entry.timestamp;
      lastTs = entry.timestamp;

      const source = entry.source || 'Unknown';
      sourceStats[source] = (sourceStats[source] || 0) + 1;

      const lvl = (entry.level || '').toUpperCase();
      if (entry.hasError || lvl === 'ERR' || lvl === 'ERROR' || lvl === 'FTL' || lvl === 'FATAL') {
        index.stats.errors++;
      } else if (lvl === 'WRN' || lvl === 'WARN' || lvl === 'WARNING') {
        index.stats.warnings++;
      } else {
        index.stats.infos++;
      }

      if (entry.requestId) uniqueRequestIds.add(entry.requestId);
      if (entry.correlationId) uniqueCorrelationIds.add(entry.correlationId);

      // Yield entry for caller to handle (e.g., add to index.entries or process)
      yield entry;
    }

    offset = end;
  }

  // Finalize index metadata
  index.totalLogs = index.stats.total;
  index.uniqueRequestIds = Array.from(uniqueRequestIds);
  index.uniqueCorrelationIds = Array.from(uniqueCorrelationIds);
  index.sourceStats = sourceStats;

  // Calculate duration
  let duration = '0ms';
  if (firstTs && lastTs) {
    const startMs = parseTimestampToMs(firstTs);
    const endMs = parseTimestampToMs(lastTs);
    const diff = endMs - startMs;
    if (diff < 1000) duration = `${diff}ms`;
    else if (diff < 60000) duration = `${(diff / 1000).toFixed(1)}s`;
    else if (diff < 3600000) duration = `${(diff / 60000).toFixed(1)}m`;
    else duration = `${(diff / 3600000).toFixed(1)}h`;
  }

  index.timeStats = { first: firstTs, last: lastTs, duration };

  return index;
}

/**
 * Stream parse with progress reporting
 * Uses ReadableStream for maximum efficiency
 */
export async function streamParseWithProgress(
  file: File,
  sourceName: string,
  onProgress: (bytesProcessed: number, entriesFound: number) => void,
  onEntry: (entry: LogEntryIndex) => void
): Promise<ParsedFileIndex> {
  const totalBytes = file.size;
  const reader = file.stream().getReader();

  const index = createEmptyFileIndex('', sourceName);
  index.totalBytes = totalBytes;

  const uniqueRequestIds = new Set<string>();
  const uniqueCorrelationIds = new Set<string>();
  const sourceStats: Record<string, number> = {};

  const state = createStreamingParseState();
  let bytesProcessed = 0;
  let firstTs = '';
  let lastTs = '';
  let lastProgressTime = performance.now();
  const PROGRESS_INTERVAL_MS = 250;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = DECODER.decode(value, { stream: true });
    bytesProcessed += value.byteLength;

    for (const entry of processTextLogChunk(chunk, state, sourceName, false)) {
      index.stats.total++;
      if (!firstTs) firstTs = entry.timestamp;
      lastTs = entry.timestamp;

      const source = entry.source || 'Unknown';
      sourceStats[source] = (sourceStats[source] || 0) + 1;

      const lvl = (entry.level || '').toUpperCase();
      if (entry.hasError || lvl === 'ERR' || lvl === 'ERROR' || lvl === 'FTL' || lvl === 'FATAL') {
        index.stats.errors++;
      } else if (lvl === 'WRN' || lvl === 'WARN' || lvl === 'WARNING') {
        index.stats.warnings++;
      } else {
        index.stats.infos++;
      }

      if (entry.requestId) uniqueRequestIds.add(entry.requestId);
      if (entry.correlationId) uniqueCorrelationIds.add(entry.correlationId);

      onEntry(entry);
    }

    // Throttled progress reporting
    const now = performance.now();
    if (now - lastProgressTime >= PROGRESS_INTERVAL_MS) {
      onProgress(bytesProcessed, index.stats.total);
      lastProgressTime = now;
    }
  }

  // Process any remaining content
  for (const entry of processTextLogChunk('', state, sourceName, true)) {
    index.stats.total++;
    if (!firstTs) firstTs = entry.timestamp;
    lastTs = entry.timestamp;

    const source = entry.source || 'Unknown';
    sourceStats[source] = (sourceStats[source] || 0) + 1;

    const lvl = (entry.level || '').toUpperCase();
    if (entry.hasError || lvl === 'ERR' || lvl === 'ERROR' || lvl === 'FTL' || lvl === 'FATAL') {
      index.stats.errors++;
    } else if (lvl === 'WRN' || lvl === 'WARN' || lvl === 'WARNING') {
      index.stats.warnings++;
    } else {
      index.stats.infos++;
    }

    if (entry.requestId) uniqueRequestIds.add(entry.requestId);
    if (entry.correlationId) uniqueCorrelationIds.add(entry.correlationId);

    onEntry(entry);
  }

  // Final progress
  onProgress(bytesProcessed, index.stats.total);

  // Finalize index
  index.totalLogs = index.stats.total;
  index.uniqueRequestIds = Array.from(uniqueRequestIds);
  index.uniqueCorrelationIds = Array.from(uniqueCorrelationIds);
  index.sourceStats = sourceStats;

  let duration = '0ms';
  if (firstTs && lastTs) {
    const startMs = parseTimestampToMs(firstTs);
    const endMs = parseTimestampToMs(lastTs);
    const diff = endMs - startMs;
    if (diff < 1000) duration = `${diff}ms`;
    else if (diff < 60000) duration = `${(diff / 1000).toFixed(1)}s`;
    else if (diff < 3600000) duration = `${(diff / 60000).toFixed(1)}m`;
    else duration = `${(diff / 3600000).toFixed(1)}h`;
  }

  index.timeStats = { first: firstTs, last: lastTs, duration };

  return index;
}
