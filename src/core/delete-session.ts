import { homedir } from 'node:os';
import { join } from 'node:path';

import type { ResolveCodexHomeOptions } from './codex-home.js';
import { assertCodexStoreFiles, resolveCodexHome } from './codex-home.js';
import { createBackupBundle } from './backup.js';
import type { HistoryEntry, SessionIndexEntry } from './jsonl-store.js';
import { partitionJsonlLines, rewriteJsonlFile } from './jsonl-store.js';
import { validateCodexSchema } from './schema.js';
import { listSessions } from './session-query.js';
import { archiveThread, deleteThreadData, getThreadById, snapshotSessionDeleteRows } from './sqlite-store.js';

const DEFAULT_GUARD_WINDOW_SECONDS = 60;

export type DeleteSessionResult = {
  backupId?: string;
  changedLayers: string[];
  mode: 'apply' | 'preview';
  ok: true;
  sessionId: string;
  title: string;
};

type DeleteSessionOptions = ResolveCodexHomeOptions & {
  apply?: boolean;
  guardWindowSeconds?: number;
  id?: string;
  now?: Date;
  query?: string;
  sqlite3Command?: string;
  title?: string;
  yes?: boolean;
};

function resolveDeleteTarget(
  sessions: Awaited<ReturnType<typeof listSessions>>,
  options: Pick<DeleteSessionOptions, 'id' | 'query' | 'title'>,
) {
  if (options.id) {
    return sessions.find((session) => session.id === options.id) ?? null;
  }

  if (options.title) {
    const matches = sessions.filter((session) => session.title === options.title);

    if (matches.length === 0) {
      return null;
    }

    if (matches.length > 1) {
      throw new Error(`Delete title is ambiguous. Matched ${matches.length} sessions.`);
    }

    return matches[0] ?? null;
  }

  if (!options.query) {
    throw new Error('Delete requires --id, --title, or a positional query.');
  }

  const normalizedQuery = options.query.toLowerCase();
  const matches = sessions.filter(
    (session) =>
      session.id.toLowerCase().includes(normalizedQuery) ||
      session.title.toLowerCase().includes(normalizedQuery),
  );

  if (matches.length === 0) {
    return null;
  }

  if (matches.length > 1) {
    throw new Error(`Delete query is ambiguous. Matched ${matches.length} sessions.`);
  }

  return matches[0] ?? null;
}

function assertNotRecentlyActive(
  updatedAt: number,
  options: Pick<DeleteSessionOptions, 'guardWindowSeconds' | 'now'>,
): void {
  const guardWindowSeconds = options.guardWindowSeconds ?? DEFAULT_GUARD_WINDOW_SECONDS;
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);

  if (nowSeconds - updatedAt < guardWindowSeconds) {
    throw new Error('Refusing delete because the target session looks recently active.');
  }
}

function sessionIndexBelongsToSession(sessionId: string, line: string): boolean {
  return (JSON.parse(line) as SessionIndexEntry).id === sessionId;
}

function historyBelongsToSession(sessionId: string, line: string): boolean {
  return (JSON.parse(line) as HistoryEntry).session_id === sessionId;
}

export type ArchiveSessionResult = {
  mode: 'apply' | 'preview';
  ok: true;
  sessionId: string;
  title: string;
};

type ArchiveSessionOptions = ResolveCodexHomeOptions & {
  apply?: boolean;
  guardWindowSeconds?: number;
  id?: string;
  now?: Date;
  query?: string;
  sqlite3Command?: string;
  title?: string;
  yes?: boolean;
};

export async function archiveSession(
  options: ArchiveSessionOptions,
): Promise<ArchiveSessionResult> {
  const paths = resolveCodexHome(options);

  await assertCodexStoreFiles(paths);
  await validateCodexSchema(paths.stateDbPath, { sqlite3Command: options.sqlite3Command });

  const sessions = await listSessions(paths);
  const target = resolveDeleteTarget(sessions, options);

  if (!target) {
    throw new Error('Could not resolve a session to archive.');
  }

  assertNotRecentlyActive(target.updatedAt, options);

  if (!options.apply) {
    return {
      mode: 'preview',
      ok: true,
      sessionId: target.id,
      title: target.title,
    };
  }

  if (!options.yes) {
    throw new Error('Archive apply mode requires --yes.');
  }

  await archiveThread(paths.stateDbPath, target.id, {
    sqlite3Command: options.sqlite3Command,
  });

  return {
    mode: 'apply',
    ok: true,
    sessionId: target.id,
    title: target.title,
  };
}

export async function deleteSession(
  options: DeleteSessionOptions,
): Promise<DeleteSessionResult> {
  const paths = resolveCodexHome(options);

  await assertCodexStoreFiles(paths);
  await validateCodexSchema(paths.stateDbPath, { sqlite3Command: options.sqlite3Command });

  const sessions = await listSessions(paths);
  const target = resolveDeleteTarget(sessions, options);

  if (!target) {
    throw new Error('Could not resolve a session to delete.');
  }

  assertNotRecentlyActive(target.updatedAt, options);

  if (!options.apply) {
    return {
      changedLayers: ['sqlite', 'session_index.jsonl', 'history.jsonl', 'rollout'],
      mode: 'preview',
      ok: true,
      sessionId: target.id,
      title: target.title,
    };
  }

  if (!options.yes) {
    throw new Error('Delete apply mode requires --yes.');
  }

  const thread = await getThreadById(paths.stateDbPath, target.id, {
    sqlite3Command: options.sqlite3Command,
  });

  if (!thread) {
    throw new Error('Target session is no longer present in the SQLite store.');
  }

  const sessionIndexPlan = await partitionJsonlLines(paths.sessionIndexPath, (line) => {
    return !sessionIndexBelongsToSession(target.id, line);
  });
  const historyPlan = await partitionJsonlLines(paths.historyPath, (line) => {
    return !historyBelongsToSession(target.id, line);
  });
  const sqliteSnapshots = await snapshotSessionDeleteRows(paths.stateDbPath, target.id, {
    sqlite3Command: options.sqlite3Command,
  });

  const backup = await createBackupBundle({
    backupRootDir: join(homedir(), '.codex-session-manager', 'backups'),
    createdAt: options.now ?? new Date(),
    historyLines: historyPlan.removedLines,
    rolloutPath: thread.rolloutPath,
    sessionId: target.id,
    sessionIndexLines: sessionIndexPlan.removedLines,
    sqliteSnapshots,
  });

  await deleteThreadData(paths.stateDbPath, target.id, {
    sqlite3Command: options.sqlite3Command,
  });
  await rewriteJsonlFile(paths.sessionIndexPath, sessionIndexPlan.keptLines);
  await rewriteJsonlFile(paths.historyPath, historyPlan.keptLines);

  return {
    backupId: backup.backupId,
    changedLayers: ['sqlite', 'session_index.jsonl', 'history.jsonl', 'rollout'],
    mode: 'apply',
    ok: true,
    sessionId: target.id,
    title: target.title,
  };
}
