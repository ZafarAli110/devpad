import { describe, it, expect } from 'vitest';
import { getNotePreview, matchesNoteSearch, canExportPlaintext } from '../utils/notePrivacy';
import { SAMPLE_ANALYSIS_JSON } from '../storage/seed';

describe('notePrivacy (screen-share & lock protection)', () => {
  const normalNote = {
    title: 'API Notes',
    content: 'Use pagination cursor for /v1/orders',
    isHidden: false,
    isProtected: false,
  };

  const hiddenNote = {
    title: 'Incident Credentials',
    content: 'super-secret-token-12345',
    isHidden: true,
    isProtected: false,
  };

  const protectedNote = {
    title: 'Prod Keys',
    content: 'encrypted-or-sensitive-payload',
    isHidden: false,
    isProtected: true,
  };

  it('masks preview text for hidden and protected notes on cards', () => {
    expect(getNotePreview(normalNote)).toBe('Use pagination cursor for /v1/orders');
    expect(getNotePreview(hiddenNote)).toBe('Hidden note — open to reveal');
    expect(getNotePreview(hiddenNote)).not.toContain('super-secret-token');
    expect(getNotePreview(protectedNote)).toBe('Locked note — unlock to view');
    expect(getNotePreview(protectedNote)).not.toContain('sensitive-payload');
  });

  it('returns fallback text for empty normal notes', () => {
    expect(getNotePreview({ title: 'Blank', content: '   ', isHidden: false, isProtected: false })).toBe('Empty note');
  });

  it('prevents search from matching hidden or protected note bodies while still matching titles', () => {
    expect(matchesNoteSearch(normalNote, 'pagination')).toBe(true);

    // Title search still works
    expect(matchesNoteSearch(hiddenNote, 'incident')).toBe(true);
    expect(matchesNoteSearch(protectedNote, 'prod')).toBe(true);

    // Body content must NOT leak via search
    expect(matchesNoteSearch(hiddenNote, 'super-secret-token')).toBe(false);
    expect(matchesNoteSearch(protectedNote, 'sensitive-payload')).toBe(false);
  });

  it('blocks direct plaintext export of hidden and protected notes', () => {
    expect(canExportPlaintext(normalNote)).toBe(true);
    expect(canExportPlaintext(hiddenNote)).toBe(false);
    expect(canExportPlaintext(protectedNote)).toBe(false);
  });
});

describe('seed data hygiene (no real domains or embedded JWTs)', () => {
  it('contains only synthetic example hosts and zero embedded JWT tokens', () => {
    const serialized = JSON.stringify(SAMPLE_ANALYSIS_JSON);

    expect(serialized).not.toMatch(/Bearer\s+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    expect(serialized).not.toMatch(/\.auth0\.com/i);
    expect(serialized).toContain('[REDACTED_TOKEN]');
    expect(serialized).toContain('api.example.com');
  });
});
