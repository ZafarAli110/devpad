import { db, Note } from '../storage/db';
// import { getEmbedding } from './embeddings';

export async function indexNote(note: Note) {
  try {
    // const textToEmbed = `${note.title}\n\n${note.content}`;
    // const embedding = await getEmbedding(textToEmbed);
    
    // await db.notes.update(note.id, {
    //   embedding,
    //   updatedAt: Date.now()
    // });
    
    return true;
  } catch (error) {
    console.error(`Failed to index note ${note.id}:`, error);
    return false;
  }
}

export async function indexAllNotes() {
  const notes = await db.notes.toArray();
  let indexed = 0;
  
  for (const note of notes) {
    // Skip if already embedded (optional, but good for perf)
    // if (note.embedding) continue; 
    
    const success = await indexNote(note);
    if (success) indexed++;
  }
  
  return indexed;
}
