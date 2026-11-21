import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { LogNote } from '../../lib/storage/db';
import { Terminal, Search, Plus, Calendar, Download, DownloadCloud } from 'lucide-react';
import { db } from '../../lib/storage/db';
import { Pagination } from '../Shared/Pagination';
import { ModernSelect } from '../Shared/ModernSelect';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
    { id: 'date-desc', label: 'Newest First' },
    { id: 'date-asc', label: 'Oldest First' },
    { id: 'name-asc', label: 'Name (A-Z)' },
    { id: 'name-desc', label: 'Name (Z-A)' },
];

export function AllLogsView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'>('date-desc');

  const search = searchParams.get('search') || '';

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
        const all = await db.logs.filter(l => 
            (l.title?.toLowerCase().includes(search.toLowerCase()) || 
             l.content?.toLowerCase().includes(search.toLowerCase()))
        ).count();
        return all;
    }
    return await db.logs.count();
  }, [search]) || 0;

  // 2. Get paginated data
  const logs = useLiveQuery(async () => {
    let collection;

    // Apply Sort
    if (sort === 'date-desc') {
        collection = db.logs.orderBy('updatedAt').reverse();
    } else if (sort === 'date-asc') {
        collection = db.logs.orderBy('updatedAt');
    } else if (sort === 'name-asc') {
        collection = db.logs.orderBy('title');
    } else { // name-desc
        collection = db.logs.orderBy('title').reverse();
    }

    // Apply Search
    if (search) {
        const allMatches = await collection.filter(l => 
            (l.title?.toLowerCase().includes(search.toLowerCase()) || 
             l.content?.toLowerCase().includes(search.toLowerCase()))
        ).toArray();
        
        return allMatches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    }

    // Apply Pagination (Native)
    return await collection
        .offset((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .toArray();
  }, [page, sort, search]) || [];

  const handleCreateLog = async () => {
    const id = crypto.randomUUID();
    const count = await db.logs.count();
    const title = `New Log ${count + 1}`;
    const newLog = {
      id,
      title,
      content: '',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.logs.add(newLog);
    navigate(`/logs/${id}`);
  };

  const handleDownloadLog = async (e: React.MouseEvent, log: LogNote) => {
    e.stopPropagation();
    const blob = new Blob([log.content || ''], { type: 'text/plain' });
    const fileName = `${log.title || 'log'}.txt`;
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    const allLogs = await db.logs.toArray();
    allLogs.forEach((log) => {
      const blob = new Blob([log.content || ''], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${log.title || 'log'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
      <div className="p-6 border-b border-border bg-bg-panel space-y-4">
        {/* Top Row: Title & Actions */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-text-primary">All Logs</h1>
          
          <div className="flex items-center gap-2">
            <button
                onClick={handleDownloadAll}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-xl font-bold transition-all active:scale-95 text-xs"
                title="Download all logs"
                aria-label="Download all logs"
            >
                <DownloadCloud className="w-4 h-4" />
                <span>Export All</span>
            </button>
            <button
              onClick={handleCreateLog}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-900/20 active:scale-95 text-xs"
              aria-label="Create new log"
            >
              <Plus className="w-4 h-4" />
              <span>New Log</span>
            </button>
          </div>
        </div>

        {/* Middle Row: Search & Sort */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-bg-input border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-all font-medium"
            />
          </div>
          
          <div className="w-48">
            <ModernSelect 
                value={sort}
                options={SORT_OPTIONS}
                onChange={(val) => setSort(val as any)}
            />
          </div>
        </div>

        {/* Bottom Row: Pagination */}
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

      {/* Logs Grid */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary">
            <Terminal className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">
              {search ? 'No logs match your search' : 'No logs yet'}
            </p>
            <p className="text-sm text-text-muted mt-1">
              {search ? 'Try a different search term' : 'Create your first log to get started'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col"> 
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4 pb-24">
                {logs.map((log) => (
                <div
                    key={log.id}
                    className="group relative p-4 bg-bg-panel border border-border rounded-xl hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-300"
                >
                    <div
                        onClick={() => navigate(`/logs/${log.id}`)}
                        className="text-left w-full cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            navigate(`/logs/${log.id}`);
                          }
                        }}
                    >
                    <div className="flex items-start justify-between mb-2">
                        <Terminal className="w-5 h-5 text-purple-500" />
                        <div className="flex items-center gap-2">
                            {/* Download button - inline with date */}
                            <button
                                onClick={(e) => handleDownloadLog(e, log)}
                                className="p-1 rounded-md bg-bg-element hover:bg-purple-500/20 text-text-secondary hover:text-purple-500 border border-border transition-all active:scale-95"
                                title="Download log"
                                aria-label={`Download log: ${log.title || 'Untitled'}`}
                            >
                                <Download className="w-3.5 h-3.5" />
                            </button>
                            <div className="flex items-center text-[10px] text-text-muted">
                                <Calendar className="w-3 h-3 mr-1" />
                                {formatDate(log.updatedAt)}
                            </div>
                        </div>
                    </div>
                    <h3 className="font-bold text-text-primary truncate mb-1 group-hover:text-purple-500 transition-colors">
                        {log.title || 'Untitled'}
                    </h3>
                    <p className="text-xs text-text-secondary line-clamp-2">
                        {log.content?.slice(0, 100) || 'Empty log'}
                    </p>
                    </div>
                </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
