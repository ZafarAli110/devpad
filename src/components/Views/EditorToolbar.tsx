import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, PanelRightOpen, PanelRightClose, Save, Trash2, Download, Loader2, Type, HelpCircle, MoreVertical, UploadCloud, Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { MarkdownHelpModal } from './MarkdownHelpModal';

const LANGUAGES = [
  { id: 'plaintext', label: 'Plain Text' },

  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'csharp', label: 'C#' },
  { id: 'json', label: 'JSON' },
  { id: 'sql', label: 'SQL' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'yaml', label: 'YAML' },
  { id: 'python', label: 'Python' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'cpp', label: 'C++' },
  { id: 'java', label: 'Java' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'bash', label: 'Bash' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
];

interface EditorToolbarProps {
  activeTitle: string;
  onTitleChange: (val: string) => void;
  onSave: () => Promise<void> | void;
  onDelete?: () => void;
  onDownload?: () => void;
  onUploadLogs?: () => void;
  fileSize: number;
  isLogView?: boolean;
  showLogViewer?: boolean;
  onToggleLogViewer?: () => void;
  isSaving?: boolean;
  language?: string;
  onLanguageChange?: (lang: string) => void;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  isPreview?: boolean;
  onTogglePreview?: () => void;
  isProtected?: boolean;
  onToggleProtection?: () => void;
  isHidden?: boolean;
  onToggleHide?: () => void;
}

