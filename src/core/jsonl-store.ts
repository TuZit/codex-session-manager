import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { readFile, rename, writeFile } from 'node:fs/promises';

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
  const lines = await readJsonlLines(filePath);

  return lines.map((line) => JSON.parse(line) as T);
}

export async function readJsonlLines(filePath: string): Promise<string[]> {
  const content = await readFile(filePath, 'utf8');

  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function partitionJsonlLines(
  filePath: string,
  predicate: (line: string) => boolean,
): Promise<{
  keptLines: string[];
  removedLines: string[];
}> {
  const lines = await readJsonlLines(filePath);
  const keptLines: string[] = [];
  const removedLines: string[] = [];

  for (const line of lines) {
    if (predicate(line)) {
      keptLines.push(line);
      continue;
    }

    removedLines.push(line);
  }

  return {
    keptLines,
    removedLines,
  };
}

export async function rewriteJsonlFile(filePath: string, lines: string[]): Promise<void> {
  const tempPath = join(dirname(filePath), `${randomUUID()}.tmp`);
  const content = lines.length === 0 ? '' : `${lines.join('\n')}\n`;

  await writeFile(tempPath, content, 'utf8');
  await rename(tempPath, filePath);
}

export async function readHistoryEntries(filePath: string): Promise<HistoryEntry[]> {
  return readJsonlFile<HistoryEntry>(filePath);
}

export async function readSessionIndexEntries(filePath: string): Promise<SessionIndexEntry[]> {
  return readJsonlFile<SessionIndexEntry>(filePath);
}
