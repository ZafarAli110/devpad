import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/storage/db';
import { GenericDiagramEditor } from '../Editor/GenericDiagramEditor';
import { Loader2 } from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';
import { TabBar } from './TabBar';
import { useEffect } from 'react';

export function DiagramEditorWrapper() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addTab, diagramTabs, closeTab } = useAppContext();

  const diagram = useLiveQuery(
    () => db.diagrams.get(id!),
    [id]
  );

  // Add tab on mount/change
  useEffect(() => {
      if (diagram) {
          addTab({ id: diagram.id, title: diagram.title, type: 'diagram' });
      }
  }, [diagram, addTab]);


  if (!diagram) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading diagram...
      </div>
    );
  }

  const handleSave = async (title: string, content: string) => {
      await db.diagrams.update(diagram.id, {
          title,
          content,
          updatedAt: Date.now()
      });
      // Update tab title
      addTab({ id: diagram.id, title, type: 'diagram' });
  };

  const handleDelete = async () => {
      // NOTE: Modal is handled inside GenericDiagramEditor now, but we need to handle the after-effect
      // which is closing the tab and redirecting.
      // GenericDiagramEditor calls this function AFTER confirmation.
      await db.diagrams.delete(diagram.id);
      closeTab(diagram.id, 'diagram');
      
      const remaining = diagramTabs.filter(t => t.id !== diagram.id);
      if (remaining.length > 0) {
          navigate(`/diagrams/${remaining[0].id}`);
      } else {
          navigate('/diagrams');
      }
  };

  const handleSelectTab = (tab: { id: string }) => {
      navigate(`/diagrams/${tab.id}`);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      closeTab(tabId, 'diagram');
      
      if (tabId === diagram.id) {
          const remaining = diagramTabs.filter(t => t.id !== tabId);
          if (remaining.length > 0) {
              navigate(`/diagrams/${remaining[0].id}`);
          } else {
              navigate('/diagrams');
          }
      }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
         <TabBar
            tabs={diagramTabs}
            activeTabId={diagram.id}
            onSelect={handleSelectTab as any}
            onClose={handleCloseTab}
        />
        <GenericDiagramEditor 
            key={diagram.id} // FORCE RE-RENDER ON SWITCH
            initialTitle={diagram.title}
            initialContent={diagram.content}
            onSave={handleSave}
            onDelete={handleDelete}
        />
    </div>
  );
}
