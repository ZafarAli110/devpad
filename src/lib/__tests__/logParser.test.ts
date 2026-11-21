import { describe, it, expect } from 'vitest';
import {
  parseLogs,
  isAnalysisExport,
  parseTimestampToMs,
  getByteLength,
  ANALYSIS_EXPORT_SIGNATURE,
} from '../parser/logParser';

describe('logParser', () => {
  it('parses Serilog text logs with timestamps, levels, RequestId, and metadata', () => {
    const raw = [
      '2024-03-28 10:00:01.123 +00:00 [INF] [RequestId:REQ-001] [TenantId:42] Request starting HTTP/1.1 GET /api/orders',
      '2024-03-28 10:00:01.500 +00:00 [WRN] [RequestId:REQ-001] Slow query detected in 450ms',
      '2024-03-28 10:00:02.000 +00:00 [ERR] [RequestId:REQ-002] Failed to connect to Redis cache',
    ].join('\n');

    const logs = parseLogs(raw, 'api.log');

    expect(logs).toHaveLength(3);
    expect(logs[0]).toMatchObject({
      level: 'INF',
      requestId: 'REQ-001',
      httpMethod: 'GET',
      source: 'api.log',
    });
    expect(logs[0].metadata?.TenantId).toBe('42');
    expect(logs[1].level).toBe('WRN');
    expect(logs[2].level).toBe('ERR');
    expect(logs[2].requestId).toBe('REQ-002');
  });

  it('parses JSON array logs and normalizes long level names', () => {
    const raw = JSON.stringify([
      {
        Timestamp: '2024-03-28T10:00:03.123Z',
        Level: 'Error',
        MessageTemplate: 'Database query failed: {ErrorMsg}',
        Properties: { ErrorMsg: 'Connection reset', RequestId: 'REQ-003' },
      },
      {
        Timestamp: '2024-03-28T10:00:03.500Z',
        Level: 'Information',
        MessageTemplate: 'Backup service heartbeat',
        Properties: { Service: 'S3-Backup' },
      },
    ]);

    const logs = parseLogs(raw);

    expect(logs).toHaveLength(2);
    expect(logs[0].level).toBe('ERR');
    expect(logs[0].requestId).toBe('REQ-003');
    expect(logs[1].level).toBe('INF');
  });

  it('detects DevPad analysis export files and refuses to double-parse them', () => {
    const exportPayload = JSON.stringify({
      __type: ANALYSIS_EXPORT_SIGNATURE,
      title: 'Sample Export',
      files: [],
    });

    expect(isAnalysisExport(exportPayload)).toBe(true);
    expect(isAnalysisExport('plain text log line')).toBe(false);
    expect(parseLogs(exportPayload)).toEqual([]);
  });

  it('handles empty and whitespace-only inputs cleanly', () => {
    expect(parseLogs('')).toEqual([]);
    expect(parseLogs('   \n\t  ')).toEqual([]);
  });

  it('parses timestamps to epoch milliseconds accurately', () => {
    const ms = parseTimestampToMs('2024-03-28 10:00:00.000');
    expect(ms).toBeGreaterThan(0);
    expect(Number.isNaN(ms)).toBe(false);
  });

  it('computes accurate byte lengths for ASCII and multi-byte UTF-8 text', () => {
    expect(getByteLength('hello world')).toBe(11);
    expect(getByteLength('café')).toBe(new TextEncoder().encode('café').length);
    expect(getByteLength('🚀🔒')).toBe(new TextEncoder().encode('🚀🔒').length);
  });
});
