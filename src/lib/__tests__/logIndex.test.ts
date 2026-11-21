import { describe, it, expect } from 'vitest';
import {
  sliceUtf8Bytes,
  matchesIdQuery,
  compareLogOrder,
} from '../parser/logIndex';
import {
  parseContentToIndex,
  parseLogs,
  parseTimestampToMs,
  createStreamingParseState,
  processTextLogChunk,
} from '../parser/logParser';

describe('large-log byte slicing & continuation accuracy', () => {
  it('slices exact UTF-8 byte ranges even after multi-byte characters (BOM, emoji, quotes)', () => {
    const raw = [
      '\uFEFF2024-03-28 10:00:01.000 +00:00 [INF] [RequestId:REQ-1] Booting 🚀 — “ready”',
      '2024-03-28 10:00:01.050 +00:00 [ERR] [RequestId:REQ-1] Stack trace line 1',
      '   at OrderService.Process() in OrderService.cs:line 42',
      '2024-03-28 10:00:01.100 +00:00 [INF] [RequestId:REQ-2] Next request',
    ].join('\n');

    const index = parseContentToIndex(raw, 'api.log', 'api.log');
    expect(index.entries).toHaveLength(3);

    // Expanding entry #2 (multi-line error after multi-byte emoji/BOM) must recover the complete stack trace
    const second = index.entries[1];
    const sliced = sliceUtf8Bytes(raw, second.byteOffset, second.byteLength);
    const parsed = parseLogs(sliced);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].requestId).toBe('REQ-1');
    expect(parsed[0].message).toContain('Stack trace line 1');
    expect(parsed[0].message).toContain('OrderService.cs:line 42');
  });

  it('preserves multi-line log continuations across streaming chunk boundaries', () => {
    const raw = [
      '2024-03-28 10:00:01.000 +00:00 [ERR] [RequestId:REQ-9] Unhandled exception',
      'System.TimeoutException: Redis timed out',
      '   at CacheClient.GetAsync() line 88',
      '2024-03-28 10:00:02.000 +00:00 [INF] [RequestId:REQ-9] Retry succeeded',
    ].join('\n');

    // Split right in the middle of the stack trace
    const splitPoint = raw.indexOf('TimeoutException') + 5;
    const chunk1 = raw.slice(0, splitPoint);
    const chunk2 = raw.slice(splitPoint);

    const state = createStreamingParseState();
    const entries = [
      ...processTextLogChunk(chunk1, state, 'stream.log', false),
      ...processTextLogChunk(chunk2, state, 'stream.log', true),
    ];

    expect(entries).toHaveLength(2);
    const expandedFirst = sliceUtf8Bytes(raw, entries[0].byteOffset, entries[0].byteLength);
    const parsed = parseLogs(expandedFirst);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].message).toContain('System.TimeoutException: Redis timed out');
    expect(parsed[0].message).toContain('CacheClient.GetAsync() line 88');
  });
});

describe('large-log search & timeline ordering', () => {
  it('matches trimmed queries against both requestId and correlationId', () => {
    const entry = { requestId: 'REQ-42', correlationId: 'CORR-999-ABC' };

    expect(matchesIdQuery(entry, '  req-42  ')).toBe(true);
    expect(matchesIdQuery(entry, '  corr-999 ')).toBe(true);
    expect(matchesIdQuery(entry, 'nonexistent')).toBe(false);
    expect(matchesIdQuery(entry, '   ')).toBe(true);
  });

  it('breaks identical-millisecond timestamp ties by original lineNumber', () => {
    const entries = [
      { timestamp: '2024-03-28 10:00:01.000', lineNumber: 12 },
      { timestamp: '2024-03-28 10:00:01.000', lineNumber: 5 },
      { timestamp: '2024-03-28 10:00:01.000', lineNumber: 8 },
    ];

    const sorted = [...entries].sort((a, b) => compareLogOrder(a, b, parseTimestampToMs));
    expect(sorted.map((e) => e.lineNumber)).toEqual([5, 8, 12]);
  });
});
