import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
// import { getEmbedding, cosineSimilarity } from '../../lib/search/embeddings.ts';
// import { db } from '../../lib/storage/db.ts';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      // const queryVector = await getEmbedding(query);
      // const allLogs = await db.logIndices.toArray();
      // 
      // const scoredResults = allLogs
      //   .map(log => {
      //     if (!log.embedding) return { log, score: 0 };
      //     return {
      //       log,
      //       score: cosineSimilarity(queryVector, log.embedding)
      //     };
      //   })
      //   .filter(res => res.score > 0.7)
      //   .sort((a, b) => b.score - a.score)
      //   .slice(0, 10);
      //
      // setResults(scoredResults);
      setResults([]);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-l border-gray-800">
      <div className="p-4 border-b border-gray-800">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Semantic search logs..."
            className="w-full bg-[#2a2a2a] border border-gray-700 rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500"
          />
          {isSearching ? (
            <Loader2 className="absolute left-3 top-2.5 w-4 h-4 text-blue-500 animate-spin" />
          ) : (
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {results.length > 0 ? (
          <div className="space-y-4">
            {results.map((res, i) => (
              <div key={i} className="p-2 bg-gray-900 rounded border border-gray-800">
                <div className="text-[10px] text-blue-400 mb-1">Score: {res.score.toFixed(4)}</div>
                <div className="text-xs text-gray-300 line-clamp-3">{res.log.message}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-600 text-sm mt-10">
            {isSearching ? 'Analyzing...' : 'No results above threshold'}
          </div>
        )}
      </div>
    </div>
  );
}

