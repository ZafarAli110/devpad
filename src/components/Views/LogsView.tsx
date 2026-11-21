import { useState, useEffect } from 'react';
import { FileText, X } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { LogTimeline } from '../LogViewer/LogTimeline.tsx';
import { MonacoWrapper } from '../Editor/MonacoWrapper';
import { TabBar } from './TabBar';
import { EditorToolbar } from './EditorToolbar';
import { StructuredLog } from '../../lib/parser/logParser.ts';


interface LogsViewProps {
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
  onDelete?: () => void;
  onDownload?: () => void;
  logs: StructuredLog[]; // These are the logs from the *main* editor content (saved note)
  onParse: () => void;
  onOpenRequest: (id: string) => void;
  showLogViewer: boolean;
  onToggleLogViewer: () => void;
  isParsing?: boolean;
  externalUniqueIds?: { requestIds: string[]; correlationIds: string[] };
}



export function LogsView({
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
  onSave,
  onDelete,
  onDownload,
  logs,
  onParse,
  onOpenRequest,
  showLogViewer,
  onToggleLogViewer,
  isParsing,
  externalUniqueIds,
}: LogsViewProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isTimelineOverlayOpen, setIsTimelineOverlayOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
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
        onDelete={onDelete}
        onDownload={onDownload}
        fileSize={new Blob([content]).size}
        isLogView={true}
        showLogViewer={showLogViewer}
        onToggleLogViewer={onToggleLogViewer}
      />

      
      <div className="flex-1 flex overflow-hidden relative">
        {showLogViewer ? (
          <>
            <PanelGroup direction="horizontal">
              <Panel defaultSize={isMobile ? 100 : 60} minSize={isMobile ? 100 : 20}>
                <div className="h-full w-full relative min-w-0 overflow-hidden">
                  <MonacoWrapper 
                    content={content} 
                    language={language} 
                    onChange={onChange} 
                    theme={theme} 
                  />
                </div>
              </Panel>
              
              {!isMobile && (
                <>
                  <PanelResizeHandle className="w-1 h-full mx-1 bg-border hover:bg-accent-primary transition-colors cursor-col-resize z-50 focus:outline-none" />
                  <Panel defaultSize={40} minSize={20}>
                    <div className="h-full w-full overflow-hidden flex flex-col relative">
                      <LogTimeline 
                        logs={logs} 
                        onParse={onParse} 
                        onOpenRequest={onOpenRequest} 
                        hasContent={content.length > 0}
                        isParsing={isParsing}
                        externalUniqueIds={externalUniqueIds}
                      />
                    </div>
                  </Panel>
                </>
              )}
            </PanelGroup>

            {/* Mobile/Tablet Timeline FAB */}
            {isMobile && (
              <button
                onClick={() => setIsTimelineOverlayOpen(true)}
                className="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl flex items-center justify-center z-40 transition-all hover:scale-110 active:scale-95 shadow-blue-500/40"
              >
                <div className="relative">
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
                  <FileText className="w-6 h-6" />
                </div>
              </button>
            )}

            {/* Mobile/Tablet Timeline Overlay */}
            {isMobile && isTimelineOverlayOpen && (
              <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="absolute inset-x-0 bottom-0 top-12 bg-bg-app rounded-t-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
                  <div className="h-1.5 w-12 bg-border rounded-full mx-auto my-3 shrink-0" />
                  <div className="absolute top-4 right-4 z-50">
                    <button 
                      onClick={() => setIsTimelineOverlayOpen(false)}
                      className="p-2 bg-bg-panel border border-border rounded-full hover:bg-bg-panel-hover transition-colors shadow-lg"
                    >
                      <X className="w-5 h-5 text-text-primary" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <LogTimeline 
                      logs={logs} 
                      onParse={onParse} 
                      onOpenRequest={onOpenRequest} 
                      hasContent={content.length > 0}
                      isParsing={isParsing}
                      externalUniqueIds={externalUniqueIds}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 relative min-w-0 overflow-hidden">
            <MonacoWrapper 
              content={content} 
              language={language} 
              onChange={onChange} 
              theme={theme} 
            />
          </div>
        )}
      </div>
    </div>
  );
}
