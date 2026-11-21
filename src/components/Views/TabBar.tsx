import { X, Lock, EyeOff } from 'lucide-react';

export interface Tab {
  id: string;
  title: string;
  type: 'note' | 'log' | 'diagram';
  isProtected?: boolean;
  isHidden?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSelect: (tab: Tab) => void;
  onClose: (e: React.MouseEvent, id: string) => void;
}

export function TabBar({ tabs, activeTabId, onSelect, onClose }: TabBarProps) {
  return (
    <div className="flex bg-[var(--tab-bg)] overflow-x-auto no-scrollbar border-b border-[var(--tab-border)] shrink-0">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onSelect(tab)}
          className={`group flex items-center min-w-[120px] max-w-[200px] h-10 px-3 border-r border-[var(--tab-border)] cursor-pointer transition-colors relative ${
            activeTabId === tab.id
              ? 'bg-[var(--tab-bg-active)] text-[var(--tab-text-active)]'
              : 'bg-[var(--tab-bg)] text-[var(--tab-text)] hover:bg-[var(--tab-bg-active)]'
          }`}
        >
          {activeTabId === tab.id && (
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--tab-accent)]" />
          )}
          <div className="flex flex-col items-start justify-center flex-1 min-w-0 py-0.5">
            <div className="flex items-center gap-1 h-2.5">
              {tab.isProtected && <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
              {tab.isHidden && <EyeOff className="w-2.5 h-2.5 text-purple-500 shrink-0" />}
            </div>
            <span 
              className="text-[10px] leading-[1.2] w-full mt-0.5"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-all'
              }}
            >
              {tab.title}
            </span>
          </div>
          <button
            onClick={(e) => onClose(e, tab.id)}
            className="ml-2 p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
