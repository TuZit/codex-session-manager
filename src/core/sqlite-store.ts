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

export async function listThreads(stateDbPath: string): Promise<ThreadRow[]> {
  return runSqliteLines(
    stateDbPath,
    "SELECT id, title, updated_at, rollout_path FROM threads WHERE archived = 0 ORDER BY updated_at DESC, id DESC;",
  ).map((line) => {
    const [id, title, updatedAt, rolloutPath] = line.split(SQLITE_FIELD_SEPARATOR);

    return {
      id,
      rolloutPath,
      title,
      updatedAt: Number(updatedAt),
    };
  });
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
