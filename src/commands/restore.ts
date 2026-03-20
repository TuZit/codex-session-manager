import type { ResolveCodexHomeOptions } from '../core/codex-home.js';
import { restoreSession } from '../core/restore.js';

type RestoreIo = {
  stderr: (chunk: string) => void;
  stdout: (chunk: string) => void;
};

const defaultIo: RestoreIo = {
  stderr: (chunk) => process.stderr.write(chunk),
  stdout: (chunk) => process.stdout.write(chunk),
};

type RestoreCommandOptions = ResolveCodexHomeOptions & {
  backupId: string;
  io?: RestoreIo;
  json?: boolean;
  sqlite3Command?: string;
};

function renderRestoreText(result: Awaited<ReturnType<typeof restoreSession>>): string {
  return [
    'Restored session',
    `sessionId: ${result.sessionId}`,
    `backupId: ${result.backupId}`,
    `layers: ${result.restoredLayers.join(', ')}`,
  ].join('\n');
}

export async function runRestoreCommand(options: RestoreCommandOptions): Promise<number> {
  const io = options.io ?? defaultIo;

  try {
    const result = await restoreSession({
      backupId: options.backupId,
      codexHome: options.codexHome,
      sqlite3Command: options.sqlite3Command,
    });

    if (options.json) {
      io.stdout(`${JSON.stringify(result)}\n`);
      return 0;
    }

    io.stdout(`${renderRestoreText(result)}\n`);
    return 0;
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}
