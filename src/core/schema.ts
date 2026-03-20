import { execFileSync } from 'node:child_process';

import type { CodexSchemaReport } from './session-types.js';

const SQLITE_FIELD_SEPARATOR = '\u001f';

const REQUIRED_TABLES = [
  'threads',
  'logs',
  'thread_dynamic_tools',
  'stage1_outputs',
  'agent_jobs',
  'agent_job_items',
] as const;

const REQUIRED_THREAD_COLUMNS = [
  'id',
  'rollout_path',
  'created_at',
  'updated_at',
  'source',
  'model_provider',
  'cwd',
  'title',
  'sandbox_policy',
  'approval_mode',
  'tokens_used',
  'has_user_event',
  'archived',
  'cli_version',
  'first_user_message',
  'memory_mode',
] as const;

function runSqliteLines(dbPath: string, sql: string, sqlite3Command = 'sqlite3'): string[] {
  const stdout = execFileSync(
    sqlite3Command,
    ['-separator', SQLITE_FIELD_SEPARATOR, dbPath, sql],
    { encoding: 'utf8' },
  ).trim();

  if (stdout === '') {
    return [];
  }

  return stdout.split('\n').map((line) => line.trim()).filter(Boolean);
}

export async function inspectCodexSchema(
  dbPath: string,
  options: {
    sqlite3Command?: string;
  } = {},
): Promise<CodexSchemaReport> {
  const tables = runSqliteLines(
    dbPath,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
    options.sqlite3Command,
  );
  const threadColumns = runSqliteLines(dbPath, 'PRAGMA table_info(threads);', options.sqlite3Command).map(
    (line) => {
    const [, name] = line.split(SQLITE_FIELD_SEPARATOR);
    return name;
    },
  );

  const missingTables = REQUIRED_TABLES.filter((table) => !tables.includes(table));
  const missingThreadColumns = REQUIRED_THREAD_COLUMNS.filter((column) => !threadColumns.includes(column));

  return {
    missingTables,
    missingThreadColumns,
    supported: missingTables.length === 0 && missingThreadColumns.length === 0,
    tables,
    threadColumns,
  };
}

export async function validateCodexSchema(
  dbPath: string,
  options: {
    sqlite3Command?: string;
  } = {},
): Promise<CodexSchemaReport> {
  const report = await inspectCodexSchema(dbPath, options);

  if (!report.supported) {
    const details = [
      report.missingTables.length > 0 ? `missing tables: ${report.missingTables.join(', ')}` : null,
      report.missingThreadColumns.length > 0
        ? `missing thread columns: ${report.missingThreadColumns.join(', ')}`
        : null,
    ]
      .filter(Boolean)
      .join('; ');

    throw new Error(`Unsupported Codex schema: ${details}`);
  }

  return report;
}
