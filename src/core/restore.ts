import { access, mkdir, readFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type { BackupManifest } from './backup.js';
import type { ResolveCodexHomeOptions } from './codex-home.js';
import { assertCodexStoreFiles, resolveCodexHome } from './codex-home.js';
import { readJsonlLines, rewriteJsonlFile } from './jsonl-store.js';
import { validateCodexSchema } from './schema.js';
import { executeSqlStatements, getThreadById } from './sqlite-store.js';

const SQLITE_RESTORE_ORDER = [
  'threads.sql',
  'logs.sql',
  'thread_dynamic_tools.sql',
  'stage1_outputs.sql',
  'agent_job_items.sql',
] as const;

export type RestoreSessionResult = {
  backupId: string;
  ok: true;
  restoredLayers: string[];
  sessionId: string;
};

type RestoreSessionOptions = ResolveCodexHomeOptions & {
  backupId: string;
  sqlite3Command?: string;
};

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readBackupManifest(backupDir: string): Promise<BackupManifest> {
  return JSON.parse(await readFile(join(backupDir, 'manifest.json'), 'utf8')) as BackupManifest;
}

async function appendJsonlBackup(
  currentPath: string,
  backupPath: string,
): Promise<boolean> {
  if (!(await pathExists(backupPath))) {
    return false;
  }

  const [currentLines, backupLines] = await Promise.all([
    readJsonlLines(currentPath),
    readJsonlLines(backupPath),
  ]);

  await rewriteJsonlFile(currentPath, [...currentLines, ...backupLines]);
  return backupLines.length > 0;
}

async function restoreSqliteSnapshots(
  stateDbPath: string,
  backupDir: string,
  options: {
    sqlite3Command?: string;
  } = {},
): Promise<boolean> {
  const sqlStatements: string[] = [];

  for (const fileName of SQLITE_RESTORE_ORDER) {
    const filePath = join(backupDir, 'sqlite', fileName);

    if (!(await pathExists(filePath))) {
      continue;
    }

    const content = (await readFile(filePath, 'utf8')).trim();

    if (content !== '') {
      sqlStatements.push(content.replaceAll(/^INSERT INTO /gm, 'INSERT OR REPLACE INTO '));
    }
  }

  if (sqlStatements.length === 0) {
    return false;
  }

  await executeSqlStatements(
    stateDbPath,
    `
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;
${sqlStatements.join('\n')}
COMMIT;
`,
    options,
  );

  return true;
}

async function restoreRollout(
  backupDir: string,
  manifest: BackupManifest,
): Promise<boolean> {
  if (!manifest.rollout) {
    return false;
  }

  const quarantinedPath = join(backupDir, manifest.rollout.quarantinedPath);

  if (!(await pathExists(quarantinedPath))) {
    return false;
  }

  await mkdir(dirname(manifest.rollout.originalPath), { recursive: true });
  await rename(quarantinedPath, manifest.rollout.originalPath);
  return true;
}

export async function restoreSession(
  options: RestoreSessionOptions,
): Promise<RestoreSessionResult> {
  const paths = resolveCodexHome(options);

  await assertCodexStoreFiles(paths);
  await validateCodexSchema(paths.stateDbPath, { sqlite3Command: options.sqlite3Command });

  const backupDir = join(homedir(), '.codex-session-manager', 'backups', options.backupId);
  const manifest = await readBackupManifest(backupDir);
  const existingThread = await getThreadById(paths.stateDbPath, manifest.sessionId, {
    sqlite3Command: options.sqlite3Command,
  });

  if (existingThread) {
    throw new Error(`Cannot restore ${manifest.sessionId} because that session already exists.`);
  }

  const restoredLayers: string[] = [];

  if (
    await restoreSqliteSnapshots(paths.stateDbPath, backupDir, {
      sqlite3Command: options.sqlite3Command,
    })
  ) {
    restoredLayers.push('sqlite');
  }

  if (await appendJsonlBackup(paths.sessionIndexPath, join(backupDir, 'jsonl', 'session_index.jsonl'))) {
    restoredLayers.push('session_index.jsonl');
  }

  if (await appendJsonlBackup(paths.historyPath, join(backupDir, 'jsonl', 'history.jsonl'))) {
    restoredLayers.push('history.jsonl');
  }

  if (await restoreRollout(backupDir, manifest)) {
    restoredLayers.push('rollout');
  }

  return {
    backupId: manifest.backupId,
    ok: true,
    restoredLayers,
    sessionId: manifest.sessionId,
  };
}
