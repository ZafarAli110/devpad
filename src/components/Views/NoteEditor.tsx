import { useLoaderData, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Note, db } from '../../lib/storage/db';
import { saveToOPFS } from '../../lib/storage/opfs';
import { useAppContext } from '../../contexts/AppContext';
import { MonacoWrapper } from '../Editor/MonacoWrapper';
import { TabBar } from './TabBar';
import { EditorToolbar } from './EditorToolbar';
import { ConfirmationModal } from '../Layout/ConfirmationModal';
import { MarkdownPreview } from '../Editor/MarkdownPreview';
import { useSecurity } from '../../contexts/SecurityContext';
import { encryptText, decryptText } from '../../lib/utils/crypto';
import { useToast } from '../../contexts/ToastContext';
import { Eye, EyeOff, Lock, ShieldOff, Loader2, Info } from 'lucide-react';

const SIZE_THRESHOLD = 50 * 1024 * 1024; // 50MB
const AUTO_SAVE_DELAY = 1500; // 1.5 seconds

export function NoteEditor() {
  const note = useLoaderData() as Note;
  const navigate = useNavigate();
  const { addTab, noteTabs, closeTab, theme, fontSize, setFontSize } = useAppContext();
  const { success, error: toastError } = useToast();

  const [content, setContent] = useState(note.content);
  const [title, setTitle] = useState(note.title);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isPreview, setIsPreview] = useState(true);
  const [previewWidth, setPreviewWidth] = useState(450); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);
  const { sessionKey, isSetup, setModalOpen, openModalForProtection } = useSecurity();
  const [isProtected, setIsProtected] = useState(!!note.isProtected);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState(false);
  const [isHidden, setIsHidden] = useState(!!note.isHidden);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Detect language from title
  const detectLanguageFromTitle = (title: string) => {
    if (title.endsWith('.js')) return 'javascript';
    if (title.endsWith('.ts')) return 'typescript';
    if (title.endsWith('.tsx')) return 'typescript';
    if (title.endsWith('.jsx')) return 'javascript';
    if (title.endsWith('.json')) return 'json';
    if (title.endsWith('.sql')) return 'sql';
    if (title.endsWith('.css')) return 'css';
    if (title.endsWith('.html')) return 'html';
    if (title.endsWith('.md')) return 'markdown';
    return 'plaintext';
  };
  
  const [language, setLanguage] = useState(note.language || detectLanguageFromTitle(note.title));
  
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef(note.content);
  const lastSavedTitleRef = useRef(note.title);
  const lastSavedLanguageRef = useRef(note.language || detectLanguageFromTitle(note.title));
  const lastSavedHiddenRef = useRef(!!note.isHidden);
  const lastSavedProtectedRef = useRef(!!note.isProtected);

  // Add tab on mount
  useEffect(() => {
    addTab({ id: note.id, title: note.title, type: 'note', isProtected, isHidden });
  }, [note.id, note.title, addTab, isProtected, isHidden]);

  // Handle Decryption if protected
  useEffect(() => {
    async function performDecryption() {
      if (note.isProtected && note.content && sessionKey) {
        setIsDecrypting(true);
        setDecryptError(false);
        try {
          const iv = new Uint8Array(
            note.encryptionMetadata!.iv.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
          );
          const ciphertext = new Uint8Array(
            note.content.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
          ).buffer;

          const plain = await decryptText(ciphertext, sessionKey, iv);
          setContent(plain);
          lastSavedContentRef.current = plain;
        } catch (err) {
          console.error('Decryption failed', err);
          setDecryptError(true);
        } finally {
          setIsDecrypting(false);
        }
      }
    }
    performDecryption();
  }, [note.id, note.isProtected, sessionKey]);

  // Sync tab title and status
  useEffect(() => {
    addTab({ id: note.id, title: title, type: 'note', isProtected, isHidden });
  }, [note.id, title, addTab, isProtected, isHidden]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (content === lastSavedContentRef.current && 
        title === lastSavedTitleRef.current && 
        language === lastSavedLanguageRef.current &&
        isHidden === lastSavedHiddenRef.current &&
        isProtected === lastSavedProtectedRef.current) {
      return;
    }

    setIsSaving(true);
    try {
      const size = new Blob([content]).size;
      const updateData: Partial<Note> = { 
        updatedAt: Date.now(), 
        title, 
        language,
        isHidden 
      };

      if (size > SIZE_THRESHOLD) {
        const opfsPath = `note_${note.id}.txt`;
        await saveToOPFS(opfsPath, content);
        updateData.opfsPath = opfsPath;
        updateData.content = '';
      } else {
        if (isProtected && sessionKey) {
            const { ciphertext, iv } = await encryptText(content, sessionKey);
            const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
            const cipherHex = Array.from(new Uint8Array(ciphertext)).map(b => b.toString(16).padStart(2, '0')).join('');
            
            updateData.content = cipherHex;
            updateData.encryptionMetadata = { iv: ivHex, salt: '' }; 
            updateData.isProtected = true;
        } else {
            updateData.content = content;
            updateData.isProtected = false;
            updateData.encryptionMetadata = undefined;
        }
        updateData.opfsPath = undefined;
      }

      await db.notes.update(note.id, updateData);
      
      lastSavedContentRef.current = content;
      lastSavedTitleRef.current = title;
      lastSavedLanguageRef.current = language;
      lastSavedHiddenRef.current = isHidden;
      lastSavedProtectedRef.current = isProtected;
    } finally {
      setIsSaving(false);
    }
  }, [content, title, language, isHidden, note.id, isProtected, sessionKey]);

  // Auto-save with debounce
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    if (content !== lastSavedContentRef.current || 
        title !== lastSavedTitleRef.current || 
        language !== lastSavedLanguageRef.current ||
        isHidden !== lastSavedHiddenRef.current ||
        isProtected !== lastSavedProtectedRef.current) {
      autoSaveTimerRef.current = setTimeout(() => {
        handleSave();
      }, AUTO_SAVE_DELAY);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [content, title, language, isHidden, isProtected, handleSave]);

  // Save before navigating away
  useEffect(() => {
    return () => {
      if (content !== lastSavedContentRef.current || 
          title !== lastSavedTitleRef.current || 
          language !== lastSavedLanguageRef.current ||
          isHidden !== lastSavedHiddenRef.current ||
          isProtected !== lastSavedProtectedRef.current) {
        const size = new Blob([content]).size;
        const updateData: Partial<Note> = { 
          updatedAt: Date.now(), 
          title, 
          language,
          isHidden,
          isProtected 
        };
        if (size <= SIZE_THRESHOLD) {
          updateData.content = content;
        }
        db.notes.update(note.id, updateData);
      }
    };
  }, [content, title, language, isHidden, isProtected, note.id]);

  const handleDelete = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    await db.notes.delete(note.id);
    closeTab(note.id, 'note');

    const remaining = noteTabs.filter((t: any) => t.id !== note.id);
    if (remaining.length > 0) {
      navigate(`/notes/${remaining[0].id}`);
    } else {
      navigate('/notes');
    }
  }, [note.id, noteTabs, closeTab, navigate]);

  const handleDownload = useCallback(async () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const fileName = title || 'note.txt';
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [content, title]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleSelectTab = (tab: { id: string; type: 'note' | 'log' }) => {
    handleSave();
    if (tab.type === 'note') {
      navigate(`/notes/${tab.id}`);
    } else {
      navigate(`/logs/${tab.id}`);
    }
  };

  const handleCloseTab = (e: React.MouseEvent | null, tabId: string) => {
    e?.stopPropagation();
    if (tabId === note.id) {
      handleSave();
    }
    closeTab(tabId, 'note');
    if (tabId === note.id) {
      const remaining = noteTabs.filter((t: any) => t.id !== tabId);
      if (remaining.length > 0) {
        navigate(`/notes/${remaining[0].id}`);
      } else {
        navigate('/notes');
      }
    }
  };

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      if (newWidth > 200 && newWidth < containerRect.width - 200) {
        setPreviewWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TabBar
        tabs={noteTabs}
        activeTabId={note.id}
        onSelect={(tab) => handleSelectTab(tab as any)}
        onClose={handleCloseTab}
      />

      <EditorToolbar
        activeTitle={title}
        onTitleChange={setTitle}
        onSave={handleSave}
        onDelete={handleDelete}
        onDownload={handleDownload}
        fileSize={new Blob([content]).size}
        isLogView={false}
        isSaving={isSaving}
        language={language}
        onLanguageChange={setLanguage}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        isPreview={isPreview}
        onTogglePreview={() => setIsPreview(!isPreview)}
        isProtected={isProtected}
        onToggleProtection={() => {
            // Prevent disabling protection if already protected
            if (isProtected) {
                toastError('Protection cannot be disabled once enabled.');
                return;
            }

            // Define success callback
            const activateProtection = () => {
                setIsProtected(true);
                setIsHidden(true);
                success('Note encrypted and hidden');
            };

            // First-time setup: need to create a password
            if (!isSetup) {
                openModalForProtection(activateProtection);
                return;
            }
            
            // Password exists but session is locked: need to unlock first to get encryption key
            if (!sessionKey) {
                openModalForProtection(activateProtection);
                return;
            }

            // Session active: protect immediately without dialog
            setIsProtected(true);
            setIsHidden(true);
            success('Note encrypted and hidden');
        }}
        isHidden={isHidden}
        onToggleHide={() => setIsHidden(!isHidden)}
      />

      <div ref={containerRef} className="flex-1 relative min-w-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 relative">
          {/* Decryption Error State */}
          {decryptError ? (
              <div className="absolute inset-0 bg-bg-app flex flex-col items-center justify-center p-6 space-y-4">
                  <ShieldOff className="w-16 h-16 text-red-500" />
                  <h2 className="text-xl font-bold text-text-primary">Decryption Error</h2>
                  <p className="text-text-secondary text-center max-w-sm">
                      Failed to decrypt this note. The key might be invalid or the content is corrupted.
                  </p>
              </div>
          ) : isDecrypting ? (
              /* Decrypting State */
              <div className="absolute inset-0 bg-bg-app flex flex-col items-center justify-center p-6 space-y-4">
                  <Loader2 className="w-12 h-12 text-accent-primary animate-spin" />
                  <p className="text-text-secondary">Decrypting content...</p>
              </div>
          ) : isProtected && !sessionKey ? (
              /* Locked State (Security Priority) */
              <div className="absolute inset-0 bg-bg-app flex flex-col items-center justify-center p-6">
                  <div className="bg-amber-500/10 p-6 rounded-full mb-6">
                      <Lock className="w-12 h-12 text-amber-500" />
                  </div>
                  <h2 className="text-2xl font-black text-text-primary mb-2">Note Locked</h2>
                  <p className="text-text-secondary text-center max-w-sm mb-8">
                      This note is encrypted. Please unlock the note to view the content.
                  </p>

                  {/* Session Persistence Info - Now above the button */}
                  <div className="flex items-center gap-3 bg-bg-panel border border-border px-5 py-4 rounded-2xl mb-8 max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-500 shadow-sm">
                      <div className="bg-blue-500/10 p-2 rounded-lg shrink-0">
                        <Info className="w-5 h-5 text-blue-500" />
                      </div>
                      <p className="text-sm text-text-secondary leading-snug">
                          Unlocking this note will persist until you <strong className="text-text-primary">close the app</strong> or <strong className="text-text-primary">refresh</strong>.
                      </p>
                  </div>
                  
                  <button
                    onClick={() => setModalOpen(true)}
                    className="group bg-accent-primary hover:bg-accent-primary-hover text-white px-12 py-4 rounded-xl font-black text-lg shadow-xl shadow-accent-primary/25 hover:shadow-accent-primary/40 transform hover:-translate-y-1 transition-all flex items-center gap-3"
                  >
                    <span>Unlock Note</span>
                  </button>
              </div>
          ) : isHidden ? (
              /* Hidden State (Privacy Level) */
              <div className="absolute inset-0 bg-bg-app flex flex-col items-center justify-center p-6 space-y-4 z-[60]">
                  <div className="bg-purple-500/10 p-6 rounded-full border border-purple-500/20">
                      <EyeOff className="w-12 h-12 text-purple-500" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-text-primary">Content Hidden</h2>
                    <p className="text-text-secondary text-sm mt-1">
                        Note content is obscured for privacy.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsHidden(false)}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-purple-900/20 transition-all flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Reveal Content
                  </button>
              </div>
          ) : (
             /* Normal Editor State */
             <MonacoWrapper
                content={content}
                language={language}
                onChange={(v) => setContent(v || '')}
                theme={theme}
                fontSize={fontSize}
            />
          )}
        </div>

        {isPreview && language === 'markdown' && !isHidden && (
          <>
            <div
              onMouseDown={startResizing}
              className="w-1.5 hover:w-2 bg-border hover:bg-blue-500/50 cursor-col-resize transition-all z-10"
            />
            <div 
              style={{ width: previewWidth }} 
              className="border-l border-border bg-bg-app overflow-hidden flex flex-col"
            >
              <MarkdownPreview content={content} />
            </div>
          </>
        )}
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmLabel="Delete"
        isDestructive={true}
      />
    </div>
  );
}
