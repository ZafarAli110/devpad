import { StructuredLog } from '../parser/logParser.ts';
import { getEmbedding } from './embeddings.ts';
import { db } from '../storage/db.ts';

export async function indexLogs(noteId: string, logs: StructuredLog[]) {
  // Deduplicate messages to save embedding cost/time
  const uniqueMessages = new Map<string, StructuredLog>();
  logs.forEach(log => {
    if (!uniqueMessages.has(log.message)) {
      uniqueMessages.set(log.message, log);
    }
  });

  const logsToIndex = Array.from(uniqueMessages.values());
  
  // Index in batches for performance
  for (const log of logsToIndex) {
    const embedding = await getEmbedding(log.message);
    await db.logIndices.add({
      id: crypto.randomUUID(),
      parentId: noteId,
      lineNumber: log.lineNumber,
      timestamp: new Date(log.timestamp).getTime(),
      level: log.level as 'INF' | 'WRN' | 'ERR' | 'DBG',
      requestId: log.requestId,
      message: log.message,
      embedding
    });
  }
}
