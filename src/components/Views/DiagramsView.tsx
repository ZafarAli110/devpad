import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, Network, DownloadCloud, Calendar, Download } from 'lucide-react';
import { db } from '../../lib/storage/db';
import { useState, useEffect } from 'react';
import { Pagination } from '../Shared/Pagination';
import { ModernSelect } from '../Shared/ModernSelect';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
    { id: 'date-desc', label: 'Newest First' },
    { id: 'date-asc', label: 'Oldest First' },
    { id: 'name-asc', label: 'Name (A-Z)' },
    { id: 'name-desc', label: 'Name (Z-A)' },
];

export function DiagramsView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'>('date-desc');

  // Reset page when search or sort changes
  useEffect(() => {
    setPage(1);
  }, [search, sort]);

  const handleSearchChange = (value: string) => {
    setSearchParams((prev) => {
      if (value) prev.set('search', value);
      else prev.delete('search');
      return prev;
    });
  };

  // 1. Get filtered count for pagination
  const totalCount = useLiveQuery(async () => {
    if (search) {
        return await db.diagrams.filter(d => 
            (d.title?.toLowerCase().includes(search.toLowerCase()))
        ).count();
    }
    return await db.diagrams.count();
  }, [search]) || 0;
  
  // 2. Get paginated data
  const diagrams = useLiveQuery(async () => {
     let collection;

    // Apply Sort
    if (sort === 'date-desc') {
        collection = db.diagrams.orderBy('updatedAt').reverse();
    } else if (sort === 'date-asc') {
        collection = db.diagrams.orderBy('updatedAt');
    } else if (sort === 'name-asc') {
        collection = db.diagrams.orderBy('title');
    } else { // name-desc
        collection = db.diagrams.orderBy('title').reverse();
    }

    // Apply Search
    if (search) {
        const allMatches = await collection.filter(d => 
            (d.title?.toLowerCase().includes(search.toLowerCase()))
        ).toArray();
        
        return allMatches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    }

    // Apply Pagination (Native)
    return await collection
        .offset((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .toArray();
  }, [page, sort, search]) || [];

  const handleCreateDiagram = async () => {
    const id = crypto.randomUUID();
    await db.diagrams.add({
      id,
      title: 'Untitled Diagram',
      content: JSON.stringify({ nodes: [], edges: [] }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    navigate(`/diagrams/${id}`);
  };

  const handleDownloadDiagram = (e: React.MouseEvent, diagram: any) => {
    e.stopPropagation();
    try {
        const parsed = JSON.parse(diagram.content);
        const exportData = {
            title: diagram.title,
            nodes: parsed.nodes || [],
            edges: parsed.edges || [],
            version: 1
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${diagram.title || 'diagram'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch {
        // Fallback for empty
    }
  };

  const handleDownloadAll = async () => {
    const all = await db.diagrams.toArray();
    all.forEach(d => {
        try {
            const parsed = JSON.parse(d.content);
            const exportData = {
                title: d.title,
                nodes: parsed.nodes || [],
                edges: parsed.edges || [],
                version: 1
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${d.title || 'diagram'}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            // Ignore corrupted
        }
    });
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(new Date(timestamp));
  };
  
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="h-full flex flex-col bg-bg-app">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-border bg-bg-panel space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-black text-text-primary flex items-center gap-2">
            Diagrams
          </h1>
          <div className="flex items-center gap-2">
            <button
                onClick={handleDownloadAll}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-xl font-bold transition-all active:scale-95 text-[10px] sm:text-xs whitespace-nowrap"
                title="Download all diagrams"
                aria-label="Download all diagrams"
            >
                <DownloadCloud className="w-4 h-4 shrink-0" />
                <span>Export All</span>
            </button>
            <button
              onClick={handleCreateDiagram}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-900/20 active:scale-95 text-[10px] sm:text-xs whitespace-nowrap"
              aria-label="Create new diagram"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>New Diagram</span>
            </button>
          </div>
        </div>

      {/* Search & Sort */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              placeholder="Search diagrams..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-bg-input border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-all font-medium text-sm sm:text-base"
            />
          </div>
          
          <div className="w-full sm:w-48">
             <ModernSelect 
                value={sort}
                options={SORT_OPTIONS}
                onChange={(val) => setSort(val as any)}
            />
          </div>
        </div>

        {/* Header Pagination */}
        {totalPages > 1 && (
            <div className="mt-4 pt-3 pb-1 px-1 border-t border-dashed border-border/60">
                 <Pagination 
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    itemsPerPage={PAGE_SIZE}
                    totalItems={totalCount}
                />
            </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6 pb-24 custom-scrollbar">
        {diagrams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary">
             <Network className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">
                {search ? 'No diagrams match your search' : 'No diagrams yet'}
            </p>
             <p className="text-sm text-text-muted mt-1">
              {search ? 'Try a different search term' : 'Create your first diagram to get started'}
            </p>
          </div>
        ) : ( 
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24">
          {diagrams.map((diagram) => (
            <div
              key={diagram.id}
              className="group relative p-4 bg-bg-panel border border-border rounded-xl hover:border-accent-primary/50 hover:shadow-xl hover:shadow-accent-primary/10 hover:-translate-y-1 transition-all duration-300"
            >
                <button
                  onClick={() => navigate(`/diagrams/${diagram.id}`)}
                  className="text-left w-full"
                >
                    <div className="flex items-start justify-between mb-2">
                        <Network className="w-5 h-5 text-accent-primary" />
                        <div className="flex items-center gap-2">
                             <button
                                onClick={(e) => handleDownloadDiagram(e, diagram)}
                                className="p-1 rounded-md bg-bg-element hover:bg-blue-500/20 text-text-secondary hover:text-blue-500 border border-border transition-all active:scale-95"
                                title="Download JSON"
                                aria-label={`Download diagram: ${diagram.title || 'Untitled Diagram'}`}
                            >
                                <Download className="w-3.5 h-3.5" />
                            </button>
                            <div className="flex items-center text-[10px] text-text-muted">
                                <Calendar className="w-3 h-3 mr-1" />
                                {formatDate(diagram.updatedAt)}
                            </div>
                        </div>
                    </div>

                    <h3 className="font-bold text-text-primary mb-1 group-hover:text-accent-primary transition-colors truncate">
                        {diagram.title || 'Untitled Diagram'}
                    </h3>
                     <p className="text-xs text-text-secondary line-clamp-2">
                        {/* Summary of nodes? */}
                        {(() => {
                            try {
                                const c = JSON.parse(diagram.content);
                                const nodeCount = c.nodes?.length || 0;
                                const edgeCount = c.edges?.length || 0;
                                return `${nodeCount} nodes, ${edgeCount} connections`;
                            } catch {
                                return 'Empty diagram';
                            }
                        })()}
                    </p>
                </button>
            </div>
          ))}
        </div>
        )}
      </div>
       
    </div>
  );
}
