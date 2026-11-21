/**
 * Log Index Schema
 * Lightweight metadata stored for each log entry, allowing on-demand content loading
 */

/**
 * Index entry for a single log line
 * Contains just enough info for filtering/grouping without storing message content
 */
export interface LogEntryIndex {
  lineNumber: number;
  byteOffset: number; // Where this log starts in the OPFS file
  byteLength: number; // Length of this log entry in bytes
  timestamp: string;
  timestampMs: number; // Pre-computed timestamp for fast sorting/grouping
  level: string;
  requestId: string;
  correlationId?: string;
  httpMethod?: string;
  hasError: boolean;
  hasSql: boolean;
  isSlowSql: boolean;
  source?: string;
}

/**
 * Summary of a log group (lightweight for main thread)
 */
export interface IndexGroupSummary {
  id: string;
  count: number;
  hasError: boolean;
  firstTimestamp: string;
  duration: string | null;
}

/**
 * Complete index for a parsed file
 * Stored in OPFS separately from the raw log content
 */
export interface ParsedFileIndex {
  version: 1; // For future format changes
  opfsPath: string;
  fileName: string;
  totalLogs: number;
  totalBytes: number;
  stats: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  sourceStats?: Record<string, number>;
  timeStats?: { first: string; last: string; duration: string };
  entries: LogEntryIndex[];
  uniqueRequestIds: string[];
  uniqueCorrelationIds: string[];
  createdAt: number;
}

/**
 * Metadata for a parsed file (excludes entries for lighter memory usage)
 */
export type ParsedFileMetadata = Omit<ParsedFileIndex, 'entries'>;

/**
 * Create an empty file index
 */
export function createEmptyFileIndex(opfsPath: string, fileName: string): ParsedFileIndex {
  return {
    version: 1,
    opfsPath,
    fileName,
    totalLogs: 0,
    totalBytes: 0,
    stats: { total: 0, errors: 0, warnings: 0, infos: 0 },
    sourceStats: {},
    timeStats: { first: '', last: '', duration: '0ms' },
    entries: [],
    uniqueRequestIds: [],
    uniqueCorrelationIds: [],
    createdAt: Date.now(),
  };
}

/**
 * Calculate combined stats from multiple file indices
 */
/**
 * Calculate combined stats from multiple file indices/metadata
 */
export function combineIndexStats(indices: ParsedFileMetadata[]): {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
} {
  return indices.reduce(
    (acc, idx) => ({
      total: acc.total + idx.stats.total,
      errors: acc.errors + idx.stats.errors,
      warnings: acc.warnings + idx.stats.warnings,
      infos: acc.infos + idx.stats.infos,
    }),
    { total: 0, errors: 0, warnings: 0, infos: 0 }
  );
}

/**
 * Get unique IDs across multiple file indices
 */
/**
 * Get unique IDs across multiple file indices/metadata
 */
export function combineUniqueIds(indices: ParsedFileMetadata[]): {
  requestIds: string[];
  correlationIds: string[];
} {
  const requestIds = new Set<string>();
  const correlationIds = new Set<string>();

  for (const idx of indices) {
    idx.uniqueRequestIds.forEach((id) => requestIds.add(id));
    idx.uniqueCorrelationIds.forEach((id) => correlationIds.add(id));
  }

  return {
    requestIds: Array.from(requestIds).sort(),
    correlationIds: Array.from(correlationIds).sort(),
  };
}

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

/**
 * Slices a UTF-8 string using exact byte offset and byte length.
 * Prevents character-offset drift when files contain multi-byte UTF-8 characters (BOM, emoji, quotes).
 */
export function sliceUtf8Bytes(content: string, byteOffset: number, byteLength: number): string {
  const bytes = UTF8_ENCODER.encode(content);
  const start = Math.max(0, byteOffset);
  const end = Math.min(bytes.byteLength, start + Math.max(0, byteLength));
  return UTF8_DECODER.decode(bytes.subarray(start, end));
}

/**
 * Matches a trimmed search query against both requestId and correlationId
 * so pasting either ID works regardless of the active grouping mode.
 */
export function matchesIdQuery(
  entry: Pick<LogEntryIndex, 'requestId' | 'correlationId'>,
  query: string
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const reqId = (entry.requestId || '').toLowerCase();
  const corrId = (entry.correlationId || '').toLowerCase();
  return reqId.includes(normalized) || corrId.includes(normalized);
}

/**
 * Sorts log entries chronologically, breaking identical-millisecond ties by original lineNumber.
 */
export function compareLogOrder(
  a: { timestampMs?: number; timestamp: string; lineNumber: number },
  b: { timestampMs?: number; timestamp: string; lineNumber: number },
  parseTs: (ts: string) => number
): number {
  const aMs = a.timestampMs || parseTs(a.timestamp);
  const bMs = b.timestampMs || parseTs(b.timestamp);
  if (aMs !== bMs) return aMs - bMs;
  return a.lineNumber - b.lineNumber;
}

/**
 * Group index entries by request ID or correlation ID
 * Returns groups with their byte ranges for batch fetching
 */
export function groupIndexEntries(
  entries: LogEntryIndex[],
  mode: 'requestId' | 'correlationId'
): Map<string, LogEntryIndex[]> {
  const groups = new Map<string, LogEntryIndex[]>();

  for (const entry of entries) {
    const key =
      mode === 'requestId'
        ? entry.requestId || 'Global / Startup'
        : entry.correlationId || 'Global / Startup';

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(entry);
  }

  return groups;
}
