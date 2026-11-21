import { FileText, Terminal, Home, Plus, PanelLeftClose, PanelLeftOpen, ChevronRight, ArrowUp, ArrowDown, Network, DownloadCloud, Lock, EyeOff, TrendingUp } from 'lucide-react';
import React, { useState, useEffect } from 'react';

interface SideNavProps {
  activeView: string;
  onNavigate: (view: 'home' | 'notes' | 'logs' | 'diagrams' | 'log-analysis') => void;
  activeMenu: 'notes' | 'logs' | 'diagrams';
  onMenuChange: (menu: 'notes' | 'logs' | 'diagrams') => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;

  notes: any[];
  activeTabId: string | null;
  onSelectNote: (item: any) => void;
  onCreateNote: () => void;

  onShowAll?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function SideNav({
  activeView,
  onNavigate,
  activeMenu,
  onMenuChange,
  isCollapsed,
  onToggleCollapse,
  notes,
  activeTabId,
  onSelectNote,
  onCreateNote,
  onShowAll,
  isMobileOpen = false,
  onCloseMobile,
}: SideNavProps) {
  const [sortKey, setSortKey] = React.useState<'date' | 'name'>('date');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // Sort notes based on current order
  const sortedNotes = React.useMemo(() => {
    return [...notes].sort((a, b) => {
      const modifier = sortDir === 'asc' ? 1 : -1;
      
      if (sortKey === 'date') {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return (dateA - dateB) * modifier;
      }
      
      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();
      return titleA.localeCompare(titleB) * modifier;
    });
  }, [notes, sortKey, sortDir]);

  const toggleSort = (key: 'date' | 'name') => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'asc');
    }
  };

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" 
          onClick={onCloseMobile}
        />
      )}

      <div
        className={`
          ${isMobileOpen 
            ? 'fixed inset-y-0 left-0 w-72 translate-x-0' 
            : 'fixed inset-y-0 left-0 w-72 -translate-x-full md:relative md:translate-x-0'}
          ${!isMobileOpen && isCollapsed ? 'md:w-16' : 'md:w-64'}
          bg-bg-panel border-r border-border flex flex-col transition-all duration-300 ease-in-out shrink-0 z-50
        `}
      >
        <div
          className={`flex items-center ${isCollapsed ? 'md:justify-center' : 'md:justify-end'} justify-between p-3 border-b border-border/50`}
        >
          {isMobileOpen && (
             <span className="font-black text-xs text-accent-primary uppercase tracking-widest pl-2">Navigation</span>
          )}
          <button
            onClick={onToggleCollapse}
            className={`p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-panel-hover rounded-lg transition-colors ${isMobileOpen ? 'hidden md:block' : ''}`}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="flex flex-col space-y-1 p-2">
          <NavButton
            icon={<Home />}
            label="Home"
            isActive={activeView === 'home'}
            onClick={() => onNavigate('home')}
            isCollapsed={!isMobileOpen && isCollapsed}
          />
          <div className="h-4" />
          <NavButton
            icon={<FileText />}
            label="Notes"
            isActive={activeView === 'notes'}
            onClick={() => onMenuChange('notes')}
            isCollapsed={!isMobileOpen && isCollapsed}
          />
          <NavButton
            icon={<Terminal />}
            label="Quick Logs"
            isActive={activeView === 'logs'}
            onClick={() => onMenuChange('logs')}
            isCollapsed={!isMobileOpen && isCollapsed}
          />
          <NavButton
            icon={<TrendingUp />}
            label="Log Analysis"
            isActive={activeView === 'log-analysis'}
            onClick={() => onNavigate('log-analysis')}
            isCollapsed={!isMobileOpen && isCollapsed}
          />
          <NavButton
            icon={<Network />}
            label="Diagrams"
            isActive={activeView === 'diagrams'}
            onClick={() => onMenuChange('diagrams')}
            isCollapsed={!isMobileOpen && isCollapsed}
          />
        </div>

        <div className="h-px bg-border mx-4 my-2" />

        <div className="flex flex-col space-y-1 p-2">
            {installPrompt && (
                <NavButton
                    icon={<DownloadCloud />}
                    label="Install App"
                    isActive={false}
                    onClick={handleInstallClick}
                    isCollapsed={!isMobileOpen && isCollapsed}
                />
            )}
        </div>

        <div className="h-px bg-border mx-4 my-2" />

        <div className="px-2 mb-4">
          <button
            onClick={onCreateNote}
            className={`flex items-center justify-center w-full p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all font-bold text-sm`}
            aria-label={activeView === 'log-analysis' ? 'Create New Analysis' : activeMenu === 'notes' ? 'Create New Note' : activeMenu === 'logs' ? 'Create New Log' : 'Create New Diagram'}
          >
            <Plus className="w-5 h-5 shrink-0" />
            {(!isCollapsed || isMobileOpen) && (
              <span className="ml-2 truncate">
                {activeView === 'log-analysis' ? 'New Analysis' : activeMenu === 'notes' ? 'New Note' : activeMenu === 'logs' ? 'New Log' : 'New Diagram'}
              </span>
            )}
          </button>
        </div>

        {(!isCollapsed || isMobileOpen) && (
          <div className="px-4 pb-2 flex items-center justify-between">
            <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">
              {activeView === 'log-analysis' ? 'Saved Analysis' : 'Recent 50'}
            </span>
            <div className="flex items-center gap-1">
               <div className="flex bg-bg-element rounded-lg p-0.5 border border-border">
                  <button
                    onClick={() => toggleSort('date')}
                    className={`p-1 rounded-md transition-colors ${sortKey === 'date' ? 'bg-bg-panel shadow-sm text-accent-primary' : 'text-text-muted hover:text-text-secondary'}`}
                    title="Sort by Date"
                    aria-label={`Sort by date ${sortKey === 'date' && sortDir === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    <div className="flex items-center">
                      <span className="text-[9px] font-bold mr-0.5 whitespace-nowrap">DATE</span>
                      {sortKey === 'date' && (
                         sortDir === 'desc' ? <ArrowDown className="w-2.5 h-2.5" /> : <ArrowUp className="w-2.5 h-2.5" />
                      )}
                    </div>
                  </button>
                  <div className="w-px bg-border mx-0.5 my-1" />
                   <button
                    onClick={() => toggleSort('name')}
                    className={`p-1 rounded-md transition-colors ${sortKey === 'name' ? 'bg-bg-panel shadow-sm text-accent-primary' : 'text-text-muted hover:text-text-secondary'}`}
                    title="Sort by Name"
                    aria-label={`Sort by name ${sortKey === 'name' && sortDir === 'asc' ? 'descending' : 'ascending'}`}
                  >
                     <div className="flex items-center">
                      <span className="text-[9px] font-bold mr-0.5 whitespace-nowrap">NAME</span>
                      {sortKey === 'name' && (
                         sortDir === 'desc' ? <ArrowDown className="w-2.5 h-2.5" /> : <ArrowUp className="w-2.5 h-2.5" />
                      )}
                    </div>
                  </button>
               </div>

              {onShowAll && (
                <button
                  onClick={onShowAll}
                  className="ml-2 text-[10px] font-bold text-accent-primary hover:text-accent-hover flex items-center transition-colors"
                >
                  All
                  <ChevronRight className="w-3 h-3 ml-0.5" />
                </button>
              )}
            </div>
          </div>
        )}

        <div
          className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar min-h-0 pb-12"
        >
          {sortedNotes.map((note) => (
            <button
              key={note.id}
              onClick={() => onSelectNote(note)}
              className={`w-full flex items-center p-2 rounded-lg transition-all text-sm group relative ${
                activeTabId === note.id
                  ? 'bg-bg-element text-text-primary border border-border shadow-sm'
                  : 'text-text-secondary hover:bg-bg-panel-hover hover:text-text-primary border border-transparent'
              }`}
            >
              {activeView === 'log-analysis' ? (
                <TrendingUp
                  className={`w-4 h-4 shrink-0 shadow-sm ${activeTabId === note.id ? 'text-accent-primary' : 'text-text-muted group-hover:text-text-secondary'}`}
                />
              ) : activeMenu === 'notes' ? (
                <FileText
                  className={`w-4 h-4 shrink-0 shadow-sm ${activeTabId === note.id ? 'text-accent-primary' : 'text-text-muted group-hover:text-text-secondary'}`}
                />
              ) : activeMenu === 'logs' ? (
                <Terminal
                  className={`w-4 h-4 shrink-0 shadow-sm ${activeTabId === note.id ? 'text-accent-primary' : 'text-text-muted group-hover:text-text-secondary'}`}
                />
              ) : (
                <Network
                  className={`w-4 h-4 shrink-0 shadow-sm ${activeTabId === note.id ? 'text-accent-primary' : 'text-text-muted group-hover:text-text-secondary'}`}
                />
              )}
              {(!isCollapsed || isMobileOpen) && (
                <div className="ml-3 flex-1 min-w-0 text-left">
                  <div className="font-semibold tracking-tight flex items-center gap-1.5 min-w-0">
                    <span className="truncate flex-1">{note.title || 'Untitled'}</span>
                    {note.isProtected && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                    {note.isHidden && <EyeOff className="w-3 h-3 text-purple-500 shrink-0" />}
                  </div>
                  <div className="text-[10px] text-text-muted capitalize">
                    {(() => {
                      const d = new Date(note.updatedAt);
                      return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}, ${d.getFullYear()} • ${d.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}`;
                    })()}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function NavButton({
  icon,
  label,
  isActive,
  onClick,
  isCollapsed,
}: {
  icon: React.ReactElement<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
  isCollapsed: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start px-3'} h-10 rounded-xl transition-all group relative ${
        isActive
          ? 'bg-bg-element text-text-primary border border-border'
          : 'text-text-secondary hover:bg-bg-panel-hover hover:text-text-primary'
      }`}
    >
      {React.cloneElement(icon, {
        className: `w-5 h-5 shrink-0 ${isActive ? 'text-accent-primary' : ''}`,
      })}
      {!isCollapsed && (
        <span className="ml-3 text-sm font-bold tracking-tight">{label}</span>
      )}
    </button>
  );
}