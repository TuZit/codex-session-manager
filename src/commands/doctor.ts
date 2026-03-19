import type { ResolveCodexHomeOptions } from '../core/codex-home.js';
import { checkCodexStoreFiles, resolveCodexHome } from '../core/codex-home.js';
import type { CodexSchemaReport } from '../core/session-types.js';
import { inspectCodexSchema } from '../core/schema.js';
import { checkSqlite3Binary, getJournalMode } from '../core/sqlite-store.js';

type DoctorIo = {
  stderr: (chunk: string) => void;
  stdout: (chunk: string) => void;
};

export type DoctorReport = {
  journalMode: string;
  ok: boolean;
  paths: ReturnType<typeof resolveCodexHome> & {
    missingRequiredPaths: string[];
  };
  schema: CodexSchemaReport;
  sqlite3: ReturnType<typeof checkSqlite3Binary>;
};

const defaultIo: DoctorIo = {
  stderr: (chunk) => process.stderr.write(chunk),
  stdout: (chunk) => process.stdout.write(chunk),
};

const EMPTY_SCHEMA_REPORT: CodexSchemaReport = {
  missingTables: [],
  missingThreadColumns: [],
  supported: false,
  tables: [],
  threadColumns: [],
};

export async function buildDoctorReport(
  options: ResolveCodexHomeOptions & {
    sqlite3Command?: string;
  } = {},
): Promise<DoctorReport> {
  const paths = resolveCodexHome(options);
  const pathCheck = await checkCodexStoreFiles(paths);
  const sqlite3 = checkSqlite3Binary(options.sqlite3Command);

  let journalMode = 'unknown';
  let schema = EMPTY_SCHEMA_REPORT;

  if (sqlite3.ok && pathCheck.ok) {
    journalMode = await getJournalMode(paths.stateDbPath);
    schema = await inspectCodexSchema(paths.stateDbPath);
  }

  return {
    journalMode,
    ok: pathCheck.ok && sqlite3.ok && schema.supported,
    paths: {
      ...paths,
      missingRequiredPaths: [...pathCheck.missingRequiredPaths],
    },
    schema,
    sqlite3,
  };
}

function renderDoctorReport(report: DoctorReport): string {
  return [
    `ok: ${report.ok}`,
    `codexHome: ${report.paths.codexHome}`,
    `sqlite3: ${report.sqlite3.ok ? 'ok' : 'missing'}`,
    `journalMode: ${report.journalMode}`,
    `schemaSupported: ${report.schema.supported}`,
  ].join('\n');
}

export async function runDoctorCommand(
  options: ResolveCodexHomeOptions & {
    io?: DoctorIo;
    json?: boolean;
    sqlite3Command?: string;
  } = {},
): Promise<number> {
  const io = options.io ?? defaultIo;

  try {
    const report = await buildDoctorReport(options);

    if (options.json) {
      io.stdout(`${JSON.stringify(report)}\n`);
    } else {
      io.stdout(`${renderDoctorReport(report)}\n`);
    }

    return report.ok ? 0 : 1;
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}
