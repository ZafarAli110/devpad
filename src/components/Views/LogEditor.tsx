import { useLoaderData, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { LogNote, db } from '../../lib/storage/db';
import { saveToOPFS } from '../../lib/storage/opfs';
import { useAppContext } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import { LogsView } from './LogsView';
import { ConfirmationModal } from '../Layout/ConfirmationModal';
import { StructuredLog } from '../../lib/parser/logParser';

const SIZE_THRESHOLD = 50 * 1024 * 1024; // 50MB
const AUTO_SAVE_DELAY = 1500; // 1.5 seconds

export function LogEditor() {
  const log = useLoaderData() as LogNote;
  const navigate = useNavigate();
  const { addTab, logTabs, closeTab, theme } = useAppContext();
  const { error, success } = useToast();

  const [content, setContent] = useState(log.content);
  const [title, setTitle] = useState(log.title);
  const [showLogViewer, setShowLogViewer] = useState(true);
  const [language] = useState(log.language || 'plaintext');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef(log.content);
  const lastSavedTitleRef = useRef(log.title);
  const lastSavedLanguageRef = useRef(log.language || 'plaintext');

  // Add tab on mount
  useEffect(() => {
    addTab({ id: log.id, title: log.title, type: 'log' });
  }, [log.id, log.title, addTab]);

  const [logs, setLogs] = useState<StructuredLog[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [uniqueIds, setUniqueIds] = useState<{ requestIds: string[]; correlationIds: string[] }>({ requestIds: [], correlationIds: [] });
  const workerRef = useRef<Worker | null>(null);

  // Initialize and manage worker
  useEffect(() => {
    const worker = new Worker(new URL('../../lib/parser/log.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const { type, payload, uniqueIds } = e.data;
      if (type === 'result') {
        setLogs(payload);
        if (uniqueIds) setUniqueIds(uniqueIds);
        setIsParsing(false);
      } else if (type === 'progress') {
        // We could show progress count if needed
      }
    };

    return () => {
      worker.terminate();
    };
  }, []);

  // Parse logs when content changes
  useEffect(() => {
    if (!workerRef.current || !content) {
      if (!content) {
        setLogs([]);
      }
      return;
    }
    
    setIsParsing(true);
    workerRef.current.postMessage({ type: 'parse', payload: { content } });
  }, [content]);


  // Sync tab title
  useEffect(() => {
    if (title !== log.title) {
      addTab({ id: log.id, title: title, type: 'log' });
    }
  }, [log.id, title, addTab, log.title]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (content === lastSavedContentRef.current && 
        title === lastSavedTitleRef.current && 
        language === lastSavedLanguageRef.current) {
      return;
    }

    try {
      const size = new Blob([content]).size;
      const updateData: Partial<LogNote> = { updatedAt: Date.now(), title, language };

      if (size > SIZE_THRESHOLD) {
        const opfsPath = `log_${log.id}.txt`;
        await saveToOPFS(opfsPath, content);
        updateData.opfsPath = opfsPath;
        updateData.content = '';
      } else {
        updateData.content = content;
        updateData.opfsPath = undefined;
      }
      
      await db.logs.update(log.id, updateData);
      lastSavedContentRef.current = content;
      lastSavedTitleRef.current = title;
      lastSavedLanguageRef.current = language;
    } catch (err) {
      console.error('Failed to save log', err);
    }
  }, [content, title, language, log.id]);

  // Auto-save
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (content !== lastSavedContentRef.current || title !== lastSavedTitleRef.current || language !== lastSavedLanguageRef.current) {
      autoSaveTimerRef.current = setTimeout(handleSave, AUTO_SAVE_DELAY);
    }
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [content, title, language, handleSave]);

  // Delete handler
  const handleDelete = useCallback(() => setShowDeleteConfirm(true), []);
  const handleConfirmDelete = useCallback(async () => {
    await db.logs.delete(log.id);
    closeTab(log.id, 'log');
    const remaining = logTabs.filter((t) => t.id !== log.id);
    navigate(remaining.length > 0 ? `/logs/${remaining[0].id}` : '/logs');
  }, [log.id, logTabs, closeTab, navigate]);

  // Download handler
  const handleDownload = useCallback(async () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const fileName = title || 'log.txt';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [content, title]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleSelectTab = (tab: { id: string; type: 'note' | 'log' | 'diagram' }) => {
    handleSave();
    if (tab.type === 'note') navigate(`/notes/${tab.id}`);
    else if (tab.type === 'log') navigate(`/logs/${tab.id}`);
    else navigate(`/diagrams/${tab.id}`);
  };

  const handleCloseTab = (e: React.MouseEvent | null, tabId: string) => {
    e?.stopPropagation();
    if (tabId === log.id) handleSave();
    closeTab(tabId, 'log');
    if (tabId === log.id) {
      const remaining = logTabs.filter((t) => t.id !== tabId);
      navigate(remaining.length > 0 ? `/logs/${remaining[0].id}` : '/logs');
    }
  };

  const handleParseLogs = useCallback(() => {
    if (logs.length === 0) error('No structured logs detected.');
    else success(`Processed ${logs.length} log events.`);
  }, [logs, error, success]);

  const handleOpenRequestAsNote = async (requestId: string) => {
    const requestLogs = logs.filter((l) => l.requestId === requestId);
    if (requestLogs.length === 0) return;
    const noteContent = requestLogs.map(l => `${l.timestamp} [${l.level}] ${l.message}`).join('\n');
    const id = crypto.randomUUID();
    await db.notes.add({ 
      id, 
      title: `Request ${requestId}`, 
      content: noteContent, 
      tags: [], 
      createdAt: Date.now(), 
      updatedAt: Date.now(),
      isHidden: false
    });
    navigate(`/notes/${id}`);
  };

  return (
    <>
      <LogsView
        tabs={logTabs}
        activeTabId={log.id}
        content={content}
        language={language}
        theme={theme}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onChange={(v) => setContent(v || '')}
        activeTitle={title}
        onTitleChange={setTitle}
        onSave={handleSave}
        onDelete={handleDelete}
        onDownload={handleDownload}
        logs={logs}
        onParse={handleParseLogs}
        onOpenRequest={handleOpenRequestAsNote}
        showLogViewer={showLogViewer}
        onToggleLogViewer={() => setShowLogViewer(!showLogViewer)}
        isParsing={isParsing}
        externalUniqueIds={uniqueIds}
      />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Log"
        message="Are you sure you want to delete this log? This action cannot be undone."
        confirmLabel="Delete Log"
        isDestructive={true}
      />
    </>
  );
}
