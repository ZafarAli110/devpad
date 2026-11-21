import { LoaderFunctionArgs } from 'react-router-dom';
import { db, Note, LogNote } from '../lib/storage/db.ts';
import { readFromOPFS } from '../lib/storage/opfs.ts';
export async function allNotesLoader({ request }: LoaderFunctionArgs): Promise<Note[]> {
  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.toLowerCase() || '';

  let notes = await db.notes.toArray();

  if (search) {
    notes = notes.filter(
      (n) =>
        n.title.toLowerCase().includes(search) ||
        n.content.toLowerCase().includes(search)
    );
  }

  return notes.sort((a, b) => b.updatedAt - a.updatedAt);
}

// Loader for /notes/:id - single note
export async function noteLoader({ params }: LoaderFunctionArgs): Promise<Note> {
  const { id } = params;
  if (!id) throw new Response('Note ID required', { status: 400 });

  const note = await db.notes.get(id);
  if (!note) throw new Response('Note not found', { status: 404 });

  // Load content from OPFS if stored there
  if (note.opfsPath) {
    try {
      note.content = await readFromOPFS(note.opfsPath);
    } catch (e) {
      console.error('Failed to load from OPFS:', e);
    }
  }

  return note;
}

// Loader for /logs - all logs with optional search
export async function allLogsLoader({ request }: LoaderFunctionArgs): Promise<LogNote[]> {
  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.toLowerCase() || '';

  let logs = await db.logs.toArray();

  if (search) {
    logs = logs.filter(
      (l) =>
        l.title.toLowerCase().includes(search) ||
        l.content.toLowerCase().includes(search)
    );
  }

  return logs.sort((a, b) => b.updatedAt - a.updatedAt);
}

// Loader for /logs/:id - single log
export async function logLoader({ params }: LoaderFunctionArgs): Promise<LogNote> {
  const { id } = params;
  if (!id) throw new Response('Log ID required', { status: 400 });

  const log = await db.logs.get(id);
  if (!log) throw new Response('Log not found', { status: 404 });

  if (log.opfsPath) {
    try {
      log.content = await readFromOPFS(log.opfsPath);
    } catch (e) {
      console.error('Failed to load from OPFS:', e);
    }
  }

  return log;
}
