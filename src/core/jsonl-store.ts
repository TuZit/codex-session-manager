import { readFile } from 'node:fs/promises';

export type SessionIndexEntry = {
  id: string;
  thread_name: string;
  updated_at: string;
};

export type HistoryEntry = {
  session_id: string;
  text: string;
  ts: number;
};

async function readJsonlFile<T>(filePath: string): Promise<T[]> {
  const content = await readFile(filePath, 'utf8');

  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export async function readHistoryEntries(filePath: string): Promise<HistoryEntry[]> {
  return readJsonlFile<HistoryEntry>(filePath);
}

export async function readSessionIndexEntries(filePath: string): Promise<SessionIndexEntry[]> {
  return readJsonlFile<SessionIndexEntry>(filePath);
}
