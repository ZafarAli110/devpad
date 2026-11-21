import type { Note } from '../storage/db';

type PrivacyNote = Pick<Note, 'title' | 'content' | 'isHidden' | 'isProtected'>;

/**
 * Returns a screen-share-safe card preview for a note.
 * Hidden and password-protected notes never leak their body text on overview cards.
 */
export function getNotePreview(note: PrivacyNote, maxLength = 100): string {
  if (note.isProtected) {
    return 'Locked note — unlock to view';
  }
  if (note.isHidden) {
    return 'Hidden note — open to reveal';
  }
  const content = note.content?.trim();
  if (!content) {
    return 'Empty note';
  }
  return content.slice(0, maxLength);
}

/**
 * Matches a note against a search query without leaking hidden or protected body text.
 */
export function matchesNoteSearch(note: PrivacyNote, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const titleMatch = (note.title || '').toLowerCase().includes(normalized);
  if (titleMatch) return true;

  if (note.isHidden || note.isProtected) {
    return false;
  }

  return (note.content || '').toLowerCase().includes(normalized);
}

/**
 * Returns whether a note is safe to export directly in plaintext from the list view.
 */
export function canExportPlaintext(note: PrivacyNote): boolean {
  return !note.isProtected && !note.isHidden;
}
