import { access } from 'node:fs/promises';

import type { CodexStorePaths } from './codex-home.js';
import { readHistoryEntries, readSessionIndexEntries } from './jsonl-store.js';
import { listThreads } from './sqlite-store.js';

export type SessionSummary = {
  hasRollout: boolean;
  historyCount: number;
  id: string;
  indexed: boolean;
  rolloutPath: string;
  title: string;
  updatedAt: number;
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listSessions(paths: CodexStorePaths): Promise<SessionSummary[]> {
  const [threads, sessionIndexEntries, historyEntries] = await Promise.all([
    listThreads(paths.stateDbPath),
    readSessionIndexEntries(paths.sessionIndexPath),
    readHistoryEntries(paths.historyPath),
  ]);
  const indexedIds = new Set(sessionIndexEntries.map((entry) => entry.id));
  const historyCounts = new Map<string, number>();

  for (const entry of historyEntries) {
    historyCounts.set(entry.session_id, (historyCounts.get(entry.session_id) ?? 0) + 1);
  }

  return Promise.all(
    threads.map(async (thread) => ({
      hasRollout: await fileExists(thread.rolloutPath),
      historyCount: historyCounts.get(thread.id) ?? 0,
      id: thread.id,
      indexed: indexedIds.has(thread.id),
      rolloutPath: thread.rolloutPath,
      title: thread.title,
      updatedAt: thread.updatedAt,
    })),
  );
}
