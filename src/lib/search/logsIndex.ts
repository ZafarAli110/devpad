import { db, LogNote } from '../storage/db';
import { getEmbedding } from './embeddings';

export async function indexLog(log: LogNote) {
  try {
    const textToEmbed = `${log.title}\n\n${log.content}`;
    const embedding = await getEmbedding(textToEmbed);
    
    await db.logs.update(log.id, {
      embedding: embedding, // Type assertion handled in interface
      updatedAt: Date.now()
    } as any);
    
    return true;
  } catch (error) {
    console.error(`Failed to index log ${log.id}:`, error);
    return false;
  }
}

export async function indexAllLogs() {
  const logs = await db.logs.toArray();
  let indexed = 0;
  
  for (const log of logs) {
    const success = await indexLog(log);
    if (success) indexed++;
  }
  
  return indexed;
}