// Hook for clicking outside
function useOnClickOutside<T extends HTMLElement>(ref: React.RefObject<T | null>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

export function EditorToolbar({
  activeTitle,
  onTitleChange,
  onSave,
  onDelete,
  onDownload,
  onUploadLogs,
  fileSize,
  isLogView,
  showLogViewer,
  onToggleLogViewer,
  isSaving = false,
  language = 'plaintext',
  onLanguageChange,
  fontSize = 14,
  onFontSizeChange,
  isPreview,
  onTogglePreview,
  isProtected = false,
  onToggleProtection,
  isHidden = false,
  onToggleHide,
}: EditorToolbarProps) {
  const { success } = useToast();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isFontSizeOpen, setIsFontSizeOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [saveClicked, setSaveClicked] = useState(false);
  const [deleteClicked, setDeleteClicked] = useState(false);

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const selectedLangLabel = LANGUAGES.find((l) => l.id === language)?.label || 'Plain Text';
  const langRef = useRef<HTMLDivElement>(null);
  const fontSizeRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  
  useOnClickOutside(langRef, () => setIsLangOpen(false));
  useOnClickOutside(fontSizeRef, () => setIsFontSizeOpen(false));
  useOnClickOutside(moreMenuRef, () => setIsMoreMenuOpen(false));

  const isEmpty = fileSize === 0;

  const handleSaveClick = async () => {
    if (isEmpty) return;
    setSaveClicked(true);
    await onSave();
    success('Saved successfully');
    setTimeout(() => setSaveClicked(false), 200);
  };

  const handleDeleteClick = () => {
    setDeleteClicked(true);
    onDelete?.();
    setTimeout(() => setDeleteClicked(false), 200);
  };





  return (
    <div className="flex items-center px-4 py-2 bg-bg-panel border-b border-border shrink-0 gap-2 z-40 sticky top-0 transition-all overflow-visible">
      {/* Title Input - Priority Flex */}
      <input
        value={activeTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        onBlur={() => onSave()}
        className="min-w-[100px] sm:min-w-[200px] max-w-sm flex-1 sm:flex-none bg-transparent border border-transparent hover:border-border focus:border-accent-primary rounded-lg px-2 py-1 text-sm font-bold text-text-primary focus:outline-none transition-all truncate"
        placeholder="Untitled"
      />
      
      {/* Language Selector */}
      <div className="relative shrink-0" ref={langRef}>
        <button
          onClick={() => setIsLangOpen(!isLangOpen)}
          className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 rounded-lg bg-bg-element hover:bg-bg-panel-hover border border-border transition-colors text-xs font-medium text-text-primary active:scale-95"
        >
          <span className="hidden sm:inline">{selectedLangLabel}</span>
          <span className="sm:hidden">{selectedLangLabel.substring(0, 2).toUpperCase()}</span>
          <ChevronDown className="w-3 h-3 text-text-muted" />
        </button>
        {isLangOpen && (
          <div className="absolute top-full right-0 sm:left-0 mt-1 w-40 bg-bg-panel border border-border rounded-lg shadow-xl overflow-hidden py-1 z-[100]">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                onClick={() => {
                  onLanguageChange?.(lang.id);
                  setIsLangOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${language === lang.id ? 'bg-accent-primary/10 text-accent-primary' : 'text-text-secondary hover:bg-bg-panel-hover hover:text-text-primary'}`}
              >
                <span>{lang.label}</span>
                {language === lang.id && <Check className="w-3 h-3" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Font Size Selector - Desktop & Tablet */}
      <div className="relative font-mono text-[10px] text-text-secondary shrink-0 hidden sm:block" ref={fontSizeRef}>
        <button
          onClick={() => setIsFontSizeOpen(!isFontSizeOpen)}
          className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 rounded-lg bg-bg-element hover:bg-bg-panel-hover border border-border transition-colors text-xs font-medium text-text-primary active:scale-95"
          title="Font Size"
        >
          <Type className="w-3.5 h-3.5" />
          <span>{fontSize}px</span>
        </button>
        {isFontSizeOpen && (
          <div className="absolute top-full left-0 mt-1 w-20 bg-bg-panel border border-border rounded-lg shadow-xl overflow-hidden py-1 z-[100]">
            {[12, 13, 14, 15, 16, 18, 20, 24, 28, 32].map((size) => (
              <button
                key={size}
                onClick={() => {
                  onFontSizeChange?.(size);
                  setIsFontSizeOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-bg-panel-hover transition-colors ${fontSize === size ? 'text-accent-primary font-bold bg-accent-primary/5' : 'text-text-secondary hover:text-text-primary'}`}
              >
                <span className="text-xs">{size}px</span>
                {fontSize === size && <Check className="w-3 h-3" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

      {/* Editor Controls Group */}
      <div className="flex items-center gap-1.5">
        {/* Markdown Preview Toggle */}
        {language === 'markdown' && (
          <button
            onClick={onTogglePreview}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              isPreview 
                ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' 
                : 'bg-bg-element border-border text-text-secondary hover:text-text-primary'
            }`}
            title={isPreview ? 'Hide Live Preview' : 'Show Live Preview'}
          >
            {isPreview ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline">{isPreview ? 'Hide Preview' : 'Live Preview'}</span>
          </button>
        )}

        {/* Persistence/Protection Toggle - ONLY for PlainText and NOT for Logs */}
        {language === 'plaintext' && !isLogView && (
          <button
            onClick={onToggleProtection}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              isProtected 
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' 
                : 'bg-bg-element border-border text-text-secondary hover:text-text-primary'
            }`}
            title={isProtected ? 'Note is protected by encryption' : 'Click to protect this note'}
          >
            <Lock className={`w-3.5 h-3.5 ${isProtected ? 'text-amber-500' : ''}`} />
            <span className="hidden lg:inline">{isProtected ? 'Protected' : 'Protect'}</span>
          </button>
        )}

        {/* Local Hide Toggle - Only for Notes */}
        {!isLogView && (
          <button
            onClick={onToggleHide}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              isHidden 
                ? 'bg-purple-500/10 text-purple-600 border-purple-500/30' 
                : 'bg-bg-element border-border text-text-secondary hover:text-text-primary'
            }`}
            title={isHidden ? 'Unhide note content' : 'Temporarily hide note content'}
          >
            {isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline">{isHidden ? 'Reveal' : 'Hide'}</span>
          </button>
        )}

        {/* Markdown Help */}
        {language === 'markdown' && (
          <button
            onClick={() => setIsHelpOpen(true)}
            className="hidden sm:flex p-1.5 text-text-muted hover:text-accent-primary transition-colors hover:bg-bg-element rounded-md"
            title="Markdown Help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

      {/* File Size */}
      <span className="text-[10px] font-mono text-text-muted bg-bg-element px-2 py-1 rounded border border-border whitespace-nowrap hidden sm:block">
        {(fileSize / 1024).toFixed(1)} KB
      </span>

      {/* Spacer to push actions to the right */}
      <div className="flex-1" />

      <div className="items-center gap-1.5 flex">
        {/* Save Button - Always Visible, Icon Only on Mobile */}
        <button
          onClick={handleSaveClick}
          disabled={isSaving || isEmpty}
          className={`flex items-center space-x-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all transform active:scale-95 ${
            isEmpty 
              ? 'bg-bg-element text-text-muted cursor-not-allowed opacity-50'
              : saveClicked || isSaving
                ? 'bg-green-600 text-white scale-95'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
          title="Save (Ctrl+S)"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
        </button>

        {/* Desktop Download/Delete (> 768px) */}
        <div className="max-md:hidden flex items-center gap-1.5">
          {onUploadLogs && (
             <button
                onClick={onUploadLogs}
                className="flex items-center space-x-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all transform active:scale-95 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 hover:bg-purple-500/20"
                title="Upload Logs"
             >
                <UploadCloud className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Upload</span>
             </button>
          )}

          {onDownload && (
            <button
              onClick={onDownload}
              className="flex items-center space-x-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all transform active:scale-95 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-500/20"
              title="Download"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Download</span>
            </button>
          )}

          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className={`flex items-center space-x-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all transform active:scale-95 ${
                deleteClicked
                  ? 'bg-red-700 text-white scale-95'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
              }`}
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Delete</span>
            </button>
          )}
        </div>

        {/* Mobile Overflow Menu (< 768px) */}
        <div className="relative md:hidden flex" ref={moreMenuRef}>
           <button
             onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
             className="p-1.5 rounded-lg hover:bg-bg-panel-hover text-text-secondary hover:text-text-primary transition-colors"
           >
             <MoreVertical className="w-5 h-5" />
           </button>
           
           {isMoreMenuOpen && (
             <div className="absolute right-0 top-full mt-2 w-48 bg-bg-panel border border-border rounded-xl shadow-2xl overflow-hidden py-1 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
               {/* Mobile Font Size */}
               <div className="px-3 py-2 border-b border-border">
                  <div className="text-[10px] text-text-muted uppercase font-bold mb-1">Font Size</div>
                  <div className="flex items-center justify-between bg-bg-element rounded-lg p-1">
                    <button onClick={() => onFontSizeChange?.(Math.max(12, fontSize - 1))} className="p-1 hover:bg-bg-panel rounded"><ChevronDown className="w-3 h-3 rotate-180" /></button>
                    <span className="text-xs font-mono">{fontSize}px</span>
                    <button onClick={() => onFontSizeChange?.(Math.min(32, fontSize + 1))} className="p-1 hover:bg-bg-panel rounded"><ChevronDown className="w-3 h-3" /></button>
                  </div>
               </div>

               {onUploadLogs && (
                 <button
                   onClick={() => { onUploadLogs(); setIsMoreMenuOpen(false); }}
                   className="w-full flex items-center space-x-2 px-4 py-2.5 text-xs text-text-primary hover:bg-bg-panel-hover transition-colors"
                 >
                   <UploadCloud className="w-4 h-4 text-purple-500" />
                   <span>Upload Logs</span>
                 </button>
               )}

               {onDownload && (
                 <button
                   onClick={() => { onDownload?.(); setIsMoreMenuOpen(false); }}
                   className="w-full flex items-center space-x-2 px-4 py-2.5 text-xs text-text-primary hover:bg-bg-panel-hover transition-colors"
                 >
                   <Download className="w-4 h-4 text-blue-500" />
                   <span>Download File</span>
                 </button>
               )}

               {onDelete && (
                 <button
                   onClick={() => { handleDeleteClick?.(); setIsMoreMenuOpen(false); }}
                   className="w-full flex items-center space-x-2 px-4 py-2.5 text-xs text-rose-500 hover:bg-rose-500/10 transition-colors"
                 >
                   <Trash2 className="w-4 h-4" />
                   <span>Delete File</span>
                 </button>
               )}
               
               <div className="px-4 py-2 border-t border-border text-[10px] text-text-muted text-center font-mono">
                 {(fileSize / 1024).toFixed(1)} KB
               </div>
             </div>
           )}
        </div>

        {isLogView && !isMobile && (
          <button
            onClick={onToggleLogViewer}
            className={`p-1.5 rounded-lg border transition-all active:scale-95 ${showLogViewer ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : 'bg-bg-element text-text-primary border-border hover:bg-bg-panel-hover'}`}
            title={showLogViewer ? 'Hide Log Viewer' : 'Show Log Viewer'}
          >
            {showLogViewer ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
      
      <MarkdownHelpModal 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
      />
    </div>
  );
}
