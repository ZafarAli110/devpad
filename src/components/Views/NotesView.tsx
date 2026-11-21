

import { EditorToolbar } from './EditorToolbar';
import { TabBar } from './TabBar';
import { MonacoWrapper } from '../Editor/MonacoWrapper';

interface NotesViewProps {
  tabs: any[];
  activeTabId: string | null;
  content: string;
  language: string;
  theme: 'light' | 'dark';
  onSelectTab: (tab: any) => void;
  onCloseTab: (e: any, id: string) => void;
  onChange: (val: string | undefined) => void;
  activeTitle: string;
  onTitleChange: (v: string) => void;
  onSave: () => void;
}

export function NotesView({
  tabs,
  activeTabId,
  content,
  language,
  theme,
  onSelectTab,
  onCloseTab,
  onChange,
  activeTitle,
  onTitleChange,
  onSave
}: NotesViewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TabBar 
        tabs={tabs} 
        activeTabId={activeTabId} 
        onSelect={onSelectTab} 
        onClose={onCloseTab} 
      />
      
      <EditorToolbar 
        activeTitle={activeTitle}
        onTitleChange={onTitleChange}
        onSave={onSave}
        fileSize={new Blob([content]).size}
        // Simplified props for now, we'll refine
      />
      
      <div className="flex-1 relative min-w-0 overflow-hidden">
        <MonacoWrapper 
          content={content} 
          language={language} 
          onChange={onChange} 
          theme={theme} 
        />
      </div>
    </div>
  );
}
