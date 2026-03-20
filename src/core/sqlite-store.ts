import { execFileSync } from 'node:child_process';

const SQLITE_FIELD_SEPARATOR = '\u001f';

export type SqliteBinaryCheck = {
  command: string;
  error?: string;
  ok: boolean;
};

export type ThreadRow = {
  id: string;
  rolloutPath: string;
  title: string;
  updatedAt: number;
};

export type SqliteTableSnapshot = {
  rowsSql: string[];
  table: string;
};

export function checkSqlite3Binary(command = 'sqlite3'): SqliteBinaryCheck {
  try {
    execFileSync(command, ['-version'], { stdio: 'pipe' });
    return { command, ok: true };
  } catch (error) {
    return {
      command,
      error: error instanceof Error ? error.message : String(error),
      ok: false,
    };
  }
}

function runSqliteLines(stateDbPath: string, sql: string, command = 'sqlite3'): string[] {
  const stdout = execFileSync(command, ['-separator', SQLITE_FIELD_SEPARATOR, stateDbPath, sql], {
    encoding: 'utf8',
  }).trim();

  if (stdout === '') {
    return [];
  }

  return stdout.split('\n').map((line) => line.trim()).filter(Boolean);
}

function runSqliteJson<T>(stateDbPath: string, sql: string, command = 'sqlite3'): T[] {
  const stdout = execFileSync(command, ['-json', stateDbPath, sql], {
    encoding: 'utf8',
  }).trim();

  if (stdout === '') {
    return [];
  }

  return JSON.parse(stdout) as T[];
}

function runSqliteText(
  stateDbPath: string,
  sql: string,
  options: {
    args?: string[];
    command?: string;
  } = {},
): string {
  return execFileSync(options.command ?? 'sqlite3', [...(options.args ?? []), stateDbPath, sql], {
    encoding: 'utf8',
  });
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}

type ThreadJsonRow = {
  id: string;
  rollout_path: string;
  title: string | null;
  updated_at: number;
};

export async function listThreads(stateDbPath: string): Promise<ThreadRow[]> {
  return runSqliteJson<ThreadJsonRow>(
    stateDbPath,
    "SELECT id, title, updated_at, rollout_path FROM threads WHERE archived = 0 ORDER BY updated_at DESC, id DESC;",
  ).map((row) => ({
    id: row.id,
    rolloutPath: row.rollout_path,
    title: row.title ?? '',
    updatedAt: row.updated_at,
  }));
}

export async function getThreadById(
  stateDbPath: string,
  threadId: string,
  options: {
    sqlite3Command?: string;
  } = {},
): Promise<ThreadRow | null> {
  const [row] = runSqliteJson<ThreadJsonRow>(
    stateDbPath,
    `SELECT id, title, updated_at, rollout_path FROM threads WHERE archived = 0 AND id = '${escapeSqlString(threadId)}' LIMIT 1;`,
    options.sqlite3Command,
  );

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    rolloutPath: row.rollout_path,
    title: row.title ?? '',
    updatedAt: row.updated_at,
  };
}

function dumpInsertStatements(
  stateDbPath: string,
  table: string,
  whereClause: string,
  options: {
    sqlite3Command?: string;
  } = {},
): string[] {
  const stdout = runSqliteText(
    stateDbPath,
    `SELECT * FROM ${table} WHERE ${whereClause};`,
    {
      args: ['-cmd', `.mode insert ${table}`],
      command: options.sqlite3Command,
    },
  ).trim();

  if (stdout === '') {
    return [];
  }

  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function snapshotSessionDeleteRows(
  stateDbPath: string,
  threadId: string,
  options: {
    sqlite3Command?: string;
  } = {},
): Promise<SqliteTableSnapshot[]> {
  const quotedId = `'${escapeSqlString(threadId)}'`;

  return [
    {
      rowsSql: dumpInsertStatements(stateDbPath, 'threads', `id = ${quotedId}`, options),
      table: 'threads',
    },
    {
      rowsSql: dumpInsertStatements(stateDbPath, 'logs', `thread_id = ${quotedId}`, options),
      table: 'logs',
    },
    {
      rowsSql: dumpInsertStatements(
        stateDbPath,
        'thread_dynamic_tools',
        `thread_id = ${quotedId}`,
        options,
      ),
      table: 'thread_dynamic_tools',
    },
    {
      rowsSql: dumpInsertStatements(stateDbPath, 'stage1_outputs', `thread_id = ${quotedId}`, options),
      table: 'stage1_outputs',
    },
    {
      rowsSql: dumpInsertStatements(
        stateDbPath,
        'agent_job_items',
        `assigned_thread_id = ${quotedId}`,
        options,
      ),
      table: 'agent_job_items',
    },
  ].filter((snapshot) => snapshot.rowsSql.length > 0);
}

export async function deleteThreadData(
  stateDbPath: string,
  threadId: string,
  options: {
    sqlite3Command?: string;
  } = {},
): Promise<void> {
  const quotedId = `'${escapeSqlString(threadId)}'`;

  runSqliteText(
    stateDbPath,
    `
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;
DELETE FROM logs WHERE thread_id = ${quotedId};
UPDATE agent_job_items SET assigned_thread_id = NULL WHERE assigned_thread_id = ${quotedId};
DELETE FROM threads WHERE id = ${quotedId};
COMMIT;
`,
    { command: options.sqlite3Command },
  );
}

export async function archiveThread(
  stateDbPath: string,
  threadId: string,
  options: {
    sqlite3Command?: string;
  } = {},
): Promise<void> {
  const quotedId = `'${escapeSqlString(threadId)}'`;
  const archivedAt = Math.floor(Date.now() / 1000);

  runSqliteText(
    stateDbPath,
    `UPDATE threads SET archived = 1, archived_at = ${archivedAt} WHERE id = ${quotedId};`,
    { command: options.sqlite3Command },
  );
}

export async function executeSqlStatements(
  stateDbPath: string,
  sql: string,
  options: {
    sqlite3Command?: string;
  } = {},
): Promise<void> {
  runSqliteText(stateDbPath, sql, { command: options.sqlite3Command });
}

export async function getJournalMode(
  stateDbPath: string,
  options: {
    sqlite3Command?: string;
  } = {},
): Promise<string> {
  const [journalMode = 'unknown'] = runSqliteLines(
    stateDbPath,
    'PRAGMA journal_mode;',
    options.sqlite3Command,
  );
  return journalMode;
}
