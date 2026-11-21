/**
 * Streaming OPFS utilities for handling large files
 * Allows reading/writing without loading entire file into memory
 */

/**
 * Stream a File directly to OPFS without loading into memory
 * Returns the OPFS path where the file was saved
 */
export async function streamFileToOPFS(file: File, filename: string): Promise<string> {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  
  // Use the file's stream directly - no memory copy
  const stream = file.stream();
  await stream.pipeTo(writable);
  
  return filename;
}

/**
 * Read a specific byte range from an OPFS file
 * Used for fetching individual log entries by their stored offset
 */
export async function readOPFSRange(path: string, start: number, end: number): Promise<string> {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(path);
  const file = await fileHandle.getFile();
  const blob = file.slice(start, end);
  return await blob.text();
}

/**
 * Read multiple byte ranges from an OPFS file in one operation
 * More efficient than multiple readOPFSRange calls
 */
export async function readOPFSRanges(
  path: string, 
  ranges: { start: number; end: number }[]
): Promise<string[]> {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(path);
  const file = await fileHandle.getFile();
  
  return Promise.all(
    ranges.map(async ({ start, end }) => {
      const blob = file.slice(start, end);
      return await blob.text();
    })
  );
}

/**
 * Get the size of an OPFS file without reading it
 */
export async function getOPFSFileSize(path: string): Promise<number> {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(path);
  const file = await fileHandle.getFile();
  return file.size;
}

/**
 * Check if a file exists in OPFS
 */
export async function existsInOPFS(path: string): Promise<boolean> {
  try {
    const root = await navigator.storage.getDirectory();
    await root.getFileHandle(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stream read an OPFS file in chunks for parsing
 * Yields chunks of the specified size
 */
export async function* streamFromOPFS(
  path: string, 
  chunkSize: number = 64 * 1024 // 64KB default
): AsyncGenerator<{ chunk: string; offset: number }> {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(path);
  const file = await fileHandle.getFile();
  const totalSize = file.size;
  
  let offset = 0;
  while (offset < totalSize) {
    const end = Math.min(offset + chunkSize, totalSize);
    const blob = file.slice(offset, end);
    const chunk = await blob.text();
    yield { chunk, offset };
    offset = end;
  }
}

/**
 * Save a serialized index to OPFS
 */
export async function saveIndexToOPFS(indexPath: string, index: unknown): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(indexPath, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(index));
  await writable.close();
}

/**
 * Load a serialized index from OPFS
 */
export async function loadIndexFromOPFS<T>(indexPath: string): Promise<T | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(indexPath);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Delete a file from OPFS
 */
export async function deleteFromOPFS(path: string): Promise<void> {
  const root = await navigator.storage.getDirectory();
  await root.removeEntry(path);
}
