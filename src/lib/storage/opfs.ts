export async function saveToOPFS(path: string, content: string): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(path, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function readFromOPFS(path: string): Promise<string> {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(path);
  const file = await fileHandle.getFile();
  return await file.text();
}

export async function deleteFromOPFS(path: string): Promise<void> {
  const root = await navigator.storage.getDirectory();
  await root.removeEntry(path);
}
