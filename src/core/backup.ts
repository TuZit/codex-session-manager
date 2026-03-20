import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { quarantineRollout } from './rollout-store.js';

export type BackupSqliteSnapshot = {
  rowsSql: string[];
  table: string;
};

export type CreateBackupBundleOptions = {
  backupRootDir: string;
  createdAt: Date;
  historyLines?: string[];
  rolloutPath?: string;
  sessionId: string;
  sessionIndexLines?: string[];
  sqliteSnapshots?: BackupSqliteSnapshot[];
};

export type BackupRolloutManifest = {
  originalPath: string;
  quarantinedPath: string;
};

export type BackupManifest = {
  backupId: string;
  createdAt: string;
  rollout?: BackupRolloutManifest;
  sessionId: string;
};

export type CreateBackupBundleResult = {
  backupDir: string;
  backupId: string;
  manifest: BackupManifest;
};

function formatBackupId(createdAt: Date, sessionId: string): string {
  return `${createdAt.toISOString().replaceAll(':', '-')}-${sessionId}`;
}

async function writeJsonlLines(filePath: string, lines: string[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, lines.length > 0 ? `${lines.join('\n')}\n` : '');
}

async function writeSqliteSnapshot(
  backupDir: string,
  snapshot: BackupSqliteSnapshot,
): Promise<void> {
  const filePath = join(backupDir, 'sqlite', `${snapshot.table}.sql`);
  await mkdir(join(backupDir, 'sqlite'), { recursive: true });
  await writeFile(filePath, snapshot.rowsSql.length > 0 ? `${snapshot.rowsSql.join('\n')}\n` : '');
}

export async function createBackupBundle(
  options: CreateBackupBundleOptions,
): Promise<CreateBackupBundleResult> {
  const backupId = formatBackupId(options.createdAt, options.sessionId);
  const backupDir = join(options.backupRootDir, backupId);

  await mkdir(backupDir, { recursive: true });

  if (options.historyLines) {
    await writeJsonlLines(join(backupDir, 'jsonl', 'history.jsonl'), options.historyLines);
  }

  if (options.sessionIndexLines) {
    await writeJsonlLines(join(backupDir, 'jsonl', 'session_index.jsonl'), options.sessionIndexLines);
  }

  for (const snapshot of options.sqliteSnapshots ?? []) {
    await writeSqliteSnapshot(backupDir, snapshot);
  }

  const manifest: BackupManifest = {
    backupId,
    createdAt: options.createdAt.toISOString(),
    sessionId: options.sessionId,
  };

  if (options.rolloutPath) {
    manifest.rollout = await quarantineRollout(options.rolloutPath, backupDir);
  }

  await writeFile(join(backupDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    backupDir,
    backupId,
    manifest,
  };
}
